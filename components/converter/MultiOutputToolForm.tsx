"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AudioLines,
  Download,
  Drum,
  Guitar,
  ListMusic,
  Mic2,
  Music2,
  Music4,
  Play,
  RotateCcw,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { Button, buttonStyles } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { UpgradeToHqCard } from "@/components/credits/UpgradeToHqCard";
import { CreditReceipt, StudioQualityTag } from "@/components/credits/CreditReceipt";
import type { SubmitBilling } from "@/lib/types/converter";
import { trackCredits } from "@/lib/analytics";
import type { MeteredToolKey } from "@/lib/types/credits";
import type { UpgradeFamily } from "@/lib/api/credits";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import {
  getMultiOutputStatus,
  getMultiOutputPreviewUrl,
  getMultiOutputDownloadUrl,
  ApiError,
  type JobSubmitResponse,
} from "@/lib/api/railway";
import { cn } from "@/lib/utils/cn";
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  ResultHeader,
  Section,
  ValidationNote,
  WorkingPanel,
  easedProgress,
  formatCooldown,
  formatElapsed,
  isRetryableSubmitError,
  sleep,
  serverFailure,
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

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * Rebuilt on JobFormKit, so the header, step rail, working panel, result
 * header, error panel and action bar are the same components the other two
 * forms use. Every prop is unchanged — /stems, /silence-split and
 * /youtube/stems keep working untouched.
 *
 * Three bugs went with the rewrite:
 *
 * 1. A REJECTED POLL WAS TREATED AS A SLOW JOB. Only 404 was terminal here;
 *    JobToolForm already handled 401/403 and this file never got the fix. An
 *    auth failure repeated identically for the full twelve minutes and then
 *    reported "taking unusually long" about a job the server had settled in
 *    about one. Now shared, via terminalPollError().
 *
 * 2. CANCEL LEFT THE LAST RUN'S RECEIPT BEHIND. `billing` and
 *    `completedMetered` survived handleCancel, so an idle form still believed
 *    it was holding a charged run: the next cancel said "Stop watching… the
 *    credit is already spent" about a job that had never started, and the tip
 *    block stayed suppressed. handleReset cleared both; handleCancel didn't.
 *
 * 3. STALE OUTPUTS SURVIVED CANCEL. jobId was nulled but `outputs` and
 *    `activeOutput` weren't, so the previous run's track list sat in state
 *    behind an idle form.
 *
 * Kept from the previous pass and still true:
 *  · An upgraded job is polled with the HQ ceiling, passed explicitly, not
 *    captured from whatever tier the toggle was on at first mount.
 *  · The upgrade reports its own billing, so the receipt is right.
 *  · onComplete/onFailed are read through refs, so `poll` is stable and a
 *    caller's notification handler can never be captured stale.
 */

const DEFAULT_MAX_POLL_MS = 12 * 60 * 1000;
const STEPS = ["File", "Run", "Result"] as const;

/**
 * SUBMIT errors only.
 *
 * A failed JOB's message comes from the server already written for the user —
 * see serverFailure at the poll site. This handles the other path, where the
 * text is an ApiError message and generic copy is often the better read.
 */
function humanizeError(raw: string): FormError {
  const text = raw.toLowerCase();

  if (text.includes("too large") || text.includes("size")) {
    return { title: "This file is too large", hint: "Trim it down or export at a smaller size." };
  }
  if (text.includes("format") || text.includes("codec") || text.includes("unsupported")) {
    return {
      title: "This file format isn't supported",
      hint: "Convert it to WAV or MP3 first, then try again.",
    };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Upload the file again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout") || text.includes("connection")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return { title: raw, hint: "Run it again. If it keeps failing, try a different file." };
}

// Default tab label for a raw output name. Handles the two shapes the backend
// actually produces: plain stem names ("vocals" -> "Vocals") and
// silence-split's zero-padded segment names ("segment_01" -> "Segment 1"). A
// caller with a genuinely different naming scheme can override this via the
// `formatOutputName` prop rather than this file needing to know about every
// future naming convention.
function defaultFormatOutputName(name: string): string {
  const segmentMatch = name.match(/^segment_(\d+)$/i);
  if (segmentMatch) return `Segment ${parseInt(segmentMatch[1], 10)}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Default icon per known output name, purely decorative — falls back to a
// generic waveform glyph for anything unrecognized (future stem types, custom
// names) rather than needing this file updated for every new one.
function defaultOutputIcon(name: string): ReactNode {
  const key = name.toLowerCase();
  if (key === "vocals") return <Mic2 className="h-4 w-4" aria-hidden />;
  if (key === "drums") return <Drum className="h-4 w-4" aria-hidden />;
  if (key === "bass" || key === "guitar") return <Guitar className="h-4 w-4" aria-hidden />;
  if (key === "piano") return <Music4 className="h-4 w-4" aria-hidden />;
  if (key === "other") return <Music2 className="h-4 w-4" aria-hidden />;
  if (/^segment_\d+$/i.test(key)) return <ListMusic className="h-4 w-4" aria-hidden />;
  return <AudioLines className="h-4 w-4" aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface MultiOutputToolFormProps {
  /**
   * Backend route segment used for status/preview/download — e.g. "stems",
   * "silence-split", "youtube/stems". NOT necessarily the same route the file
   * was submitted to: /stems and /stems-hq both use endpoint="stems" here,
   * since the backend stores both under the same job_type and the same
   * status/preview/download routes serve either tier.
   */
  endpoint: string;
  /** Query param name the backend's preview/download routes expect for this
   * tool: "stem" for /stems and /youtube/stems, "segment" for
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
  /** Stage labels shown while the job runs, keyed to elapsed seconds. Leaving
   * this unset falls back to a single static processingLabel — worth setting
   * for anything slower than ~15s, which is most of what uses this form. */
  stages?: ProcessingStage[];
  /** Give up polling after this long rather than spinning forever. */
  maxPollMs?: number;
  /**
   * Time constant for the progress curve, in seconds. Bigger for slower tools.
   * Roughly: the bar passes 60% at `progressTau` seconds and 90% at ~2.3x it,
   * so pick something near the tool's TYPICAL duration rather than its ceiling.
   *
   * Default 25 suits a standard separation. Four-stem HQ wants ~110 — at 25 the
   * bar reaches 92% about a minute in and then stops, on the longest wait in
   * the product.
   */
  progressTau?: number;
  /**
   * Timings for a job started by the upgrade card. An upgrade always produces
   * an HQ job, whose backend ceiling is far higher than the standard tier's —
   * without these the upgraded run is polled against whatever tier the caller's
   * toggle happened to be on, and gets declared stuck while the backend is
   * still working. Default to the normal values, so a tool with no HQ tier is
   * unaffected.
   */
  upgradePollIntervalMs?: number;
  upgradeMaxPollMs?: number;
  /** Fires once, when the job finishes successfully — after outputs are set but
   * in the same tick as the status flip to "complete". Intended for side
   * effects (browser notifications, analytics) that shouldn't block or alter
   * the render; not called on every render. */
  onComplete?: (outputs: string[], title: string | null) => void;
  /** Fires once, when the job fails or expires — receives the human-readable
   * error message shown in the UI. Same side-effect-only intent. */
  onFailed?: (message: string) => void;
  /**
   * Actually submits the job. Takes just the file — any extra fields (quality
   * tier, target format, silence threshold, etc.) are the CALLER's concern,
   * closed over in this function, so this component never needs to know what a
   * given tool's extra parameters are.
   */
  onSubmit: (file: File) => Promise<JobSubmitResponse>;
  /** Optional controls rendered above the submit button — e.g. a Standard/HQ
   * toggle for stems, or format+threshold fields for silence-split. Receives
   * current file + disabled state, same as JobToolForm's renderControls. */
  renderControls?: (file: File | null, disabled: boolean) => ReactNode;
  /** Rate-limit message shown on a 429 — differs per tool/tier, so it's a prop
   * rather than a hardcoded string. */
  rateLimitMessage?: string;
  /** Overrides the default tab-label formatting for output names. */
  formatOutputName?: (name: string) => string;
  /** Overrides the default per-row icon for a given output name. */
  getOutputIcon?: (name: string) => ReactNode;
  maxSubmitRetries?: number;
  /**
   * OPT-IN CREDITS WIRING.
   *
   * This component is shared by /stems, /silence-split and /youtube/stems. Only
   * some of those are ever metered, so credits are props rather than built in —
   * silence-split passes neither and behaves exactly as before.
   *
   * `meteredToolKey` is the key for the CURRENTLY SELECTED tier, so the caller
   * passes null while Standard is chosen. It drives only the free-tier 429
   * offer; the 402 gate is unconditional and harmless.
   */
  meteredToolKey?: MeteredToolKey | null;
  /**
   * Enables the upgrade CTA under the result player. "stems" for the 4-stem
   * tools; omit for anything with no HQ equivalent.
   */
  upgradeFamily?: UpgradeFamily;
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
  progressTau = 25,
  upgradePollIntervalMs,
  upgradeMaxPollMs,
  onComplete,
  onFailed,
  onSubmit,
  renderControls,
  rateLimitMessage,
  formatOutputName = defaultFormatOutputName,
  getOutputIcon = defaultOutputIcon,
  maxSubmitRetries = 1,
  meteredToolKey = null,
  upgradeFamily,
}: MultiOutputToolFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  /**
   * Whether the FINISHED job ran on a metered route. Derived from the presence
   * of the `billing` block rather than from the caller's current toggle, which
   * the user can change while a result is on screen.
   */
  const [completedMetered, setCompletedMetered] = useState(false);
  /** What the server said it charged. Reported verbatim, never inferred. */
  const [billing, setBilling] = useState<SubmitBilling | null>(null);

  const { applyBalance } = useCredits();
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<string[]>([]);
  const [activeOutput, setActiveOutput] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  const isBusy = status === "uploading" || status === "processing";
  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isBusy);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  /**
   * Seeded from the endpoint's real window rather than a flat guess.
   *
   * Every endpoint this shell receives IS a RATE_LIMITS key — "stems" (6/hour),
   * "silence-split" (3 per 5 min), "youtube/stems" (6/hour) — so this resolves
   * to a real window rather than the helper's default. Note that /stems and
   * /stems-hq both arrive as endpoint="stems", so an HQ 429 seeds from the
   * FREE tier's window; the server's Retry-After overrides it whenever present,
   * which on a tiered route it should be.
   *
   * STATE, NOT A REF, because CooldownBar renders it. As a ref it only showed
   * the right ceiling because the setCooldownSeconds call on the next line
   * happened to trigger the render that read it.
   */
  const [cooldownCeiling, setCooldownCeiling] = useState(getRetryAfterFallback(endpoint));

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  /**
   * Callers pass these as inline arrows, so depending on them directly rebuilt
   * `poll` on every keystroke and every toggle. Through refs, `poll` is stable
   * AND always calls the caller's latest handler — which is what keeps a
   * notification opt-in from being captured in its off state.
   */
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  /*
    Synced in an EFFECT, not assigned during render. Writing to a ref while
    rendering is what react-hooks/refs rejects, and it stops being merely untidy
    the moment the React Compiler is enabled: a memoised render can be skipped,
    and the assignment with it. An effect with no dependency array runs after
    every render, so the value a callback reads is always the latest one.
  */
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailedRef.current = onFailed;
  });

  // Re-runs the submit after a purchase closes the gate. Through a ref because
  // handleSubmit is declared below.
  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });

  const isFailed = status === "failed" || status === "error";
  const canSubmit = Boolean(file) && !isBusy && status !== "complete" && cooldownSeconds === 0;

  /**
   * Keyed on what was CHARGED, not on whether the route was metered. A
   * free-tier Studio Quality run is still a free result, so it keeps the tip
   * block; only a run someone paid a credit for loses it. Also drives the
   * honest cancel copy.
   */
  const chargedRun = billing?.charged === "credit";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /* --- polling: recursive timeout, so slow responses never stack --- */
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
        fail({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start a fresh run.",
        });
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
          onCompleteRef.current?.(result.outputs, result.title);
          return;
        }
        if (result.status === "failed") {
          /*
            VERBATIM. Confirmed against routes/_shared.py: an AudioToolError's
            message goes into job["error"] unmodified because it is written for
            the person who uploaded the file — and it is almost always more
            specific than anything we could write. The silence-split cap names
            the real segment count AND the fix; humanizeError used to discard
            that and tell the user to try a different file.

            Our copy is the fallback, for when the server sent nothing.
          */
          fail(
            serverFailure(result.error, {
              title: "Processing failed",
              hint: "Run it again. If it keeps failing, try a different file.",
            })
          );
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        // 401/403/404 are answers, not blips: waiting cannot change them.
        const terminal = terminalPollError(err);
        if (terminal) {
          fail(terminal);
          return;
        }
        // Transient network blips fall through to the next tick.
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
    // A new file describes a new job, so the previous one's receipt must not
    // survive into it.
    setBilling(null);
    setCompletedMetered(false);
  };

  /**
   * The upgrade route returns a NEW job id that works against the same
   * status/preview/download routes, so the existing polling loop handles it
   * unchanged — but NOT with the same timings. An upgrade is always to HQ, so it
   * gets the HQ ceiling explicitly rather than inheriting whatever tier the
   * caller's toggle was on.
   */
  const handleUpgraded = useCallback(
    (newJobId: string, upgradeBilling?: SubmitBilling | null) => {
      cancelledRef.current = false;
      setJobId(newJobId);
      setCompletedMetered(true);
      setResultTitle(null);
      setOutputs([]);
      setActiveOutput(null);
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
    [
      startPolling,
      applyBalance,
      setElapsedSeconds,
      upgradePollIntervalMs,
      pollIntervalMs,
      upgradeMaxPollMs,
      maxPollMs,
    ]
  );

  /** Everything about the current run, gone. Used by reset and cancel alike —
   *  they differ only in whether the file survives. */
  const clearRun = useCallback(() => {
    stopPolling();
    cancelledRef.current = true;
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setOutputs([]);
    setActiveOutput(null);
    setRetryNotice(null);
    setElapsedSeconds(0);
    // A cleared form describes no job, so it must not carry the last one's
    // receipt into the next render — which is what made an idle form claim a
    // credit had been spent.
    setBilling(null);
    setCompletedMetered(false);
  }, [stopPolling, setElapsedSeconds]);

  const handleReset = () => {
    clearRun();
    setFile(null);
    setValidationError(null);
  };

  const handleCancel = () => clearRun();

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
        const res = await onSubmit(file);
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

        // Out of credits is a decision point, not a failure. Back to idle leaves
        // the file and the tier selection intact, so buying and pressing the
        // button again just works.
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
          // The best-qualified moment in the product: they used the good mode up
          // to its free ceiling and immediately wanted more.
          const freeTierOnMetered = err.rateLimit?.tier === "free" && Boolean(meteredToolKey);

          setError({
            title: freeTierOnMetered ? "Studio Quality limit reached" : "You're going a little fast",
            hint: freeTierOnMetered
              ? "That's the free-tier limit. Credits raise it to 30 per hour — and they never expire."
              : rateLimitMessage || "Wait for the timer, then run it again.",
            offerCredits: freeTierOnMetered,
          });
          // The endpoint's real window, not a flat minute — /silence-split runs
          // on a five-minute window, so re-enabling at sixty seconds just buys
          // another 429.
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

  // Assigned during render so onCredited always calls the CURRENT handleSubmit.
  useEffect(() => {
    submitRef.current = () => {
      void handleSubmit();
    };
  });

  const stageIndex = stageIndexFor(stages, elapsedSeconds);
  const stageLabel = (() => {
    if (status === "uploading") return retryNotice || "Uploading your file";
    if (stageIndex < 0 || !stages) return processingLabel;
    return stages[stageIndex].label;
  })();

  // Called once and checked, rather than inlined into the JSX. When a tool's
  // controls return null (TrimControls does, until a file is chosen) the wrapper
  // still rendered — an empty element collecting a margin, which is why the card
  // had a phantom gap under the dropzone and looked bottom-heavy.
  const controls = renderControls?.(file, isBusy) ?? null;

  const progress = easedProgress(elapsedSeconds, progressTau);
  // Choosing a file is still step one. `isBusy || file` lit "Run" before
  // anything ran, and disagreed with the two sibling shells.
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
        /* Hidden until there's a file, rather than shown disabled — a full-width
           h-12 slab at 40% opacity carries the weight of the primary action
           while doing nothing, and a dimmed amber fill renders as a muddy brown
           bar. isFailed keeps "Try again" reachable after an error. */
        status !== "complete" && (file || isFailed) ? (
          <>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit && !isBusy}
              loading={isBusy}
            >
              {!isBusy && <Wand2 />}
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
      {/* SOURCE — the file, and anything wrong with it. */}
      {status !== "complete" && (
        <Section className="space-y-4">
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept={fileAccept}
          />
          {/* An error about the file belongs beside the file, not below the
              tool's controls. */}
          {validationError && <ValidationNote message={validationError} />}
        </Section>
      )}

      {/* SETTINGS — whatever this tool needs before it can run. */}
      {status !== "complete" && controls && <Section>{controls}</Section>}

      {/* WORKING */}
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

      {/* RESULT */}
      {status === "complete" && jobId && (
        <Section className="space-y-4">
          <ResultHeader
            verb={resultVerb}
            title={resultTitle || `${outputs.length} outputs ready`}
            meta={`Finished in ${formatElapsed(elapsedSeconds)}`}
            /* Marks WHICH model produced these files. Someone downloading four
               stems over a week can't tell from the filenames. */
            tag={completedMetered ? <StudioQualityTag /> : undefined}
          />

          {/*
            Track-list layout, not tabs: every output is visible as its own row
            (icon, name, independent download button) rather than hidden behind a
            pill switcher. Scales from 4 stems to 50 silence-split segments
            without the list becoming unusable — the container caps height and
            scrolls once it's tall enough to need it, rather than pushing the
            whole page down.

            Only ONE <audio> element exists at a time (inside AudioPlayer below,
            bound to activeOutput) regardless of how many rows are listed —
            clicking a row swaps its src rather than mounting a player per
            output.
          */}
          {outputs.length > 0 && (
            <div
              role="group"
              aria-label="Outputs"
              className="af-scroll max-h-72 divide-y divide-graphite-800 overflow-y-auto rounded-xl border border-graphite-700"
            >
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
                    {/* Not a <Button>: this is the row's select target,
                        full-width and left-aligned with its own icon treatment.
                        Button would have to be stripped of height, padding,
                        radius and centring to fit. */}
                    <button
                      type="button"
                      onClick={() => setActiveOutput(name)}
                      aria-pressed={isActive}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          isActive
                            ? "bg-amber-500 text-graphite-950"
                            : "bg-graphite-800 text-text-muted"
                        )}
                      >
                        {isActive ? (
                          <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
                        ) : (
                          getOutputIcon(name)
                        )}
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

                    {/* Borrows the ghost icon-button styling, sized down to h-8 so
                        the row height doesn't grow. Stays an <a> because it's a
                        real download URL. */}
                    <a
                      href={getMultiOutputDownloadUrl(endpoint, jobId, name, queryParam)}
                      download
                      aria-label={`Download ${formatOutputName(name)}`}
                      className={buttonStyles({
                        variant: "ghost",
                        size: "icon-sm",
                        className: "shrink-0 hover:text-amber-400",
                      })}
                    >
                      <Download />
                    </a>
                  </div>
                );
              })}
            </div>
          )}

          {activeOutput && (
            <AudioPlayer
              key={activeOutput}
              src={getMultiOutputPreviewUrl(endpoint, jobId, activeOutput, queryParam)}
            />
          )}

          {/* Under the player, above the downloads. The user has just heard the
              bleed in their own track — the only moment where the pitch makes
              itself. Silent unless the server says this job is eligible, and
              never on a job that already ran at Studio Quality. */}
          {upgradeFamily && !completedMetered && (
            <UpgradeToHqCard family={upgradeFamily} jobId={jobId} onUpgraded={handleUpgraded} />
          )}

          <CreditReceipt billing={billing} />

          {/* Asking for a tip right after charging someone a credit is a bad
              look. A free-tier run is still free, so it keeps the block. */}
          {!chargedRun && <SupportBlock />}

          <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
            <RotateCcw />
            Process another file
          </Button>
        </Section>
      )}

      {/* FAILED */}
      {isFailed && error && (
        <Section className="space-y-4">
          <ErrorPanel error={error}>
            {error.offerCredits && (
              <Link
                href="/pricing"
                onClick={() =>
                  trackCredits("credits_rate_limited", { tool: meteredToolKey ?? undefined })
                }
                className="mt-2 inline-block rounded text-xs font-medium text-amber-400 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                See credit packs →
              </Link>
            )}
          </ErrorPanel>
          {/*
            NO TIP JAR ON A BROKEN RUN.
            These forms carry two failure states and they are not the same thing.
            `error` means the SUBMIT was rejected — a file too large, an
            unsupported format, a rate limit — which is the form doing its job,
            and asking for support after one is fine. `failed` means the job ran
            and broke, or polling gave up on it. Following "This is taking
            unusually long" with "Enjoying AudioForges? Buy us a coffee" is the
            worst timing on the site.
          */}
          {status === "error" && <SupportBlock />}
        </Section>
      )}

    </FormShell>

      {gate}
    </>
  );
}