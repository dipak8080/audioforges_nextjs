// lib/types/converter.ts

export type OutputFormat = "wav" | "mp3";
export type ProcessingState = "idle" | "processing" | "complete" | "error";

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
}

export const FORMAT_OPTIONS: FormatOption[] = [
  { value: "wav", label: "WAV", description: "44.1kHz, lossless" },
  { value: "mp3", label: "MP3", description: "320kbps" },
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
export type SeparationStatus = "processing" | "complete" | "failed";

export interface SeparateResponse {
  job_id: string;
  status: SeparationStatus;
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