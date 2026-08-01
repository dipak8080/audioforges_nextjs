"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  AlertTriangle,
  Copy,
  Check,
  FileText,
  Captions,
  Play,
  Pause,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile } from "@/lib/utils/validation";
import {
  submitJob,
  getJobStatus,
  getTranscriptResult,
  ApiError,
  type TranscriptResult,
} from "@/lib/api/railway";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

const POLL_INTERVAL_MS = 4000; // slowest tool on the site — CPU-bound, one at a time
const MAX_POLL_MS = 15 * 60 * 1000;

const STAGES = [
  { at: 0, label: "Uploading your file" },
  { at: 5, label: "Loading the speech model" },
  { at: 12, label: "Transcribing — runs on CPU, one file at a time" },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatClockShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

function buildSrt(transcript: TranscriptResult): string {
  return transcript.segments
    .map((seg, i) => `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text.trim()}\n`)
    .join("\n");
}

function buildVtt(transcript: TranscriptResult): string {
  const body = transcript.segments
    .map((seg) => `${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n${seg.text.trim()}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function humanizeError(raw: string): { title: string; hint: string } {
  const text = raw.toLowerCase();
  if (text.includes("no speech") || text.includes("silence")) {
    return { title: "No speech detected", hint: "Check the file has audible speech and try again." };
  }
  if (text.includes("too long") || text.includes("duration")) {
    return { title: "This file is too long", hint: "Try a shorter clip, or split it first." };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Upload the file again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout")) {
    return { title: "The connection dropped", hint: "Check your internet and try again." };
  }
  return { title: raw, hint: "Try again. If it keeps failing, try a different file." };
}

/* ------------------------------------------------------------------ */
/* Synced audio + transcript                                           */
/* ------------------------------------------------------------------ */

function SyncedTranscript({ file, transcript }: { file: File; transcript: TranscriptResult }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [query, setQuery] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  // The original file is still in memory — no need to fetch anything
  // back from the server just to hear what was transcribed.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (audioRef.current) audioRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const activeIndex = useMemo(() => {
    return transcript.segments.findIndex((seg) => currentTime >= seg.start && currentTime < seg.end);
  }, [transcript.segments, currentTime]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
    audio.play().catch(() => {});
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play().catch(() => {});
  };

  const filteredSegments = query.trim()
    ? transcript.segments.filter((seg) => seg.text.toLowerCase().includes(query.trim().toLowerCase()))
    : transcript.segments;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Compact transport bar */}
      <div className="flex items-center gap-3 rounded-lg border border-graphite-700 bg-graphite-850 p-3">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
        </button>
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">{formatClockShort(currentTime)}</span>
        <div
          className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-graphite-700"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const fraction = (e.clientX - rect.left) / rect.width;
            seekTo(fraction * duration);
          }}
        >
          <div className="h-full rounded-full bg-amber-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">{formatClockShort(duration)}</span>
      </div>

      {/* Search within transcript */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the transcript…"
          className="w-full rounded-md border border-graphite-700 bg-graphite-850 py-2 pl-9 pr-8 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Segment list — click any line to jump playback there */}
      <div className="max-h-80 space-y-0.5 overflow-y-auto rounded-lg border border-graphite-700 bg-graphite-850 p-2">
        {filteredSegments.length === 0 ? (
          <p className="p-3 text-sm text-text-subtle">No matches for &quot;{query}&quot;.</p>
        ) : (
          filteredSegments.map((seg, i) => {
            const realIndex = transcript.segments.indexOf(seg);
            const active = realIndex === activeIndex;
            return (
              <button
                key={i}
                ref={active ? activeRowRef : undefined}
                type="button"
                onClick={() => seekTo(seg.start)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                  active ? "bg-amber-500/10" : "hover:bg-graphite-800/60"
                )}
              >
                <span className={cn("shrink-0 pt-0.5 font-mono text-[11px] tabular-nums", active ? "text-amber-400" : "text-text-subtle")}>
                  {formatClockShort(seg.start)}
                </span>
                <span className={cn("text-sm leading-relaxed", active ? "text-text-primary" : "text-text-muted")}>
                  {seg.text.trim()}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function SpeechToTextForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const canSubmit = Boolean(file) && !isBusy && status !== "complete" && cooldownSeconds === 0;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!isBusy) return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isBusy]);

  const poll = useCallback(
    async (jobId: string) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > MAX_POLL_MS) {
        stopPolling();
        setError({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start a fresh run.",
        });
        setStatus("failed");
        return;
      }

      try {
        const result = await getJobStatus("speech-to-text", jobId);
        if (cancelledRef.current) return;

        if (result.status === "complete") {
          stopPolling();
          try {
            const fullTranscript = await getTranscriptResult(jobId);
            if (cancelledRef.current) return;
            setTranscript(fullTranscript);
            setStatus("complete");
          } catch {
            setError({ title: "Transcript couldn't be retrieved", hint: "The job finished — try again." });
            setStatus("error");
          }
          return;
        }
        if (result.status === "failed") {
          stopPolling();
          setError(humanizeError(result.error || "We couldn't detect any speech in this file."));
          setStatus("failed");
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        if (err instanceof ApiError && err.status === 404) {
          stopPolling();
          setError(humanizeError("This job expired."));
          setStatus("failed");
          return;
        }
      }

      pollRef.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      poll(jobId);
    },
    [poll, stopPolling]
  );

  const handleFileSelect = (selectedFile: File) => {
    setValidationError(null);
    const validation = validateAudioFile(selectedFile);
    if (!validation.isValid) {
      setValidationError(validation.error || "That file can't be used here");
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
    setError(null);
    setTranscript(null);
    setCopied(false);
  };

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    setFile(null);
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setTranscript(null);
    setCopied(false);
    setElapsedSeconds(0);
  };

  const handleSubmit = async () => {
    if (!file) return;

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    cancelledRef.current = false;

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { job_id } = await submitJob("speech-to-text", formData, 30_000);
      if (cancelledRef.current) return;
      setStatus("processing");
      startPolling(job_id);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("Transcription submit error:", err);
      if (err instanceof ApiError && err.isRateLimit) {
        setError({
          title: "You've reached the limit",
          hint: "2 transcriptions per 5 minutes — wait for the timer.",
        });
        setCooldownSeconds(err.retryAfterSeconds ?? 300);
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the text is on screen to select manually.
    }
  };

  const stageLabel = (() => {
    let label = STAGES[0].label;
    for (const stage of STAGES) if (elapsedSeconds >= stage.at) label = stage.label;
    return label;
  })();
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 40)) * 100));

  const formatCooldown = (seconds: number) => (seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`);

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-1.5 w-1.5 rounded-full bg-amber-500", isBusy && "animate-pulse motion-reduce:animate-none")} aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">Speech to text</span>
        </div>
        <span className="font-mono text-[11px] text-text-subtle">
          {transcript ? `${transcript.language.toUpperCase()} · ${Math.round(transcript.language_probability * 100)}%` : "CPU · slowest tool"}
        </span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {status !== "complete" && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff"
          />
        )}

        {validationError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <span className="text-sm text-text-primary">{validationError}</span>
          </div>
        )}

        {isBusy && (
          <div className="space-y-3 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4" role="status" aria-live="polite" aria-busy="true">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-primary">{stageLabel}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">{formatElapsed(elapsedSeconds)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
              <div className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <div className="opacity-60 motion-reduce:hidden">
              <Waveform />
            </div>
            <p className="text-xs text-text-subtle">
              This can take a few minutes for longer files. Keep this tab open.
            </p>
          </div>
        )}

        {status === "complete" && transcript && file && (
          <div className="space-y-4" role="status" aria-live="polite">
            <SyncedTranscript file={file} transcript={transcript} />

            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="md" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="md" onClick={() => downloadTextFile("transcript.txt", transcript.text, "text/plain")}>
                <FileText className="h-4 w-4" />
                .txt
              </Button>
              <Button variant="outline" size="md" onClick={() => downloadTextFile("transcript.srt", buildSrt(transcript), "text/plain")}>
                <Captions className="h-4 w-4" />
                .srt
              </Button>
              <Button variant="outline" size="md" onClick={() => downloadTextFile("transcript.vtt", buildVtt(transcript), "text/vtt")}>
                <Captions className="h-4 w-4" />
                .vtt
              </Button>
            </div>

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Transcribe another file
            </Button>
          </div>
        )}

        {isFailed && error && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-text-primary">{error.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{error.hint}</p>
              </div>
            </div>
            <SupportBlock />
          </div>
        )}

        {status !== "complete" && (
          <>
            <Button variant="primary" size="lg" className="w-full" onClick={handleSubmit} disabled={!canSubmit} loading={isBusy}>
              {!isBusy && <Mic className="h-5 w-5" />}
              {isBusy ? "Working" : cooldownSeconds > 0 ? `Try again in ${formatCooldown(cooldownSeconds)}` : isFailed ? "Try again" : "Transcribe"}
            </Button>
            <p className="text-center text-xs text-text-subtle">
              Limited to 2 transcriptions per 5 minutes — only one runs at a time.
            </p>
          </>
        )}
      </div>
    </div>
  );
}