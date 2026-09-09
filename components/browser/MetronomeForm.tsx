"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Minus, Plus, ArrowRightCircle, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

const BPM_MIN = 30;
const BPM_MAX = 300;
const BEATS_PER_MEASURE_OPTIONS = [2, 3, 4, 5, 6, 7, 8];
const BAR_COUNT_OPTIONS = [1, 2, 3, 4];

// Look-ahead scheduler: a cheap 25ms timer schedules upcoming ticks against
// the sample-accurate AudioContext clock, so JS timer jitter never reaches
// the audio. See /guides/why-online-metronomes-drift.
const SCHEDULE_AHEAD_SECONDS = 0.1;
const SCHEDULER_INTERVAL_MS = 25;

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

// Each preset BPM sits inside the matching tempoNameFor() range, so the
// button label and the live readout always agree.
const TEMPO_PRESETS = [
  { label: "Largo", bpm: 50 },
  { label: "Adagio", bpm: 70 },
  { label: "Andante", bpm: 90 },
  { label: "Moderato", bpm: 110 },
  { label: "Allegro", bpm: 140 },
  { label: "Presto", bpm: 180 },
];

const SUBDIVISION_OPTIONS = [
  { value: 1, label: "Quarter", glyph: "\u2669" },
  { value: 2, label: "Eighths", glyph: "\u266B" },
  { value: 3, label: "Triplets", glyph: "3" },
  { value: 4, label: "Sixteenths", glyph: "\u266C" },
];

const SOUND_OPTIONS = [
  { value: "beep", label: "Beep" },
  { value: "wood", label: "Wood" },
  { value: "tick", label: "Tick" },
] as const;

type ClickSound = (typeof SOUND_OPTIONS)[number]["value"];
type TrainerMode = "hold" | "loop";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface ScheduledBeat {
  time: number;
  beatIndex: number;
  muted: boolean;
  cycleBar: number;
}

export interface MetronomeInitialSettings {
  beats?: number;
  subdivision?: number;
  mutePlayed?: number;
  muteMuted?: number;
  muteOn?: boolean;
  trainerOn?: boolean;
  trainerIncrement?: number;
  trainerBars?: number;
  trainerTarget?: number;
  trainerMode?: TrainerMode;
  sound?: ClickSound;
}

interface MetronomeFormProps {
  initialBpm?: number;
  initialSettings?: MetronomeInitialSettings;
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
/* Small shared controls                                                */
/* ------------------------------------------------------------------ */

function ChipButton({
  active,
  onClick,
  children,
  className,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        "rounded-lg border font-mono text-sm font-semibold transition-colors",
        active
          ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
          : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary",
        className
      )}
    >
      {children}
    </button>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
          : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}

function SmallNumberInput({
  value,
  min,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(clamp(Number(e.target.value) || min, min, max))}
      aria-label={ariaLabel}
      className="w-16 rounded-lg border border-graphite-700 bg-graphite-850 px-2 py-1.5 text-center font-mono text-sm font-semibold text-text-primary [appearance:textfield] focus:border-amber-500/60 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function MetronomeForm({ initialBpm, initialSettings }: MetronomeFormProps) {
  const s = initialSettings ?? {};
  const hasShareParams = Object.values(s).some((v) => v !== undefined);
  const cameFromTapTempo = Boolean(initialBpm && initialBpm >= BPM_MIN && initialBpm <= BPM_MAX) && !hasShareParams;

  const [bpm, setBpm] = useState(() =>
    initialBpm && initialBpm >= BPM_MIN && initialBpm <= BPM_MAX ? initialBpm : 120
  );
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(() => s.beats ?? 4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [accentEnabled, setAccentEnabled] = useState(true);
  const [sound, setSound] = useState<ClickSound>(() => s.sound ?? "beep");
  const [subdivision, setSubdivision] = useState(() => s.subdivision ?? 1);

  const [muteOn, setMuteOn] = useState(() => s.muteOn ?? false);
  const [playedBars, setPlayedBars] = useState(() => s.mutePlayed ?? 3);
  const [mutedBars, setMutedBars] = useState(() => s.muteMuted ?? 1);
  const [inMutedBar, setInMutedBar] = useState(false);
  const [cycleBarDisplay, setCycleBarDisplay] = useState(0);

  const [trainerOn, setTrainerOn] = useState(() => s.trainerOn ?? false);
  const [trainerIncrement, setTrainerIncrement] = useState(() => s.trainerIncrement ?? 4);
  const [trainerBars, setTrainerBars] = useState(() => s.trainerBars ?? 4);
  const [trainerTarget, setTrainerTarget] = useState(() => s.trainerTarget ?? 160);
  const [trainerMode, setTrainerMode] = useState<TrainerMode>(() => s.trainerMode ?? "hold");
  const [trainerBarsLeft, setTrainerBarsLeft] = useState<number | null>(null);
  const [trainerAtTarget, setTrainerAtTarget] = useState(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const currentSubRef = useRef(0);
  const barCounterRef = useRef(0);
  const trainerBarsElapsedRef = useRef(0);
  const trainerStartBpmRef = useRef(120);
  const scheduledBeatsRef = useRef<ScheduledBeat[]>([]);
  const rafRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const bpmRef = useRef(bpm);
  const beatsPerMeasureRef = useRef(beatsPerMeasure);
  const volumeRef = useRef(volume);
  const accentEnabledRef = useRef(accentEnabled);
  const soundRef = useRef(sound);
  const subdivisionRef = useRef(subdivision);
  const muteOnRef = useRef(muteOn);
  const playedBarsRef = useRef(playedBars);
  const mutedBarsRef = useRef(mutedBars);
  const trainerOnRef = useRef(trainerOn);
  const trainerIncrementRef = useRef(trainerIncrement);
  const trainerBarsRef = useRef(trainerBars);
  const trainerTargetRef = useRef(trainerTarget);
  const trainerModeRef = useRef(trainerMode);

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
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    subdivisionRef.current = subdivision;
  }, [subdivision]);
  useEffect(() => {
    muteOnRef.current = muteOn;
  }, [muteOn]);
  useEffect(() => {
    playedBarsRef.current = playedBars;
  }, [playedBars]);
  useEffect(() => {
    mutedBarsRef.current = mutedBars;
  }, [mutedBars]);
  useEffect(() => {
    trainerOnRef.current = trainerOn;
  }, [trainerOn]);
  useEffect(() => {
    trainerIncrementRef.current = trainerIncrement;
  }, [trainerIncrement]);
  useEffect(() => {
    trainerBarsRef.current = trainerBars;
  }, [trainerBars]);
  useEffect(() => {
    trainerTargetRef.current = trainerTarget;
  }, [trainerTarget]);
  useEffect(() => {
    trainerModeRef.current = trainerMode;
  }, [trainerMode]);

  // Every click is synthesized — no samples. Sound choice sets waveform and
  // base pitch; subdivision ticks are quieter, higher, and shorter so the
  // main beat and accented downbeat stay dominant.
  const playClick = useCallback((time: number, isAccent: boolean, isSub: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const accent = isAccent && accentEnabledRef.current && !isSub;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    let baseFreq: number;
    let decay: number;
    switch (soundRef.current) {
      case "wood":
        osc.type = "triangle";
        baseFreq = accent ? 990 : 630;
        decay = 0.035;
        break;
      case "tick":
        osc.type = "square";
        baseFreq = accent ? 2300 : 1800;
        decay = 0.02;
        break;
      default:
        osc.type = "sine";
        baseFreq = accent ? 1400 : 1000;
        decay = 0.05;
    }

    osc.frequency.value = isSub ? baseFreq * 1.7 : baseFreq;
    let peak = (accent ? 0.35 : 0.22) * volumeRef.current;
    if (soundRef.current === "tick") peak *= 0.7;
    if (isSub) {
      peak *= 0.4;
      decay *= 0.6;
    }
    gain.gain.setValueAtTime(Math.max(peak, 0.0001), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    osc.start(time);
    osc.stop(time + decay + 0.01);
  }, []);

  const scheduler = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_SECONDS) {
      const beats = beatsPerMeasureRef.current;
      const sub = subdivisionRef.current;
      const beatIndex = currentBeatRef.current;
      const subIndex = currentSubRef.current;

      const cycle = playedBarsRef.current + mutedBarsRef.current;
      const cycleBar = barCounterRef.current % cycle;
      const muted = muteOnRef.current && cycleBar >= playedBarsRef.current;

      if (!muted) {
        playClick(nextNoteTimeRef.current, beatIndex === 0 && subIndex === 0, subIndex > 0);
      }
      if (subIndex === 0) {
        scheduledBeatsRef.current.push({ time: nextNoteTimeRef.current, beatIndex, muted, cycleBar });
      }

      nextNoteTimeRef.current += 60 / bpmRef.current / sub;

      let nextSub = subIndex + 1;
      if (nextSub >= sub) {
        nextSub = 0;
        let nextBeat = beatIndex + 1;
        if (nextBeat >= beats) {
          nextBeat = 0;
          barCounterRef.current += 1;

          if (trainerOnRef.current) {
            trainerBarsElapsedRef.current += 1;
            if (trainerBarsElapsedRef.current >= trainerBarsRef.current) {
              trainerBarsElapsedRef.current = 0;
              const target = clamp(trainerTargetRef.current, BPM_MIN, BPM_MAX);
              if (bpmRef.current < target) {
                const next = Math.min(bpmRef.current + trainerIncrementRef.current, target);
                bpmRef.current = next;
                setBpm(next);
              } else if (trainerModeRef.current === "loop" && trainerStartBpmRef.current < target) {
                bpmRef.current = trainerStartBpmRef.current;
                setBpm(trainerStartBpmRef.current);
              }
            }
          }
        }
        currentBeatRef.current = nextBeat;
      }
      currentSubRef.current = nextSub;
    }
  }, [playClick]);

  /**
   * The rAF loop reschedules itself via a ref rather than by naming itself —
   * a self-referencing initializer defeats the React Compiler. Declared
   * BEFORE the callback, assigned in an effect.
   */
  const visualLoopRef = useRef<() => void>(() => {});

  // Visuals are driven off the SAME scheduled times as the audio, so what
  // you see stays locked to what you hear — including during silent bars,
  // where the dots keep running for self-checking.
  const visualLoop = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const now = ctx.currentTime;
    while (scheduledBeatsRef.current.length > 0 && scheduledBeatsRef.current[0].time < now) {
      const beat = scheduledBeatsRef.current.shift();
      if (beat) {
        setActiveBeat(beat.beatIndex);
        setInMutedBar(beat.muted);
        setCycleBarDisplay(beat.cycleBar);
        if (beat.beatIndex === 0 && trainerOnRef.current) {
          const atTarget = bpmRef.current >= clamp(trainerTargetRef.current, BPM_MIN, BPM_MAX);
          setTrainerAtTarget(atTarget);
          setTrainerBarsLeft(atTarget ? null : trainerBarsRef.current - trainerBarsElapsedRef.current);
        }
      }
    }

    rafRef.current = requestAnimationFrame(() => visualLoopRef.current());
  }, []);

  useEffect(() => {
    visualLoopRef.current = visualLoop;
  }, [visualLoop]);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Best-effort; some browsers/battery states deny it.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const start = useCallback(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;

    currentBeatRef.current = 0;
    currentSubRef.current = 0;
    barCounterRef.current = 0;
    trainerBarsElapsedRef.current = 0;
    trainerStartBpmRef.current = bpmRef.current;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    scheduledBeatsRef.current = [];

    schedulerTimerRef.current = setInterval(scheduler, SCHEDULER_INTERVAL_MS);
    rafRef.current = requestAnimationFrame(visualLoop);

    setElapsedSeconds(0);
    sessionTimerRef.current = setInterval(() => setElapsedSeconds((v) => v + 1), 1000);

    setTrainerAtTarget(false);
    setTrainerBarsLeft(trainerOnRef.current ? trainerBarsRef.current : null);
    requestWakeLock();
    setIsPlaying(true);
  }, [scheduler, visualLoop, requestWakeLock]);

  const stop = useCallback(() => {
    if (schedulerTimerRef.current) {
      clearInterval(schedulerTimerRef.current);
      schedulerTimerRef.current = null;
    }
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    scheduledBeatsRef.current = [];
    releaseWakeLock();
    setIsPlaying(false);
    setActiveBeat(null);
    setInMutedBar(false);
    setTrainerBarsLeft(null);
  }, [releaseWakeLock]);

  useEffect(() => () => stop(), [stop]);

  // Browsers drop the wake lock when the tab is hidden; reacquire on return.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && isPlaying && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [isPlaying, requestWakeLock]);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  const adjustBpm = (delta: number) => {
    setBpm((b) => clamp(b + delta, BPM_MIN, BPM_MAX));
  };

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

  const copyShareLink = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("bpm", String(bpm));
    params.set("beats", String(beatsPerMeasure));
    if (subdivision !== 1) params.set("sub", String(subdivision));
    if (muteOn) {
      params.set("mp", String(playedBars));
      params.set("mm", String(mutedBars));
    }
    if (trainerOn) {
      params.set("ti", String(trainerIncrement));
      params.set("tb", String(trainerBars));
      params.set("tt", String(trainerTarget));
      params.set("tm", trainerMode);
    }
    if (sound !== "beep") params.set("snd", sound);

    const url = `${window.location.origin}/metronome?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy this practice link:", url);
    }
  }, [bpm, beatsPerMeasure, subdivision, muteOn, playedBars, mutedBars, trainerOn, trainerIncrement, trainerBars, trainerTarget, trainerMode, sound]);

  const muteCycle = playedBars + mutedBars;

  return (
    <div className="space-y-8 rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8">
      {cameFromTapTempo && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-400/25 bg-teal-400/[0.07] px-3.5 py-2 text-xs text-teal-400">
          <ArrowRightCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Loaded {initialBpm} BPM from the tap tempo tool
        </div>
      )}
      {hasShareParams && (
        <div className="flex items-center gap-2 rounded-lg border border-teal-400/25 bg-teal-400/[0.07] px-3.5 py-2 text-xs text-teal-400">
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Practice settings loaded from a shared link
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
          {TEMPO_PRESETS.map((preset) => (
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

      {/* Dots keep pulsing (dimmed) during silent bars so the user can
          check their internal tempo against the visual. */}
      <div className="space-y-2">
        <div
          className="flex justify-center gap-2.5"
          role="status"
          aria-label={`Beat ${(activeBeat ?? 0) + 1} of ${beatsPerMeasure}${inMutedBar ? ", silent bar" : ""}`}
        >
          {Array.from({ length: beatsPerMeasure }).map((_, i) => {
            const active = activeBeat === i;
            const isDownbeat = i === 0;
            return (
              <span
                key={i}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs transition-all duration-75",
                  active
                    ? inMutedBar
                      ? "scale-125 border-amber-500/40 bg-graphite-700 text-text-muted"
                      : cn("scale-125 border-transparent", isDownbeat ? "bg-amber-500 text-graphite-950" : "bg-teal-400 text-graphite-950")
                    : "border-graphite-700 bg-graphite-850 text-text-subtle"
                )}
              >
                {i + 1}
              </span>
            );
          })}
        </div>

        {isPlaying && (muteOn || trainerOn) && (
          <p className="text-center font-mono text-[11px] text-text-subtle" aria-live="polite">
            {muteOn && (
              <span className={cn(inMutedBar && "text-amber-400")}>
                Bar {cycleBarDisplay + 1}/{muteCycle}
                {inMutedBar ? " · silent" : ""}
              </span>
            )}
            {muteOn && trainerOn && <span> · </span>}
            {trainerOn &&
              (trainerAtTarget ? (
                <span className="text-teal-400">At target{trainerMode === "loop" ? " · looping back" : ""}</span>
              ) : trainerBarsLeft !== null ? (
                <span>
                  +{trainerIncrement} BPM in {trainerBarsLeft} {trainerBarsLeft === 1 ? "bar" : "bars"}
                </span>
              ) : null)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-center text-sm font-medium text-text-primary">Beats per measure</label>
        <div className="flex flex-wrap justify-center gap-2">
          {BEATS_PER_MEASURE_OPTIONS.map((n) => (
            <ChipButton key={n} active={beatsPerMeasure === n} onClick={() => setBeatsPerMeasure(n)} className="h-10 w-10">
              {n}
            </ChipButton>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-center text-sm font-medium text-text-primary">Subdivision</label>
        <div className="flex flex-wrap justify-center gap-2">
          {SUBDIVISION_OPTIONS.map((opt) => (
            <ChipButton
              key={opt.value}
              active={subdivision === opt.value}
              onClick={() => setSubdivision(opt.value)}
              className="px-3 py-2 text-xs"
              ariaLabel={opt.label}
            >
              <span aria-hidden className="mr-1.5">
                {opt.glyph}
              </span>
              {opt.label}
            </ChipButton>
          ))}
        </div>
      </div>

      {/* Practice tools — off by default, controls expand inline when on. */}
      <div className="space-y-3 rounded-xl border border-graphite-800 bg-graphite-850/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">Silent bars</span>
          <ToggleChip active={muteOn} onClick={() => setMuteOn((v) => !v)}>
            {muteOn ? "On" : "Off"}
          </ToggleChip>
        </div>
        {muteOn && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Play</span>
              <div className="flex gap-1.5">
                {BAR_COUNT_OPTIONS.map((n) => (
                  <ChipButton
                    key={n}
                    active={playedBars === n}
                    onClick={() => setPlayedBars(n)}
                    className="h-8 w-8 text-xs"
                    ariaLabel={`Play ${n} bars`}
                  >
                    {n}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Mute</span>
              <div className="flex gap-1.5">
                {BAR_COUNT_OPTIONS.map((n) => (
                  <ChipButton
                    key={n}
                    active={mutedBars === n}
                    onClick={() => setMutedBars(n)}
                    className="h-8 w-8 text-xs"
                    ariaLabel={`Mute ${n} bars`}
                  >
                    {n}
                  </ChipButton>
                ))}
              </div>
            </div>
            <p className="w-full text-[11px] text-text-subtle">
              Plays {playedBars} {playedBars === 1 ? "bar" : "bars"}, mutes {mutedBars} — the dots keep running so you can check your internal
              tempo.
            </p>
          </div>
        )}

        <div className="border-t border-graphite-800" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary">Speed trainer</span>
          <ToggleChip active={trainerOn} onClick={() => setTrainerOn((v) => !v)}>
            {trainerOn ? "On" : "Off"}
          </ToggleChip>
        </div>
        {trainerOn && (
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            <div className="space-y-1">
              <span className="block text-xs text-text-muted">+BPM per step</span>
              <SmallNumberInput value={trainerIncrement} min={1} max={20} onChange={setTrainerIncrement} ariaLabel="BPM increment per step" />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-text-muted">Every N bars</span>
              <SmallNumberInput value={trainerBars} min={1} max={8} onChange={setTrainerBars} ariaLabel="Bars per step" />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-text-muted">Target BPM</span>
              <SmallNumberInput value={trainerTarget} min={BPM_MIN} max={BPM_MAX} onChange={setTrainerTarget} ariaLabel="Target BPM" />
            </div>
            <div className="space-y-1">
              <span className="block text-xs text-text-muted">At target</span>
              <div className="flex gap-1.5">
                <ChipButton active={trainerMode === "hold"} onClick={() => setTrainerMode("hold")} className="px-2.5 py-1.5 text-xs">
                  Hold
                </ChipButton>
                <ChipButton active={trainerMode === "loop"} onClick={() => setTrainerMode("loop")} className="px-2.5 py-1.5 text-xs">
                  Loop
                </ChipButton>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
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
        <div className="flex gap-1.5">
          {SOUND_OPTIONS.map((opt) => (
            <ChipButton key={opt.value} active={sound === opt.value} onClick={() => setSound(opt.value)} className="px-2.5 py-1.5 text-xs">
              {opt.label}
            </ChipButton>
          ))}
        </div>
        <ToggleChip active={accentEnabled} onClick={() => setAccentEnabled((v) => !v)}>
          Accent {accentEnabled ? "on" : "off"}
        </ToggleChip>
      </div>

      <div className="space-y-3">
        <Button variant="primary" size="lg" className="w-full" onClick={toggle}>
          {isPlaying ? <Square className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          {isPlaying ? "Stop" : "Start"}
        </Button>

        <div className="flex items-center justify-between text-[11px] text-text-subtle">
          <span className="font-mono">{isPlaying ? `Practiced ${formatElapsed(elapsedSeconds)}` : "\u00A0"}</span>
          <button
            type="button"
            onClick={copyShareLink}
            className="flex items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-1.5 font-medium text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          >
            {linkCopied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Link2 className="h-3.5 w-3.5" />}
            {linkCopied ? "Copied" : "Copy practice link"}
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-text-subtle">Space to start/stop · ↑/↓ to adjust tempo (Shift for ±5)</p>
    </div>
  );
}