"use client";

import { useEffect, useRef, useState } from "react";
import { encodeWav } from "@/lib/audio/mix-export";
import { AdsterraBanner } from "@/components/ads/AdsterraBanner";
import { Mic, Square, Play, Pause, Download, RotateCcw, AlertTriangle } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

type RecorderState = "idle" | "requesting" | "recording" | "stopped" | "denied" | "unsupported";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// First mimeType the browser's MediaRecorder actually supports; Safari's
// set is far smaller than Chrome/Firefox's, so this can't be hardcoded.
function pickSupportedMimeType(): string | null {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return null;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

// Right pane of the idle stage. Facts only.
function RecorderAside() {
  const rows: Array<[string, string]> = [
    ["Private", "Nothing is uploaded, the audio never leaves your device"],
    ["Saves", "WAV, plus the browser's native WebM or M4A"],
    ["Meter", "Live input level while you record"],
    ["Free", "No account, nothing to install"],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 px-5 py-6 sm:px-7">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-3">
          <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
            {label}
          </span>
          <span className="text-sm leading-snug text-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function VoiceRecorderForm() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wavBusy, setWavBusy] = useState(false);
  const [wavError, setWavError] = useState(false);
  const [levels, setLevels] = useState<number[]>(new Array(32).fill(0.05));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof MediaRecorder === "undefined") {
      setState("unsupported");
    }
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopLevelMeter = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Cleanup must run once, on unmount; the URL is read through a ref so a
  // new recording doesn't tear the recorder down.
  const audioUrlRef = useRef<string | null>(null);
  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      stopTimer();
      stopLevelMeter();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  // Live input-level bars: feedback that the mic is picking up sound, not
  // a waveform of the final recording.
  const startLevelMeter = (stream: MediaStream) => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const bucketSize = Math.floor(data.length / 32) || 1;
      const nextLevels = Array.from({ length: 32 }, (_, i) => {
        const start = i * bucketSize;
        const end = Math.min(start + bucketSize, data.length);
        let sum = 0;
        for (let j = start; j < end; j++) sum += data[j];
        const avg = sum / Math.max(1, end - start);
        return Math.max(0.05, avg / 255);
      });
      setLevels(nextLevels);
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const handleStart = async () => {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const supportedType = pickSupportedMimeType();
      const recorder = supportedType
        ? new MediaRecorder(stream, { mimeType: supportedType })
        : new MediaRecorder(stream);

      const actualType = recorder.mimeType || supportedType || "audio/webm";
      setMimeType(actualType);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: actualType });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState("stopped");
        stopTimer();
        stopLevelMeter();
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      startLevelMeter(stream);

      setElapsedSeconds(0);
      timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch (err) {
      console.error("Microphone access error:", err);
      setState("denied");
    }
  };

  const handleStop = () => {
    mediaRecorderRef.current?.stop();
  };

  const handleReset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setMimeType(null);
    setElapsedSeconds(0);
    setIsPlaying(false);
    setState("idle");
  };

  const togglePlayback = () => {
    const audio = audioElRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const downloadFilename = mimeType ? `recording.${extensionForMimeType(mimeType)}` : "recording.webm";

  // Decode + re-encode with encodeWav runs entirely in the page, so the
  // "nothing is uploaded" claim stays literally true. Lossy-to-PCM, not a
  // quality gain.
  const handleWavExport = async () => {
    if (!audioUrl || wavBusy) return;
    setWavBusy(true);
    try {
      const raw = await (await fetch(audioUrl)).arrayBuffer();
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const decoded = await ctx.decodeAudioData(raw);
      void ctx.close();
      const blob = encodeWav(decoded);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "recording.wav";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setWavError(true);
    } finally {
      setWavBusy(false);
    }
  };

  const recording = state === "recording";
  const stopped = state === "stopped" && Boolean(audioUrl);

  const led = stopped
    ? "bg-teal-400"
    : recording
      ? "bg-red-500 animate-pulse"
      : "bg-graphite-600";

  if (state === "unsupported") {
    return (
      <div className="surface grain rounded-2xl border border-graphite-800 p-6 sm:p-8">
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">
            Your browser doesn&apos;t support audio recording. Try a recent version of Chrome, Firefox, Safari, or Edge.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="surface grain overflow-clip rounded-2xl border border-graphite-800">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-graphite-800 px-4 py-2.5 sm:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", led)} aria-hidden />
          {stopped ? (
            <>
              <span className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-teal-400">
                Done
              </span>
              <span className="truncate text-sm text-text-primary">Your recording</span>
            </>
          ) : (
            <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
              Voice recorder
            </span>
          )}
        </div>
        <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", recording ? "text-red-400" : "text-text-subtle")}>
          {recording
            ? `REC ${formatTime(elapsedSeconds)}`
            : stopped
              ? `${formatTime(elapsedSeconds)} · in your browser`
              : "Free · In your browser"}
        </span>
      </div>

      {state === "denied" && (
        <div className="border-b border-graphite-800 px-4 py-3 sm:px-7">
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="text-sm text-text-primary">
              Microphone access was denied or unavailable. Check your browser&apos;s site permissions and try again.
            </span>
          </div>
        </div>
      )}

      {(state === "idle" || state === "requesting" || state === "denied") && (
        <div className="grid lg:h-56 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <button
            type="button"
            onClick={handleStart}
            disabled={state === "requesting"}
            className="group flex items-center justify-between gap-5 px-5 py-8 text-left outline-none transition-colors hover:bg-white/[0.015] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60 disabled:pointer-events-none sm:px-7 lg:py-0"
          >
            <span>
              <span className="display block text-5xl text-text-primary sm:text-6xl">Record</span>
              <span className="mt-4 block text-sm text-text-muted">
                {state === "requesting" ? "Requesting microphone access…" : "Tap to start. Stop whenever you like."}
              </span>
            </span>
            <span
              aria-hidden
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors group-hover:bg-amber-400 group-active:bg-amber-600 group-disabled:opacity-50"
            >
              <Mic className="h-8 w-8" />
            </span>
          </button>

          <div className="border-t border-graphite-800 bg-graphite-950/30 lg:border-l lg:border-t-0">
            <RecorderAside />
          </div>
        </div>
      )}

      {recording && (
        <>
          <div className="flex h-44 items-end gap-1 px-4 pb-4 pt-6 sm:h-52 sm:px-7 lg:h-56">
            {levels.map((level, i) => (
              <span
                key={i}
                className="flex-1 rounded-full bg-amber-500 transition-all duration-75"
                style={{ height: `${level * 100}%` }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-graphite-800 bg-graphite-950/40 px-4 py-3 sm:px-7">
            <p className="font-mono text-2xl font-bold tabular-nums text-text-primary">
              {formatTime(elapsedSeconds)}
            </p>
            <button
              type="button"
              onClick={handleStop}
              className="flex h-12 items-center gap-2.5 rounded-full bg-red-500 px-6 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors hover:bg-red-400 active:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
            >
              <Square className="h-4 w-4" fill="currentColor" aria-hidden />
              Stop recording
            </button>
          </div>
        </>
      )}

      {stopped && audioUrl && (
        <>
          <div className="space-y-4 p-4 sm:p-7">
            <audio
              ref={audioElRef}
              src={audioUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            />

            <div className="flex items-center gap-4 rounded-xl border border-graphite-700 bg-graphite-950/40 p-4">
              <button
                type="button"
                onClick={togglePlayback}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-amber-400 active:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
              </button>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">Your recording</p>
                <p className="font-mono text-xs tabular-nums text-text-subtle">{formatTime(elapsedSeconds)} long</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={audioUrl}
                download={downloadFilename}
                className={buttonStyles({ size: "lg", className: "flex-1" })}
              >
                <Download />
                Download recording
              </a>
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={handleWavExport}
                disabled={wavBusy}
              >
                <Download />
                {wavBusy ? "Converting to WAV…" : "Download as WAV"}
              </Button>
            </div>

            {wavError && (
              <p className="text-xs text-red-400">
                WAV conversion failed in this browser. The other download still works.
              </p>
            )}

            <AdsterraBanner key={`ad-${audioUrl}`} className="pt-2" />
          </div>

          <div className="flex flex-col gap-3 border-t border-graphite-800 bg-graphite-950/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 self-start rounded text-sm text-text-muted outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Record another
            </button>
            <p className="text-xs text-text-subtle">
              Both downloads are made in your browser. Nothing is ever uploaded anywhere.
            </p>
          </div>
        </>
      )}
    </div>
  );
}