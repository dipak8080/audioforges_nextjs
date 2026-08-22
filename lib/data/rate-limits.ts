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
// used their transcription allowance can still submit to /stems. This
// is not a convention, it's how rate_limit.py's `_requests` map is
// keyed: `(ip, path)`. Nothing in the backend can make two paths draw
// from one pool without changing that key.
//
// For input caps (file counts, byte ceilings, duration ceilings) see
// tool-limits.ts — separate file, separate concern.
//
// ALL VALUES BELOW RE-VERIFIED against backend config.py on 2026-08-21.
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
  // RAISED 3 -> 6 (2026-08-22), matching the chained youtube/separate
  // limit below. Demand-driven; MAX_QUEUED_SEPARATIONS (3 in flight) is
  // what actually protects the server and is unchanged.
  separate: {
    limit: 6, windowSeconds: 3600, label: "6 per hour",
    envVar: "SEPARATION_RATE_LIMIT_MAX_REQUESTS",
  },
  "separate-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "SEPARATION_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  // CHANGED 2026-08-21: 15 → 6, and the envVar moved off the shared
  // YOUTUBE_CHAIN_* constant onto this tool's own. The backend split
  // one pair of constants into five (one per chained YouTube tool)
  // because /youtube/separate holds the single Demucs slot for 3-5
  // minutes per job, while /youtube/analyze — which shared its number —
  // finishes in about 30 seconds on a 4-slot semaphore. Fifteen
  // separation jobs from one IP was over an hour of the only separation
  // slot on the box.
  "youtube/separate": {
    limit: 6, windowSeconds: 3600, label: "6 per hour",
    envVar: "YOUTUBE_SEPARATE_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/separate-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "YOUTUBE_SEPARATE_HQ_RATE_LIMIT_MAX_REQUESTS",
  },

  // ---- Stem Splitter (4 stems: vocals, drums, bass, other) ----
  // RAISED 3 -> 6 (2026-08-22), same reasoning as `separate` above -
  // identical Demucs cost, so the two move together.
  stems: {
    limit: 6, windowSeconds: 3600, label: "6 per hour",
    envVar: "STEMS_RATE_LIMIT_MAX_REQUESTS",
  },
  "stems-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "STEMS_HQ_RATE_LIMIT_MAX_REQUESTS",
  },
  // CHANGED 2026-08-21: 15 → 6, same reasoning as youtube/separate
  // above. Identical Demucs cost (same model, same run — only the
  // output files differ), so the same number, but now from its own
  // backend constant rather than a shared one.
  "youtube/stems": {
    limit: 6, windowSeconds: 3600, label: "6 per hour",
    envVar: "YOUTUBE_STEMS_RATE_LIMIT_MAX_REQUESTS",
  },
  "youtube/stems-hq": {
    limit: 1, windowSeconds: 3600, label: "1 per hour",
    envVar: "YOUTUBE_STEMS_HQ_RATE_LIMIT_MAX_REQUESTS",
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
  //
  // CORRECTED 2026-08-21: this said 15, but
  // DOWNLOAD_RATE_LIMIT_MAX_REQUESTS in config.py is 18. Same class of
  // bug as the audio-to-midi entry above and in the same direction —
  // the UI under-reported the real allowance, so a user who'd made
  // sixteen downloads was told they were over a limit they hadn't
  // reached. Found while auditing this file against config.py for the
  // YouTube chain split; unrelated to that change.
  download: {
    limit: 18, windowSeconds: 3600, label: "18 per hour",
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
  // RAISED 3 -> 5 (2026-08-22). These are the only ITERATIVE tools on
  // the site - the real workflow is +2, listen, +3, listen - and 3
  // locked someone out on their third attempt, mid-decision. Every
  // other tool here is one-shot.
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

  // ---- YouTube chained analysis ----
  //
  // Unchanged at 15/hour, but now from its own backend constant. This
  // is the one chained YouTube tool that never touches the single
  // separation slot — it runs Essentia on a 3-minute trim against a
  // 4-slot semaphore — which is exactly why it can stay this loose
  // while its two former co-tenants dropped to 6.
  "youtube/analyze": {
    limit: 15, windowSeconds: 3600, label: "15 per hour",
    envVar: "YOUTUBE_ANALYZE_RATE_LIMIT_MAX_REQUESTS",
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