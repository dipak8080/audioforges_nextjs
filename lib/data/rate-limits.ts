// lib/data/rate-limits.ts
//
// Single source of truth for every tool's rate limit, as configured on
// the backend. Every form component reads its limit from here instead
// of hardcoding a string like "3 per hour" in its own file — a backend
// limit change means updating ONE entry here, not hunting through every
// form component that happens to display that number.
//
// IMPORTANT: these are DISPLAY values only — this file does not enforce
// anything. It mirrors whatever rate_limit.py / gpu_budget.py actually
// enforce on the backend. If the backend limit changes and this file
// isn't updated to match, the UI will quietly lie to the user about
// what the limit is. There is no way to verify these from the frontend
// alone — they have to be kept in sync by hand.

export interface RateLimitSpec {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
  /** Human-readable label for display, e.g. "3 per hour", "3 per 5 min". */
  label: string;
}

// Keyed by backend endpoint segment — matches the `endpoint` prop passed
// to JobToolForm / MultiOutputToolForm / YouTubeUrlForm, so a form can
// look itself up with RATE_LIMITS[endpoint] rather than a separate
// name-mapping table.
export const RATE_LIMITS: Record<string, RateLimitSpec> = {
  stems: { limit: 3, windowSeconds: 3600, label: "3 per hour" },
  "stems-hq": { limit: 1, windowSeconds: 3600, label: "1 per hour" },
  "audio-to-midi": { limit: 3, windowSeconds: 300, label: "3 per 5 minutes" },

  // TODO(dipak): everything below this line is UNCONFIRMED. I've only
  // seen the actual rate_limit.py values for stems/stems-hq (from
  // StemsForm.tsx) and audio-to-midi (from your API doc). I have NOT
  // seen the real numbers for convert, trim, volume, loudnorm, join,
  // fade, reverse, mono-stereo-converter, sample-rate-converter,
  // ringtone-maker, pitch, tempo, noise-remove, voice-clean,
  // echo-remove, silence-remove, silence-split, speech-to-text,
  // separate, separate-hq, or any youtube/* variant — so I'm not
  // guessing at them. Paste rate_limit.py (or just the numbers) and
  // I'll fill every one of these in, then go migrate each form
  // component to read from here instead of its own hardcoded string.
};

export function getRateLimitLabel(endpoint: string): string | undefined {
  return RATE_LIMITS[endpoint]?.label;
}