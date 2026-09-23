import {
  ApiError,
  RAILWAY_API_BASE,
  fetchWithTimeout,
  readRetryAfter,
  type RequestOptions,
} from "@/lib/api/railway";
import type { InsufficientCreditsPayload } from "@/lib/types/credits";
import type { SubmitBilling } from "@/lib/types/converter";

export type BatchKind = "separate" | "stems";
export type BatchJobStatus = "queued" | "processing" | "complete" | "failed" | "expired";
export type BatchStatus = "collecting" | "running" | "done" | "cancelled" | "expired";

export interface BatchCreateResponse {
  batch_id: string;
  kind: BatchKind;
  expected: number;
  credits_per_track: number;
  balance: number;
  free_remaining: number;
}

export interface BatchAddResponse {
  batch_id: string;
  job_id: string;
  index: number;
  title: string;
  input_seconds: number;
  billing: SubmitBilling;
}

export interface BatchJobView {
  job_id: string;
  index: number;
  status: BatchJobStatus;
  title: string | null;
  error: string | null;
  stems: string[];
}

export interface BatchStatusResponse {
  batch_id: string;
  kind: BatchKind;
  status: BatchStatus;
  expected: number;
  jobs: BatchJobView[];
  counts: Record<BatchJobStatus, number>;
  created_at: number;
  expires_at: number;
  elapsed_seconds: number;
}

async function toBatchError(res: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    detail = (await res.clone().json())?.detail;
  } catch {
    detail = undefined;
  }
  const obj = detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as Record<string, unknown>) : null;
  const message =
    (obj && typeof obj.message === "string" && obj.message) ||
    (typeof detail === "string" && detail) ||
    "";
  const kind = obj && ((typeof obj.kind === "string" && obj.kind) || (typeof obj.error === "string" && obj.error)) || undefined;

  if (res.status === 402 && obj?.error === "insufficient_credits") {
    return new ApiError(message || "You're out of credits for this tool.", 402, {
      kind: "insufficient_credits",
      insufficientCredits: obj as unknown as InsufficientCreditsPayload,
    });
  }
  if (res.status === 429) {
    return new ApiError(message || "You're going a little fast. Wait a moment and try again.", 429, {
      isRateLimit: true,
      kind: kind ?? "rate_limited",
      retryAfterSeconds: readRetryAfter(res) || 60,
    });
  }
  if (res.status === 503) {
    return new ApiError(message || "The batch queue is busy right now. Try again in a few minutes.", 503, {
      isServerBusy: true,
      kind,
      retryable: true,
    });
  }
  return new ApiError(message || `Request failed (${res.status})`, res.status, { kind });
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw await toBatchError(res);
  return (await res.json()) as T;
}

const withCreds = { credentials: "include" as RequestCredentials };

export async function createBatch(kind: BatchKind, count: number, opts: RequestOptions = {}): Promise<BatchCreateResponse> {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("count", String(count));
  const res = await fetchWithTimeout(`${RAILWAY_API_BASE}/batch/create`, { method: "POST", body: fd, signal: opts.signal, ...withCreds }, 20_000);
  return json<BatchCreateResponse>(res);
}

export function addToBatch(
  batchId: string,
  file: File,
  onProgress?: (fraction: number) => void,
  timeoutMs = 300_000
): Promise<BatchAddResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${RAILWAY_API_BASE}/batch/${batchId}/add`);
    xhr.withCredentials = true;
    xhr.responseType = "text";
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new ApiError("We couldn't reach the server. Check your connection and try again.", 0));
    xhr.ontimeout = () => reject(new ApiError("The upload took too long. Try a smaller file or a faster connection.", 0, { isTimeout: true }));
    xhr.onload = () => {
      const res = new Response(xhr.responseText, { status: xhr.status, headers: { "Content-Type": "application/json" } });
      json<BatchAddResponse>(res).then(resolve, reject);
    };
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

export async function startBatch(batchId: string): Promise<{ batch_id: string; status: BatchStatus; jobs?: number }> {
  const res = await fetchWithTimeout(`${RAILWAY_API_BASE}/batch/${batchId}/start`, { method: "POST", ...withCreds }, 20_000);
  return json(res);
}

export async function getBatchStatus(batchId: string, opts: RequestOptions = {}): Promise<BatchStatusResponse> {
  const res = await fetchWithTimeout(`${RAILWAY_API_BASE}/batch/${batchId}`, { method: "GET", signal: opts.signal }, 15_000);
  return json<BatchStatusResponse>(res);
}

export async function cancelBatch(batchId: string): Promise<{ cancelled: boolean; refunded?: number; stopped?: number }> {
  const res = await fetchWithTimeout(`${RAILWAY_API_BASE}/batch/${batchId}/cancel`, { method: "POST", ...withCreds }, 20_000);
  return json(res);
}

export function getBatchDownloadUrl(batchId: string, format: "wav" | "mp3" = "wav"): string {
  return `${RAILWAY_API_BASE}/batch/${batchId}/download?format=${format}`;
}

const STORE_PREFIX = "af-batch:";

export interface StoredBatch {
  batchId: string;
  kind: BatchKind;
  savedAt: number;
}

export function storeBatch(kind: BatchKind, batchId: string): void {
  try {
    sessionStorage.setItem(STORE_PREFIX + kind, JSON.stringify({ batchId, kind, savedAt: Date.now() } satisfies StoredBatch));
  } catch {
    /* storage unavailable */
  }
}

export function readStoredBatch(kind: BatchKind): StoredBatch | null {
  try {
    const raw = sessionStorage.getItem(STORE_PREFIX + kind);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredBatch;
    if (!parsed?.batchId || Date.now() - parsed.savedAt > 4 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredBatch(kind: BatchKind): void {
  try {
    sessionStorage.removeItem(STORE_PREFIX + kind);
  } catch {
    /* storage unavailable */
  }
}