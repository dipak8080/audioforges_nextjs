"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  HERO_PEAKS_BASS,
  HERO_PEAKS_DRUMS,
  HERO_PEAKS_OTHER,
  HERO_PEAKS_VOCALS,
} from "@/lib/data/hero-stem-peaks";

type StemKey = "vocals" | "drums" | "bass" | "other";

const LANES: { key: StemKey; name: string; peaks: number[]; color: string; src: string }[] = [
  { key: "vocals", name: "Vocals", peaks: HERO_PEAKS_VOCALS, color: "#e8a23d", src: "/audio/stems/stems-vocals-studio.mp3" },
  { key: "drums", name: "Drums", peaks: HERO_PEAKS_DRUMS, color: "#e0705c", src: "/audio/stems/stems-drums-studio.mp3" },
  { key: "bass", name: "Bass", peaks: HERO_PEAKS_BASS, color: "#4dd8b8", src: "/audio/stems/stems-bass-studio.mp3" },
  { key: "other", name: "Other", peaks: HERO_PEAKS_OTHER, color: "#cfcabd", src: "/audio/stems/stems-other-studio.mp3" },
];

const PRESETS: { name: string; muted: StemKey[] }[] = [
  { name: "Original", muted: [] },
  { name: "Karaoke", muted: ["vocals"] },
  { name: "Acapella", muted: ["drums", "bass", "other"] },
];

const RULER = ["0:00", "0:10", "0:20", "0:30", "0:40"];

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

interface Engine {
  ctx: AudioContext;
  buffers: Record<StemKey, AudioBuffer>;
  gains: Record<StemKey, GainNode>;
  sources: AudioBufferSourceNode[];
  startedAt: number;
  duration: number;
}

export function HeroForgePanel() {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [muted, setMuted] = useState<Set<StemKey>>(new Set());
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(50);

  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef(0);

  const stopTick = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  function tick() {
    const e = engineRef.current;
    if (!e) return;
    setPosition((e.ctx.currentTime - e.startedAt) % e.duration);
    rafRef.current = requestAnimationFrame(tick);
  }

  const load = async (initialMuted: Set<StemKey>): Promise<Engine> => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const decoded = await Promise.all(
      LANES.map(async (lane) => {
        const res = await fetch(lane.src);
        if (!res.ok) throw new Error(lane.src);
        return [lane.key, await ctx.decodeAudioData(await res.arrayBuffer())] as const;
      })
    );
    const buffers = Object.fromEntries(decoded) as Record<StemKey, AudioBuffer>;
    const gains = {} as Record<StemKey, GainNode>;
    LANES.forEach((lane) => {
      const g = ctx.createGain();
      g.gain.value = initialMuted.has(lane.key) ? 0 : 1;
      g.connect(ctx.destination);
      gains[lane.key] = g;
    });
    const dur = Math.min(...LANES.map((l) => buffers[l.key].duration));
    const e: Engine = { ctx, buffers, gains, sources: [], startedAt: 0, duration: dur };
    startSources(e, pendingOffsetRef.current * dur);
    return e;
  };

  // Buffer sources cannot seek, so a seek means fresh sources at the offset.
  const startSources = (e: Engine, offset: number) => {
    e.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    });
    const when = e.ctx.currentTime + 0.05;
    e.sources = LANES.map((lane) => {
      const src = e.ctx.createBufferSource();
      src.buffer = e.buffers[lane.key];
      src.loop = true;
      src.loopEnd = e.duration;
      src.connect(e.gains[lane.key]);
      src.start(when, offset);
      return src;
    });
    e.startedAt = when - offset;
  };

  const seek = (fraction: number) => {
    const f = Math.min(0.999, Math.max(0, fraction));
    pendingOffsetRef.current = f;
    setPosition(f * duration);
    const e = engineRef.current;
    if (e) startSources(e, f * e.duration);
  };

  const seekFromPointer = (ev: React.MouseEvent<HTMLElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    seek((ev.clientX - rect.left) / rect.width);
  };

  // Pause and resume suspend the whole context, so the four stems stay
  // sample-locked without restarting sources.
  const play = async () => {
    if (state === "loading") return;
    try {
      if (state === "playing") {
        await engineRef.current?.ctx.suspend();
        stopTick();
        setState("paused");
        return;
      }
      let e = engineRef.current;
      if (!e) {
        setState("loading");
        e = await load(muted);
        engineRef.current = e;
        setDuration(e.duration);
      }
      if (e.ctx.state !== "running") await e.ctx.resume();
      setState("playing");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error("hero mixer failed", err);
      setState("error");
    }
  };

  const applyMuted = (next: Set<StemKey>) => {
    setMuted(next);
    const e = engineRef.current;
    if (!e) return;
    LANES.forEach((lane) => {
      const g = e.gains[lane.key].gain;
      g.cancelScheduledValues(e.ctx.currentTime);
      g.setTargetAtTime(next.has(lane.key) ? 0 : 1, e.ctx.currentTime, 0.02);
    });
  };

  const toggleLane = (key: StemKey) => {
    const next = new Set(muted);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    applyMuted(next);
  };

  const activePreset = PRESETS.find(
    (p) => p.muted.length === muted.size && p.muted.every((k) => muted.has(k))
  )?.name;

  useEffect(
    () => () => {
      stopTick();
      const e = engineRef.current;
      if (e) {
        e.sources.forEach((s) => {
          try {
            s.stop();
          } catch {
            // already stopped
          }
        });
        void e.ctx.close();
      }
    },
    []
  );

  const playing = state === "playing";
  const progress = duration > 0 ? position / duration : 0;

  return (
    <div className="relative">
      <style>{`@keyframes af-eq{0%,100%{transform:scaleY(.3);opacity:.6}50%{transform:scaleY(1);opacity:1}}`}</style>
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 hidden rounded-[2rem] bg-amber-500/[0.06] blur-3xl lg:block"
      />

      <div
        tabIndex={0}
        onKeyDown={(ev) => {
          if (ev.target !== ev.currentTarget) return;
          if (ev.key === " " || ev.key === "k") {
            ev.preventDefault();
            void play();
          }
        }}
        aria-label="Forge Mixer demo. Press space to play or pause."
        className="surface grain overflow-hidden rounded-xl border border-graphite-800 shadow-2xl shadow-graphite-950/60 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void play()}
              disabled={state === "error"}
              aria-label={playing ? "Pause" : "Play the demo"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-amber-400 active:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900 disabled:opacity-50"
            >
              {state === "loading" ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-graphite-950/30 border-t-graphite-950" />
              ) : playing ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden>
                  <path d="M2.5 2h2.5v8H2.5zM7 2h2.5v8H7z" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 12" className="ml-0.5 h-3 w-3 fill-current" aria-hidden>
                  <path d="M3 2l7 4-7 4z" />
                </svg>
              )}
            </button>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-subtle">
                Forge Mixer
              </p>
              <p className="mt-0.5 font-mono tabular-nums leading-none">
                <span className={cn("text-lg", playing ? "text-amber-400" : "text-text-primary")}>
                  {fmt(position)}
                </span>
                <span className="ml-1.5 text-[11px] text-text-subtle">/ {fmt(duration)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-4 items-end gap-[3px]" aria-hidden>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-full w-[3px] origin-bottom rounded-full will-change-transform",
                    playing ? "bg-amber-500" : "bg-graphite-600"
                  )}
                  style={playing ? { animation: `af-eq 0.9s ease-in-out ${i * 0.12}s infinite` } : { transform: "scaleY(.3)" }}
                />
              ))}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-medium text-graphite-950">
              Studio Quality
            </span>
          </div>
        </div>

        <div className="relative mx-3 overflow-hidden rounded-lg bg-graphite-950/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
          <div className="relative h-6 border-b border-graphite-800 pl-24">
            <div className="relative h-full">
              {RULER.map((t, i) => (
                <span
                  key={t}
                  className="absolute bottom-0 flex h-full items-end border-l border-white/10 pb-1 pl-1 font-mono text-[9px] text-text-subtle"
                  style={{ left: `${(i / 5) * 100}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {LANES.map((lane, index) => {
            const off = muted.has(lane.key);
            return (
              <div
                key={lane.name}
                className={cn("flex items-stretch", index > 0 && "border-t border-graphite-800")}
              >
                <button
                  type="button"
                  onClick={() => toggleLane(lane.key)}
                  aria-pressed={!off}
                  aria-label={`${off ? "Unmute" : "Mute"} ${lane.name}`}
                  className="flex w-24 shrink-0 items-center gap-1.5 border-r border-graphite-800 px-3 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm transition-opacity"
                    style={{ backgroundColor: lane.color, opacity: off ? 0.25 : 1 }}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs font-medium transition-colors",
                      off ? "text-text-subtle line-through" : "text-text-primary"
                    )}
                  >
                    {lane.name}
                  </span>
                </button>
                <div className="relative h-12 flex-1">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.06]" />
                  <div
                    className="absolute inset-0 flex items-center gap-px px-1 transition-opacity"
                    style={{ opacity: off ? 0.22 : 1 }}
                  >
                    {lane.peaks.map((p, i) => (
                      <span
                        key={i}
                        className="w-full rounded-[0.5px]"
                        style={{ height: `${Math.max(3, p * 86)}%`, backgroundColor: lane.color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={seekFromPointer}
            aria-label="Seek"
            className="absolute inset-y-0 left-24 right-0 cursor-pointer bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60"
          />

          <div className="pointer-events-none absolute inset-y-0 left-24 right-0 overflow-hidden">
            {RULER.map((t, i) => (
              <span
                key={t}
                className="absolute inset-y-0 w-px bg-white/[0.04]"
                style={{ left: `${(i / 5) * 100}%` }}
              />
            ))}
            <span
              className="absolute inset-y-0 left-0 bg-graphite-950/65"
              style={{ width: `${progress * 100}%` }}
            />
            <span
              className={cn(
                "absolute inset-y-0 w-px",
                playing ? "bg-amber-400 shadow-[0_0_10px_rgba(232,162,61,0.7)]" : "bg-white/20"
              )}
              style={{ left: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex rounded-full border border-graphite-700 bg-graphite-950/60 p-0.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyMuted(new Set(p.muted))}
                aria-pressed={activePreset === p.name}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/60",
                  activePreset === p.name ? "bg-graphite-700 text-text-primary" : "text-text-muted hover:text-text-primary"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
          <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
            {state === "error" ? "Demo unavailable" : "H4RRIS · What Would It Mean"}
          </span>
        </div>
      </div>
    </div>
  );
}