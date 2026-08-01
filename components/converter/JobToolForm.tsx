"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, AlertTriangle, Wand2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile } from "@/lib/utils/validation";
import type { FileValidationResult } from "@/lib/types/converter";
import {
  submitJob,
  getJobStatus,
  getJobPreviewUrl,
  getJobDownloadUrl,
  ApiError,
} from "@/lib/api/railway";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

/** A stage label that appears once `at` seconds have elapsed. */
export interface ProcessingStage {
  at: number;
  label: string;
}

const DEFAULT_MAX_POLL_MS = 10 * 60 * 1000;

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

function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

/**
 * The `downloadFilename` prop is documented as an extension override
 * ("wav"), but a bare `download="wav"` makes the browser save the file
 * as a file literally named `wav` with no extension. If it looks like a
 * bare extension, rebuild a real filename from the source file.
 */
function resolveDownloadName(
  override: string | undefined,
  sourceName: string | null
): string | undefined {
  if (!override) return undefined;
  if (override.includes(".")) return override;
  if (!sourceName) return `audio.${override}`;
  return `${baseName(sourceName)}.${override}`;
}

function isRetryableSubmitError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.isTimeout) return true;
  if (error.isServerBusy) return true;
  // status 0 = fetch itself failed (network blip / DNS hiccup)
  if (error.status === 0) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Errors say what happened and what to do about it. */
function humanizeError(raw: string): { title: string; hint: string } {
  const text = raw.toLowerCase();

  if (text.includes("too large") || text.includes("size") || text.includes("413")) {
    return {
      title: "This file is too large",
      hint: "Trim it down or export at a smaller size, then upload again.",
    };
  }
  if (text.includes("format") || text.includes("codec") || text.includes("unsupported")) {
    return {
      title: "This file format isn't supported",
      hint: "Convert it to WAV or MP3 first, then run this tool.",
    };
  }
  if (text.includes("corrupt") || text.includes("decode")) {
    return {
      title: "The file couldn't be read",
      hint: "It may be corrupted or only partly downloaded. Try re-exporting it.",
    };
  }
  if (text.includes("expired")) {
    return {
      title: "This job expired",
      hint: "Results are held for a limited time. Upload the file again to re-run it.",
    };
  }
  if (text.includes("network") || text.includes("timeout") || text.includes("connection")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return { title: raw, hint: "Run it again. If it keeps failing, try a different file." };
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface JobToolFormProps {
  /** Backend route segment, e.g. "convert", "trim", "volume" */
  endpoint: string;
  /** Accept string for the file input, e.g. "audio/*,.mp3,.wav" */
  fileAccept?: string;
  /**
   * Overrides the hint text shown under the upload prompt (defaults to
   * FileDropZone's own audio-format hint). Needed by tools whose input
   * isn't audio - currently only video-to-audio, which uploads video
   * files and has a different size cap.
   */
  fileHint?: string;
  /**
   * Overrides the file validator run on selection. Defaults to
   * validateAudioFile so every existing tool (which uploads audio) is
   * unaffected. video-to-audio passes a video-specific validator here -
   * without this override, ANY tool built on JobToolForm would reject
   * non-audio files with an audio-specific error message regardless of
   * what fileAccept was set to, since fileAccept only affects the file
   * picker dialog's filter, not the actual validation logic that runs
   * after a file is selected (including drag-and-drop, which ignores
   * `accept` entirely).
   */
  validateFile?: (file: File) => FileValidationResult;
  /** How often to poll status, ms. Convert/trim/etc are fast (~2.5s); separation is slow (12s). */
  pollIntervalMs?: number;
  /**
   * Timeout for the INITIAL submit request (upload + job creation), ms.
   * This is not how long the job takes to process — that's handled by polling.
   * This only covers the time for the server to accept the file and hand back a job_id.
   * Default raised to 60s to absorb cold-starts / semaphore queue waits under load.
   * Pass a higher value (e.g. 120_000–180_000) for heavier endpoints like speech-to-text
   * or video-to-audio, where large uploads + a busy semaphore can push past 60s even
   * before real processing starts.
   */
  submitTimeoutMs?: number;
  /** Button label when idle, e.g. "Convert" */
  submitLabel: string;
  /** Label while processing, e.g. "Converting" */
  processingLabel: string;
  /** e.g. "a few seconds" */
  expectedRange?: string;
  /** e.g. "Converted" -> "Converted — filename.wav" */
  resultVerb: string;
  /** Eyebrow text in the card header. Falls back to the submit label. */
  toolLabel?: string;
  /** Mono spec text on the right of the header, e.g. "lossless · 44.1 kHz". */
  toolMeta?: string;
  /**
   * Stage labels shown while the job runs, keyed to elapsed seconds.
   * Describe what the backend is actually doing — leaving this unset
   * falls back to a single static processingLabel.
   */
  stages?: ProcessingStage[];
  /** Give up polling after this long rather than spinning forever. */
  maxPollMs?: number;
  /**
   * Optional extra controls rendered above the submit button (e.g. a
   * target-format select for /convert, a start/end input for /trim). Receives current file + disabled state.
   */
  renderControls?: (file: File | null, disabled: boolean) => ReactNode;
  /**
   * Builds the extra (non-file) form fields to send with the job. Return null to block
   * submission (e.g. required control not filled in yet) — an error message will show instead.
   */
  buildExtraFields?: (file: File) => Record<string, string> | null;
  /** Message shown if buildExtraFields returns null */
  missingFieldsMessage?: string;
  /** Suggested download filename or extension, e.g. "wav" — falls back to backend's header if omitted */
  downloadFilename?: string;
  /**
   * Max number of times to retry the initial submit if it fails due to a timeout
   * or a transient server-busy signal (503 / network error). Does NOT retry on
   * validation errors (400), rate limits (429), or other client-side rejections —
   * only on conditions that indicate the server was too slow/busy to respond, since
   * retrying a genuinely invalid request would just fail again immediately.
   */
  maxSubmitRetries?: number;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function JobToolForm({
  endpoint,
  fileAccept = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff",
  fileHint,
  validateFile = validateAudioFile,
  pollIntervalMs = 2500,
  submitTimeoutMs = 60_000,
  submitLabel,
  processingLabel,
  expectedRange,
  resultVerb,
  toolLabel,
  toolMeta,
  stages,
  maxPollMs = DEFAULT_MAX_POLL_MS,
  renderControls,
  buildExtraFields,
  missingFieldsMessage = "Choose an option above before running this.",
  downloadFilename,
  maxSubmitRetries = 1,
}: JobToolFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

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

  /* --- cooldown ticker -------------------------------------------- */
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  /* --- elapsed ticker ---------------------------------------------- */
  useEffect(() => {
    if (!isBusy) return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isBusy]);

  /* --- polling: recursive timeout, so slow responses never stack --- */
  const poll = useCallback(
    async (id: string) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > maxPollMs) {
        stopPolling();
        setError({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start a fresh run.",
        });
        setStatus("failed");
        return;
      }

      try {
        const result = await getJobStatus(endpoint, id);
        if (cancelledRef.current) return;

        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setStatus("complete");
          return;
        }
        if (result.status === "failed") {
          stopPolling();
          setError(humanizeError(result.error || "Processing failed."));
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
        // Transient network blips fall through to the next tick.
      }

      pollRef.current = setTimeout(() => poll(id), pollIntervalMs);
    },
    [endpoint, maxPollMs, pollIntervalMs, stopPolling]
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      // Check straight away — fast jobs shouldn't wait a full interval.
      poll(id);
    },
    [poll, stopPolling]
  );

  /* --- handlers ---------------------------------------------------- */

  const handleFileSelect = (selectedFile: File) => {
    setValidationError(null);
    const validation = validateFile(selectedFile);
    if (!validation.isValid) {
      setValidationError(validation.error || "That file can't be used here");
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
  };

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    setFile(null);
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setRetryNotice(null);
    setElapsedSeconds(0);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stopPolling();
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setRetryNotice(null);
    setElapsedSeconds(0);
  };

  const handleSubmit = async () => {
    if (!file) return;

    const extraFields = buildExtraFields ? buildExtraFields(file) : {};
    if (buildExtraFields && extraFields === null) {
      setError({ title: missingFieldsMessage, hint: "Then run it again." });
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    setRetryNotice(null);
    cancelledRef.current = false;

    const formData = new FormData();
    formData.append("file", file);
    for (const [key, value] of Object.entries(extraFields || {})) {
      formData.append(key, value);
    }

    let attempt = 0;

    while (true) {
      try {
        const { job_id } = await submitJob(endpoint, formData, submitTimeoutMs);
        if (cancelledRef.current) return;
        setRetryNotice(null);
        setJobId(job_id);
        setStatus("processing");
        startPolling(job_id);
        return;
      } catch (err) {
        if (cancelledRef.current) return;

        if (attempt < maxSubmitRetries && isRetryableSubmitError(err)) {
          attempt += 1;
          setRetryNotice(`Server was busy — retrying (${attempt}/${maxSubmitRetries})`);
          await sleep(1500 * attempt);
          if (cancelledRef.current) return;
          continue;
        }

        console.error(`${endpoint} submit error:`, err);
        setRetryNotice(null);

        if (err instanceof ApiError && err.isRateLimit) {
          setError({
            title: "You're going a little fast",
            hint: "Wait for the timer, then run it again.",
          });
          setCooldownSeconds(err.retryAfterSeconds ?? 60);
        } else {
          setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
        }
        setStatus("error");
        return;
      }
    }
  };

  /* --- derived display --------------------------------------------- */

  const stageLabel = (() => {
    if (status === "uploading") return retryNotice || "Uploading your file";
    if (!stages?.length) return processingLabel;
    let label = stages[0].label;
    for (const stage of stages) if (elapsedSeconds >= stage.at) label = stage.label;
    return label;
  })();

  // Eases toward 92% and only completes when the job actually does.
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 12)) * 100));

  const downloadName = resolveDownloadName(downloadFilename, file?.name ?? null);

  /* ------------------------------------------------------------------ */

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      {/* Header strip */}
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-amber-500",
              isBusy && "animate-pulse motion-reduce:animate-none"
            )}
            aria-hidden
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            {toolLabel || submitLabel}
          </span>
        </div>
        {toolMeta && <span className="font-mono text-[11px] text-text-subtle">{toolMeta}</span>}
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {/* ---------- File input / selected file ---------- */}
        {status !== "complete" && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept={fileAccept}
            hint={fileHint}
          />
        )}

        {validationError && (
          <div
            className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <span className="text-sm text-text-primary">{validationError}</span>
          </div>
        )}

        {/* ---------- Tool-specific controls ---------- */}
        {status !== "complete" && renderControls && <div>{renderControls(file, isBusy)}</div>}

        {/* ---------- Working ---------- */}
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

            <p className="text-xs text-text-subtle">
              {expectedRange ? `Typically ${expectedRange}. ` : ""}Keep this tab open.
            </p>
          </div>
        )}

        {/* ---------- Complete ---------- */}
        {status === "complete" && jobId && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">{resultVerb}</p>
              <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
                {resultTitle || file?.name || "Your file is ready"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-subtle">
                Finished in {formatElapsed(elapsedSeconds)}
              </p>
            </div>

            <AudioPlayer src={getJobPreviewUrl(endpoint, jobId)} />

            <a
              href={getJobDownloadUrl(endpoint, jobId)}
              download={downloadName || true}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-graphite-950 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <Download className="h-4 w-4" />
              Download
            </a>

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Process another file
            </Button>
          </div>
        )}

        {/* ---------- Failed ---------- */}
        {isFailed && error && (
          <div className="space-y-4">
            <div
              className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-text-primary">{error.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{error.hint}</p>
              </div>
            </div>
            <SupportBlock />
          </div>
        )}

        {/* ---------- Action ---------- */}
        {status !== "complete" && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isBusy}
          >
            {!isBusy && <Wand2 className="h-5 w-5" />}
            {isBusy
              ? "Working"
              : cooldownSeconds > 0
                ? `Try again in ${formatCooldown(cooldownSeconds)}`
                : isFailed
                  ? "Try again"
                  : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}