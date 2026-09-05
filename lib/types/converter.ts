// lib/types/converter.ts

export type OutputFormat = "wav" | "mp3";

export type ProcessingState =
  | "idle"
  | "processing"
  | "complete"
  | "error";

// ============ YOUTUBE CONVERTER TYPES ============

/**
 * /download's response, in BOTH modes.
 *
 * The endpoint answers in one of two shapes depending on the `response` form
 * field (see downloadYouTubeAudio in lib/api/railway.ts):
 *
 *   base64  the audio itself, inline. The original behaviour, still the
 *           backend's default, and the reason this type is mostly optional
 *           fields — four different key names have been used for the payload
 *           over time and extractBase64Audio checks all of them.
 *
 *   url     a signed link to the file, served with FileResponse. Nothing is
 *           held in memory on either end: the browser streams to disk and the
 *           player seeks with Range requests. This is what /youtube-to-wav
 *           uses, because 40 minutes of WAV in base64 peaked near a gigabyte
 *           in the tab and killed phones.
 *
 * The two shapes share one interface rather than being a discriminated union,
 * because the index signature below means a union would buy nothing: any
 * `payload.whatever` already type-checks. What the named fields DO buy is that
 * `payload.url` reads as `string | undefined` rather than `unknown`, so
 * resolveDownloadUrl needs no cast and a typo in the field name is caught.
 */
export interface DownloadResponse {
  // ---- base64 mode ----
  audio_base64?: string;
  audio?: string;
  base64?: string;
  data?: string;
  mime_type?: string;
  mimeType?: string;

  // ---- url mode ----
  /**
   * RELATIVE path, e.g. "/download/file/dQw4w9WgXcQ.wav?token=...".
   *
   * Never hand this straight to an <a href> or an <audio src>: it would
   * resolve against audioforges.com instead of api.audioforges.com and 404 on
   * our own site, which looks like the tool broke. Use resolveDownloadUrl().
   */
  url?: string;
  /**
   * Unix seconds. One hour out; the signature is rejected with a 403 past it.
   *
   * It exists so the frontend can decide BEFORE starting a download rather
   * than discovering the expiry halfway through one — someone who converts,
   * switches apps and comes back after lunch would otherwise press a button
   * that had been sitting there looking ready.
   */
  expires_at?: number;
  /**
   * The real byte count of the file the link serves — read off disk on a fresh
   * download, from a stat on the cache entry for a hit.
   *
   * OMITTED, NOT NULL, when the server couldn't stat it. That happens in one
   * narrow race: the cache entry is evicted between the lookup and the stat.
   * The link is still returned, because the GET does its own lookup and 404s
   * honestly if the file is really gone.
   *
   * So test for the property rather than assuming a number, and hide the size
   * rather than rendering "0 B" for a file that is almost certainly fine.
   */
  size_bytes?: number;

  // ---- both modes ----
  title?: string;
  filename?: string;
  format?: string;

  [key: string]: unknown;
}

export interface YouTubeValidationResult {
  isValid: boolean;
  error?: string;
  videoId?: string;
  normalizedUrl?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  message?: string;
}

export interface FormatOption {
  value: OutputFormat;
  label: string;
  description: string;

  /** Badge on the right, e.g. "Lossless" / "Compressed". */
  quality?: string;

  /** Mono spec line, e.g. "44.1 kHz · 16-bit · ~10 MB/min". */
  spec?: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: "wav",
    label: "WAV",
    quality: "Lossless",
    description: "Uncompressed. Drop straight into any DAW.",
    spec: "44.1 kHz · 16-bit · ~10 MB/min",
  },
  {
    value: "mp3",
    label: "MP3",
    quality: "Compressed",
    description: "Smaller files. Plays on everything.",
    spec: "320 kbps · CBR · ~2.4 MB/min",
  },
];

// ============ KEY FINDER TYPES ============

export interface CrossCheck {
  key_agrees?: boolean | null;
  bpm_agrees?: boolean | null;
}

export interface AnalyzeResponse {
  key?: string;
  camelot?: string;
  bpm?: number;
  confidence?: number;
  bpm_confidence?: number;
  cross_check?: CrossCheck;
  [key: string]: unknown;
}

export interface AnalysisResult {
  key: string;
  camelot: string;
  bpm: number;
  confidence: number;
  bpmConfidence: number;
  keyAgrees: boolean | null;
  bpmAgrees: boolean | null;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

// ============ VOCAL REMOVER (SEPARATION) TYPES ============

export type StemType = "vocals" | "instrumental";

export type SeparationStatus =
  | "processing"
  | "complete"
  | "failed";

/**
 * Billing outcome returned by a metered submit or upgrade route.
 *
 * `charged` is the string "none", NOT JSON null. It mirrors
 * Charge.charge_type in credits/ledger.py, typed there as
 * Literal["free", "credit", "none"], and every route serialises it
 * verbatim. `charge_for_job` sets "none" in its `if not billable:` branch,
 * which `paywall.guard` reaches whenever the global paywall is off OR that
 * tool's own rule is disabled.
 *
 * This was declared as `| null` and no null is ever sent, so a
 * `charged === null` guard could never fire. Consequence: flip any tool's
 * rule off and every job returns "none", falls past the guard, and renders
 * a receipt reading "Free run used" for a job that was never metered.
 * Branch on "none".
 */
export interface SubmitBilling {
  charged: "credit" | "free" | "none";
  /** Credits actually taken for this run. Absent on older routes; treat as 1. */
  credits?: number;
  balance: number;
  free_remaining: number;
}

export interface SeparateResponse {
  job_id: string;
  status: SeparationStatus;
  /**
   * Present ONLY on the metered HQ routes (`rule_key` set server-side),
   * absent on the free standard routes. Reading the balance from here
   * instead of refetching /credits/me removes a round trip at the exact
   * moment the user is watching the number change.
   */
  billing?: SubmitBilling;
}

export interface SeparateStatusResponse {
  job_id: string;
  status: SeparationStatus;
  title: string | null;
  error: string | null;
}

export type SeparationUiState =
  | "idle"
  | "uploading"
  | "processing"
  | "complete"
  | "failed"
  | "error";