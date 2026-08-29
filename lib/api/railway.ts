// lib/api/railway.ts
//
// API client for every tool EXCEPT transcription. The three transcription
// endpoints (/speech-to-text, /youtube/transcribe, /video-to-text) live in
// lib/api/transcription.ts — they take options on submit, return a richer
// status and result shape, and need their own error mapper, none of which
// fits the shared job helpers below. They still reuse fetchWithTimeout and
// readRetryAfter from here, which is why those two are exported.

import type {
  DownloadResponse,
  AnalyzeResponse,
  OutputFormat,
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

export const RAILWAY_API_BASE =
  process.env.NEXT_PUBLIC_RAILWAY_API_BASE || "https://api.audioforges.com";

/* ------------------------------------------------------------------ */
/* Timeout budget                                                      */
/* ------------------------------------------------------------------ */

// Cloudflare's proxy gives the origin 100 seconds to send response
// HEADERS before it gives up and returns a 524 of its own. Since the
// origin firewall only accepts Cloudflare IP ranges, every request in
// this file passes through that ceiling — there is no path around it.
//
// Any client timeout above 100s is therefore unreachable: Cloudflare
// always fires first, and we get a 524 with an HTML body instead of our
// own controlled "this is taking too long" ApiError. So the longest
// synchronous request we allow sits just under the ceiling, and WE
// decide what the user sees.
//
// Raise this ONLY if the zone's proxy read timeout is actually raised
// (Enterprise-only) or the route stops being proxied.
const CF_PROXY_CEILING_MS = 100_000;
const LONG_SYNC_TIMEOUT_MS = CF_PROXY_CEILING_MS - 5_000;

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
  const id = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    // Spread order matters: the internal signal MUST overwrite whatever
    // came in on init, or the timeout silently stops working.
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

// "youtube-job" is its own context (rather than reusing "download" or
// "job") because these routes genuinely blend both failure surfaces: a
// 400/404/503 here can mean either "bad/unavailable video" (same as
// /download) or "processing failed" (same as any job endpoint). The
// wording below leans toward the video-fetch side since that's the step
// most likely to produce these specific codes, while still being
// accurate if the failure was actually on the processing side.
type ErrorContext = "download" | "analyze" | "separate" | "job" | "youtube-job";

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

  const rawDetail = await parseDetail(res);

  // Gate EVERY branch, not just the default one. Previously 400/404/413/
  // 429/503 passed `detail` straight through, so a yt-dlp exception
  // string that reached a FastAPI detail rendered verbatim in the error
  // card. Blanking it here means each case falls back to its own written
  // copy, which is always safe.
  const detail = looksLikeRawError(rawDetail) ? "" : rawDetail;
  const retryAfter = readRetryAfter(res);

  const isVideoContext = context === "download" || context === "youtube-job";

  switch (res.status) {
    case 400:
      return new ApiError(
        detail ||
          (isVideoContext
            ? "That link doesn't look right, or the video is too long. Please check it and try again."
            : "That request wasn't valid. Please check your input and try again."),
        400
      );
    case 404:
      return new ApiError(
        detail ||
          (isVideoContext
            ? "That video isn't available — it may be deleted, private, or copyright-blocked."
            : "That job wasn't found — it may have expired."),
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
    case 429:
      return new ApiError(
        detail || "You're going a little fast — please wait a moment before trying again.",
        429,
        { isRateLimit: true, retryAfterSeconds: retryAfter ?? 10 }
      );
    case 451:
      return new ApiError("This video isn't available from our server's region.", 451);
    case 503:
      return new ApiError(
        detail ||
          (isVideoContext
            ? "YouTube is temporarily blocking our server, or the server is busy. Please try again in a few minutes."
            : "Our servers are busy right now. Please try again in a moment."),
        503,
        { isServerBusy: true, retryAfterSeconds: retryAfter }
      );
    case 500:
      return new ApiError(
        context === "download"
          ? "Something went wrong while preparing your download. Please try again."
          : context === "analyze"
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
    // Without these cases they land in `default` and render as "The
    // request failed" — the least useful message we have, on the failure
    // mode most likely to hit long videos.
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
  paywallEnabled: boolean;
  paywallTools: Partial<Record<MeteredToolKey, boolean>>;
}

const FLAGS_OFF: FeatureFlags = {
  separationHqEnabled: false,
  paywallEnabled: false,
  paywallTools: {},
};

export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const res = await fetch(`${RAILWAY_API_BASE}/`, {
      next: { revalidate: 60 },
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

// ============ YOUTUBE DOWNLOAD (synchronous) ============

export async function downloadYouTubeAudio(
  url: string,
  format: OutputFormat,
  opts: RequestOptions = {}
): Promise<DownloadResponse> {
  const body = new URLSearchParams();
  body.set("url", url);
  body.set("format", format);

  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/download`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: opts.signal,
    },
    LONG_SYNC_TIMEOUT_MS
  );

  if (!res.ok) throw await toApiError(res, "download");
  return readJson<DownloadResponse>(res);
}

export function extractBase64Audio(payload: DownloadResponse): string | null {
  return payload.audio_base64 || payload.audio || payload.base64 || payload.data || null;
}

// ============ KEY/BPM ANALYSIS (synchronous) ============

export async function analyzeAudioFile(
  file: File,
  opts: RequestOptions = {}
): Promise<AnalyzeResponse> {
  const fd = new FormData();
  fd.append("file", file);
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
  opts: RequestOptions = {}
): Promise<SeparateResponse> {
  const fd = new FormData();
  fd.append("file", file);

  const isMetered = quality === "hq";
  const endpoint = isMetered ? "separate-hq" : "separate";
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
    {
      method: "POST",
      body: fd,
      signal: opts.signal,
      ...(isMetered ? { credentials: "include" as RequestCredentials } : {}),
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

// `endpoint` defaults to "separate" so every EXISTING call site
// (getSeparationPreviewUrl(jobId, stem)) keeps working unchanged. Passing
// "youtube/separate" lets the /youtube/separate chained tool reuse this
// exact function instead of a near-duplicate.
export function getSeparationPreviewUrl(
  jobId: string,
  stem: StemType,
  endpoint: string = "separate"
): string {
  return `${RAILWAY_API_BASE}/${endpoint}/preview/${jobId}?stem=${stem}`;
}

export function getSeparationDownloadUrl(
  jobId: string,
  stem: StemType,
  endpoint: string = "separate"
): string {
  return `${RAILWAY_API_BASE}/${endpoint}/download/${jobId}?stem=${stem}`;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  let clean = base64.includes(",") ? base64.split(",")[1] : base64;
  clean = clean.replace(/\s+/g, "");
  const pad = clean.length % 4;
  if (pad === 2) clean += "==";
  else if (pad === 3) clean += "=";
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
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
  /** Metered routes only (stems-hq, youtube/*-hq). See SubmitBilling. */
  billing?: SubmitBilling;
}

export interface JobStatusResult {
  job_id: string;
  status: JobStatus;
  title: string | null;
  error: string | null;
}

export async function submitJob(
  endpoint: string,
  formData: FormData,
  timeoutMs = 30_000,
  opts: RequestOptions = {},
  withCredentials = false
): Promise<JobSubmitResponse> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
    {
      method: "POST",
      body: formData,
      signal: opts.signal,
      ...(withCredentials ? { credentials: "include" as RequestCredentials } : {}),
    },
    timeoutMs
  );
  if (!res.ok) throw await toApiError(res, "job");
  return readJson<JobSubmitResponse>(res);
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
// /silence-split (N segments), /youtube/stems (4+ stems). Each backend
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
  opts: RequestOptions = {}
): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const isMetered = quality === "hq";
  const endpoint = isMetered ? "stems-hq" : "stems";
  return submitJob(endpoint, fd, 30_000, opts, isMetered);
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

export function getStemsDownloadUrl(jobId: string, stemName: string): string {
  return getMultiOutputDownloadUrl("stems", jobId, stemName, "stem");
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

// ============ YOUTUBE CHAINED TOOLS ============
// /youtube/analyze, /youtube/separate, /youtube/stems — paste a URL,
// skip the manual download-then-reupload step. All three are async job
// flows like every tool above, but submitted with a URL (as
// x-www-form-urlencoded, matching FastAPI's Form(...) parameter) instead
// of a file upload.
//
// /youtube/transcribe is NOT one of these despite the name: it takes
// multipart/form-data, not urlencoded. It lives in transcription.ts.

export async function submitUrlJob(
  endpoint: string,
  url: string,
  timeoutMs = 30_000,
  opts: RequestOptions = {},
  withCredentials = false
): Promise<JobSubmitResponse> {
  const body = new URLSearchParams();
  body.set("url", url);

  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: opts.signal,
      ...(withCredentials ? { credentials: "include" as RequestCredentials } : {}),
    },
    timeoutMs
  );
  if (!res.ok) throw await toApiError(res, "youtube-job");
  return readJson<JobSubmitResponse>(res);
}

// ---- /youtube/analyze ----
// Result shape is identical to the synchronous /analyze route
// (AnalyzeResponse) — same result-card component can render either.

export function submitYoutubeAnalyze(
  url: string,
  opts: RequestOptions = {}
): Promise<JobSubmitResponse> {
  return submitUrlJob("youtube/analyze", url, 30_000, opts);
}

export function getYoutubeAnalyzeStatus(
  jobId: string,
  opts: RequestOptions = {}
): Promise<JobStatusResult> {
  return getJobStatus("youtube/analyze", jobId, opts);
}

export async function getYoutubeAnalyzeResult(
  jobId: string,
  opts: RequestOptions = {}
): Promise<AnalyzeResponse> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/youtube/analyze/result/${jobId}`,
    { method: "GET", signal: opts.signal },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "youtube-job");
  return readJson<AnalyzeResponse>(res);
}

// ---- /youtube/separate ----
// Same vocals/instrumental job shape as /separate — reuses
// getSeparationPreviewUrl/DownloadUrl via the `endpoint` param rather
// than duplicating them.

export function submitYoutubeSeparate(
  url: string,
  quality: SeparationQuality = "standard",
  opts: RequestOptions = {}
): Promise<JobSubmitResponse> {
  const isMetered = quality === "hq";
  return submitUrlJob(
    isMetered ? "youtube/separate-hq" : "youtube/separate",
    url,
    30_000,
    opts,
    isMetered
  );
}

export function getYoutubeSeparateStatus(
  jobId: string,
  opts: RequestOptions = {}
): Promise<JobStatusResult> {
  return getJobStatus("youtube/separate", jobId, opts);
}

export function getYoutubeSeparatePreviewUrl(jobId: string, stem: StemType): string {
  return getSeparationPreviewUrl(jobId, stem, "youtube/separate");
}

export function getYoutubeSeparateDownloadUrl(jobId: string, stem: StemType): string {
  return getSeparationDownloadUrl(jobId, stem, "youtube/separate");
}

// ---- /youtube/stems ----
// Same multi-output shape as /stems — reuses the generic multi-output
// functions via the `endpoint` param.

export function submitYoutubeStems(
  url: string,
  quality: SeparationQuality = "standard",
  opts: RequestOptions = {}
): Promise<JobSubmitResponse> {
  const isMetered = quality === "hq";
  return submitUrlJob(
    isMetered ? "youtube/stems-hq" : "youtube/stems",
    url,
    30_000,
    opts,
    isMetered
  );
}

export function getYoutubeStemsStatus(
  jobId: string,
  opts: RequestOptions = {}
): Promise<MultiOutputStatusResult> {
  return getMultiOutputStatus("youtube/stems", jobId, opts);
}

export function getYoutubeStemsPreviewUrl(jobId: string, stemName: string): string {
  return getMultiOutputPreviewUrl("youtube/stems", jobId, stemName, "stem");
}

export function getYoutubeStemsDownloadUrl(jobId: string, stemName: string): string {
  return getMultiOutputDownloadUrl("youtube/stems", jobId, stemName, "stem");
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

// ============ TIKTOK TO MP3 (synchronous) ============
// Unlike every other endpoint here, this one returns a structured error
// object — { message, kind, retryable } — rather than a plain string
// detail. toApiError() would flatten that to a message and lose the two
// fields the UI actually needs, so this route gets its own error mapper.
//
// The rule from the API spec: the backend decides what's retryable and
// what the user is told. The frontend branches on `kind` and shows
// `message` verbatim. It does NOT keep its own list of statuses, its own
// copy, or its own opinion about retrying.

export interface TikTokToMp3Response {
  title: string;
  /** Base64 MP3. ~1.1 MB for a 52-second clip. */
  audio: string;
  format: string;
  /** NULL on a cache hit — the cache stores audio and title only. */
  duration: number | null;
  id: string | null;
}

async function toTikTokError(res: Response): Promise<ApiError> {
  // Cloudflare's own 5xx bodies are HTML, never the structured detail
  // object this route otherwise returns — so hand them to the shared
  // mapper, which has real copy for each of them.
  if (res.status >= 520 && res.status <= 526) {
    return toApiError(res, "download");
  }

  let detail: unknown = null;
  try {
    detail = (await res.json())?.detail;
  } catch {
    /* not JSON — a Cloudflare block page or similar */
  }

  // The 429 comes from shared middleware and is a plain string, not the
  // object shape. Both have to be handled.
  if (typeof detail === "string") {
    return new ApiError(detail, res.status, {
      isRateLimit: res.status === 429,
      isServerBusy: res.status === 503,
      retryAfterSeconds: readRetryAfter(res),
      kind: res.status === 429 ? "rate_limited" : "unknown",
      retryable: false,
    });
  }

  const obj = detail as { message?: string; kind?: string; retryable?: boolean } | null;

  return new ApiError(
    obj?.message || "Something went wrong. Please try again.",
    res.status,
    {
      kind: obj?.kind ?? "unknown",
      // Defaults to false: showing a retry button on a permanent failure
      // (photo post, deleted video) is worse than omitting one on a
      // transient failure.
      retryable: obj?.retryable ?? false,
      isRateLimit: res.status === 429,
      isServerBusy: res.status === 503,
      retryAfterSeconds: readRetryAfter(res),
    }
  );
}

export async function convertTikTokToMp3(
  url: string,
  opts: RequestOptions = {}
): Promise<TikTokToMp3Response> {
  const body = new URLSearchParams();
  body.set("url", url.trim());

  // No explicit Content-Type: the browser sets the correct header for a
  // URLSearchParams body, and the endpoint rejects application/json.
  //
  // This used to be 190s, reasoning from the backend's own 180s
  // wall-clock timeout. But the request never survives that long: the
  // Cloudflare proxy in front of the origin cuts it at 100s with a 524,
  // so the 190s deadline was unreachable and every slow conversion
  // produced an unmapped edge error instead of our timeout copy.
  //
  // Sitting just under the ceiling means WE time out first, with a
  // message we wrote. Jobs that genuinely need more than ~95s can't be
  // served synchronously at all and belong on the job-queue pattern that
  // every other tool already uses.
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/tiktok-to-mp3`,
    { method: "POST", body, signal: opts.signal },
    LONG_SYNC_TIMEOUT_MS
  );

  if (!res.ok) throw await toTikTokError(res);
  return readJson<TikTokToMp3Response>(res);
}