"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic2, Download, Sparkles, Music4, Bell, BellOff, RotateCcw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  Section,
  ValidationNote,
  WorkingPanel,
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
import {
  ControlField,
  Hint,
  OptionCards,
  Segmented,
  ToggleRow,
  type CardOption,
} from "@/components/converter/ToolControls";
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
import { getRateLimitLabel, getRetryAfterFallback } from "@/lib/data/rate-limits";
import type { SeparationUiState, StemType, SubmitBilling } from "@/lib/types/converter";
import type { MeteredToolKey } from "@/lib/types/credits";
import { SupportBlock } from "@/components/ui/SupportBlock";
import Link from "next/link";
import { trackCredits } from "@/lib/analytics";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import { UpgradeToHqCard } from "@/components/credits/UpgradeToHqCard";
import { CreditReceipt, StudioQualityTag } from "@/components/credits/CreditReceipt";

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
 * MOVED ONTO THE KIT: the step rail (File → Separate → Result), the working
 * panel with its stage checklist, the result and error cards, the elapsed and
 * cooldown timers, the progress curve, and a cooldown bar you can watch drain
 * rather than a number ticking inside the button label.
 *
 * MOVED ONTO ToolControls: the quality picker (OptionCards), the notify switch
 * (ToggleRow) and the stem switch (Segmented). That deletes the local
 * useRovingRadio hook — it was correct, and it was the third copy of a
 * behaviour that now lives in one place.
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
   * places describing this route can be diffed by eye. Null on the free tier.
   */
  toolKey: MeteredToolKey | null;
}

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

const STEPS = ["File", "Separate", "Result"] as const;

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

export function VocalRemoverForm({ hqAvailable = false }: VocalRemoverFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SeparationUiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [activeStem, setActiveStem] = useState<StemType>("vocals");

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
  const { applyBalance, rateLimitFor } = useCredits();

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
  /** What the toggle currently says — used only for the pre-submit UI. */
  const selectedSpec = isHq ? HQ_SPEC : STANDARD_SPEC;
  /** What the job is actually doing — used once there IS a job. */
  const activeSpec = status === "idle" ? selectedSpec : SPEC_FOR[jobQuality];
  const canSubmit = Boolean(file) && !isBusy && !isComplete && cooldownSeconds === 0;

  const step: 1 | 2 | 3 = isComplete ? 3 : isBusy ? 2 : 1;

  /**
   * Metered is what the SERVER said, not what the toggle says. The billing
   * block only exists on metered routes, so its presence is direct evidence
   * rather than an inference from a control the user can still change.
   */
  const completedCharged = billing?.charged === "credit";
  /** Drives the honest cancel copy while a paid run is in flight. */
  const chargedRun = billing?.charged === "credit";

  const standardLimitLabel =
    getRateLimitLabel(STANDARD_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;
  const hqLimitLabel = getRateLimitLabel(HQ_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;

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

    try {
      const res = await submitSeparation(file, effectiveQuality);
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
            ? "That's the free-tier limit. Credits raise it to 30 per hour — and they never expire."
            : effectiveQuality === "hq"
              ? `${hqLimitLabel}. Try again later.`
              : `${standardLimitLabel}. Try again later.`,
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
    // Was left behind: a cancelled charged run kept its receipt, so the NEXT
    // run's "Stop watching" copy and tip-jar suppression were decided by a
    // previous job's billing block.
    setBilling(null);
  };

  const stages = jobQuality === "hq" ? HQ_STAGES : STANDARD_STAGES;
  const stageIndex = stageIndexFor(stages, elapsedSeconds);
  const stageLabel =
    status === "uploading" ? "Uploading your file" : (stages[stageIndex]?.label ?? "Separating");

  const qualityOptions: CardOption<SeparationQuality>[] = [STANDARD_SPEC, HQ_SPEC].map(
    (option) => {
      // Live limit first, static table second. See formatRateLimit.
      const liveLimit = option.toolKey ? rateLimitFor(option.toolKey) : null;
      return {
        value: option.value,
        title: option.label,
        titleBefore:
          option.value === "hq" ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : undefined,
        // Renders nothing unless this tool is metered right now. "2 free runs
        // left" is what makes a first-timer click Studio Quality at all.
        titleAfter: option.toolKey ? <FreeTierBadge tool={option.toolKey} /> : undefined,
        meta: option.time,
        detail: option.detail,
        footnote: liveLimit
          ? formatRateLimit(liveLimit.max_requests, liveLimit.window_seconds)
          : (getRateLimitLabel(option.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL),
      };
    }
  );

  const notifyOn = notifyEnabled && notifyPermission === "granted";

  const footer = isComplete ? null : file || isFailed ? (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={!canSubmit && !isBusy}
        loading={isBusy}
        loadingLabel="Separating"
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
      <CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeiling} />
    </div>
  ) : null;

  return (
    <>
      <FormShell
        toolLabel="Vocal remover"
        toolMeta={`${activeSpec.label} · ${activeSpec.time}`}
        steps={STEPS}
        step={step}
        busy={isBusy}
        failed={isFailed}
        complete={isComplete}
        footer={footer}
      >
        {/* SOURCE — the file, and anything wrong with it. */}
        {!isComplete && (
          <Section>
            <div className="space-y-4">
              <FileDropZone
                onFileSelect={handleFileSelect}
                currentFile={file}
                onClear={handleReset}
                disabled={isBusy}
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
              />

              {/* An error about the file belongs beside the file, not below
                  two unrelated controls. */}
              {validationError && <ValidationNote message={validationError} />}
            </div>
          </Section>
        )}

        {/* SETTINGS — the two choices, in one zone with one baseline. */}
        {!isComplete && (hqAvailable || notifyPermission !== "unsupported") && (
          <Section>
            <div className="space-y-5">
              {hqAvailable && (
                <ControlField
                  as="fieldset"
                  label="Quality"
                  hint={
                    isHq ? (
                      <Hint>
                        Studio Quality can take a minute or two. The notification below saves you
                        from babysitting this tab.
                      </Hint>
                    ) : undefined
                  }
                >
                  <OptionCards
                    label="Separation quality"
                    options={qualityOptions}
                    value={quality}
                    onChange={setQuality}
                    disabled={isBusy}
                  />
                </ControlField>
              )}

              {/*
                HIDDEN UNTIL THERE IS A FILE, not shown disabled. With no file
                chosen, the resting state ended on a full-width greyed-out row
                that does nothing — and a disabled control is still a control
                the eye has to process and dismiss.
              */}
              {notifyPermission !== "unsupported" && file && (
                <ToggleRow
                  pressed={notifyOn}
                  onToggle={handleNotifyToggle}
                  disabled={isBusy}
                  iconOn={<Bell className="h-4 w-4" />}
                  iconOff={<BellOff className="h-4 w-4" />}
                >
                  {notifyPermission === "denied"
                    ? "Notifications blocked — enable them in your browser settings to use this"
                    : notifyOn
                      ? "We'll notify you when it's done"
                      : "Notify me when it's done"}
                </ToggleRow>
              )}
            </div>
          </Section>
        )}

        {/* WORKING */}
        {isBusy && (
          <Section>
            <WorkingPanel
              stageLabel={stageLabel}
              stages={stages}
              stageIndex={stageIndex}
              showStageList={status === "processing"}
              elapsedSeconds={elapsedSeconds}
              progress={easedProgress(elapsedSeconds, jobQuality === "hq" ? 40 : 12)}
              expectedRange={activeSpec.time}
              chargedRun={chargedRun}
              onCancel={handleCancel}
              waveform={<Waveform />}
            />
          </Section>
        )}

        {/* RESULT */}
        {isComplete && jobId && (
          <Section>
            <div className="space-y-4" role="status" aria-live="polite">
              <ResultHeader
                verb="Done"
                title={resultTitle || "Separation complete"}
                meta={`Finished in ${formatElapsed(elapsedSeconds)}`}
                tag={jobQuality === "hq" ? <StudioQualityTag /> : undefined}
              />

              <Segmented
                label="Stem"
                value={activeStem}
                onChange={setActiveStem}
                options={[
                  { value: "vocals", label: "Vocals", icon: <Mic2 className="h-4 w-4" aria-hidden /> },
                  {
                    value: "instrumental",
                    label: "Instrumental",
                    icon: <Music4 className="h-4 w-4" aria-hidden />,
                  },
                ]}
              />

              {/* Keyed per stem so the player remounts on a new source. The
                  envelope cache in waveform.ts means switching back and forth
                  no longer re-decodes the file each time. */}
              <AudioPlayer key={activeStem} src={getSeparationPreviewUrl(jobId, activeStem)} />

              {/* Directly under the player, above Download. The user has just
                  heard the bleed in their own track — this is the only moment
                  where the pitch makes itself. Renders nothing unless the
                  server says this job is eligible, and never on a job that
                  already ran at Studio Quality. */}
              {jobQuality === "standard" && (
                <UpgradeToHqCard family="separate" jobId={jobId} onUpgraded={handleUpgraded} />
              )}

              {/* Stays an <a> — a real download URL, so middle-click and
                  open-in-new-tab keep working. */}
              <a
                href={getSeparationDownloadUrl(jobId, activeStem)}
                download
                className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
              >
                <Download />
                Download {activeStem}
              </a>

              <CreditReceipt billing={billing} />

              {/* Asking for a tip immediately after charging someone a credit
                  is a bad look. Keyed on what was CHARGED, so a free-tier
                  Studio Quality run still gets the block — nobody paid for
                  that one. */}
              {!completedCharged && <SupportBlock />}

              <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
                <RotateCcw />
                Separate another track
              </Button>
            </div>
          </Section>
        )}

        {/* FAILED */}
        {isFailed && error && (
          <Section>
            <div className="space-y-4">
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
              {/*
                NO TIP JAR ON A BROKEN RUN.
                `error` means the SUBMIT was rejected — a file too large, an
                unsupported format, a rate limit — which is the form doing its
                job. `failed` means the job ran and broke, or polling gave up.
                Following "This is taking unusually long" with "Buy us a
                coffee" is the worst timing on the site.
              */}
              {status === "error" && <SupportBlock />}
            </div>
          </Section>
        )}
      </FormShell>

      {gate}
    </>
  );
}