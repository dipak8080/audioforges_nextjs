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
//
// For input caps (file counts, byte ceilings, duration ceilings) see
// tool-limits.ts — separate file, separate concern.
//
// ALL VALUES BELOW VERIFIED against backend config.py on 2026-08-21.
// The `envVar` field names the backend variable, so a limit changed on
// the VPS can be traced back here without grepping Python.

export interface RateLimitSpec {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window duration in seconds. */
  windowSeconds: number;
  /** Human-readable label for display, e.g. "3 per hour", "3 per 5 min". */
  label: string;
  /** Backend env var governing the request count, for cross-checking. */
  envVar?: string;
}

// Keyed by backend endpoint segment. Where one endpoint serves two
// quality tiers (standard/hq), the tiers get separate keys since they
// carry different limits — the form picks the right key for the active
// tier and looks it up with getRateLimitLabel(key).
export const RATE_LIMITS: Record<string, RateLimitSpec> = {
  // ---- Vocal Remover (2 stems: vocals + instrumental) ----
  separate: {
    limit: 3, windowSeconds: 3600, label: "3 per hour",
    envVar: "SEPARATION_RATE_LIMIT_MAX_REQUESTS",
  },
  "separate-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "SEPARATION_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/separate": {
    limit: 15, windowSeconds: 3600, label: "15 per hour",
    envVar: "YOUTUBE_CHAIN_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/separate-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "YOUTUBE_CHAIN_HQ_RATE_LIMIT_MAX_REQUESTS",
  },

  // ---- Stem Splitter (4 stems: vocals, drums, bass, other) ----
  stems: {
    limit: 3, windowSeconds: 3600, label: "3 per hour",
    envVar: "STEMS_RATE_LIMIT_MAX_REQUESTS",
  },
  "stems-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "STEMS_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/stems": {
    limit: 15, windowSeconds: 3600, label: "15 per hour",
    envVar: "YOUTUBE_CHAIN_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/stems-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "YOUTUBE_CHAIN_HQ_RATE_LIMIT_MAX_REQUESTS",
  },

  // ---- Transcription ----
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
  "speech-to-text": {
    limit: 2, windowSeconds: 300, label: "2 per 5 minutes",
    envVar: "AUDIO_TRANSCRIBE_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/transcribe": {
    limit: 2, windowSeconds: 300, label: "2 per 5 minutes",
    envVar: "YOUTUBE_TRANSCRIBE_RATE_LIMIT_MAX_REQUESTS",
  },
  "video-to-text": {
    limit: 2, windowSeconds: 300, label: "2 per 5 minutes",
    envVar: "VIDEO_TRANSCRIBE_RATE_LIMIT_MAX_REQUESTS",
  },

  // ---- Audio to MIDI ----
  //
  // CORRECTED 2026-08-21: this said "3 per 5 minutes", but
  // MIDI_RATE_LIMIT_MAX_REQUESTS in config.py is 5, not 3. The UI was
  // under-reporting the real allowance — users were told they had two
  // fewer attempts than they actually did.
  "audio-to-midi": {
    limit: 5, windowSeconds: 300, label: "5 per 5 minutes",
    envVar: "MIDI_RATE_LIMIT_MAX_REQUESTS",
  },

  // ---- YouTube / TikTok download ----
  download: {
    limit: 15, windowSeconds: 3600, label: "15 per hour",
    envVar: "DOWNLOAD_RATE_LIMIT_MAX_REQUESTS",
  },
  "tiktok-to-mp3": {
    limit: 30, windowSeconds: 3600, label: "30 per hour",
    envVar: "TIKTOK_RATE_LIMIT_MAX_REQUESTS",
  },

  // ---- Fast ffmpeg tools (5 per minute) ----
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

  // ---- Heavier tools (rubberband / multi-input filter graphs) ----
  pitch: {
    limit: 3, windowSeconds: 300, label: "3 per 5 minutes",
    envVar: "AUDIO_PITCH_RATE_LIMIT_MAX_REQUESTS",
  },
  tempo: {
    limit: 3, windowSeconds: 300, label: "3 per 5 minutes",
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

  // ---- YouTube chained analysis ----
  "youtube/analyze": {
    limit: 15, windowSeconds: 3600, label: "15 per hour",
    envVar: "YOUTUBE_CHAIN_RATE_LIMIT_MAX_REQUESTS",
  },
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