"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, RotateCcw, Wand2, type LucideIcon } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { CreditReceipt } from "@/components/credits/CreditReceipt";
import { CreditGateModal } from "@/components/credits/CreditGateModal";
import type { SubmitBilling } from "@/lib/types/converter";
import type { CreditsMe, InsufficientCreditsPayload, MeteredToolKey } from "@/lib/types/credits";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import type { FileValidationResult } from "@/lib/types/converter";
import {
  submitJob,
  getJobStatus,
  getJobPreviewUrl,
  getJobDownloadUrl,
  ApiError,
} from "@/lib/api/railway";
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
  serverFailure,
  sleep,
  stageIndexFor,
  terminalPollError,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
  type ProcessingStage,
  type UiState,
} from "@/components/tools/JobFormKit";

export type { ProcessingStage };

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * Rebuilt on JobFormKit, so this form, MultiOutputToolForm and YouTubeUrlForm
 * share one header, step rail, working panel, result header, error panel and
 * action bar. Props are unchanged — all ~17 tools keep working untouched.
 *
 * Two fixes came with it:
 *
 * 1. `poll` READ `metered` BUT DIDN'T DEPEND ON IT. A tool that flipped the
 *    prop after first mount kept polling with the stale value, which on a
 *    metered route means polling without credentials.
 *
 * 2. THE LAYOUT MOVED TO SECTIONS. This was one padded box with `space-y-6`
 *    between every block, so the dropzone, the tool's controls and the progress
 *    panel sat at the same level with nothing grouping them — a pile of widgets
 *    rather than a panel with parts. Hairlines group them, and the primary
 *    action is pinned to the bottom edge in every state instead of being the
 *    last item in whichever stack happened to render.
 */

const DEFAULT_MAX_POLL_MS = 10 * 60 * 1000;
const STEPS = ["File", "Run", "Result"] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

/**
 * The `downloadFilename` prop is documented as an extension override ("wav"),
 * but a bare `download="wav"` makes the browser save the file as a file
 * literally named `wav` with no extension. If it looks like a bare extension,
 * rebuild a real filename from the source file.
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

/**
 * A 429 body carries no packs, so the free-tier rate-limit upsell synthesises a
 * gate payload from the provider's /credits/me — the same shape the 402 path
 * gets from the server. credits_needed is the tool's real per-run cost so the
 * modal's spec reads correctly.
 */
function buildUpsellPayload(me: CreditsMe, tool: string): InsufficientCreditsPayload {
  return {
    error: "insufficient_credits",
    message: "",
    tool,
    credits_needed: me.paywall?.tools?.[tool as MeteredToolKey]?.credits ?? 1,
    balance: me.balance,
    free_remaining: me.free_remaining,
    free_resets_at: me.free_resets_at,
    packs: me.packs,
  };
}

/**
 * The follow-up line under a FAILED job's own message.
 *
 * The message itself is the server's and is rendered verbatim (see
 * serverFailure) — this only picks what to say underneath it, and the choice
 * matters in one case:
 *
 * "Nothing was found" is not a failure to retry. The backend maps
 * NO_NOTES_DETECTED to a clear sentence, and the generic "Run it again" beneath
 * it is the one piece of advice guaranteed not to help — the same audio
 * produces the same empty result. On a metered tool that reads as an invitation
 * to spend a second credit on the same outcome.
 */
function failureHint(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("no notes") || text.includes("no_notes") || text.includes("nothing")) {
    return "Re-running won't change this. Try a clearer recording, a single instrument, or widen the pitch range if you narrowed it.";
  }
  if (text.includes("too long") || text.includes("duration") || text.includes("segment")) {
    return "Adjust the settings above, or trim the file, then run it again.";
  }
  return "Run it again. If it keeps failing, try a different file.";
}

/**
 * SUBMIT errors only.
 *
 * A failed JOB's message comes from the server already written for the user —
 * confirmed against routes/_shared.py, where an AudioToolError's text goes into
 * job["error"] unmodified. Those go through serverFailure at the poll site and
 * are never rewritten. This handles the other path, where the text is an
 * ApiError message and generic copy usually reads better.
 */
function humanizeError(raw: string): FormError {
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
  // Default: the server writes these for the end user, so the message is shown
  // verbatim rather than replaced with something generic.
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
   * FileDropZone's own audio-format hint). Needed by tools whose input isn't
   * audio - currently only video-to-audio, which uploads video files and has a
   * different size cap.
   */
  fileHint?: string;
  /**
   * Overrides the file validator run on selection. Defaults to
   * validateAudioFile so every existing tool (which uploads audio) is
   * unaffected. video-to-audio passes a video-specific validator here - without
   * this override, ANY tool built on JobToolForm would reject non-audio files
   * with an audio-specific error message regardless of what fileAccept was set
   * to, since fileAccept only affects the file picker dialog's filter, not the
   * actual validation logic that runs after a file is selected (including
   * drag-and-drop, which ignores `accept` entirely).
   */
  validateFile?: (file: File) => FileValidationResult;
  /** How often to poll status, ms. Convert/trim/etc are fast (~2.5s); separation is slow (12s). */
  pollIntervalMs?: number;
  /**
   * Timeout for the INITIAL submit request (upload + job creation), ms. This is
   * not how long the job takes to process — that's handled by polling. This
   * only covers the time for the server to accept the file and hand back a
   * job_id. Default raised to 60s to absorb cold-starts / semaphore queue waits
   * under load. Pass a higher value (e.g. 120_000–180_000) for heavier
   * endpoints like speech-to-text or video-to-audio, where large uploads + a
   * busy semaphore can push past 60s even before real processing starts.
   */
  submitTimeoutMs?: number;
  /** Button label when idle, e.g. "Convert" */
  submitLabel: string;
  /** Icon shown on the submit button when idle. Defaults to Wand2 (the generic
   * "transform this audio" glyph most tools use) — override for tools where a
   * more specific icon reads better, e.g. Download for Convert, where the end
   * result really is "get a downloaded file". */
  icon?: LucideIcon;
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
   * Stage labels shown while the job runs, keyed to elapsed seconds. Describe
   * what the backend is actually doing — leaving this unset falls back to a
   * single static processingLabel.
   */
  stages?: ProcessingStage[];
  /** Give up polling after this long rather than spinning forever. */
  maxPollMs?: number;
  /**
   * Time constant for the progress curve, in seconds. Bigger for slower tools.
   *
   * Default 12 suits the ffmpeg tools this mostly backs, which finish in a few
   * seconds. It is far too short for the slow ones on the same shell —
   * /video-to-audio and /audio-to-midi-hq run for a minute or more, where the
   * bar reaches ~92% in the first twenty seconds and then stops. Pass something
   * near the tool's TYPICAL duration.
   */
  progressTau?: number;
  /**
   * Optional extra controls rendered above the submit button (e.g. a
   * target-format select for /convert, a start/end input for /trim). Receives
   * current file + disabled state.
   */
  renderControls?: (file: File | null, disabled: boolean) => ReactNode;
  /**
   * Builds the extra (non-file) form fields to send with the job. Return null to
   * block submission (e.g. required control not filled in yet) — an error
   * message will show instead.
   */
  buildExtraFields?: (file: File) => Record<string, string> | null;
  /** Message shown if buildExtraFields returns null */
  missingFieldsMessage?: string;
  /**
   * Hint text shown on a 429 rate-limit hit. Falls back to the generic "wait
   * for the timer" hint if omitted — set this per-tool when the limit
   * window/shape is unusual enough to be worth spelling out (e.g. "3 per 5
   * minutes" vs every other tool's per-hour limits).
   */
  rateLimitMessage?: string;
  /** Suggested download filename or extension, e.g. "wav" — falls back to backend's header if omitted */
  downloadFilename?: string;
  /**
   * Max number of times to retry the initial submit if it fails due to a
   * timeout or a transient server-busy signal (503 / network error). Does NOT
   * retry on validation errors (400), rate limits (429), or other client-side
   * rejections — only on conditions that indicate the server was too slow/busy
   * to respond.
   */
  maxSubmitRetries?: number;
  /**
   * Skips rendering <AudioPlayer> in the complete state. Needed for tools whose
   * output isn't browser-playable audio (currently only audio-to-midi, which
   * outputs a raw .mid file) — every other existing tool leaves this unset and
   * keeps its player exactly as before.
   */
  hidePreview?: boolean;
  /**
   * OPT-IN CREDITS WIRING.
   *
   * This component backs ~17 tools and all but one are free forever, so credits
   * are a prop rather than built in. Passing neither leaves behaviour
   * byte-identical to before: no cookie sent, no gate, no receipt.
   *
   * Set `metered` for a route the paywall can charge for. It does two things:
   * sends `credentials: "include"` so `af_sid` reaches the API cross-origin
   * (without it every request is a new anonymous subject and no balance is ever
   * seen or spent), and captures the `billing` block off the response.
   */
  metered?: boolean;
  /**
   * Extra content rendered in the complete state, under the download button —
   * for a tool whose output can't be previewed as audio and therefore has
   * nothing to show for itself otherwise.
   */
  renderResult?: (jobId: string) => ReactNode;
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
  icon: Icon = Wand2,
  processingLabel,
  expectedRange,
  resultVerb,
  toolLabel,
  toolMeta,
  stages,
  maxPollMs = DEFAULT_MAX_POLL_MS,
  progressTau = 12,
  renderControls,
  buildExtraFields,
  missingFieldsMessage = "Choose an option above before running this.",
  rateLimitMessage,
  downloadFilename,
  maxSubmitRetries = 1,
  hidePreview = false,
  metered = false,
  renderResult,
}: JobToolFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  /** What the server said it charged. Reported verbatim, never inferred. */
  const [billing, setBilling] = useState<SubmitBilling | null>(null);
  /** Drives the honest cancel copy while a paid run is in flight. */
  const chargedRun = billing?.charged === "credit";

  const isBusy = status === "uploading" || status === "processing";
  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isBusy);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  /**
   * Seeded from the endpoint's real window, not a flat minute. This shell backs
   * ~17 tools whose windows run from 60 seconds (/convert, /trim) to an hour
   * (/audio-to-midi-hq) — a fixed 60 re-enabled the button fifty-nine minutes
   * early on the slowest of them, straight into another 429.
   *
   * STATE, NOT A REF, because CooldownBar renders it. As a ref it only showed
   * the right ceiling because the setCooldownSeconds call on the next line
   * happened to trigger the render that read it — reorder those two lines or
   * return early between them and the bar draws against a stale ceiling.
   */
  const [cooldownCeiling, setCooldownCeiling] = useState(getRetryAfterFallback(endpoint));

  // Re-runs the submit after a purchase closes the gate, so someone who hits the
  // 402 and buys isn't returned to an idle form holding their file with no sign
  // that the thing they wanted is now possible. Through a ref because
  // handleSubmit is declared below.
  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });
  const { applyBalance, me, balance } = useCredits();

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  // Free-tier rate-limit upsell. Only set on a metered tool's 429 with tier
  // "free" (see the submit catch). The payload is built on demand when the user
  // clicks buy, from the provider's /credits/me.
  const [showRateLimitUpsell, setShowRateLimitUpsell] = useState(false);
  const [upsellPayload, setUpsellPayload] = useState<InsufficientCreditsPayload | null>(null);

  // Buying credits lifts the user to the higher paid rate limit, so a free-tier
  // cooldown stops applying the moment their balance rises. Clear it and the
  // error so they're not left staring at a stale timer after paying — the same
  // dead end useCreditGate.onCredited closes for the 402 path.
  //
  // Adjusted DURING RENDER, not in an effect: React documents this for "reset
  // state when a value changes", and setState in an effect both trips the
  // compiler lint and paints one stale frame first. setShowRateLimitUpsell(false)
  // breaks the condition, so it runs once.
  if (showRateLimitUpsell && balance > 0) {
    setShowRateLimitUpsell(false);
    setUpsellPayload(null);
    setCooldownSeconds(0);
    setError(null);
    setStatus("idle");
  }

  const isFailed = status === "failed" || status === "error";
  const canSubmit = Boolean(file) && !isBusy && status !== "complete" && cooldownSeconds === 0;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /**
   * The poll loop reschedules itself, which it can't do by naming itself: a
   * value referenced inside its own initializer is something the React
   * Compiler can't reason about. One indirection through a ref — declared
   * BEFORE the callback, assigned in an effect rather than during render —
   * removes the self-reference without changing the polling behaviour.
   */
  const pollFnRef = useRef<(id: string) => void>(() => {});

  /* --- polling: recursive timeout, so slow responses never stack --- */
  const poll = useCallback(
    async (id: string) => {
      if (cancelledRef.current) return;

      const fail = (failure: FormError) => {
        stopPolling();
        setError(failure);
        setStatus("failed");
      };

      if (Date.now() - pollStartedAtRef.current > maxPollMs) {
        fail({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start a fresh run.",
        });
        return;
      }

      try {
        const result = await getJobStatus(endpoint, id, {}, metered);
        if (cancelledRef.current) return;

        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setStatus("complete");
          return;
        }
        if (result.status === "failed") {
          /*
            VERBATIM. routes/_shared.py catches AudioToolError and puts str(e)
            into job["error"] unmodified, because those messages are written for
            the person who uploaded the file — and they are almost always more
            specific than anything we could substitute: "Audio is too long
            (35.2 min)", "No silence detected", the silence-split cap naming the
            real segment count and the fix.

            humanizeError used to pattern-match that text and REPLACE it, so a
            server message containing the word "format" became our generic
            "convert it to WAV or MP3 first". Our copy is the fallback now, for
            when the server sent nothing at all.
          */
          fail(
            serverFailure(
              result.error,
              { title: "Processing failed", hint: failureHint("") },
              failureHint(result.error ?? "")
            )
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

      pollRef.current = setTimeout(() => pollFnRef.current(id), pollIntervalMs);
    },
    // `metered` belongs here: it's read above, and a tool that flips it after
    // mount would otherwise keep polling with the value from first render.
    [endpoint, maxPollMs, pollIntervalMs, stopPolling, metered]
  );

  useEffect(() => {
    pollFnRef.current = poll;
  }, [poll]);

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      // Check straight away — fast jobs shouldn't wait a full interval.
      void poll(id);
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
    // A new file describes a new job, so the previous one's receipt must not
    // survive into it.
    setBilling(null);
  };

  /** Everything about the current run, gone. Reset and cancel differ only in
   *  whether the file survives. */
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
  }, [stopPolling, setElapsedSeconds]);

  const handleReset = () => {
    clearRun();
    setFile(null);
    setValidationError(null);
  };

  const handleCancel = () => clearRun();

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
    setShowRateLimitUpsell(false);
    setUpsellPayload(null);
    cancelledRef.current = false;

    const formData = new FormData();
    formData.append("file", file);
    for (const [key, value] of Object.entries(extraFields || {})) {
      formData.append(key, value);
    }

    let attempt = 0;

    while (true) {
      try {
        const res = await submitJob(endpoint, formData, submitTimeoutMs, {}, metered);
        if (cancelledRef.current) return;
        setRetryNotice(null);
        setJobId(res.job_id);
        setStatus("processing");
        startPolling(res.job_id);

        // The metered route reports what it just charged, so the navbar pill
        // updates from THIS response rather than a follow-up /credits/me — no
        // stale number at the one moment the user is watching it change.
        //
        // A free tool returns no `billing` key at all, so this stays null and
        // CreditReceipt renders nothing.
        setBilling(res.billing ?? null);
        if (res.billing) {
          applyBalance(res.billing.balance, res.billing.free_remaining);
        }
        return;
      } catch (err) {
        if (cancelledRef.current) return;

        // Out of credits is a DECISION POINT, not a failure. Back to idle keeps
        // the file and every control setting, so buying and pressing the button
        // again just works — and nothing red is rendered for it.
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
          setError({
            title: "You're going a little fast",
            hint: rateLimitMessage || "Wait for the timer, then run it again.",
          });
          const wait = err.retryAfterSeconds ?? getRetryAfterFallback(endpoint);
          setCooldownCeiling(Math.max(1, wait));
          setCooldownSeconds(wait);
          // A free-tier rate limit on a metered tool is a conversion moment, not
          // just a wait: buying credits moves them to the paid rate limit and
          // unblocks them now. Only upsell when buying would actually help.
          if (metered && err.rateLimit?.tier === "free" && (me?.packs?.length ?? 0) > 0) {
            setShowRateLimitUpsell(true);
          }
        } else {
          setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
        }
        setStatus("error");
        return;
      }
    }
  };

  // Assigned during render so onCredited always calls the CURRENT handleSubmit
  // rather than the one captured at first mount.
  useEffect(() => {
    submitRef.current = () => {
      void handleSubmit();
    };
  });

  /* --- derived display --------------------------------------------- */

  const stageIndex = stageIndexFor(stages, elapsedSeconds);
  const stageLabel = (() => {
    if (status === "uploading") return retryNotice || "Uploading your file";
    if (stageIndex < 0 || !stages) return processingLabel;
    return stages[stageIndex].label;
  })();

  const progress = easedProgress(elapsedSeconds, progressTau);

  // Called once and checked, rather than inlined into the JSX. When a tool's
  // controls return null (TrimControls does, until a file is chosen) the wrapper
  // still rendered — an empty element collecting a margin, which is why the card
  // had a phantom gap under the dropzone and looked bottom-heavy.
  const controls = renderControls?.(file, isBusy) ?? null;

  const downloadName = resolveDownloadName(downloadFilename, file?.name ?? null);
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
          /* Hidden until there's a file, rather than shown disabled. A
             full-width h-12 slab at 40% opacity carries the same physical weight
             as the primary action while doing nothing, and on an empty form it
             competes with the only thing worth clicking. isFailed keeps it
             visible after an error so "Try again" is still reachable. */
          status !== "complete" && (file || isFailed) ? (
            <>
              <Button
                /* Neutral while there's nothing to run. A disabled amber fill at
                   40% opacity renders as a muddy brown bar — it reads as broken
                   rather than inactive. Grey says "not yet"; amber is earned once
                   a file is there. */
                variant={file || isFailed ? "primary" : "secondary"}
                size="lg"
                className="w-full"
                onClick={handleSubmit}
                disabled={!canSubmit && !isBusy}
                loading={isBusy}
              >
                {!isBusy && <Icon />}
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
              hint={fileHint}
            />
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
              title={resultTitle || file?.name || "Your file is ready"}
              meta={`Finished in ${formatElapsed(elapsedSeconds)}`}
            />

            {!hidePreview && <AudioPlayer src={getJobPreviewUrl(endpoint, jobId)} />}

            {/* Stays an <a> — it's a real download URL, and a button can't be
                middle-clicked, opened in a new tab, or copied. It borrows the
                Button's styles rather than repeating them: this was the last
                hand-rolled amber surface in the tool flow, and it had already
                drifted (no press state, no inset highlight, its own focus
                ring). */}
            <a
              href={getJobDownloadUrl(endpoint, jobId)}
              download={downloadName || true}
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              <Download />
              Download
            </a>

            {/* Anything the tool wants to say about its own output. For a result
                that can't be played back, this is the only evidence the run
                produced what it promised. */}
            {renderResult?.(jobId)}

            <CreditReceipt billing={billing} />

            {/* Asking for a tip right after charging someone a credit is a bad
                look. A free run is still free, so it keeps the block. */}
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
            <ErrorPanel error={error} />

            {/* Free-tier rate limit on a metered tool: offer the paid escape
                hatch beside the timer, keeping the countdown as the free path.
                Softer than the 402 gate — a nudge, not a wall. */}
            {showRateLimitUpsell && cooldownSeconds > 0 && me && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3.5">
                <p className="text-sm leading-relaxed text-text-muted">
                  You&apos;ve used your free runs this hour. Buy credits to keep going now — they
                  lift the limit right away — or wait {formatCooldown(cooldownSeconds)}.
                </p>
                <button
                  type="button"
                  onClick={() => setUpsellPayload(buildUpsellPayload(me, endpoint))}
                  className={buttonStyles({ variant: "primary", size: "sm", className: "mt-3" })}
                >
                  Buy credits to continue
                </button>
              </div>
            )}

            {/*
              NO TIP JAR ON A BROKEN RUN.
              These forms carry two failure states and they are not the same
              thing. `error` means the SUBMIT was rejected — a file too large, an
              unsupported format, a rate limit — which is the form doing its job,
              and asking for support after one is fine. `failed` means the job ran
              and broke, or polling gave up on it. Following "This is taking
              unusually long" with "Enjoying AudioForges? Buy us a coffee" is the
              worst timing on the site. And a coffee ask directly under a
              buy-credits upsell is two money asks stacked — suppress it there.
            */}
            {status === "error" && !showRateLimitUpsell && <SupportBlock />}
          </Section>
        )}
      </FormShell>

      {gate}
      {upsellPayload && (
        <CreditGateModal payload={upsellPayload} open onClose={() => setUpsellPayload(null)} />
      )}
    </>
  );
}