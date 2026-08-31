"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, Link2, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { UpgradeToHqCard } from "@/components/credits/UpgradeToHqCard";
import { CreditReceipt, StudioQualityTag } from "@/components/credits/CreditReceipt";
import type { SubmitBilling } from "@/lib/types/converter";
import { trackCredits } from "@/lib/analytics";
import type { MeteredToolKey } from "@/lib/types/credits";
import type { UpgradeFamily } from "@/lib/api/credits";
import { cn } from "@/lib/utils/cn";
import { validateYouTubeUrl, sanitizeUserInput } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import { getJobStatus, ApiError, type JobSubmitResponse } from "@/lib/api/railway";
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  ResultHeader,
  Section,
  WorkingPanel,
  easedProgress,
  formatCooldown,
  formatElapsed,
  isRetryableSubmitError,
  serverFailure,
  sleep,
  stageIndexFor,
  terminalPollError,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
  type PollTiming,
  type ProcessingStage,
  type UiState,
} from "@/components/tools/JobFormKit";

export type { ProcessingStage };

const DEFAULT_MAX_POLL_MS = 10 * 60 * 1000;
const STEPS = ["Link", "Run", "Result"] as const;

function extractVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function humanizeError(raw: string): FormError {
  return { title: raw, hint: "Run it again." };
}

interface VideoPreview {
  id: string;
  title: string | null;
  author: string | null;
}

function Thumbnail({ id, className }: { id: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (failed) {
    return <div className={cn("shrink-0 rounded-md bg-graphite-800", className)} aria-hidden />;
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-md object-cover", className)}
    />
  );
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
  progressTau?: number;
  upgradePollIntervalMs?: number;
  upgradeMaxPollMs?: number;
  renderControls?: (disabled: boolean, hasUrl: boolean) => ReactNode;
  onComplete?: (title: string | null) => void;
  onFailed?: (message: string) => void;
  renderComplete: (jobId: string, title: string | null) => ReactNode;
  maxSubmitRetries?: number;
  meteredToolKey?: MeteredToolKey | null;
  upgradeFamily?: UpgradeFamily;
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
  progressTau = 20,
  upgradePollIntervalMs,
  upgradeMaxPollMs,
  renderControls,
  onComplete,
  onFailed,
  renderComplete,
  maxSubmitRetries = 1,
  meteredToolKey = null,
  upgradeFamily,
}: YouTubeUrlFormProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [error, setError] = useState<FormError | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [completedMetered, setCompletedMetered] = useState(false);
  const [billing, setBilling] = useState<SubmitBilling | null>(null);

  const { applyBalance } = useCredits();
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<VideoPreview | null>(null);

  const isBusy = status === "uploading" || status === "processing";
  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isBusy);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  /**
   * STATE, NOT A REF, because CooldownBar renders it. As a ref it only showed
   * the right ceiling because the setCooldownSeconds call on the next line
   * happened to trigger the render that read it.
   */
  const [cooldownCeiling, setCooldownCeiling] = useState(getRetryAfterFallback(endpoint));

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fieldId = useId();
  const inputId = `${fieldId}-url`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailedRef.current = onFailed;
  });

  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });

  const isFailed = status === "failed" || status === "error";
  const videoId = useMemo(() => extractVideoId(url.trim()), [url]);
  const canSubmit = Boolean(videoId) && !validationError && !isBusy && cooldownSeconds === 0;

  const chargedRun = billing?.charged === "credit";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError(null);
      setPreview(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const check = validateYouTubeUrl(trimmed);
      const id = extractVideoId(trimmed);

      if (!check.isValid || !id) {
        setValidationError(check.error || "That doesn't look like a YouTube link");
        setPreview(null);
        return;
      }

      setValidationError(null);
      setPreview((prev) => (prev?.id === id ? prev : { id, title: null, author: null }));

      fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
        { signal: controller.signal }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setPreview((prev) =>
            prev?.id === id ? { id, title: data.title ?? null, author: data.author_name ?? null } : prev
          );
        })
        .catch(() => {});
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  /**
   * The poll loop reschedules itself, which it can't do by naming itself: a
   * value referenced inside its own initializer is something the React
   * Compiler can't reason about. One indirection through a ref — declared
   * BEFORE the callback, assigned in an effect rather than during render —
   * removes the self-reference without changing the polling behaviour.
   */
  const pollFnRef = useRef<(id: string, timing: PollTiming) => void>(() => {});

  const poll = useCallback(
    async (id: string, timing: PollTiming) => {
      if (cancelledRef.current) return;

      const fail = (failure: FormError) => {
        stopPolling();
        setError(failure);
        setStatus("failed");
        onFailedRef.current?.(failure.title);
      };

      if (Date.now() - pollStartedAtRef.current > timing.maxMs) {
        fail({ title: "This is taking unusually long", hint: "The job may be stuck." });
        return;
      }

      try {
        const result = await getJobStatus(endpoint, id);
        if (cancelledRef.current) return;

        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setStatus("complete");
          onCompleteRef.current?.(result.title);
          return;
        }
        if (result.status === "failed") {
          // Verbatim: routes/_shared.py writes these for the user. Our copy is
          // the fallback. See serverFailure in JobFormKit.
          fail(
            serverFailure(result.error, {
              title: "Processing failed",
              hint: "Run it again. If it keeps failing, the video may not be supported.",
            })
          );
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        const terminal = terminalPollError(err);
        if (terminal) {
          fail(terminal);
          return;
        }
      }

      pollRef.current = setTimeout(() => pollFnRef.current(id, timing), timing.intervalMs);
    },
    [endpoint, stopPolling]
  );

  useEffect(() => {
    pollFnRef.current = poll;
  }, [poll]);

  const startPolling = useCallback(
    (id: string, timing: PollTiming) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      void poll(id, timing);
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
    } catch {}
    inputRef.current?.focus();
  };

  const handleUpgraded = useCallback(
    (newJobId: string, upgradeBilling?: SubmitBilling | null) => {
      cancelledRef.current = false;
      setJobId(newJobId);
      setCompletedMetered(true);
      setResultTitle(null);
      setElapsedSeconds(0);
      setError(null);
      if (upgradeBilling !== undefined) {
        setBilling(upgradeBilling);
        if (upgradeBilling) {
          applyBalance(upgradeBilling.balance, upgradeBilling.free_remaining);
        }
      }
      setStatus("processing");
      startPolling(newJobId, {
        intervalMs: upgradePollIntervalMs ?? pollIntervalMs,
        maxMs: upgradeMaxPollMs ?? maxPollMs,
      });
    },
    [startPolling, applyBalance, setElapsedSeconds, upgradePollIntervalMs, pollIntervalMs, upgradeMaxPollMs, maxPollMs]
  );

  const clearRun = useCallback(() => {
    stopPolling();
    cancelledRef.current = true;
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setRetryNotice(null);
    setElapsedSeconds(0);
    setBilling(null);
    setCompletedMetered(false);
  }, [stopPolling, setElapsedSeconds]);

  const handleReset = () => {
    clearRun();
    setUrl("");
    setValidationError(null);
    setPreview(null);
    inputRef.current?.focus();
  };

  const handleCancel = () => clearRun();

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

    while (true) {
      try {
        const res = await onSubmit(urlValidation.normalizedUrl || trimmedUrl);
        if (cancelledRef.current) return;
        setRetryNotice(null);
        setJobId(res.job_id);
        setCompletedMetered(Boolean(res.billing));
        setStatus("processing");
        startPolling(res.job_id, { intervalMs: pollIntervalMs, maxMs: maxPollMs });

        setBilling(res.billing ?? null);
        if (res.billing) {
          applyBalance(res.billing.balance, res.billing.free_remaining);
        }
        return;
      } catch (err) {
        if (cancelledRef.current) return;

        if (catchCreditError(err)) {
          setRetryNotice(null);
          setStatus("idle");
          return;
        }

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
          const freeTierOnMetered = err.rateLimit?.tier === "free" && Boolean(meteredToolKey);

          setError({
            title: freeTierOnMetered ? "Studio Quality limit reached" : "You've hit this tool's limit",
            hint: freeTierOnMetered
              ? "That's the free-tier limit. Credits raise it to 30 per hour — and they never expire."
              : rateLimitMessage || "Wait for the timer, then run it again.",
            offerCredits: freeTierOnMetered,
          });
          const wait = err.retryAfterSeconds ?? getRetryAfterFallback(endpoint);
          setCooldownCeiling(Math.max(1, wait));
          setCooldownSeconds(wait);
        } else {
          setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
        }
        setStatus("error");
        return;
      }
    }
  };

  useEffect(() => {
    submitRef.current = () => {
      void handleSubmit();
    };
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const stageIndex = stageIndexFor(stages, elapsedSeconds);
  const stageLabel = (() => {
    if (status === "uploading") return retryNotice || "Sending the link to the server";
    if (stageIndex < 0 || !stages) return processingLabel;
    return stages[stageIndex].label;
  })();

  const progress = easedProgress(elapsedSeconds, progressTau);
  const step: 1 | 2 | 3 = status === "complete" ? 3 : isBusy ? 2 : 1;

  return (
    <>
      <FormShell
        toolLabel={toolLabel || submitLabel}
        toolMeta={toolMeta}
        steps={STEPS}
        step={step}
        busy={isBusy}
        failed={isFailed}
        complete={status === "complete"}
        footer={
          status !== "complete" ? (
            <>
              <Button
                variant={videoId || isFailed ? "primary" : "secondary"}
                size="lg"
                className="w-full"
                onClick={handleSubmit}
                disabled={!canSubmit && !isBusy}
                loading={isBusy}
              >
                {!isBusy && <Link2 />}
                {isBusy
                  ? "Working"
                  : cooldownSeconds > 0
                    ? `Try again in ${formatCooldown(cooldownSeconds)}`
                    : isFailed
                      ? "Try again"
                      : submitLabel}
              </Button>
              <CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeiling} />
            </>
          ) : undefined
        }
      >
        {status !== "complete" && (
          <Section className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
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
                  id={inputId}
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
                  aria-describedby={validationError ? errorId : hintId}
                  className={cn(
                    "w-full rounded-xl border bg-graphite-850 py-3.5 pl-11 pr-24 text-text-primary",
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
                      className="rounded-md p-1.5 text-text-subtle outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-500/40"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {!url && (
                    <button
                      type="button"
                      onClick={handlePaste}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:pointer-events-none disabled:opacity-60"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
                      Paste
                    </button>
                  )}
                </div>
              </div>

              {validationError ? (
                <p id={errorId} role="alert" className="flex items-center gap-1.5 text-sm text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                  {validationError}
                </p>
              ) : (
                <p id={hintId} className="text-xs text-text-subtle">
                  Works with watch links, youtu.be, and Shorts
                </p>
              )}
            </div>

            {preview && !isBusy && (
              <div className="jt-in flex items-center gap-4 rounded-xl border border-graphite-800 p-3">
                <Thumbnail id={preview.id} className="h-14 w-24" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {preview.title || "Track ready"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">
                    {preview.author || preview.id}
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
              </div>
            )}
          </Section>
        )}

        {status !== "complete" && renderControls && (
          <Section>{renderControls(isBusy, Boolean(videoId))}</Section>
        )}

        {isBusy && (
          <Section>
            <WorkingPanel
              stageLabel={stageLabel}
              stages={stages}
              stageIndex={stageIndex}
              showStageList={status === "processing"}
              elapsedSeconds={elapsedSeconds}
              progress={progress}
              expectedRange={expectedRange}
              chargedRun={chargedRun}
              onCancel={handleCancel}
              waveform={<Waveform />}
            />
          </Section>
        )}

        {status === "complete" && jobId && (
          <Section className="space-y-4">
            <ResultHeader
              verb="Done"
              title={resultTitle || preview?.title || "Analysis complete"}
              meta={`Finished in ${formatElapsed(elapsedSeconds)}`}
              media={preview ? <Thumbnail id={preview.id} className="h-12 w-20" /> : undefined}
              tag={completedMetered ? <StudioQualityTag /> : undefined}
            />

            {renderComplete(jobId, resultTitle)}

            {upgradeFamily && !completedMetered && (
              <UpgradeToHqCard family={upgradeFamily} jobId={jobId} onUpgraded={handleUpgraded} />
            )}

            <CreditReceipt billing={billing} />

            {!chargedRun && <SupportBlock />}

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw />
              Process another link
            </Button>
          </Section>
        )}

        {isFailed && error && (
          <Section className="space-y-4">
            <ErrorPanel error={error}>
              {error.offerCredits && (
                <Link
                  href="/pricing"
                  onClick={() => trackCredits("credits_rate_limited", { tool: meteredToolKey ?? undefined })}
                  className="mt-2 inline-block text-xs font-medium text-amber-400"
                >
                  See credit packs →
                </Link>
              )}
            </ErrorPanel>
            {status === "error" && <SupportBlock />}
          </Section>
        )}
      </FormShell>

      {gate}
    </>
  );
}