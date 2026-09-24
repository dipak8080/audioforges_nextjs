// lib/types/converter.ts

export type ProcessingState =
  | "idle"
  | "processing"
  | "complete"
  | "error";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs?: number;
  message?: string;
}

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