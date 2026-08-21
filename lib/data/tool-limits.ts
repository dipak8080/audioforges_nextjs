// lib/data/tool-limits.ts
//
// Single source of truth for every tool's INPUT CAPS — file counts,
// byte ceilings, and duration ceilings — as configured on the backend.
//
// Deliberately SEPARATE from rate-limits.ts. That file answers "how
// often may you submit"; this one answers "what will be accepted when
// you do". They change for different reasons (rate limits move for
// abuse/cost, caps move for capacity), and conflating them would mean
// touching one file for two unrelated concerns.
//
// IMPORTANT — same caveat as rate-limits.ts: these are DISPLAY values
// only. Nothing here is enforced. Every number mirrors a constant in
// the backend's config.py, and most of those read from an env var, so
// a value can be changed on the VPS WITHOUT any code change here. When
// that happens this file silently starts lying. The `envVar` field on
// each entry names the variable to check, so the mapping is at least
// discoverable rather than folklore.
//
// Verified against config.py on 2026-08-21.

export interface ToolLimits {
  /** Max number of files per request, where the tool accepts several. */
  maxFiles?: number;
  /** Combined byte ceiling across all files in one request. */
  maxTotalBytes?: number;
  /** Per-file byte ceiling, where it differs from the combined total. */
  maxFileBytes?: number;
  /** Combined duration ceiling in seconds. */
  maxTotalDurationSeconds?: number;
  /** Minimum duration in seconds, where a floor exists. */
  minDurationSeconds?: number;
  /** Max number of output segments a split/separation can produce. */
  maxOutputSegments?: number;
  /** Minimum length, in seconds, a split output segment must reach to be kept. */
  minOutputSegmentSeconds?: number;
  /** Backend env vars governing these values, for cross-checking. */
  envVars?: string[];
}

const MB = 1024 * 1024;

export const TOOL_LIMITS: Record<string, ToolLimits> = {
  // ---- JOIN ----
  // NOTE: JOIN_MAX_TOTAL_DURATION_SECONDS was raised from 1800 (30 min)
  // to 5400 (90 min). That change is env-driven on the VPS — this entry
  // is only correct if JOIN_MAX_TOTAL_DURATION_SECONDS=5400 is actually
  // set there. JOIN_TIMEOUT_SECONDS must be raised alongside it (900),
  // or long joins fail slowly at the ffmpeg timeout instead of failing
  // fast at submit, which is a strictly worse failure.
  join: {
    maxFiles: 10,
    maxTotalBytes: 150 * MB,
    maxFileBytes: 80 * MB, // MAX_UPLOAD_BYTES still applies per file
    maxTotalDurationSeconds: 5400,
    envVars: [
      "JOIN_MAX_FILES",
      "JOIN_MAX_TOTAL_BYTES",
      "JOIN_MAX_TOTAL_DURATION_SECONDS",
      "MAX_UPLOAD_BYTES",
    ],
  },

  // ---- SEPARATION ----
  separate: {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_SEPARATION_DURATION_SECONDS"],
  },
  "separate-hq": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 360,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_SEPARATION_DURATION_SECONDS_HQ"],
  },

  // ---- TRANSCRIPTION ----
  "speech-to-text": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 1200,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_TRANSCRIPTION_DURATION_SECONDS"],
  },
  "video-to-text": {
    maxFileBytes: 100 * MB,
    maxTotalDurationSeconds: 1200,
    envVars: ["MAX_VIDEO_TRANSCRIBE_BYTES", "MAX_TRANSCRIPTION_DURATION_SECONDS"],
  },

  // ---- MIDI ----
  "audio-to-midi": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 600,
    minDurationSeconds: 1,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_MIDI_DURATION_SECONDS", "MIN_MIDI_DURATION_SECONDS"],
  },

  // ---- VIDEO ----
  "video-to-audio": {
    maxFileBytes: 200 * MB,
    maxTotalDurationSeconds: 3600,
    envVars: ["MAX_VIDEO_UPLOAD_BYTES", "VIDEO_EXTRACT_MAX_DURATION_SECONDS"],
  },

  // ---- YOUTUBE / TIKTOK ----
  download: {
    maxTotalDurationSeconds: 2400,
    envVars: ["MAX_VIDEO_DURATION_SECONDS"],
  },
  "tiktok-to-mp3": {
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_TIKTOK_DURATION_SECONDS"],
  },

  // ---- GENERIC AUDIO TOOLS (trim/pitch/tempo/volume/reverse/etc) ----
  "audio-tools": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 3600, // was 1200 — backend raised MAX_AUDIO_TOOL_DURATION_SECONDS to 1hr
    envVars: ["MAX_UPLOAD_BYTES", "MAX_AUDIO_TOOL_DURATION_SECONDS"],
  },

  // ---- RINGTONE ----
  "ringtone-maker": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 40,
    envVars: ["MAX_UPLOAD_BYTES", "RINGTONE_MAX_DURATION_SECONDS"],
  },

  // ---- SILENCE SPLIT ----
  // Confirmed against config.py's SILENCE_SPLIT_* block, not the generic
  // "audio-tools" entry above — silence-split has no total duration cap
  // (SILENCE_SPLIT_DETECT_TIMEOUT_SECONDS/SILENCE_SPLIT_CUT_TIMEOUT_SECONDS
  // bound the ffmpeg calls, not the input length), but it does have an
  // output-segment count cap and a minimum-kept-segment length that no
  // other tool has, so it needs its own entry.
  "silence-split": {
    maxFileBytes: 80 * MB,
    maxOutputSegments: 50,
    minOutputSegmentSeconds: 1.0,
    envVars: [
      "MAX_UPLOAD_BYTES",
      "SILENCE_SPLIT_MAX_SEGMENTS",
      "SILENCE_SPLIT_MIN_SEGMENT_SECONDS",
    ],
  },
};

export function getToolLimits(tool: string): ToolLimits | undefined {
  return TOOL_LIMITS[tool];
}

/**
 * Format a byte count for display. Uses MB throughout since every
 * ceiling on this site is in the tens-to-hundreds of MB range —
 * switching to GB above 1024MB would produce "0.15GB" for a limit
 * users think of as "150MB".
 */
export function formatBytes(bytes: number): string {
  return `${Math.round(bytes / MB)}MB`;
}

/**
 * Format a duration for display: "40 seconds", "20 minutes", "1 hour",
 * "1 hour 30 minutes". Deliberately spells out the unit rather than
 * returning "90 min" — this text lands in FAQ answers and schema
 * featureLists, where the abbreviation reads worse.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }

  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} minutes`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;

  return minutes === 0 ? hourPart : `${hourPart} ${minutes} minutes`;
}

/** Convenience: the formatted duration cap for a tool, or undefined. */
export function getDurationLabel(tool: string): string | undefined {
  const seconds = TOOL_LIMITS[tool]?.maxTotalDurationSeconds;
  return seconds === undefined ? undefined : formatDuration(seconds);
}

/** Convenience: the formatted combined-size cap for a tool, or undefined. */
export function getTotalBytesLabel(tool: string): string | undefined {
  const bytes = TOOL_LIMITS[tool]?.maxTotalBytes;
  return bytes === undefined ? undefined : formatBytes(bytes);
}

/** Convenience: the formatted per-file size cap for a tool, or undefined. */
export function getFileBytesLabel(tool: string): string | undefined {
  const bytes = TOOL_LIMITS[tool]?.maxFileBytes;
  return bytes === undefined ? undefined : formatBytes(bytes);
}