// Broker between the API layer and the Turnstile modal. The API layer asks
// for a challenge; the mounted TurnstileGate answers with a token.

type Resolver = { resolve: (token: string) => void; reject: (err: Error) => void };

let pending: Resolver | null = null;
const listeners = new Set<(open: boolean) => void>();

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function subscribeTurnstile(fn: (open: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Opens the challenge and resolves with the widget token once solved. */
export function requestTurnstile(): Promise<string> {
  if (typeof window === "undefined" || !TURNSTILE_SITE_KEY || listeners.size === 0) {
    return Promise.reject(new Error("turnstile_unavailable"));
  }
  if (pending) {
    return new Promise((resolve, reject) => {
      const prev = pending!;
      pending = {
        resolve: (t) => {
          prev.resolve(t);
          resolve(t);
        },
        reject: (e) => {
          prev.reject(e);
          reject(e);
        },
      };
    });
  }
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
    listeners.forEach((fn) => fn(true));
  });
}

export function settleTurnstile(token: string | null): void {
  const p = pending;
  pending = null;
  listeners.forEach((fn) => fn(false));
  if (!p) return;
  if (token) p.resolve(token);
  else p.reject(new Error("turnstile_cancelled"));
}