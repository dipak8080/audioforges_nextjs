"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

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

interface ScheduledBeat {
  time: number;
  beatIndex: number;
}

interface MetronomeFormProps {
  initialBpm?: number;
}

export function MetronomeForm({ initialBpm }: MetronomeFormProps) {
  const [bpm, setBpm] = useState(() =>
    initialBpm && initialBpm >= BPM_MIN && initialBpm <= BPM_MAX ? initialBpm : 120
  );
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const currentBeatRef = useRef(0);
  const scheduledBeatsRef = useRef<ScheduledBeat[]>([]);
  const rafRef = useRef<number | null>(null);

  const bpmRef = useRef(bpm);
  const beatsPerMeasureRef = useRef(beatsPerMeasure);
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  useEffect(() => {
    beatsPerMeasureRef.current = beatsPerMeasure;
  }, [beatsPerMeasure]);

  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generates a click programmatically (a short sine burst with a fast
  // decay envelope) rather than loading an audio file - the accented
  // downbeat gets a higher pitch and slightly louder volume, matching
  // how a real metronome distinguishes beat 1.
  const playClick = useCallback((time: number, isAccent: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = isAccent ? 1400 : 1000;
    gain.gain.setValueAtTime(isAccent ? 0.35 : 0.22, time);
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

    rafRef.current = requestAnimationFrame(visualLoop);
  }, []);

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

  const toggle = () => {
    if (isPlaying) stop();
    else start();
  };

  const adjustBpm = (delta: number) => {
    setBpm((b) => Math.min(BPM_MAX, Math.max(BPM_MIN, b + delta)));
  };

  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8 space-y-8">
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => adjustBpm(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-graphite-700 text-text-muted hover:text-amber-400 hover:border-amber-500/40 transition-colors"
            aria-label="Decrease BPM"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-5xl font-mono font-bold text-text-primary tabular-nums">{bpm}</p>
            <p className="text-xs text-text-subtle mt-1">BPM</p>
          </div>
          <button
            type="button"
            onClick={() => adjustBpm(1)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-graphite-700 text-text-muted hover:text-amber-400 hover:border-amber-500/40 transition-colors"
            aria-label="Increase BPM"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <input
          type="range"
          min={BPM_MIN}
          max={BPM_MAX}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-full max-w-xs h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 cursor-pointer"
          aria-label="Tempo"
        />
        <div className="flex w-full max-w-xs justify-between text-xs text-text-subtle">
          <span>{BPM_MIN}</span>
          <span>{BPM_MAX}</span>
        </div>
      </div>

      <div className="flex justify-center gap-2">
        {Array.from({ length: beatsPerMeasure }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full transition-colors duration-75 ${
              activeBeat === i
                ? i === 0
                  ? "bg-amber-500"
                  : "bg-teal-400"
                : "bg-graphite-700"
            }`}
          />
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary text-center block">Beats per measure</label>
        <div className="flex flex-wrap justify-center gap-2">
          {BEATS_PER_MEASURE_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBeatsPerMeasure(n)}
              className={`h-10 w-10 rounded-lg border text-sm font-mono font-semibold transition-colors ${
                beatsPerMeasure === n
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={toggle}>
        {isPlaying ? <Square className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
        {isPlaying ? "Stop" : "Start"}
      </Button>
    </div>
  );
}