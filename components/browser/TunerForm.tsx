"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, AlertTriangle } from "lucide-react";

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

function frequencyToPitch(frequency: number): { note: string; octave: number; cents: number } {
  const A4 = 440;
  const midi = 69 + 12 * Math.log2(frequency / A4);
  const roundedMidi = Math.round(midi);
  const cents = Math.round((midi - roundedMidi) * 100);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  return { note: NOTE_NAMES[noteIndex], octave, cents };
}

export function TunerForm() {
  const [state, setState] = useState<TunerState>("idle");
  const [pitch, setPitch] = useState<PitchResult | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const renderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPitchRef = useRef<PitchResult | null>(null);

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
    setPitch(null);
    setState("idle");
  }, []);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    const frequency = autoCorrelate(buffer, ctx.sampleRate);

    latestPitchRef.current = frequency > 0 ? { frequency, ...frequencyToPitch(frequency) } : null;

    rafRef.current = requestAnimationFrame(detectLoop);
  }, []);

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

      rafRef.current = requestAnimationFrame(detectLoop);
      renderTimerRef.current = setInterval(() => setPitch(latestPitchRef.current), RENDER_INTERVAL_MS);

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

  const cents = pitch?.cents ?? 0;
  const isInTune = pitch !== null && Math.abs(cents) <= 5;
  const isClose = pitch !== null && Math.abs(cents) <= 15;
  const needlePercent = 50 + Math.max(-50, Math.min(50, cents));

  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8 space-y-8">
      {state === "denied" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">
            Microphone access was denied or unavailable. Check your browser&apos;s site permissions and try again.
          </span>
        </div>
      )}

      <div className="text-center space-y-2">
        <p
          className={`text-7xl font-mono font-bold transition-colors ${
            !pitch ? "text-graphite-600" : isInTune ? "text-teal-400" : isClose ? "text-amber-400" : "text-red-400"
          }`}
        >
          {pitch ? pitch.note : "—"}
          {pitch && <span className="text-3xl align-top ml-1 text-text-subtle">{pitch.octave}</span>}
        </p>
        <p className="text-xs font-mono text-text-subtle tabular-nums">
          {pitch ? `${pitch.frequency.toFixed(1)} Hz` : state === "listening" ? "Listening…" : "Play a note"}
        </p>
      </div>

      <div className="space-y-2">
        <div className="relative h-3 rounded-full bg-graphite-800 overflow-hidden">
          <div className="absolute inset-y-0 left-1/2 w-px bg-graphite-600" />
          <div
            className={`absolute inset-y-0 w-2 -ml-1 rounded-full transition-all duration-75 ${
              !pitch ? "bg-graphite-600" : isInTune ? "bg-teal-400" : isClose ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ left: `${needlePercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-text-subtle">
          <span>−50¢ flat</span>
          <span>in tune</span>
          <span>+50¢ sharp</span>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={state === "requesting"}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 font-medium transition-colors disabled:opacity-50 ${
          state === "listening"
            ? "bg-red-500 text-white hover:bg-red-400"
            : "bg-amber-500 text-graphite-950 hover:bg-amber-400"
        }`}
      >
        {state === "listening" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        {state === "requesting" ? "Requesting microphone…" : state === "listening" ? "Stop" : "Start tuning"}
      </button>
    </div>
  );
}