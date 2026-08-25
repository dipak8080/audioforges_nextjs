/**
 * Credits / paywall API client.
 *
 * Separate from railway.ts on purpose: every request in THIS file sends
 * `credentials: "include"` so the `af_sid` identity cookie flows, and
 * nothing in railway.ts's free-tool surface should carry identity. Keeping
 * the two files apart makes that boundary visible rather than a per-call
 * flag someone forgets.
 *
 * The metered SUBMIT routes (separate-hq, stems-hq, youtube/*-hq) live in
 * railway.ts because they share the existing job plumbing — those get
 * credentials via the `withCredentials` flag added to submitSeparation /
 * submitStems / submitUrlJob.
 */

import {
  RAILWAY_API_BASE,
  ApiError,
  fetchWithTimeout,
  readRetryAfter,
  type RequestOptions,
} from "./railway";
import type {
  ClaimResponse,
  CreditsMe,
  CreditsPreview,
  MeteredToolKey,
  PackKey,
  UpgradeInfo,
  UpgradeResponse,
} from "@/lib/types/credits";

/* ------------------------------------------------------------------ */
/* Shared request helper                                               */
/* ------------------------------------------------------------------ */

/**
 * Cookies do not flow cross-subdomain without this, and the failure is
 * silent: every request looks fine and simply belongs to a brand-new
 * anonymous subject, so a purchased balance is invisible forever.
 *
 * COOKIE_DOMAIN is `.audioforges.com` and ALLOWED_ORIGINS contains both
 * apex and www, so this works from either host. It also works from
 * localhost:3000 against the production API (allowlisted server-side),
 * which is how this gets tested — Vercel preview origins are rejected by
 * design, so preview deploys will show the paywall as off.
 */
const CREDENTIALS: RequestCredentials = "include";

async function creditsFetch<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  opts: RequestOptions = {}
): Promise<T> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}${path}`,
    { ...init, credentials: CREDENTIALS, signal: opts.signal },
    timeoutMs
  );

  if (!res.ok) throw await toCreditsError(res);

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
 * The credits routes return `detail` as an OBJECT far more often than the
 * rest of the API does, and the object always carries either `kind` or
 * `error` plus a `message`. railway.ts's parseDetail only understood
 * string and array-of-{msg} details, which is why the 402 payload was
 * being thrown away entirely.
 */
async function toCreditsError(res: Response): Promise<ApiError> {
  let detail: unknown;
  try {
    const body = await res.json();
    detail = body?.detail;
  } catch {
    /* HTML error page, empty body, Cloudflare interstitial */
  }

  const obj =
    detail && typeof detail === "object" && !Array.isArray(detail)
      ? (detail as Record<string, unknown>)
      : null;

  const kind =
    (typeof obj?.kind === "string" && obj.kind) ||
    (typeof obj?.error === "string" && obj.error) ||
    undefined;

  const message =
    (typeof obj?.message === "string" && obj.message) ||
    (typeof detail === "string" && detail) ||
    "";

  const retryAfter = readRetryAfter(res);

  switch (res.status) {
    case 402:
      return new ApiError(message || "You're out of credits for this tool.", 402, {
        kind: "insufficient_credits",
        insufficientCredits: obj as never,
      });
    case 404:
      return new ApiError(message || "That wasn't found.", 404, { kind });
    case 409:
    case 410:
      return new ApiError(message || "That's no longer available.", res.status, { kind });
    case 422:
      // Pydantic validation — the only one users hit is a malformed email.
      return new ApiError(
        message || "That email doesn't look right. Please check it and try again.",
        422,
        { kind: kind ?? "validation_error" }
      );
    case 429:
      return new ApiError(
        message || "You're going a little fast — please wait a moment before trying again.",
        429,
        {
          isRateLimit: true,
          kind: kind ?? "rate_limited",
          retryAfterSeconds:
            (typeof obj?.retry_after_seconds === "number" && obj.retry_after_seconds) ||
            retryAfter ||
            60,
          rateLimit: obj as never,
        }
      );
    case 503:
      return new ApiError(
        message || "That's temporarily unavailable. Please try again in a moment.",
        503,
        { isServerBusy: true, kind, retryAfterSeconds: retryAfter }
      );
    default:
      return new ApiError(message || "The request failed. Please try again.", res.status, {
        kind,
      });
  }
}

/* ------------------------------------------------------------------ */
/* GET /credits/me                                                     */
/* ------------------------------------------------------------------ */

/**
 * Balance, free tier, paywall state, packs, rate-limit tier, and the last
 * 10 ledger entries. Also MINTS THE IDENTITY COOKIE, which is why it is
 * safe and useful to call on load — but only when the paywall is actually
 * on. See CreditProvider for the gating.
 *
 * The backend guarantees this never 4xx's and sets
 * `Cache-Control: no-store`. Any non-200 here means something is wrong
 * upstream, and the correct interpretation is "treat as paywall off"
 * rather than showing the user an error about a feature they may not even
 * be using — so this RETURNS NULL instead of throwing.
 */
export async function getCreditsMe(opts: RequestOptions = {}): Promise<CreditsMe | null> {
  try {
    return await creditsFetch<CreditsMe>("/credits/me", { method: "GET" }, 10_000, opts);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* POST /credits/preview                                               */
/* ------------------------------------------------------------------ */

/**
 * "Will this cost a credit?" — for UX only, never for enforcement.
 *
 * `input_seconds` is OPTIONAL and, for all four HQ tools, IRRELEVANT:
 * they all have `free_under_seconds: 0`, so duration does not affect the
 * credit decision. That is why this signature makes it optional and why
 * there is no client-side audio decoding anywhere in this PR — and it's
 * what makes the YouTube routes (where duration is unknowable before
 * submit) work identically to the upload routes.
 *
 * Send a duration only if a future tool declares a nonzero
 * `free_under_seconds`.
 */
export async function previewCost(
  tool: MeteredToolKey,
  inputSeconds?: number | null,
  opts: RequestOptions = {}
): Promise<CreditsPreview | null> {
  try {
    return await creditsFetch<CreditsPreview>(
      "/credits/preview",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, input_seconds: inputSeconds ?? null }),
      },
      10_000,
      opts
    );
  } catch {
    // A failed preview must never block a submit. The server enforces;
    // this only decorates.
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* POST /credits/claim                                                 */
/* ------------------------------------------------------------------ */

/**
 * Records the email→browser link in `pending_claims` and returns the Ko-fi
 * URL to send the buyer to. This MUST happen before the redirect: Ko-fi's
 * webhook carries no custom data field, so the buyer's email is the only
 * thing tying a payment back to this browser. Skip this and the credits
 * are only reachable via a magic link.
 *
 * `pending_claims` is PRIMARY KEY(email) with ON CONFLICT DO UPDATE, so
 * changing pack mid-flow replaces rather than duplicates. Claims expire
 * after `claim_expires_minutes` (120).
 *
 * Unlike most of this file, this throws on failure — the caller is a form
 * with a submit button and needs to show the user what went wrong.
 */
export async function claimPack(
  email: string,
  pack: PackKey,
  opts: RequestOptions = {}
): Promise<ClaimResponse> {
  return creditsFetch<ClaimResponse>(
    "/credits/claim",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, pack }),
    },
    15_000,
    opts
  );
}

/* ------------------------------------------------------------------ */
/* Upgrade to HQ                                                       */
/* ------------------------------------------------------------------ */

/** Which upgrade route family a finished standard job belongs to. */
export type UpgradeFamily = "separate" | "stems";

/**
 * "Should the upgrade button show, and what will it cost?"
 *
 * Never 404s — it exists to render a page, so it always answers. When
 * `eligible` is false, `reason` is one of ten enum values, each of which
 * deserves its own copy (PR3). Notably `hq_disabled` ("HQ is off for
 * everyone right now", temporary) and `tool_disabled` ("this route isn't
 * metered") are deliberately separate.
 *
 * Not identity-bound: browser B can query browser A's job id, consistent
 * with the existing /separate/status route. The upgrade itself charges
 * whoever calls it.
 */
export async function getUpgradeInfo(
  family: UpgradeFamily,
  jobId: string,
  opts: RequestOptions = {}
): Promise<UpgradeInfo | null> {
  try {
    return await creditsFetch<UpgradeInfo>(
      `/${family}/upgrade-info/${jobId}`,
      { method: "GET" },
      10_000,
      opts
    );
  } catch {
    return null;
  }
}

/**
 * Re-runs a finished standard job at HQ for one credit. No re-upload —
 * the source file survives to the job's 2h TTL.
 *
 * Returns a NEW job id; poll it at the EXISTING status route
 * (/separate/status/{id} or /stems/status/{id}) and use the standard
 * preview/download URL patterns. There are no HQ-specific result routes.
 *
 * Idempotent per SOURCE job: a second call returns the first call's child
 * with `already_upgraded: true` and `billing: null` — a 200, not an error.
 * Disable the button client-side anyway, because a spinner that doesn't
 * appear on the first click is its own bug.
 *
 * Throws on 402 with `err.insufficientCredits` populated, which is what
 * opens the gate modal.
 */
export async function upgradeToHq(
  family: UpgradeFamily,
  jobId: string,
  opts: RequestOptions = {}
): Promise<UpgradeResponse> {
  return creditsFetch<UpgradeResponse>(
    `/${family}/upgrade/${jobId}`,
    { method: "POST" },
    30_000,
    opts
  );
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/**
 * Always 200 whether or not the account exists (enumeration resistant),
 * so the UI copy must be conditional-voiced: "if that email has credits,
 * we've sent a link." Rate limited to 5/hour on email OR IP.
 */
export async function requestMagicLink(
  email: string,
  opts: RequestOptions = {}
): Promise<{ ok: boolean; message: string }> {
  return creditsFetch<{ ok: boolean; message: string }>(
    "/auth/magic-link",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
    15_000,
    opts
  );
}

/**
 * Clears the cookie server-side AND unlinks the subject from the account,
 * so the browser genuinely reverts to anonymous rather than staying
 * silently attached. Caller should refetch /credits/me afterwards.
 */
export async function logout(opts: RequestOptions = {}): Promise<{ ok: boolean }> {
  return creditsFetch<{ ok: boolean }>("/auth/logout", { method: "POST" }, 10_000, opts);
}

/* ------------------------------------------------------------------ */
/* Narrowing helpers                                                   */
/* ------------------------------------------------------------------ */

/** True when this error is a 402 carrying a renderable pack list. */
export function isInsufficientCredits(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 402 && !!err.insufficientCredits;
}

/** True when a metered route rate-limited a FREE-tier caller — a conversion moment. */
export function isFreeTierRateLimit(err: unknown): boolean {
  return err instanceof ApiError && err.isRateLimit && err.rateLimit?.tier === "free";
}