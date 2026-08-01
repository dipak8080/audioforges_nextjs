"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, Music2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

// If the gap since the last tap exceeds this, treat it as a fresh
// tapping session rather than folding a stale, unrelated tap into the
// running average - otherwise pausing for a few seconds mid-session
// would corrupt the BPM estimate with a huge outlier interval.
const MAX_GAP_MS = 2000;

// Only the most recent N taps are averaged, not the entire session's
// history. A rolling window keeps the estimate responsive to a tempo
// that's drifting (someone gradually speeding up) rather than having
// early taps from minutes ago permanently drag the average.
const TAP_WINDOW = 8;

const MIN_TAPS_FOR_ESTIMATE = 2;
// Below this coefficient of variation, taps are consistent enough to
// trust; above it, something's off (rushing, dragging, missed taps).
const CONSISTENT_CV_THRESHOLD = 0.06;

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function tempoAlternatives(bpm: number): number[] {
  const out: number[] = [];
  if (bpm / 2 >= 40) out.push(Math.round(bpm / 2));
  if (bpm * 2 <= 300) out.push(bpm * 2);
  return out;
}

export function BpmTapperForm() {
  const [tapCount, setTapCount] = useState(0);
  const [bpm, setBpm] = useState<number | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isSteady, setIsSteady] = useState(true);
  const [beatPhase, setBeatPhase] = useState(false); // drives the ambient metronome dot

  const timestampsRef = useRef<number[]>([]);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metronomeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const vibrate = (ms: number) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // Some browsers restrict this outside a user gesture context —
        // tapping the button IS a gesture, but fail silently regardless.
      }
    }
  };

  const handleTap = useCallback(() => {
    const now = performance.now();
    const timestamps = timestampsRef.current;
    const last = timestamps[timestamps.length - 1];
    const isFreshSession = last === undefined || now - last > MAX_GAP_MS;

    if (isFreshSession) {
      // Long pause since the last tap - start a fresh session rather
      // than mixing this tap's huge gap into the running average. The
      // old BPM estimate belongs to that finished session, not this
      // new one, so it's cleared here rather than left stale on screen.
      timestampsRef.current = [now];
      setBpm(null);
      setIsSteady(true);
    } else {
      timestampsRef.current = [...timestamps, now].slice(-TAP_WINDOW);
    }

    const current = timestampsRef.current;
    setTapCount(current.length);

    if (current.length >= MIN_TAPS_FOR_ESTIMATE) {
      const intervals: number[] = [];
      for (let i = 1; i < current.length; i++) intervals.push(current[i] - current[i - 1]);
      const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(Math.round(60000 / avgIntervalMs));

      if (intervals.length >= 3) {
        const cv = stdDev(intervals) / avgIntervalMs;
        setIsSteady(cv <= CONSISTENT_CV_THRESHOLD);
      }
    }

    setIsPulsing(true);
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = setTimeout(() => setIsPulsing(false), 120);

    vibrate(12);
  }, []);

  // Ambient metronome dot — pulses on its own at the current BPM
  // estimate, resynced to the moment of the last real tap. This turns
  // the number into something you can visually check against the beat
  // instead of trusting blindly, and it's the main thing this tool was
  // missing: continuous feedback, not just a static readout.
  useEffect(() => {
    if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
    if (bpm === null) return;

    const intervalMs = 60000 / bpm;
    metronomeIntervalRef.current = setInterval(() => {
      setBeatPhase((p) => !p);
    }, intervalMs / 2); // toggle twice per beat for a clean on/off pulse

    return () => {
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
    };
  }, [bpm]);

  const handleReset = () => {
    timestampsRef.current = [];
    setTapCount(0);
    setBpm(null);
    setIsSteady(true);
    if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === "Space" || e.key === "Enter") {
      e.preventDefault();
      handleTap();
    }
  };

  const alternatives = bpm !== null ? tempoAlternatives(bpm) : [];

  return (
    <div className="space-y-6 rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-3">
          {/* Ambient beat dot — pulses continuously once a BPM is known */}
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-all duration-100",
              bpm !== null ? (beatPhase ? "scale-125 bg-amber-400" : "scale-90 bg-amber-500/40") : "bg-graphite-700"
            )}
            aria-hidden
          />
          <p
            className={cn(
              "font-mono text-6xl font-bold tabular-nums transition-colors",
              bpm !== null ? "text-amber-400" : "text-graphite-600"
            )}
            aria-live="polite"
          >
            {bpm ?? "—"}
          </p>
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-all duration-100",
              bpm !== null ? (beatPhase ? "scale-125 bg-amber-400" : "scale-90 bg-amber-500/40") : "bg-graphite-700"
            )}
            aria-hidden
          />
        </div>

        <p className="text-xs text-text-subtle">
          {bpm !== null ? "BPM" : tapCount === 0 ? "Tap to start" : "Keep tapping…"}
        </p>

        {bpm !== null && !isSteady && (
          <p className="text-[11px] text-amber-400/90">Taps are a little uneven — try to land right on the beat.</p>
        )}

        {alternatives.length > 0 && (
          <p className="font-mono text-[11px] text-text-subtle">
            Could also be {alternatives.join(" or ")} BPM if you tapped every other beat
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleTap}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-48 w-full select-none items-center justify-center rounded-2xl border-2 text-lg font-semibold transition-all duration-100",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
          isPulsing
            ? "scale-[0.98] border-amber-500 bg-amber-500/20 text-amber-400"
            : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-amber-500/40"
        )}
      >
        Tap
      </button>

      <p className="text-center text-xs text-text-subtle">
        Click, tap, or press Space/Enter in time with the beat. {tapCount} tap{tapCount !== 1 ? "s" : ""} so far.
      </p>

      <div className="flex gap-2">
        <Button variant="outline" size="md" className="flex-1" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        {bpm !== null && (
          <Link href={`/metronome?bpm=${bpm}`} className="flex-1">
            <Button variant="primary" size="md" className="w-full">
              <Music2 className="h-4 w-4" />
              Use in Metronome
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}