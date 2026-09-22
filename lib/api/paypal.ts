import { purchaseSource } from "@/lib/credits/purchase-source";
import { ApiError, RAILWAY_API_BASE, fetchWithTimeout } from "@/lib/api/railway";
import type { PackKey } from "@/lib/types/credits";

const CREDENTIALS: RequestCredentials = "include";

export interface PayPalConfig {
  enabled: boolean;
  client_id: string;
  currency: string;
  sandbox: boolean;
}

export interface PayPalCaptureResult {
  ok: boolean;
  credits: number;
  balance: number;
  already_applied: boolean;
}

async function paypalFetch<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
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
      else if (kind === "paypal_not_configured") message = "Card payments are not set up yet.";
      else if (kind === "unknown_pack") message = "That credit pack no longer exists.";
    } catch {
      /* keep the default */
    }
    throw new ApiError(message, res.status, { kind });
  }

  return (await res.json()) as T;
}

let configPromise: Promise<PayPalConfig | null> | null = null;

/** Fetched once per page. A failed fetch clears the cache so a retry is possible. */
export function getPayPalConfig(): Promise<PayPalConfig | null> {
  if (configPromise) return configPromise;

  configPromise = paypalFetch<PayPalConfig>("/credits/paypal/config", { method: "GET" }, 10_000)
    .catch(() => {
      configPromise = null;
      return null;
    });

  return configPromise;
}

/**
 * Warms config + SDK in the background so the buttons are instant by the
 * time the buyer reaches checkout. Safe to call repeatedly.
 */
export function preloadPayPal(): void {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const config = await getPayPalConfig();
      if (config?.enabled && config.client_id) {
        await loadPayPalSdk(config.client_id, config.currency);
      }
    } catch {
      /* checkout will fall back on its own */
    }
  })();
}

export async function createPayPalOrder(pack: PackKey, email: string): Promise<string> {
  const body = await paypalFetch<{ order_id: string }>(
    "/credits/paypal/order",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack, email, ...purchaseSource() }),
    },
    20_000
  );
  return body.order_id;
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalCaptureResult> {
  return paypalFetch<PayPalCaptureResult>(
    "/credits/paypal/capture",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    },
    30_000
  );
}

let sdkPromise: Promise<void> | null = null;

/** Loads the PayPal JS SDK once per page. Resolves when window.paypal exists. */
export function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("paypal-sdk");
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = "paypal-sdk";
    script.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
      `&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons` +
      `&disable-funding=paylater,credit`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Remove the dead tag so a later attempt injects a fresh one
      // instead of resolving against a script that never loaded.
      script.remove();
      sdkPromise = null;
      reject(new Error("Could not load PayPal."));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}