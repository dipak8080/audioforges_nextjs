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
  Sparkles,
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

const PEAK_BUCKETS = 640;
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
        setPosition(pos);
        if (duration > 0 && !loopRef.current && pos >= duration) {
          pause();
          startOffsetRef.current = 0;
          setPosition(0);
        }
      }
      for (const stem of stems) {
        const lane = lanes.get(stem.name);
        const canvas = laneCanvasRefs.current.get(stem.name);
        if (canvas && lane?.peaks) {
          drawWaveform(canvas, lane.peaks, duration > 0 ? pos / duration : 0, solos.has(stem.name));
        }
        const meter = meterRefs.current.get(stem.name);
        const nodes = nodesRef.current.get(stem.name);
        if (meter && nodes) drawMeter(meter, nodes.analyser, playingRef.current);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stems, lanes, duration, solos, currentPosition, pause]);

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
      a.click();
      URL.revokeObjectURL(a.href);
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

  return (
    <div className="overflow-hidden rounded-xl border border-graphite-700 bg-graphite-900">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-graphite-800 px-4 py-3">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Forge Mixer
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                activePreset === p.key
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-500"
                  : "border-graphite-700 text-text-muted hover:border-graphite-600 hover:text-text"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* transport + loop ruler */}
      <div className="flex items-center gap-3 px-4 pt-3">
        <Button
          variant="primary"
          size="icon"
          onClick={togglePlay}
          disabled={!anyReady}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="h-4 w-4" fill="currentColor" aria-hidden />
          ) : (
            <Play className="h-4 w-4" fill="currentColor" aria-hidden />
          )}
        </Button>
        <span className="w-24 shrink-0 font-mono text-xs tabular-nums text-text-muted">
          {formatTime(position)} / {formatTime(duration)}
        </span>
        <div
          role="slider"
          aria-label="Loop region — drag to set"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={position}
          tabIndex={0}
          onPointerDown={onRulerPointerDown}
          onPointerMove={onRulerPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="relative h-6 min-w-0 flex-1 cursor-crosshair touch-none rounded bg-graphite-850"
          title="Drag to set an A–B loop"
        >
          {loop && duration > 0 && (
            <div
              className="absolute inset-y-0 rounded bg-teal-400/20 ring-1 ring-teal-400/50"
              style={{
                left: `${(loop.a / duration) * 100}%`,
                width: `${((loop.b - loop.a) / duration) * 100}%`,
              }}
            />
          )}
          <div
            className="absolute inset-y-0 w-px bg-amber-500"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
        {loop ? (
          <button
            type="button"
            onClick={() => setLoopRegion(null)}
            className="flex items-center gap-1 rounded-full border border-teal-400/50 bg-teal-400/10 px-2 py-1 text-xs text-teal-400"
          >
            <Repeat className="h-3 w-3" aria-hidden />
            {formatTime(loop.a)}–{formatTime(loop.b)}
            <X className="h-3 w-3" aria-hidden />
          </button>
        ) : (
          <span className="hidden items-center gap-1 text-[11px] text-text-subtle sm:flex">
            <Repeat className="h-3 w-3" aria-hidden /> drag bar to loop
          </span>
        )}
      </div>

      {/* lanes */}
      <div className="divide-y divide-graphite-800 px-2 py-2">
        {stems.map((stem) => {
          const lane = lanes.get(stem.name);
          const muted = mutes.has(stem.name);
          const soloed = solos.has(stem.name);
          const silenced = effectiveGain(stem.name, gains, mutes, solos) === 0;
          return (
            <div key={stem.name} className="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:gap-3">
              {/* identity */}
              <div className="flex w-full shrink-0 items-center gap-2 sm:w-36">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    soloed
                      ? "bg-teal-400 text-graphite-950"
                      : silenced
                        ? "bg-graphite-800 text-text-subtle"
                        : "bg-amber-500/15 text-amber-500"
                  )}
                >
                  {stem.icon ?? stemIcon(stem.name)}
                </span>
                <span className={cn("truncate text-sm font-medium", silenced ? "text-text-subtle" : "text-text")}>
                  {stem.name}
                </span>
              </div>

              {/* waveform */}
              <div
                onPointerDown={onWavePointerDown}
                onPointerMove={onWavePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={cn(
                  "relative h-14 min-w-0 flex-1 cursor-pointer touch-none overflow-hidden rounded-md bg-graphite-850",
                  silenced && "opacity-40"
                )}
              >
                {lane?.status === "loading" && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-text-subtle">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading stem…
                  </div>
                )}
                {lane?.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400">
                    Failed to load — use the download button instead
                  </div>
                )}
                {lane?.status === "ready" && (
                  <canvas
                    ref={(el) => {
                      if (el) laneCanvasRefs.current.set(stem.name, el);
                      else laneCanvasRefs.current.delete(stem.name);
                    }}
                    width={PEAK_BUCKETS * 2}
                    height={112}
                    className="h-full w-full"
                  />
                )}
              </div>

              {/* meter */}
              <canvas
                ref={(el) => {
                  if (el) meterRefs.current.set(stem.name, el);
                  else meterRefs.current.delete(stem.name);
                }}
                width={8}
                height={112}
                className="hidden h-14 w-1.5 rounded-full bg-graphite-850 sm:block"
                aria-hidden
              />

              {/* controls */}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleMute(stem.name)}
                  aria-pressed={muted}
                  aria-label={`Mute ${stem.name}`}
                  className={cn(
                    "h-7 w-7 rounded-md border text-xs font-semibold transition-colors",
                    muted
                      ? "border-amber-500 bg-amber-500 text-graphite-950"
                      : "border-graphite-700 text-text-muted hover:border-graphite-600"
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
                    "h-7 w-7 rounded-md border text-xs font-semibold transition-colors",
                    soloed
                      ? "border-teal-400 bg-teal-400 text-graphite-950"
                      : "border-graphite-700 text-text-muted hover:border-graphite-600"
                  )}
                >
                  S
                </button>
                <label className="flex items-center gap-1.5" title={`${stem.name} volume`}>
                  <span className="text-[10px] uppercase tracking-wide text-text-subtle">Vol</span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.01}
                    value={gains[stem.name] ?? 1}
                    onChange={(e) => setGain(stem.name, Number(e.target.value))}
                    aria-label={`${stem.name} volume`}
                    className="w-20 accent-amber-500"
                  />
                </label>
                <label className="flex items-center gap-1.5" title={`${stem.name} pan`}>
                  <span className="text-[10px] uppercase tracking-wide text-text-subtle">L·R</span>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={pans[stem.name] ?? 0}
                    onDoubleClick={() => setPan(stem.name, 0)}
                    onChange={(e) => setPan(stem.name, Number(e.target.value))}
                    aria-label={`${stem.name} pan`}
                    className="w-14 accent-amber-500"
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => downloadStem(stem)}
                  aria-label={`Download ${stem.name}`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-graphite-800 px-4 py-3">
        <Button
          variant="primary"
          size="sm"
          onClick={exportMix}
          disabled={!allReady}
          loading={exporting}
          loadingLabel="Rendering mix"
        >
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
          Export my mix (WAV)
        </Button>
        {onDownloadAll && (
          <Button variant="outline" size="sm" onClick={downloadAllStems}>
            Download all stems
          </Button>
        )}
        <span className="ml-auto hidden text-[11px] text-text-subtle sm:block">
          Space = play · ← → = seek · mixed in your browser
        </span>
      </div>
    </div>
  );
}

function drawWaveform(canvas: HTMLCanvasElement, peaks: Float32Array, progress: number, soloed: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const barW = width / peaks.length;
  const mid = height / 2;
  const cut = Math.floor(progress * peaks.length);
  for (let i = 0; i < peaks.length; i++) {
    const h = Math.max(2, peaks[i] * (height - 8));
    ctx.fillStyle = i < cut ? (soloed ? "#4dd8b8" : "#e8a23d") : "#45454d";
    ctx.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 1), h);
  }
}

function drawMeter(canvas: HTMLCanvasElement, analyser: AnalyserNode, playing: boolean) {
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
  grad.addColorStop(0, "#e8a23d");
  grad.addColorStop(0.8, "#e8a23d");
  grad.addColorStop(1, "#ef4444");
  ctx.fillStyle = grad;
  ctx.fillRect(0, height - h, width, h);
}