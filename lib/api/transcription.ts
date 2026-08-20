// lib/api/transcription.ts
//
// The three transcription endpoints — /speech-to-text, /youtube/transcribe
// and /video-to-text — live here rather than in railway.ts for two
// reasons. railway.ts is already ~900 lines covering every other tool,
// and these three diverge from the house job pattern in ways that would
// need special-casing inside the shared helpers anyway:
//
//   1. They take OPTIONS on submit (language / task / mode), not just a
//      payload. Every other tool submits a file and nothing else.
//   2. Their 503 means two different things — one retryable, one not —
//      so they need their own error mapper.
//   3. Their status response carries `elapsed_seconds`, and their result
//      carries `language_forced`, `task`, `mode` and `duration`, none of
//      which exist on JobStatusResult / the old TranscriptResult.
//   4. Their job ids are NOT portable between the three endpoints, so the
//      endpoint has to travel with the id everywhere.
//
// Everything network-level is still shared: this imports fetchWithTimeout
// and readRetryAfter from railway.ts rather than reimplementing the
// timeout/abort/Cloudflare handling, which is exactly the drift we don't
// want two copies of.

import { ApiError, RAILWAY_API_BASE, fetchWithTimeout, readRetryAfter, type RequestOptions } from "@/lib/api/railway";

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

/**
 * A job id from one endpoint polled against another returns 404, which
 * is indistinguishable from expiry. Storing this alongside the id is not
 * optional — it's the only thing that makes the id meaningful.
 */
export type TranscriptionEndpoint = "speech-to-text" | "youtube/transcribe" | "video-to-text";

export const TRANSCRIPTION_ENDPOINTS = {
  audio: "speech-to-text",
  youtube: "youtube/transcribe",
  video: "video-to-text",
} as const satisfies Record<string, TranscriptionEndpoint>;

/* ------------------------------------------------------------------ */
/* Limits — mirrored from the server so the client can reject first     */
/* ------------------------------------------------------------------ */

/**
 * The server enforces all of these; these copies exist purely so a bad
 * upload is rejected BEFORE the bytes go over the wire. A 99MB video
 * refused after a five-minute upload is the worst outcome in the whole
 * flow, and it's entirely avoidable.
 */
export const TRANSCRIPTION_LIMITS = {
  /** /speech-to-text */
  audioBytes: 80 * 1024 * 1024,
  /** /video-to-text — deliberately different from audioBytes. */
  videoBytes: 100 * 1024 * 1024,
  /** Applies to the audio track on all three endpoints. */
  durationSeconds: 20 * 60,
  /**
   * YouTube DOWNLOAD allows 40 minutes but transcription only allows 20,
   * so a 30-minute video downloads successfully and then fails. Warn on
   * this before submitting when oEmbed gives us a duration.
   */
  youtubeDownloadDurationSeconds: 40 * 60,
  /** §4: every 3s. Faster adds load and tells the user nothing. */
  pollIntervalMs: 3_000,
  /**
   * §4: 20 minutes, and this figure is NOT a guess — the GPU job carries
   * a 900s execution timeout enforced on both sides, so anything still
   * running past it has already been cancelled server-side.
   *
   * Note this is double the 10-minute DEFAULT_MAX_POLL_MS in
   * YouTubeUrlForm. Reusing that default here would kill a legitimate
   * long job at 10 minutes and blame the server.
   */
  maxPollMs: 20 * 60 * 1000,
  /** Jobs vanish an hour after creation, including ones still running. */
  jobTtlMs: 60 * 60 * 1000,
  /**
   * §1: the worker is serverless and spins down when idle. At low
   * traffic MOST requests pay this. Don't show a "seems stuck" warning
   * before it elapses — cold start looks exactly like a hang.
   */
  coldStartSeconds: 90,
} as const;

export const TRANSCRIPTION_AUDIO_EXTENSIONS = [
  "mp3", "wav", "flac", "m4a", "aac", "ogg", "aiff", "aif",
] as const;

export const TRANSCRIPTION_VIDEO_EXTENSIONS = [
  "mp4", "mov", "mkv", "avi", "webm", "flv", "wmv", "m4v", "3gp", "mpeg", "mpg",
] as const;

/* ------------------------------------------------------------------ */
/* Request options                                                     */
/* ------------------------------------------------------------------ */

/**
 * `translate` is NOT a language picker — it's a binary "keep the source
 * language" vs "output English". There is no other target language, and
 * it costs nothing extra (same model, same single pass).
 */
export type TranscriptionTask = "transcribe" | "translate";

export interface TranscriptionOptions {
  /**
   * ISO-639-1, e.g. "en", "ne", "hi". Omit or pass "" for auto-detect.
   * Locale forms are normalised server-side ("en-US" → "en") and the
   * resolved value comes back in the submit response.
   */
  language?: string;
  task?: TranscriptionTask;
  /** Speed tier. Read the valid list from getTranscriptionLanguages(). */
  mode?: string;
}

/** An unselected <select> posts "", which the server reads as
 *  auto-detect — but omitting the field entirely is unambiguous, so
 *  empty values are dropped rather than sent. */
function appendOptions(fd: FormData, options: TranscriptionOptions = {}): void {
  if (options.language) fd.append("language", options.language);
  if (options.task) fd.append("task", options.task);
  if (options.mode) fd.append("mode", options.mode);
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** Machine-readable causes. Branch on these, never on the message. */
export type TranscriptionErrorKind =
  | "invalid_input"
  | "expired"
  | "not_ready"
  | "rate_limited"
  | "queue_full"
  | "service_down"
  | "server_error"
  | "unknown";

async function readDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    /* Cloudflare error page, empty body, HTML */
  }
  return "";
}

/**
 * These endpoints write their `detail` strings FOR THE END USER — §4 is
 * explicit that they should be displayed verbatim and not wrapped in
 * "Error:" or replaced with something generic. They carry the actual
 * actionable information ("Audio is too long (35.2 min). Maximum is 20
 * min."), which no generic fallback can reproduce.
 *
 * So this mapper's job is not to rewrite the message. It's to attach the
 * `kind` and `retryable` flags the UI needs to decide which affordance
 * to render, and to supply copy only where the server sent none.
 */
async function toTranscriptionError(res: Response): Promise<ApiError> {
  const detail = await readDetail(res);
  const retryAfter = readRetryAfter(res);

  const build = (
    fallback: string,
    kind: TranscriptionErrorKind,
    extra: { retryable?: boolean; isRateLimit?: boolean; isServerBusy?: boolean } = {}
  ) => new ApiError(detail || fallback, res.status, { kind, retryAfterSeconds: retryAfter, ...extra });

  switch (res.status) {
    case 400:
      // Bad language code, unsupported type, too long. Never retry
      // unchanged — the same request fails the same way.
      return build("That file or link wasn't accepted. Please check it and try again.", "invalid_input", {
        retryable: false,
      });

    case 404:
      return build("This job has expired. Jobs are kept for one hour.", "expired", { retryable: false });

    case 409:
      // Not really an error — the result was requested before the job
      // finished. The caller polled wrong.
      return build("This transcript isn't ready yet.", "not_ready", { retryable: true });

    case 429:
      // 2 per 5 minutes, per IP, per endpoint. A user transcribing a few
      // files WILL hit this, so it deserves a countdown rather than a
      // red toast.
      return build("You've reached the limit of 2 submissions per 5 minutes.", "rate_limited", {
        isRateLimit: true,
        retryable: true,
      });

    case 503: {
      // The one error genuinely worth branching on. Both arrive as 503
      // with a detail string, and they mean opposite things to the user.
      const queueFull = detail.toLowerCase().includes("queue is full");
      return queueFull
        ? build("The transcription queue is full. Try again in a minute.", "queue_full", {
            isServerBusy: true,
            retryable: true,
          })
        : build(
            "Transcription is temporarily unavailable. Every other tool on the site still works.",
            "service_down",
            { isServerBusy: true, retryable: false }
          );
    }

    case 500:
      return build("Something went wrong on our end. Please try again.", "server_error", { retryable: true });

    default:
      return build("The request failed. Please try again.", "unknown", { retryable: true });
  }
}

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError("The server sent back a response we couldn't read.", res.status, {
      kind: "unknown",
      isServerBusy: true,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Submit                                                              */
/* ------------------------------------------------------------------ */

export interface TranscriptionSubmitResponse {
  job_id: string;
  status: "processing";
  /**
   * The RESOLVED options after normalisation — not an echo of what was
   * sent. `language` is null when auto-detecting. Use this to render
   * accurate progress text ("Translating to English…") instead of
   * guessing from the request.
   */
  options: {
    language: string | null;
    task: TranscriptionTask;
    mode: string;
  };
}

/**
 * Uploads get a long deadline because the UPLOAD itself counts against
 * it — an 80MB file on a slow connection is minutes of transfer before
 * the server says anything. Kept just under Cloudflare's 100s proxy
 * ceiling for the same reason as railway.ts's synchronous routes.
 */
const UPLOAD_TIMEOUT_MS = 95_000;
const URL_SUBMIT_TIMEOUT_MS = 30_000;
const READ_TIMEOUT_MS = 15_000;

export async function submitSpeechToText(
  file: File,
  options: TranscriptionOptions = {},
  opts: RequestOptions = {}
): Promise<TranscriptionSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  appendOptions(fd, options);

  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/speech-to-text`,
    { method: "POST", body: fd, signal: opts.signal },
    UPLOAD_TIMEOUT_MS
  );
  if (!res.ok) throw await toTranscriptionError(res);
  return readJson<TranscriptionSubmitResponse>(res);
}

/**
 * Note this is multipart/form-data, NOT the x-www-form-urlencoded shape
 * every other URL-submitting route in railway.ts uses. Don't route it
 * through submitUrlJob — the content type differs.
 */
export async function submitYoutubeTranscribe(
  url: string,
  options: TranscriptionOptions = {},
  opts: RequestOptions = {}
): Promise<TranscriptionSubmitResponse> {
  const fd = new FormData();
  fd.append("url", url.trim());
  appendOptions(fd, options);

  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/youtube/transcribe`,
    { method: "POST", body: fd, signal: opts.signal },
    URL_SUBMIT_TIMEOUT_MS
  );
  if (!res.ok) throw await toTranscriptionError(res);
  return readJson<TranscriptionSubmitResponse>(res);
}

export async function submitVideoToText(
  file: File,
  options: TranscriptionOptions = {},
  opts: RequestOptions = {}
): Promise<TranscriptionSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  appendOptions(fd, options);

  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/video-to-text`,
    { method: "POST", body: fd, signal: opts.signal },
    UPLOAD_TIMEOUT_MS
  );
  if (!res.ok) throw await toTranscriptionError(res);
  return readJson<TranscriptionSubmitResponse>(res);
}

/* ------------------------------------------------------------------ */
/* Poll                                                                */
/* ------------------------------------------------------------------ */

export type TranscriptionJobStatus = "processing" | "complete" | "failed";

export interface TranscriptionStatus {
  job_id: string;
  status: TranscriptionJobStatus;
  /**
   * Behaves differently per endpoint, and the difference is useful:
   * /speech-to-text and /video-to-text set it to the uploaded filename
   * immediately, while /youtube/transcribe leaves it null until the
   * download finishes and then sets the video title. On the YouTube
   * flow that transition is the ONLY signal the job moved from
   * downloading to transcribing.
   */
  title: string | null;
  /** Written for the end user. Display verbatim when status is failed. */
  error: string | null;
  /**
   * Seconds since job CREATION, including queue wait — not since work
   * began. A job sitting behind three others shows a large number while
   * doing nothing. This is not a progress signal and must not be used
   * to drive a percentage.
   */
  elapsed_seconds: number;
}

export function getTranscriptionStatus(
  endpoint: TranscriptionEndpoint,
  jobId: string,
  opts: RequestOptions = {}
): Promise<TranscriptionStatus> {
  return fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}/status/${jobId}`,
    { method: "GET", signal: opts.signal },
    READ_TIMEOUT_MS
  ).then(async (res) => {
    if (!res.ok) throw await toTranscriptionError(res);
    return readJson<TranscriptionStatus>(res);
  });
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

export interface TranscriptSegment {
  /** Seconds from the start, 2dp. Chronological, non-overlapping. */
  start: number;
  end: number;
  /** Already trimmed; empty segments are dropped server-side. */
  text: string;
}

export interface Transcript {
  /** Segments joined by single spaces. Never empty — an empty result
   *  fails the job instead of returning blank. */
  text: string;
  /**
   * The SOURCE language, even when task is "translate". A transcript
   * with language "ne" and English text is correct, not a bug — check
   * `task` before labelling the output.
   */
  language: string;
  /**
   * Detection confidence, 0–1. ALWAYS 1.0 when language_forced is true,
   * because the model's internal figure is meaningless in that case.
   */
  language_probability: number;
  /** Whether the caller pinned the language. Only show a confidence
   *  indicator when this is false. */
  language_forced: boolean;
  task: TranscriptionTask;
  mode: string;
  /** Audio length in seconds. */
  duration: number;
  segments: TranscriptSegment[];
}

/**
 * Call ONCE, after status reports complete. Calling it early returns 409
 * rather than blocking, and calling it after the TTL returns 404.
 */
export function getTranscriptionResult(
  endpoint: TranscriptionEndpoint,
  jobId: string,
  opts: RequestOptions = {}
): Promise<Transcript> {
  return fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}/result/${jobId}`,
    { method: "GET", signal: opts.signal },
    READ_TIMEOUT_MS
  ).then(async (res) => {
    if (!res.ok) throw await toTranscriptionError(res);
    return readJson<Transcript>(res);
  });
}

/* ------------------------------------------------------------------ */
/* Languages                                                           */
/* ------------------------------------------------------------------ */

export interface TranscriptionLanguage {
  code: string;
  name: string;
}

export interface TranscriptionLanguages {
  auto_detect_default: boolean;
  /** ~34 well-supported languages WITH display names, already in
   *  recommended display order. This is the main dropdown. */
  primary: TranscriptionLanguage[];
  /** ~100 ISO-639-1 codes, no names. Put behind a "More languages"
   *  expander and resolve names with Intl.DisplayNames. */
  all: string[];
  tasks: TranscriptionTask[];
  modes: string[];
  default_mode: string;
}

/**
 * Fetch this rather than hardcoding a list — it's generated from the
 * installed model, so a hardcoded copy silently drifts the moment the
 * model is upgraded. Cached an hour at the CDN, so calling it on every
 * page load is fine.
 */
export async function getTranscriptionLanguages(
  opts: RequestOptions = {}
): Promise<TranscriptionLanguages> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/speech-to-text/languages`,
    { method: "GET", signal: opts.signal },
    10_000
  );
  if (!res.ok) throw await toTranscriptionError(res);
  return readJson<TranscriptionLanguages>(res);
}

/** Resolves a bare ISO code from `all` to a display name. Falls back to
 *  the uppercased code where the runtime has no name for it. */
export function languageName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/* ------------------------------------------------------------------ */
/* Client-side validation                                              */
/* ------------------------------------------------------------------ */

/**
 * Reads duration from the browser without uploading anything. Resolves
 * null when the browser can't decode the container — in that case, let
 * the server decide rather than blocking a file that might be fine.
 */
export function readMediaDuration(file: File, kind: "audio" | "video"): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };

    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    // Some containers never fire either event. Don't hang the submit
    // button waiting on a check that's only an optimisation.
    setTimeout(() => done(null), 8_000);
    el.src = objectUrl;
  });
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Size and extension only — synchronous, so it can gate the button the
 * instant a file is chosen. Pair with readMediaDuration for the 20-minute
 * check, which needs a decode.
 */
export function validateTranscriptionFile(file: File, kind: "audio" | "video"): ValidationResult {
  const maxBytes = kind === "video" ? TRANSCRIPTION_LIMITS.videoBytes : TRANSCRIPTION_LIMITS.audioBytes;
  const allowed: readonly string[] =
    kind === "video" ? TRANSCRIPTION_VIDEO_EXTENSIONS : TRANSCRIPTION_AUDIO_EXTENSIONS;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(ext)) {
    return {
      ok: false,
      error: `That file type isn't supported. Try ${allowed.slice(0, 4).join(", ").toUpperCase()} or similar.`,
    };
  }

  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    const actualMb = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, error: `That file is ${actualMb} MB. The limit is ${maxMb} MB.` };
  }

  if (file.size === 0) {
    return { ok: false, error: "That file is empty." };
  }

  return { ok: true };
}

export function validateTranscriptionDuration(seconds: number | null): ValidationResult {
  if (seconds === null) return { ok: true };
  if (seconds > TRANSCRIPTION_LIMITS.durationSeconds) {
    const minutes = (seconds / 60).toFixed(1);
    return {
      ok: false,
      error: `That's ${minutes} minutes of audio. The limit is 20 minutes — trim it first and try again.`,
    };
  }
  return { ok: true };
}