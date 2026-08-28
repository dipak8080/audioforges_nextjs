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
import { Button, buttonStyles } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
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
import { validateAudioFile } from "@/lib/utils/validation";
import {
  getMultiOutputStatus,
  getMultiOutputPreviewUrl,
  getMultiOutputDownloadUrl,
  ApiError,
  type JobSubmitResponse,
} from "@/lib/api/railway";
import { cn } from "@/lib/utils/cn";

/**
 * ── THIS PASS: SIX FIXES ───────────────────────────────────────────────
 *
 * Every new prop is OPTIONAL and every default reproduces the old behaviour,
 * so /silence-split — which passes no credits props at all — is unchanged.
 *
 * 1. AN UPGRADED JOB WAS POLLED WITH THE WRONG CEILING. `handleUpgraded` had
 *    `[]` deps and an eslint-disable, so it captured `startPolling` — and
 *    through it `maxPollMs` and `pollIntervalMs` — from FIRST MOUNT, when the
 *    caller's quality toggle still said Standard. An upgrade is always to HQ,
 *    whose backend timeout is 1800s, but the captured frontend cap was the
 *    standard 720s. Any upgraded run past twelve minutes was declared "taking
 *    unusually long" on a job the backend was still processing and would have
 *    completed. Four-stem HQ is the slowest job in the product, so this is
 *    where it bit hardest.
 *
 * 2. THE UPGRADE PRODUCED NO RECEIPT. `handleUpgraded` took only a job id, so
 *    `billing` stayed at whatever the original free run left it — null. After
 *    spending a credit the result showed no "1 credit used" line and kept
 *    asking for a tip.
 *
 * 3. `poll` CHURNED ON EVERY RENDER. It depended on the `onComplete` and
 *    `onFailed` props, which callers pass as inline arrows. Read through refs
 *    now, which also means a caller's notification handler can never be
 *    captured stale.
 *
 * 4. CANCEL WAS DISHONEST ON A CHARGED RUN. It stops the poll; it does not
 *    stop the job or refund the credit. On a free tool that's fine. On a run
 *    the user just paid for, pressing a button labelled "Cancel" and losing
 *    both the credit and the result is the worst outcome this form can
 *    produce. The control now says what it actually does, and says the credit
 *    is already spent, so the choice is informed.
 *
 * 5. THE GATE WAS A DEAD END. A 402 opened the modal, the user bought, and
 *    they were returned to an idle form still holding their file with no sign
 *    the thing they wanted is now possible. `onCredited` re-runs the submit.
 *
 * 6. THE OUTPUT ROWS HAD NO VISIBLE KEYBOARD FOCUS. `focus:outline-none` with
 *    no focus-visible ring means a keyboard user tabbing a 50-segment
 *    silence-split list has no idea where they are.
 */

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

/** Timings for one polling run. Carried through the recursion so an upgraded
 *  job cannot inherit the tier it was upgraded FROM. */
interface PollTiming {
  intervalMs: number;
  maxMs: number;
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
   * Timings for a job started by the upgrade card. An upgrade always produces
   * an HQ job, whose backend ceiling is far higher than the standard tier's —
   * without these the upgraded run is polled against whatever tier the
   * caller's toggle happened to be on, and gets declared stuck while the
   * backend is still working. Default to the normal values, so a tool with no
   * HQ tier is unaffected.
   */
  upgradePollIntervalMs?: number;
  upgradeMaxPollMs?: number;
  /** Fires once, when the job finishes successfully — after outputs are set
   * but in the same tick as the status flip to "complete". Intended for side
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
   * This component is shared by /stems, /silence-split and /youtube/stems.
   * Only some of those are ever metered, so credits are props rather than
   * built in — silence-split passes neither and behaves exactly as before.
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
  const [error, setError] = useState<{
    title: string;
    hint: string;
    /** Free-tier rate limit on a metered tool — an offer, not a dead end. */
    offerCredits?: boolean;
  } | null>(null);
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
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

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
    rendering is what react-hooks/refs rejects, and it stops being merely
    untidy the moment the React Compiler is enabled: a memoised render can be
    skipped, and the assignment with it. An effect with no dependency array
    runs after every render, so the value a callback reads is always the
    latest one.
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

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const canSubmit = Boolean(file) && !isBusy && status !== "complete" && cooldownSeconds === 0;

  /**
   * Keyed on what was CHARGED, not on whether the route was metered. A
   * free-tier Studio Quality run is still a free result, so it keeps the tip
   * block; only a run someone paid a credit for loses it. Also drives the
   * honest cancel copy below.
   */
  const chargedRun = billing?.charged === "credit";

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
    async (id: string, timing: PollTiming) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > timing.maxMs) {
        stopPolling();
        const humanized = {
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start a fresh run.",
        };
        setError(humanized);
        setStatus("failed");
        onFailedRef.current?.(humanized.title);
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
        // Transient network blips fall through to the next tick.
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
   * unchanged — but NOT with the same timings. An upgrade is always to HQ, so
   * it gets the HQ ceiling explicitly rather than inheriting whatever tier the
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
    [startPolling, applyBalance, upgradePollIntervalMs, pollIntervalMs, upgradeMaxPollMs, maxPollMs]
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
    setOutputs([]);
    setActiveOutput(null);
    setRetryNotice(null);
    setElapsedSeconds(0);
    setBilling(null);
    setCompletedMetered(false);
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

        // Out of credits is a decision point, not a failure. Back to idle
        // leaves the file and the tier selection intact, so buying and
        // pressing the button again just works.
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
          // The best-qualified moment in the product: they used the good mode
          // up to its free ceiling and immediately wanted more.
          const freeTierOnMetered =
            err.rateLimit?.tier === "free" && Boolean(meteredToolKey);

          setError({
            title: freeTierOnMetered
              ? "Studio Quality limit reached"
              : "You're going a little fast",
            hint: freeTierOnMetered
              ? "That's the free-tier limit. Credits raise it to 30 per hour — and they never expire."
              : rateLimitMessage || "Wait for the timer, then run it again.",
            offerCredits: freeTierOnMetered,
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

  // Assigned during render so onCredited always calls the CURRENT handleSubmit.
  useEffect(() => {
    submitRef.current = () => {
      void handleSubmit();
    };
  });

  const stageLabel = (() => {
    if (status === "uploading") return retryNotice || "Uploading your file";
    if (!stages?.length) return processingLabel;
    let label = stages[0].label;
    for (const stage of stages) if (elapsedSeconds >= stage.at) label = stage.label;
    return label;
  })();

  // Called once and checked, rather than inlined into the JSX. When a tool's
  // controls return null (TrimControls does, until a file is chosen) the
  // wrapper div still rendered — an empty element collecting a 24px space-y
  // margin, which is why the card had a phantom gap under the dropzone and
  // looked bottom-heavy.
  const controls = renderControls?.(file, isBusy) ?? null;

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
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            {toolLabel || submitLabel}
          </span>
        </div>
        {toolMeta && <span className="font-mono text-[11px] text-text-subtle">{toolMeta}</span>}
      </div>

      {/*
        ZONES SEPARATED BY HAIRLINES, NOT BY MORE VERTICAL SPACE.
        This was one padded box with `space-y-6` between every block, so the
        dropzone, the tool's own controls and the progress panel all sat at the
        same level with nothing grouping them — a pile of widgets rather than a
        panel with parts. `divide-y` draws a rule between whichever sections
        actually render, which is the layout contract TranscriptionForm already
        documents. Applies to every caller: /stems, /silence-split and
        /youtube/stems.
      */}
      <div className="divide-y divide-graphite-800">
        {/* SOURCE — the file, and anything wrong with it. */}
        {status !== "complete" && (
          <section className="space-y-4 p-6 sm:p-8">
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept={fileAccept}
          />

          {/* An error about the file belongs beside the file, not below the
              tool's controls. */}
          {validationError && (
            <div
              className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <span className="text-sm text-text-primary">{validationError}</span>
            </div>
          )}
          </section>
        )}

        {/* SETTINGS — whatever this tool needs before it can run. */}
        {status !== "complete" && controls && (
          <section className="p-6 sm:p-8">{controls}</section>
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
              {/* Plain button on purpose: an underlined text link, not a button
                  shape — see the matching note in JobToolForm.

                  The LABEL changes on a charged run because the behaviour is
                  not what "Cancel" implies: this stops the poll, not the job,
                  and the credit is already spent. Telling someone they can
                  cancel and then taking both their credit and their result is
                  the worst thing this form can do. */}
              <button
                type="button"
                onClick={handleCancel}
                className="rounded px-1 text-xs text-text-subtle underline underline-offset-2 outline-none transition-colors hover:text-red-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                {chargedRun ? "Stop watching" : "Cancel"}
              </button>
            </div>

            <p className="text-xs leading-relaxed text-text-subtle">
              {expectedRange ? `Typically ${expectedRange}. ` : ""}Keep this tab open.
              {chargedRun && " This run has already used its credit — stopping here won't return it."}
            </p>
          </div>
          </section>
        )}

        {/* RESULT */}
        {status === "complete" && jobId && (
          <section className="space-y-4 p-6 sm:p-8" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-400">
                  {resultVerb}
                </p>
                {/* Marks WHICH model produced these files. Someone downloading
                    four stems over a week can't tell from the filenames. */}
                {completedMetered && <StudioQualityTag />}
              </div>
              <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
                {resultTitle || `${outputs.length} outputs ready`}
              </p>
            </div>

            {/*
              Track-list layout, not tabs: every output is visible as its own
              row (icon, name, independent download button) rather than hidden
              behind a pill switcher. Scales from 4 stems to 50 silence-split
              segments without the list becoming unusable — the container caps
              height and scrolls once it's tall enough to need it, rather than
              pushing the whole page down.

              Only ONE <audio> element exists at a time (inside AudioPlayer
              below, bound to activeOutput) regardless of how many rows are
              listed — clicking a row swaps its src rather than mounting a new
              player per output.
            */}
            {outputs.length > 0 && (
              <div
                role="group"
                aria-label="Outputs"
                className="max-h-72 divide-y divide-graphite-800 overflow-y-auto rounded-lg border border-graphite-700"
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
                          full-width and left-aligned with its own icon
                          treatment. Button would have to be stripped of
                          height, padding, radius and centring to fit. */}
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

                      {/* Borrows the ghost icon-button styling, sized down to
                          h-8 so the row height doesn't grow. Stays an <a>
                          because it's a real download URL. */}
                      <a
                        href={getMultiOutputDownloadUrl(endpoint, jobId, name, queryParam)}
                        download
                        aria-label={`Download ${formatOutputName(name)}`}
                        className={buttonStyles({
                          variant: "ghost",
                          size: "icon",
                          className: "h-8 w-8 shrink-0 hover:bg-graphite-800 hover:text-amber-400",
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

            {/* Under the player, above the downloads. The user has just heard
                the bleed in their own track — the only moment where the pitch
                makes itself. Silent unless the server says this job is
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
            {!chargedRun && <SupportBlock />}

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw />
              Process another file
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
            control sits in the same place in every state, rather than being
            the last item in whichever stack happens to be rendered.

            Hidden until there's a file, rather than shown disabled — a
            full-width h-12 slab at 40% opacity carries the weight of the
            primary action while doing nothing, and a dimmed amber fill renders
            as a muddy brown bar. isFailed keeps "Try again" reachable after an
            error. */}
        {status !== "complete" && (file || isFailed) && (
          <div className="rounded-b-2xl bg-graphite-950/40 p-4 sm:px-8 sm:py-5">
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
          </div>
        )}
      </div>

      {gate}
    </div>
  );
}