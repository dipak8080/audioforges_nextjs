"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Pause, Download, RotateCcw, AlertTriangle } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";

type RecorderState = "idle" | "requesting" | "recording" | "stopped" | "denied" | "unsupported";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Picks the first mimeType the browser's MediaRecorder actually supports,
// preferring formats that produce smaller files and wider compatibility.
// Different browsers support different subsets (Safari in particular is
// far more limited than Chrome/Firefox), so this can't be hardcoded.
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

export function VoiceRecorderForm() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
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

  useEffect(() => {
    return () => {
      stopTimer();
      stopLevelMeter();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioCtxRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Live input-level bars while recording - purely visual feedback so the
  // person can see the mic is actually picking up sound, not a waveform
  // of the final recording.
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
        setAudioBlob(blob);
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
    setAudioBlob(null);
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

  if (state === "unsupported") {
    return (
      <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8">
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
    <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8 space-y-6">
      {state === "denied" && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">
            Microphone access was denied or unavailable. Check your browser&apos;s site permissions and try again.
          </span>
        </div>
      )}

      {(state === "idle" || state === "requesting" || state === "denied") && (
        <div className="flex flex-col items-center gap-4 py-8">
          {/* NOT a <Button>: this and the stop/play controls below are
              circular transport buttons at h-20/h-16/h-12. Button's sizes
              are rectangular and capped at h-12, so fitting them would
              mean overriding height, width, radius and padding - nothing
              of the component would survive. If these three ever need to
              agree with each other, that's a PlayButton component, not
              this one. */}
          <button
            type="button"
            onClick={handleStart}
            disabled={state === "requesting"}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500 text-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-amber-400 active:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900 disabled:pointer-events-none disabled:opacity-50"
            aria-label="Start recording"
          >
            <Mic className="h-8 w-8" />
          </button>
          <p className="text-sm text-text-muted">
            {state === "requesting" ? "Requesting microphone access…" : "Tap to start recording"}
          </p>
        </div>
      )}

      {state === "recording" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex h-16 items-end gap-1">
            {levels.map((level, i) => (
              <span
                key={i}
                className="w-1.5 rounded-full bg-amber-500 transition-all duration-75"
                style={{ height: `${level * 100}%` }}
              />
            ))}
          </div>
          <p className="text-2xl font-mono font-bold text-text-primary tabular-nums">
            {formatTime(elapsedSeconds)}
          </p>
          <button
            type="button"
            onClick={handleStop}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors hover:bg-red-400 active:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
            aria-label="Stop recording"
          >
            <Square className="h-6 w-6" fill="currentColor" />
          </button>
          <p className="text-sm text-text-muted">Recording…</p>
        </div>
      )}

      {state === "stopped" && audioUrl && (
        <div className="space-y-4">
          <audio
            ref={audioElRef}
            src={audioUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />

          <div className="flex items-center gap-4 rounded-lg border border-graphite-700 bg-graphite-850 p-4">
            <button
              type="button"
              onClick={togglePlayback}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-amber-400 active:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-850"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5 ml-0.5" fill="currentColor" />}
            </button>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Your recording</p>
              <p className="text-xs font-mono text-text-subtle tabular-nums">{formatTime(elapsedSeconds)} long</p>
            </div>
          </div>

          {/* Stays an <a> - a real object URL, so it can be middle-clicked
              and opened in a new tab. Borrows the Button's styles rather
              than repeating them. */}
          <a
            href={audioUrl}
            download={downloadFilename}
            className={buttonStyles({ size: "lg", className: "w-full" })}
          >
            <Download />
            Download recording
          </a>

          <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
            <RotateCcw />
            Record another
          </Button>

          <p className="text-xs text-text-subtle text-center">
            Your recording stays in your browser and is never uploaded anywhere.
          </p>
        </div>
      )}
    </div>
  );
}