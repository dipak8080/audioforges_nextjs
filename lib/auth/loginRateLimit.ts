import { createHash, timingSafeEqual } from "node:crypto";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const GLOBAL_SOFT_LIMIT = 30;
const GLOBAL_DELAY_MS = 2000;
const MAX_TRACKED_KEYS = 5000;

type Attempt = { count: number; windowStart: number; lockedUntil: number };

const attempts = new Map<string, Attempt>();
let globalFailures = 0;
let globalWindowStart = Date.now();

function prune(now: number) {
  if (attempts.size < MAX_TRACKED_KEYS) return;
  for (const [key, a] of attempts) {
    if (now > a.lockedUntil && now - a.windowStart > WINDOW_MS) attempts.delete(key);
  }
}

// Cloudflare sits in front of the origin, so cf-connecting-ip is the only
// header here the caller cannot forge.
export function clientKey(req: Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

export function checkLockout(key: string): { locked: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const a = attempts.get(key);
  if (!a) return { locked: false, retryAfter: 0 };
  if (now < a.lockedUntil) {
    return { locked: true, retryAfter: Math.ceil((a.lockedUntil - now) / 1000) };
  }
  if (now - a.windowStart > WINDOW_MS) attempts.delete(key);
  return { locked: false, retryAfter: 0 };
}

export function recordFailure(key: string): { locked: boolean; retryAfter: number } {
  const now = Date.now();

  if (now - globalWindowStart > WINDOW_MS) {
    globalWindowStart = now;
    globalFailures = 0;
  }
  globalFailures += 1;

  const a = attempts.get(key);
  if (!a || now - a.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now, lockedUntil: 0 });
    return { locked: false, retryAfter: 0 };
  }

  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.lockedUntil = now + LOCKOUT_MS;
    a.count = 0;
    a.windowStart = now;
    return { locked: true, retryAfter: Math.ceil(LOCKOUT_MS / 1000) };
  }
  return { locked: false, retryAfter: 0 };
}

export function clearFailures(key: string) {
  attempts.delete(key);
}

// A distributed attacker rotating IPs never trips the per-IP lockout, so
// sustained failure volume slows every attempt instead. A delay rather than a
// block, so an attacker cannot lock the real admin out.
export async function throttleDelay(): Promise<void> {
  const now = Date.now();
  if (now - globalWindowStart > WINDOW_MS) return;
  if (globalFailures < GLOBAL_SOFT_LIMIT) return;
  await new Promise((resolve) => setTimeout(resolve, GLOBAL_DELAY_MS));
}

// Hash both sides first so the comparison is fixed-length and the timing
// carries no information about the real password's length.
export function passwordMatches(supplied: string, expected: string): boolean {
  const a = createHash("sha256").update(supplied, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}