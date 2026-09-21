"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Download,
  Drum,
  Guitar,
  Loader2,
  Mic2,
  Music2,
  Pause,
  Play,
  Repeat,
  Waves,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { extractPeaks } from "@/lib/audio/peaks";
import { renderMixToWav } from "@/lib/audio/mix-export";

export interface StemMixerStem {
  name: string;
  url: string;
  icon?: ReactNode;
  /** Filename the server's download route would give this stem. When set, the
   *  Download buttons save the copy the mixer already fetched instead of
   *  pulling the same WAV from the server a second time. */
  downloadName?: string;
}

export interface StemMixerProps {
  stems: StemMixerStem[];
  onDownload: (name: string) => void;
  onDownloadAll?: () => void;
  sourceTitle?: string | null;
}

type LaneStatus = "loading" | "ready" | "error";

interface LaneData {
  status: LaneStatus;
  buffer: AudioBuffer | null;
  peaks: Float32Array | null;
}

interface LaneNodes {
  gain: GainNode;
  panner: StereoPannerNode;
  analyser: AnalyserNode;
  source: AudioBufferSourceNode | null;
}

interface MixPreset {
  key: string;
  label: string;
  /** stem-name substring → gain (0 mutes). Unlisted stems play at 1. */
  gains: Record<string, number>;
}

const PEAK_BUCKETS = 1600;
const RAMP = 0.015;

function stemIcon(name: string): ReactNode {
  const n = name.toLowerCase();
  if (n.includes("vocal") || n.includes("voice")) return <Mic2 className="h-4 w-4" aria-hidden />;
  if (n.includes("drum")) return <Drum className="h-4 w-4" aria-hidden />;
  if (n.includes("bass") || n.includes("guitar")) return <Guitar className="h-4 w-4" aria-hidden />;
  if (n.includes("instrument")) return <Waves className="h-4 w-4" aria-hidden />;
  return <Music2 className="h-4 w-4" aria-hidden />;
}

function presetsFor(stemNames: string[]): MixPreset[] {
  const has = (frag: string) => stemNames.some((n) => n.toLowerCase().includes(frag));
  const list: MixPreset[] = [{ key: "original", label: "Original", gains: {} }];
  if (has("vocal")) {
    list.push({ key: "karaoke", label: "Karaoke", gains: { vocal: 0 } });
    const others: Record<string, number> = {};
    for (const n of stemNames) {
      if (!n.toLowerCase().includes("vocal")) others[n.toLowerCase()] = 0;
    }
    list.push({ key: "acapella", label: "Acapella", gains: others });
  }
  if (has("drum")) list.push({ key: "drumless", label: "Drumless", gains: { drum: 0 } });
  if (has("bass")) list.push({ key: "bassless", label: "Bassless", gains: { bass: 0 } });
  return list;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function StemMixer({ stems, onDownload, onDownloadAll, sourceTitle }: StemMixerProps) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Map<string, LaneNodes>>(new Map());
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  /** Original WAV bytes per stem, kept for the Download buttons. */
  const filesRef = useRef<Map<string, { url: string; blob: Blob }>>(new Map());
  const startCtxTimeRef = useRef(0);
  const startOffsetRef = useRef(0);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  const loopRef = useRef<{ a: number; b: number } | null>(null);
  const laneCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const meterRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const dragRef = useRef<null | "seek" | "loop">(null);
  // Written directly from the rAF loop so the playhead and the clock
  // can update every frame without a React render. See the readout
  // and playhead in the transport below.
  const timeRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const loopAnchorRef = useRef(0);

  const [lanes, setLanes] = useState<Map<string, LaneData>>(
    () => new Map(stems.map((s) => [s.name, { status: "loading", buffer: null, peaks: null }]))
  );
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [gains, setGains] = useState<Record<string, number>>(
    () => Object.fromEntries(stems.map((s) => [s.name, 1]))
  );
  const [pans, setPans] = useState<Record<string, number>>(
    () => Object.fromEntries(stems.map((s) => [s.name, 0]))
  );
  const [mutes, setMutes] = useState<Set<string>>(new Set());
  const [solos, setSolos] = useState<Set<string>>(new Set());
  const [loop, setLoop] = useState<{ a: number; b: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activePreset, setActivePreset] = useState("original");

  const duration = useMemo(() => {
    let d = 0;
    for (const lane of lanes.values()) {
      if (lane.buffer && lane.buffer.duration > d) d = lane.buffer.duration;
    }
    return d;
  }, [lanes]);

  const allReady = useMemo(
    () => stems.every((s) => lanes.get(s.name)?.status === "ready"),
    [stems, lanes]
  );
  const anyReady = useMemo(
    () => stems.some((s) => lanes.get(s.name)?.status === "ready"),
    [stems, lanes]
  );

  const presets = useMemo(() => presetsFor(stems.map((s) => s.name)), [stems]);

  const stemsRef = useRef(stems);
  useEffect(() => {
    stemsRef.current = stems;
  });
  const stemsKey = stems.map((s) => `${s.name}|${s.url}`).join(";");

  /** Saves the in-tab copy. False when there isn't a usable one yet. */
  const saveLocalCopy = (stem: StemMixerStem): boolean => {
    const file = filesRef.current.get(stem.name);
    if (!stem.downloadName || !file || file.url !== stem.url || !/wav/i.test(file.blob.type)) return false;
    const href = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = stem.downloadName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return true;
  };

  const downloadStem = (stem: StemMixerStem) => {
    if (!saveLocalCopy(stem)) onDownload(stem.name);
  };

  const downloadAllStems = () => {
    // Browsers throttle rapid multi-downloads; same 400 ms stagger as triggerDownloadsStaggered
    stems.forEach((stem, i) => window.setTimeout(() => downloadStem(stem), i * 400));
  };

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const effectiveGain = useCallback(
    (name: string, g: Record<string, number>, m: Set<string>, s: Set<string>) => {
      if (m.has(name)) return 0;
      if (s.size > 0 && !s.has(name)) return 0;
      return g[name] ?? 1;
    },
    []
  );

  const applyGains = useCallback(
    (g: Record<string, number>, m: Set<string>, s: Set<string>) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      for (const [name, nodes] of nodesRef.current) {
        nodes.gain.gain.setTargetAtTime(effectiveGain(name, g, m, s), ctx.currentTime, RAMP);
      }
    },
    [effectiveGain]
  );

  const currentPosition = useCallback(() => {
    if (!playingRef.current || !ctxRef.current) return startOffsetRef.current;
    let pos = Math.max(
      0,
      startOffsetRef.current + (ctxRef.current.currentTime - startCtxTimeRef.current)
    );
    const lp = loopRef.current;
    if (lp && pos > lp.a) {
      pos = lp.a + ((pos - lp.a) % Math.max(0.05, lp.b - lp.a));
    }
    return pos;
  }, []);

  const stopSources = useCallback(() => {
    for (const nodes of nodesRef.current.values()) {
      if (nodes.source) {
        try {
          nodes.source.stop();
        } catch {}
        nodes.source.disconnect();
        nodes.source = null;
      }
    }
  }, []);

  const startSourceFor = useCallback(
    (name: string, buffer: AudioBuffer, when: number, offset: number) => {
      const ctx = getCtx();
      let nodes = nodesRef.current.get(name);
      if (!nodes) {
        const gain = ctx.createGain();
        const panner = ctx.createStereoPanner();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        gain.connect(panner).connect(analyser).connect(ctx.destination);
        nodes = { gain, panner, analyser, source: null };
        nodesRef.current.set(name, nodes);
      }
      nodes.gain.gain.value = effectiveGain(name, gains, mutes, solos);
      nodes.panner.pan.value = pans[name] ?? 0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const lp = loopRef.current;
      if (lp) {
        source.loop = true;
        source.loopStart = Math.min(lp.a, buffer.duration);
        source.loopEnd = Math.min(lp.b, buffer.duration);
      }
      source.connect(nodes.gain);
      const safeOffset = Math.max(0, offset);
      if (safeOffset < buffer.duration) {
        source.start(when, safeOffset);
      }
      nodes.source = source;
    },
    [getCtx, effectiveGain, gains, mutes, pans, solos]
  );

  const startPlaybackAt = useCallback(
    (offset: number) => {
      const ctx = getCtx();
      if (ctx.state === "suspended") void ctx.resume();
      stopSources();
      const when = ctx.currentTime + 0.06;
      for (const [name, buffer] of buffersRef.current) {
        startSourceFor(name, buffer, when, offset);
      }
      startCtxTimeRef.current = when;
      startOffsetRef.current = offset;
      playingRef.current = true;
      setPlaying(true);
    },
    [getCtx, stopSources, startSourceFor]
  );

  const pause = useCallback(() => {
    startOffsetRef.current = currentPosition();
    stopSources();
    playingRef.current = false;
    setPlaying(false);
    setPosition(startOffsetRef.current);
  }, [currentPosition, stopSources]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      pause();
    } else {
      let pos = startOffsetRef.current;
      if (duration > 0 && pos >= duration - 0.05) pos = 0;
      startPlaybackAt(pos);
    }
  }, [pause, startPlaybackAt, duration]);

  const seekTo = useCallback(
    (t: number) => {
      let clamped = Math.max(0, Math.min(t, duration || t));
      const lp = loopRef.current;
      if (lp && clamped >= lp.b) clamped = lp.a;
      if (playingRef.current) {
        startPlaybackAt(clamped);
      } else {
        startOffsetRef.current = clamped;
        setPosition(clamped);
      }
    },
    [duration, startPlaybackAt]
  );

  /* ── decode stems progressively; hot-add lanes that finish while playing ── */
  useEffect(() => {
    let cancelled = false;
    const ctx = getCtx();
    for (const stem of stemsRef.current) {
      (async () => {
        try {
          const res = await fetch(stem.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const bytes = await res.arrayBuffer();
          // Copy before decodeAudioData, which can detach the ArrayBuffer
          const file = new Blob([bytes], { type: res.headers.get("content-type") || "" });
          const buffer = await ctx.decodeAudioData(bytes);
          if (cancelled) return;
          buffersRef.current.set(stem.name, buffer);
          filesRef.current.set(stem.name, { url: stem.url, blob: file });
          const { peaks } = extractPeaks(buffer, PEAK_BUCKETS);
          setLanes((prev) => {
            const next = new Map(prev);
            next.set(stem.name, { status: "ready", buffer, peaks });
            return next;
          });
          if (playingRef.current) {
            startSourceFor(stem.name, buffer, ctx.currentTime + 0.06, currentPosition() + 0.06);
          }
        } catch {
          if (cancelled) return;
          setLanes((prev) => {
            const next = new Map(prev);
            next.set(stem.name, { status: "error", buffer: null, peaks: null });
            return next;
          });
        }
      })();
    }
    const nodes = nodesRef.current;
    const buffers = buffersRef.current;
    const files = filesRef.current;
    return () => {
      cancelled = true;
      stopSources();
      playingRef.current = false;
      setPlaying(false);
      startOffsetRef.current = 0;
      startCtxTimeRef.current = 0;
      setPosition(0);
      void ctxRef.current?.close();
      ctxRef.current = null;
      nodes.clear();
      buffers.clear();
      files.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stemsKey]);

  /* ── rAF: playhead, waveform progress, meters ── */
  useEffect(() => {
    const draw = () => {
      const pos = currentPosition();
      if (playingRef.current) {
        // DOM, not state. setPosition here re-rendered the whole mixer on
        // every frame for the length of the track; these two writes are
        // what that render existed to produce.
        if (timeRef.current) timeRef.current.textContent = formatTime(pos);
        if (headRef.current && duration > 0) {
          headRef.current.style.left = `${Math.min(1, pos / duration) * 100}%`;
        }
        if (duration > 0 && !loopRef.current && pos >= duration) {
          pause();
          startOffsetRef.current = 0;
          // A real transition, so state is right here: playback stopped and
          // everything bound to `position` should settle at zero.
          setPosition(0);
        }
      }
      for (const stem of stems) {
        const lane = lanes.get(stem.name);
        const canvas = laneCanvasRefs.current.get(stem.name);
        const color = stemColor(stem.name);
        if (canvas && lane?.peaks) {
          drawWaveform(
            canvas,
            lane.peaks,
            duration > 0 ? pos / duration : 0,
            color,
            effectiveGain(stem.name, gains, mutes, solos) === 0
          );
        }
        const meter = meterRefs.current.get(stem.name);
        const nodes = nodesRef.current.get(stem.name);
        if (meter && nodes) drawMeter(meter, nodes.analyser, playingRef.current, color);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stems, lanes, duration, gains, mutes, solos, effectiveGain, currentPosition, pause]);

  /* ── keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        el?.isContentEditable ||
        el?.closest?.("button")
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        seekTo(currentPosition() - 5);
      } else if (e.code === "ArrowRight") {
        seekTo(currentPosition() + 5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekTo, currentPosition]);

  /* ── loop changes restart sources so Web Audio loop points apply ── */
  const setLoopRegion = useCallback(
    (region: { a: number; b: number } | null) => {
      loopRef.current = region;
      setLoop(region);
      if (playingRef.current) startPlaybackAt(currentPosition());
    },
    [startPlaybackAt, currentPosition]
  );

  const toggleMute = (name: string) => {
    setMutes((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      applyGains(gains, next, solos);
      return next;
    });
    setActivePreset("");
  };

  const toggleSolo = (name: string) => {
    setSolos((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      applyGains(gains, mutes, next);
      return next;
    });
    setActivePreset("");
  };

  const setGain = (name: string, value: number) => {
    setGains((prev) => {
      const next = { ...prev, [name]: value };
      applyGains(next, mutes, solos);
      return next;
    });
    setActivePreset("");
  };

  const setPan = (name: string, value: number) => {
    setPans((prev) => {
      const next = { ...prev, [name]: value };
      const ctx = ctxRef.current;
      const nodes = nodesRef.current.get(name);
      if (ctx && nodes) nodes.panner.pan.setTargetAtTime(value, ctx.currentTime, RAMP);
      return next;
    });
    setActivePreset("");
  };

  const applyPreset = (preset: MixPreset) => {
    const nextGains: Record<string, number> = {};
    for (const stem of stems) {
      const frag = Object.keys(preset.gains).find((k) => stem.name.toLowerCase().includes(k));
      nextGains[stem.name] = frag !== undefined ? preset.gains[frag] : 1;
    }
    const emptyM = new Set<string>();
    const emptyS = new Set<string>();
    setGains(nextGains);
    setMutes(emptyM);
    setSolos(emptyS);
    setPans(Object.fromEntries(stems.map((s) => [s.name, 0])));
    const ctx = ctxRef.current;
    if (ctx) {
      for (const nodes of nodesRef.current.values()) {
        nodes.panner.pan.setTargetAtTime(0, ctx.currentTime, RAMP);
      }
    }
    applyGains(nextGains, emptyM, emptyS);
    setActivePreset(preset.key);
  };

  const exportMix = async () => {
    if (exporting || !allReady) return;
    setExporting(true);
    try {
      const blob = await renderMixToWav(
        stems.map((s) => ({
          buffer: buffersRef.current.get(s.name)!,
          gain: effectiveGain(s.name, gains, mutes, solos),
          pan: pans[s.name] ?? 0,
          muted: effectiveGain(s.name, gains, mutes, solos) === 0,
        }))
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${sourceTitle || "mix"} (AudioForges Mix).wav`;
      // Attached, and revoked on a later tick. Firefox ignores click() on a
      // detached anchor, and revoking the blob URL on the same tick aborts
      // the download. A mix export can be tens of megabytes, so the delay is
      // generous.
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 60_000);
    } finally {
      setExporting(false);
    }
  };

  /* ── pointer interaction on the timeline / waveforms ── */
  const timeFromEvent = (e: React.PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return frac * duration;
  };

  const onWavePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    dragRef.current = "seek";
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seekTo(timeFromEvent(e, e.currentTarget));
  };

  const onWavePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current !== "seek") return;
    seekTo(timeFromEvent(e, e.currentTarget));
  };

  const onRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    dragRef.current = "loop";
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    loopAnchorRef.current = timeFromEvent(e, e.currentTarget);
  };

  const onRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current !== "loop") return;
    const t = timeFromEvent(e, e.currentTarget);
    const a = Math.min(loopAnchorRef.current, t);
    const b = Math.max(loopAnchorRef.current, t);
    if (b - a > 0.25) setLoopRegion({ a, b });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const ticks = rulerTicks(duration);
  const laneHeight = stems.length > 2 ? "h-20 sm:h-24" : "h-24 sm:h-32";

  return (
    <div className="[--hd:0px] sm:[--hd:15rem]">
      {/* transport */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pb-5">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!anyReady}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:cursor-not-allowed disabled:opacity-40",
            playing
              ? "border-amber-500 bg-amber-500 text-graphite-950"
              : "border-graphite-600 text-text-primary hover:border-text-primary/70"
          )}
        >
          {playing ? (
            <Pause className="h-5 w-5" fill="currentColor" aria-hidden />
          ) : (
            <Play className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden />
          )}
        </button>

        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-subtle">
            Forge Mixer
          </p>
          <p className="mt-1 font-mono tabular-nums leading-none">
            <span
              ref={timeRef}
              className={cn("text-2xl sm:text-3xl", playing ? "text-amber-400" : "text-text-primary")}
            >
              {formatTime(position)}
            </span>
            <span className="ml-2 text-sm text-text-subtle">/ {formatTime(duration)}</span>
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {loop && (
            <button
              type="button"
              onClick={() => setLoopRegion(null)}
              className="flex items-center gap-1.5 rounded-full border border-graphite-600 px-3 py-1.5 font-mono text-[11px] text-text-primary outline-none transition-colors hover:border-text-primary/70 focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              <Repeat className="h-3 w-3" aria-hidden />
              {formatTime(loop.a)} to {formatTime(loop.b)}
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
          <div
            role="group"
            aria-label="Mix presets"
            className="flex rounded-full border border-graphite-700 bg-graphite-950/60 p-0.5"
          >
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p)}
                aria-pressed={activePreset === p.key}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70 sm:px-4",
                  activePreset === p.key
                    ? "bg-graphite-700 text-text-primary"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* timeline: a recessed screen, one playhead across every lane */}
      <div className="relative overflow-hidden rounded-xl bg-graphite-950/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
        <div className="grid sm:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="hidden items-end border-b border-r border-graphite-800 px-4 pb-1.5 sm:flex">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
              <Repeat className="h-3 w-3" aria-hidden />
              Drag the ruler to loop
            </span>
          </div>
          <div
            role="slider"
            aria-label="Loop region, drag to set"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={position}
            tabIndex={0}
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            title="Drag to set an A to B loop"
            className="relative h-7 cursor-crosshair touch-none border-b border-graphite-800 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60"
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="pointer-events-none absolute bottom-0 flex h-full flex-col justify-end border-l border-white/10 pl-1.5 pb-1 font-mono text-[10px] leading-none text-text-subtle"
                style={{ left: `${(t / duration) * 100}%` }}
              >
                {formatTime(t)}
              </span>
            ))}
          </div>
        </div>

        {stems.map((stem, index) => {
          const lane = lanes.get(stem.name);
          const muted = mutes.has(stem.name);
          const soloed = solos.has(stem.name);
          const silenced = effectiveGain(stem.name, gains, mutes, solos) === 0;
          const color = stemColor(stem.name);
          const gainValue = gains[stem.name] ?? 1;
          const panValue = pans[stem.name] ?? 0;
          return (
            <div
              key={stem.name}
              className={cn(
                "grid sm:grid-cols-[15rem_minmax(0,1fr)]",
                index > 0 && "border-t border-graphite-800"
              )}
            >
              {/* channel strip */}
              <div className="flex gap-3 border-graphite-800 px-4 py-3 sm:border-r">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                      style={{
                        color: silenced ? "var(--text-subtle)" : color,
                        borderColor: silenced ? "var(--graphite-700)" : `${color}66`,
                        backgroundColor: silenced ? "transparent" : `${color}14`,
                      }}
                    >
                      {stem.icon ?? stemIcon(stem.name)}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm font-medium",
                        silenced ? "text-text-subtle" : "text-text-primary"
                      )}
                    >
                      {stem.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleMute(stem.name)}
                      aria-pressed={muted}
                      aria-label={`Mute ${stem.name}`}
                      className={cn(
                        "h-7 w-7 shrink-0 rounded-md border font-mono text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70",
                        muted
                          ? "border-text-primary bg-text-primary text-graphite-950"
                          : "border-graphite-700 text-text-muted hover:border-graphite-500 hover:text-text-primary"
                      )}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSolo(stem.name)}
                      aria-pressed={soloed}
                      aria-label={`Solo ${stem.name}`}
                      className={cn(
                        "h-7 w-7 shrink-0 rounded-md border font-mono text-[11px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70",
                        soloed
                          ? "border-amber-500 bg-amber-500 text-graphite-950"
                          : "border-graphite-700 text-text-muted hover:border-graphite-500 hover:text-text-primary"
                      )}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadStem(stem)}
                      aria-label={`Download ${stem.name}`}
                      title={`Download ${stem.name}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-graphite-700 text-text-muted outline-none transition-colors hover:border-graphite-500 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
                    <label className="block">
                      <span className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-text-subtle">
                        Vol
                        <span className="tabular-nums text-text-muted">
                          {Math.round(gainValue * 100)}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.01}
                        value={gainValue}
                        onChange={(e) => setGain(stem.name, Number(e.target.value))}
                        onDoubleClick={() => setGain(stem.name, 1)}
                        aria-label={`${stem.name} volume`}
                        className="fm-range mt-1.5 w-full"
                      />
                    </label>
                    <label className="block">
                      <span className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-text-subtle">
                        Pan
                        <span className="tabular-nums text-text-muted">{panLabel(panValue)}</span>
                      </span>
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.01}
                        value={panValue}
                        onDoubleClick={() => setPan(stem.name, 0)}
                        onChange={(e) => setPan(stem.name, Number(e.target.value))}
                        aria-label={`${stem.name} pan`}
                        className="fm-range mt-1.5 w-full"
                      />
                    </label>
                  </div>
                </div>

                <canvas
                  ref={(el) => {
                    if (el) meterRefs.current.set(stem.name, el);
                    else meterRefs.current.delete(stem.name);
                  }}
                  width={8}
                  height={112}
                  className="w-1 shrink-0 self-stretch rounded-full bg-graphite-800"
                  aria-hidden
                />
              </div>

              {/* waveform */}
              <div
                onPointerDown={onWavePointerDown}
                onPointerMove={onWavePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={cn("relative min-w-0 cursor-pointer touch-none", laneHeight)}
              >
                {lane?.status === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 font-mono text-[11px] text-text-subtle">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading stem
                  </div>
                )}
                {lane?.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-red-400">
                    This stem did not load. Use its download button instead.
                  </div>
                )}
                {lane?.status === "ready" && (
                  <canvas
                    ref={(el) => {
                      if (el) laneCanvasRefs.current.set(stem.name, el);
                      else laneCanvasRefs.current.delete(stem.name);
                    }}
                    className="absolute inset-0 h-full w-full"
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* overlay on the timeline column: grid, loop region, playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden sm:block"
          style={{ left: "var(--hd)" }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-px bg-white/[0.04]"
              style={{ left: `${(t / duration) * 100}%` }}
            />
          ))}
          {loop && duration > 0 && (
            <div
              className="absolute inset-y-0 border-x border-white/40 bg-white/[0.06]"
              style={{
                left: `${(loop.a / duration) * 100}%`,
                width: `${((loop.b - loop.a) / duration) * 100}%`,
              }}
            />
          )}
          <div
            ref={headRef}
            className="absolute inset-y-0 w-px bg-amber-400 shadow-[0_0_10px_rgba(232,162,61,0.7)]"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* footer */}
      <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle sm:block">
          Space play · arrows seek · double click a slider to reset · mixed in your browser
        </span>
        <div className="flex flex-col gap-2 sm:flex-row">
          {onDownloadAll && (
            <Button variant="outline" size="md" onClick={downloadAllStems}>
              <Download aria-hidden />
              Download all stems
            </Button>
          )}
          <Button
            variant="primary"
            size="md"
            onClick={exportMix}
            disabled={!allReady}
            loading={exporting}
            loadingLabel="Rendering mix"
          >
            Export my mix as WAV
          </Button>
        </div>
      </div>

      <style href="af-forge-mixer" precedence="default">
        {RANGE_CSS}
      </style>
    </div>
  );
}

const RANGE_CSS = `
.fm-range{appearance:none;-webkit-appearance:none;height:14px;background:transparent;cursor:pointer;display:block}
.fm-range::-webkit-slider-runnable-track{height:2px;border-radius:2px;background:var(--graphite-600)}
.fm-range::-moz-range-track{height:2px;border-radius:2px;background:var(--graphite-600)}
.fm-range::-webkit-slider-thumb{-webkit-appearance:none;height:12px;width:12px;margin-top:-5px;border-radius:9999px;background:var(--text-primary);box-shadow:0 0 0 3px var(--graphite-900)}
.fm-range::-moz-range-thumb{height:12px;width:12px;border:0;border-radius:9999px;background:var(--text-primary);box-shadow:0 0 0 3px var(--graphite-900)}
.fm-range:focus-visible{outline:2px solid rgba(232,162,61,.7);outline-offset:3px;border-radius:4px}
`;

const STEM_COLORS = {
  vocal: "#e8a23d",
  drum: "#e0705c",
  bass: "#4dd8b8",
  other: "#cfcabd",
} as const;

function stemColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("vocal") || n.includes("voice")) return STEM_COLORS.vocal;
  if (n.includes("drum")) return STEM_COLORS.drum;
  if (n.includes("bass") || n.includes("instrument")) return STEM_COLORS.bass;
  return STEM_COLORS.other;
}

function panLabel(pan: number): string {
  const v = Math.round(pan * 100);
  if (v === 0) return "C";
  return v < 0 ? `L${-v}` : `R${v}`;
}

function rulerTicks(duration: number): number[] {
  if (duration <= 0) return [];
  const step = [5, 10, 15, 30, 60, 120, 300].find((s) => duration / s <= 9) ?? 600;
  const out: number[] = [];
  for (let t = 0; t < duration - step * 0.25; t += step) out.push(t);
  return out;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: Float32Array,
  progress: number,
  color: string,
  silenced: boolean
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.round(canvas.clientWidth * dpr);
  const height = Math.round(canvas.clientHeight * dpr);
  if (width === 0 || height === 0) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.clearRect(0, 0, width, height);

  const mid = Math.round(height / 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, mid, width, 1);

  const barW = Math.max(1, Math.round(2 * dpr));
  const pitch = barW + Math.max(1, Math.round(dpr));
  const bars = Math.floor(width / pitch);
  const cut = progress * bars;
  const tone = silenced ? "#4a4a52" : color;
  ctx.fillStyle = tone;

  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i / bars) * peaks.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * peaks.length));
    let peak = 0;
    for (let j = from; j < to && j < peaks.length; j++) if (peaks[j] > peak) peak = peaks[j];
    const h = Math.max(dpr, peak * height * 0.88);
    ctx.globalAlpha = silenced ? 0.5 : i < cut ? 1 : 0.34;
    ctx.fillRect(i * pitch, mid - h / 2, barW, h);
  }
  ctx.globalAlpha = 1;
}

function drawMeter(canvas: HTMLCanvasElement, analyser: AnalyserNode, playing: boolean, color: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (!playing) return;
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i] - 128) / 128;
    if (v > peak) peak = v;
  }
  const h = Math.min(1, peak * 1.4) * height;
  const grad = ctx.createLinearGradient(0, height, 0, 0);
  grad.addColorStop(0, color);
  grad.addColorStop(0.82, color);
  grad.addColorStop(1, "#ef4444");
  ctx.fillStyle = grad;
  ctx.fillRect(0, height - h, width, h);
}