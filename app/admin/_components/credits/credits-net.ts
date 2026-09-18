import { useSyncExternalStore } from "react";

export const inflight = { n: 0, last: 0, subs: new Set<() => void>() };
export const emitInflight = () => inflight.subs.forEach((f) => f());
export const subscribeInflight = (f: () => void) => {
  inflight.subs.add(f);
  return () => {
    inflight.subs.delete(f);
  };
};

export function useInflight() {
  const busy = useSyncExternalStore(subscribeInflight, () => inflight.n > 0, () => false);
  const last = useSyncExternalStore(subscribeInflight, () => inflight.last, () => 0);
  return { busy, lastUpdated: last || null };
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  inflight.n += 1;
  emitInflight();
  try {
    return await apiRaw<T>(path, init);
  } finally {
    inflight.n = Math.max(0, inflight.n - 1);
    if (inflight.n === 0) inflight.last = Date.now();
    emitInflight();
  }
}

export async function apiRaw<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON is surfaced as its own message */
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
export const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);