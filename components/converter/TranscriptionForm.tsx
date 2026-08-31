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
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  Section,
  formatCooldown,
  formatElapsed,
  terminalPollError,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
} from "@/components/tools/JobFormKit";
import { Segmented } from "@/components/converter/ToolControls";
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
  TRANSCRIPTION_MODEL,
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
/* THIS PASS                                                            */
/* ==================================================================== */
/**
 * IT USES THE SHELL NOW.
 *
 * This form was the best-designed island on the site: its own header, its own
 * zone rhythm, its own action bar, its own working panel — all carefully
 * argued, all built before JobFormKit existed, and none of it shared. So the
 * most expensive tool in the product was also the one that looked least like
 * the other thirty, and every fix that landed in the kit had to be
 * re-discovered here.
 *
 * FormShell now draws the card, the status dot, the step rail (Source →
 * Transcribe → Transcript — a three-stage job that never showed you which
 * stage you were in) and the pinned action bar.
 *
 * WHAT I DELIBERATELY DID NOT ADOPT: the kit's WorkingPanel. Every other tool
 * eases a fake progress curve toward 92%, which is a reasonable lie when the
 * work is roughly linear in file size. Transcription is not — a cold start
 * spends ~90 seconds before any audio is touched, and a 30-second clip and a
 * 20-minute one finish about the same. This panel's refusal to invent a
 * percentage, and its two honest steps, is the better design. It stays.
 *
 * THREE BUGS
 *
 * 1. A REJECTED POLL WAS TREATED AS A SLOW JOB. The catch only short-circuited
 *    on `kind === "expired"`, so a 401 or 403 was retried until maxPollMs and
 *    then reported as "taking longer than the server allows" — about a job the
 *    server had answered immediately. On the tool where a run costs a credit.
 *
 * 2. THE COST LINE READ THE CHARGE ORDER BACKWARDS. `balance > 0 ? "1 credit
 *    per transcription" : freeRemaining > 0 ? "N free runs left"` — so someone
 *    holding both credits AND free runs was told a run costs a credit, when
 *    the free allowance is spent first. It also contradicted FreeTierBadge on
 *    the same button, which shows free runs first.
 *
 * 3. THE COOLDOWN HAD NO BAR. The number ticked down inside the button label
 *    and nowhere else; every other tool draws a countdown you can watch.
 */

/* ------------------------------------------------------------------ */
/* Modes                                                               */
/* ------------------------------------------------------------------ */

export type TranscriptionMode = "audio" | "youtube" | "video";

interface ModeConfig {
  endpoint: TranscriptionEndpoint;
  submitLabel: string;
  /** Header eyebrow. The old one said the mode name directly under an h1 that
   *  already said it; this says what the tool IS, like every other card. */
  toolLabel: string;
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
    toolLabel: "Audio to text",
    accept: `audio/*,${TRANSCRIPTION_AUDIO_EXTENSIONS.map((e) => `.${e}`).join(",")}`,
    maxBytes: TRANSCRIPTION_LIMITS.audioBytes,
    playable: true,
  },
  youtube: {
    endpoint: "youtube/transcribe",
    submitLabel: "Transcribe video",
    toolLabel: "YouTube to text",
    accept: "",
    maxBytes: 0,
    playable: false,
  },
  video: {
    endpoint: "video-to-text",
    submitLabel: "Transcribe video",
    toolLabel: "Video to text",
    accept: `video/*,${TRANSCRIPTION_VIDEO_EXTENSIONS.map((e) => `.${e}`).join(",")}`,
    maxBytes: TRANSCRIPTION_LIMITS.videoBytes,
    playable: true,
  },
};

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
 *  speaks the same language as the copy around it. */
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
function StepRow({ state, label, detail }: { state: StepState; label: string; detail?: string }) {
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

      <span className={cn("text-[13px]", state === "pending" ? "text-text-subtle" : "text-text-primary")}>
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

  const [languages, setLanguages] = useState<TranscriptionLanguages | null>(
    initialLanguages ?? null
  );

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
   *  of the user's own file. */
  const [isSample, setIsSample] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** Bytes sent / total, while the file is going up. Null once the
   *  upload finishes — from that point the server is working and there
   *  is genuinely nothing to measure. */
  const [upload, setUpload] = useState<{ sent: number; total: number } | null>(null);
  /** Sticks around after the upload completes so the finished step can
   *  still show what was sent. */
  const [uploadedBytes, setUploadedBytes] = useState<number | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [serverTitle, setServerTitle] = useState<string | null>(null);
  /** What the server said it charged. Reported verbatim, never inferred. */
  const [billing, setBilling] = useState<SubmitBilling | null>(null);

  const isBusy = status === "uploading" || status === "processing";
  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isBusy);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  /**
   * STATE, NOT A REF, because CooldownBar renders it. As a ref it only showed
   * the right ceiling because the setCooldownSeconds call on the next line
   * happened to trigger the render that read it.
   */
  const [cooldownCeiling, setCooldownCeiling] = useState(getRetryAfterFallback(config.endpoint));

  /**
   * CREDITS.
   *
   * All three transcription routes are metered under ONE shared rule key,
   * "transcribe" — they hit one RunPod endpoint and one concurrency pool, so
   * three keys would hand a caller three budgets for one resource.
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

  const videoId = useMemo(() => (isUrlMode ? extractVideoId(url.trim()) : null), [isUrlMode, url]);
  const hasInput = isUrlMode ? Boolean(videoId) : Boolean(file);
  const canSubmit = hasInput && !validationError && !isBusy && cooldownSeconds === 0;
  const isComplete = status === "complete";
  const isFailed = status === "failed";
  /** Source and settings are visible in exactly the states where they can
   *  be acted on. */
  const showEditor = status === "idle" || isFailed;

  const step: 1 | 2 | 3 = isComplete ? 3 : isBusy ? 2 : 1;
  const STEPS: readonly [string, string, string] = isUrlMode
    ? ["Link", "Transcribe", "Transcript"]
    : ["File", "Transcribe", "Transcript"];

  /** Title/channel for the pasted link. Shared hook, shared card. */
  const videoMeta = useYouTubeMeta(videoId);

  /* --- preview audio ---------------------------------------------- */
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
        // Auto-detect still works with no list.
      });
    return () => {
      cancelled = true;
    };
  }, [languages]);

  /* --- link validation, debounced --------------------------------- */
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

  /* --- polling ---------------------------------------------------- */
  /**
   * The poll loop reschedules itself, which it can't do by naming itself: a
   * value referenced inside its own initializer is something the React
   * Compiler can't reason about. One indirection through a ref — declared
   * BEFORE the callback, assigned in an effect rather than during render —
   * removes the self-reference without changing the polling behaviour.
   */
  const pollFnRef = useRef<(jobId: string) => void>(() => {});

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

        /*
          A 401, 403 or 404 is an ANSWER, not a blip.

          This used to short-circuit on `kind === "expired"` alone, so an auth
          failure fell through to "poll again" and repeated identically until
          the ceiling — then reported "taking longer than the server allows"
          about a job the server had settled in seconds. On the one tool where
          the run costs a credit.
        */
        const terminal = terminalPollError(err);
        if (terminal || (err instanceof ApiError && err.kind === "expired")) {
          stopPolling();
          setError({
            message:
              err instanceof ApiError && err.kind === "expired"
                ? err.message
                : (terminal?.title ?? "This job is no longer available."),
            retryable: true,
          });
          setStatus("failed");
          return;
        }
        // Transient network blips fall through to the next tick.
      }

      pollRef.current = setTimeout(() => pollFnRef.current(jobId), TRANSCRIPTION_LIMITS.pollIntervalMs);
    },
    [config.endpoint, stopPolling]
  );

  useEffect(() => {
    pollFnRef.current = poll;
  }, [poll]);

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
    setIsSample(false);

    // Duration needs a decode, so it lands a moment after the file does.
    // Advisory only — a container the browser can't read returns null.
    const duration = await readMediaDuration(selected, kind);
    setFileDuration(duration);
    const durationCheck = validateTranscriptionDuration(duration);
    if (!durationCheck.ok) setValidationError(durationCheck.error ?? null);
  };

  /** Removes the chosen file and nothing else. Removing a file is not
   *  "start over" — the language and output you picked are still the ones
   *  you want for the file you're about to pick instead. */
  const handleClearSource = () => {
    setFile(null);
    setFileDuration(null);
    setUrl("");
    setValidationError(null);
    setError(null);
    if (isFailed) setStatus("idle");
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
   *  API: a real run would spend up to 90 seconds on a cold start and burn
   *  one of the user's submissions before they'd uploaded anything. */
  const handleShowSample = () => {
    stopPolling();
    cancelledRef.current = true;
    setIsSample(true);
    setTranscript(SAMPLE_TRANSCRIPT.transcript);
    setResultTitle(SAMPLE_TRANSCRIPT.title);
    setError(null);
    setValidationError(null);
    setBilling(null);
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
    // Same reason as handleReset: a cancelled run's receipt must not decide
    // the next run's copy.
    setBilling(null);
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
      // updates from THIS response rather than a follow-up /credits/me.
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

      // Out of credits is a DECISION POINT, not a failure.
      if (catchCreditError(err)) {
        setStatus("idle");
        return;
      }

      if (err instanceof ApiError) {
        setError({ message: err.message, retryable: err.retryable !== false });
        // Prefer the server's Retry-After; fall back to the endpoint's own
        // window, which is the correct worst case.
        if (err.isRateLimit) {
          const wait = err.retryAfterSeconds ?? getRetryAfterFallback(config.endpoint);
          setCooldownCeiling(Math.max(1, wait));
          setCooldownSeconds(wait);
        }
      } else {
        setError({ message: "Something went wrong. Please try again.", retryable: true });
      }
      setStatus("failed");
    } finally {
      abortRef.current = null;
    }
  };

  // Synced after every render so onCredited always calls the CURRENT
  // handleSubmit rather than the one captured at first mount.
  useEffect(() => {
    submitRef.current = () => {
      void handleSubmit();
    };
  });

  /* --- derived ----------------------------------------------------- */

  /**
   * Two steps, because there are exactly two things we can honestly
   * report: bytes leaving the browser (measurable) and the server
   * working (not).
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

  /* One sorted list, always complete. */
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

  const formError: FormError | null = error
    ? {
        // Server messages are written for the end user and carry the specifics
        // — "Audio is too long (35.2 min)". Shown verbatim as the headline.
        title: error.message,
        hint: error.retryable
          ? "Run it again, or try a different file."
          : "This one won't succeed on a retry.",
      }
    : null;

  /* --- render ------------------------------------------------------ */

  const footer = isBusy ? (
    <Button variant="outline" size="lg" className="w-full" onClick={handleCancel}>
      <X />
      Cancel
    </Button>
  ) : isComplete ? (
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
        {/* Renders nothing while the paywall is off or this rule is disabled. */}
        <FreeTierBadge tool="transcribe" className="ml-0.5" />
        {cooldownSeconds > 0
          ? `Try again in ${formatCooldown(cooldownSeconds)}`
          : isFailed && error?.retryable
            ? "Try again"
            : config.submitLabel}
      </Button>

      <CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeiling} />

      {/* One line, not three centred ones. Limits on the left where they're
          read as terms; the sample on the right where it's read as an action. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[13px] text-text-subtle">
        <p>
          {cooldownSeconds > 0 ? (
            <span className="text-text-muted">
              Rate limit reached. The window clears in {formatCooldown(cooldownSeconds)}.
            </span>
          ) : metered ? (
            /*
              THE SHARED ALLOWANCE, SAID OUT LOUD. All three transcription
              tools draw on ONE "transcribe" budget, and finding that out by
              surprise feels like being short-changed.

              FREE RUNS ARE CHECKED FIRST. This used to read `balance > 0 ?
              "1 credit per transcription" : freeRemaining > 0 ? ...`, so
              somebody holding credits AND free runs was told the run costs a
              credit — when the free allowance is spent first. It also
              contradicted FreeTierBadge on the very same button, which shows
              free runs first.
            */
            <>
              {freeRemaining > 0 ? (
                <>
                  {freeRemaining} free {freeRemaining === 1 ? "run" : "runs"} left this month
                </>
              ) : balance > 0 ? (
                <>1 credit per transcription</>
              ) : (
                /*
                  Nothing left. Stating "0 free runs left" and stopping there
                  describes the wall without showing the door — and this is a
                  REAL state, not an edge case: the free allowance is
                  min(owner, per-IP), so a shared or returning IP reaches it
                  routinely.
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

        {/* An empty upload box asks someone to commit a file before they know
            whether the output is any good. */}
        {!hasInput && (
          <button
            type="button"
            onClick={handleShowSample}
            className="shrink-0 rounded text-amber-400 underline underline-offset-2 outline-none transition-colors hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-500/40"
          >
            See a sample result
          </button>
        )}
      </div>
    </>
  );

  return (
    <div
      onKeyDown={(e) => {
        // Cmd/Ctrl+Enter submits from anywhere in the panel.
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
          e.preventDefault();
          void handleSubmit();
        }
      }}
    >
      {/* Whole window is a drop target, not just the dashed box. */}
      {!isUrlMode && (
        <FileDropOverlay
          onFile={(dropped) => {
            void handleFileSelect(dropped);
          }}
          disabled={isBusy || isComplete}
          label={mode === "video" ? "Drop your video anywhere" : "Drop your audio anywhere"}
          hint={`${
            mode === "video" ? "MP4, MOV, MKV, AVI, WEBM" : "MP3, WAV, FLAC, M4A, AAC, OGG"
          } · up to ${Math.round(config.maxBytes / (1024 * 1024))} MB`}
        />
      )}

      <FormShell
        /*
          The card must NOT clip its children here, and this is the only form
          where that's true. Two things inside depend on it:
            · SearchableSelect's ~99-item language popover, which a clipped
              card cuts off at its own edge.
            · TranscriptView's sticky player. `position: sticky` resolves
              against the nearest scrollable ancestor, and overflow-hidden
              makes the card one — so the player would stick to a container
              that never scrolls and silently never move.
          The old hand-rolled card carried this note; moving to the shell
          reintroduced the bug until the shell learned to opt out.
        */
        allowOverflow
        toolLabel={config.toolLabel}
        toolMeta={
          isComplete && transcript
            ? languageName(transcript.language)
            : /* From the languages payload this form already fetches, so it
                 costs no extra request and follows the backend without a
                 deploy. Falls back to the constant. */
              (languages?.model_name ?? TRANSCRIPTION_MODEL)
        }
        steps={STEPS}
        step={step}
        busy={isBusy}
        failed={isFailed}
        complete={isComplete}
        footer={footer}
      >
        {/* ================= Source ================= */}
        {showEditor && (
          <Section>
            {!isUrlMode ? (
              <FileDropZone
                onFileSelect={handleFileSelect}
                currentFile={file}
                onClear={handleClearSource}
                disabled={isBusy}
                accept={config.accept}
                kind={mode === "video" ? "video" : "audio"}
                // handleFileSelect already decoded this to check the cap.
                duration={fileDuration}
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
                      // Clear immediately; the debounced effect puts it back
                      // if the link still doesn't parse.
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
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-text-muted outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <ClipboardPaste className="h-3.5 w-3.5" />
                        Paste
                      </button>
                    )}
                  </div>
                </div>

                {/* Confirmation row. Shows the actual video, not the string
                    "Ready to transcribe" — you should be able to tell you
                    pasted the wrong link before you spend 90 seconds finding
                    out. */}
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

            {/* Inline, attached to the control that caused it. A full-width
                red panel for "that file is 92 MB" is heavier than the
                problem. */}
            {validationError && (
              <p className="mt-3 flex items-start gap-2 text-[13px] text-red-400" role="alert">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {validationError}
              </p>
            )}
          </Section>
        )}

        {/* ================= Settings ================= */}
        {showEditor && (
          <Section>
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Language. Enabled with or without a file — there is no reason
                  to make someone commit a file before they can say what
                  language it's in. */}
              <div className="space-y-2.5">
                <FieldLabel htmlFor="transcribe-language" icon={Languages}>
                  Spoken language
                </FieldLabel>

                {/* Not a <select>. Its option list is an OS-level popup that no
                    CSS on this page can reach, and ~99 languages in a native
                    list are only navigable by type-ahead — which breaks the
                    moment you think "Farsi" instead of "Persian". */}
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

              {/* Output. The shared Segmented control — same component as every
                  other binary choice on the site, and the same one
                  TranscriptView uses for Read/Timestamps. */}
              <div className="space-y-2.5">
                <FieldLabel>Output</FieldLabel>

                <Segmented
                  label="Output language"
                  value={task}
                  onChange={setTask}
                  disabled={isBusy}
                  options={[
                    { value: "transcribe", label: "Original" },
                    { value: "translate", label: "English" },
                  ]}
                />

                <p className="text-[13px] leading-relaxed text-text-subtle">
                  English translates as it transcribes, in one pass. It&apos;s the only target.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* ================= Working =================
            NOT the kit's WorkingPanel, and deliberately so. Every other tool
            eases an invented curve toward 92%, which is a fair approximation
            when the work scales with file size. Transcription doesn't: a cold
            start spends ~90 seconds before touching any audio, and a 30-second
            clip finishes about when a 20-minute one does. Two honest steps and
            a bar that goes indeterminate the moment we stop being able to
            measure anything beats a number we'd be making up. */}
        {isBusy && (
          <Section>
            <div aria-busy="true">
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
                  measurable — then indeterminate once the server takes over. */}
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
                  <div className="h-full w-1/3 animate-indeterminate rounded-full bg-amber-500 motion-reduce:w-full motion-reduce:animate-none" />
                </div>
              )}

              <ul className="mt-4 space-y-2.5">
                {steps.map((s) => (
                  <StepRow key={s.label} {...s} />
                ))}
              </ul>

              {/* Static from the first second, because it's true from the first
                  second. Swapping this line in at t=15s reflowed the panel and
                  read as a glitch at exactly the moment the user was watching
                  it for signs of life. */}
              <p className="mt-4 border-t border-graphite-800 pt-3.5 text-[13px] leading-relaxed text-text-subtle">
                The transcription server spins down when idle, so the first run after a quiet
                period spends about a minute starting up. A short clip and a long one wait about
                the same. Keep this tab open.
              </p>
            </div>
          </Section>
        )}

        {/* ================= Complete ================= */}
        {isComplete && transcript && (
          <Section>
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

            {/* Asking for a tip immediately after charging someone a credit is
                a bad look. A free run is still free, so it keeps the block. */}
            {billing?.charged !== "credit" && (
              <div className="mt-5">
                <SupportBlock />
              </div>
            )}
          </Section>
        )}

        {/* ================= Failed ================= */}
        {isFailed && formError && (
          <Section>
            <div className="space-y-5">
              <ErrorPanel error={formError} />
              {/* Most things that land here aren't the tool breaking — "Audio
                  is too long (35.2 min)" or a rate limit is the form doing its
                  job. */}
              <SupportBlock />
            </div>
          </Section>
        )}
      </FormShell>

      {gate}
    </div>
  );
}