// lib/data/rate-limits.ts
//
// FALLBACK ONLY. GET /limits and GET /credits/me are the source of truth at
// runtime and every limit is operator-tunable with no redeploy, so treat the
// numbers below as a last resort for when both are unreachable.
//
// For input caps (file counts, byte ceilings, duration ceilings) see
// tool-limits.ts.

export interface RateLimitSpec {
  limit: number;
  windowSeconds: number;
  label: string;
  envVar?: string;
}

export interface SharedWindowSpec {
  maxRequests: number;
  windowSeconds: number;
}

/** A pool of routes drawing from one allowance across one or more windows. */
export interface SharedAllowanceSpec {
  key: string;
  /** Backend paths, leading slash included. */
  routes: string[];
  scope: string;
  /** Sorted shortest window first. */
  windows: SharedWindowSpec[];
}

export const RATE_LIMITS: Record<string, RateLimitSpec> = {
  // The four standard separation routes share ONE allowance — see
  // SHARED_ALLOWANCES. The per-route number here is the hourly window only and
  // cannot express the daily cap.
  separate: {
    limit: 10, windowSeconds: 3600, label: "10 per hour",
    envVar: "SEPARATION_RATE_LIMIT_MAX_REQUESTS",
  },
  stems: {
    limit: 10, windowSeconds: 3600, label: "10 per hour",
    envVar: "STEMS_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/separate": {
    limit: 10, windowSeconds: 3600, label: "10 per hour",
    envVar: "YOUTUBE_SEPARATE_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/stems": {
    limit: 10, windowSeconds: 3600, label: "10 per hour",
    envVar: "YOUTUBE_STEMS_RATE_LIMIT_MAX_REQUESTS",
  },

  // FREE-TIER numbers. The HQ routes are tiered: credits raise them to 30/hour
  // and key on the account rather than the IP, so a form that can resolve the
  // visitor should call rateLimitFor() and only fall back here.
  "separate-hq": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "SEPARATION_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  "stems-hq": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "STEMS_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/separate-hq": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "YOUTUBE_SEPARATE_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/stems-hq": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "YOUTUBE_STEMS_HQ_RATE_LIMIT_MAX_REQUESTS",
  },

  // The three transcription routes draw from one pool keyed on the rule, not
  // the path. Any copy implying three separate allowances is wrong.
  "speech-to-text": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "AUDIO_TRANSCRIBE_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/transcribe": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "YOUTUBE_TRANSCRIBE_RATE_LIMIT_MAX_REQUESTS",
  },
  "video-to-text": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "VIDEO_TRANSCRIBE_RATE_LIMIT_MAX_REQUESTS",
  },

  "audio-to-midi": {
    limit: 5, windowSeconds: 300, label: "5 per 5 minutes",
    envVar: "MIDI_RATE_LIMIT_MAX_REQUESTS",
  },
  "audio-to-midi-hq": {
    limit: 2, windowSeconds: 3600, label: "2 per hour",
    envVar: "MIDI_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  // Not the binding free-tier constraint: free_under_seconds and
  // FREE_MONTHLY_OPS govern that. Secondary abuse limit, display only.
  "audio-to-sheet": {
    limit: 30, windowSeconds: 3600, label: "30 per hour",
    envVar: "SHEET_MUSIC_RATE_LIMIT_MAX_REQUESTS",
  },

  download: {
    limit: 30, windowSeconds: 3600, label: "30 per hour",
    envVar: "DOWNLOAD_RATE_LIMIT_MAX_REQUESTS",
  },
  "tiktok-to-mp3": {
    limit: 30, windowSeconds: 3600, label: "30 per hour",
    envVar: "TIKTOK_RATE_LIMIT_MAX_REQUESTS",
  },

  convert: {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_CONVERT_RATE_LIMIT_MAX_REQUESTS",
  },
  trim: {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_TRIM_RATE_LIMIT_MAX_REQUESTS",
  },
  volume: {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_VOLUME_RATE_LIMIT_MAX_REQUESTS",
  },
  reverse: {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_REVERSE_RATE_LIMIT_MAX_REQUESTS",
  },
  "noise-remove": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_NOISE_RATE_LIMIT_MAX_REQUESTS",
  },
  "voice-clean": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_VOICE_CLEAN_RATE_LIMIT_MAX_REQUESTS",
  },
  "echo-remove": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_ECHO_REMOVE_RATE_LIMIT_MAX_REQUESTS",
  },
  "silence-remove": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "AUDIO_SILENCE_REMOVE_RATE_LIMIT_MAX_REQUESTS",
  },
  "loudness-normalizer": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "LOUDNORM_RATE_LIMIT_MAX_REQUESTS",
  },
  fade: {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "FADE_RATE_LIMIT_MAX_REQUESTS",
  },
  "mono-stereo-converter": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "CHANNELS_RATE_LIMIT_MAX_REQUESTS",
  },
  "sample-rate-converter": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "RESAMPLE_RATE_LIMIT_MAX_REQUESTS",
  },
  "ringtone-maker": {
    limit: 5, windowSeconds: 60, label: "5 per minute",
    envVar: "RINGTONE_RATE_LIMIT_MAX_REQUESTS",
  },

  pitch: {
    limit: 5, windowSeconds: 300, label: "5 per 5 minutes",
    envVar: "AUDIO_PITCH_RATE_LIMIT_MAX_REQUESTS",
  },
  tempo: {
    limit: 5, windowSeconds: 300, label: "5 per 5 minutes",
    envVar: "AUDIO_TEMPO_RATE_LIMIT_MAX_REQUESTS",
  },
  "silence-split": {
    limit: 3, windowSeconds: 300, label: "3 per 5 minutes",
    envVar: "SILENCE_SPLIT_RATE_LIMIT_MAX_REQUESTS",
  },
  join: {
    limit: 5, windowSeconds: 300, label: "5 per 5 minutes",
    envVar: "JOIN_RATE_LIMIT_MAX_REQUESTS",
  },
  "video-to-audio": {
    limit: 5, windowSeconds: 300, label: "5 per 5 minutes",
    envVar: "VIDEO_TO_AUDIO_RATE_LIMIT_MAX_REQUESTS",
  },

  // Never touches the separation slot, which is why it stays this loose.
  "youtube/analyze": {
    limit: 15, windowSeconds: 3600, label: "15 per hour",
    envVar: "YOUTUBE_ANALYZE_RATE_LIMIT_MAX_REQUESTS",
  },
};

/**
 * Pools where several routes spend from one allowance. Fallback for
 * `rate_limits.shared`.
 *
 * The four standard separation routes are one bucket per IP across two
 * windows: four splits on /stems spend four of the same ten that
 * /youtube/separate draws from.
 */
export const SHARED_ALLOWANCES: SharedAllowanceSpec[] = [
  {
    key: "separation-standard",
    routes: ["/separate", "/stems", "/youtube/separate", "/youtube/stems"],
    scope: "per_ip",
    windows: [
      { maxRequests: 10, windowSeconds: 3600 },
      { maxRequests: 30, windowSeconds: 86400 },
    ],
  },
];

/** "/youtube/separate", "youtube/separate" and "youtube_separate" all match. */
export function normalizeRouteKey(route: string): string {
  return "/" + route.trim().replace(/^\/+/, "").replace(/_/g, "/").toLowerCase();
}

export function getSharedAllowance(route: string): SharedAllowanceSpec | null {
  const want = normalizeRouteKey(route);
  return (
    SHARED_ALLOWANCES.find((a) => a.routes.some((r) => normalizeRouteKey(r) === want)) ?? null
  );
}

export function getRateLimitLabel(endpoint: string): string | undefined {
  return RATE_LIMITS[endpoint]?.label;
}

export function getRateLimit(endpoint: string): RateLimitSpec | undefined {
  return RATE_LIMITS[endpoint];
}

/**
 * Seconds to count down after a 429 with no Retry-After header.
 *
 * For a route in a shared pool this returns the SHORTEST window, not the
 * longest: a 10/hour block is the common case and locking the button for a day
 * on a guess would be worse than re-showing the 429. Prefer the header, which
 * the backend does send.
 */
export function getRetryAfterFallback(endpoint: string, defaultSeconds = 300): number {
  const shared = getSharedAllowance(endpoint);
  if (shared?.windows.length) {
    return Math.min(...shared.windows.map((w) => w.windowSeconds));
  }
  return RATE_LIMITS[endpoint]?.windowSeconds ?? defaultSeconds;
}