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

// "youtube-job" is its own context (rather than reusing "download" or
// "job") because these routes genuinely blend both failure surfaces: a
// 400/404/503 here can mean either "bad/unavailable video" (same as
// /download) or "processing failed" (same as any job endpoint). The
// wording below leans toward the video-fetch side since that's the step
// most likely to produce these specific codes, while still being
// accurate if the failure was actually on the processing side.
type ErrorContext = "download" | "analyze" | "separate" | "job" | "youtube-job";

async function toApiError(res: Response, context: ErrorContext): Promise<ApiError> {
  const detail = await parseDetail(res);
  const retryAfter = readRetryAfter(res);

  switch (res.status) {
    case 400:
      return new ApiError(
        detail ||
          (context === "download" || context === "youtube-job"
            ? "That link doesn't look right, or the video is too long. Please check it and try again."
            : "That request wasn't valid. Please check your input and try again."),
        400
      );
    case 404:
      return new ApiError(
        detail ||
          (context === "download" || context === "youtube-job"
            ? "That video isn't available — it may be deleted, private, or copyright-blocked."
            : "That job wasn't found — it may have expired."),
        404
      );
    case 409:
      return new ApiError(
        "Still processing — hang tight, this will be ready shortly.",
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
          (context === "download" || context === "youtube-job"
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
    default: {
      if (detail && !looksLikeRawError(detail)) {
        return new ApiError(detail, res.status);
      }
      return new ApiError("The request failed. Please try again.", res.status);
    }
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
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const res = await fetch(`${RAILWAY_API_BASE}/`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { separationHqEnabled: false };
    const data = await res.json();
    return {
      separationHqEnabled: Boolean(data?.features?.separation_hq_enabled),
    };
  } catch {
    return { separationHqEnabled: false };
  }
}

// ============ YOUTUBE DOWNLOAD (synchronous) ============

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

// ============ KEY/BPM ANALYSIS (synchronous) ============

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
// Covers /separate AND /separate-hq — both produce identical job shapes
// (job_type "separation", vocals_path/instrumental_path), so a single
// job_id from either tier works against every function below unchanged.
// The `quality` param on submit is the ONLY place the two tiers diverge.

export type SeparationQuality = "standard" | "hq";

export async function submitSeparation(
  file: File,
  quality: SeparationQuality = "standard"
): Promise<SeparateResponse> {
  const fd = new FormData();
  fd.append("file", file);

  const endpoint = quality === "hq" ? "separate-hq" : "separate";
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
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
  jobId: string
): Promise<MultiOutputStatusResult> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}/status/${jobId}`,
    { method: "GET" },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "job");
  const data = await res.json();

  const outputs: string[] = Array.isArray(data?.stems)
    ? data.stems
    : Array.isArray(data?.segments)
    ? data.segments
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
  quality: SeparationQuality = "standard"
): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const endpoint = quality === "hq" ? "stems-hq" : "stems";
  return submitJob(endpoint, fd, 30_000);
}

export function getStemsStatus(jobId: string): Promise<MultiOutputStatusResult> {
  return getMultiOutputStatus("stems", jobId);
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

export function getSilenceSplitStatus(jobId: string): Promise<MultiOutputStatusResult> {
  return getMultiOutputStatus("silence-split", jobId);
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

export async function submitUrlJob(
  endpoint: string,
  url: string,
  timeoutMs = 30_000
): Promise<JobSubmitResponse> {
  const body = new URLSearchParams();
  body.set("url", url);

  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/${endpoint}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    timeoutMs
  );
  if (!res.ok) throw await toApiError(res, "youtube-job");
  return (await res.json()) as JobSubmitResponse;
}

// ---- /youtube/analyze ----
// Result shape is identical to the synchronous /analyze route
// (AnalyzeResponse) — same result-card component can render either.

export function submitYoutubeAnalyze(url: string): Promise<JobSubmitResponse> {
  return submitUrlJob("youtube/analyze", url);
}

export function getYoutubeAnalyzeStatus(jobId: string): Promise<JobStatusResult> {
  return getJobStatus("youtube/analyze", jobId);
}

export async function getYoutubeAnalyzeResult(jobId: string): Promise<AnalyzeResponse> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}/youtube/analyze/result/${jobId}`,
    { method: "GET" },
    15_000
  );
  if (!res.ok) throw await toApiError(res, "youtube-job");
  return (await res.json()) as AnalyzeResponse;
}

// ---- /youtube/separate ----
// Same vocals/instrumental job shape as /separate — reuses
// getSeparationPreviewUrl/DownloadUrl via the `endpoint` param rather
// than duplicating them.

export function submitYoutubeSeparate(
  url: string,
  quality: SeparationQuality = "standard"
): Promise<JobSubmitResponse> {
  return submitUrlJob(quality === "hq" ? "youtube/separate-hq" : "youtube/separate", url);
}

export function getYoutubeSeparateStatus(jobId: string): Promise<JobStatusResult> {
  return getJobStatus("youtube/separate", jobId);
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
  quality: SeparationQuality = "standard"
): Promise<JobSubmitResponse> {
  return submitUrlJob(quality === "hq" ? "youtube/stems-hq" : "youtube/stems", url);
}
export function getYoutubeStemsStatus(jobId: string): Promise<MultiOutputStatusResult> {
  return getMultiOutputStatus("youtube/stems", jobId);
}

export function getYoutubeStemsPreviewUrl(jobId: string, stemName: string): string {
  return getMultiOutputPreviewUrl("youtube/stems", jobId, stemName, "stem");
}

export function getYoutubeStemsDownloadUrl(jobId: string, stemName: string): string {
  return getMultiOutputDownloadUrl("youtube/stems", jobId, stemName, "stem");
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

// ---- /audio-to-midi ----
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
  params: AudioToMidiParams = {}
): Promise<JobSubmitResponse> {
  const fd = new FormData();
  fd.append("file", file);
  if (params.onsetThreshold !== undefined) fd.append("onset_threshold", String(params.onsetThreshold));
  if (params.frameThreshold !== undefined) fd.append("frame_threshold", String(params.frameThreshold));
  if (params.minimumNoteLength !== undefined) fd.append("minimum_note_length", String(params.minimumNoteLength));
  if (params.minimumFrequency !== undefined) fd.append("minimum_frequency", String(params.minimumFrequency));
  if (params.maximumFrequency !== undefined) fd.append("maximum_frequency", String(params.maximumFrequency));
  return submitJob("audio-to-midi", fd, 60_000);
}

export function getAudioToMidiStatus(jobId: string): Promise<JobStatusResult> {
  return getJobStatus("audio-to-midi", jobId);
}

export function getAudioToMidiDownloadUrl(jobId: string): string {
  return getJobDownloadUrl("audio-to-midi", jobId);
}