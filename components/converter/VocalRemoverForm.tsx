"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic2,
  AlertTriangle,
  Download,
  Sparkles,
  Music4,
  Bell,
  BellOff,
  Info,
  RotateCcw,
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { validateAudioFile } from "@/lib/utils/validation";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitSeparation,
  getSeparationStatus,
  getSeparationPreviewUrl,
  getSeparationDownloadUrl,
  ApiError,
  type SeparationQuality,
} from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import type { SeparationUiState, StemType, SubmitBilling } from "@/lib/types/converter";
import type { MeteredToolKey } from "@/lib/types/credits";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { trackCredits } from "@/lib/analytics";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import { UpgradeToHqCard } from "@/components/credits/UpgradeToHqCard";
import { CreditReceipt, StudioQualityTag } from "@/components/credits/CreditReceipt";

/**
 * ── THIS PASS: FOUR FIXES ──────────────────────────────────────────────
 *
 * 1. NOTIFICATIONS HAVE NEVER FIRED. `poll` is a useCallback with `[stopPolling]`
 *    for deps, so it is created once at mount and captures the `notifyOnDone`
 *    from that first render — where `notifyEnabled` is false and
 *    `notifyPermission` is still "default". Toggling the switch afterwards
 *    updated state the polling loop could never see, so the completion
 *    notification was unreachable for every user. The two values are now read
 *    through refs at call time.
 *
 * 2. THE UPGRADE PRODUCED NO RECEIPT. `handleUpgraded` took only a job id, so
 *    after spending a credit through the upgrade card the result rendered with
 *    `billing` still null — no Studio Quality tag, no "1 credit used", and the
 *    tip block still showing. That is the highest-converting path in the
 *    product acknowledging a purchase by looking identical to a free run.
 *    The callback now accepts the billing block (second arg is optional, so it
 *    compiles against the current UpgradeToHqCard either way — see the note by
 *    handleUpgraded for the one line to add there).
 *
 * 3. THE RUNNING JOB'S TIER IS NOW ITS OWN STATE. `completedQuality` was set
 *    at submit time despite its name, while the header, stage labels and
 *    progress curve all read the TOGGLE. Renamed to `jobQuality` and used
 *    everywhere the running or finished job is being described.
 *
 * 4. BOTH RADIOGROUPS ARE KEYBOARD-OPERABLE. `role="radiogroup"` with plain
 *    focusable buttons is a broken promise: a radiogroup is one tab stop with
 *    arrow keys between options, and screen reader users are told to expect
 *    exactly that. Roving tabindex and arrow handling added to the quality and
 *    stem selectors.
 *
 * Per the frontend reference: `completedMetered` is derived from
 * `Boolean(billing)` rather than from a quality flag, because the billing
 * block only exists on metered routes — that is the server telling us
 * directly, instead of inferring from a control the user can change while a
 * result is on screen.
 */

interface VocalRemoverFormProps {
  hqAvailable?: boolean;
}

interface QualitySpec {
  value: SeparationQuality;
  label: string;
  time: string;
  detail: string;
  /** Key into RATE_LIMITS (lib/data/rate-limits.ts) — NOT a hardcoded string. */
  rateLimitKey: string;
  /**
   * Metered-tool key, for the free-tier badge. Deliberately the SAME string as
   * rateLimitKey — the backend uses one route key everywhere, so the three
   * places describing this route can be diffed by eye. Null on the free tier:
   * nothing to meter, nothing to badge.
   */
  toolKey: MeteredToolKey | null;
}

// rateLimit strings are intentionally NOT hardcoded here — they're looked up
// from RATE_LIMITS via rateLimitKey below, so a backend limit change only
// needs updating in lib/data/rate-limits.ts. This is the file-upload Vocal
// Remover, keyed as "separate"/"separate-hq" — a distinct backend endpoint
// from the 4-stem Stem Splitter ("stems") and from the YouTube Vocal Remover
// ("youtube/separate").
const STANDARD_SPEC: QualitySpec = {
  value: "standard",
  label: "Standard",
  time: "20 sec–1 min",
  detail: "Vocals and instrumental",
  rateLimitKey: "separate",
  toolKey: null,
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  time: "1–2 min",
  detail: "Cleaner separation, same 2 stems",
  rateLimitKey: "separate-hq",
  toolKey: "separate-hq",
};

const SPEC_FOR: Record<SeparationQuality, QualitySpec> = {
  standard: STANDARD_SPEC,
  hq: HQ_SPEC,
};

// Fallback shown only if a key is ever missing from RATE_LIMITS (e.g. someone
// renames a key in rate-limits.ts without updating this file) — keeps the UI
// from rendering "undefined" instead of failing loudly in dev.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";

/**
 * Renders the limit that applies to THIS visitor.
 *
 * lib/data/rate-limits.ts is a hand-maintained table and it physically cannot
 * be right for a tiered limit: the metered routes are 2/hour on the free tier
 * and 30/hour once you hold credits. Whichever number is in the table, it lies
 * to one of those two groups.
 *
 * /credits/me returns the applicable limit resolved through the SAME code the
 * limiter uses, so this prefers it and falls back to the static table only for
 * unmetered tools, where the table is correct and there is nothing
 * tier-dependent to resolve.
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

const STANDARD_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Analyzing frequencies" },
  { at: 15, label: "Isolating vocals" },
  { at: 40, label: "Rendering vocals and instrumental" },
];

// Rescaled to fit the current 1–2 min Studio Quality time (previously ran to
// 240s / 4 min, which no longer fit within the corrected estimate).
const HQ_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Running the studio-quality model" },
  { at: 35, label: "Isolating vocals" },
  { at: 90, label: "Refining and rendering both stems" },
];

// Must cover the BACKEND's actual timeout ceiling (DEMUCS_TIMEOUT_SECONDS /
// DEMUCS_TIMEOUT_SECONDS_HQ in config.py: 600s / 1800s), not the typical-case
// estimate shown in the UI. A tighter frontend cap means the poll gives up and
// shows "stuck" on a job the backend is still correctly processing and will
// complete — see YouTubeSeparateForm.tsx for the incident that surfaced this.
const MAX_POLL_MS_STANDARD = 12 * 60 * 1000;
const MAX_POLL_MS_HQ = 32 * 60 * 1000;

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

function humanizeError(raw: string): { title: string; hint: string } {
  const text = raw.toLowerCase();
  if (text.includes("too large") || text.includes("size")) {
    return {
      title: "This file is too large",
      hint: "Trim it down or export at a smaller size.",
    };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Upload the file again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout")) {
    return {
      title: "The connection dropped",
      hint: "Check your internet and run it again.",
    };
  }
  return {
    title: raw || "Separation failed",
    hint: "Run it again. If it keeps failing, try a different file.",
  };
}

/**
 * A radiogroup is ONE tab stop with arrows between the options — that is what
 * the role promises and what assistive tech tells the user to expect. Plain
 * buttons inside `role="radiogroup"` give a tab stop per option and no arrows,
 * which is a worse experience than having used no role at all.
 */
function useRovingRadio<T extends string>(
  values: readonly T[],
  current: T,
  onChange: (next: T) => void
) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    const i = values.indexOf(current);
    if (i < 0) return;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (i + 1) % values.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (i - 1 + values.length) % values.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = values.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(values[next]);
    refs.current[next]?.focus();
  }

  return { refs, onKeyDown };
}

export function VocalRemoverForm({ hqAvailable = false }: VocalRemoverFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SeparationUiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{
    title: string;
    hint: string;
    /** Free-tier rate limit on a metered tool — a conversion moment, not a dead end. */
    offerCredits?: boolean;
  } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [activeStem, setActiveStem] = useState<StemType>("vocals");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  // The entire per-form cost of the paywall — the same lines go in each of the
  // other three metered forms.
  //
  // onCredited closes the dead end at the end of the gate: someone who hits the
  // 402, buys, and dismisses the modal used to land back on an idle form with
  // their file still attached and no sign that the thing they wanted is now
  // possible. It fires once, only if the balance actually rose, and only after
  // the modal has closed. Routed through a ref because handleSubmit is declared
  // below and would otherwise be in its temporal dead zone here.
  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });
  const { applyBalance, rateLimitFor } = useCredits();

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  /**
   * Read by notifyOnDone, which lives inside a polling loop created once at
   * mount. Reading the state values directly there captures the mount-time
   * render, where notifications are always off — which is why this feature has
   * never fired for anyone.
   */
  const notifyEnabledRef = useRef(false);
  const notifyPermissionRef = useRef<NotificationPermission | "unsupported">("default");
  notifyEnabledRef.current = notifyEnabled;
  notifyPermissionRef.current = notifyPermission;

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const isHq = hqAvailable && quality === "hq";
  /** What the toggle currently says — used only for the pre-submit UI. */
  const selectedSpec = isHq ? HQ_SPEC : STANDARD_SPEC;
  /** What the job is actually doing — used once there IS a job. */
  const activeSpec = status === "idle" ? selectedSpec : SPEC_FOR[jobQuality];
  const canSubmit =
    Boolean(file) && !isBusy && status !== "complete" && cooldownSeconds === 0;

  /**
   * Metered is what the SERVER said, not what the toggle says. The billing
   * block only exists on metered routes, so its presence is direct evidence
   * rather than an inference from a control the user can still change.
   */
  const completedCharged = billing?.charged === "credit";

  // Looked up here (not hardcoded) so the quality cards and the
  // rate-limit-exceeded hint always agree with each other and with
  // lib/data/rate-limits.ts.
  const standardLimitLabel =
    getRateLimitLabel(STANDARD_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;
  const hqLimitLabel = getRateLimitLabel(HQ_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;

  const qualityRadio = useRovingRadio(
    ["standard", "hq"] as const,
    quality,
    (v) => setQuality(v)
  );
  const stemRadio = useRovingRadio(
    ["vocals", "instrumental"] as const,
    activeStem,
    (v) => setActiveStem(v)
  );

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

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
      const result = await Notification.requestPermission();
      setNotifyPermission(result);
      if (result === "granted") setNotifyEnabled(true);
      return;
    }
    setNotifyEnabled((v) => !v);
  };

  const poll = useCallback(
    (id: string, forQuality: SeparationQuality) => {
      if (cancelledRef.current) return;

      const maxPollMs = forQuality === "hq" ? MAX_POLL_MS_HQ : MAX_POLL_MS_STANDARD;
      if (Date.now() - pollStartedAtRef.current > maxPollMs) {
        stopPolling();
        const humanized = {
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
            const humanized = humanizeError(result.error || "Separation failed.");
            setError(humanized);
            setStatus("failed");
            notifyOnDone("Separation failed", humanized.title);
            return;
          }
          pollRef.current = setTimeout(() => poll(id, forQuality), intervalMs);
        })
        .catch((err) => {
          if (cancelledRef.current) return;
          if (err instanceof ApiError && err.status === 404) {
            stopPolling();
            const humanized = humanizeError("This job expired.");
            setError(humanized);
            setStatus("failed");
            notifyOnDone("Separation failed", humanized.title);
            return;
          }
          pollRef.current = setTimeout(() => poll(id, forQuality), intervalMs);
        });
    },
    [stopPolling, notifyOnDone]
  );

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

    try {
      const res = await submitSeparation(file, effectiveQuality);
      if (cancelledRef.current) return;
      setJobId(res.job_id);
      setJobQuality(effectiveQuality);
      setStatus("processing");
      startPolling(res.job_id, effectiveQuality);

      // The metered routes return what they just charged, so the pill and the
      // badge update from THIS response rather than a follow-up /credits/me.
      // That removes a round trip at the one moment the user is watching the
      // number — a refetch would leave the old value on screen for a beat and
      // then jump.
      setBilling(res.billing ?? null);
      if (res.billing) {
        applyBalance(res.billing.balance, res.billing.free_remaining);
      }
    } catch (err) {
      if (cancelledRef.current) return;

      // Out of credits is a DECISION POINT, not a failure. Going back to idle
      // leaves the file selected and the toggle where it was, so buying and
      // pressing the button again just works — and nothing red is ever
      // rendered for it.
      if (catchCreditError(err)) {
        setStatus("idle");
        return;
      }

      console.error("Separation submit error:", err);

      if (err instanceof ApiError && err.isRateLimit) {
        // A FREE-tier rate limit on a metered tool is the best-qualified
        // moment in the product: they've used the good mode twice and
        // immediately wanted more. Credits lift the ceiling to 30/hour, which
        // is true and useful — so this offers rather than just telling them to
        // come back later.
        const freeTierOnMetered =
          err.rateLimit?.tier === "free" && effectiveQuality === "hq";

        setError({
          title:
            effectiveQuality === "hq"
              ? "Studio Quality limit reached"
              : "You've reached the free limit",
          // Pulled from lib/data/rate-limits.ts — do not hardcode this hint
          // again; it must match the quality-card labels above.
          hint: freeTierOnMetered
            ? "That's the free-tier limit. Credits raise it to 30 per hour — and they never expire."
            : effectiveQuality === "hq"
              ? `${hqLimitLabel}. Try again later.`
              : `${standardLimitLabel}. Try again later.`,
          offerCredits: freeTierOnMetered,
        });
        setCooldownSeconds(err.retryAfterSeconds ?? 3600);
      } else {
        setError(
          humanizeError(err instanceof ApiError ? err.message : "Something went wrong.")
        );
      }
      setStatus("error");
    }
  };

  // Assigned during render, like the notify refs above, so onCredited always
  // calls the CURRENT handleSubmit rather than the one from first mount.
  submitRef.current = () => {
    void handleSubmit();
  };

  /**
   * The upgrade route returns a NEW job id, and the existing polling loop
   * handles it unchanged — same status route, same preview and download URL
   * shape. Nothing in the result rendering needs to know an upgrade happened.
   *
   * The second argument carries the billing block: the upgrade spends a credit,
   * and without it the finished result showed no tag, no receipt, and still
   * asked for a tip. UpgradeToHqCard passes it as
   * `onUpgraded(res.job_id, res.billing ?? null)`.
   */
  const handleUpgraded = useCallback(
    (newJobId: string, upgradeBilling?: SubmitBilling | null) => {
      cancelledRef.current = false;
      setJobId(newJobId);
      setJobQuality("hq");
      setResultTitle(null);
      setActiveStem("vocals");
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
    [startPolling, applyBalance]
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
    setActiveStem("vocals");
    setElapsedSeconds(0);
    setJobQuality("standard");
    setBilling(null);
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

  const stageLabel = (() => {
    const stages = jobQuality === "hq" ? HQ_STAGES : STANDARD_STAGES;
    let label = stages[0].label;
    for (const s of stages) if (elapsedSeconds >= s.at) label = s.label;
    return label;
  })();

  // Progress curve time constants tuned to roughly match each tier's real
  // expected duration above. Keyed on the RUNNING job's tier, not the toggle.
  const progress = Math.min(
    92,
    Math.round((1 - Math.exp(-elapsedSeconds / (jobQuality === "hq" ? 40 : 12))) * 100)
  );

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
            Vocal remover
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-subtle">
          {activeSpec.label} · {activeSpec.time}
        </span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {status !== "complete" && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          />
        )}

        {hqAvailable && status !== "complete" && (
          <div className="space-y-2">
            <label id="quality-label" className="text-sm font-medium text-text-primary">
              Quality
            </label>
            <div
              className="grid gap-2 sm:grid-cols-2"
              role="radiogroup"
              aria-labelledby="quality-label"
              onKeyDown={qualityRadio.onKeyDown}
            >
              {[STANDARD_SPEC, HQ_SPEC].map((option, i) => {
                const selected = quality === option.value;
                // Live limit first, static table second. See formatRateLimit.
                const liveLimit = option.toolKey ? rateLimitFor(option.toolKey) : null;
                const rateLimitLabel = liveLimit
                  ? formatRateLimit(liveLimit.max_requests, liveLimit.window_seconds)
                  : (getRateLimitLabel(option.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL);
                return (
                  <button
                    key={option.value}
                    ref={(el) => {
                      qualityRadio.refs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setQuality(option.value)}
                    disabled={isBusy}
                    className={cn(
                      "rounded-lg border p-3.5 text-left transition-all",
                      "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      selected
                        ? "border-amber-500/60 bg-amber-500/[0.07]"
                        : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-sm font-semibold",
                          selected ? "text-amber-400" : "text-text-primary"
                        )}
                      >
                        {option.value === "hq" && (
                          <Sparkles className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {option.label}
                        {/* Renders nothing unless this tool is metered right
                            now. "2 free runs left" is what makes a first-timer
                            click Studio Quality at all. */}
                        {option.toolKey && <FreeTierBadge tool={option.toolKey} />}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          selected ? "text-amber-500/80" : "text-text-subtle"
                        )}
                      >
                        {option.time}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-text-muted">
                      {option.detail}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-text-subtle">
                      {rateLimitLabel}
                    </p>
                  </button>
                );
              })}
            </div>
            {isHq && (
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-subtle">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Studio Quality can take a minute or two. The notification below
                saves you from babysitting this tab.
              </p>
            )}
          </div>
        )}

        {notifyPermission !== "unsupported" && status !== "complete" && (
          <button
            type="button"
            onClick={handleNotifyToggle}
            disabled={isBusy || !file}
            aria-pressed={notifyEnabled && notifyPermission === "granted"}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
              "disabled:pointer-events-none disabled:opacity-40",
              notifyEnabled && notifyPermission === "granted"
                ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-graphite-700/60 hover:text-text-primary"
            )}
          >
            {notifyEnabled && notifyPermission === "granted" ? (
              <Bell className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <BellOff className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="flex-1">
              {notifyPermission === "denied"
                ? "Notifications blocked — enable them in your browser settings to use this"
                : notifyEnabled && notifyPermission === "granted"
                  ? "We'll notify you when it's done"
                  : "Notify me when it's done"}
            </span>
          </button>
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

        {isBusy && (
          <div
            className="space-y-3 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-primary">
                {status === "uploading" ? "Uploading your file" : stageLabel}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Separation progress"
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
              Typically {activeSpec.time}. Keep this tab open, or use the
              notification above.
            </p>
          </div>
        )}

        {status === "complete" && jobId && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-400">
                  Done
                </p>
                {jobQuality === "hq" && <StudioQualityTag />}
              </div>
              <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
                {resultTitle || "Separation complete"}
              </p>
            </div>

            <div
              className="grid grid-cols-2 gap-2"
              role="radiogroup"
              aria-label="Stem"
              onKeyDown={stemRadio.onKeyDown}
            >
              {(["vocals", "instrumental"] as StemType[]).map((stem, i) => {
                const selected = activeStem === stem;
                return (
                  <button
                    key={stem}
                    ref={(el) => {
                      stemRadio.refs.current[i] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActiveStem(stem)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors",
                      "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                      selected
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                        : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                    )}
                  >
                    {stem === "vocals" ? (
                      <Mic2 className="h-4 w-4" aria-hidden />
                    ) : (
                      <Music4 className="h-4 w-4" aria-hidden />
                    )}
                    {stem}
                  </button>
                );
              })}
            </div>

            <AudioPlayer
              key={activeStem}
              src={getSeparationPreviewUrl(jobId, activeStem)}
            />

            {/* Directly under the player, above Download. The user has just
                heard the bleed in their own track — this is the only moment
                where the pitch makes itself. Renders nothing unless the server
                says this job is eligible, and never on a job that already ran
                at Studio Quality. */}
            {jobQuality === "standard" && (
              <UpgradeToHqCard family="separate" jobId={jobId} onUpgraded={handleUpgraded} />
            )}

            {/* Stays an <a> — a real download URL, so middle-click and
                open-in-new-tab keep working. Borrows the Button styles rather
                than repeating them. */}
            <a
              href={getSeparationDownloadUrl(jobId, activeStem)}
              download
              className={buttonStyles({
                variant: "primary",
                size: "lg",
                className: "w-full",
              })}
            >
              <Download />
              Download {activeStem}
            </a>

            <CreditReceipt billing={billing} />

            {/* Asking for a tip immediately after charging someone a credit is
                a bad look. Keyed on what was CHARGED, so a free-tier Studio
                Quality run still gets the block — nobody paid for that one. */}
            {!completedCharged && <SupportBlock />}

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw />
              Separate another track
            </Button>
          </div>
        )}

        {isFailed && error && (
          <div className="space-y-4">
            <div
              className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
              role="alert"
            >
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{error.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                  {error.hint}
                </p>
                {error.offerCredits && (
                  <Link
                    href="/pricing"
                    onClick={() => trackCredits("credits_rate_limited", { tool: "separate-hq" })}
                    className="mt-2 inline-block rounded text-xs font-medium text-amber-400 outline-none underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  >
                    See credit packs →
                  </Link>
                )}
              </div>
            </div>
            <SupportBlock />
          </div>
        )}

        {/* Hidden until there's a file, rather than shown disabled — see the
            matching note in JobToolForm. isFailed keeps "Try again"
            reachable after an error. */}
        {status !== "complete" && (file || isFailed) && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={!canSubmit && !isBusy}
            loading={isBusy}
          >
            {!isBusy && <Mic2 />}
            {isBusy
              ? "Working"
              : cooldownSeconds > 0
                ? `Try again in ${formatCooldown(cooldownSeconds)}`
                : isFailed
                  ? "Try again"
                  : isHq
                    ? "Remove vocals (Studio Quality)"
                    : "Remove vocals"}
          </Button>
        )}
      </div>

      {gate}
    </div>
  );
}