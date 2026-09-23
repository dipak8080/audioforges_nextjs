import { purchaseSource } from "@/lib/credits/purchase-source";
import { ApiError, RAILWAY_API_BASE, fetchWithTimeout } from "@/lib/api/railway";
import type { PackKey } from "@/lib/types/credits";

const CREDENTIALS: RequestCredentials = "include";
const PADDLE_JS = "https://cdn.paddle.com/paddle/v2/paddle.js";

export interface PaddleConfig {
  enabled: boolean;
  client_token: string;
  environment: "sandbox" | "production";
}

export type PaddleConfirmResult =
  | { ok: true; credits: number; balance: number; already_applied: boolean }
  | { ok: false; pending: true; status: string };

export interface PaddleEvent {
  name?: string;
  data?: { transaction_id?: string } & Record<string, unknown>;
}

interface PaddleGlobal {
  Environment: { set: (env: string) => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
  Checkout: {
    open: (opts: Record<string, unknown>) => void;
    close: () => void;
  };
}

async function paddleFetch<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
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
      else if (kind === "paddle_not_configured") message = "Card payments are not set up yet.";
      else if (kind === "unknown_pack") message = "That credit pack no longer exists.";
    } catch {
      /* keep the default */
    }
    throw new ApiError(message, res.status, { kind });
  }

  return (await res.json()) as T;
}

let configPromise: Promise<PaddleConfig | null> | null = null;

export function getPaddleConfig(): Promise<PaddleConfig | null> {
  if (configPromise) return configPromise;

  configPromise = paddleFetch<PaddleConfig>("/credits/paddle/config", { method: "GET" }, 10_000)
    .catch(() => {
      configPromise = null;
      return null;
    });

  return configPromise;
}

export async function createPaddleTransaction(pack: PackKey, email: string): Promise<string> {
  const body = await paddleFetch<{ transaction_id: string }>(
    "/credits/paddle/transaction",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack, email, ...purchaseSource() }),
    },
    20_000
  );
  return body.transaction_id;
}

export async function confirmPaddleTransaction(transactionId: string): Promise<PaddleConfirmResult> {
  return paddleFetch<PaddleConfirmResult>(
    "/credits/paddle/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: transactionId }),
    },
    20_000
  );
}

let listener: ((e: PaddleEvent) => void) | null = null;

/** Paddle.js takes one eventCallback at Initialize, so events are routed to whichever checkout is mounted. */
export function setPaddleListener(fn: ((e: PaddleEvent) => void) | null): void {
  listener = fn;
}

function paddleGlobal(): PaddleGlobal | undefined {
  return (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
}

let readyPromise: Promise<PaddleGlobal> | null = null;

export function loadPaddle(config: PaddleConfig): Promise<PaddleGlobal> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<PaddleGlobal>((resolve, reject) => {
    const init = () => {
      const paddle = paddleGlobal();
      if (!paddle) {
        readyPromise = null;
        reject(new Error("Paddle did not load."));
        return;
      }
      try {
        if (config.environment === "sandbox") paddle.Environment.set("sandbox");
        paddle.Initialize({
          token: config.client_token,
          eventCallback: (e) => listener?.(e),
        });
        resolve(paddle);
      } catch (err) {
        readyPromise = null;
        reject(err);
      }
    };

    if (paddleGlobal()) {
      init();
      return;
    }

    const script = document.createElement("script");
    script.id = "paddle-js";
    script.src = PADDLE_JS;
    script.async = true;
    script.onload = init;
    script.onerror = () => {
      script.remove();
      readyPromise = null;
      reject(new Error("Could not load Paddle."));
    };
    document.head.appendChild(script);
  });

  return readyPromise;
}

export function preloadPaddle(): void {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const config = await getPaddleConfig();
      if (config?.enabled && config.client_token) await loadPaddle(config);
    } catch {
      /* checkout reports it on its own */
    }
  })();
}