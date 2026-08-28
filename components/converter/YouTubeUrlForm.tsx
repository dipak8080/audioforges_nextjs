"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link2, AlertTriangle, ClipboardPaste, X, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Waveform } from "@/components/ui/Waveform";
import Link from "next/link";
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
import { getJobStatus, ApiError, type JobSubmitResponse } from "@/lib/api/railway";

/**
 * ── THIS PASS: FOUR FIXES ──────────────────────────────────────────────
 *
 * 1. AN UPGRADED JOB WAS POLLED WITH THE WRONG CEILING. `handleUpgraded` had
 *    `[]` deps and an eslint-disable, so it captured the `startPolling` — and
 *    through it the `maxPollMs` and `pollIntervalMs` — from FIRST MOUNT, when
 *    the quality toggle still said Standard. An upgrade is always to HQ, whose
 *    backend timeout is 1800s, but the captured frontend cap was the standard
 *    720s. Any upgraded run past twelve minutes was declared "taking unusually
 *    long" on a job the backend was still correctly processing and would have
 *    completed. That is exactly the failure the maxPollMs comment warns about,
 *    reintroduced through a stale closure. The upgrade path now takes its own
 *    timings, passed explicitly by the caller.
 *
 * 2. THE UPGRADE PRODUCED NO RECEIPT. `handleUpgraded` took only a job id, so
 *    `billing` stayed at whatever the ORIGINAL free run left it — null. After
 *    spending a credit the result showed no "1 credit used" line and kept
 *    asking for a tip.
 *
 * 3. THE GATE WAS A DEAD END. A 402 opened the modal, the user bought, and
 *    they were returned to an idle form holding their link with no sign that
 *    the thing they wanted is now possible. `onCredited` re-runs the submit
 *    once the modal closes.
 *
 * 4. `poll` NO LONGER CHURNS ON EVERY RENDER. It depended on the `onComplete`
 *    and `onFailed` props, which callers pass as inline arrows, so it was
 *    rebuilt on every keystroke in the URL field. They're read through refs
 *    now, which also means a caller's notification handler can never be
 *    captured stale.
 */

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

/** Timings for one polling run. Carried through the recursion so an upgraded
 *  job cannot inherit the tier it was upgraded FROM. */
interface PollTiming {
  intervalMs: number;
  maxMs: number;
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
  /**
   * Timings for a job started by the upgrade card. An upgrade always produces
   * an HQ job, whose backend ceiling is far higher than the standard tier's —
   * without these the upgraded run is polled against whatever the toggle
   * happened to say, and gets declared stuck while the backend is still
   * working. Default to the normal values for tools with no HQ tier.
   */
  upgradePollIntervalMs?: number;
  upgradeMaxPollMs?: number;
  /**
   * Optional extra controls rendered between the URL input and the submit
   * button (e.g. a quality tier toggle, a notification opt-in).
   *
   * `hasUrl` mirrors MultiOutputToolForm's `file` argument: the "is there
   * actually anything to act on yet?" signal, so a control like the notify
   * toggle can stay disabled until a real link is present rather than being
   * togglable on an empty form.
   */
  renderControls?: (disabled: boolean, hasUrl: boolean) => ReactNode;
  onComplete?: (title: string | null) => void;
  onFailed?: (message: string) => void;
  renderComplete: (jobId: string, title: string | null) => ReactNode;
  /**
   * OPT-IN CREDITS WIRING.
   *
   * This component backs every /youtube/* tool, and most of them are never
   * metered. Passing neither prop leaves behaviour byte-identical to before.
   *
   * `meteredToolKey` is the key for the CURRENTLY SELECTED tier, so the caller
   * passes null while Standard is chosen. It drives only the free-tier 429
   * offer; the 402 gate is unconditional and harmless.
   */
  meteredToolKey?: MeteredToolKey | null;
  /** Enables the upgrade CTA under the result. Omit for tools with no HQ tier. */
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
  upgradePollIntervalMs,
  upgradeMaxPollMs,
  renderControls,
  onComplete,
  onFailed,
  renderComplete,
  meteredToolKey = null,
  upgradeFamily,
}: YouTubeUrlFormProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [error, setError] = useState<{
    title: string;
    hint: string;
    /** Free-tier rate limit on a metered tool — an offer, not a dead end. */
    offerCredits?: boolean;
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  /**
   * Whether the FINISHED job ran on a metered route. Derived from the presence
   * of the `billing` block — the server telling us directly — rather than from
   * the caller's current toggle, which the user can still change while a
   * result is on screen.
   */
  const [completedMetered, setCompletedMetered] = useState(false);
  /** What the server said it charged. Reported verbatim, never inferred. */
  const [billing, setBilling] = useState<SubmitBilling | null>(null);

  const { applyBalance } = useCredits();
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

  /**
   * Callers pass these as inline arrows, so depending on them directly rebuilt
   * `poll` on every keystroke. Through refs, `poll` is stable AND always calls
   * the caller's latest handler — which is what keeps a notification opt-in
   * from being captured in its off state.
   */
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  onCompleteRef.current = onComplete;
  onFailedRef.current = onFailed;

  // Re-runs the submit after a purchase closes the gate. Through a ref because
  // handleSubmit is declared below.
  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const videoId = useMemo(() => extractVideoId(url.trim()), [url]);
  const canSubmit = Boolean(videoId) && !validationError && !isBusy && cooldownSeconds === 0;

  /**
   * Keyed on what was CHARGED, not on whether the route was metered. A
   * free-tier Studio Quality run is still a free result, so it keeps the tip
   * block; only a run someone paid a credit for loses it.
   */
  const completedCharged = billing?.charged === "credit";

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
    async (id: string, timing: PollTiming) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > timing.maxMs) {
        stopPolling();
        setError({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Paste the link again to start a fresh run.",
        });
        setStatus("failed");
        onFailedRef.current?.("This is taking unusually long");
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
          stopPolling();
          const humanized = humanizeError(result.error || "Processing failed.");
          setError(humanized);
          setStatus("failed");
          onFailedRef.current?.(humanized.title);
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        if (err instanceof ApiError && err.status === 404) {
          stopPolling();
          const humanized = humanizeError("This job expired.");
          setError(humanized);
          setStatus("failed");
          onFailedRef.current?.(humanized.title);
          return;
        }
      }

      pollRef.current = setTimeout(() => poll(id, timing), timing.intervalMs);
    },
    [endpoint, stopPolling]
  );

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
    } catch {
      // Clipboard blocked — the field is still there to type into.
    }
    inputRef.current?.focus();
  };

  /**
   * The upgrade route returns a NEW job id that works against the same
   * status/preview/download routes, so the existing polling loop handles it
   * unchanged — but NOT with the same timings. An upgrade is always to HQ, so
   * it gets the HQ ceiling explicitly rather than inheriting whatever tier the
   * toggle was on.
   */
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
    [startPolling, applyBalance, upgradePollIntervalMs, pollIntervalMs, upgradeMaxPollMs, maxPollMs]
  );

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
    // A cleared form describes no job, so it must not carry the last one's
    // receipt into the next render.
    setBilling(null);
    setCompletedMetered(false);
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
        const res = await onSubmit(urlValidation.normalizedUrl || trimmedUrl);
        if (cancelledRef.current) return;
        setRetryNotice(null);
        setJobId(res.job_id);
        setCompletedMetered(Boolean(res.billing));
        setStatus("processing");
        startPolling(res.job_id, { intervalMs: pollIntervalMs, maxMs: maxPollMs });

        // Metered routes report what they just charged, so the navbar pill
        // updates from THIS response rather than a follow-up /credits/me — no
        // stale number, no extra round trip.
        setBilling(res.billing ?? null);
        if (res.billing) {
          applyBalance(res.billing.balance, res.billing.free_remaining);
        }
        return;
      } catch (err) {
        if (cancelledRef.current) return;

        // Out of credits is a decision point, not a failure. Back to idle
        // keeps the URL and the tier selection, so buying and pressing the
        // button again just works — and nothing red is rendered for it.
        if (catchCreditError(err)) {
          setRetryNotice(null);
          setStatus("idle");
          return;
        }

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
          // The best-qualified moment in the product: they used the good mode
          // up to its free ceiling and immediately wanted more.
          const freeTierOnMetered =
            err.rateLimit?.tier === "free" && Boolean(meteredToolKey);

          setError({
            title: freeTierOnMetered ? "Studio Quality limit reached" : "You've hit this tool's limit",
            hint: freeTierOnMetered
              ? "That's the free-tier limit. Credits raise it to 30 per hour — and they never expire."
              : rateLimitMessage || "Wait for the timer, then run it again.",
            offerCredits: freeTierOnMetered,
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

  // Assigned during render so onCredited always calls the CURRENT handleSubmit.
  submitRef.current = () => {
    void handleSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      void handleSubmit();
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
              "h-1.5 w-1.5 rounded-full bg-amber-500",
              isBusy && "animate-pulse motion-reduce:animate-none"
            )}
            aria-hidden
          />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            {toolLabel || submitLabel}
          </span>
        </div>
        {toolMeta && <span className="font-mono text-[11px] text-text-subtle">{toolMeta}</span>}
      </div>

      {/*
        ZONES SEPARATED BY HAIRLINES, NOT BY MORE VERTICAL SPACE.
        This was one padded box with `space-y-6` between every block, so the
        URL field, the video preview, the tool's controls and the progress
        panel all sat at the same level with nothing grouping them. `divide-y`
        draws a rule between whichever sections render — the layout contract
        TranscriptionForm already documents. Applies to every /youtube/* tool.
      */}
      <div className="divide-y divide-graphite-800">
        {/* SOURCE — the link, and what it resolved to. */}
        {status !== "complete" && (
          <section className="space-y-4 p-6 sm:p-8">
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

              {/* In-field controls: sized to sit inside the input, not
                  standalone buttons. Not <Button> material. */}
              <div className="absolute right-2.5 flex items-center gap-1">
                {url && !isBusy && (
                  <button
                    type="button"
                    onClick={handleReset}
                    aria-label="Clear link"
                    className="rounded-md p-1.5 text-text-subtle outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {!url && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
                    Paste
                  </button>
                )}
              </div>
            </div>

            {validationError ? (
              <p id="url-error" role="alert" className="flex items-center gap-1.5 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                {validationError}
              </p>
            ) : (
              <p id="url-hint" className="text-xs text-text-subtle">
                Works with watch links, youtu.be, and Shorts
              </p>
            )}
          </div>

          {/* The video the link resolved to, inside the same zone as the field
              that produced it — it is confirmation OF the input, not a
              separate block of its own. */}
          {preview && !isBusy && (
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
          </section>
        )}

        {/* SETTINGS — whatever this tool needs before it can run. */}
        {status !== "complete" && renderControls && (
          <section className="p-6 sm:p-8">{renderControls(isBusy, Boolean(videoId))}</section>
        )}

        {/* WORKING */}
        {isBusy && (
          <section className="p-6 sm:p-8">
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

            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Processing progress"
              className="h-1 w-full overflow-hidden rounded-full bg-graphite-800"
            >
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="opacity-60 motion-reduce:hidden">
                <Waveform />
              </div>
              {/* Underlined text link, not a button shape — deliberately not
                  run through <Button>. */}
              <button
                type="button"
                onClick={handleCancel}
                className="rounded px-1 text-xs text-text-subtle underline underline-offset-2 outline-none transition-colors hover:text-red-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs leading-relaxed text-text-subtle">
              {expectedRange ? `Typically ${expectedRange}. ` : ""}Keep this tab open.
            </p>
          </div>
          </section>
        )}

        {/* RESULT */}
        {status === "complete" && jobId && (
          <section className="space-y-4 p-6 sm:p-8" role="status" aria-live="polite">
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
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {resultTitle || preview.title || "Analysis complete"}
                    </p>
                    {completedMetered && <StudioQualityTag />}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-text-subtle">
                    Finished in {formatElapsed(elapsedSeconds)}
                  </p>
                </div>
              </div>
            )}

            {renderComplete(jobId, resultTitle)}

            {/* Under the result, where the user has just heard the bleed in
                their own track. Silent unless the server says this job is
                eligible, and never on a job that already ran at Studio
                Quality. */}
            {upgradeFamily && !completedMetered && (
              <UpgradeToHqCard
                family={upgradeFamily}
                jobId={jobId}
                onUpgraded={handleUpgraded}
              />
            )}

            <CreditReceipt billing={billing} />

            {/* Asking for a tip right after charging someone a credit is a bad
                look. A free-tier run is still free, so it keeps the block. */}
            {!completedCharged && <SupportBlock />}

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw />
              Process another link
            </Button>
          </section>
        )}

        {/* FAILED */}
        {isFailed && error && (
          <section className="space-y-4 p-6 sm:p-8">
            <div
              className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-text-primary">{error.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{error.hint}</p>
                {error.offerCredits && (
                  <Link
                    href="/pricing"
                    onClick={() =>
                      trackCredits("credits_rate_limited", {
                        tool: meteredToolKey ?? undefined,
                      })
                    }
                    className="mt-2 inline-block rounded text-xs font-medium text-amber-400 outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  >
                    See credit packs →
                  </Link>
                )}
              </div>
            </div>
            <SupportBlock />
          </section>
        )}

        {/* ACTION BAR. Recessed and pinned to the bottom edge so the primary
            control sits in the same place in every state. */}
        {status !== "complete" && (
          <div className="rounded-b-2xl bg-graphite-950/40 p-4 sm:px-8 sm:py-5">
          {/* Stays visible with no link, unlike the upload forms which hide
             their submit: here the input is directly above it and the pair
             reads as one control, so removing half of it would be stranger
             than dimming it. Neutral until the link parses — a disabled amber
             fill at 40% opacity renders as a muddy brown bar rather than an
             inactive one. */}
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
          </div>
        )}
      </div>

      {gate}
    </div>
  );
}