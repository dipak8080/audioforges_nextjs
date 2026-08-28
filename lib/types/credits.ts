/**
 * Types for the credits/paywall system.
 *
 * Every shape here is transcribed from BACKEND_API_REFERENCE_V2.md, which
 * was dumped from running code rather than written by hand. Where the
 * backend's naming is surprising, it is preserved EXACTLY and annotated —
 * renaming a field on the way in is how a frontend quietly starts lying
 * about what the server said.
 *
 * Specifically, do not "fix" these to match intuition:
 *   - `authenticated`     NOT is_authenticated
 *   - `free_monthly_ops`  NOT free_limit
 *   - `paywall.enabled`   nested, NOT a flat paywall_enabled
 *   - `paywall.tools[k]`  an OBJECT, not a boolean
 */

/**
 * Every rule key the paywall can meter.
 *
 * `transcribe` is declared but currently OFF — transcription is free, and the
 * three transcription routes share this one key when it is on.
 * `audio-to-midi-hq` is a SEPARATE TOOL, not a tier of `audio-to-midi`: a
 * different model (YourMT3 vs basic-pitch) with a different parameter set.
 */
export type MeteredToolKey =
  | "separate-hq"
  | "stems-hq"
  | "youtube/separate-hq"
  | "youtube/stems-hq"
  | "transcribe"
  | "audio-to-midi-hq";

/** Pack keys as configured in Ko-fi. */
export type PackKey = "starter" | "regular" | "bulk";

export interface CreditPack {
  key: PackKey;
  credits: number;
  price_usd: number;
  label: string;
  /** Ko-fi shop item URL. NEVER hardcode this — prices change server-side. */
  buy_url: string;
}

export interface PaywallToolRule {
  /** Effective state: global AND per-tool, already resolved. Never AND it again. */
  enabled: boolean;
  /** 0 for all four HQ tools — duration does not affect their credit decision. */
  free_under_seconds: number;
  credits: number;
}

export interface PaywallState {
  enabled: boolean;
  tools: Partial<Record<MeteredToolKey, PaywallToolRule>>;
}

export type RateLimitTier = "free" | "credited";

export interface RateLimitRule {
  max_requests: number;
  window_seconds: number;
}

export interface RateLimitState {
  tier: RateLimitTier;
  tools: Partial<Record<MeteredToolKey, RateLimitRule>>;
}

/** Ledger entry kinds, from the backend's `kind` enum. */
export type LedgerKind =
  | "purchase"
  | "job_hold"
  | "job_refund"
  | "admin_adjust"
  | "chargeback"
  | "bonus";

export interface LedgerEntry {
  delta: number;
  kind: LedgerKind;
  created_at: string;
  /** Usually the tool key for job_hold/job_refund; an admin note otherwise. */
  note: string | null;
}

/** GET /credits/me */
export interface CreditsMe {
  authenticated: boolean;
  email: string | null;
  balance: number;
  free_monthly_ops: number;
  /**
   * Already `min(user_left, ip_left)` floored at 0 — it accounts for the
   * per-IP cap, so it never promises a free run that will 402. Render it
   * as-is; do not second-guess it.
   */
  free_remaining: number;
  free_resets_at: string;
  paywall: PaywallState;
  /** Always present, regardless of paywall state. */
  packs: CreditPack[];
  /**
   * Open holds for jobs with no terminal state yet. This is the answer to
   * the 32-min-poll vs 90-min-sweeper gap: when polling gives up and this
   * is > 0, we can honestly say the credit is still in flight and will
   * return automatically if the job fails.
   */
  held_credits: number;
  rate_limit: RateLimitState;
  /** Last 10 ledger entries. The history feature, without a second endpoint. */
  recent: LedgerEntry[];
}

/** POST /credits/preview */
export type PreviewWillUse = "none" | "free" | "credit" | "blocked";

export type PreviewReason =
  | "paywall_disabled"
  | "tool_free"
  | "under_free_duration"
  | "billable";

export interface CreditsPreview {
  tool: string;
  input_seconds: number | null;
  billable: boolean;
  reason: PreviewReason;
  credits_required: number;
  /** Branch on THIS, not on `billable`. */
  will_use: PreviewWillUse;
  balance: number;
  free_remaining: number;
  can_run: boolean;
}

/** POST /credits/claim */
export interface ClaimResponse {
  ok: boolean;
  buy_url: string;
  pack: PackKey;
  credits: number;
  price_usd: number;
  claim_expires_minutes: number;
}

/** The 402 body's `detail`. Identical at all six metered entry points. */
export interface InsufficientCreditsPayload {
  error: "insufficient_credits";
  message: string;
  tool: string;
  credits_needed: number;
  balance: number;
  free_remaining: number;
  free_resets_at: string;
  packs: CreditPack[];
}

/** GET /separate|stems/upgrade-info/{job_id} */
export type UpgradeIneligibleReason =
  | "job_not_found"
  | "not_a_separation_job"
  | "job_failed"
  | "source_not_complete"
  | "input_expired"
  | "too_long_for_hq"
  | "paywall_disabled"
  | "tool_disabled"
  /** HQ is off for everyone right now — temporary. Distinct from tool_disabled. */
  | "hq_disabled"
  | "already_upgraded";

export interface UpgradeInfoEligible {
  eligible: true;
  reason: null;
  tool: string;
  credits_needed: number;
  will_use: PreviewWillUse;
  balance: number;
  free_remaining: number;
  can_run: boolean;
  input_seconds: number;
  /** source created_at + 2h. No polling needed — compare against Date.now(). */
  input_expires_at: string;
  already_upgraded: boolean;
  upgrade_job_id: string | null;
}

export interface UpgradeInfoIneligible {
  eligible: false;
  reason: UpgradeIneligibleReason;
  tool: string;
  /** Present when reason is too_long_for_hq. */
  input_seconds?: number;
  max_seconds?: number;
  /** Present when reason is already_upgraded. */
  upgrade_job_id?: string;
}

export type UpgradeInfo = UpgradeInfoEligible | UpgradeInfoIneligible;

/**
 * POST /separate|stems/upgrade/{job_id}
 *
 * `charged` is the string "none", never JSON null — same shape and same
 * reasoning as SubmitBilling in lib/types/converter.ts. Kept structurally
 * identical so the two can be used interchangeably at call sites.
 */
export interface UpgradeBilling {
  charged: "credit" | "free" | "none";
  balance: number;
  free_remaining: number;
}

export interface UpgradeResponse {
  /** A NEW job id. Poll it at the EXISTING /separate/status or /stems/status. */
  job_id: string;
  status: string;
  upgraded_from: string;
  /**
   * True on a second call for the same source job — a 200, not an error.
   * The server is idempotent per source job (migration 002), so a
   * double-click cannot double-charge. `billing` is null in this case.
   */
  already_upgraded: boolean;
  billing: UpgradeBilling | null;
}

/** Structured `kind` values the backend returns inside `detail` objects. */
export type CreditsErrorKind =
  | "insufficient_credits"
  | "hq_duration_exceeded"
  | "unreadable_audio"
  | "job_not_found"
  | "job_failed"
  | "source_not_complete"
  | "not_metered"
  | "input_expired"
  | "hq_disabled"
  | "rate_limited";

/** Extra fields carried on a 429 from a metered route. */
export interface RateLimitedPayload {
  kind: "rate_limited";
  message: string;
  tier: RateLimitTier;
  max_requests: number;
  window_seconds: number;
  retry_after_seconds: number;
}

/**
 * Server-side feature flags read from `GET /` and passed down from the
 * root layout. This is what keeps CreditProvider from making a single
 * client request while the paywall is off.
 */
export interface PaywallFlags {
  paywallEnabled: boolean;
  paywallTools: Partial<Record<MeteredToolKey, boolean>>;
}