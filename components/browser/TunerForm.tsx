"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, AlertTriangle, ChevronUp, ChevronDown, Check, Volume2, Link2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type TunerState = "idle" | "requesting" | "listening" | "denied" | "unsupported";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// How often (ms) detected pitch values are pushed into React state. The
// actual detection runs every animation frame for responsiveness; the UI
// re-renders on a slower interval via a ref handoff.
const RENDER_INTERVAL_MS = 80;

// Below this RMS amplitude, treat the signal as silence rather than
// guessing a pitch from noise floor / room hum.
const SILENCE_RMS_THRESHOLD = 0.01;

const REF_PITCH_MIN = 415;
const REF_PITCH_MAX = 466;
const REF_PITCH_DEFAULT = 440;
const REF_PITCH_PRESETS = [415, 440, 442, 443, 444];

// Stability lock: recent readings must cluster this tightly (cents) to
// count as "locked" — a jittery reading never marks a string done.
const STABILITY_WINDOW = 8;
const STABILITY_CENTS_THRESHOLD = 3;

// Above this many cents over the target, the user is likely an octave
// off and still tightening — the classic way beginners snap strings.
const SNAP_WARNING_CENTS = 700;
const IN_TUNE_CENTS = 5;

// After this many silent render ticks in bass mode, surface the
// low-string mic hint (~2.4s at 80ms per tick).
const LOW_STRING_HINT_TICKS = 30;

interface PitchResult {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
}

interface StringTarget {
  midi: number;
  label: string;
}

interface Tuning {
  id: string;
  label: string;
  midis: number[];
}

interface Instrument {
  id: string;
  label: string;
  tunings: Tuning[];
}

// String pitches are stored as MIDI numbers (A4 = 69) so the reference
// pitch transposes every target: freq = ref * 2^((midi - 69) / 12).
const INSTRUMENTS: Instrument[] = [
  {
    id: "guitar",
    label: "Guitar",
    tunings: [
      { id: "standard", label: "Standard", midis: [40, 45, 50, 55, 59, 64] },
      { id: "drop-d", label: "Drop D", midis: [38, 45, 50, 55, 59, 64] },
      { id: "half-step", label: "Half-step down", midis: [39, 44, 49, 54, 58, 63] },
      { id: "open-g", label: "Open G", midis: [38, 43, 50, 55, 59, 62] },
      { id: "dadgad", label: "DADGAD", midis: [38, 45, 50, 55, 57, 62] },
    ],
  },
  {
    id: "bass",
    label: "Bass",
    tunings: [
      { id: "4-string", label: "4-string", midis: [28, 33, 38, 43] },
      { id: "5-string", label: "5-string", midis: [23, 28, 33, 38, 43] },
    ],
  },
  { id: "ukulele", label: "Ukulele", tunings: [{ id: "standard", label: "Standard", midis: [67, 60, 64, 69] }] },
  { id: "violin", label: "Violin", tunings: [{ id: "standard", label: "Standard", midis: [55, 62, 69, 76] }] },
  { id: "viola", label: "Viola", tunings: [{ id: "standard", label: "Standard", midis: [48, 55, 62, 69] }] },
  { id: "cello", label: "Cello", tunings: [{ id: "standard", label: "Standard", midis: [36, 43, 50, 57] }] },
  { id: "mandolin", label: "Mandolin", tunings: [{ id: "standard", label: "Standard", midis: [55, 62, 69, 76] }] },
];

export interface TunerInitialSettings {
  instrument?: string;
  tuning?: string;
  referencePitch?: number;
}

interface TunerFormProps {
  initialSettings?: TunerInitialSettings;
}

function midiToLabel(midi: number): string {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

function midiToFrequency(midi: number, referencePitch: number): number {
  return referencePitch * Math.pow(2, (midi - 69) / 12);
}

function centsBetween(frequency: number, targetFrequency: number): number {
  return 1200 * Math.log2(frequency / targetFrequency);
}

// Standard autocorrelation-based pitch detector (ACF2+). Time-domain
// autocorrelation resolves the fundamental far more precisely than
// picking the loudest FFT bin at typical buffer sizes.
function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < SILENCE_RMS_THRESHOLD) return -1;

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

function ModeChip({
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
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
          : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}

export function TunerForm({ initialSettings }: TunerFormProps) {
  const s = initialSettings ?? {};

  const [state, setState] = useState<TunerState>("idle");
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [smoothedCents, setSmoothedCents] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [referencePitch, setReferencePitch] = useState(() =>
    s.referencePitch && s.referencePitch >= REF_PITCH_MIN && s.referencePitch <= REF_PITCH_MAX
      ? s.referencePitch
      : REF_PITCH_DEFAULT
  );

  const initialInstrument = INSTRUMENTS.find((i) => i.id === s.instrument) ?? null;
  const [instrumentId, setInstrumentId] = useState<string | null>(initialInstrument?.id ?? null);
  const [tuningId, setTuningId] = useState<string>(() => {
    if (initialInstrument) {
      const t = initialInstrument.tunings.find((t) => t.id === s.tuning);
      return (t ?? initialInstrument.tunings[0]).id;
    }
    return "standard";
  });
  const [manualString, setManualString] = useState<number | null>(null);
  const [autoString, setAutoString] = useState<number | null>(null);
  const [doneStrings, setDoneStrings] = useState<boolean[]>(() => {
    if (!initialInstrument) return [];
    const t = initialInstrument.tunings.find((t) => t.id === s.tuning) ?? initialInstrument.tunings[0];
    return new Array(t.midis.length).fill(false);
  });
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [targetCents, setTargetCents] = useState<number | null>(null);
  const [showLowStringHint, setShowLowStringHint] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const instrument = INSTRUMENTS.find((i) => i.id === instrumentId) ?? null;
  const tuning = instrument ? (instrument.tunings.find((t) => t.id === tuningId) ?? instrument.tunings[0]) : null;
  const strings: StringTarget[] = tuning ? tuning.midis.map((midi) => ({ midi, label: midiToLabel(midi) })) : [];

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestPitchRef = useRef<PitchResult | null>(null);
  const latestFrequencyRef = useRef<number>(-1);
  const referencePitchRef = useRef(referencePitch);
  const centsHistoryRef = useRef<number[]>([]);
  const silentTicksRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const manualStringRef = useRef(manualString);
  const doneStringsRef = useRef(doneStrings);
  const autoAdvanceRef = useRef(autoAdvance);
  const stringsRef = useRef(strings);
  const instrumentIdRef = useRef(instrumentId);

  useEffect(() => {
    referencePitchRef.current = referencePitch;
  }, [referencePitch]);
  useEffect(() => {
    manualStringRef.current = manualString;
  }, [manualString]);
  useEffect(() => {
    doneStringsRef.current = doneStrings;
  }, [doneStrings]);
  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;
  }, [autoAdvance]);
  useEffect(() => {
    stringsRef.current = strings;
  });
  useEffect(() => {
    instrumentIdRef.current = instrumentId;
  }, [instrumentId]);

  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Best-effort.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    latestPitchRef.current = null;
    latestFrequencyRef.current = -1;
    centsHistoryRef.current = [];
    silentTicksRef.current = 0;
    releaseWakeLock();
    setPitch(null);
    setIsLocked(false);
    setTargetCents(null);
    setAutoString(null);
    setShowLowStringHint(false);
    setState("idle");
  }, [releaseWakeLock]);

  /**
   * The rAF loop reschedules itself via a ref rather than by naming itself —
   * a self-referencing initializer defeats the React Compiler. Declared
   * BEFORE the callback, assigned in an effect.
   */
  const detectLoopRef = useRef<() => void>(() => {});

  const detectLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !ctx) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    const frequency = autoCorrelate(buffer, ctx.sampleRate);

    latestFrequencyRef.current = frequency;
    latestPitchRef.current =
      frequency > 0 ? { frequency, ...frequencyToPitch(frequency, referencePitchRef.current) } : null;

    rafRef.current = requestAnimationFrame(() => detectLoopRef.current());
  }, []);

  useEffect(() => {
    detectLoopRef.current = detectLoop;
  }, [detectLoop]);

  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && state === "listening" && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state, requestWakeLock]);

  // Render tick. Chromatic mode measures against the nearest chromatic
  // note; instrument mode measures against the active string's target
  // (manual selection wins over auto-detect). The needle is smoothed,
  // and the stability window decides when a string counts as done.
  useEffect(() => {
    if (state !== "listening") return;
    const id = setInterval(() => {
      const latest = latestPitchRef.current;
      const frequency = latestFrequencyRef.current;
      const currentStrings = stringsRef.current;
      const isInstrumentMode = instrumentIdRef.current !== null && currentStrings.length > 0;

      setPitch(latest);

      if (latest === null || frequency <= 0) {
        silentTicksRef.current += 1;
        if (instrumentIdRef.current === "bass" && silentTicksRef.current >= LOW_STRING_HINT_TICKS) {
          setShowLowStringHint(true);
        }
        centsHistoryRef.current = [];
        setIsLocked(false);
        setSmoothedCents(0);
        setTargetCents(null);
        return;
      }

      silentTicksRef.current = 0;
      setShowLowStringHint(false);

      let cents: number;
      if (isInstrumentMode) {
        const ref = referencePitchRef.current;
        let stringIndex: number;
        if (manualStringRef.current !== null && manualStringRef.current < currentStrings.length) {
          stringIndex = manualStringRef.current;
        } else {
          let best = 0;
          let bestDist = Infinity;
          currentStrings.forEach((str, i) => {
            const dist = Math.abs(centsBetween(frequency, midiToFrequency(str.midi, ref)));
            if (dist < bestDist) {
              bestDist = dist;
              best = i;
            }
          });
          stringIndex = best;
          setAutoString(best);
        }
        cents = centsBetween(frequency, midiToFrequency(currentStrings[stringIndex].midi, referencePitchRef.current));
        setTargetCents(cents);

        const history = [...centsHistoryRef.current, cents].slice(-STABILITY_WINDOW);
        centsHistoryRef.current = history;
        const locked =
          history.length >= STABILITY_WINDOW &&
          Math.max(...history) - Math.min(...history) <= STABILITY_CENTS_THRESHOLD &&
          Math.abs(cents) <= IN_TUNE_CENTS;
        setIsLocked(locked);

        if (locked && !doneStringsRef.current[stringIndex]) {
          const nextDone = [...doneStringsRef.current];
          nextDone[stringIndex] = true;
          doneStringsRef.current = nextDone;
          setDoneStrings(nextDone);
          if (autoAdvanceRef.current) {
            const total = currentStrings.length;
            for (let step = 1; step <= total; step++) {
              const candidate = (stringIndex + step) % total;
              if (!nextDone[candidate]) {
                setManualString(candidate);
                centsHistoryRef.current = [];
                break;
              }
            }
          }
        }
      } else {
        cents = latest.cents;
        setTargetCents(null);
        const history = [...centsHistoryRef.current, cents].slice(-STABILITY_WINDOW);
        centsHistoryRef.current = history;
        setIsLocked(
          history.length >= STABILITY_WINDOW &&
            Math.max(...history) - Math.min(...history) <= STABILITY_CENTS_THRESHOLD &&
            Math.abs(cents) <= IN_TUNE_CENTS
        );
      }

      const needleTarget = clamp(cents, -60, 60);
      setSmoothedCents((prev) => prev + (needleTarget - prev) * 0.35);
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
      silentTicksRef.current = 0;

      rafRef.current = requestAnimationFrame(detectLoop);
      requestWakeLock();
      setState("listening");
    } catch (err) {
      console.error("Microphone access error:", err);
      setState("denied");
    }
  }, [detectLoop, requestWakeLock]);

  const toggle = () => {
    if (state === "listening") stop();
    else start();
  };

  // Synthesized reference tone — a soft sine with a gentle release, so
  // users can tune by ear when the mic can't hear a low string.
  const playTargetTone = useCallback((midi: number) => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!playbackCtxRef.current || playbackCtxRef.current.state === "closed") {
      playbackCtxRef.current = new Ctx();
    }
    const ctx = playbackCtxRef.current;
    ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = midiToFrequency(midi, referencePitchRef.current);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.setValueAtTime(0.25, now + 1.0);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    osc.start(now);
    osc.stop(now + 1.7);
  }, []);

  useEffect(
    () => () => {
      playbackCtxRef.current?.close().catch(() => {});
      playbackCtxRef.current = null;
    },
    []
  );

  const resetForStrings = (count: number) => {
    setDoneStrings(new Array(count).fill(false));
    setManualString(null);
    setAutoString(null);
    setTargetCents(null);
    centsHistoryRef.current = [];
  };

  const selectInstrument = (id: string | null) => {
    setInstrumentId(id);
    if (id) {
      const inst = INSTRUMENTS.find((i) => i.id === id);
      if (inst) {
        setTuningId(inst.tunings[0].id);
        resetForStrings(inst.tunings[0].midis.length);
        return;
      }
    }
    resetForStrings(0);
  };

  const selectTuning = (t: Tuning) => {
    setTuningId(t.id);
    resetForStrings(t.midis.length);
  };

  const tapString = (index: number) => {
    if (doneStrings[index]) {
      const next = [...doneStrings];
      next[index] = false;
      setDoneStrings(next);
    }
    setManualString(index);
    centsHistoryRef.current = [];
  };

  const resetProgress = () => {
    setDoneStrings(new Array(strings.length).fill(false));
    setManualString(null);
    centsHistoryRef.current = [];
  };

  const copyShareLink = useCallback(async () => {
    const params = new URLSearchParams();
    if (instrumentId) {
      params.set("i", instrumentId);
      const inst = INSTRUMENTS.find((x) => x.id === instrumentId);
      if (inst && inst.tunings.length > 1) params.set("t", tuningId);
    }
    if (referencePitch !== REF_PITCH_DEFAULT) params.set("ref", String(referencePitch));

    const query = params.toString();
    const url = `${window.location.origin}/tuner${query ? `?${query}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      window.prompt("Copy this tuning link:", url);
    }
  }, [instrumentId, tuningId, referencePitch]);

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

  const isInstrumentMode = instrument !== null && strings.length > 0;
  const activeString = manualString ?? autoString;
  const activeTarget = isInstrumentMode && activeString !== null && activeString < strings.length ? strings[activeString] : null;
  const displayCents = isInstrumentMode ? targetCents : pitch?.cents ?? null;

  const isInTune = displayCents !== null && Math.abs(displayCents) <= IN_TUNE_CENTS;
  const isClose = displayCents !== null && Math.abs(displayCents) <= 15;
  const wayTooHigh = isInstrumentMode && targetCents !== null && targetCents >= SNAP_WARNING_CENTS;
  const wayTooLow = isInstrumentMode && targetCents !== null && targetCents <= -SNAP_WARNING_CENTS;
  const tone = !pitch ? "text-graphite-600" : isInTune ? "text-teal-400" : isClose ? "text-amber-400" : "text-red-400";
  const needlePercent = clamp(50 + smoothedCents, 2, 98);

  const allDone = isInstrumentMode && doneStrings.length > 0 && doneStrings.every(Boolean);
  const anyDone = doneStrings.some(Boolean);

  let action: { text: string; className: string } | null = null;
  if (state === "listening" && pitch) {
    if (isInstrumentMode && activeTarget) {
      if (wayTooHigh) {
        action = { text: `Much too high — stop tightening! You may be an octave above ${activeTarget.label}.`, className: "text-red-400" };
      } else if (wayTooLow) {
        action = { text: `Much too low — check you're playing the right string for ${activeTarget.label}.`, className: "text-red-400" };
      } else if (isInTune) {
        action = { text: "In tune ✓", className: "text-teal-400" };
      } else if (displayCents !== null && displayCents < 0) {
        action = { text: "Tighten slowly ↑", className: "text-amber-400" };
      } else if (displayCents !== null) {
        action = { text: "Loosen slightly ↓", className: "text-amber-400" };
      }
    } else if (isInTune) {
      action = { text: "In tune ✓", className: "text-teal-400" };
    }
  }

  return (
    <div className="space-y-7 rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8">
      {state === "denied" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">
            Microphone access was denied or unavailable. Check your browser&apos;s site permissions and try again.
          </span>
        </div>
      )}

      {/* Mode selector — Chromatic (default) or an instrument's strings */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap justify-center gap-1.5">
          <ModeChip active={instrumentId === null} onClick={() => selectInstrument(null)}>
            Chromatic
          </ModeChip>
          {INSTRUMENTS.map((inst) => (
            <ModeChip key={inst.id} active={instrumentId === inst.id} onClick={() => selectInstrument(inst.id)}>
              {inst.label}
            </ModeChip>
          ))}
        </div>
        {instrument && instrument.tunings.length > 1 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {instrument.tunings.map((t) => (
              <ModeChip key={t.id} active={tuningId === t.id} onClick={() => selectTuning(t)}>
                {t.label}
              </ModeChip>
            ))}
          </div>
        )}
      </div>

      {/* String row — auto-highlighted, tappable, with done states and
          per-string reference tones */}
      {isInstrumentMode && (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-center gap-2">
            {strings.map((str, i) => {
              const isActive = activeString === i;
              const isManual = manualString === i;
              const done = doneStrings[i];
              return (
                <div key={`${str.midi}-${i}`} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => tapString(i)}
                    aria-label={`String ${i + 1}, ${str.label}${done ? ", in tune" : ""}`}
                    aria-pressed={isManual}
                    className={cn(
                      "relative flex h-12 w-12 items-center justify-center rounded-xl border font-mono text-sm font-semibold transition-all",
                      done
                        ? "border-teal-400/60 bg-teal-400/10 text-teal-400"
                        : isActive
                          ? "border-amber-500 bg-amber-500/15 text-amber-400"
                          : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary",
                      isActive && !done && "scale-105"
                    )}
                  >
                    {str.label}
                    {done && <Check className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-graphite-900 p-0.5 text-teal-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => playTargetTone(str.midi)}
                    aria-label={`Play ${str.label} reference tone`}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px]">
            {manualString !== null && (
              <button
                type="button"
                onClick={() => {
                  setManualString(null);
                  centsHistoryRef.current = [];
                }}
                className="rounded-md border border-graphite-700 bg-graphite-850 px-2 py-1 font-medium text-text-muted transition-colors hover:text-text-primary"
              >
                Auto-detect string
              </button>
            )}
            <button
              type="button"
              onClick={() => setAutoAdvance((v) => !v)}
              aria-pressed={autoAdvance}
              className={cn(
                "rounded-md border px-2 py-1 font-medium transition-colors",
                autoAdvance
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
              )}
            >
              Auto-advance {autoAdvance ? "on" : "off"}
            </button>
            {anyDone && (
              <button
                type="button"
                onClick={resetProgress}
                className="flex items-center gap-1 rounded-md border border-graphite-700 bg-graphite-850 px-2 py-1 font-medium text-text-muted transition-colors hover:text-text-primary"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>

          {allDone && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-teal-400/25 bg-teal-400/[0.07] px-3.5 py-2 text-xs text-teal-400">
              <Check className="h-3.5 w-3.5 shrink-0" />
              All strings in tune — you&apos;re ready to play.
            </div>
          )}
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
          {activeTarget
            ? `Target: ${activeTarget.label} · ${midiToFrequency(activeTarget.midi, referencePitch).toFixed(1)} Hz${
                pitch ? ` · playing ${pitch.frequency.toFixed(1)} Hz` : ""
              }`
            : pitch
              ? `${pitch.frequency.toFixed(1)} Hz`
              : state === "listening"
                ? "Listening…"
                : "Play a note"}
        </p>
      </div>

      {/* Meter — shaded in-tune band, real tick marks, smoothed needle */}
      <div className="space-y-1.5">
        <div className="relative h-4 overflow-hidden rounded-full bg-graphite-800">
          <div className="absolute inset-y-0 bg-teal-400/15" style={{ left: `${50 - 5}%`, width: "10%" }} />
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

      {/* Plain-language instruction — what to physically do next */}
      {action && (
        <p className={cn("text-center text-sm font-medium", action.className)} role="status" aria-live="polite">
          {action.text}
        </p>
      )}

      {showLowStringHint && (
        <p className="text-center text-[11px] text-text-subtle">
          Low bass strings are hard for laptop mics — try playing the 12th-fret harmonic, or use the string&apos;s reference tone to tune by
          ear.
        </p>
      )}

      {/* Reference pitch — transposes every string target too */}
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={copyShareLink}
          className="flex items-center gap-1.5 rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-1.5 text-[11px] font-medium text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
        >
          {linkCopied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Link2 className="h-3.5 w-3.5" />}
          {linkCopied ? "Copied" : "Copy tuning link"}
        </button>
      </div>
    </div>
  );
}