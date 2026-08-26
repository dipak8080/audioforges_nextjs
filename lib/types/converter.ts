// lib/types/converter.ts

export type OutputFormat = "wav" | "mp3";

export type ProcessingState =
  | "idle"
  | "processing"
  | "complete"
  | "error";

// ============ YOUTUBE CONVERTER TYPES ============

export interface DownloadResponse {
  audio_base64?: string;
  audio?: string;
  base64?: string;
  data?: string;
  title?: string;
  filename?: string;
  format?: string;
  mime_type?: string;
  mimeType?: string;
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

/** Billing outcome returned by a metered submit or upgrade route. */
export interface SubmitBilling {
  charged: "credit" | "free" | null;
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