"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, AlertTriangle, ChevronUp, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type TunerState = "idle" | "requesting" | "listening" | "denied" | "unsupported";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// How often (ms) detected pitch values are pushed into React state. The
// actual detection runs every animation frame (as fast as the browser
// allows) for responsiveness, but rendering on every frame would be
// wasted work - decoupling detection rate from render rate via a ref +
// interval keeps the UI smooth without re-rendering 60x/second.
const RENDER_INTERVAL_MS = 80;

// Below this RMS amplitude, treat the signal as silence rather than
// guessing a pitch from noise floor / room hum - avoids the note display
// flickering to a random note when nothing is actually being played.
const SILENCE_RMS_THRESHOLD = 0.01;

const REF_PITCH_MIN = 415;
const REF_PITCH_MAX = 466;
const REF_PITCH_DEFAULT = 440;
const REF_PITCH_PRESETS = [415, 440, 442, 443, 444];

// How many recent readings feed the stability check, and how tight
// they must cluster (in cents) to count as "locked" — this is what
// turns a jittery live reading into something you can trust enough to
// actually stop turning the tuning peg.
const STABILITY_WINDOW = 8;
const STABILITY_CENTS_THRESHOLD = 3;

interface PitchResult {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
}

// Standard autocorrelation-based pitch detector (the ACF2+ approach
// widely used for real-time browser pitch detection). Operates on
// time-domain samples rather than the FFT/frequency-domain output,
// since autocorrelation is considerably more accurate than picking the
// loudest FFT bin for finding a signal's true fundamental frequency -
// FFT bin resolution is too coarse at typical buffer sizes to
// distinguish, say, 440Hz from 442Hz cleanly.
function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < SILENCE_RMS_THRESHOLD) return -1;

  // Trim leading/trailing near-silence so autocorrelation isn't thrown
  // off by quiet padding at the buffer's edges.
  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const n = trimmed.length;

  const c = new Array(n).fill(0);
  for (let lag = 0; lag < n; lag++) {
    for (let i = 0; i < n - lag; i++) {
      c[lag] += trimmed[i] * trimmed[i + lag];
    }
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  let foundPeriod = maxPos;
  if (maxPos > 0 && maxPos < n - 1) {
    const [x1, x2, x3] = [c[maxPos - 1], c[maxPos], c[maxPos + 1]];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a !== 0) foundPeriod = maxPos - b / (2 * a);
  }

  if (foundPeriod <= 0) return -1;
  return sampleRate / foundPeriod;
}

function frequencyToPitch(frequency: number, referencePitch: number): { note: string; octave: number; cents: number } {
  const midi = 69 + 12 * Math.log2(frequency / referencePitch);
  const roundedMidi = Math.round(midi);
  const cents = Math.round((midi - roundedMidi) * 100);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  return { note: NOTE_NAMES[noteIndex], octave, cents };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function TunerForm() {
  const [state, setState] = useState<TunerState>("idle");
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [smoothedCents, setSmoothedCents] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [referencePitch, setReferencePitch] = useState(REF_PITCH_DEFAULT);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const renderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPitchRef = useRef<PitchResult | null>(null);
  const referencePitchRef = useRef(referencePitch);
  const centsHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    referencePitchRef.current = referencePitch;
  }, [referencePitch]);

  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
    }
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (renderTimerRef.current) clearInterval(renderTimerRef.current);
    rafRef.current = null;
    renderTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    latestPitchRef.current = null;
    centsHistoryRef.current = [];
    setPitch(null);
    setIsLocked(false);
    setState("idle");
  }, []);

  /**
   * The rAF loop reschedules itself, which it can't do by naming itself: a
   * value referenced inside its own initializer is something the React
   * Compiler can't reason about, and it responded by skipping optimisation of
   * this entire component. One indirection through a ref — declared BEFORE the
   * callback, assigned in an effect rather than during render — removes the
   * self-reference without changing the detection rate.
   */
  const detectLoopRef = useRef<() => void>(() => {});

  const detectLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    const frequency = autoCorrelate(buffer, ctx.sampleRate);

    latestPitchRef.current =
      frequency > 0 ? { frequency, ...frequencyToPitch(frequency, referencePitchRef.current) } : null;

    rafRef.current = requestAnimationFrame(() => detectLoopRef.current());
  }, []);

  useEffect(() => {
    detectLoopRef.current = detectLoop;
  }, [detectLoop]);

  // Declared after `stop` so it isn't reaching a value from further up with a
  // suppressed dependency. `stop` is useCallback([]) and therefore stable, so
  // this still runs its cleanup only on unmount.
  useEffect(() => () => stop(), [stop]);

  // Render tick: pulls the latest detection, smooths the needle position
  // (raw per-frame cents are jittery even when the actual note is
  // steady — a light exponential ease makes the needle read as settling
  // rather than vibrating), and tracks a short rolling history to decide
  // whether the pitch has actually "locked" rather than just briefly
  // passing through in-tune.
  useEffect(() => {
    if (state !== "listening") return;
    const id = setInterval(() => {
      const latest = latestPitchRef.current;
      setPitch(latest);

      const targetCents = latest?.cents ?? 0;
      setSmoothedCents((prev) => (latest ? prev + (targetCents - prev) * 0.35 : 0));

      if (latest) {
        const history = [...centsHistoryRef.current, latest.cents].slice(-STABILITY_WINDOW);
        centsHistoryRef.current = history;
        if (history.length >= STABILITY_WINDOW) {
          const spread = Math.max(...history) - Math.min(...history);
          setIsLocked(spread <= STABILITY_CENTS_THRESHOLD && Math.abs(latest.cents) <= 5);
        } else {
          setIsLocked(false);
        }
      } else {
        centsHistoryRef.current = [];
        setIsLocked(false);
      }
    }, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state]);

  const start = useCallback(async () => {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      centsHistoryRef.current = [];

      rafRef.current = requestAnimationFrame(detectLoop);
      setState("listening");
    } catch (err) {
      console.error("Microphone access error:", err);
      setState("denied");
    }
  }, [detectLoop]);

  const toggle = () => {
    if (state === "listening") stop();
    else start();
  };

  if (state === "unsupported") {
    return (
      <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8">
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">
            Your browser doesn&apos;t support microphone input. Try a recent version of Chrome, Firefox, Safari, or Edge.
          </span>
        </div>
      </div>
    );
  }

  const isInTune = pitch !== null && Math.abs(smoothedCents) <= 5;
  const isClose = pitch !== null && Math.abs(smoothedCents) <= 15;
  const tone = !pitch ? "text-graphite-600" : isInTune ? "text-teal-400" : isClose ? "text-amber-400" : "text-red-400";
  const needlePercent = clamp(50 + smoothedCents, 2, 98);

  return (
    <div className="space-y-8 rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8">
      {state === "denied" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">
            Microphone access was denied or unavailable. Check your browser&apos;s site permissions and try again.
          </span>
        </div>
      )}

      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2">
          <p className={cn("font-mono text-7xl font-bold transition-colors", tone)}>
            {pitch ? pitch.note : "—"}
            {pitch && <span className="ml-1 align-top text-3xl text-text-subtle">{pitch.octave}</span>}
          </p>
          {isLocked && (
            <span className="flex items-center gap-1 rounded-full border border-teal-400/30 bg-teal-400/10 px-2 py-1 text-[10px] font-medium text-teal-400">
              <Check className="h-3 w-3" />
              Locked
            </span>
          )}
        </div>
        <p className="font-mono text-xs tabular-nums text-text-subtle">
          {pitch
            ? `${pitch.frequency.toFixed(1)} Hz`
            : state === "listening"
              ? "Listening…"
              : "Play a note"}
        </p>
      </div>

      {/* Meter — shaded in-tune band, real tick marks, smoothed needle */}
      <div className="space-y-1.5">
        <div className="relative h-4 overflow-hidden rounded-full bg-graphite-800">
          {/* ±5 cent in-tune zone, shaded directly on the track */}
          <div className="absolute inset-y-0 bg-teal-400/15" style={{ left: `${50 - 5}%`, width: "10%" }} />
          {/* Tick marks at -50/-25/0/+25/+50 */}
          {[-50, -25, 0, 25, 50].map((c) => (
            <div key={c} className="absolute top-0 h-full w-px bg-graphite-950/40" style={{ left: `${50 + c / 2}%` }} />
          ))}
          <div
            className={cn("absolute inset-y-0 -ml-1 w-2 rounded-full transition-[left] duration-75", tone.replace("text-", "bg-"))}
            style={{ left: `${needlePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-text-subtle">
          <span>−50¢ flat</span>
          <span>in tune</span>
          <span>+50¢ sharp</span>
        </div>
      </div>

      {/* Reference pitch — the thing that was hardcoded to 440 before */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-graphite-800 bg-graphite-850/60 px-3.5 py-2.5">
        <span className="text-xs text-text-muted">Reference pitch (A4)</span>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {REF_PITCH_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReferencePitch(preset)}
                className={cn(
                  "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                  referencePitch === preset
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
            <input
              type="number"
              min={REF_PITCH_MIN}
              max={REF_PITCH_MAX}
              value={referencePitch}
              onChange={(e) =>
                setReferencePitch(clamp(Number(e.target.value) || REF_PITCH_DEFAULT, REF_PITCH_MIN, REF_PITCH_MAX))
              }
              className="w-12 bg-transparent px-1.5 py-1 text-right font-mono text-xs text-text-primary [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="flex flex-col border-l border-graphite-700">
              <button
                type="button"
                aria-label="Increase reference pitch"
                onClick={() => setReferencePitch((v) => clamp(v + 1, REF_PITCH_MIN, REF_PITCH_MAX))}
                className="flex h-3 w-4 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400"
              >
                <ChevronUp className="h-2 w-2" />
              </button>
              <button
                type="button"
                aria-label="Decrease reference pitch"
                onClick={() => setReferencePitch((v) => clamp(v - 1, REF_PITCH_MIN, REF_PITCH_MAX))}
                className="flex h-3 w-4 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400"
              >
                <ChevronDown className="h-2 w-2" />
              </button>
            </span>
          </span>
          <span className="text-[11px] text-text-subtle">Hz</span>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={state === "requesting"}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
          state === "listening" ? "bg-red-500 text-white hover:bg-red-400" : "bg-amber-500 text-graphite-950 hover:bg-amber-400"
        )}
      >
        {state === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        {state === "requesting" ? "Requesting microphone…" : state === "listening" ? "Stop" : "Start tuning"}
      </button>
    </div>
  );
}