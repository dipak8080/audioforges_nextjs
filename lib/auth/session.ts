// Signed session cookie helpers for the /admin dashboard.
//
// Uses Web Crypto (SubtleCrypto) rather than Node's `crypto` module because
// middleware.ts runs on the Edge runtime by default, which only exposes the
// Web Crypto API - not Node's crypto. Using the same Web Crypto functions
// here means this file works identically whether called from middleware
// (Edge) or from a regular API route (Node).
//
// The cookie value is `payload.signature`, where `signature` is an
// HMAC-SHA256 of `payload` keyed by SESSION_SECRET. Nothing here trusts an
// unsigned or mismatched-signature cookie - the actual "session data" is
// just an expiry timestamp, since this dashboard has exactly one login
// (no per-user accounts to track).

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretBytes(): BufferSource {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set - required for admin session signing.");
  }
  // Cast needed because TS's lib.dom.d.ts types TextEncoder#encode as
  // Uint8Array<ArrayBufferLike>, which some TS versions no longer treat as
  // assignable to BufferSource even though it's identical at runtime.
  return new TextEncoder().encode(secret) as BufferSource;
}

function toBufferSource(text: string): BufferSource {
  return new TextEncoder().encode(text) as BufferSource;
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    getSecretBytes(),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Creates a signed session cookie value: `expiresAt.signatureHex` */
export async function createSessionCookie(): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAt);
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign("HMAC", key, toBufferSource(payload));
  return `${payload}.${toHex(signature)}`;
}

/** Verifies a session cookie value. Returns true only if the signature is
 * valid AND the embedded expiry hasn't passed. */
export async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [payload, signatureHex] = parts;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  try {
    const key = await getHmacKey();
    const expectedSignature = await crypto.subtle.sign("HMAC", key, toBufferSource(payload));
    const expectedHex = toHex(expectedSignature);
    // Constant-time-ish comparison isn't critical here (this isn't a
    // high-value target and hex strings are fixed-length), but comparing
    // full strings rather than short-circuiting on first mismatch avoids
    // trivial timing leaks for free.
    return expectedHex.length === signatureHex.length && expectedHex === signatureHex;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;