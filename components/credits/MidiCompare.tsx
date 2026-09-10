"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { decodeWaveformEnvelopeFromUrl, type WaveformEnvelope } from "@/lib/utils/waveform";

type Variant = "original" | "standard" | "hq";

export interface CompareCue {
  at: number;
  label: string;
}

interface Loop {
  start: number;
  end: number;
}

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function drawLane(canvas: HTMLCanvasElement | null, env: WaveformEnvelope | null, active: boolean) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const mid = h / 2;
  const amber = cssVar("--amber-500", "#e8a23d");
  const amberSoft = cssVar("--amber-300", "#f5cd8e");
  const grey = cssVar("--graphite-600", "#45454d");
  const greyDim = cssVar("--graphite-700", "#34343a");

  ctx.fillStyle = greyDim;
  ctx.fillRect(0, Math.round(mid), w, 1);
  if (!env || env.columns === 0) return;

  const pitch = 2;
  const bars = Math.floor(w / pitch);
  const per = env.columns / bars;
  const half = mid - 3;

  ctx.fillStyle = active ? amber : grey;
  ctx.globalAlpha = active ? 0.42 : 0.35;
  for (let i = 0; i < bars; i++) {
    const a = Math.floor(i * per);
    const b = Math.max(a + 1, Math.floor((i + 1) * per));
    let lo = 0;
    let hi = 0;
    for (let c = a; c < b; c++) {
      if (env.min[c] < lo) lo = env.min[c];
      if (env.max[c] > hi) hi = env.max[c];
    }
    const top = mid - hi * half;
    const bot = mid - lo * half;
    ctx.fillRect(i * pitch, top, 1.4, Math.max(1, bot - top));
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = active ? amberSoft : grey;
  for (let i = 0; i < bars; i++) {
    const a = Math.floor(i * per);
    const b = Math.max(a + 1, Math.floor((i + 1) * per));
    let rms = 0;
    for (let c = a; c < b; c++) rms += env.rms[c];
    rms /= b - a;
    if (rms < 0.004) continue;
    const r = rms * half;
    ctx.fillRect(i * pitch, mid - r, 1.4, Math.max(1, r * 2));
  }
}

/**
 * Three lanes rather than two: the source recording is the reference both
 * transcriptions are judged against, so it has to be one click away at the
 * same playhead, not a separate player above.
 */
export function MidiCompare({
  originalSrc,
  standardSrc,
  hqSrc,
  trackLabel,
  sourceLabel = "Melody",
  cues = [],
}: {
  originalSrc?: string;
  standardSrc?: string;
  hqSrc?: string;
  /** e.g. "Sung melody, room tone" — say why this clip is a fair test. */
  trackLabel?: string;
  sourceLabel?: string;
  cues?: CompareCue[];
}) {
  const originalRef = useRef<HTMLAudioElement | null>(null);
  const standardRef = useRef<HTMLAudioElement | null>(null);
  const hqRef = useRef<HTMLAudioElement | null>(null);
  const canvases = useRef<Record<Variant, HTMLCanvasElement | null>>({
    original: null,
    standard: null,
    hq: null,
  });
  const lanesRef = useRef<HTMLDivElement | null>(null);

  const audioCtx = useRef<AudioContext | null>(null);
  const analysers = useRef<Record<Variant, AnalyserNode | null>>({
    original: null,
    standard: null,
    hq: null,
  });
  const raf = useRef<number>(0);

  const [active, setActive] = useState<Variant>("original");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [armed, setArmed] = useState(false);
  const [envs, setEnvs] = useState<Record<Variant, WaveformEnvelope | null>>({
    original: null,
    standard: null,
    hq: null,
  });
  const [levels, setLevels] = useState<Record<Variant, number>>({ original: 0, standard: 0, hq: 0 });
  const [loop, setLoop] = useState<Loop | null>(null);
  const [drag, setDrag] = useState<Loop | null>(null);

  const activeRef = useRef<Variant>("original");
  const loopRef = useRef<Loop | null>(null);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  const refFor = useCallback((v: Variant) => {
    if (v === "original") return originalRef.current;
    if (v === "standard") return standardRef.current;
    return hqRef.current;
  }, []);

  useEffect(() => {
    const a = originalRef.current;
    const b = standardRef.current;
    const c = hqRef.current;
    return () => {
      a?.pause();
      b?.pause();
      c?.pause();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  useEffect(() => {
    const draw = () => {
      (["original", "standard", "hq"] as Variant[]).forEach((v) =>
        drawLane(canvases.current[v], envs[v], active === v)
      );
    };
    draw();
    const el = lanesRef.current;
    if (!el) return;
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [envs, active]);

  const arm = useCallback(() => {
    if (armed) return;
    setArmed(true);
    const pairs: [Variant, string | undefined][] = [
      ["original", originalSrc],
      ["standard", standardSrc],
      ["hq", hqSrc],
    ];
    for (const [v, src] of pairs) {
      const el = refFor(v);
      if (el) {
        el.preload = "auto";
        el.load();
      }
      if (src) void decodeWaveformEnvelopeFromUrl(src).then((e) => e && setEnvs((s) => ({ ...s, [v]: e })));
    }

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtx.current = ctx;
      (["original", "standard", "hq"] as Variant[]).forEach((v) => {
        const el = refFor(v);
        if (!el) return;
        const src = ctx.createMediaElementSource(el);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        an.connect(ctx.destination);
        analysers.current[v] = an;
      });
    } catch {
      audioCtx.current = null;
    }
  }, [armed, refFor, originalSrc, standardSrc, hqSrc]);

  useEffect(() => {
    if (!playing) return;
    const buf = new Uint8Array(512);
    const tick = () => {
      const el = refFor(activeRef.current);
      if (el) {
        const t = el.currentTime;
        const lp = loopRef.current;
        if (lp && t >= lp.end) {
          (["original", "standard", "hq"] as Variant[]).forEach((v) => {
            const other = refFor(v);
            if (other) other.currentTime = lp.start;
          });
        }
        setTime(el.currentTime);
      }
      const next: Record<Variant, number> = { original: 0, standard: 0, hq: 0 };
      const an = analysers.current[activeRef.current];
      if (an) {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const d = Math.abs(buf[i] - 128) / 128;
          if (d > peak) peak = d;
        }
        next[activeRef.current] = peak;
      }
      setLevels(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, refFor]);

  if (!originalSrc || !standardSrc || !hqSrc) return null;

  const LANES: { id: Variant; title: string; note: string }[] = [
    { id: "original", title: "Original", note: sourceLabel },
    { id: "standard", title: "Standard", note: "Always free" },
    { id: "hq", title: "High accuracy", note: "From 1 credit" },
  ];

  function toggle() {
    const el = refFor(active);
    if (!el) return;
    if (el.paused) {
      arm();
      void audioCtx.current?.resume();
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  function switchTo(next: Variant) {
    if (next === active) return;
    const from = refFor(active);
    const to = refFor(next);
    if (!from || !to) return;
    arm();
    const at = from.currentTime;
    const wasPlaying = !from.paused;
    from.pause();
    to.currentTime = at;
    if (wasPlaying) void to.play().catch(() => {});
    setActive(next);
  }

  function seekTo(seconds: number) {
    if (!duration) return;
    const at = Math.min(duration - 0.02, Math.max(0, seconds));
    (["original", "standard", "hq"] as Variant[]).forEach((v) => {
      const el = refFor(v);
      if (el) el.currentTime = at;
    });
    setTime(at);
  }

  function ratioFromEvent(e: React.PointerEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }

  function onLanePointerDown(v: Variant, e: React.PointerEvent<HTMLDivElement>) {
    if (!duration) {
      switchTo(v);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = ratioFromEvent(e) * duration;
    setDrag({ start: t, end: t });
  }

  function onLanePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || !duration) return;
    setDrag({ start: drag.start, end: ratioFromEvent(e) * duration });
  }

  function onLanePointerUp(v: Variant, e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const a = Math.min(drag.start, drag.end);
    const b = Math.max(drag.start, drag.end);
    setDrag(null);
    if (b - a < 0.25) {
      switchTo(v);
      seekTo(a);
      return;
    }
    setLoop({ start: a, end: b });
    seekTo(a);
    switchTo(v);
  }

  function onKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        toggle();
        break;
      case "1":
        switchTo("original");
        break;
      case "2":
        switchTo("standard");
        break;
      case "3":
        switchTo("hq");
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekTo(time - 2);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekTo(time + 2);
        break;
      case "l":
        setLoop(null);
        break;
    }
  }

  function reportDuration(el: HTMLAudioElement) {
    const d = el.duration;
    if (Number.isFinite(d) && d > 0) setDuration(d);
  }

  function handleEnded() {
    setPlaying(false);
    setLevels({ original: 0, standard: 0, hq: 0 });
    (["original", "standard", "hq"] as Variant[]).forEach((v) => {
      const el = refFor(v);
      if (el) el.currentTime = 0;
    });
    setTime(0);
  }

  const pct = (s: number) => (duration ? `${(s / duration) * 100}%` : "0%");
  const region = drag
    ? { start: Math.min(drag.start, drag.end), end: Math.max(drag.start, drag.end) }
    : loop;

  const audioProps = {
    preload: "metadata" as const,
    crossOrigin: "anonymous" as const,
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLAudioElement>) => reportDuration(e.currentTarget),
    onDurationChange: (e: React.SyntheticEvent<HTMLAudioElement>) => reportDuration(e.currentTarget),
    onPlay: () => setPlaying(true),
    onPause: () => {
      setPlaying(false);
      setLevels({ original: 0, standard: 0, hq: 0 });
    },
    onEnded: handleEnded,
  };

  return (
    <figure
      tabIndex={0}
      onKeyDown={onKey}
      aria-label={`${sourceLabel}: original audio against both transcriptions`}
      className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
    >
      <audio ref={originalRef} src={originalSrc} {...audioProps} />
      <audio ref={standardRef} src={standardSrc} {...audioProps} />
      <audio ref={hqRef} src={hqSrc} {...audioProps} />

      <div className="flex items-center gap-3 border-b border-graphite-800 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 outline-none",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[background-color,transform] duration-150",
            "hover:bg-amber-400 active:translate-y-px active:bg-amber-600 motion-reduce:active:translate-y-0",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
          )}
        >
          {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {sourceLabel} to MIDI
            {trackLabel && <span className="font-normal text-text-subtle"> · {trackLabel}</span>}
          </p>
          <p className="truncate text-xs text-text-subtle">
            {loop ? (
              <>
                Looping {fmt(loop.start)} to {fmt(loop.end)}.{" "}
                <button type="button" onClick={() => setLoop(null)} className="text-amber-400 hover:underline">
                  Clear
                </button>
              </>
            ) : (
              "Click a lane to switch. Drag on a lane to loop a phrase."
            )}
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
          {fmt(time)} / {fmt(duration)}
        </span>
      </div>

      {cues.length > 0 && duration > 0 && (
        <div className="relative h-6 border-b border-graphite-800 bg-graphite-950/60">
          <div className="absolute inset-y-0 left-[7.5rem] right-4 sm:left-[8.5rem]">
            {cues.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => seekTo(c.at)}
                style={{ left: pct(c.at) }}
                className="absolute top-0 flex h-6 -translate-x-px items-center gap-1.5 whitespace-nowrap text-[10px] text-text-subtle hover:text-amber-400"
              >
                <span className="h-2.5 w-px bg-amber-500" />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={lanesRef} className="relative divide-y divide-graphite-800">
        {LANES.map((lane) => {
          const isActive = active === lane.id;
          const level = levels[lane.id];
          return (
            <div
              key={lane.id}
              className={cn("relative flex h-20 select-none", isActive ? "bg-amber-500/[0.04]" : "bg-transparent")}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => switchTo(lane.id)}
                className={cn(
                  "flex w-[7.5rem] shrink-0 flex-col justify-center border-r border-graphite-800 px-3 text-left outline-none sm:w-[8.5rem]",
                  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/70",
                  isActive ? "text-text-primary" : "text-text-muted hover:text-text-primary"
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isActive ? "bg-amber-500 shadow-[0_0_6px_var(--amber-500)]" : "bg-graphite-600"
                    )}
                  />
                  <span className="text-sm font-medium leading-tight">{lane.title}</span>
                </span>
                <span className="mt-0.5 pl-3.5 text-[11px] text-text-subtle">{lane.note}</span>
                <span className="mt-2 ml-3.5 h-1 w-16 overflow-hidden rounded-full bg-graphite-800" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-amber-500 transition-[width] duration-75"
                    style={{ width: `${Math.min(100, level * 130)}%` }}
                  />
                </span>
              </button>

              <div
                className={cn("relative flex-1", duration ? "cursor-crosshair" : "cursor-pointer")}
                onPointerDown={(e) => onLanePointerDown(lane.id, e)}
                onPointerMove={onLanePointerMove}
                onPointerUp={(e) => onLanePointerUp(lane.id, e)}
                onPointerCancel={() => setDrag(null)}
              >
                <canvas
                  ref={(el) => {
                    canvases.current[lane.id] = el;
                  }}
                  className="block h-full w-full"
                  aria-hidden
                />
                {!armed && lane.id === "original" && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-text-subtle">
                    Press play. The waveforms load with the audio.
                  </p>
                )}
                {region && duration > 0 && (
                  <div
                    className="pointer-events-none absolute inset-y-0 border-x border-amber-500/60 bg-amber-500/10"
                    style={{ left: pct(region.start), width: pct(region.end - region.start) }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {duration > 0 && (
          <div className="pointer-events-none absolute inset-y-0 left-[7.5rem] right-0 sm:left-[8.5rem]" aria-hidden>
            <div className="absolute top-0 h-full w-px bg-text-primary/80" style={{ left: pct(time) }} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[11px] text-text-subtle">
        <span>Same clip, same bar. Switching keeps the playhead.</span>
        <span className="hidden font-mono sm:inline">Space play · 1 / 2 / 3 switch · ← → seek · L clear loop</span>
      </div>
    </figure>
  );
}

function fmt(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}