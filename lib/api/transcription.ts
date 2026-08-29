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
import type { InsufficientCreditsPayload } from "@/lib/types/credits";
import type { SubmitBilling } from "@/lib/types/converter";

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

/**
 * A job id from one endpoint polled against another returns 404, which
 * is indistinguishable from expiry. Storing this alongside the id is not
 * optional — it's the only thing that makes the id meaningful.
 */
export type TranscriptionEndpoint = "speech-to-text" | "youtube/transcribe" | "video-to-text";

/**
 * The model name, displayed on every transcription page and in the form
 * header.
 *
 * It lives here because naming the model IS the positioning — the pages
 * argue that a named model is checkable while an accuracy percentage
 * isn't, which only holds if the name is right. Five hand-written copies
 * meant one model upgrade away from a site that confidently names the
 * wrong one, which is worse than naming none.
 */
export const TRANSCRIPTION_MODEL = "Whisper large-v3";

/**
 * The model name, read from the backend instead of typed here.
 *
 * NOT self-correcting, and it's worth being precise about why. The language
 * list genuinely is read from the installed faster_whisper package, so it
 * cannot drift. The model name can't work the same way: with
 * TRANSCRIPTION_BACKEND=gpu the model actually running is whatever
 * WHISPER_MODEL_SIZE is set to on the RunPod endpoint, an environment the VPS
 * never reads — and the VPS's own copy is deliberately unset so nothing
 * multi-GB gets baked into an image for a fallback that never runs.
 *
 * So `model_name` is an OPERATOR-MAINTAINED LABEL (TRANSCRIPTION_MODEL_NAME in
 * the VPS env). The win is one place instead of seven, and an operator can
 * change it without a frontend deploy. Changing the model means editing the
 * RunPod endpoint and that one line — two edits in the same mental step.
 *
 * Fails closed to the constant above, so a backend blip renders today's name
 * rather than an empty span in the middle of a sentence.
 *
 * SERVER-SIDE ONLY. Never call this from a client component.
 */
export async function getTranscriptionModelName(): Promise<string> {
  try {
    const res = await fetch(`${RAILWAY_API_BASE}/speech-to-text/languages`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return TRANSCRIPTION_MODEL;
    const data = (await res.json()) as { model_name?: unknown };
    return typeof data.model_name === "string" && data.model_name
      ? data.model_name
      : TRANSCRIPTION_MODEL;
  } catch {
    return TRANSCRIPTION_MODEL;
  }
}

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
 *
 * NOTHING OUTSIDE THIS OBJECT SHOULD WRITE THESE NUMBERS AS TEXT. The
 * form, the drop zone, the page copy, the FAQ answers, the meta
 * descriptions and the error messages below all derive from here. The
 * whole positioning of these pages is "we state the real limit up
 * front", so a stale number isn't a cosmetic bug — it's the one claim
 * the pages rest on, broken.
 */
export const TRANSCRIPTION_LIMITS = {
  /** /speech-to-text */
  audioBytes: 80 * 1024 * 1024,
  /** /video-to-text — deliberately different from audioBytes. */
  videoBytes: 100 * 1024 * 1024,
  /**
   * Applies to the audio track on all three endpoints.
   *
   * 1200 = 20 minutes, matching features.transcription_max_duration_seconds.
   *
   * THIS NUMBER HAS NOW DRIFTED TWICE IN ONE DAY, in both directions, and the
   * two failures are not symmetrical:
   *
   *   - Frontend HIGHER than backend (said 20, cap was 10): pages advertise
   *     uploads the server refuses AFTER the whole file has transferred.
   *   - Frontend LOWER than backend (said 10, cap was 20): validateTranscription-
   *     Duration() below REJECTS valid files client-side. The upload never
   *     happens, the user is told the limit is 20 minutes lower than it is,
   *     and nothing appears in any log because the request was never made.
   *
   * The second is worse: it is silent. Whoever changes
   * MAX_TRANSCRIPTION_DURATION_SECONDS must change this line in the same
   * commit. lib/api/limits.ts holds the fetched value if this ever moves often
   * enough to be worth wiring through.
   */
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
   * The 20 here is a coincidence, not a reference to durationSeconds —
   * this is how long the CLIENT waits, that's how long the AUDIO may be.
   * Don't "tidy" one into the other.
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
  | "blocked"
  | "server_error"
  | "unknown";

/**
 * Reads the body ONCE and returns both shapes, because a 402's `detail` is an
 * OBJECT carrying the whole gate payload while every other status carries a
 * string. The body is a stream — reading it twice throws — so the object had
 * to come out of the same pass that produced the message.
 */
async function readDetail(res: Response): Promise<{ text: string; obj: Record<string, unknown> | null }> {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string") return { text: detail, obj: null };
    if (Array.isArray(detail) && detail[0]?.msg) return { text: detail[0].msg, obj: null };
    if (detail && typeof detail === "object") {
      const obj = detail as Record<string, unknown>;
      return { text: typeof obj.message === "string" ? obj.message : "", obj };
    }
  } catch {
    /* Cloudflare error page, empty body, HTML */
  }
  return { text: "", obj: null };
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
  const { text: detail, obj } = await readDetail(res);
  const retryAfter = readRetryAfter(res);

  /**
   * OUT OF CREDITS — a decision point, not a failure.
   *
   * This case did not exist. All three transcription routes have been metered
   * since the paywall change, and a 402 from any of them fell through to
   * `default` and rendered "The request failed. Please try again." with no
   * gate, no prices and no way forward. Because `free_remaining` is
   * min(owner_remaining, ip_remaining) and the IP counter survives a missing
   * cookie, the 402 arrives for real once the per-IP monthly allowance is
   * spent — so this was a hard dead end, reached by anyone who transcribes a
   * few files in a month.
   *
   * `insufficientCredits` is what useCreditGate branches on; without it
   * catchCreditError() can never return true and the modal is unreachable.
   */
  if (res.status === 402 && obj?.error === "insufficient_credits") {
    return new ApiError(detail || "You're out of credits for transcription.", 402, {
      kind: "insufficient_credits",
      retryable: false,
      insufficientCredits: obj as unknown as InsufficientCreditsPayload,
    });
  }

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

    case 403:
      // The WAF, not the app. When a route is missing from the Cloudflare
      // POST allowlist, the block response carries no CORS header, so the
      // browser can't read it and fetch rejects with a bare TypeError —
      // which surfaces to the user as "couldn't reach the server" and
      // sends whoever debugs it looking at the network instead of the
      // rule. This case only fires if the block ever comes back
      // readable, but when it does the message should say so.
      return build("This request was blocked before it reached the server.", "blocked", {
        retryable: false,
      });

    case 404:
      return build("This job has expired. Jobs are kept for one hour.", "expired", { retryable: false });

    case 409:
      // Not really an error — the result was requested before the job
      // finished. The caller polled wrong.
      return build("This transcript isn't ready yet.", "not_ready", { retryable: true });

    case 429:
      // Per IP, per endpoint. A user transcribing a few files WILL hit
      // this, so it deserves a countdown rather than a red toast. The
      // server's own detail string carries the real numbers and is
      // preferred — this fallback only shows if it sent none.
      return build("You've reached this tool's submission limit.", "rate_limited", {
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
/* Upload with progress                                                */
/* ------------------------------------------------------------------ */

/**
 * fetch() cannot report upload progress — there is no hook for bytes
 * sent, only for the response coming back. XMLHttpRequest can, via
 * upload.onprogress, so the two file-upload routes go through this
 * instead.
 *
 * That matters here more than on most forms: uploads run to 100MB, and
 * a slow connection spends a full minute sending before the server says
 * anything at all. Without a byte counter that minute is indistinguishable
 * from a hang, and people abandon.
 *
 * The XHR response is repackaged as a real Response so it can go
 * straight into toTranscriptionError() — no second error mapper, no
 * chance of the two drifting apart.
 */
function headersFromXhr(xhr: XMLHttpRequest): Headers {
  const headers = new Headers();
  for (const line of xhr.getAllResponseHeaders().trim().split(/[\r\n]+/)) {
    const separator = line.indexOf(": ");
    if (separator > 0) headers.append(line.slice(0, separator), line.slice(separator + 2));
  }
  return headers;
}

export type UploadProgressHandler = (sentBytes: number, totalBytes: number) => void;

function uploadWithProgress(
  url: string,
  body: FormData,
  opts: { signal?: AbortSignal; timeoutMs: number; onUploadProgress?: UploadProgressHandler }
): Promise<Response> {
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = opts.timeoutMs;
    /**
     * THE IDENTITY FIX. Without this, `af_sid` is neither sent nor stored on a
     * cross-origin request to api.audioforges.com — XHR drops cookies by
     * default exactly as fetch does. Every upload therefore arrived as a
     * brand-new anonymous subject, so no balance was ever visible and the
     * owner-side free counter reset on every request.
     *
     * The IP-side counter does NOT reset, and `free_remaining` is
     * min(owner_remaining, ip_remaining) — which is why the failure showed up
     * as a sudden unexplained 402 once the monthly per-IP allowance ran out,
     * rather than as a billing problem.
     *
     * Unconditional, unlike railway.ts's `isMetered` gate: there is no tier
     * toggle here, all three routes are metered under one rule, and an
     * identity that only forms sometimes is worse than one that always does.
     */
    xhr.withCredentials = true;

    const onAbort = () => xhr.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    const cleanup = () => opts.signal?.removeEventListener("abort", onAbort);

    if (opts.onUploadProgress) {
      xhr.upload.onprogress = (event) => {
        // Not computable for a stream of unknown length. Reporting a
        // fabricated total would be worse than reporting nothing.
        if (event.lengthComputable) opts.onUploadProgress?.(event.loaded, event.total);
      };
    }

    xhr.onload = () => {
      cleanup();
      // The Response constructor rejects anything under 200, and status
      // 0 here would mean the request never really completed.
      if (xhr.status < 200) {
        reject(new ApiError("The request didn't complete. Please try again.", 0));
        return;
      }
      resolve(new Response(xhr.responseText, { status: xhr.status, headers: headersFromXhr(xhr) }));
    };

    xhr.onerror = () => {
      cleanup();
      reject(
        new ApiError("We couldn't reach the server. Please check your connection and try again.", 0)
      );
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(
        new ApiError("This is taking longer than expected. Please try again in a moment.", 0, {
          isTimeout: true,
          isServerBusy: true,
        })
      );
    };

    // Matches fetchWithTimeout: a user cancellation rejects with the raw
    // AbortError so call sites can tell it apart from a real failure.
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    xhr.send(body);
  });
}

/* ------------------------------------------------------------------ */
/* Submit                                                              */
/* ------------------------------------------------------------------ */

export interface UploadOptions extends RequestOptions {
  /** Called as bytes leave the browser. Only fires for the two file
   *  routes — /youtube/transcribe sends a URL, so there is nothing to
   *  report. Silently absent when the browser can't compute a total. */
  onUploadProgress?: UploadProgressHandler;
}

export interface TranscriptionSubmitResponse {
  job_id: string;
  status: "processing";
  /**
   * Present on all three routes now that they are metered. Was missing from
   * this type, so the block the server sends was silently dropped: no receipt,
   * no balance update, no navbar refresh after a run.
   *
   * `charged` is the string "none" when the tool's rule is off — never JSON
   * null. See SubmitBilling.
   */
  billing?: SubmitBilling;
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
  opts: UploadOptions = {}
): Promise<TranscriptionSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  appendOptions(fd, options);

  const res = await uploadWithProgress(`${RAILWAY_API_BASE}/speech-to-text`, fd, {
    signal: opts.signal,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    onUploadProgress: opts.onUploadProgress,
  });
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
    // credentials: see the note on xhr.withCredentials above. This route is
    // metered under the same "transcribe" rule as the two upload routes.
    { method: "POST", body: fd, credentials: "include", signal: opts.signal },
    URL_SUBMIT_TIMEOUT_MS
  );
  if (!res.ok) throw await toTranscriptionError(res);
  return readJson<TranscriptionSubmitResponse>(res);
}

export async function submitVideoToText(
  file: File,
  options: TranscriptionOptions = {},
  opts: UploadOptions = {}
): Promise<TranscriptionSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  appendOptions(fd, options);

  const res = await uploadWithProgress(`${RAILWAY_API_BASE}/video-to-text`, fd, {
    signal: opts.signal,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    onUploadProgress: opts.onUploadProgress,
  });
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
  /** ~100 ISO-639-1 codes, no names. Resolve names with Intl.DisplayNames
   *  and show them in the same list — see SearchableSelect. */
  all: string[];
  tasks: TranscriptionTask[];
  modes: string[];
  default_mode: string;
  /** Operator-maintained label — see getTranscriptionModelName(). */
  model_name?: string;
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
 * instant a file is chosen. Pair with readMediaDuration for the duration
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
    // Derived, not written. This message used to say "20 minutes" as a
    // literal — inside the function that enforces the limit. Tightening
    // durationSeconds to 10 would have made it reject at 10 while
    // telling the user the limit was 20, which is the single worst place
    // on the site for a stale number: it's the exact moment someone
    // learns what the limit is.
    const maxMinutes = TRANSCRIPTION_LIMITS.durationSeconds / 60;
    return {
      ok: false,
      error: `That's ${minutes} minutes of audio. The limit is ${maxMinutes} minutes — trim it first and try again.`,
    };
  }

  return { ok: true };
}