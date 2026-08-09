"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link2, AlertTriangle, ClipboardPaste, X, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { validateYouTubeUrl, sanitizeUserInput } from "@/lib/utils/validation";
import { getJobStatus, ApiError, type JobSubmitResponse } from "@/lib/api/railway";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

export interface ProcessingStage {
  at: number;
  label: string;
}

const DEFAULT_MAX_POLL_MS = 10 * 60 * 1000;

function extractVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

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

function humanizeError(raw: string): { title: string; hint: string } {
  const text = raw.toLowerCase();

  if (text.includes("private") || text.includes("unavailable") || text.includes("restricted")) {
    return {
      title: "This video can't be accessed",
      hint: "It may be private, age-restricted, or blocked in this region. Try another link.",
    };
  }
  if (text.includes("too long") || text.includes("duration") || text.includes("length")) {
    return {
      title: "This video is too long",
      hint: "Shorter tracks process reliably. Try a single song rather than a full set or mix.",
    };
  }
  if (text.includes("expired")) {
    return {
      title: "This job expired",
      hint: "Results are held for a limited time. Paste the link again to re-run it.",
    };
  }
  if (text.includes("network") || text.includes("timeout") || text.includes("connection")) {
    return {
      title: "The connection dropped",
      hint: "Check your internet and run it again.",
    };
  }
  return { title: raw, hint: "Run it again. If it keeps failing, the video may not be supported." };
}

interface YouTubeUrlFormProps {
  endpoint: string;
  onSubmit: (url: string) => Promise<JobSubmitResponse>;
  pollIntervalMs?: number;
  submitLabel: string;
  processingLabel: string;
  expectedRange?: string;
  rateLimitMessage?: string;
  toolLabel?: string;
  toolMeta?: string;
  stages?: ProcessingStage[];
  maxPollMs?: number;
  renderControls?: (disabled: boolean) => ReactNode;
  /** Fires once when the job completes successfully — side-effect-only
   * (notifications, analytics), same intent as MultiOutputToolForm's
   * onComplete. Not called on every render. */
  onComplete?: (title: string | null) => void;
  /** Fires once when the job fails, expires, or the poll gives up. */
  onFailed?: (message: string) => void;
  renderComplete: (jobId: string, title: string | null) => ReactNode;
}

export function YouTubeUrlForm({
  endpoint,
  onSubmit,
  pollIntervalMs = 4000,
  submitLabel,
  processingLabel,
  expectedRange,
  rateLimitMessage,
  toolLabel,
  toolMeta,
  stages,
  maxPollMs = DEFAULT_MAX_POLL_MS,
  renderControls,
  onComplete,
  onFailed,
  renderComplete,
}: YouTubeUrlFormProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; title: string | null; author: string | null } | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const videoId = useMemo(() => extractVideoId(url.trim()), [url]);
  const canSubmit = Boolean(videoId) && !validationError && !isBusy && cooldownSeconds === 0;

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

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError(null);
      setPreview(null);
      return;
    }

    const timer = setTimeout(() => {
      const check = validateYouTubeUrl(trimmed);
      const id = extractVideoId(trimmed);

      if (!check.isValid || !id) {
        setValidationError(check.error || "That doesn't look like a YouTube link");
        setPreview(null);
        return;
      }

      setValidationError(null);
      setThumbFailed(false);
      setPreview((prev) => (prev?.id === id ? prev : { id, title: null, author: null }));

      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setPreview((prev) =>
            prev?.id === id ? { id, title: data.title ?? null, author: data.author_name ?? null } : prev
          );
        })
        .catch(() => {});
    }, 400);

    return () => clearTimeout(timer);
  }, [url]);

  const poll = useCallback(
    async (id: string) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > maxPollMs) {
        stopPolling();
        setError({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Paste the link again to start a fresh run.",
        });
        setStatus("failed");
        onFailed?.("This is taking unusually long");
        return;
      }

      try {
        const result = await getJobStatus(endpoint, id);
        if (cancelledRef.current) return;

        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setStatus("complete");
          onComplete?.(result.title);
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

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(sanitizeUserInput(e.target.value, 500));
    if (isFailed) {
      setStatus("idle");
      setError(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setUrl(sanitizeUserInput(text, 500));
    } catch {
      // Clipboard blocked — the field is still there to type into.
    }
    inputRef.current?.focus();
  };

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    setUrl("");
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setRetryNotice(null);
    setPreview(null);
    setElapsedSeconds(0);
    inputRef.current?.focus();
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
    const trimmedUrl = url.trim();
    const urlValidation = validateYouTubeUrl(trimmedUrl);
    if (!urlValidation.isValid) {
      setValidationError(urlValidation.error || "That doesn't look like a YouTube link");
      return;
    }

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    setRetryNotice(null);
    cancelledRef.current = false;

    let attempt = 0;
    const maxRetries = 1;

    while (true) {
      try {
        const { job_id } = await onSubmit(urlValidation.normalizedUrl || trimmedUrl);
        if (cancelledRef.current) return;
        setRetryNotice(null);
        setJobId(job_id);
        setStatus("processing");
        startPolling(job_id);
        return;
      } catch (err) {
        if (cancelledRef.current) return;

        if (attempt < maxRetries && isRetryableSubmitError(err)) {
          attempt += 1;
          setRetryNotice(`Server was busy — retrying (${attempt}/${maxRetries})`);
          await sleep(1500 * attempt);
          if (cancelledRef.current) return;
          continue;
        }

        console.error(`${endpoint} submit error:`, err);
        setRetryNotice(null);

        if (err instanceof ApiError && err.isRateLimit) {
          setError({
            title: "You've hit this tool's limit",
            hint: rateLimitMessage || "Wait for the timer, then run it again.",
          });
          setCooldownSeconds(err.retryAfterSeconds ?? 600);
        } else {
          setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
        }
        setStatus("error");
        return;
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const stageLabel = (() => {
    if (status === "uploading") return retryNotice || "Sending the link to the server";
    if (!stages?.length) return processingLabel;
    let label = stages[0].label;
    for (const stage of stages) if (elapsedSeconds >= stage.at) label = stage.label;
    return label;
  })();

  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 20)) * 100));

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              isBusy ? "bg-amber-500 animate-pulse motion-reduce:animate-none" : "bg-amber-500"
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
          <div className="space-y-2">
            <label htmlFor="youtube-url" className="text-sm font-medium text-text-primary">
              Paste a YouTube link
            </label>

            <div className="relative flex items-center">
              <Link2
                className={cn(
                  "pointer-events-none absolute left-4 h-4 w-4 transition-colors",
                  videoId ? "text-amber-500" : "text-text-subtle"
                )}
                aria-hidden
              />
              <input
                ref={inputRef}
                id="youtube-url"
                type="url"
                value={url}
                onChange={handleUrlChange}
                onKeyDown={handleKeyDown}
                placeholder="https://youtube.com/watch?v=..."
                disabled={isBusy}
                autoComplete="off"
                spellCheck={false}
                maxLength={500}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? "url-error" : "url-hint"}
                className={cn(
                  "w-full rounded-lg border bg-graphite-850 py-3.5 pl-11 pr-24 text-text-primary",
                  "placeholder:text-text-subtle transition-colors",
                  "focus:outline-none focus:ring-2 disabled:opacity-50",
                  validationError
                    ? "border-red-500/60 focus:ring-red-500/25"
                    : videoId
                      ? "border-amber-500/40 focus:ring-amber-500/20"
                      : "border-graphite-700 focus:border-amber-500/50 focus:ring-amber-500/20"
                )}
              />

              <div className="absolute right-2.5 flex items-center gap-1">
                {url && !isBusy && (
                  <button
                    type="button"
                    onClick={handleReset}
                    aria-label="Clear link"
                    className="rounded-md p-1.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {!url && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Paste
                  </button>
                )}
              </div>
            </div>

            {validationError ? (
              <p id="url-error" role="alert" className="flex items-center gap-1.5 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {validationError}
              </p>
            ) : (
              <p id="url-hint" className="text-xs text-text-subtle">
                Works with watch links, youtu.be, and Shorts
              </p>
            )}
          </div>
        )}

        {status !== "complete" && renderControls && renderControls(isBusy)}

        {preview && !isBusy && status !== "complete" && (
          <div className="flex items-center gap-4 rounded-lg border border-graphite-800 bg-graphite-850/60 p-3">
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-graphite-800">
              {!thumbFailed && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://i.ytimg.com/vi/${preview.id}/mqdefault.jpg`}
                  alt=""
                  loading="lazy"
                  onError={() => setThumbFailed(true)}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {preview.title || "Track ready"}
              </p>
              <p className="mt-0.5 truncate text-xs text-text-muted">{preview.author || preview.id}</p>
            </div>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
          </div>
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

            <p className="text-xs text-text-subtle">
              {expectedRange ? `Typically ${expectedRange}. ` : ""}Keep this tab open.
            </p>
          </div>
        )}

        {status === "complete" && jobId && (
          <div className="space-y-4" role="status" aria-live="polite">
            {preview && (
              <div className="flex items-center gap-3 border-b border-graphite-800 pb-4">
                {!thumbFailed && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`https://i.ytimg.com/vi/${preview.id}/mqdefault.jpg`}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {resultTitle || preview.title || "Analysis complete"}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
                    Finished in {formatElapsed(elapsedSeconds)}
                  </p>
                </div>
              </div>
            )}

            {renderComplete(jobId, resultTitle)}

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Process another link
            </Button>
          </div>
        )}

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

        {status !== "complete" && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={isBusy}
          >
            {!isBusy && <Link2 className="h-5 w-5" />}
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