"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download,
  AlertTriangle,
  Wand2,
  Mic2,
  Drum,
  Guitar,
  Music2,
  Music4,
  ListMusic,
  AudioLines,
  Play,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { validateAudioFile } from "@/lib/utils/validation";
import {
  getMultiOutputStatus,
  getMultiOutputPreviewUrl,
  getMultiOutputDownloadUrl,
  ApiError,
  type JobSubmitResponse,
} from "@/lib/api/railway";
import { cn } from "@/lib/utils/cn";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

/** A stage label that appears once `at` seconds have elapsed. */
export interface ProcessingStage {
  at: number;
  label: string;
}

const DEFAULT_MAX_POLL_MS = 12 * 60 * 1000;

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

function isRetryableSubmitError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.isTimeout || error.isServerBusy || error.status === 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Errors say what happened and what to do about it. */
function humanizeError(raw: string): { title: string; hint: string } {
  const text = raw.toLowerCase();

  if (text.includes("too large") || text.includes("size")) {
    return { title: "This file is too large", hint: "Trim it down or export at a smaller size." };
  }
  if (text.includes("format") || text.includes("codec") || text.includes("unsupported")) {
    return { title: "This file format isn't supported", hint: "Convert it to WAV or MP3 first, then try again." };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Upload the file again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout") || text.includes("connection")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return { title: raw, hint: "Run it again. If it keeps failing, try a different file." };
}

// Default tab label for a raw output name. Handles the two shapes the
// backend actually produces: plain stem names ("vocals" -> "Vocals") and
// silence-split's zero-padded segment names ("segment_01" -> "Segment 1").
// A caller with a genuinely different naming scheme can override this via
// the `formatOutputName` prop rather than this file needing to know about
// every future naming convention.
function defaultFormatOutputName(name: string): string {
  const segmentMatch = name.match(/^segment_(\d+)$/i);
  if (segmentMatch) return `Segment ${parseInt(segmentMatch[1], 10)}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Default icon per known output name, purely decorative — falls back to a
// generic waveform glyph for anything unrecognized (future stem types,
// custom names) rather than needing this file updated for every new one.
function defaultOutputIcon(name: string): ReactNode {
  const key = name.toLowerCase();
  if (key === "vocals") return <Mic2 className="h-4 w-4" />;
  if (key === "drums") return <Drum className="h-4 w-4" />;
  if (key === "bass" || key === "guitar") return <Guitar className="h-4 w-4" />;
  if (key === "piano") return <Music4 className="h-4 w-4" />;
  if (key === "other") return <Music2 className="h-4 w-4" />;
  if (/^segment_\d+$/i.test(key)) return <ListMusic className="h-4 w-4" />;
  return <AudioLines className="h-4 w-4" />;
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface MultiOutputToolFormProps {
  /**
   * Backend route segment used for status/preview/download — e.g. "stems",
   * "silence-split", "youtube/stems". NOT necessarily the same route the
   * file was submitted to: /stems and /stems-hq both use endpoint="stems"
   * here, since the backend stores both under the same job_type and the
   * same status/preview/download routes serve either tier.
   */
  endpoint: string;
  /** Query param name the backend's preview/download routes expect for
   * this tool: "stem" for /stems and /youtube/stems, "segment" for
   * /silence-split. */
  queryParam?: "stem" | "segment";
  fileAccept?: string;
  pollIntervalMs?: number;
  submitLabel: string;
  processingLabel: string;
  expectedRange?: string;
  resultVerb: string;
  /** Eyebrow text in the card header. Falls back to submitLabel. */
  toolLabel?: string;
  /** Mono spec text on the right of the header. */
  toolMeta?: string;
  /** Stage labels shown while the job runs, keyed to elapsed seconds.
   * Leaving this unset falls back to a single static processingLabel —
   * worth setting for anything slower than ~15s, which is most of
   * what uses this form. */
  stages?: ProcessingStage[];
  /** Give up polling after this long rather than spinning forever. */
  maxPollMs?: number;
  /** Fires once, when the job finishes successfully — after outputs are
   * set but in the same tick as the status flip to "complete". Intended
   * for side effects (browser notifications, analytics) that shouldn't
   * block or alter the render; not called on every render. */
  onComplete?: (outputs: string[], title: string | null) => void;
  /** Fires once, when the job fails or expires — receives the
   * human-readable error message shown in the UI. Same side-effect-only
   * intent as onComplete. */
  onFailed?: (message: string) => void;
  /**
   * Actually submits the job. Takes just the file — any extra fields
   * (quality tier, target format, silence threshold, etc.) are the
   * CALLER's concern, closed over in this function, so this component
   * never needs to know what a given tool's extra parameters are.
   */
  onSubmit: (file: File) => Promise<JobSubmitResponse>;
  /** Optional controls rendered above the submit button — e.g. a
   * Standard/HQ toggle for stems, or format+threshold fields for
   * silence-split. Receives current file + disabled state, same as
   * JobToolForm's renderControls. */
  renderControls?: (file: File | null, disabled: boolean) => ReactNode;
  /** Rate-limit message shown on a 429 — differs per tool/tier, so it's a
   * prop rather than a hardcoded string. */
  rateLimitMessage?: string;
  /** Overrides the default tab-label formatting for output names. */
  formatOutputName?: (name: string) => string;
  /** Overrides the default per-row icon for a given output name. */
  getOutputIcon?: (name: string) => ReactNode;
  maxSubmitRetries?: number;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function MultiOutputToolForm({
  endpoint,
  queryParam = "stem",
  fileAccept = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff",
  pollIntervalMs = 12_000,
  submitLabel,
  processingLabel,
  expectedRange,
  resultVerb,
  toolLabel,
  toolMeta,
  stages,
  maxPollMs = DEFAULT_MAX_POLL_MS,
  onComplete,
  onFailed,
  onSubmit,
  renderControls,
  rateLimitMessage,
  formatOutputName = defaultFormatOutputName,
  getOutputIcon = defaultOutputIcon,
  maxSubmitRetries = 1,
}: MultiOutputToolFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [activeOutput, setActiveOutput] = useState<string | null>(null);
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

  /* --- polling: recursive timeout, so slow responses never stack --- */
  const poll = useCallback(
    async (id: string) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > maxPollMs) {
        stopPolling();
        const humanized = {
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start a fresh run.",
        };
        setError(humanized);
        setStatus("failed");
        onFailed?.(humanized.title);
        return;
      }

      try {
        const result = await getMultiOutputStatus(endpoint, id);
        if (cancelledRef.current) return;

        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setOutputs(result.outputs);
          setActiveOutput(result.outputs[0] ?? null);
          setStatus("complete");
          onComplete?.(result.outputs, result.title);
          return;
        }
        if (result.status === "failed") {
          stopPolling();
          const humanized = humanizeError(result.error || "Processing failed.");
          setError(humanized);
          setStatus("failed");
          onFailed?.(humanized.title);
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        if (err instanceof ApiError && err.status === 404) {
          stopPolling();
          const humanized = humanizeError("This job expired.");
          setError(humanized);
          setStatus("failed");
          onFailed?.(humanized.title);
          return;
        }
        // Transient network blips fall through to the next tick.
      }

      pollRef.current = setTimeout(() => poll(id), pollIntervalMs);
    },
    [endpoint, maxPollMs, pollIntervalMs, stopPolling, onComplete, onFailed]
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      poll(id);
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
    setJobId(null);
    setResultTitle(null);
    setOutputs([]);
    setActiveOutput(null);
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
    setOutputs([]);
    setActiveOutput(null);
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

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    setRetryNotice(null);
    cancelledRef.current = false;

    let attempt = 0;

    while (true) {
      try {
        const { job_id } = await onSubmit(file);
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
            hint: rateLimitMessage || "Wait for the timer, then run it again.",
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

  const stageLabel = (() => {
    if (status === "uploading") return retryNotice || "Uploading your file";
    if (!stages?.length) return processingLabel;
    let label = stages[0].label;
    for (const stage of stages) if (elapsedSeconds >= stage.at) label = stage.label;
    return label;
  })();

  // Eases toward 92%; separation jobs are slow enough that a longer time
  // constant keeps the curve from looking stuck near the end.
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 25)) * 100));

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
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
        {status !== "complete" && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept={fileAccept}
          />
        )}

        {validationError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <span className="text-sm text-text-primary">{validationError}</span>
          </div>
        )}

        {status !== "complete" && renderControls && <div>{renderControls(file, isBusy)}</div>}

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

        {status === "complete" && jobId && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">{resultVerb}</p>
              <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
                {resultTitle || `${outputs.length} outputs ready`}
              </p>
            </div>

            {/*
              Track-list layout, not tabs: every output is visible as its own
              row (icon, name, independent download button) rather than
              hidden behind a pill switcher. Scales from 4 stems to 50
              silence-split segments without the list becoming unusable —
              the container caps height and scrolls once it's tall enough
              to need it, rather than pushing the whole page down.

              Only ONE <audio> element exists at a time (inside AudioPlayer
              below, bound to activeOutput) regardless of how many rows are
              listed — clicking a row swaps its src rather than mounting a
              new player per output.
            */}
            {outputs.length > 0 && (
              <div className="max-h-72 divide-y divide-graphite-800 overflow-y-auto rounded-lg border border-graphite-700">
                {outputs.map((name) => {
                  const isActive = activeOutput === name;
                  return (
                    <div
                      key={name}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 transition-colors",
                        isActive ? "bg-amber-500/[0.06]" : "hover:bg-graphite-850/60"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveOutput(name)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus:outline-none"
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                            isActive ? "bg-amber-500 text-graphite-950" : "bg-graphite-800 text-text-muted"
                          )}
                        >
                          {isActive ? <Play className="h-3.5 w-3.5" fill="currentColor" /> : getOutputIcon(name)}
                        </span>
                        <span
                          className={cn(
                            "truncate text-sm font-medium",
                            isActive ? "text-amber-400" : "text-text-primary"
                          )}
                        >
                          {formatOutputName(name)}
                        </span>
                      </button>

                      <a
                        href={getMultiOutputDownloadUrl(endpoint, jobId, name, queryParam)}
                        download
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Download ${formatOutputName(name)}`}
                        className="shrink-0 rounded-lg p-2 text-text-muted transition-colors hover:bg-graphite-800 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            {activeOutput && (
              <AudioPlayer key={activeOutput} src={getMultiOutputPreviewUrl(endpoint, jobId, activeOutput, queryParam)} />
            )}

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Process another file
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