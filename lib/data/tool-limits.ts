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
// ---------------------------------------------------------------
// WHEN A TOOL HAS TWO STACKED CAPS, LIST THE BINDING ONE.
//
// Added 2026-08-22 after an audit found three pages advertising a
// limit their users could never actually reach. Every /youtube/* tool
// runs a DOWNLOAD and then a PROCESSING step, each with its own
// ceiling, and they are not the same number:
//
//   MAX_VIDEO_DURATION_SECONDS        2400 (40 min)  — the download
//   MAX_SEPARATION_DURATION_SECONDS    600 (10 min)  — separation
//   MAX_SEPARATION_DURATION_SECONDS_HQ 600 (10 min)  — separation, HQ
//                                    RAISED from 360 on 2026-08-28;
//                                    HQ now matches the standard tier,
//                                    so the two no longer differ here.
//   MAX_TRANSCRIPTION_DURATION_SECONDS 1200 (20 min) — transcription
//
// The SMALLER of the pair is what a user hits, and it is the only one
// worth showing them. Advertising 40 minutes on a separation page
// invites a 14-minute video that downloads through the paid proxy and
// then fails at the separation step — the user waits, pays nothing,
// and we pay for bandwidth on a job that was refusable at submit.
//
// So each /youtube/* entry below carries the PROCESSING cap, not the
// download cap, and names both env vars so the pairing stays visible.
// The one exception is youtube/analyze, where the download cap really
// is the binding one — analysis trims to ANALYSIS_MAX_SECONDS rather
// than rejecting, so nothing downstream refuses on length.
// ---------------------------------------------------------------
//
// Verified against config.py on 2026-08-22.
// Re-verified 2026-08-30 for the pitch/tempo override wiring (see the
// "PITCH / TEMPO" block below) and the ringtone cap (30s, matching
// RINGTONE_MAX_DURATION_SECONDS after it was corrected the same day).
//
// EVERY ENTRY MIRRORS config.py. There are no intentional divergences; if
// you find a mismatch, it is a bug rather than a decision.
//
// ---------------------------------------------------------------
// ⚠️ THE 100 MB CLOUDFLARE CEILING (2026-08-30).
//
// The free Cloudflare plan caps REQUEST BODIES at 100 MB, and the
// origin only accepts Cloudflare IPs. So anything over ~100 MB never
// reaches the API at all: the edge returns Cloudflare's own 413 HTML
// page and nothing appears in the container log.
//
// That is not a policy we can raise by changing config — it is
// structural until the plan changes. Three caps were lowered to 90 MB
// to sit under it:
//
//   join.maxTotalBytes      150 -> 90
//   video-to-audio          200 -> 90
//   video-to-text           100 -> 90
//
// The old numbers were advertising something impossible. A 124 MB join
// spent a minute uploading, got killed at the edge, and surfaced as
// "taking longer than expected" — because the response was HTML rather
// than JSON, so ApiError.kind came back undefined and the form fell
// through to generic timeout copy. Nothing was slow; the request was
// simply never delivered.
//
// KEEP THESE THREE UNDER 100. If a future change raises one past that
// ceiling, it will fail at the edge with no server-side trace, which is
// the hardest possible failure to diagnose.
// ---------------------------------------------------------------
//
// ---------------------------------------------------------------
// NOTE ON THIS FILE'S ROLE AFTER 2026-08-30.
//
// Every tool page now reads its limits from lib/api/limits.ts (GET
// /limits) rather than from here. This file is the FALLBACK that
// getLimits() seeds itself from when the backend is unreachable, plus
// the source for the handful of values /limits doesn't publish —
// currently the silence-split segment caps and the ringtone length.
//
// That demotion is deliberate. Six pages shipped a length limit that
// was wrong by forty minutes because a number was typed by hand from
// this file's values and then never rechecked. Values that come from
// the backend can't drift; values that live only here still can, so
// keep this list short and keep the envVars honest.
//
// ⚠️ BUT THE CLIENT FORMS STILL READ THIS FILE, AND THEY ARE THE HALF
// THAT VALIDATES. getLimits() is server-only — a "use client" component
// cannot call it — so every dropzone hint and every pre-upload size
// check runs against the values below, not against /limits.
//
// That is how a 124 MB join got as far as uploading after the backend
// lowered the cap to 90: the SERVER page said 90 in its limits table
// while the CLIENT dropzone said 150 and let the batch through.
//
// So these three are load-bearing in a way the rest of the file is not.
// Until the forms take their limits as props from the server page, a
// backend change to an upload cap needs a matching edit HERE or the
// client will keep accepting what the edge will refuse.
// ---------------------------------------------------------------

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
  //
  // All four of these are now published under `join` in /limits, so
  // /audio-joiner reads them from the backend and this entry is only the
  // offline fallback.
  join: {
    maxFiles: 10,
    // 90, not 150 — see the Cloudflare note at the top. JoinForm reads THIS
    // value for its dropzone hint and its pre-upload check, so it is what
    // actually decides whether a batch is refused before the transfer starts.
    maxTotalBytes: 90 * MB,
    maxFileBytes: 80 * MB, // MAX_UPLOAD_BYTES still applies per file, and is
                           // now genuinely enforced — an oversized single file
                           // comes back with an error naming that file.
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
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_SEPARATION_DURATION_SECONDS_HQ"],
  },
  stems: {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_SEPARATION_DURATION_SECONDS"],
  },
  "stems-hq": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_SEPARATION_DURATION_SECONDS_HQ"],
  },

  // ---- YOUTUBE CHAINED TOOLS ----
  //
  // No maxFileBytes on any of these: there is no upload. The input is a
  // link, and what bounds it is the video's LENGTH, not its size.
  //
  // The duration shown is the SEPARATION cap, not the 40-minute
  // download cap — see the note at the top of this file. Identical
  // numbers to their upload-based siblings above, which is the point:
  // the separation work is the same, only the input method differs.
  "youtube/separate": {
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_SEPARATION_DURATION_SECONDS", "MAX_VIDEO_DURATION_SECONDS"],
  },
  "youtube/separate-hq": {
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_SEPARATION_DURATION_SECONDS_HQ", "MAX_VIDEO_DURATION_SECONDS"],
  },
  "youtube/stems": {
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_SEPARATION_DURATION_SECONDS", "MAX_VIDEO_DURATION_SECONDS"],
  },
  "youtube/stems-hq": {
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_SEPARATION_DURATION_SECONDS_HQ", "MAX_VIDEO_DURATION_SECONDS"],
  },

  // The ONE tool where the download cap genuinely is the binding one.
  // Key/BPM analysis trims to ANALYSIS_MAX_SECONDS (180s) rather than
  // rejecting a long file, so nothing after the download refuses on
  // length — 40 minutes really is the ceiling here.
  "youtube/analyze": {
    maxTotalDurationSeconds: 2400,
    envVars: ["MAX_VIDEO_DURATION_SECONDS"],
  },

  // ---- TRANSCRIPTION ----
  "speech-to-text": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 1200,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_TRANSCRIPTION_DURATION_SECONDS"],
  },
  "video-to-text": {
    // 90, not 100 — see the Cloudflare note at the top. 100 sat exactly ON
    // the edge limit, so multipart overhead alone could push a passing file
    // over it.
    maxFileBytes: 90 * MB,
    maxTotalDurationSeconds: 1200,
    envVars: ["MAX_VIDEO_TRANSCRIBE_BYTES", "MAX_TRANSCRIPTION_DURATION_SECONDS"],
  },
  // 20 minutes, NOT the downloader's 40. This entry exists specifically
  // because there was nothing here before, so /youtube-to-text had no
  // source to read and inherited whatever number the copy happened to
  // state. A user pasting a 30-minute video is refused after the
  // download completes, having waited for a fetch that was never going
  // to be usable.
  //
  // This 1200 is also the sentence that six other pages copied and got
  // wrong — it is correct HERE and on the three transcription pages, and
  // was wrong everywhere else it appeared. See the note at the top.
  "youtube/transcribe": {
    maxTotalDurationSeconds: 1200,
    envVars: ["MAX_TRANSCRIPTION_DURATION_SECONDS", "MAX_VIDEO_DURATION_SECONDS"],
  },

  // ---- MIDI ----
  "audio-to-midi": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 600,
    minDurationSeconds: 1,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_MIDI_DURATION_SECONDS", "MIN_MIDI_DURATION_SECONDS"],
  },
  // The paid multi-track tool. Same ceilings as the free one today, but they
  // are separate backend variables and can diverge — mirrored separately so
  // that when they do, only one entry needs changing.
  "audio-to-midi-hq": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 600,
    minDurationSeconds: 1,
    envVars: ["MAX_UPLOAD_BYTES", "MIDI_HQ_MAX_DURATION_SECONDS"],
  },

  // ---- VIDEO ----
  "video-to-audio": {
    // 90, not 200 — see the Cloudflare note at the top.
    maxFileBytes: 90 * MB,
    maxTotalDurationSeconds: 3600,
    envVars: ["MAX_VIDEO_UPLOAD_BYTES", "VIDEO_EXTRACT_MAX_DURATION_SECONDS"],
  },

  // ---- YOUTUBE / TIKTOK DOWNLOAD ----
  //
  // Published by /limits since 2026-08-30 as
  // durations.youtube_download_max_seconds, so pages read it from there and
  // this entry is the offline fallback only. It was previously stated from
  // the frontend's TRANSCRIPTION_LIMITS, which is a different subsystem
  // entirely — the backend's new key deliberately avoids "transcribe" in its
  // name so it can't drift back.
  download: {
    maxTotalDurationSeconds: 2400,
    envVars: ["MAX_VIDEO_DURATION_SECONDS"],
  },
  "tiktok-to-mp3": {
    maxTotalDurationSeconds: 600,
    envVars: ["MAX_TIKTOK_DURATION_SECONDS"],
  },

  // ---- GENERIC AUDIO TOOLS (trim/volume/reverse/convert/etc) ----
  //
  // This 3600 is the MAX_AUDIO_TOOL_DURATION_SECONDS fallback, and it
  // applies to every generic audio tool EXCEPT any tool listed in the
  // backend's per-tool override map (AUDIO_TOOL_MAX_DURATION_SECONDS in
  // config.py). That map is now wired into the submit path, so a tool
  // in it is really capped lower than this entry claims.
  //
  // Overridden today: pitch, tempo (900s) — both have their own entries
  // below. If another tool is added to the map, give it an entry here
  // too, or any page reading getDurationLabel("audio-tools") for it
  // will advertise an hour against a real, enforced 15-minute cap.
  //
  // /limits now publishes this map directly under `durations`, including
  // its `exempt_tools` list — /convert has NO duration cap at all, which
  // is not representable in this file and is a further reason pages read
  // the backend rather than this entry.
  "audio-tools": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 3600,
    envVars: ["MAX_UPLOAD_BYTES", "MAX_AUDIO_TOOL_DURATION_SECONDS"],
  },

  // ---- PITCH / TEMPO ----
  // The per-tool override the "audio-tools" note above warned about. Wired
  // into the submit path 2026-08-30; before that these validated against the
  // 3600 fallback, so a 50-minute file was accepted, took one of four slots,
  // and died on pitch's 600s rubberband timeout ten minutes later.
  pitch: {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 900,
    envVars: ["MAX_UPLOAD_BYTES", "AUDIO_TOOL_MAX_DURATION_SECONDS"],
  },
  tempo: {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 900,
    envVars: ["MAX_UPLOAD_BYTES", "AUDIO_TOOL_MAX_DURATION_SECONDS"],
  },

  // ---- RINGTONE ----
  //
  // 30 SECONDS IS APPLE'S CAP, not ours. Verified at
  // support.apple.com/en-us/120692 ("Create a custom ringtone on your iPhone",
  // published 22 May 2025), which states it twice — as "ringtones can be up to
  // 30 seconds long", and again at the export step.
  //
  // Worth keeping the export-step detail, because it is why this number is
  // load-bearing rather than cosmetic: a ringtone longer than 30 seconds is
  // NOT rejected by GarageBand, it prompts you to let GarageBand shorten it
  // automatically. So an over-length M4R fails silently — the section someone
  // carefully selected is not the section they end up with, and nothing in the
  // chain tells them. A hard rejection would be self-correcting; this isn't.
  //
  // The backend was 40 until 2026-08-30 and is now 30, so this mirrors
  // config.py again. Don't raise it without checking Apple first.
  //
  // RingtoneForm and every figure on /ringtone-maker read this value, so one
  // line moves the slider ceiling, the feature strip, the how-to step, three
  // FAQ answers and the JSON-LD together.
  "ringtone-maker": {
    maxFileBytes: 80 * MB,
    maxTotalDurationSeconds: 30,
    envVars: ["MAX_UPLOAD_BYTES", "RINGTONE_MAX_DURATION_SECONDS"],
  },

  // ---- SILENCE SPLIT ----
  // Confirmed against config.py's SILENCE_SPLIT_* block, not the generic
  // "audio-tools" entry above — silence-split has no total duration cap
  // (SILENCE_SPLIT_DETECT_TIMEOUT_SECONDS/SILENCE_SPLIT_CUT_TIMEOUT_SECONDS
  // bound the ffmpeg calls, not the input length), but it does have an
  // output-segment count cap and a minimum-kept-segment length that no
  // other tool has, so it needs its own entry.
  //
  // The segment cap is one of the two values /limits does not publish, so
  // /silence-split still reads it from here. Worth knowing what it does:
  // going OVER it refuses the split outright rather than truncating to 50 —
  // nothing is written, and the error names the real count.
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