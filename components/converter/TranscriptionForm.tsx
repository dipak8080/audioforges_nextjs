"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  Link2,
  Film,
  AlertTriangle,
  ClipboardPaste,
  X,
  RotateCcw,
  Languages,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { FileDropOverlay } from "@/components/ui/FileDropOverlay";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { VideoPreviewCard, useYouTubeMeta } from "@/components/ui/VideoPreviewCard";
import { cn } from "@/lib/utils/cn";
import { sanitizeUserInput, validateYouTubeUrl } from "@/lib/utils/validation";
import { ApiError } from "@/lib/api/railway";
import {
  submitSpeechToText,
  submitYoutubeTranscribe,
  submitVideoToText,
  getTranscriptionStatus,
  getTranscriptionResult,
  getTranscriptionLanguages,
  validateTranscriptionFile,
  validateTranscriptionDuration,
  readMediaDuration,
  languageName,
  TRANSCRIPTION_LIMITS,
  TRANSCRIPTION_AUDIO_EXTENSIONS,
  TRANSCRIPTION_VIDEO_EXTENSIONS,
  type Transcript,
  type TranscriptionEndpoint,
  type TranscriptionLanguages,
  type TranscriptionTask,
} from "@/lib/api/transcription";
import { TranscriptView } from "@/components/converter/TranscriptView";
import { SAMPLE_TRANSCRIPT } from "@/lib/data/sample-transcript";
import { getRateLimitLabel, getRetryAfterFallback } from "@/lib/data/rate-limits";
import { useCreditGate } from "@/components/credits/useCreditGate";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import { CreditReceipt } from "@/components/credits/CreditReceipt";
import type { SubmitBilling } from "@/lib/types/converter";

/* ==================================================================== */
/* Layout contract                                                      */
/* ==================================================================== */
/**
 * The card is a panel with named zones, not a stack of widgets.
 *
 *   ┌ header ─────────────── state dot · state ····· model ┐
 *   │ SOURCE      file drop / URL field + preview          │
 *   ├──────────────────────────────────────────────────────┤
 *   │ SETTINGS    language · output          (2-up on sm+)  │
 *   ├──────────────────────────────────────────────────────┤
 *   │ ACTION BAR  one button, always in the same place     │
 *   └──────────────────────────────────────────────────────┘
 *
 * Two rules that everything below follows:
 *
 *  1. ONE action, ONE place. The footer holds exactly one button in
 *     every state — Transcribe, Cancel, or Transcribe another.
 *
 *  2. Zones are separated by hairlines, not by more vertical space.
 *     Uniform `space-y-6` between seven unrelated blocks is why the old
 *     card read as a pile rather than an instrument.
 *
 * Type scale, four steps, no exceptions:
 *   11px mono uppercase  field labels, meta, timers
 *   13px                 helper text, step rows
 *   14px                 body, inputs, controls
 *   16px                 the action button (via Button size="lg")
 *
 * Radii, three steps: card `rounded-xl`, surfaces `rounded-lg`,
 * micro-controls `rounded-md`.
 *
 * Control height is 44px (`h-11`) for every settings control, so the
 * settings row has one baseline instead of three.
 *
 * The YouTube confirmation row is NOT defined here. It's
 * <VideoPreviewCard>, shared with YouTubeUrlForm and
 * YouTubeConverterForm — the three used to be three near-copies that had
 * drifted on thumbnail size, fallback copy and whether an image error
 * was handled at all.
 */

/* ------------------------------------------------------------------ */
/* Modes                                                               */
/* ------------------------------------------------------------------ */

export type TranscriptionMode = "audio" | "youtube" | "video";

interface ModeConfig {
  endpoint: TranscriptionEndpoint;
  submitLabel: string;
  accept: string;
  /**
   * Size cap in bytes, for display only — the server is the authority.
   *
   * Read off TRANSCRIPTION_LIMITS rather than written as a literal, so
   * the dropzone hint and the drag overlay can't drift from each other
   * or from what validateTranscriptionFile() actually rejects.
   */
  maxBytes: number;
  /** Whether the source can be played back locally alongside the
   *  transcript. YouTube can't — there's no local file and the
   *  transcription API has no preview route. */
  playable: boolean;
}

const MODES: Record<TranscriptionMode, ModeConfig> = {
  audio: {
    endpoint: "speech-to-text",
    submitLabel: "Transcribe audio",
    accept: `audio/*,${TRANSCRIPTION_AUDIO_EXTENSIONS.map((e) => `.${e}`).join(",")}`,
    maxBytes: TRANSCRIPTION_LIMITS.audioBytes,
    playable: true,
  },
  youtube: {
    endpoint: "youtube/transcribe",
    submitLabel: "Transcribe video",
    accept: "",
    maxBytes: 0,
    playable: false,
  },
  video: {
    endpoint: "video-to-text",
    submitLabel: "Transcribe video",
    accept: `video/*,${TRANSCRIPTION_VIDEO_EXTENSIONS.map((e) => `.${e}`).join(",")}`,
    maxBytes: TRANSCRIPTION_LIMITS.videoBytes,
    playable: true,
  },
};

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCooldown(seconds: number): string {
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
  return `${seconds}s`;
}

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

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

/** Mono micro-label. Matches the page's section eyebrows, so the form
 *  speaks the same language as the copy around it instead of arriving in
 *  a different typographic voice. */
function FieldLabel({
  htmlFor,
  icon: Icon,
  children,
}: {
  htmlFor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const content = (
    <>
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </>
  );

  const className =
    "flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted";

  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {content}
    </label>
  ) : (
    <span className={className}>{content}</span>
  );
}

type StepState = "done" | "active" | "pending";

/**
 * A step row, not a spinner.
 *
 * During a cold start the user waits ~90 seconds with no server-side
 * progress to report. An indeterminate bar alone says "something is
 * happening" and nothing else. Two named steps with one checked off says
 * *what* has happened and *what is happening now* — which is real
 * information, obtained without inventing a percentage.
 */
function StepRow({
  state,
  label,
  detail,
}: {
  state: StepState;
  label: string;
  detail?: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          state === "done" && "border-teal-400/40 bg-teal-400/15 text-teal-400",
          state === "active" && "border-amber-500/40 bg-amber-500/15 text-amber-400",
          state === "pending" && "border-graphite-700"
        )}
        aria-hidden
      >
        {state === "done" ? (
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        ) : state === "active" ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin motion-reduce:animate-none" />
        ) : (
          <span className="h-1 w-1 rounded-full bg-graphite-600" />
        )}
      </span>

      <span
        className={cn(
          "text-[13px]",
          state === "pending" ? "text-text-subtle" : "text-text-primary"
        )}
      >
        {label}
      </span>

      {detail && (
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-text-subtle">
          {detail}
        </span>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

interface TranscriptionFormProps {
  mode: TranscriptionMode;
  /**
   * Pass from the page's Server Component so the dropdown is populated
   * on first paint. Omit and the form fetches it client-side, which
   * works but flashes a list with only "Detect automatically" in it.
   */
  languages?: TranscriptionLanguages | null;
}

export function TranscriptionForm({ mode, languages: initialLanguages }: TranscriptionFormProps) {
  const config = MODES[mode];
  const isUrlMode = mode === "youtube";

  const [languages, setLanguages] = useState<TranscriptionLanguages | null>(initialLanguages ?? null);

  const [file, setFile] = useState<File | null>(null);
  /** Decoded once in handleFileSelect and handed to FileDropZone, so the
   *  browser doesn't read the same header twice per selected file. */
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("");
  const [task, setTask] = useState<TranscriptionTask>("transcribe");

  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  /** True when the result on screen is the canned demo rather than a run
   *  of the user's own file. Gates the banner and keeps the sample's
   *  static audio out of the object-URL lifecycle below. */
  const [isSample, setIsSample] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** Bytes sent / total, while the file is going up. Null once the
   *  upload finishes — from that point the server is working and there
   *  is genuinely nothing to measure. */
  const [upload, setUpload] = useState<{ sent: number; total: number } | null>(null);
  /** Sticks around after the upload completes so the finished step can
   *  still show what was sent. `upload` itself goes null to flip the bar
   *  to indeterminate. */
  const [uploadedBytes, setUploadedBytes] = useState<number | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [serverTitle, setServerTitle] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  /** What the server said it charged. Reported verbatim, never inferred. */
  const [billing, setBilling] = useState<SubmitBilling | null>(null);

  /**
   * CREDITS.
   *
   * All three transcription routes are metered under ONE shared rule key,
   * "transcribe" — they hit one RunPod endpoint and one concurrency pool, so
   * three keys would hand a caller three budgets for one resource. Everything
   * below therefore badges, charges and reports against that single key, and
   * the copy says the allowance is shared rather than letting someone assume
   * two free runs per tool.
   *
   * onCredited re-runs the submit once the gate closes on a purchase, so
   * buying mid-task doesn't dump the user back onto a form they have to
   * re-trigger by hand.
   */
  const submitRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => submitRef.current(),
  });
  const { applyBalance, isToolMetered, freeRemaining, balance } = useCredits();
  const metered = isToolMetered("transcribe");

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isBusy = status === "uploading" || status === "processing";
  const videoId = useMemo(() => (isUrlMode ? extractVideoId(url.trim()) : null), [isUrlMode, url]);
  const hasInput = isUrlMode ? Boolean(videoId) : Boolean(file);
  const canSubmit = hasInput && !validationError && !isBusy && cooldownSeconds === 0;
  /** Source and settings are visible in exactly the states where they can
   *  be acted on. During a job they're replaced by the progress panel;
   *  after one they're replaced by the transcript. */
  const showEditor = status === "idle" || status === "failed";

  /** Title/channel for the pasted link. Shared hook, shared card — see
   *  components/ui/VideoPreviewCard.tsx. Lives up here rather than inside
   *  the card because the progress panel needs the same title, and a
   *  card that owned the fetch would mean requesting it twice. */
  const videoMeta = useYouTubeMeta(videoId);

  /* --- preview audio ----------------------------------------------
     Created and revoked here rather than in TranscriptView, because the
     sample's audio is a static asset the view doesn't own. One place
     decides what plays; the view just renders whatever URL it's given. */
  useEffect(() => {
    if (isSample || !file || !config.playable) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, isSample, config.playable]);

  /* --- languages -------------------------------------------------- */
  useEffect(() => {
    if (languages) return;
    let cancelled = false;
    getTranscriptionLanguages()
      .then((data) => {
        if (!cancelled) setLanguages(data);
      })
      .catch(() => {
        // Auto-detect still works with no list — the select just stays
        // on "Detect automatically".
      });
    return () => {
      cancelled = true;
    };
  }, [languages]);

  /* --- link validation, debounced ---------------------------------
     Matched to the two YouTube tools, which have always done this. The
     transcription form used to say nothing about a malformed link until
     you pressed the button, so the only feedback on a typo'd URL was the
     submit staying grey — which reads as the button being broken, not
     the link. 450ms is long enough that it never fires mid-paste. */
  useEffect(() => {
    if (!isUrlMode || isBusy) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError(null);
      return;
    }
    if (extractVideoId(trimmed)) {
      setValidationError(null);
      return;
    }

    const timer = setTimeout(() => {
      const check = validateYouTubeUrl(trimmed);
      setValidationError(check.error || "That doesn't look like a YouTube link");
    }, 450);

    return () => clearTimeout(timer);
  }, [url, isUrlMode, isBusy]);

  /* --- timers ----------------------------------------------------- */
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopPolling();
      abortRef.current?.abort();
    },
    [stopPolling]
  );

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

  /* --- polling ---------------------------------------------------- */
  const poll = useCallback(
    async (jobId: string) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > TRANSCRIPTION_LIMITS.maxPollMs) {
        stopPolling();
        setError({
          message:
            "This is taking longer than the server allows. The job has been cancelled — please try again.",
          retryable: true,
        });
        setStatus("failed");
        return;
      }

      try {
        const result = await getTranscriptionStatus(config.endpoint, jobId);
        if (cancelledRef.current) return;

        // On the YouTube flow, title flipping from null to a string is
        // the only signal the download finished and transcription began.
        if (result.title) setServerTitle(result.title);

        if (result.status === "complete") {
          stopPolling();
          try {
            const full = await getTranscriptionResult(config.endpoint, jobId);
            if (cancelledRef.current) return;
            setTranscript(full);
            setResultTitle(result.title);
            setStatus("complete");
          } catch (err) {
            setError({
              message:
                err instanceof ApiError
                  ? err.message
                  : "The transcript finished but couldn't be retrieved.",
              retryable: true,
            });
            setStatus("failed");
          }
          return;
        }

        if (result.status === "failed") {
          stopPolling();
          // The server writes these for the end user — display verbatim.
          setError({ message: result.error || "Transcription failed.", retryable: true });
          setStatus("failed");
          return;
        }
      } catch (err) {
        if (cancelledRef.current) return;
        // 404 means the job is genuinely gone; anything else is worth
        // another poll rather than giving up on one bad response.
        if (err instanceof ApiError && err.kind === "expired") {
          stopPolling();
          setError({ message: err.message, retryable: true });
          setStatus("failed");
          return;
        }
      }

      pollRef.current = setTimeout(() => poll(jobId), TRANSCRIPTION_LIMITS.pollIntervalMs);
    },
    [config.endpoint, stopPolling]
  );

  /* --- handlers --------------------------------------------------- */
  const handleFileSelect = async (selected: File) => {
    const kind = mode === "video" ? "video" : "audio";
    const check = validateTranscriptionFile(selected, kind);
    if (!check.ok) {
      setValidationError(check.error ?? "That file can't be used here.");
      setFile(null);
      return;
    }

    setValidationError(null);
    setFile(selected);
    setStatus("idle");
    setError(null);
    setTranscript(null);
    // Picking a file after viewing the demo must drop the demo, or the
    // preview effect keeps returning null and the real file plays
    // nothing.
    setIsSample(false);

    // Duration needs a decode, so it lands a moment after the file does.
    // Advisory only — a container the browser can't read returns null and
    // we let the server make the call rather than blocking a valid file.
    const duration = await readMediaDuration(selected, kind);
    setFileDuration(duration);
    const durationCheck = validateTranscriptionDuration(duration);
    if (!durationCheck.ok) setValidationError(durationCheck.error ?? null);
  };

  /** Removes the chosen file and nothing else.
   *
   *  The dropzone's X used to call handleReset, which also cleared the
   *  URL field, the transcript, and the elapsed timer. Removing a file is
   *  not "start over" — the language and output you picked are still the
   *  ones you want for the file you're about to pick instead. */
  const handleClearSource = () => {
    setFile(null);
    setFileDuration(null);
    setUrl("");
    setValidationError(null);
    setError(null);
    if (status === "failed") setStatus("idle");
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

  /** Renders the canned result instantly. Deliberately does NOT call the
   *  API: a real run would spend up to 90 seconds on a cold start and
   *  burn one of the user's two submissions per 5 minutes before they'd
   *  uploaded anything of their own. */
  const handleShowSample = () => {
    stopPolling();
    cancelledRef.current = true;
    setIsSample(true);
    setTranscript(SAMPLE_TRANSCRIPT.transcript);
    setResultTitle(SAMPLE_TRANSCRIPT.title);
    setError(null);
    setValidationError(null);
    setStatus("complete");
  };

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    abortRef.current?.abort();
    setUpload(null);
    setUploadedBytes(null);
    setFile(null);
    setFileDuration(null);
    setUrl("");
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setTranscript(null);
    setResultTitle(null);
    setServerTitle(null);
    setIsSample(false);
    setElapsedSeconds(0);
    // A cleared form describes no job, so it must not carry the last one's
    // receipt into the next render.
    setBilling(null);
    if (isUrlMode) inputRef.current?.focus();
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stopPolling();
    abortRef.current?.abort();
    setStatus("idle");
    setError(null);
    setUpload(null);
    setUploadedBytes(null);
    setElapsedSeconds(0);
    setServerTitle(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    setServerTitle(null);
    setIsSample(false);
    setTranscript(null);
    setUpload(null);
    setUploadedBytes(null);

    const options = { language: language || undefined, task };

    try {
      let jobId: string;
      let jobBilling: SubmitBilling | null = null;

      if (isUrlMode) {
        const check = validateYouTubeUrl(url.trim());
        if (!check.isValid) {
          setValidationError(check.error || "That doesn't look like a YouTube link");
          setStatus("idle");
          return;
        }
        const res = await submitYoutubeTranscribe(check.normalizedUrl || url.trim(), options, {
          signal: controller.signal,
        });
        jobId = res.job_id;
        jobBilling = res.billing ?? null;
      } else if (mode === "video") {
        const res = await submitVideoToText(file!, options, {
          signal: controller.signal,
          onUploadProgress: (sent, total) => {
            setUpload({ sent, total });
            setUploadedBytes(total);
          },
        });
        jobId = res.job_id;
        jobBilling = res.billing ?? null;
      } else {
        const res = await submitSpeechToText(file!, options, {
          signal: controller.signal,
          onUploadProgress: (sent, total) => {
            setUpload({ sent, total });
            setUploadedBytes(total);
          },
        });
        jobId = res.job_id;
        jobBilling = res.billing ?? null;
      }

      if (cancelledRef.current) return;
      setUpload(null);
      setStatus("processing");

      // The metered route reports what it just charged, so the navbar pill
      // updates from THIS response rather than a follow-up /credits/me — no
      // stale number on screen, and no extra request at the one moment the
      // user is watching the count change.
      setBilling(jobBilling);
      if (jobBilling) {
        applyBalance(jobBilling.balance, jobBilling.free_remaining);
      }

      pollStartedAtRef.current = Date.now();
      poll(jobId);
    } catch (err) {
      // A cancelled request rejects with a raw AbortError, not an
      // ApiError — check that before anything else.
      if (cancelledRef.current || controller.signal.aborted) return;

      // Out of credits is a DECISION POINT, not a failure. Returning to idle
      // keeps the file or link and the language/output choices, so buying and
      // pressing the button again just works — and nothing red is rendered.
      //
      // Before this, a 402 had no case in toTranscriptionError() either, so it
      // surfaced as "The request failed. Please try again." with no gate and
      // no prices: a hard dead end reached by anyone whose per-IP monthly
      // allowance ran out.
      if (catchCreditError(err)) {
        setStatus("idle");
        return;
      }

      if (err instanceof ApiError) {
        setError({ message: err.message, retryable: err.retryable !== false });
        // Prefer the server's Retry-After; fall back to the endpoint's own
        // window, which is the correct worst case — the limit can't still
        // be in force past it.
        if (err.isRateLimit) {
          setCooldownSeconds(err.retryAfterSeconds ?? getRetryAfterFallback(config.endpoint));
        }
      } else {
        setError({ message: "Something went wrong. Please try again.", retryable: true });
      }
      setStatus("failed");
    } finally {
      abortRef.current = null;
    }
  };

  // Assigned during render so onCredited always calls the CURRENT
  // handleSubmit rather than the one captured at first mount.
  submitRef.current = () => {
    void handleSubmit();
  };

  /* --- derived ----------------------------------------------------- */

  /**
   * Header state. A single dot and a single word, in one fixed place,
   * that is true in every state. The old header carried the mode name
   * ("AUDIO TO TEXT") directly beneath an h1 that already said it.
   */
  const headerState: { label: string; dot: string; pulse: boolean } = (() => {
    if (status === "uploading") return { label: "Uploading", dot: "bg-amber-500", pulse: true };
    if (status === "processing")
      return {
        label: isUrlMode && !serverTitle ? "Fetching" : "Transcribing",
        dot: "bg-amber-500",
        pulse: true,
      };
    if (status === "complete")
      return { label: isSample ? "Sample" : "Done", dot: "bg-teal-400", pulse: false };
    if (status === "failed") return { label: "Failed", dot: "bg-red-500", pulse: false };
    return { label: hasInput ? "Ready" : "Waiting", dot: "bg-graphite-600", pulse: false };
  })();

  /**
   * Two steps, because there are exactly two things we can honestly
   * report: bytes leaving the browser (measurable) and the server
   * working (not). Which one is lit is derived from real signals — the
   * upload callback, and `title` flipping non-null on the YouTube flow.
   */
  const steps: { label: string; state: StepState; detail?: string }[] = isUrlMode
    ? [
        {
          label: "Fetching the video",
          state: status === "uploading" || !serverTitle ? "active" : "done",
        },
        {
          label: task === "translate" ? "Transcribing and translating" : "Transcribing",
          state: serverTitle ? "active" : "pending",
        },
      ]
    : [
        {
          label: "Uploading",
          state: status === "uploading" ? "active" : "done",
          detail: upload
            ? `${formatMb(upload.sent)} / ${formatMb(upload.total)}`
            : uploadedBytes
              ? formatMb(uploadedBytes)
              : undefined,
        },
        {
          label: task === "translate" ? "Transcribing and translating" : "Transcribing",
          state: status === "processing" ? "active" : "pending",
        },
      ];

  const uploadPercent =
    upload && upload.total > 0 ? Math.min(100, Math.round((upload.sent / upload.total) * 100)) : 0;

  const rateLimitLabel = getRateLimitLabel(config.endpoint);

  /* One sorted list, always complete. The old control showed a handful
     and hid the rest behind a "Show 90 more languages" button that
     mutated the options under the user — so the language you wanted
     wasn't findable until you'd first found the link. */
  const languageGroups = useMemo(() => {
    const primary = languages?.primary ?? [];
    const extra = (languages?.all ?? [])
      .filter((code) => !primary.some((l) => l.code === code))
      .map((code) => ({ code, name: languageName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return [
      { label: "Common", options: primary },
      { label: "All languages", options: extra },
    ].filter((group) => group.options.length > 0);
  }, [languages]);

  /* --- render ------------------------------------------------------ */

  return (
    <div
      onKeyDown={(e) => {
        // Cmd/Ctrl+Enter submits from anywhere in the panel. Enter alone
        // is handled on the URL field only — inside a file form there is
        // no field for it to mean anything from.
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
          e.preventDefault();
          void handleSubmit();
        }
      }}
      /* NO overflow-hidden. It clips the language popover, and — less
         obviously — it silently breaks the sticky AudioPlayer inside
         TranscriptView: a sticky element inside an overflow-hidden
         ancestor sticks to that ancestor, which never scrolls, so it
         just never moves. The action bar carries rounded-b-xl instead. */
      className="rounded-xl border border-graphite-800 bg-graphite-900 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]"
    >
      {/* Whole window is a drop target, not just the dashed box. Off for
          the URL mode, while a job runs, and once a result is showing —
          a stray drop there would throw away the transcript. */}
      {!isUrlMode && (
        <FileDropOverlay
          onFile={(dropped) => {
            void handleFileSelect(dropped);
          }}
          disabled={isBusy || status === "complete"}
          label={mode === "video" ? "Drop your video anywhere" : "Drop your audio anywhere"}
          // Size read off the same config the dropzone uses, so the
          // overlay and the box can't disagree — they did, and the box
          // was the one that stayed silent.
          hint={`${
            mode === "video" ? "MP4, MOV, MKV, AVI, WEBM" : "MP3, WAV, FLAC, M4A, AAC, OGG"
          } · up to ${Math.round(config.maxBytes / (1024 * 1024))} MB`}
        />
      )}

      {/* ================= Header ================= */}
      <div className="flex items-center justify-between gap-3 border-b border-graphite-800 px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              headerState.dot,
              headerState.pulse && "animate-pulse motion-reduce:animate-none"
            )}
            aria-hidden
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {headerState.label}
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-subtle">
          {status === "complete" && transcript
            ? languageName(transcript.language)
            : "Whisper large-v3"}
        </span>
      </div>

      {/* Announced separately from the visible timer. The old panel put
          the ticking clock inside the live region, so a screen reader
          re-read the whole thing once a second. */}
      <p className="sr-only" role="status" aria-live="polite">
        {isBusy ? headerState.label : status === "complete" ? "Transcript ready" : ""}
      </p>

      {/* ================= Source ================= */}
      {showEditor && (
        <section className="px-5 py-5 sm:px-6">
          {!isUrlMode ? (
            <FileDropZone
              onFileSelect={handleFileSelect}
              currentFile={file}
              onClear={handleClearSource}
              disabled={isBusy}
              accept={config.accept}
              kind={mode === "video" ? "video" : "audio"}
              // handleFileSelect already decoded this to check the
              // 20-minute cap. Without the prop the dropzone decodes the
              // same header a second time and holds a second object URL.
              duration={fileDuration}
              // Turns the file card red, so the error underneath is
              // visibly about the file sitting above it.
              invalid={Boolean(validationError)}
              maxSize={config.maxBytes}
            />
          ) : (
            <div className="space-y-2.5">
              <FieldLabel htmlFor="transcribe-url" icon={Link2}>
                YouTube link
              </FieldLabel>

              <div className="relative flex items-center">
                <Link2
                  className={cn(
                    "pointer-events-none absolute left-3.5 h-4 w-4 transition-colors",
                    videoId ? "text-amber-500" : "text-text-subtle"
                  )}
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  id="transcribe-url"
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(sanitizeUserInput(e.target.value, 500));
                    // Clear immediately; the debounced effect above puts
                    // it back if the link still doesn't parse.
                    setValidationError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSubmit) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="https://youtube.com/watch?v=..."
                  disabled={isBusy}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={500}
                  aria-invalid={Boolean(validationError)}
                  className={cn(
                    "h-11 w-full rounded-lg border bg-graphite-850 pl-10 pr-24 text-sm text-text-primary",
                    "placeholder:text-text-subtle transition-colors",
                    "focus:outline-none focus-visible:ring-2 disabled:opacity-50",
                    validationError
                      ? "border-red-500/50 focus-visible:ring-red-500/25"
                      : videoId
                        ? "border-amber-500/40 focus-visible:ring-amber-500/20"
                        : "border-graphite-700 focus-visible:border-amber-500/50 focus-visible:ring-amber-500/20"
                  )}
                />
                <div className="absolute right-2 flex items-center gap-1">
                  {url && !isBusy && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrl("");
                        setValidationError(null);
                        inputRef.current?.focus();
                      }}
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
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:pointer-events-none disabled:opacity-40"
                    >
                      <ClipboardPaste className="h-3.5 w-3.5" />
                      Paste
                    </button>
                  )}
                </div>
              </div>

              {/* Confirmation row. Shows the actual video, not the string
                  "Ready to transcribe" — you should be able to tell you
                  pasted the wrong link before you spend 90 seconds
                  finding out. Identical component to the one on
                  /youtube-to-mp3 and /key-bpm-finder. */}
              {videoId ? (
                <VideoPreviewCard videoId={videoId} meta={videoMeta} size="md" />
              ) : (
                <p className="text-[13px] text-text-subtle">
                  Watch links, youtu.be and Shorts. Up to{" "}
                  {TRANSCRIPTION_LIMITS.durationSeconds / 60} minutes.
                </p>
              )}
            </div>
          )}

          {/* Inline, attached to the control that caused it, and sized
              like the helper text it replaces. A full-width red panel for
              "that file is 92 MB" is heavier than the problem. */}
          {validationError && (
            <p
              className="mt-3 flex items-start gap-2 text-[13px] text-red-400"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {validationError}
            </p>
          )}
        </section>
      )}

      {/* ================= Settings ================= */}
      {showEditor && (
        <section className="grid gap-5 border-t border-graphite-800 px-5 py-5 sm:grid-cols-2 sm:px-6">
          {/* Language.
              Enabled with or without a file — there is no reason to make
              someone commit a file before they can say what language it
              is in, and two greyed-out controls under an empty dropzone
              is most of why the resting state looked unfinished. */}
          <div className="space-y-2.5">
            <FieldLabel htmlFor="transcribe-language" icon={Languages}>
              Spoken language
            </FieldLabel>

            {/* Not a <select>. Its option list is an OS-level popup that
                no CSS on this page can reach, so on Windows/Chrome it
                draws a thick light scrollbar against the dark card. The
                search field is the second reason — ~99 languages in a
                native list are only navigable by type-ahead, which
                breaks the moment you think "Farsi" instead of
                "Persian". */}
            <SearchableSelect
              id="transcribe-language"
              value={language}
              onChange={setLanguage}
              disabled={isBusy}
              autoOption="Detect automatically"
              searchPlaceholder="Search languages"
              groups={languageGroups}
            />

            <p className="text-[13px] leading-relaxed text-text-subtle">
              Set it yourself for short clips, heavy accents, or mixed languages.
            </p>
          </div>

          {/* Output.
              A segmented control, matching the Read/Timestamps switch in
              TranscriptView — the same kind of choice should look the
              same everywhere in the feature. Two large bordered cards
              made a binary look like a menu. */}
          <div className="space-y-2.5">
            <FieldLabel>Output</FieldLabel>

            <div
              role="group"
              aria-label="Output language"
              className="grid h-11 grid-cols-2 gap-1 rounded-lg border border-graphite-700 bg-graphite-850 p-1"
            >
              {(
                [
                  { value: "transcribe", label: "Original" },
                  { value: "translate", label: "English" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTask(option.value)}
                  disabled={isBusy}
                  aria-pressed={task === option.value}
                  className={cn(
                    "rounded-md text-sm font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                    "disabled:pointer-events-none disabled:opacity-50",
                    task === option.value
                      ? "bg-amber-500/12 text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="text-[13px] leading-relaxed text-text-subtle">
              English translates as it transcribes, in one pass. It&apos;s the only target.
            </p>
          </div>
        </section>
      )}

      {/* ================= Working ================= */}
      {isBusy && (
        <section className="px-5 py-5 sm:px-6" aria-busy="true">
          {/* The same card that confirmed the link now carries the job.
              Watching the thumbnail you chose stay on screen for 90
              seconds is a stronger "yes, this is running on the right
              video" than a line of truncated text. */}
          {isUrlMode && videoId ? (
            <VideoPreviewCard
              videoId={videoId}
              meta={videoMeta}
              size="sm"
              title={serverTitle}
              className="mb-3.5"
              trailing={
                <span
                  className="shrink-0 font-mono text-[11px] tabular-nums text-text-subtle"
                  aria-hidden
                >
                  {formatElapsed(elapsedSeconds)}
                </span>
              }
            />
          ) : (
            <div className="mb-3.5 flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-text-primary">
                {file?.name ?? "Working on your file"}
              </p>
              <span
                className="shrink-0 font-mono text-[11px] tabular-nums text-text-subtle"
                aria-hidden
              >
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
          )}

          {/* Determinate while the bytes are going up, because that IS
              measurable — then indeterminate once the server takes over,
              because nothing about transcription reports progress and the
              work isn't linear in file length. h-1.5, not h-1: this is
              the main feedback surface during a 90-second wait and a 4px
              hairline is not enough to be one. */}
          {upload ? (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-graphite-800"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadPercent}
            >
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-200 ease-out"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          ) : (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-graphite-800">
              <div className="h-full w-1/3 rounded-full bg-amber-500 animate-indeterminate motion-reduce:w-full motion-reduce:animate-none" />
            </div>
          )}

          <ul className="mt-4 space-y-2.5">
            {steps.map((step) => (
              <StepRow key={step.label} {...step} />
            ))}
          </ul>

          {/* Static from the first second, because it's true from the
              first second. The old copy swapped this line in at t=15s,
              which reflowed the panel and read as a glitch at exactly the
              moment the user was watching it for signs of life. */}
          <p className="mt-4 border-t border-graphite-800 pt-3.5 text-[13px] leading-relaxed text-text-subtle">
            The transcription server spins down when idle, so the first run after a quiet period
            spends about a minute starting up. A short clip and a long one wait about the same.
            Keep this tab open.
          </p>
        </section>
      )}

      {/* ================= Complete ================= */}
      {status === "complete" && transcript && (
        <section className="px-5 py-5 sm:px-6">
          <TranscriptView
            transcript={transcript}
            title={resultTitle ?? serverTitle ?? file?.name ?? null}
            previewSrc={isSample ? SAMPLE_TRANSCRIPT.audioUrl : previewUrl}
            sampleNote={isSample ? SAMPLE_TRANSCRIPT.attribution : undefined}
          />

          {/* Renders nothing on a free tool, a free run, or the canned demo —
              only a real run that spent something says so. */}
          {!isSample && (
            <div className="mt-5">
              <CreditReceipt billing={billing} />
            </div>
          )}

          {/* Asking for a tip immediately after charging someone a credit is a
              bad look. A free run is still free, so it keeps the block. */}
          {billing?.charged !== "credit" && (
            <div className="mt-5">
              <SupportBlock />
            </div>
          )}
        </section>
      )}

      {/* ================= Failed ================= */}
      {status === "failed" && error && (
        <section className="border-t border-graphite-800 px-5 py-5 sm:px-6">
          <div
            className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
            {/* Server messages are written for the end user and carry the
                specifics — "Audio is too long (35.2 min)". Shown verbatim
                rather than replaced with generic copy. */}
            <p className="text-sm leading-relaxed text-text-primary">{error.message}</p>
          </div>
          {/* Shown after failure as well as success, matching JobToolForm
              and every other tool on the site. Most things that land here
              aren't the tool breaking — "Audio is too long (35.2 min)" or
              a rate limit is the form doing its job. Worth revisiting
              only for a genuine `service_down` 503, where "Enjoying
              AudioForges?" lands badly. */}
          <div className="mt-5">
            <SupportBlock />
          </div>
        </section>
      )}

      {/* ================= Action bar =================
          One button, one place, in every state. Slightly recessed so it
          reads as the panel's controls rather than another block of
          content. */}
      <div className="rounded-b-xl border-t border-graphite-800 bg-graphite-950/40 px-5 py-4 sm:px-6">
        {isBusy ? (
          <Button variant="outline" size="lg" className="w-full" onClick={handleCancel}>
            <X />
            Cancel
          </Button>
        ) : status === "complete" ? (
          <Button variant="outline" size="lg" className="w-full" onClick={handleReset}>
            <RotateCcw />
            {isSample ? "Transcribe my own file" : "Transcribe another"}
          </Button>
        ) : (
          <>
            <Button
              variant={hasInput ? "primary" : "secondary"}
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {isUrlMode ? <Link2 /> : mode === "video" ? <Film /> : <Mic />}
              {/* Renders nothing while the paywall is off or this rule is
                  disabled. When it is on, this is the only thing on the page
                  that says a run costs something before it's spent. */}
              <FreeTierBadge tool="transcribe" className="ml-0.5" />
              {cooldownSeconds > 0
                ? `Try again in ${formatCooldown(cooldownSeconds)}`
                : status === "failed" && error?.retryable
                  ? "Try again"
                  : config.submitLabel}
            </Button>

            {/* One line, not three centred ones. Limits on the left where
                they're read as terms; the sample on the right where it's
                read as an action. Both numbers come from a single source
                rather than the string they used to be baked into. */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[13px] text-text-subtle">
              <p>
                {cooldownSeconds > 0 ? (
                  <span className="text-text-muted">
                    Rate limit reached. The window clears in {formatCooldown(cooldownSeconds)}.
                  </span>
                ) : metered ? (
                  /*
                    THE SHARED ALLOWANCE, SAID OUT LOUD.
                    All three transcription tools draw on ONE "transcribe"
                    budget. Someone who reads "2 free" on this page and spends
                    one here will find one — not two — waiting on
                    /youtube-to-text, and discovering that by surprise feels
                    like being short-changed. So it's stated before the click,
                    not after.

                    No per-hour figure while metered: the shared rule is tiered
                    (2/hour free, 30/hour credited) and /credits/me's
                    rate_limit.tools does not yet carry "transcribe", so any
                    number printed here would be right for one tier and a lie
                    to the other. The duration cap is safe — it applies to
                    everyone, paid or not.
                  */
                  <>
                    {balance > 0 ? (
                      <>1 credit per transcription</>
                    ) : freeRemaining > 0 ? (
                      <>
                        {freeRemaining} free {freeRemaining === 1 ? "run" : "runs"} left this
                        month
                      </>
                    ) : (
                      /*
                        Nothing left. Stating "0 free runs left" and stopping
                        there describes the wall without showing the door —
                        and this is a REAL state, not an edge case: the free
                        allowance is min(owner, per-IP), so a shared or
                        returning IP reaches it routinely. The gate still
                        opens on submit, but a link here means nobody has to
                        press a button and be refused to find out what to do.
                      */
                      <>
                        No free runs left this month.{" "}
                        <Link
                          href="/pricing"
                          className="rounded text-amber-400 underline underline-offset-2 outline-none transition-colors hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        >
                          Credits are $0.20–0.30 a run
                        </Link>
                      </>
                    )}
                    , shared across all three transcription tools. Up to{" "}
                    {TRANSCRIPTION_LIMITS.durationSeconds / 60} min per file.
                  </>
                ) : (
                  <>
                    Free, no account. Up to {TRANSCRIPTION_LIMITS.durationSeconds / 60} min per file
                    {rateLimitLabel ? `, ${rateLimitLabel}` : ""}.
                  </>
                )}
              </p>

              {/* An empty upload box asks someone to commit a file before
                  they know whether the output is any good. Nothing else
                  in this search result lets you skip that step. */}
              {!hasInput && (
                <button
                  type="button"
                  onClick={handleShowSample}
                  className="shrink-0 rounded text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                >
                  See a sample result
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {gate}
    </div>
  );
}