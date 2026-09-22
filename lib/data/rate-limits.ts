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
].map((a) => ({
  // Sorted here, not trusted from the literal above. Callers read windows[0]
  // as the shortest window; toSharedAllowance guarantees that for the wire
  // shape, and this is the only other way an allowance is constructed.
  ...a,
  windows: [...a.windows].sort((x, y) => x.windowSeconds - y.windowSeconds),
}));

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

/**
 * Normalizes one wire-shape shared allowance, from EITHER endpoint.
 *
 * /limits and /credits/me publish the same block (the latter adds
 * `metered`), so one validator serves both and they cannot drift into
 * disagreeing about a bucket they both describe.
 *
 * Returns null for an entry missing a key, a route or a usable window: a pool
 * the client half-understands would render a confident wrong sentence.
 */
export function toSharedAllowance(raw: unknown): SharedAllowanceSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;

  const key = typeof d.key === "string" && d.key ? d.key : "";
  const routes = Array.isArray(d.routes)
    ? d.routes.filter((r): r is string => typeof r === "string" && r.length > 0)
    : [];
  const windows = Array.isArray(d.windows)
    ? d.windows
        .map((w): SharedWindowSpec | null => {
          if (!w || typeof w !== "object") return null;
          const x = w as Record<string, unknown>;
          const maxRequests = x.max_requests;
          const windowSeconds = x.window_seconds;
          if (typeof maxRequests !== "number" || !Number.isFinite(maxRequests) || maxRequests <= 0) {
            return null;
          }
          if (
            typeof windowSeconds !== "number" ||
            !Number.isFinite(windowSeconds) ||
            windowSeconds <= 0
          ) {
            return null;
          }
          return { maxRequests, windowSeconds };
        })
        .filter((w): w is SharedWindowSpec => w !== null)
    : [];

  if (!key || routes.length === 0 || windows.length === 0) return null;

  windows.sort((a, b) => a.windowSeconds - b.windowSeconds);
  return {
    key,
    routes,
    scope: typeof d.scope === "string" ? d.scope : "per_ip",
    windows,
  };
}

/** The pool a route draws from, out of an arbitrary list. */
export function findSharedAllowance(
  allowances: SharedAllowanceSpec[],
  route: string
): SharedAllowanceSpec | null {
  const want = normalizeRouteKey(route);
  return (
    allowances.find((a) => a.routes.some((r) => normalizeRouteKey(r) === want)) ?? null
  );
}

/** "10 per hour" / "30 per day" / "2 per 5 minutes". */
export function rateLimitLabel(max: number, windowSeconds: number): string {
  if (windowSeconds >= 86400 && windowSeconds % 86400 === 0) {
    const days = windowSeconds / 86400;
    return `${max} per ${days === 1 ? "day" : `${days} days`}`;
  }
  if (windowSeconds >= 3600) {
    const hours = Math.round(windowSeconds / 3600);
    return `${max} per ${hours === 1 ? "hour" : `${hours} hours`}`;
  }
  if (windowSeconds >= 60) {
    const mins = Math.round(windowSeconds / 60);
    return `${max} per ${mins === 1 ? "minute" : `${mins} minutes`}`;
  }
  return `${max} per ${windowSeconds} seconds`;
}

/** "10 per hour, 30 per day". Every window the pool enforces, shortest first. */
export function sharedAllowanceLabel(allowance: SharedAllowanceSpec): string {
  return allowance.windows
    .map((w) => rateLimitLabel(w.maxRequests, w.windowSeconds))
    .join(", ");
}

/** "10 per hour and 30 per day". The same windows, for a sentence. */
export function sharedAllowanceProse(allowance: SharedAllowanceSpec): string {
  const parts = allowance.windows.map((w) => rateLimitLabel(w.maxRequests, w.windowSeconds));
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];

/** Spelled out up to eight, since this lands mid-sentence in page copy. */
export function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

export function getRateLimitLabel(endpoint: string): string | undefined {
  return RATE_LIMITS[endpoint]?.label;
}

export function getRateLimit(endpoint: string): RateLimitSpec | undefined {
  return RATE_LIMITS[endpoint];
}

/**
 * Seconds to count down when NOTHING about the 429 is known: no Retry-After
 * header and no parsable window in the message.
 *
 * For a route in a shared pool this returns the SHORTEST window, not the
 * longest, because this is a guess and locking the button for a day on a guess
 * is worse than re-showing the 429. Where the window IS known, railway.ts uses
 * it exactly and never reaches here.
 */
export function getRetryAfterFallback(endpoint: string, defaultSeconds = 300): number {
  const shared = getSharedAllowance(endpoint);
  if (shared?.windows.length) {
    return Math.min(...shared.windows.map((w) => w.windowSeconds));
  }
  return RATE_LIMITS[endpoint]?.windowSeconds ?? defaultSeconds;
}