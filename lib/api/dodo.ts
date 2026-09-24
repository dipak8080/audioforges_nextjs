import { purchaseSource } from "@/lib/credits/purchase-source";
import { ApiError, RAILWAY_API_BASE, fetchWithTimeout } from "@/lib/api/railway";
import type { PackKey } from "@/lib/types/credits";

const CREDENTIALS: RequestCredentials = "include";

export interface DodoConfig {
  enabled: boolean;
  environment: "test" | "live";
}

export type DodoConfirmResult =
  | { ok: true; credits: number; balance: number; already_applied: boolean }
  | { ok: false; pending: true; status: string };

async function dodoFetch<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const res = await fetchWithTimeout(
    `${RAILWAY_API_BASE}${path}`,
    { ...init, credentials: CREDENTIALS },
    timeoutMs
  );

  if (!res.ok) {
    let message = "Checkout is unavailable right now. Please try again.";
    let kind: string | undefined;
    try {
      const body = await res.json();
      if (typeof body?.detail?.error === "string") kind = body.detail.error;
      if (body?.detail?.message) message = String(body.detail.message);
      else if (kind === "dodo_not_configured") message = "Card payments are not set up yet.";
      else if (kind === "unknown_pack") message = "That credit pack no longer exists.";
    } catch {
      /* keep the default */
    }
    throw new ApiError(message, res.status, { kind });
  }

  return (await res.json()) as T;
}

let configPromise: Promise<DodoConfig | null> | null = null;

export function getDodoConfig(): Promise<DodoConfig | null> {
  if (configPromise) return configPromise;

  configPromise = dodoFetch<DodoConfig>("/credits/dodo/config", { method: "GET" }, 10_000).catch(
    () => {
      configPromise = null;
      return null;
    }
  );

  return configPromise;
}

export async function createDodoCheckout(pack: PackKey, email: string): Promise<string> {
  const body = await dodoFetch<{ checkout_url: string }>(
    "/credits/dodo/checkout",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack, email, ...purchaseSource() }),
    },
    20_000
  );
  return body.checkout_url;
}

export async function confirmDodoPayment(paymentId: string): Promise<DodoConfirmResult> {
  return dodoFetch<DodoConfirmResult>(
    "/credits/dodo/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_id: paymentId }),
    },
    20_000
  );
}