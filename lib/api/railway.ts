// lib/api/railway.ts
//
// API client for every tool.

import { requestTurnstile } from "@/lib/security/turnstile";
import type {
  AnalyzeResponse,
  SeparateResponse,
  SeparateStatusResponse,
  StemType,
  SubmitBilling,
} from "@/lib/types/converter";

import type {
  InsufficientCreditsPayload,
  MeteredToolKey,
  RateLimitedPayload,
} from "@/lib/types/credits";

import { trimWavForAnalysis } from "@/lib/audio/wav-trim";

export const RAILWAY_API_BASE =
  process.env.NEXT_PUBLIC_RAILWAY_API_BASE || "https://api.audioforges.com";

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

// ApiError carries enough info for the UI to render the right recovery affordance.
// - isRateLimit  → 429, user must slow down (disable button briefly)
// - isServerBusy → 503, server/YT capacity issue, surface a "Try again" button
// - isTimeout    → client-side abort, or a Cloudflare 524
export class ApiError extends Error {
  status: number;
  isRateLimit: boolean;
  isServerBusy: boolean;
  isTimeout: boolean;
  retryAfterSeconds?: number;
  /** Stable machine-readable failure cause. Branch on this, never on message. */
  kind?: string;
  /** Backend's decision on whether a retry can succeed. */
  retryable?: boolean;
  /** 402 body's `detail`, preserved intact. Gate modal renders from this. */
  insufficientCredits?: InsufficientCreditsPayload;
  /** 429 body's `detail` on a METERED route only. Carries `tier`. */
  rateLimit?: RateLimitedPayload;
  /**
   * Which window actually fired on a 429, on BOTH shapes.
   *
   * Standard separation routes send a string and the four of them share one
   * allowance over two windows, so the status code alone cannot say whether
   * the caller hit 10/hour or 30/day. Match `limitMax` against the shared
   * allowance to find out.
   */
  limitMax?: number;
  limitWindowSeconds?: number;

  constructor(
    message: string,
    status: number,
    opts: {
      isRateLimit?: boolean;
      isServerBusy?: boolean;
      isTimeout?: boolean;
      retryAfterSeconds?: number;
      kind?: string;
      retryable?: boolean;
      insufficientCredits?: InsufficientCreditsPayload;
      rateLimit?: RateLimitedPayload;
      limitMax?: number;
      limitWindowSeconds?: number;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isRateLimit = !!opts.isRateLimit;
    this.isServerBusy = !!opts.isServerBusy;
    this.isTimeout = !!opts.isTimeout;
    this.retryAfterSeconds = opts.retryAfterSeconds;
    this.kind = opts.kind;
    this.retryable = opts.retryable;
    this.insufficientCredits = opts.insufficientCredits;
    this.rateLimit = opts.rateLimit;
    this.limitMax = opts.limitMax;
    this.limitWindowSeconds = opts.limitWindowSeconds;
  }
}

/**
 * Optional per-call options. Every function below takes this as a
 * TRAILING OPTIONAL argument, so no existing call site needs to change.
 *
 * Pass a signal to make a Cancel button actually abort the request
 * rather than just ignoring the response. Note that an aborted call
 * rejects with a raw DOMException (name "AbortError"), NOT an ApiError —
 * see fetchWithTimeout for why. Guard on it before your generic error
 * branch, or a deliberate Cancel will render as "Something went wrong".
 */
export interface RequestOptions {
  signal?: AbortSignal;
}

/** True when the caught error is a user/unmount cancellation rather than
 *  a real failure. Call sites should return early on this. */
export function isAbortError(err: unknown): boolean {
  return (err as Error)?.name === "AbortError";
}

// Extract the backend's user-facing message from a JSON error body.
// FastAPI convention: { "detail": "..." } or { "detail": [{ msg: "..." }] }
async function parseDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
  } catch {
    /* body was not JSON — a Cloudflare error page, an empty body, HTML */
  }
  return "";
}

/**
 * Pulls the numbers back out of a string 429.
 *
 * The backend builds the message from the window that fired
 * (rate_limit.py::_reject), so "(limit: 30 request(s) per 24 hours)" is the
 * ONLY structural signal for which cap of a shared allowance blocked the call.
 * Returns null on any message that doesn't match, which includes every 429
 * from a route that isn't rate_limit.py's.
 */
export function parseLimitMessage(
  message: string
): { maxRequests: number; windowSeconds: number } | null {
  const m = /\(limit:\s*(\d+)\s*request\(s\)\s*per\s*([^)]+)\)/i.exec(message);
  if (!m) return null;

  const maxRequests = Number(m[1]);
  if (!Number.isFinite(maxRequests) || maxRequests <= 0) return null;

  const phrase = m[2];
  let windowSeconds = 0;
  for (const [pattern, multiplier] of [
    [/(\d+)\s*hour/i, 3600],
    [/(\d+)\s*min/i, 60],
    [/(\d+)\s*sec/i, 1],
  ] as const) {
    const part = pattern.exec(phrase);
    if (part) windowSeconds += Number(part[1]) * multiplier;
  }
  if (windowSeconds <= 0) return null;

  return { maxRequests, windowSeconds };
}

function looksLikeRawError(text: string): boolean {
  if (!text) return true;
  if (text.length > 240) return true;
  return /traceback|exception|error at line|\bat\s+\w+\.<|stacktrace/i.test(text);
}

/**
 * Parses a success body. Every route below routes through this rather
 * than calling res.json() directly, because a 200 whose body ISN'T JSON
 * (Cloudflare interstitial, truncated response, proxy error page served
 * with the wrong status) throws a bare SyntaxError. That escapes the
 * ApiError contract entirely and surfaces to the user as something like
 * `Unexpected token '<'`.
 */
async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(
      "The server sent back a response we couldn't read. Please try again.",
      res.status,
      { isServerBusy: true }
    );
  }
}

/**
 * Exported for lib/api/transcription.ts. Everything about aborts,
 * timeouts and the Cloudflare ceiling is subtle enough that a second
 * copy would drift within a month — transcription imports this rather
 * than reimplementing it.
 */
export async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 120_000
): Promise<Response> {
  const external = init.signal;

  // Already cancelled before we even started — don't open a socket.
  if (external?.aborted) throw new DOMException("Aborted", "AbortError");

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  external?.addEventListener("abort", onExternalAbort, { once: true });

  // Distinguishes "we gave up waiting" from "the user pressed Cancel".
  // Both surface as AbortError, and they need opposite handling.
  let timedOut = false;
  let id = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    // Spread order matters: the internal signal MUST overwrite whatever
    // came in on init, or the timeout silently stops working.
    const res = await fetch(input, { ...init, signal: controller.signal });
    if (res.status !== 428) return res;
    // Turnstile: the backend wants a human check before a free GPU run.
    // Solve it in the sitewide modal, register the pass, and replay the
    // exact same request once. Bodies here are FormData or strings, so a
    // replay is safe.
    const body = await res.clone().json().catch(() => null);
    if (body?.detail?.error !== "turnstile_required") return res;
    // The human solves at human speed and the replay re-uploads the whole
    // body, so neither may run on the leftovers of the original clock.
    // Stop it while the modal is up, give the verify its own short window,
    // and give the replay a fresh full budget.
    clearTimeout(id);
    try {
      const token = await requestTurnstile();
      const verifyCtl = new AbortController();
      const onAbort = () => verifyCtl.abort();
      controller.signal.addEventListener("abort", onAbort, { once: true });
      const verifyId = setTimeout(() => verifyCtl.abort(), 15_000);
      try {
        const verify = await fetch(`${RAILWAY_API_BASE}/credits/turnstile/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
          signal: verifyCtl.signal,
        });
        if (!verify.ok) return res;
      } finally {
        clearTimeout(verifyId);
        controller.signal.removeEventListener("abort", onAbort);
      }
    } catch (e) {
      // Only a user Cancel propagates. A cancelled or unavailable modal
      // and a dead verify all fall through to the mapped 428 message.
      if ((e as Error)?.name === "AbortError" && controller.signal.aborted && !timedOut) throw e;
      return res;
    }
    id = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      // User cancellation: rethrow the raw AbortError. Wrapping it in an
      // ApiError would make the form render "taking longer than expected"
      // on a deliberate Cancel.
      if (!timedOut) throw err;
      throw new ApiError(
        "This is taking longer than expected. Please try again in a moment.",
        0,
        { isTimeout: true, isServerBusy: true }
      );
    }
    throw new ApiError(
      "We couldn't reach the server. Please check your connection and try again.",
      0
    );
  } finally {
    clearTimeout(id);
    external?.removeEventListener("abort", onExternalAbort);
  }
}

// Retry-After is legal as either delta-seconds or an HTTP-date. Only the
// numeric form was handled before, so a date-form header silently became
// undefined and the UI fell back to its own guess — which could be 10
// seconds against a header that meant 10 minutes.
//
// Exported alongside fetchWithTimeout for lib/api/transcription.ts.
export function readRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.ceil(n);

  const when = Date.parse(raw);
  if (!Number.isNaN(when)) {
    const seconds = Math.ceil((when - Date.now()) / 1000);
    if (seconds > 0) return seconds;
  }
  return undefined;
}

type ErrorContext = "analyze" | "separate" | "job";

async function toApiError(res: Response, context: ErrorContext): Promise<ApiError> {
  if (res.status === 402 || res.status === 429 || res.status === 400) {
    let detail: unknown;
    try {
      const body = await res.clone().json();
      detail = body?.detail;
    } catch {
      /* not JSON */
    }
    const obj =
      detail && typeof detail === "object" && !Array.isArray(detail)
        ? (detail as Record<string, unknown>)
        : null;
    if (obj) {
      const message = typeof obj.message === "string" ? obj.message : "";
      const kind =
        (typeof obj.kind === "string" && obj.kind) ||
        (typeof obj.error === "string" && obj.error) ||
        undefined;
      if (res.status === 402 && obj.error === "insufficient_credits") {
        return new ApiError(message || "You're out of credits for this tool.", 402, {
          kind: "insufficient_credits",
          insufficientCredits: obj as unknown as InsufficientCreditsPayload,
        });
      }
      if (res.status === 429 && kind === "rate_limited") {
        return new ApiError(
          message || "You're going a little fast — please wait a moment before trying again.",
          429,
          {
            isRateLimit: true,
            kind,
            retryAfterSeconds:
              (typeof obj.retry_after_seconds === "number" && obj.retry_after_seconds) ||
              readRetryAfter(res) ||
              60,
            rateLimit: obj as unknown as RateLimitedPayload,
            limitMax:
              typeof obj.max_requests === "number" ? obj.max_requests : undefined,
            limitWindowSeconds:
              typeof obj.window_seconds === "number" ? obj.window_seconds : undefined,
          }
        );
      }
      if (res.status === 400 && kind) {
        return new ApiError(message || "That file can't be processed at Studio Quality.", 400, {
          kind,
        });
      }
    }
  }

  // 409 from the idempotency layer: an identical submit is still in
  // flight. Not a failure — the caller waits and retries the same key,
  // at which point the original job's response replays.
  if (res.status === 409) {
    let kind: string | undefined;
    let message = "";
    try {
      const body = await res.clone().json();
      const obj = (body?.detail && typeof body.detail === "object" ? body.detail : body) as
        | Record<string, unknown>
        | null;
      if (obj) {
        if (typeof obj.kind === "string") kind = obj.kind;
        if (typeof obj.message === "string") message = obj.message;
      }
    } catch {
      /* not JSON */
    }
    if (kind === "duplicate_request") {
      return new ApiError(message || "This request is already running.", 409, { kind });
    }
  }

  const rawDetail = await parseDetail(res);

  // Raw exception strings never reach the error card; each case falls back
  // to its own written copy.
  const detail = looksLikeRawError(rawDetail) ? "" : rawDetail;
  const retryAfter = readRetryAfter(res);

  switch (res.status) {
    case 400:
      return new ApiError(
        detail || "That request wasn't valid. Please check your input and try again.",
        400
      );
    case 404:
      return new ApiError(
        detail || "That job wasn't found. It may have expired.",
        404
      );
    case 409:
      return new ApiError(
        detail || "Still processing — hang tight, this will be ready shortly.",
        409,
        { isServerBusy: true }
      );
    case 413:
      return new ApiError(detail || "That file is too large.", 413);
    case 428:
      // The Turnstile challenge did not complete: the modal was cancelled,
      // could not load, or the token verify failed. The pass may still have
      // registered server-side, so a plain retry is the right advice.
      return new ApiError(
        detail ||
          "This free run needs a quick human check. Please try again and complete the check when it appears.",
        428
      );
    case 429: {
      // Parsed from rawDetail, not `detail`: looksLikeRawError blanks the
      // latter, and a message it rejected still carries usable numbers.
      const parsed = parseLimitMessage(rawDetail);
      return new ApiError(
        detail || "You're going a little fast. Please wait a moment before trying again.",
        429,
        {
          isRateLimit: true,
          // ONE POLICY, THREE SOURCES, BEST FIRST: the header (exact time
          // remaining, and the backend always sends it), then the window the
          // message names, then — left undefined here — the caller's
          // getRetryAfterFallback, which guesses the SHORTEST window because a
          // guess should not lock the button for a day. Precision decides the
          // order; the shortest-window rule only applies where nothing is known.
          // Was `?? 10`, which on a daily cap re-enabled the button after ten
          // seconds straight into another 429.
          retryAfterSeconds: retryAfter ?? parsed?.windowSeconds,
          limitMax: parsed?.maxRequests,
          limitWindowSeconds: parsed?.windowSeconds,
        }
      );
    }
    case 503:
      return new ApiError(
        detail || "Our servers are busy right now. Please try again in a moment.",
        503,
        { isServerBusy: true, retryAfterSeconds: retryAfter }
      );
    case 500:
      return new ApiError(
        context === "analyze"
          ? "Something went wrong while analyzing your file. Please try again."
          : "Something went wrong. Please try again.",
        500
      );
    case 502:
    case 504:
      return new ApiError(
        "The server took too long to respond. Please try again shortly.",
        res.status,
        { isServerBusy: true }
      );

    // ---- Cloudflare-generated. The origin never sent these. ----
    case 524:
      // The edge gave up waiting. The VPS is very likely STILL working on
      // this job right now, holding a download slot until its own
      // wall-clock timeout reaps it.
      return new ApiError(
        "This one took too long to process. Shorter tracks are more reliable — try a single song rather than a full set.",
        524,
        { isTimeout: true, isServerBusy: true }
      );
    case 520:
    case 521:
    case 522:
    case 523:
    case 525:
    case 526:
      return new ApiError(
        "We couldn't reach the processing server. Please try again in a moment.",
        res.status,
        { isServerBusy: true }
      );

    default:
      return new ApiError(detail || "The request failed. Please try again.", res.status);
  }
}

// ============ FEATURE FLAGS ============
// Reads the backend's / root response for feature toggles (currently just
// HQ separation). Intended to be called SERVER-SIDE from a page.tsx Server
// Component with Next's fetch cache (see the `next.revalidate` option) —
// NOT from client components — so a disabled feature never touches the
// browser at all: no request, no flag, no trace in devtools.
//
// Fails CLOSED on any error (network failure, bad JSON, unexpected shape):
// hiding a working feature is a minor inconvenience, silently showing a
// broken one is not.
export interface FeatureFlags {
  separationHqEnabled: boolean;
  /**
   * Kill switch for the multi-track MIDI tool. FALSE means the route returns
   * 503, so the option must not be offered at all.
   *
   * DIFFERENT QUESTION from paywallTools["audio-to-midi-hq"], which answers
   * whether it costs a credit. Gating visibility on the paywall flag — which is
   * what this code did before this flag existed — meant turning off charging
   * made the tool vanish instead of becoming free, and the free-flow test
   * couldn't be run at all. Gate visibility here; gate the "1 credit" badge and
   * the 402 handling on paywallTools.
   */
  midiHqEnabled: boolean;
  /** Kill switch for /audio-to-sheet. FALSE = route returns 503, so the tool
   *  must not be offered. Same shape as midiHqEnabled: visibility, not price. */
  sheetMusicEnabled: boolean;
  paywallEnabled: boolean;
  paywallTools: Partial<Record<MeteredToolKey, boolean>>;
}

const FLAGS_OFF: FeatureFlags = {
  separationHqEnabled: false,
  midiHqEnabled: false,
  sheetMusicEnabled: false,
  paywallEnabled: false,
  paywallTools: {},
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const res = await fetch(`${RAILWAY_API_BASE}/`, {
      next: { revalidate: 86400 },
      // The only call in this file that doesn't go through
      // fetchWithTimeout, because it needs Next's data cache. Without a
      // deadline, a VPS that accepts the connection but never answers
      // blocks the whole server render — burning Vercel function
      // duration on a page that doesn't even use this flag.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return FLAGS_OFF;
    const data = await res.json();
    const tools = data?.features?.paywall_tools;
    return {
      separationHqEnabled: Boolean(data?.features?.separation_hq_enabled),
      midiHqEnabled: Boolean(data?.features?.midi_hq_enabled),
      sheetMusicEnabled: Boolean(data?.features?.sheet_music_enabled),
      paywallEnabled: Boolean(data?.features?.paywall_enabled),
      paywallTools:
        tools && typeof tools === "object"
          ? (Object.fromEntries(
              Object.entries(tools).map(([k, v]) => [k, Boolean(v)])
            ) as Partial<Record<MeteredToolKey, boolean>>)
          : {},
    };
  } catch {
    return FLAGS_OFF;
  }
}

// ============ KEY/BPM ANALYSIS (synchronous) ============

export async function analyzeAudioFile(
  file: File,
  opts: RequestOptions = {}
): Promise<AnalyzeResponse> {
  const upload = await trimWavForAnalysis(file);
  const fd = new FormData();
  fd.append("file", upload, file.name);
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/analyze`,
    { method: "POST", body: fd, signal: opts.signal },
    90_000
  );
  if (!res.ok) throw await toApiError(res, "analyze");
  return readJson<AnalyzeResponse>(res);
}

// ============ VOCAL REMOVER (SEPARATION) ============
// Covers /separate AND /separate-hq — both produce identical job shapes
// (job_type "separation", vocals_path/instrumental_path), so a single
// job_id from either tier works against every function below unchanged.
// The `quality` param on submit is the ONLY place the two tiers diverge.

export type SeparationQuality = "standard" | "hq";

export async function submitSeparation(
  file: File,
  quality: SeparationQuality = "standard",
  opts: RequestOptions = {},
  idempotencyKey?: string
): Promise<SeparateResponse> {
  const fd = new FormData();
  fd.append("file", file);

  const isMetered = quality === "hq";
  const endpoint = isMetered ? "separate-hq" : "separate";
  // credentials on BOTH tiers since the backend started resolving identity
  // on the standard routes too - without the cookie every free run mints a
  // fresh anonymous subject.
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
    {
      method: "POST",
      body: fd,
      signal: opts.signal,
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
      credentials: "include" as RequestCredentials,
    },
    30_000
  );

  if (!res.ok) throw await toApiError(res, "separate");
  return readJson<SeparateResponse>(res);
}

export async function getSeparationStatus(
  jobId: string,
  opts: RequestOptions = {}
): Promise<SeparateStatusResponse> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/separate/status/${jobId}`,
    { method: "GET", signal: opts.signal },
    15_000
  );

  if (!res.ok) throw await toApiError(res, "separate");
  return readJson<SeparateStatusResponse>(res);
}

export function getSeparationPreviewUrl(
  jobId: string,
  stem: StemType,
  endpoint: string = "separate"
): string {
  return `${RAILWAY_API_BASE}/${endpoint}/preview/${jobId}?stem=${stem}`;
}

export type StemDownloadFormat = "wav" | "mp3";

// MP3 is encoded on the server on first request (320 kbps). WAV is the default.
function withStemFormat(url: string, format: StemDownloadFormat = "wav"): string {
  return format === "mp3" ? `${url}&format=mp3` : url;
}

export function getSeparationDownloadUrl(
  jobId: string,
  stem: StemType,
  endpoint: string = "separate",
  format: StemDownloadFormat = "wav"
): string {
  return withStemFormat(`${RAILWAY_API_BASE}/${endpoint}/download/${jobId}?stem=${stem}`, format);
}

// ============ GENERIC JOB-BASED TOOLS ============
// Shared by every single-file-in/single-file-out tool: /convert, /trim,
// /volume, /pitch, /tempo, /reverse, /noise-remove, /voice-clean,
// /echo-remove, /silence-remove, /video-to-audio, /join, /loudnorm,
// /fade, /channels, /resample, /ringtone. They all follow the identical
// submit -> poll status -> preview/download shape, so no per-tool
// function exists for any of these — a form component just calls
// submitJob("video-to-audio", formData), submitJob("loudnorm", formData),
// etc. with whatever extra fields that tool needs already appended to
// the FormData it built. /join works the same way: its form component
// appends multiple "files" entries to one FormData and calls
// submitJob("join", formData) — no special multi-file function needed,
// since submitJob never inspects what's inside the FormData it's given.
//
// The transcription endpoints deliberately do NOT use these: they take
// options on submit and return extra fields on status and result. See
// lib/api/transcription.ts.

export type JobStatus = "processing" | "complete" | "failed";

export interface JobSubmitResponse {
  job_id: string;
  status: JobStatus;
  /** Metered routes only (separate-hq, stems-hq). See SubmitBilling. */
  billing?: SubmitBilling;
}

export interface JobStatusResult {
  job_id: string;
  status: JobStatus;
  title: string | null;
  error: string | null;
}

/**
 * `idempotencyKey` is what makes a retry safe.
 *
 * Every metered route reads the upload, probes the duration, charges,
 * then spawns. A client that times out anywhere in the first three steps
 * cannot know whether the charge landed, and a blind retry used to start
 * a SECOND job: second upload, second GPU run, second credit. The server
 * stores its response against this key, so a retry carrying the same one
 * replays the original job id instead of creating anything.
 *
 * Send the SAME key for every attempt at one logical submit, and a fresh
 * one when the user deliberately starts a new run.
 */
export async function submitJob(
  endpoint: string,
  formData: FormData,
  timeoutMs = 30_000,
  opts: RequestOptions = {},
  withCredentials = false,
  idempotencyKey?: string
): Promise<JobSubmitResponse> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
    {
      method: "POST",
      body: formData,
      signal: opts.signal,
      ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
      ...(withCredentials ? { credentials: "include" as RequestCredentials } : {}),
    },
    timeoutMs
  );
  if (!res.ok) throw await toApiError(res, "job");
  return readJson<JobSubmitResponse>(res);
}

/**
 * Stops a running job on the server.
 *
 * Cancelling used to be a client-only act: the form stopped polling and
 * the GPU carried on running and billing, with the credit still spent.
 * This reaches the backend, which cancels the RunPod job and refunds in
 * the same instant.
 *
 * Never throws for the caller's benefit — the run is being abandoned
 * either way, so a failed cancel must not block the UI from resetting.
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${RAILWAY_API_BASE}/jobs/${jobId}/cancel`,
      { method: "POST", credentials: "include" as RequestCredentials },
      10_000
    );
    if (!res.ok) return false;
    const body = await readJson<{ cancelled?: boolean }>(res);
    return body?.cancelled === true;
  } catch {
    return false;
  }
}

/**
 * `withCredentials` matters on a METERED route and only there.
 *
 * Separation polls /separate/status and /stems/status — the FREE namespaces,
 * shared by both tiers — so those never needed the cookie and worked fine.
 * /audio-to-midi-hq/status is the metered route's own namespace. If the server
 * scopes a job's status to the subject that created it, a poll without af_sid
 * is rejected, JobToolForm's catch treats a non-404 as transient, and it keeps
 * retrying until the 10-minute ceiling — reporting "taking unusually long" on a
 * job the server finished, or failed, in about a minute.
 */
export async function getJobStatus(
  endpoint: string,
  jobId: string,
  opts: RequestOptions = {},
  withCredentials = false
): Promise<JobStatusResult> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}/status/${jobId}`,
    {
      method: "GET",
      signal: opts.signal,
      ...(withCredentials ? { credentials: "include" as RequestCredentials } : {}),
    },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "job");
  return readJson<JobStatusResult>(res);
}

export function getJobPreviewUrl(endpoint: string, jobId: string): string {
  return `${RAILWAY_API_BASE}/${endpoint}/preview/${jobId}`;
}

export function getJobDownloadUrl(endpoint: string, jobId: string): string {
  return `${RAILWAY_API_BASE}/${endpoint}/download/${jobId}`;
}

// ============ MULTI-OUTPUT JOB-BASED TOOLS ============
// Shared by every tool whose output is a variable-length, NAMED set of
// files rather than one fixed file: /stems + /stems-hq (4+ stems),
// /silence-split (N segments). Each backend
// status route returns a different array key ("stems" vs "segments") and
// each preview/download route expects a different query param name
// ("stem" vs "segment") — getMultiOutputStatus() below reads WHICHEVER
// key the response actually contains rather than assuming one, and the
// query param name is passed in by the caller rather than hardcoded, so
// this one set of functions covers all three tools without guessing at
// a response shape that isn't there.

export interface MultiOutputStatusResult {
  job_id: string;
  status: JobStatus;
  title: string | null;
  error: string | null;
  /** Normalized from whichever array key the backend actually returned
   * ("stems" or "segments") — always just the list of available output
   * names, regardless of which tool produced them. */
  outputs: string[];
}

export async function getMultiOutputStatus(
  endpoint: string,
  jobId: string,
  opts: RequestOptions = {}
): Promise<MultiOutputStatusResult> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}/status/${jobId}`,
    { method: "GET", signal: opts.signal },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "job");

  const data = await readJson<{
    job_id: string;
    status: JobStatus;
    title?: string | null;
    error?: string | null;
    stems?: unknown;
    segments?: unknown;
  }>(res);

  const outputs: string[] = Array.isArray(data?.stems)
    ? (data.stems as string[])
    : Array.isArray(data?.segments)
    ? (data.segments as string[])
    : [];

  return {
    job_id: data?.job_id,
    status: data?.status,
    title: data?.title ?? null,
    error: data?.error ?? null,
    outputs,
  };
}

export function getMultiOutputPreviewUrl(
  endpoint: string,
  jobId: string,
  outputName: string,
  queryParam: "stem" | "segment" = "stem"
): string {
  return `${RAILWAY_API_BASE}/${endpoint}/preview/${jobId}?${queryParam}=${encodeURIComponent(outputName)}`;
}

export function getMultiOutputDownloadUrl(
  endpoint: string,
  jobId: string,
  outputName: string,
  queryParam: "stem" | "segment" = "stem"
): string {
  return `${RAILWAY_API_BASE}/${endpoint}/download/${jobId}?${queryParam}=${encodeURIComponent(outputName)}`;
}

// ---- Thin, named wrappers for readability at call sites ----
// Purely convenience over the generic functions above — every one of
// these is a one-line pass-through with the endpoint/query-param baked
// in, so a form component reads `submitStems(file, "hq")` rather than
// `submitJob("stems-hq", fd)` scattered inline.

export async function submitStems(
  file: File,
  quality: SeparationQuality = "standard",
  opts: RequestOptions = {},
  idempotencyKey?: string
): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const isMetered = quality === "hq";
  const endpoint = isMetered ? "stems-hq" : "stems";
  return submitJob(endpoint, fd, 30_000, opts, true, idempotencyKey);
}

export function getStemsStatus(
  jobId: string,
  opts: RequestOptions = {}
): Promise<MultiOutputStatusResult> {
  return getMultiOutputStatus("stems", jobId, opts);
}

export function getStemsPreviewUrl(jobId: string, stemName: string): string {
  return getMultiOutputPreviewUrl("stems", jobId, stemName, "stem");
}

export function getStemsDownloadUrl(
  jobId: string,
  stemName: string,
  format: StemDownloadFormat = "wav"
): string {
  return withStemFormat(getMultiOutputDownloadUrl("stems", jobId, stemName, "stem"), format);
}

// /silence-split submits via the generic submitJob("silence-split", fd)
// (its form component appends target_format/threshold_db/
// min_duration_seconds itself), but status/preview/download get named
// wrappers since "segment" as a query param is easy to typo inline.

export function getSilenceSplitStatus(
  jobId: string,
  opts: RequestOptions = {}
): Promise<MultiOutputStatusResult> {
  return getMultiOutputStatus("silence-split", jobId, opts);
}

export function getSilenceSplitPreviewUrl(jobId: string, segmentName: string): string {
  return getMultiOutputPreviewUrl("silence-split", jobId, segmentName, "segment");
}

export function getSilenceSplitDownloadUrl(jobId: string, segmentName: string): string {
  return getMultiOutputDownloadUrl("silence-split", jobId, segmentName, "segment");
}

// ============ AUDIO TO MIDI ============
// Single-output job, same submit -> poll -> download shape as every
// /convert-style tool, but with tool-specific tunable params instead of
// just a file. No preview wrapper — MIDI isn't browser-playable audio,
// so nothing in the UI calls /audio-to-midi/preview.

export interface AudioToMidiParams {
  onsetThreshold?: number;
  frameThreshold?: number;
  minimumNoteLength?: number;
  minimumFrequency?: number;
  maximumFrequency?: number;
}

export function submitAudioToMidi(
  file: File,
  params: AudioToMidiParams = {},
  opts: RequestOptions = {}
): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (params.onsetThreshold !== undefined) fd.append("onset_threshold", String(params.onsetThreshold));
  if (params.frameThreshold !== undefined) fd.append("frame_threshold", String(params.frameThreshold));
  if (params.minimumNoteLength !== undefined) fd.append("minimum_note_length", String(params.minimumNoteLength));
  if (params.minimumFrequency !== undefined) fd.append("minimum_frequency", String(params.minimumFrequency));
  if (params.maximumFrequency !== undefined) fd.append("maximum_frequency", String(params.maximumFrequency));
  return submitJob("audio-to-midi", fd, 60_000, opts);
}

export function getAudioToMidiStatus(
  jobId: string,
  opts: RequestOptions = {}
): Promise<JobStatusResult> {
  return getJobStatus("audio-to-midi", jobId, opts);
}

export function getAudioToMidiDownloadUrl(jobId: string): string {
  return getJobDownloadUrl("audio-to-midi", jobId);
}

// ============ AUDIO TO MIDI — HQ (metered) ============
//
// A SEPARATE TOOL, not a quality tier of /audio-to-midi. Different model
// (YourMT3 vs basic-pitch) and a different parameter set:
//
//   - onset_threshold / frame_threshold DO NOT EXIST here. YourMT3 is a
//     transformer that emits note events; there is no detector to tune. FastAPI
//     silently drops unknown form fields, so sending them fails quietly rather
//     than erroring — which is exactly how a UI ends up shipping four presets
//     that all make the same request.
//   - Pitch is MIDI NOTE NUMBERS, not Hz. Do not reuse the free tool's
//     midiToHz conversion. Valid range is the full 0–127, not 21–108 — YourMT3
//     emits bass and percussion outside a piano keyboard.
//   - minimum_note_length becomes min_note_ms. 10–2000 on both tools.
//
// Metered, so `withCredentials` is TRUE: without it `af_sid` never reaches
// api.audioforges.com cross-origin, every request arrives as a new anonymous
// subject, and no balance is ever seen or spent.

// JobToolForm builds and sends the request itself via submitJob(endpoint, ...)
// with `metered` true, so there is no submit/status/download wrapper here —
// one would be dead code. What it cannot do generically is read the result
// summary, which is below.
//
// The HQ parameter set, for whoever writes the form fields:
//   min_pitch / max_pitch  MIDI NOTE NUMBERS, not Hz. Do not reuse the free
//                          tool's midiToHz. Omit entirely for no filter —
//                          never send 0, which is a real note (C-1).
//   min_note_ms            10–2000. Replaces minimum_note_length.
//   onset_threshold /      DO NOT EXIST. YourMT3 is a transformer with no
//   frame_threshold        detector to tune, and FastAPI drops unknown form
//                          fields silently, so sending them fails quietly.

/** One detected instrument. `program` is a General MIDI program number. */
export interface MidiHqTrack {
  program: number;
  is_drum: boolean;
  /** GM instrument name, already resolved server-side. */
  name: string;
  notes: number;
  /** MIDI note numbers. */
  low: number;
  high: number;
}

export interface MidiHqResult {
  duration_seconds: number;
  track_count: number;
  note_count: number;
  input_seconds: number;
  /**
   * Notes removed by the user's own min_note_ms / pitch-range settings. Worth
   * surfacing when non-zero: it is the honest answer to "why is this sparse?",
   * and it points at a setting the user can change rather than at the model.
   */
  notes_dropped_by_filter: number;
  tracks: MidiHqTrack[];
}

/**
 * Call ONCE, after status reports complete. Same contract as
 * /speech-to-text/result: 404 once expired, 409 if the job isn't finished.
 *
 * This is the only proof the paid tier did something the free one can't — MIDI
 * isn't playable in a browser, so per-instrument track names are the entire
 * verifiable result.
 */
export async function getAudioToMidiHqResult(
  jobId: string,
  opts: RequestOptions = {}
): Promise<MidiHqResult> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/audio-to-midi-hq/result/${jobId}`,
    { method: "GET", credentials: "include", signal: opts.signal },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "job");
  return readJson<MidiHqResult>(res);
}

// ============ AUDIO TO SHEET MUSIC (/audio-to-sheet) ============
// The paid notation tool. Unlike MIDI, its output can actually be SHOWN —
// the SVG preview is the whole selling point — so alongside the counts this
// result also tells the UI which of the four formats (pdf/svg/musicxml/midi)
// are available to download. Same result contract as every other job tool:
// 404 once expired, 409 if not finished yet, call ONCE after status=complete.

export interface SheetTrack {
  program: number;
  is_drum: boolean;
  name: string;
  notes: number;
  low: number;
  high: number;
}

export interface SheetResult {
  /** "transkun" (piano specialist) or "yourmt3" (everything else). */
  engine: string;
  /** Whether a stem-isolation pass ran before transcription. */
  separated: boolean;
  instrument: string;
  n_notes: number;
  n_measures: number;
  /** 1 (single staff) or 2 (grand staff / piano hands). */
  n_staves: number;
  n_pages: number;
  /** Detected tempo fed into quantization (TempoCNN). */
  tempo_bpm: number;
  /** Detected key, e.g. "G major" — null if it couldn't be determined. */
  key: string | null;
  /** Which downloads are ready, e.g. ["pdf","svg","musicxml","midi"]. */
  formats: string[];
  /** Number of engraved SVG pages (mirrors n_pages). */
  svg_pages: number;
}

/**
 * Call ONCE, after status reports complete. Mirrors getAudioToMidiHqResult:
 * same fetchWithTimeout + credentials + error mapping.
 */
export async function getAudioToSheetResult(
  jobId: string,
  opts: RequestOptions = {}
): Promise<SheetResult> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/audio-to-sheet/result/${jobId}`,
    { method: "GET", credentials: "include", signal: opts.signal },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "job");
  return readJson<SheetResult>(res);
}

/** SVG score preview (first page), rendered inline — the quality-proof surface. */
export function getSheetPreviewUrl(jobId: string): string {
  return `${RAILWAY_API_BASE}/audio-to-sheet/preview/${jobId}`;
}

/**
 * Format-aware download. Our tool serves four formats off one endpoint via
 * ?format=, unlike the single-file getJobDownloadUrl — hence its own helper.
 */
export type SheetFormat = "pdf" | "svg" | "musicxml" | "midi";

export function getSheetDownloadUrl(jobId: string, format: SheetFormat): string {
  return `${RAILWAY_API_BASE}/audio-to-sheet/download/${jobId}?format=${format}`;
}