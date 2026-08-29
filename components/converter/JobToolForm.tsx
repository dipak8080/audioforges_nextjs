"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, AlertTriangle, Wand2, RotateCcw, type LucideIcon } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { CreditReceipt } from "@/components/credits/CreditReceipt";
import type { SubmitBilling } from "@/lib/types/converter";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile } from "@/lib/utils/validation";
import type { FileValidationResult } from "@/lib/types/converter";
import {
  submitJob,
  getJobStatus,
  getJobPreviewUrl,
  getJobDownloadUrl,
  ApiError,
} from "@/lib/api/railway";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

/** A stage label that appears once `at` seconds have elapsed. */
export interface ProcessingStage {
  at: number;
  label: string;
}

const DEFAULT_MAX_POLL_MS = 10 * 60 * 1000;

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

function baseName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}

/**
 * The `downloadFilename` prop is documented as an extension override
 * ("wav"), but a bare `download="wav"` makes the browser save the file
 * as a file literally named `wav` with no extension. If it looks like a
 * bare extension, rebuild a real filename from the source file.
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

function isRetryableSubmitError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.isTimeout) return true;
  if (error.isServerBusy) return true;
  // status 0 = fetch itself failed (network blip / DNS hiccup)
  if (error.status === 0) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Errors say what happened and what to do about it. */
function humanizeError(raw: string): { title: string; hint: string } {
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
  /**
   * "Nothing was found" is not a failure to retry.
   *
   * The backend maps NO_NOTES_DETECTED to a clear sentence, and that sentence
   * did reach the title — but the generic hint under it said "Run it again",
   * which is the one piece of advice guaranteed not to help: the same audio
   * produces the same empty result. On a metered tool that reads as an
   * invitation to spend a second credit on the same outcome.
   */
  if (text.includes("no notes") || text.includes("no_notes") || text.includes("nothing")) {
    return {
      title: raw,
      hint: "Re-running won't change this. Try a clearer recording, a single instrument, or widen the pitch range if you narrowed it.",
    };
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
   * FileDropZone's own audio-format hint). Needed by tools whose input
   * isn't audio - currently only video-to-audio, which uploads video
   * files and has a different size cap.
   */
  fileHint?: string;
  /**
   * Overrides the file validator run on selection. Defaults to
   * validateAudioFile so every existing tool (which uploads audio) is
   * unaffected. video-to-audio passes a video-specific validator here -
   * without this override, ANY tool built on JobToolForm would reject
   * non-audio files with an audio-specific error message regardless of
   * what fileAccept was set to, since fileAccept only affects the file
   * picker dialog's filter, not the actual validation logic that runs
   * after a file is selected (including drag-and-drop, which ignores
   * `accept` entirely).
   */
  validateFile?: (file: File) => FileValidationResult;
  /** How often to poll status, ms. Convert/trim/etc are fast (~2.5s); separation is slow (12s). */
  pollIntervalMs?: number;
  /**
   * Timeout for the INITIAL submit request (upload + job creation), ms.
   * This is not how long the job takes to process — that's handled by polling.
   * This only covers the time for the server to accept the file and hand back a job_id.
   * Default raised to 60s to absorb cold-starts / semaphore queue waits under load.
   * Pass a higher value (e.g. 120_000–180_000) for heavier endpoints like speech-to-text
   * or video-to-audio, where large uploads + a busy semaphore can push past 60s even
   * before real processing starts.
   */
  submitTimeoutMs?: number;
  /** Button label when idle, e.g. "Convert" */
  submitLabel: string;
  /** Icon shown on the submit button when idle. Defaults to Wand2 (the
   * generic "transform this audio" glyph most tools use) — override for
   * tools where a more specific icon reads better, e.g. Download for
   * Convert, where the end result really is "get a downloaded file". */
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
   * Stage labels shown while the job runs, keyed to elapsed seconds.
   * Describe what the backend is actually doing — leaving this unset
   * falls back to a single static processingLabel.
   */
  stages?: ProcessingStage[];
  /** Give up polling after this long rather than spinning forever. */
  maxPollMs?: number;
  /**
   * Optional extra controls rendered above the submit button (e.g. a
   * target-format select for /convert, a start/end input for /trim). Receives current file + disabled state.
   */
  renderControls?: (file: File | null, disabled: boolean) => ReactNode;
  /**
   * Builds the extra (non-file) form fields to send with the job. Return null to block
   * submission (e.g. required control not filled in yet) — an error message will show instead.
   */
  buildExtraFields?: (file: File) => Record<string, string> | null;
  /** Message shown if buildExtraFields returns null */
  missingFieldsMessage?: string;
  /**
   * Hint text shown on a 429 rate-limit hit. Falls back to the generic
   * "wait for the timer" hint if omitted — set this per-tool when the
   * limit window/shape is unusual enough to be worth spelling out
   * (e.g. "3 per 5 minutes" vs every other tool's per-hour limits).
   */
  rateLimitMessage?: string;
  /** Suggested download filename or extension, e.g. "wav" — falls back to backend's header if omitted */
  downloadFilename?: string;
  /**
   * Max number of times to retry the initial submit if it fails due to a timeout
   * or a transient server-busy signal (503 / network error). Does NOT retry on
   * validation errors (400), rate limits (429), or other client-side rejections —
   * only on conditions that indicate the server was too slow/busy to respond, since
   * retrying a genuinely invalid request would just fail again immediately.
   */
  maxSubmitRetries?: number;
  /**
   * Skips rendering <AudioPlayer> in the complete state. Needed for tools
   * whose output isn't browser-playable audio (currently only
   * audio-to-midi, which outputs a raw .mid file) — every other existing
   * tool leaves this unset and keeps its player exactly as before.
   */
  hidePreview?: boolean;
  /**
   * OPT-IN CREDITS WIRING.
   *
   * This component backs ~17 tools and all but one are free forever, so
   * credits are a prop rather than built in. Passing neither leaves behaviour
   * byte-identical to before: no cookie sent, no gate, no receipt.
   *
   * Set `metered` for a route the paywall can charge for. It does two things:
   * sends `credentials: "include"` so `af_sid` reaches the API cross-origin
   * (without it every request is a new anonymous subject and no balance is
   * ever seen or spent), and captures the `billing` block off the response.
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
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  /** What the server said it charged. Reported verbatim, never inferred. */
  const [billing, setBilling] = useState<SubmitBilling | null>(null);
  /** Drives the honest cancel copy while a paid run is in flight. */
  const chargedRun = billing?.charged === "credit";

  // Re-runs the submit after a purchase closes the gate, so someone who hits
  // the 402 and buys isn't returned to an idle form holding their file with no
  // sign that the thing they wanted is now possible. Through a ref because
  // handleSubmit is declared below.
  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });
  const { applyBalance } = useCredits();

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

  /* --- cooldown ticker -------------------------------------------- */
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  /* --- elapsed ticker ---------------------------------------------- */
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
        setError({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Upload the file again to start a fresh run.",
        });
        setStatus("failed");
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
          stopPolling();
          setError(humanizeError(result.error || "Processing failed."));
          setStatus("failed");
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        /*
          A REJECTED poll is not a slow job.

          Anything that isn't a 404 used to fall through to "retry next tick",
          which is right for a dropped connection and wrong for a response that
          will never change — an auth failure repeats identically until the
          10-minute ceiling, and then reports "taking unusually long" on a job
          the server settled in about a minute. 401 and 403 mean this browser
          cannot read this job, and no amount of waiting fixes that.
        */
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          stopPolling();
          setError({
            title: "We lost track of this job",
            hint: "It may still be running on our servers. Reload the page — if a credit was taken and the run failed, it comes back automatically.",
          });
          setStatus("failed");
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          stopPolling();
          setError(humanizeError("This job expired."));
          setStatus("failed");
          return;
        }
        // Transient network blips fall through to the next tick.
      }

      pollRef.current = setTimeout(() => poll(id), pollIntervalMs);
    },
    [endpoint, maxPollMs, pollIntervalMs, stopPolling]
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      // Check straight away — fast jobs shouldn't wait a full interval.
      poll(id);
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
    // A cleared form describes no job, so it must not carry the last one's
    // receipt into the next render.
    setBilling(null);
  };

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

        // Out of credits is a DECISION POINT, not a failure. Back to idle
        // keeps the file and every control setting, so buying and pressing the
        // button again just works — and nothing red is rendered for it.
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
          setCooldownSeconds(err.retryAfterSeconds ?? 60);
        } else {
          setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
        }
        setStatus("error");
        return;
      }
    }
  };

  /* --- derived display --------------------------------------------- */

  // Assigned during render so onCredited always calls the CURRENT handleSubmit
  // rather than the one captured at first mount.
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

  // Eases toward 92% and only completes when the job actually does.
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 12)) * 100));

  // Called once and checked, rather than inlined into the JSX. When a
  // tool's controls return null (TrimControls does, until a file is
  // chosen) the wrapper div still rendered - an empty element collecting
  // a 24px space-y margin, which is why the card had a phantom gap under
  // the dropzone and looked bottom-heavy.
  const controls = renderControls?.(file, isBusy) ?? null;

  const downloadName = resolveDownloadName(downloadFilename, file?.name ?? null);

  /* ------------------------------------------------------------------ */

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      {/* Header strip */}
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
        {/* ---------- File input / selected file ---------- */}
        {status !== "complete" && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept={fileAccept}
            hint={fileHint}
          />
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

        {/* ---------- Tool-specific controls ---------- */}
        {status !== "complete" && controls && <div>{controls}</div>}

        {/* ---------- Working ---------- */}
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
              {/* Left as a plain button on purpose: this is an underlined
                  text link, not a button shape. Running it through Button
                  would mean overriding the padding, height, radius and
                  every variant colour — at which point nothing of the
                  component is left. */}
              <button
                type="button"
                onClick={handleCancel}
                className="rounded px-1 text-xs text-text-subtle underline underline-offset-2 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                {chargedRun ? "Stop watching" : "Cancel"}
              </button>
            </div>

            <p className="text-xs text-text-subtle">
              {expectedRange ? `Typically ${expectedRange}. ` : ""}Keep this tab open.
              {chargedRun &&
                " This run has already used its credit — stopping here won't return it."}
            </p>
          </div>
        )}

        {/* ---------- Complete ---------- */}
        {status === "complete" && jobId && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">{resultVerb}</p>
              <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
                {resultTitle || file?.name || "Your file is ready"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-subtle">
                Finished in {formatElapsed(elapsedSeconds)}
              </p>
            </div>

            {!hidePreview && <AudioPlayer src={getJobPreviewUrl(endpoint, jobId)} />}

            {/* Stays an <a> - it's a real download URL, and a button can't
                be middle-clicked, opened in a new tab, or copied. It now
                borrows the Button's styles rather than repeating them:
                this was the last hand-rolled amber surface in the tool
                flow, and it had already drifted (no press state, no inset
                highlight, its own focus ring). */}
            <a
              href={getJobDownloadUrl(endpoint, jobId)}
              download={downloadName || true}
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              <Download />
              Download
            </a>

            {/* Anything the tool wants to say about its own output. For a
                result that can't be played back, this is the only evidence
                the run produced what it promised. */}
            {renderResult?.(jobId)}

            <CreditReceipt billing={billing} />

            {/* Asking for a tip right after charging someone a credit is a bad
                look. A free run is still free, so it keeps the block. */}
            {billing?.charged !== "credit" && <SupportBlock />}

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw />
              Process another file
            </Button>
          </div>
        )}

        {/* ---------- Failed ---------- */}
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
            {/*
              NO TIP JAR ON A BROKEN RUN.
              These forms carry two failure states and they are not the same
              thing. `error` means the SUBMIT was rejected — a file too large,
              an unsupported format, a rate limit — which is the form doing its
              job, and asking for support after one is fine. `failed` means the
              job ran and broke, or polling gave up on it. Following "This is
              taking unusually long" with "Enjoying AudioForges? Buy us a
              coffee" is the worst timing on the site.
            */}
            {status === "error" && <SupportBlock />}
          </div>
        )}

        {/* ---------- Action ----------
            Hidden until there's a file, rather than shown disabled. A
            full-width h-12 slab at 40% opacity carries the same physical
            weight as the primary action while doing nothing, and on an
            empty form it competes with the only thing worth clicking.
            isFailed keeps it visible after an error so "Try again" is
            still reachable. */}
        {status !== "complete" && (file || isFailed) && (
          <Button
            /* Neutral while there's nothing to run. A disabled amber fill
               at 40% opacity renders as a muddy brown bar - it reads as
               broken rather than inactive, and it's the loudest thing on
               an empty form. Grey says "not yet"; amber is earned once a
               file is there. */
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
        )}
      </div>

      {gate}
    </div>
  );
}