// lib/api/railway.ts
import type {
  DownloadResponse,
  AnalyzeResponse,
  OutputFormat,
  SeparateResponse,
  SeparateStatusResponse,
  StemType,
} from "@/lib/types/converter";

export const RAILWAY_API_BASE =
  process.env.NEXT_PUBLIC_RAILWAY_API_BASE || "https://api.audioforges.com";

// ApiError carries enough info for the UI to render the right recovery affordance.
// - isRateLimit  → 429, user must slow down (disable button briefly)
// - isServerBusy → 503, server/YT capacity issue, surface a "Try again" button
// - isTimeout    → client-side abort
export class ApiError extends Error {
  status: number;
  isRateLimit: boolean;
  isServerBusy: boolean;
  isTimeout: boolean;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    opts: {
      isRateLimit?: boolean;
      isServerBusy?: boolean;
      isTimeout?: boolean;
      retryAfterSeconds?: number;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.isRateLimit = !!opts.isRateLimit;
    this.isServerBusy = !!opts.isServerBusy;
    this.isTimeout = !!opts.isTimeout;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
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
    /* body was not JSON */
  }
  return "";
}

function looksLikeRawError(text: string): boolean {
  if (!text) return true;
  if (text.length > 240) return true;
  return /traceback|exception|error at line|\bat\s+\w+\.<|stacktrace/i.test(text);
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit = {},
  timeoutMs = 120_000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
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
  }
}

function readRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function toApiError(
  res: Response,
  context: "download" | "analyze" | "separate" | "job"
): Promise<ApiError> {
  const detail = await parseDetail(res);
  const retryAfter = readRetryAfter(res);

  switch (res.status) {
    case 400:
      return new ApiError(
        detail ||
          (context === "download"
            ? "That link doesn't look right, or the video is too long. Please check it and try again."
            : "That request wasn't valid. Please check your input and try again."),
        400
      );
    case 404:
      return new ApiError(
        context === "download"
          ? "That video isn't available — it may be deleted, private, or copyright-blocked."
          : "That job wasn't found — it may have expired.",
        404
      );
    case 409:
      return new ApiError(
        "Still processing — hang tight, this will be ready shortly.",
        409,
        { isServerBusy: true }
      );
    case 413:
      return new ApiError(detail || "That file is too large. The maximum size is 50MB.", 413);
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
          (context === "download"
            ? "YouTube is temporarily blocking our server. Please try again in a few minutes."
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
    default: {
      if (detail && !looksLikeRawError(detail)) {
        return new ApiError(detail, res.status);
      }
      return new ApiError("The request failed. Please try again.", res.status);
    }
  }
}

export async function downloadYouTubeAudio(
  url: string,
  format: OutputFormat
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
    },
    120_000
  );

  if (!res.ok) throw await toApiError(res, "download");
  return (await res.json()) as DownloadResponse;
}

export function extractBase64Audio(payload: DownloadResponse): string | null {
  return payload.audio_base64 || payload.audio || payload.base64 || payload.data || null;
}

export async function analyzeAudioFile(file: File): Promise<AnalyzeResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/analyze`,
    { method: "POST", body: fd },
    90_000
  );
  if (!res.ok) throw await toApiError(res, "analyze");
  return (await res.json()) as AnalyzeResponse;
}

// ============ VOCAL REMOVER (SEPARATION) ============

export async function submitSeparation(file: File): Promise<SeparateResponse> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/separate`,
    { method: "POST", body: fd },
    30_000
  );

  if (!res.ok) throw await toApiError(res, "separate");
  return (await res.json()) as SeparateResponse;
}

export async function getSeparationStatus(jobId: string): Promise<SeparateStatusResponse> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/separate/status/${jobId}`,
    { method: "GET" },
    15_000
  );

  if (!res.ok) throw await toApiError(res, "separate");
  return (await res.json()) as SeparateStatusResponse;
}

export function getSeparationPreviewUrl(jobId: string, stem: StemType): string {
  return `${RAILWAY_API_BASE}/separate/preview/${jobId}?stem=${stem}`;
}

export function getSeparationDownloadUrl(jobId: string, stem: StemType): string {
  return `${RAILWAY_API_BASE}/separate/download/${jobId}?stem=${stem}`;
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
// Shared by /convert, /trim, /volume, /pitch, /tempo, /reverse, /noise-remove,
// /voice-clean, /echo-remove, /silence-remove — they all follow the identical
// submit -> poll status -> preview/download shape. One generic client instead
// of ten near-duplicate ones.

export type JobStatus = "processing" | "complete" | "failed";

export interface JobSubmitResponse {
  job_id: string;
  status: JobStatus;
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
  timeoutMs = 30_000
): Promise<JobSubmitResponse> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
    { method: "POST", body: formData },
    timeoutMs
  );
  if (!res.ok) throw await toApiError(res, "job");
  return (await res.json()) as JobSubmitResponse;
}

export async function getJobStatus(endpoint: string, jobId: string): Promise<JobStatusResult> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}/status/${jobId}`,
    { method: "GET" },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "job");
  return (await res.json()) as JobStatusResult;
}

export function getJobPreviewUrl(endpoint: string, jobId: string): string {
  return `${RAILWAY_API_BASE}/${endpoint}/preview/${jobId}`;
}

export function getJobDownloadUrl(endpoint: string, jobId: string): string {
  return `${RAILWAY_API_BASE}/${endpoint}/download/${jobId}`;
}

// ============ SPEECH TO TEXT ============
// Uses the same submitJob/getJobStatus as every other tool (identical job shape),
// but has no /preview or /download route — output is a transcript, not audio.
// Only this one extra function is needed for its unique /result endpoint.

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  language: string;
  language_probability: number;
  segments: TranscriptSegment[];
}

export async function getTranscriptResult(jobId: string): Promise<TranscriptResult> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/speech-to-text/result/${jobId}`,
    { method: "GET" },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "job");
  return (await res.json()) as TranscriptResult;
}