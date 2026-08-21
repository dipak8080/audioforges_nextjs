// lib/data/rate-limits.ts
//
// Single source of truth for every tool's rate limit, as configured on
// the backend. Every form component reads its limit from here instead
// of hardcoding a string like "3 per hour" in its own file — a backend
// limit change means updating ONE entry here, not hunting through every
// form component and landing page that happens to display that number.
//
// IMPORTANT: these are DISPLAY values only — this file does not enforce
// anything. It mirrors whatever rate_limit.py / gpu_budget.py actually
// enforce on the backend. If the backend limit changes and this file
// isn't updated to match, the UI will quietly lie to the user about
// what the limit is. There is no way to verify these from the frontend
// alone — they have to be kept in sync by hand.
//
// SCOPE: every limit below is per IP address, per endpoint. Two
// endpoints sharing a number don't share a budget — someone who has
// used their transcription allowance can still submit to /stems.

export interface RateLimitSpec {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
  /** Human-readable label for display, e.g. "3 per hour", "3 per 5 min". */
  label: string;
}

// Keyed by backend endpoint segment. Where one endpoint serves two
// quality tiers (standard/hq), the tiers get separate keys since they
// carry different limits — the form picks the right key for the active
// tier and looks it up with getRateLimitLabel(key).
export const RATE_LIMITS: Record<string, RateLimitSpec> = {
  // Vocal Remover (2 stems: vocals + instrumental)
  separate: { limit: 3, windowSeconds: 3600, label: "3 per hour" },
  "separate-hq": { limit: 1, windowSeconds: 3600, label: "1 per hour" },
  "youtube/separate": { limit: 3, windowSeconds: 3600, label: "3 per hour" },
  "youtube/separate-hq": { limit: 1, windowSeconds: 3600, label: "1 per hour" },

  // Stem Splitter (4 stems: vocals, drums, bass, other)
  stems: { limit: 3, windowSeconds: 3600, label: "3 per hour" },
  "stems-hq": { limit: 1, windowSeconds: 3600, label: "1 per hour" },
  "youtube/stems": { limit: 3, windowSeconds: 3600, label: "3 per hour" },
  "youtube/stems-hq": { limit: 1, windowSeconds: 3600, label: "1 per hour" },

  // Transcription — CONFIRMED against TRANSCRIPTION_API.md §9.
  //
  // All three routes carry the same 2-per-5-minutes limit, but they are
  // counted SEPARATELY: exhausting /speech-to-text doesn't block
  // /youtube/transcribe. Worth knowing before writing any copy that
  // implies one shared transcription allowance.
  //
  // These are the tightest limits on the site by a wide margin, and the
  // most likely to be hit by an ordinary user — someone who picks the
  // wrong language, retries, and then wants a third go is already
  // blocked. That makes the countdown in the UI load-bearing rather
  // than decorative.
  "speech-to-text": { limit: 2, windowSeconds: 300, label: "2 per 5 minutes" },
  "youtube/transcribe": { limit: 2, windowSeconds: 300, label: "2 per 5 minutes" },
  "video-to-text": { limit: 2, windowSeconds: 300, label: "2 per 5 minutes" },

  // Other tools
  "audio-to-midi": { limit: 3, windowSeconds: 300, label: "3 per 5 minutes" },

  // TODO(dipak): everything below this line is UNCONFIRMED. Known-real
  // values are stems/stems-hq (StemsForm.tsx), audio-to-midi (API doc),
  // and the three transcription routes above (TRANSCRIPTION_API.md §9).
  // separate/separate-hq and the youtube/* separation variants were
  // carried over from what each form already had hardcoded, and are
  // assumed to match stems/stems-hq but not independently verified.
  // Still missing entirely: convert, trim, volume, loudnorm, join, fade,
  // reverse, mono-stereo-converter, sample-rate-converter,
  // ringtone-maker, pitch, tempo, noise-remove, voice-clean,
  // echo-remove, silence-remove, silence-split.
  // Paste rate_limit.py (or just the numbers) and I'll fill these in,
  // then migrate each form component to read from here.
};

export function getRateLimitLabel(endpoint: string): string | undefined {
  return RATE_LIMITS[endpoint]?.label;
}

export function getRateLimit(endpoint: string): RateLimitSpec | undefined {
  return RATE_LIMITS[endpoint];
}

/**
 * Seconds to count down after a 429 when the server didn't send a
 * Retry-After header. Falls back to the endpoint's own window, which is
 * the correct worst case — the limit can't still be in force beyond it.
 *
 * Callers should prefer the header when it's present:
 *   setCooldown(err.retryAfterSeconds ?? getRetryAfterFallback(endpoint))
 */
export function getRetryAfterFallback(endpoint: string, defaultSeconds = 300): number {
  return RATE_LIMITS[endpoint]?.windowSeconds ?? defaultSeconds;
}