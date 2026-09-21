"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic2, Music4, Bell, BellOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StudioStage, type StageTier } from "@/components/tools/StudioStage";
import { DEMO_DURATION, DEMO_PEAKS_STANDARD, DEMO_PEAKS_STUDIO } from "@/lib/data/demo-peaks";
import {
  CooldownBar,
  ErrorPanel,
  ValidationNote,
  ResultHeader,
  easedProgress,
  formatCooldown,
  formatElapsed,
  serverFailure,
  stageIndexFor,
  terminalPollError,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
  type ProcessingStage,
} from "@/components/tools/JobFormKit";
import { validateAudioFile } from "@/lib/utils/validation";
import { StemMixer } from "@/components/converter/StemMixer";
import { triggerDownload, triggerDownloadsStaggered } from "@/lib/utils/download";
import {
  submitSeparation,
  getSeparationStatus,
  getSeparationPreviewUrl,
  getSeparationDownloadUrl,
  cancelJob,
  ApiError,
  type SeparationQuality,
} from "@/lib/api/railway";
import {
  getRateLimitLabel,
  getRetryAfterFallback,
  type SharedAllowanceSpec,
} from "@/lib/data/rate-limits";
import { useSharedLimit } from "@/lib/hooks/useSharedLimit";
import type { SeparationUiState, StemType, SubmitBilling } from "@/lib/types/converter";
import type { MeteredToolKey } from "@/lib/types/credits";
import { SupportBlock } from "@/components/ui/SupportBlock";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { trackCredits } from "@/lib/analytics";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { AlwaysFreeTag, FreeTierBadge } from "@/components/credits/FreeTierBadge";
import { UpgradeToHqCard } from "@/components/credits/UpgradeToHqCard";
import { CreditReceipt, StudioQualityTag } from "@/components/credits/CreditReceipt";
import { useNotificationPermission } from "@/lib/hooks/useNotificationPermission";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * This form was already the best-argued one on the site, so almost everything
 * below is presentation moving onto the shared kit — plus two real bugs.
 *
 * 1. A REJECTED POLL WAS TREATED AS A SLOW JOB. The catch short-circuited on
 *    404 only, so a 401 or 403 was retried every 8 or 20 seconds until the
 *    ceiling — up to THIRTY-TWO MINUTES of spinner on an HQ job the server
 *    answered instantly, ending in "this is taking unusually long" about a job
 *    that was never running. `terminalPollError` reads those as answers.
 *
 * 2. CANCEL LEFT `billing` BEHIND. Stop watching a charged run, and the credit
 *    state stayed on a form that had gone back to idle — so the next run's
 *    "Stop watching" copy and the tip-jar suppression were both being decided
 *    by a previous job's receipt. Cleared on cancel as well as reset.
 *
 * KEPT, because the reasoning is right: notify flags read through refs (this
 * feature never fired for anyone before that fix); `jobQuality` as its own
 * state so the header, stages and upgrade card describe the RUNNING job rather
 * than the toggle; `completedCharged` derived from the server's billing block
 * rather than from a control the user can still change; no tip jar on a broken
 * run or after a charge; the poll ceilings sized to the BACKEND's timeouts.
 */

interface VocalRemoverFormProps {
  hqAvailable?: boolean;
  demoStandardSrc?: string;
  demoStudioSrc?: string;
  /**
   * The shared standard-separation allowance, resolved server-side from
   * /limits. Carries the daily cap on first paint, and for the whole of any
   * period where PAYWALL_ENABLED is off, since context is null in both cases.
   */
  standardLimit?: SharedAllowanceSpec | null;
  /** Studio limit from /limits, resolved server-side. Beats the static table. */
  hqLimitText?: string;
}

interface QualitySpec {
  value: SeparationQuality;
  label: string;
  model: string;
  time: string;
  detail: string;
  /** Key into RATE_LIMITS (lib/data/rate-limits.ts) — NOT a hardcoded string. */
  rateLimitKey: string;
  /**
   * Metered-tool key, for the free-tier badge. Deliberately the SAME string as
   * rateLimitKey — the backend uses one route key everywhere, so the three
   * places describing this route can be diffed by eye. Null on the free tier.
   */
  toolKey: MeteredToolKey | null;
}

const STANDARD_SPEC: QualitySpec = {
  value: "standard",
  label: "Standard",
  model: "htdemucs",
  time: "20 sec to 1 min",
  detail: "Vocals and instrumental. Some bleed on dense mixes.",
  rateLimitKey: "separate",
  toolKey: null,
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  model: "MelBand RoFormer",
  time: "1 to 2 min",
  detail: "Cleaner separation, same 2 stems. Cymbals and consonants intact.",
  rateLimitKey: "separate-hq",
  toolKey: "separate-hq",
};

// Fallback shown only if a key is ever missing from RATE_LIMITS.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";

/**
 * Renders the limit that applies to THIS visitor.
 *
 * lib/data/rate-limits.ts is a hand-maintained table and it physically cannot
 * be right for a tiered limit: the metered routes are 2/hour on the free tier
 * and 30/hour once you hold credits. Whichever number is in the table, it lies
 * to one of those two groups. /credits/me returns the applicable limit
 * resolved through the SAME code the limiter uses.
 */
function formatRateLimit(max: number, windowSeconds: number): string {
  const unit =
    windowSeconds >= 3600
      ? windowSeconds === 3600
        ? "hour"
        : `${Math.round(windowSeconds / 3600)} hr`
      : windowSeconds >= 60
        ? windowSeconds === 60
          ? "min"
          : `${Math.round(windowSeconds / 60)} min`
        : `${windowSeconds} sec`;
  return `${max} per ${unit}`;
}

const SPEC_FOR: Record<SeparationQuality, QualitySpec> = {
  standard: STANDARD_SPEC,
  hq: HQ_SPEC,
};

const STANDARD_STAGES: ProcessingStage[] = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Analyzing frequencies" },
  { at: 15, label: "Isolating vocals" },
  { at: 40, label: "Rendering vocals and instrumental" },
];

// Rescaled to fit the current 1–2 min Studio Quality time.
const HQ_STAGES: ProcessingStage[] = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Running the studio-quality model" },
  { at: 35, label: "Isolating vocals" },
  { at: 90, label: "Refining and rendering both stems" },
];

// Must cover the BACKEND's actual timeout ceiling (DEMUCS_TIMEOUT_SECONDS /
// DEMUCS_TIMEOUT_SECONDS_HQ in config.py: 600s / 1800s), not the typical-case
// estimate shown in the UI. A tighter frontend cap means the poll gives up and
// shows "stuck" on a job the backend is still correctly processing.
const MAX_POLL_MS_STANDARD = 12 * 60 * 1000;
const MAX_POLL_MS_HQ = 32 * 60 * 1000;

function humanizeError(raw: string): FormError {
  const text = raw.toLowerCase();
  if (text.includes("too large") || text.includes("size")) {
    return { title: "This file is too large", hint: "Trim it down or export at a smaller size." };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Upload the file again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return {
    title: raw || "Separation failed",
    hint: "Run it again. If it keeps failing, try a different file.",
  };
}

export function VocalRemoverForm({
  hqAvailable = false,
  standardLimit,
  hqLimitText,
  demoStandardSrc,
  demoStudioSrc,
}: VocalRemoverFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SeparationUiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);

  const [quality, setQuality] = useState<SeparationQuality>("standard");
  /**
   * The tier the job in flight (or the one on screen) actually ran at — not
   * the toggle's current value, which the user can change while a result is
   * displayed. The upgrade card, the tag, the stage labels and the progress
   * curve all key off this. Using `quality` would offer an upgrade on a job
   * that already ran at Studio Quality.
   */
  const [jobQuality, setJobQuality] = useState<SeparationQuality>("standard");
  /**
   * What the server said it charged. Kept verbatim rather than reconstructed,
   * so the receipt reports the actual outcome — including the case where a
   * metered route charged nothing.
   */
  const [billing, setBilling] = useState<SubmitBilling | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const { permission: notifyPermission, request: requestNotifyPermission } =
    useNotificationPermission();

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const isComplete = status === "complete";

  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isBusy);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  /**
   * STATE, NOT A REF, because CooldownBar renders it. As a ref it only showed
   * the right ceiling because the setCooldownSeconds call on the next line
   * happened to trigger the render that read it.
   */
  const [cooldownCeiling, setCooldownCeiling] = useState(1);

  // The entire per-form cost of the paywall — the same lines go in each of the
  // other three metered forms.
  //
  // onCredited closes the dead end at the end of the gate: someone who hits the
  // 402, buys, and dismisses the modal used to land back on an idle form with
  // their file still attached and no sign that the thing they wanted is now
  // possible. It fires once, only if the balance actually rose, and only after
  // the modal has closed.
  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });
  const {
    applyBalance,
    rateLimitFor,
    enabled: creditsEnabled,
    loading: creditsLoading,
    isToolMetered,
    me,
  } = useCredits();
  const sharedLimit = useSharedLimit("separate", standardLimit);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  /**
   * Read by notifyOnDone, which lives inside a polling loop created once at
   * mount. Reading the state values directly there captures the mount-time
   * render, where notifications are always off — which is why this feature had
   * never fired for anyone.
   */
  const notifyEnabledRef = useRef(false);
  const notifyPermissionRef = useRef<NotificationPermission | "unsupported">("default");
  /*
    Synced in an EFFECT, not assigned during render. Writing to a ref while
    rendering is what react-hooks/refs rejects, and it stops being merely
    untidy the moment the React Compiler is enabled: a memoised render can be
    skipped, and the assignment with it.
  */
  useEffect(() => {
    notifyEnabledRef.current = notifyEnabled;
    notifyPermissionRef.current = notifyPermission;
  });

  const isHq = hqAvailable && quality === "hq";
  const canSubmit = Boolean(file) && !isBusy && !isComplete && cooldownSeconds === 0;

  /**
   * Metered is what the SERVER said, not what the toggle says. The billing
   * block only exists on metered routes, so its presence is direct evidence
   * rather than an inference from a control the user can still change.
   */
  const completedCharged = billing?.charged === "credit";

  // Shortest window only. The picker slot fits one figure; the page FAQ carries
  // both, and the 429 names whichever actually fired.
  const standardLimitLabel =
    sharedLimit.shortLabel ??
    getRateLimitLabel(STANDARD_SPEC.rateLimitKey) ??
    FALLBACK_RATE_LIMIT_LABEL;
  const hqLimitLabel =
    hqLimitText ?? getRateLimitLabel(HQ_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /** Refs, not state — see notifyEnabledRef above. */
  const notifyOnDone = useCallback((title: string, body: string) => {
    if (!notifyEnabledRef.current || notifyPermissionRef.current !== "granted") return;
    if (typeof document !== "undefined" && !document.hidden) return;
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      // Some browsers restrict Notification() outside a service worker
      // context — silently skip rather than throw.
    }
  }, []);

  const handleNotifyToggle = async () => {
    if (notifyPermission === "unsupported") return;
    if (notifyPermission === "default") {
      const result = await requestNotifyPermission();
      if (result === "granted") setNotifyEnabled(true);
      return;
    }
    setNotifyEnabled((v) => !v);
  };

  /**
   * The poll loop reschedules itself, which it can't do by naming itself: a
   * value referenced inside its own initializer is something the React
   * Compiler can't reason about. One indirection through a ref — declared
   * BEFORE the callback, assigned in an effect rather than during render —
   * removes the self-reference without changing the polling behaviour.
   */
  const pollFnRef = useRef<(id: string, forQuality: SeparationQuality) => void>(() => {});

  const poll = useCallback(
    (id: string, forQuality: SeparationQuality) => {
      if (cancelledRef.current) return;

      const maxPollMs = forQuality === "hq" ? MAX_POLL_MS_HQ : MAX_POLL_MS_STANDARD;
      if (Date.now() - pollStartedAtRef.current > maxPollMs) {
        stopPolling();
        const humanized: FormError = {
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start fresh.",
        };
        setError(humanized);
        setStatus("failed");
        notifyOnDone("Separation failed", humanized.title);
        return;
      }

      const intervalMs = forQuality === "hq" ? 20_000 : 8_000;

      getSeparationStatus(id)
        .then((result) => {
          if (cancelledRef.current) return;
          if (result.status === "complete") {
            stopPolling();
            setResultTitle(result.title);
            setStatus("complete");
            notifyOnDone("Vocals separated", "Your vocal and instrumental tracks are ready.");
            return;
          }
          if (result.status === "failed") {
            stopPolling();
            // Verbatim: routes/_shared.py writes these for the user. See
            // serverFailure in JobFormKit.
            const humanized = serverFailure(result.error, {
              title: "Separation failed",
              hint: "Run it again. If it keeps failing, try a different file.",
            });
            setError(humanized);
            setStatus("failed");
            notifyOnDone("Separation failed", humanized.title);
            return;
          }
          pollRef.current = setTimeout(() => pollFnRef.current(id, forQuality), intervalMs);
        })
        .catch((err) => {
          if (cancelledRef.current) return;
          /* A 401/403/404 is an ANSWER. This used to short-circuit on 404
             only, so an auth failure was retried every 8 or 20 seconds until
             the ceiling — up to thirty-two minutes of spinner on an HQ job,
             ending in "taking unusually long" about a job that was never
             running. */
          const terminal = terminalPollError(err);
          if (terminal) {
            stopPolling();
            setError(terminal);
            setStatus("failed");
            notifyOnDone("Separation failed", terminal.title);
            return;
          }
          pollRef.current = setTimeout(() => pollFnRef.current(id, forQuality), intervalMs);
        });
    },
    [stopPolling, notifyOnDone]
  );

  useEffect(() => {
    pollFnRef.current = poll;
  }, [poll]);

  const startPolling = useCallback(
    (id: string, forQuality: SeparationQuality) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      poll(id, forQuality);
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
    // A new file means the previous run's receipt no longer describes
    // anything on screen.
    setBilling(null);
    setJobQuality("standard");
  };

  const handleSubmit = async () => {
    if (!file) return;

    const effectiveQuality: SeparationQuality = hqAvailable ? quality : "standard";

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    cancelledRef.current = false;

    // ONE KEY FOR THIS SUBMIT. This form has no retry loop, so the
    // duplicate it guards against is the human one: a double-click, or a
    // second press while the first is still uploading. Either used to
    // start a second separation on a second credit.
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await submitSeparation(file, effectiveQuality, {}, idempotencyKey);
      if (cancelledRef.current) return;
      setJobId(res.job_id);
      setJobQuality(effectiveQuality);
      setStatus("processing");
      startPolling(res.job_id, effectiveQuality);

      // The metered routes return what they just charged, so the pill and the
      // badge update from THIS response rather than a follow-up /credits/me.
      setBilling(res.billing ?? null);
      if (res.billing) {
        applyBalance(res.billing.balance, res.billing.free_remaining);
      }
    } catch (err) {
      if (cancelledRef.current) return;

      // Out of credits is a DECISION POINT, not a failure. Going back to idle
      // leaves the file selected and the toggle where it was.
      if (catchCreditError(err)) {
        setStatus("idle");
        return;
      }

      console.error("Separation submit error:", err);

      if (err instanceof ApiError && err.isRateLimit) {
        // A FREE-tier rate limit on a metered tool is the best-qualified
        // moment in the product: they've used the good mode twice and
        // immediately wanted more.
        const freeTierOnMetered = err.rateLimit?.tier === "free" && effectiveQuality === "hq";

        setError({
          title:
            effectiveQuality === "hq"
              ? "Studio Quality limit reached"
              : "You've reached the free limit",
          hint: freeTierOnMetered
            ? "That's the free-tier limit. Credits raise it to 30 per hour, and they never expire."
            : effectiveQuality === "hq"
              ? `${hqLimitLabel}. Try again later.`
              : sharedLimit.hintFor(err),
          offerCredits: freeTierOnMetered,
        });
        const seconds =
          err.retryAfterSeconds ?? getRetryAfterFallback(SPEC_FOR[effectiveQuality].rateLimitKey);
        setCooldownCeiling(Math.max(1, seconds));
        setCooldownSeconds(seconds);
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    }
  };

  // Synced every render so onCredited always calls the CURRENT handleSubmit
  // rather than the one from first mount.
  useEffect(() => {
    submitRef.current = () => {
      void handleSubmit();
    };
  });

  /**
   * The upgrade route returns a NEW job id, and the existing polling loop
   * handles it unchanged — same status route, same preview and download URL
   * shape.
   *
   * The second argument carries the billing block: the upgrade spends a credit,
   * and without it the finished result showed no tag, no receipt, and still
   * asked for a tip.
   */
  const handleUpgraded = useCallback(
    (newJobId: string, upgradeBilling?: SubmitBilling | null) => {
      cancelledRef.current = false;
      setJobId(newJobId);
      setJobQuality("hq");
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
      startPolling(newJobId, "hq");
    },
    [startPolling, applyBalance, setElapsedSeconds]
  );

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    setFile(null);
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setElapsedSeconds(0);
    setJobQuality("standard");
    setBilling(null);
  };

  const handleCancel = () => {
    // Stops the job on the SERVER too. This used to be local only: the
    // GPU kept running and billing, and the credit stayed spent.
    const id = jobId;
    if (id) void cancelJob(id);
    cancelledRef.current = true;
    stopPolling();
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setElapsedSeconds(0);
    // Was left behind: a cancelled charged run kept its receipt, so the NEXT
    // run's "Stop watching" copy and tip-jar suppression were decided by a
    // previous job's billing block.
    setBilling(null);
  };

  const stages = jobQuality === "hq" ? HQ_STAGES : STANDARD_STAGES;
  const stageIndex = stageIndexFor(stages, elapsedSeconds);
  const stageLabel =
    status === "uploading" ? "Uploading your file" : (stages[stageIndex]?.label ?? "Separating");

  // Metered Studio runs are capped by free runs and credits, so the hourly
  // figure is only shown while the paywall is off.
  const hqMetered = creditsEnabled && !creditsLoading && isToolMetered("separate-hq");
  const hqCost = me?.paywall?.tools?.["separate-hq"]?.credits ?? 1;
  const hqCostNote = `${hqCost} ${hqCost === 1 ? "credit" : "credits"} per track after your free runs`;

  const specs = hqAvailable ? [STANDARD_SPEC, HQ_SPEC] : [STANDARD_SPEC];
  const tiers: StageTier<SeparationQuality>[] = specs.map((option) => {
    // Live limit first, static table second. See formatRateLimit.
    const liveLimit = option.toolKey ? rateLimitFor(option.toolKey) : null;
    const demoSrc = option.value === "hq" ? demoStudioSrc : demoStandardSrc;
    return {
      value: option.value,
      name: option.label,
      short: option.value === "hq" ? "Studio" : "Standard",
      premium: option.value === "hq",
      model: option.model,
      time: option.time,
      demo:
        demoSrc
          ? {
              src: demoSrc,
              peaks: option.value === "hq" ? DEMO_PEAKS_STUDIO : DEMO_PEAKS_STANDARD,
              duration: DEMO_DURATION,
            }
          : undefined,
      // Both tiers carry a cost marker or neither does.
      badge: option.toolKey ? (
        <FreeTierBadge tool={option.toolKey} />
      ) : HQ_SPEC.toolKey ? (
        <AlwaysFreeTag pairedTool={HQ_SPEC.toolKey} />
      ) : undefined,
      footnote:
        option.value === "hq"
          ? hqMetered
            ? hqCostNote
            : creditsLoading
              ? undefined
              : liveLimit
                ? formatRateLimit(liveLimit.max_requests, liveLimit.window_seconds)
                : hqLimitLabel
          : standardLimitLabel,
    };
  });

  const notifyOn = notifyEnabled && notifyPermission === "granted";
  const notifyTitle =
    notifyPermission === "denied"
      ? "Notifications are blocked in your browser settings"
      : notifyOn
        ? "We will notify you when it is done"
        : "Notify me when it is done";

  const notifyButton =
    notifyPermission !== "unsupported" ? (
      <button
        type="button"
        onClick={handleNotifyToggle}
        disabled={isBusy || notifyPermission === "denied"}
        aria-pressed={notifyOn}
        aria-label={notifyTitle}
        title={notifyTitle}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:cursor-not-allowed disabled:opacity-50",
          notifyOn
            ? "border-text-primary/70 text-text-primary"
            : "border-graphite-700 text-text-subtle hover:border-graphite-500 hover:text-text-primary"
        )}
      >
        {notifyOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
      </button>
    ) : null;

  const actionLabel =
    cooldownSeconds > 0
      ? `Try again in ${formatCooldown(cooldownSeconds)}`
      : isFailed
        ? "Try again"
        : isHq
          ? "Remove vocals in Studio Quality"
          : "Remove vocals";

  const result =
    isComplete && jobId ? (
      <div className="space-y-4" role="status" aria-live="polite">
        <ResultHeader
          verb="Done"
          title={resultTitle || "Separation complete"}
          meta={`Finished in ${formatElapsed(elapsedSeconds)}`}
          tag={jobQuality === "hq" ? <StudioQualityTag /> : undefined}
        />

        <StemMixer
          key={jobId}
          stems={(["vocals", "instrumental"] as StemType[]).map((name) => ({
            name: name === "vocals" ? "Vocals" : "Instrumental",
            url: getSeparationPreviewUrl(jobId, name),
            downloadName: `${name}.wav`,
            icon:
              name === "vocals" ? (
                <Mic2 className="h-4 w-4" aria-hidden />
              ) : (
                <Music4 className="h-4 w-4" aria-hidden />
              ),
          }))}
          onDownload={(display) => {
            const raw: StemType = display === "Vocals" ? "vocals" : "instrumental";
            triggerDownload(getSeparationDownloadUrl(jobId, raw));
          }}
          onDownloadAll={() =>
            triggerDownloadsStaggered(
              (["vocals", "instrumental"] as StemType[]).map((n) =>
                getSeparationDownloadUrl(jobId, n)
              )
            )
          }
          sourceTitle={resultTitle}
        />

        {/* Never on a job that already ran at Studio Quality. */}
        {jobQuality === "standard" && (
          <UpgradeToHqCard family="separate" jobId={jobId} onUpgraded={handleUpgraded} />
        )}

        <CreditReceipt billing={billing} />

        {/* No tip jar right after charging a credit. */}
        {!completedCharged && <SupportBlock />}

        <Button variant="outline" size="md" className="w-full sm:w-auto" onClick={handleReset}>
          <RotateCcw />
          Separate another track
        </Button>
      </div>
    ) : undefined;

  const note =
    validationError || (isFailed && error) ? (
      <div className="space-y-4">
        {validationError && <ValidationNote message={validationError} />}
        {isFailed && error && (
          <>
            <ErrorPanel error={error}>
              {error.offerCredits && (
                <Link
                  href="/pricing"
                  onClick={() => trackCredits("credits_rate_limited", { tool: "separate-hq" })}
                  className="mt-2 inline-block rounded text-xs font-medium text-amber-400 outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  See credit packs →
                </Link>
              )}
            </ErrorPanel>
            {/* No tip jar on a job that ran and broke, only on a rejected submit. */}
            {status === "error" && <SupportBlock mood="sheepish" />}
          </>
        )}
      </div>
    ) : undefined;

  return (
    <>
      <StudioStage
        label="Vocal remover"
        file={file}
        onFileSelect={handleFileSelect}
        onClear={handleReset}
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        formats="MP3 · WAV · FLAC · M4A · AAC · OGG"
        tiers={tiers}
        tier={isHq ? "hq" : "standard"}
        onTierChange={setQuality}
        jobTier={status === "idle" ? (isHq ? "hq" : "standard") : jobQuality}
        demoCaption="Hear a result first: the vocal stem"
        demoNudge={hqAvailable ? "Now switch to Studio Quality and hear the bleed disappear" : undefined}
        demoCredit="What Would It Mean by H4RRIS feat. Nicole Apollonio, used with permission"
        busy={isBusy}
        failed={isFailed}
        progress={easedProgress(elapsedSeconds, jobQuality === "hq" ? 40 : 12)}
        stageLabel={stageLabel}
        elapsed={formatElapsed(elapsedSeconds)}
        onCancel={handleCancel}
        actionLabel={actionLabel}
        actionIcon={<Mic2 />}
        actionDisabled={!canSubmit}
        onAction={handleSubmit}
        footerExtra={notifyButton}
        belowAction={<CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeiling} />}
        result={result}
        note={note}
      />

      {gate}
    </>
  );
}