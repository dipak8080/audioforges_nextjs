"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import {
  Upload,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Download,
  AlertTriangle,
  Layers,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile } from "@/lib/utils/validation";
import {
  submitJob,
  getJobStatus,
  getJobPreviewUrl,
  getJobDownloadUrl,
  ApiError,
} from "@/lib/api/railway";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

// Mirrors the backend's JOIN_MAX_FILES / JOIN_MAX_TOTAL_BYTES - enforced
// here too so a user finds out immediately on adding a file rather than
// after uploading a batch that gets rejected server-side.
const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const MAX_POLL_MS = 10 * 60 * 1000;

interface FormatSpec {
  quality: "Lossless" | "Compressed";
  detail: string;
}

// Same copy as ConvertForm's format specs. Worth centralizing into a
// shared constant if a third tool ends up needing this list too.
const FORMAT_SPECS: Record<string, FormatSpec> = {
  wav: { quality: "Lossless", detail: "Uncompressed" },
  aiff: { quality: "Lossless", detail: "Uncompressed" },
  flac: { quality: "Lossless", detail: "~50% smaller, no loss" },
  mp3: { quality: "Compressed", detail: "320 kbps" },
  m4a: { quality: "Compressed", detail: "AAC container" },
  aac: { quality: "Compressed", detail: "Smaller than MP3" },
  ogg: { quality: "Compressed", detail: "Open format" },
};
const OUTPUT_FORMATS = Object.keys(FORMAT_SPECS);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCooldown(seconds: number): string {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
  return `${seconds}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toUpperCase() : "FILE";
}

function humanizeError(raw: string): { title: string; hint: string } {
  const text = raw.toLowerCase();
  if (text.includes("format") || text.includes("codec")) {
    return { title: "One of these files isn't supported", hint: "Remove it and try joining the rest." };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Add your files again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return { title: raw, hint: "Run it again. If it keeps failing, try removing one file at a time." };
}

/* ------------------------------------------------------------------ */
/* File row — probes its own duration, handles drag reorder            */
/* ------------------------------------------------------------------ */

interface FileRowProps {
  file: File;
  index: number;
  total: number;
  disabled: boolean;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}

function FileRow({
  file,
  index,
  total,
  disabled,
  isDragOver,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onMove,
  onRemove,
}: FileRowProps) {
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let released = false;
    const objectUrl = URL.createObjectURL(file);
    const probe = new Audio();
    const release = () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) setDuration(probe.duration);
      release();
    };
    probe.onerror = release;
    probe.src = objectUrl;
    return () => {
      probe.onloadedmetadata = null;
      probe.onerror = null;
      release();
    };
  }, [file]);

  return (
    <div
      draggable={!disabled}
      onDragStart={(e: ReactDragEvent<HTMLDivElement>) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragEnter={() => onDragEnter(index)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 transition-colors",
        isDragOver && "bg-amber-500/[0.06]"
      )}
    >
      <GripVertical
        className={cn("h-4 w-4 shrink-0", disabled ? "text-text-subtle/40" : "cursor-grab text-text-subtle")}
        aria-hidden
      />
      <span className="w-5 shrink-0 text-center font-mono text-xs text-text-subtle">{index + 1}</span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{file.name}</p>
        <p className="font-mono text-[11px] text-text-subtle">
          {fileExtension(file.name)} · {formatBytes(file.size)}
          {duration !== null ? ` · ${formatElapsed(Math.round(duration))}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={disabled || index === 0}
          aria-label="Move up"
          className="rounded p-1 text-text-muted transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={disabled || index === total - 1}
          aria-label="Move down"
          className="rounded p-1 text-text-muted transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={disabled}
          aria-label="Remove"
          className="rounded p-1 text-text-muted transition-colors hover:bg-graphite-800 hover:text-red-400 disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main form                                                            */
/* ------------------------------------------------------------------ */

export function JoinForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState("mp3");
  const [status, setStatus] = useState<UiState>("idle");
  const [addError, setAddError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isDragOverZone, setIsDragOverZone] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const canSubmit = files.length >= 2 && !isBusy && cooldownSeconds === 0;

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

  /* --- polling: recursive timeout, capped duration ------------------ */
  const poll = useCallback((id: string) => {
    if (cancelledRef.current) return;

    if (Date.now() - pollStartedAtRef.current > MAX_POLL_MS) {
      stopPolling();
      setError({
        title: "This is taking unusually long",
        hint: "The job may be stuck. Add your files again to start a fresh run.",
      });
      setStatus("failed");
      return;
    }

    getJobStatus("join", id)
      .then((result) => {
        if (cancelledRef.current) return;
        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setStatus("complete");
          return;
        }
        if (result.status === "failed") {
          stopPolling();
          setError(humanizeError(result.error || "Joining failed."));
          setStatus("failed");
          return;
        }
        pollRef.current = setTimeout(() => poll(id), 2500);
      })
      .catch((err) => {
        if (cancelledRef.current) return;
        if (err instanceof ApiError && err.status === 404) {
          stopPolling();
          setError(humanizeError("This job expired."));
          setStatus("failed");
          return;
        }
        pollRef.current = setTimeout(() => poll(id), 2500);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPolling]);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      poll(id);
    },
    [poll, stopPolling]
  );

  /* --- adding files --------------------------------------------------
   * A validation failure on one file used to abort the whole batch via
   * `break`, silently discarding every valid file after it in the same
   * drop. Now invalid files are skipped individually (`continue`) and
   * only the count/size caps — which really do apply to everything
   * after them — stop the loop early.
   */
  const addFiles = (incoming: FileList | File[]) => {
    setAddError(null);
    const incomingArray = Array.from(incoming);
    const accepted: File[] = [];
    let runningTotal = totalBytes;
    let runningCount = files.length;
    let lastError: string | null = null;

    for (const file of incomingArray) {
      const validation = validateAudioFile(file);
      if (!validation.isValid) {
        lastError = `'${file.name}': ${validation.error || "invalid file"}`;
        continue;
      }
      if (runningCount + 1 > MAX_FILES) {
        lastError = `You can join up to ${MAX_FILES} files at a time.`;
        break;
      }
      if (runningTotal + file.size > MAX_TOTAL_BYTES) {
        lastError = `Adding '${file.name}' would exceed the ${formatBytes(MAX_TOTAL_BYTES)} combined limit.`;
        break;
      }
      accepted.push(file);
      runningTotal += file.size;
      runningCount += 1;
    }

    if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    if (lastError) setAddError(lastError);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleZoneDrop = (e: ReactDragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsDragOverZone(false);
    if (isBusy) return;
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setAddError(null);
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  /* --- row drag reorder ---------------------------------------------- */
  const handleRowDrop = () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dragOverIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    if (dragIndex === null) return;
    window.addEventListener("drop", handleRowDrop);
    window.addEventListener("dragend", handleRowDrop);
    return () => {
      window.removeEventListener("drop", handleRowDrop);
      window.removeEventListener("dragend", handleRowDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragIndex, dragOverIndex]);

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    setFiles([]);
    setStatus("idle");
    setAddError(null);
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setElapsedSeconds(0);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stopPolling();
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setElapsedSeconds(0);
  };

  const handleSubmit = async () => {
    if (files.length < 2) {
      setError({ title: "Add at least two files to join", hint: "Drop in one more and try again." });
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    cancelledRef.current = false;

    const formData = new FormData();
    // Order matters: output order matches append order, which is
    // exactly the order shown on screen after any reordering.
    for (const file of files) formData.append("files", file);
    formData.append("target_format", format);

    try {
      const { job_id } = await submitJob("join", formData, 60_000);
      if (cancelledRef.current) return;
      setJobId(job_id);
      setStatus("processing");
      startPolling(job_id);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("join submit error:", err);
      if (err instanceof ApiError && err.isRateLimit) {
        setError({
          title: "You've reached the joining limit for now",
          hint: "Wait for the timer, then try again.",
        });
        setCooldownSeconds(err.retryAfterSeconds ?? 60);
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    }
  };

  const stageLabel = (() => {
    if (status === "uploading") return `Uploading ${files.length} files`;
    if (elapsedSeconds < 3) return "Reading each file";
    if (elapsedSeconds < 8) return "Matching sample rates";
    return "Joining into one track";
  })();

  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 10)) * 100));
  const capacityPercent = Math.min(100, Math.round((totalBytes / MAX_TOTAL_BYTES) * 100));

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className={cn("h-1.5 w-1.5 rounded-full bg-amber-500", isBusy && "animate-pulse motion-reduce:animate-none")}
            aria-hidden
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            Audio joiner
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-subtle">
          {files.length}/{MAX_FILES} files · {formatBytes(totalBytes)}
        </span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {status !== "complete" && (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                if (!isBusy) setIsDragOverZone(true);
              }}
              onDragLeave={() => setIsDragOverZone(false)}
              onDrop={handleZoneDrop}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isDragOverZone
                  ? "border-amber-500/60 bg-amber-500/5"
                  : "border-graphite-700 hover:border-graphite-700/80 hover:bg-graphite-850/40"
              )}
            >
              <Upload className={cn("h-6 w-6", isDragOverZone ? "text-amber-500" : "text-text-subtle")} aria-hidden />
              <p className="text-sm text-text-muted">
                {isDragOverZone ? (
                  <span className="text-amber-400">Drop to add</span>
                ) : (
                  <>
                    <span className="text-amber-400">Click to add</span> or drag and drop — select multiple
                  </>
                )}
              </p>
              <p className="text-xs text-text-subtle">
                MP3, WAV, FLAC, M4A, AAC, OGG, AIFF — up to {MAX_FILES} files, {formatBytes(MAX_TOTAL_BYTES)} combined
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff"
                onChange={handleFileInput}
                disabled={isBusy}
                className="hidden"
              />
            </button>

            {addError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
                <span className="text-sm text-text-primary">{addError}</span>
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Drag rows or use the arrows to set the output order</span>
                  <span className="font-mono text-text-subtle">{formatBytes(totalBytes)}</span>
                </div>

                <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      capacityPercent > 90 ? "bg-red-400" : "bg-amber-500"
                    )}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>

                <div className="max-h-72 divide-y divide-graphite-800 overflow-y-auto rounded-lg border border-graphite-700">
                  {files.map((file, index) => (
                    <FileRow
                      key={`${file.name}-${file.size}-${index}`}
                      file={file}
                      index={index}
                      total={files.length}
                      disabled={isBusy}
                      isDragOver={dragOverIndex === index}
                      onDragStart={setDragIndex}
                      onDragEnter={setDragOverIndex}
                      onDragEnd={handleRowDrop}
                      onMove={moveFile}
                      onRemove={removeFile}
                    />
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <fieldset className="space-y-2" disabled={isBusy}>
                <legend className="mb-2 text-sm font-medium text-text-primary">Output format</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Output format">
                  {OUTPUT_FORMATS.map((fmt) => {
                    const spec = FORMAT_SPECS[fmt];
                    const selected = format === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setFormat(fmt)}
                        disabled={isBusy}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-left transition-all",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                          selected
                            ? "border-amber-500/60 bg-amber-500/[0.07]"
                            : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                        )}
                      >
                        <span
                          className={cn(
                            "block font-mono text-xs font-semibold uppercase",
                            selected ? "text-amber-400" : "text-text-primary"
                          )}
                        >
                          {fmt}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-text-subtle">{spec.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </>
        )}

        {isBusy && (
          <div
            className="space-y-3 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-primary">{stageLabel}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="opacity-60 motion-reduce:hidden">
                <Waveform />
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded px-1 text-xs text-text-subtle underline underline-offset-2 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {status === "complete" && jobId && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">Joined</p>
              <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
                {resultTitle || `${files.length} files combined`}
              </p>
            </div>

            <AudioPlayer src={getJobPreviewUrl("join", jobId)} />

            <a
              href={getJobDownloadUrl("join", jobId)}
              download
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-graphite-950 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <Download className="h-4 w-4" />
              Download
            </a>

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Join more files
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
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isBusy}
          >
            {!isBusy && <Layers className="h-5 w-5" />}
            {isBusy
              ? "Working"
              : cooldownSeconds > 0
                ? `Try again in ${formatCooldown(cooldownSeconds)}`
                : isFailed
                  ? "Try again"
                  : "Join files"}
          </Button>
        )}
      </div>
    </div>
  );
}