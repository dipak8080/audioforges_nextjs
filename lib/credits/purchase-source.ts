// Session-scoped purchase attribution. Two fields: the first touch that
// brought the visitor (a ?src= link or the YouTube funnel) and the last
// thing that opened checkout (a tool gate or the pricing page). Both ride
// along on PayPal order creation so admin can group sales by origin.

const ORIGIN_KEY = "af_src_origin";
const TRIGGER_KEY = "af_src_trigger";
const TAG = /[^a-z0-9_\-/:.]/g;

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().replace(TAG, "").slice(0, 64);
  return v || null;
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Private mode or storage disabled. Attribution is best effort.
  }
}

/** First touch wins for the session; a later call does not overwrite. */
export function markOrigin(source: string): void {
  if (typeof window === "undefined") return;
  if (read(ORIGIN_KEY)) return;
  write(ORIGIN_KEY, clean(source));
}

/** Last touch wins: whichever gate or page opened checkout most recently. */
export function markTrigger(tool: string): void {
  if (typeof window === "undefined") return;
  write(TRIGGER_KEY, clean(tool));
}

/** Reads ?src= off the landing URL once per session. Call on mount. */
export function captureOriginFromUrl(): void {
  if (typeof window === "undefined") return;
  const src = new URLSearchParams(window.location.search).get("src");
  if (src) markOrigin(src);
}

export function purchaseSource(): { source: string | null; tool: string | null; page: string | null } {
  if (typeof window === "undefined") return { source: null, tool: null, page: null };
  return {
    source: clean(read(ORIGIN_KEY)),
    tool: clean(read(TRIGGER_KEY)),
    page: window.location.pathname.slice(0, 128) || null,
  };
}