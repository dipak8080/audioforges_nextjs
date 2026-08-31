"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Minus, Plus, ArrowRightCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

const BPM_MIN = 30;
const BPM_MAX = 300;
const BEATS_PER_MEASURE_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

// Standard "look-ahead" scheduler pattern for Web Audio timing. A plain
// setInterval/setTimeout loop drifts over time because JS timers aren't
// sample-accurate - instead, a cheap timer runs frequently (every 25ms)
// and, each time it fires, schedules any beats that fall within the next
// SCHEDULE_AHEAD_SECONDS into the ACTUAL AudioContext clock (which IS
// sample-accurate). The audio itself is scheduled ahead of when it's
// needed; only the decision of "is it time to schedule the next batch"
// uses a regular (imprecise) timer, which is fine since it only affects
// when scheduling happens, not when playback happens.
const SCHEDULE_AHEAD_SECONDS = 0.1;
const SCHEDULER_INTERVAL_MS = 25;

// Classical tempo markings — turns a bare number into the vocabulary
// musicians actually think in ("that's an Allegro") the same way the
// pitch shifter maps semitones onto piano keys and interval names.
const TEMPO_MARKS: { max: number; name: string }[] = [
  { max: 45, name: "Grave" },
  { max: 60, name: "Largo" },
  { max: 66, name: "Larghetto" },
  { max: 76, name: "Adagio" },
  { max: 108, name: "Andante" },
  { max: 120, name: "Moderato" },
  { max: 156, name: "Allegro" },
  { max: 176, name: "Vivace" },
  { max: 200, name: "Presto" },
  { max: BPM_MAX, name: "Prestissimo" },
];

function tempoNameFor(bpm: number): string {
  return TEMPO_MARKS.find((m) => bpm <= m.max)?.name ?? "Prestissimo";
}

const GENRE_PRESETS = [
  { label: "Ballad", bpm: 70 },
  { label: "Hip-Hop", bpm: 90 },
  { label: "Pop", bpm: 100 },
  { label: "House", bpm: 128 },
  { label: "Techno", bpm: 140 },
  { label: "D&B", bpm: 174 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface ScheduledBeat {
  time: number;
  beatIndex: number;
}

interface MetronomeFormProps {
  initialBpm?: number;
}

/* ------------------------------------------------------------------ */
/* BPM meter — draggable, keyboard-operable, labeled with tempo name    */
/* ------------------------------------------------------------------ */

function BpmMeter({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  const percentFor = (v: number) => clamp(((v - BPM_MIN) / (BPM_MAX - BPM_MIN)) * 100, 0, 100);

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      onChange(Math.round(clamp(BPM_MIN + fraction * (BPM_MAX - BPM_MIN), BPM_MIN, BPM_MAX)));
    },
    [onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, setFromClientX]);

  const showBubble = dragging || hovering;

  return (
    <div className="space-y-1 pt-6">
      <div
        ref={trackRef}
        className={cn(
          "relative h-2.5 rounded-full bg-graphite-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]",
          !disabled && "cursor-pointer"
        )}
        onPointerDown={(e) => {
          if (disabled) return;
          setDragging(true);
          setFromClientX(e.clientX);
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-amber-500/50" style={{ width: `${percentFor(value)}%` }} />

        {showBubble && (
          <div
            className="pointer-events-none absolute -top-9 -translate-x-1/2 whitespace-nowrap rounded-md border border-graphite-700 bg-graphite-950 px-2 py-1 text-center shadow-lg"
            style={{ left: `${clamp(percentFor(value), 8, 92)}%` }}
          >
            <span className="block font-mono text-xs font-semibold text-text-primary">{value} BPM</span>
            <span className="block text-[9px] uppercase tracking-wide text-text-subtle">{tempoNameFor(value)}</span>
          </div>
        )}

        <div
          role="slider"
          aria-label="Tempo"
          aria-valuemin={BPM_MIN}
          aria-valuemax={BPM_MAX}
          aria-valuenow={value}
          aria-valuetext={`${value} BPM, ${tempoNameFor(value)}`}
          tabIndex={disabled ? -1 : 0}
          onFocus={() => setHovering(true)}
          onBlur={() => setHovering(false)}
          className={cn(
            "absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-500 bg-graphite-900 shadow-md transition-transform focus:outline-none",
            !disabled && "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
            dragging && "scale-110"
          )}
          style={{ left: `${percentFor(value)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-text-subtle">
        <span>{BPM_MIN}</span>
        <span className="font-medium text-text-muted">{tempoNameFor(value)}</span>
        <span>{BPM_MAX}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function MetronomeForm({ initialBpm }: MetronomeFormProps) {
  const cameFromTapTempo = Boolean(initialBpm && initialBpm >= BPM_MIN && initialBpm <= BPM_MAX);

  const [bpm, setBpm] = useState(() =>
    initialBpm && initialBpm >= BPM_MIN && initialBpm <= BPM_MAX ? initialBpm : 120
  );
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [accentEnabled, setAccentEnabled] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const scheduledBeatsRef = useRef<ScheduledBeat[]>([]);
  const rafRef = useRef<number | null>(null);

  const bpmRef = useRef(bpm);
  const beatsPerMeasureRef = useRef(beatsPerMeasure);
  const volumeRef = useRef(volume);
  const accentEnabledRef = useRef(accentEnabled);
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsPerMeasureRef.current = beatsPerMeasure;
  }, [beatsPerMeasure]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    accentEnabledRef.current = accentEnabled;
  }, [accentEnabled]);

  // Generates a click programmatically (a short sine burst with a fast
  // decay envelope) rather than loading an audio file - the accented
  // downbeat gets a higher pitch and slightly louder volume, matching
  // how a real metronome distinguishes beat 1.
  const playClick = useCallback((time: number, isAccent: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const accent = isAccent && accentEnabledRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = accent ? 1400 : 1000;
    const peak = (accent ? 0.35 : 0.22) * volumeRef.current;
    gain.gain.setValueAtTime(Math.max(peak, 0.0001), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.06);
  }, []);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
      const beatIndex = currentBeatRef.current;
      playClick(nextNoteTimeRef.current, beatIndex === 0);
      scheduledBeatsRef.current.push({ time: nextNoteTimeRef.current, beatIndex });

      const secondsPerBeat = 60 / bpmRef.current;
      nextNoteTimeRef.current += secondsPerBeat;
      currentBeatRef.current = (beatIndex + 1) % beatsPerMeasureRef.current;
    }
  }, [playClick]);

  /**
   * The rAF loop reschedules itself, which it can't do by naming itself: a
   * value referenced inside its own initializer is something the React
   * Compiler can't reason about, and it responded by skipping optimisation of
   * this entire component. One indirection through a ref — declared BEFORE the
   * callback, assigned in an effect rather than during render — removes the
   * self-reference without changing the timing.
   */
  const visualLoopRef = useRef<() => void>(() => {});

  // Drives the visual beat indicator off the SAME scheduled times used
  // for audio, rather than a separate timer - keeps the flash visually
  // locked to what's actually audible instead of drifting from it.
  const visualLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    while (scheduledBeatsRef.current.length > 0 && scheduledBeatsRef.current[0].time < now) {
      const beat = scheduledBeatsRef.current.shift();
      if (beat) setActiveBeat(beat.beatIndex);
    }

    rafRef.current = requestAnimationFrame(() => visualLoopRef.current());
  }, []);

  useEffect(() => {
    visualLoopRef.current = visualLoop;
  }, [visualLoop]);

  const start = useCallback(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;

    currentBeatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    scheduledBeatsRef.current = [];

    schedulerTimerRef.current = setInterval(scheduler, SCHEDULER_INTERVAL_MS);
    rafRef.current = requestAnimationFrame(visualLoop);
    setIsPlaying(true);
  }, [scheduler, visualLoop]);

  const stop = useCallback(() => {
    if (schedulerTimerRef.current) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    scheduledBeatsRef.current = [];
    setIsPlaying(false);
    setActiveBeat(null);
  }, []);

  // Declared after `stop` so it isn't reaching a value from further down the
  // file. `stop` is useCallback([]) and therefore stable, so this still runs
  // its cleanup only on unmount.
  useEffect(() => () => stop(), [stop]);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  const adjustBpm = (delta: number) => {
    setBpm((b) => clamp(b + delta, BPM_MIN, BPM_MAX));
  };

  // Space to start/stop, arrow keys to nudge tempo (Shift for ±5) —
  // skipped while focus is inside a text/number input so this doesn't
  // steal keystrokes from the BPM field below.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        adjustBpm(e.shiftKey ? 5 : 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        adjustBpm(e.shiftKey ? -5 : -1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <div className="space-y-8 rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8">
      {cameFromTapTempo && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-400/25 bg-teal-400/[0.07] px-3.5 py-2 text-xs text-teal-400">
          <ArrowRightCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Loaded {initialBpm} BPM from the tap tempo tool
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => adjustBpm(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-graphite-700 text-text-muted transition-colors hover:border-amber-500/40 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            aria-label="Decrease BPM"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="text-center">
            <input
              type="number"
              min={BPM_MIN}
              max={BPM_MAX}
              value={bpm}
              onChange={(e) => setBpm(clamp(Number(e.target.value) || BPM_MIN, BPM_MIN, BPM_MAX))}
              className="w-28 bg-transparent text-center font-mono text-5xl font-bold tabular-nums text-text-primary [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label="BPM, editable"
            />
            <p className="mt-1 text-xs text-text-subtle">BPM · {tempoNameFor(bpm)}</p>
          </div>
          <button
            type="button"
            onClick={() => adjustBpm(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-graphite-700 text-text-muted transition-colors hover:border-amber-500/40 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            aria-label="Increase BPM"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="w-full max-w-xs">
          <BpmMeter value={bpm} disabled={false} onChange={setBpm} />
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
          {GENRE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setBpm(preset.bpm)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                bpm === preset.bpm
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
              )}
            >
              {preset.label} <span className="font-mono text-text-subtle">{preset.bpm}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Beat indicator — bigger, numbered, with a real pulse instead of
          a flat color swap. */}
      <div className="flex justify-center gap-2.5" role="status" aria-label={`Beat ${(activeBeat ?? 0) + 1} of ${beatsPerMeasure}`}>
        {Array.from({ length: beatsPerMeasure }).map((_, i) => {
          const active = activeBeat === i;
          const isDownbeat = i === 0;
          return (
            <span
              key={i}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs transition-all duration-75",
                active
                  ? cn("scale-125 border-transparent", isDownbeat ? "bg-amber-500 text-graphite-950" : "bg-teal-400 text-graphite-950")
                  : "border-graphite-700 bg-graphite-850 text-text-subtle"
              )}
            >
              {i + 1}
            </span>
          );
        })}
      </div>

      <div className="space-y-2">
        <label className="block text-center text-sm font-medium text-text-primary">Beats per measure</label>
        <div className="flex flex-wrap justify-center gap-2">
          {BEATS_PER_MEASURE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBeatsPerMeasure(n)}
              className={cn(
                "h-10 w-10 rounded-lg border text-sm font-mono font-semibold transition-colors",
                beatsPerMeasure === n
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-1 items-center gap-2">
          <label htmlFor="metronome-volume" className="shrink-0 text-xs text-text-muted">
            Volume
          </label>
          <input
            id="metronome-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-graphite-700 accent-amber-500"
          />
        </div>
        <button
          type="button"
          onClick={() => setAccentEnabled((v) => !v)}
          className={cn(
            "shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
            accentEnabled
              ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
              : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
          )}
        >
          Accent {accentEnabled ? "on" : "off"}
        </button>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={toggle}>
        {isPlaying ? <Square className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
        {isPlaying ? "Stop" : "Start"}
      </Button>

      <p className="text-center text-[11px] text-text-subtle">
        Space to start/stop · ↑/↓ to adjust tempo (Shift for ±5)
      </p>
    </div>
  );
}