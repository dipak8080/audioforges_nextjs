import {
  RATE_LIMITS,
  SHARED_ALLOWANCES,
  normalizeRouteKey,
  type SharedAllowanceSpec,
  type SharedWindowSpec,
} from "@/lib/data/rate-limits";
import { TOOL_LIMITS } from "@/lib/data/tool-limits";

/**
 * `GET /limits` — the backend's account of every FREE-TIER limit.
 *
 * The hand-maintained tables in lib/data are the fallback, not the source. Read
 * this instead: limits are settings-table rows now, changeable by the operator
 * with one API call and no deploy, and a static table drifts the first time one
 * moves.
 *
 * WHAT THIS IS NOT: /limits is public and cacheable precisely because it does
 * not know who is asking, so it always serves free-tier numbers. A credit
 * holder gets 30/hour on a metered tool where free gets 2. Client forms keep
 * calling rateLimitFor() for those; anything here is the anonymous fallback.
 *
 * The shared standard-separation block is the exception and is identical here
 * and on /credits/me, because those four routes are unmetered and have no paid
 * tier.
 *
 * Server-side only, `revalidate: 3600`. Never import into a client component.
 */

const RAILWAY_API_BASE =
  process.env.NEXT_PUBLIC_RAILWAY_API_BASE || "https://api.audioforges.com";

export type { SharedAllowanceSpec, SharedWindowSpec };

export type RetentionShape = "separation" | "audio_tools" | "transcription";

export interface DownloadCache {
  scope: string;
  keyedOn: string[];
  maxAgeSeconds: number;
  eviction: string;
  /** FALSE when entries can be evicted early. Say "up to", never "for". */
  guaranteed: boolean;
  stores: string;
}

export interface Retention {
  inputDeletedWhen: "job_end" | "ttl";
  /** NULL, not 0, when inputDeletedWhen is "job_end". */
  inputSeconds: number | null;
  outputSeconds: number;
  /** "text" is transcription: nothing sits on disk after processing. */
  outputKind: "file" | "files" | "text";
}

export interface Durations {
  audioToolsDefaultSeconds: number;
  /** A tool missing from here takes the default. */
  audioToolsPerToolSeconds: Record<string, number>;
  /** Tools with NO duration check. Applying the default to one rejects uploads
   *  the server would accept. */
  exemptTools: string[];
  videoExtractMaxSeconds: number;
  youtubeDownloadMaxSeconds: number;
  /** TOTAL across every file in one /join request. */
  joinMaxTotalSeconds: number;
  midiMinSeconds: number;
  midiHqMinSeconds: number;
}

export interface Limits {
  maxUploadMb: number;
  maxVideoUploadMb: number;
  /** /video-to-text only. Caps lower than the general video upload limit. */
  maxVideoTranscribeMb: number;
  /** Both totals reject independently, and neither implies the per-file cap. */
  join: {
    maxFiles: number;
    maxTotalMb: number;
    maxPerFileMb: number;
  };
  /** FALSE means the route returns 503. Separate question from whether it costs
   *  a credit. */
  midiHqEnabled: boolean;
  featureDurations: {
    midi: number;
    midiHq: number;
    separationHq: number;
    transcription: number;
  };
  durations: Durations;
  allowedAudioFormats: string[];
  allowedVideoFormats: string[];
  allowedMidiInputFormats: string[];
  /**
   * Free-tier max requests per window, keyed as the backend names them.
   *
   * One number per tool, so these carry the HOURLY figure for a route in a
   * shared pool and cannot express a second window. Read `sharedAllowances`
   * when you need the complete picture. Kept because other code indexes them.
   */
  rateLimits: Record<string, number>;
  /** Per-tool windows. Prefer over windowSeconds — see windowFor(). */
  windows: Record<string, number>;
  /** Legacy flat window, correct for everything without a `windows` entry. */
  windowSeconds: number;
  /**
   * Pools where several routes spend from one allowance across one or more
   * windows. The complete account of a route's limits; the flat keys above are
   * a lossy view of it.
   */
  sharedAllowances: SharedAllowanceSpec[];
  retention: Record<RetentionShape, Retention>;
  downloadCache: DownloadCache;
}

/** Fail-closed defaults, read from the hand tables so a backend blip renders
 *  stale numbers rather than blanks. */
function fallback(): Limits {
  return {
    maxUploadMb: 80,
    maxVideoUploadMb: 200,
    maxVideoTranscribeMb: 100,
    join: { maxFiles: 10, maxTotalMb: 150, maxPerFileMb: 80 },
    // Hides the paid tool rather than offering something that would 503.
    midiHqEnabled: false,
    featureDurations: {
      midi: TOOL_LIMITS["audio-to-midi"]?.maxTotalDurationSeconds ?? 600,
      midiHq: TOOL_LIMITS["audio-to-midi-hq"]?.maxTotalDurationSeconds ?? 600,
      separationHq: TOOL_LIMITS["separate-hq"]?.maxTotalDurationSeconds ?? 600,
      transcription: 1200,
    },
    durations: {
      audioToolsDefaultSeconds: 3600,
      audioToolsPerToolSeconds: { pitch: 900, tempo: 900 },
      exemptTools: ["convert"],
      videoExtractMaxSeconds: 3600,
      youtubeDownloadMaxSeconds: 2400,
      joinMaxTotalSeconds: 5400,
      midiMinSeconds: 1,
      midiHqMinSeconds: 1,
    },
    allowedAudioFormats: ["aac", "aiff", "flac", "m4a", "mp3", "ogg", "wav"],
    allowedVideoFormats: [
      "3gp", "avi", "flv", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm", "wmv",
    ],
    allowedMidiInputFormats: [
      "aac", "aiff", "flac", "m4a", "mp3", "ogg", "opus", "wav", "webm",
    ],
    rateLimits: {
      separate: RATE_LIMITS.separate?.limit ?? 10,
      stems: RATE_LIMITS.stems?.limit ?? 10,
      youtube_separate: RATE_LIMITS["youtube/separate"]?.limit ?? 10,
      youtube_stems: RATE_LIMITS["youtube/stems"]?.limit ?? 10,
      separate_hq: RATE_LIMITS["separate-hq"]?.limit ?? 2,
      stems_hq: RATE_LIMITS["stems-hq"]?.limit ?? 2,
      youtube_separate_hq: RATE_LIMITS["youtube/separate-hq"]?.limit ?? 2,
      youtube_stems_hq: RATE_LIMITS["youtube/stems-hq"]?.limit ?? 2,
      audio_to_midi: RATE_LIMITS["audio-to-midi"]?.limit ?? 5,
      audio_to_midi_hq: RATE_LIMITS["audio-to-midi-hq"]?.limit ?? 2,
      speech_to_text: RATE_LIMITS["speech-to-text"]?.limit ?? 2,
      video_to_text: RATE_LIMITS["video-to-text"]?.limit ?? 2,
      youtube_transcribe: RATE_LIMITS["youtube/transcribe"]?.limit ?? 2,
    },
    windows: {
      audio_to_midi: RATE_LIMITS["audio-to-midi"]?.windowSeconds ?? 300,
    },
    windowSeconds: 3600,
    sharedAllowances: SHARED_ALLOWANCES,
    retention: {
      separation: {
        inputDeletedWhen: "ttl",
        inputSeconds: 7200,
        outputSeconds: 7200,
        outputKind: "files",
      },
      audio_tools: {
        inputDeletedWhen: "job_end",
        inputSeconds: null,
        outputSeconds: 3600,
        outputKind: "file",
      },
      transcription: {
        inputDeletedWhen: "job_end",
        inputSeconds: null,
        outputSeconds: 3600,
        outputKind: "text",
      },
    },
    downloadCache: {
      scope: "per_video",
      keyedOn: ["video_id", "format"],
      maxAgeSeconds: 2592000,
      eviction: "lru",
      guaranteed: false,
      stores: "converted_audio",
    },
  };
}

const asNumber = (v: unknown, or: number) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : or;

/** Like asNumber, but NULL is a legitimate answer rather than a miss. */
const asNullableNumber = (v: unknown, or: number | null): number | null => {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return or;
};

const asStringList = (v: unknown, or: string[]): string[] => {
  if (!Array.isArray(v)) return or;
  const out = v.filter((x): x is string => typeof x === "string" && x.length > 0);
  return out.length ? out : or;
};

const asNumberMap = (v: unknown): Record<string, number> => {
  if (!v || typeof v !== "object") return {};
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).filter(
      ([, n]) => typeof n === "number" && Number.isFinite(n) && n > 0
    )
  ) as Record<string, number>;
};

function readRetention(raw: unknown, base: Retention): Retention {
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  const when = d.input_deleted_when;
  return {
    inputDeletedWhen: when === "ttl" || when === "job_end" ? when : base.inputDeletedWhen,
    inputSeconds: asNullableNumber(d.input_seconds, base.inputSeconds),
    outputSeconds: asNumber(d.output_seconds, base.outputSeconds),
    outputKind:
      d.output_kind === "file" || d.output_kind === "files" || d.output_kind === "text"
        ? d.output_kind
        : base.outputKind,
  };
}

function readDownloadCache(raw: unknown, base: DownloadCache): DownloadCache {
  if (!raw || typeof raw !== "object") return base;
  const block = (raw as Record<string, unknown>).download_cache;
  if (!block || typeof block !== "object") return base;
  const d = block as Record<string, unknown>;
  return {
    scope: typeof d.scope === "string" ? d.scope : base.scope,
    keyedOn: asStringList(d.keyed_on, base.keyedOn),
    maxAgeSeconds: asNumber(d.max_age_seconds, base.maxAgeSeconds),
    eviction: typeof d.eviction === "string" ? d.eviction : base.eviction,
    // Defaults to FALSE, not to `base`: an unreadable value must not let a page
    // promise a retention window the cache doesn't guarantee.
    guaranteed: d.guaranteed === true,
    stores: typeof d.stores === "string" ? d.stores : base.stores,
  };
}

function readJoin(raw: unknown, base: Limits["join"]): Limits["join"] {
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  return {
    maxFiles: asNumber(d.max_files, base.maxFiles),
    maxTotalMb: asNumber(d.max_total_mb, base.maxTotalMb),
    maxPerFileMb: asNumber(d.max_per_file_mb, base.maxPerFileMb),
  };
}

function readDurations(raw: unknown, base: Durations): Durations {
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  const perTool = asNumberMap(d.audio_tools_per_tool_seconds);
  return {
    audioToolsDefaultSeconds: asNumber(
      d.audio_tools_default_seconds,
      base.audioToolsDefaultSeconds
    ),
    // Replaced wholesale, not merged: a tool removed from the backend map has
    // gone back to the default, and merging keeps applying a dead cap.
    audioToolsPerToolSeconds: Object.keys(perTool).length
      ? perTool
      : base.audioToolsPerToolSeconds,
    exemptTools: asStringList(d.exempt_tools, base.exemptTools),
    videoExtractMaxSeconds: asNumber(d.video_extract_max_seconds, base.videoExtractMaxSeconds),
    youtubeDownloadMaxSeconds: asNumber(
      d.youtube_download_max_seconds,
      base.youtubeDownloadMaxSeconds
    ),
    joinMaxTotalSeconds: asNumber(d.join_max_total_seconds, base.joinMaxTotalSeconds),
    midiMinSeconds: asNumber(d.midi_min_seconds, base.midiMinSeconds),
    midiHqMinSeconds: asNumber(d.midi_hq_min_seconds, base.midiHqMinSeconds),
  };
}

/**
 * Parses `rate_limits.shared`.
 *
 * An entry missing a key, a route or a usable window is DROPPED rather than
 * patched with a guess: a pool the client half-understands would render a
 * confident wrong sentence. If nothing survives, the whole block falls back, so
 * a malformed payload shows the last known-good shape instead of silently
 * dropping the daily cap from every page.
 */
function readShared(raw: unknown, base: SharedAllowanceSpec[]): SharedAllowanceSpec[] {
  if (!Array.isArray(raw)) return base;

  const out: SharedAllowanceSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;

    const key = typeof d.key === "string" && d.key ? d.key : "";
    const routes = asStringList(d.routes, []);
    const windows = Array.isArray(d.windows)
      ? d.windows
          .map((w): SharedWindowSpec | null => {
            if (!w || typeof w !== "object") return null;
            const x = w as Record<string, unknown>;
            const maxRequests = asNumber(x.max_requests, 0);
            const windowSeconds = asNumber(x.window_seconds, 0);
            return maxRequests > 0 && windowSeconds > 0 ? { maxRequests, windowSeconds } : null;
          })
          .filter((w): w is SharedWindowSpec => w !== null)
      : [];

    if (!key || routes.length === 0 || windows.length === 0) continue;

    windows.sort((a, b) => a.windowSeconds - b.windowSeconds);
    out.push({
      key,
      routes,
      scope: typeof d.scope === "string" ? d.scope : "per_ip",
      windows,
    });
  }

  return out.length ? out : base;
}

export async function getLimits(): Promise<Limits> {
  const base = fallback();
  try {
    const res = await fetch(`${RAILWAY_API_BASE}/limits`, {
      // Was a day. Limits are read live on every request now and an operator
      // change lands in about a second, so a day-long ISR window would keep
      // serving the old number for a day after it stopped being true.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return base;
    const d = (await res.json()) as Record<string, unknown>;
    const f = (d.features ?? {}) as Record<string, unknown>;
    const r = (d.rate_limits ?? {}) as Record<string, unknown>;
    const ret = (d.retention ?? {}) as Record<string, unknown>;

    return {
      maxUploadMb: asNumber(d.max_upload_mb, base.maxUploadMb),
      maxVideoUploadMb: asNumber(d.max_video_upload_mb, base.maxVideoUploadMb),
      maxVideoTranscribeMb: asNumber(d.max_video_transcribe_mb, base.maxVideoTranscribeMb),
      // Nested under `join`, not top-level.
      join: readJoin(d.join, base.join),
      midiHqEnabled: Boolean(f.midi_hq_enabled),
      featureDurations: {
        midi: asNumber(f.midi_max_duration_seconds, base.featureDurations.midi),
        midiHq: asNumber(f.midi_hq_max_duration_seconds, base.featureDurations.midiHq),
        separationHq: asNumber(
          f.separation_hq_max_duration_seconds,
          base.featureDurations.separationHq
        ),
        transcription: asNumber(
          f.transcription_max_duration_seconds,
          base.featureDurations.transcription
        ),
      },
      durations: readDurations(d.durations, base.durations),
      allowedAudioFormats: asStringList(d.allowed_audio_formats, base.allowedAudioFormats),
      allowedVideoFormats: asStringList(d.allowed_video_formats, base.allowedVideoFormats),
      allowedMidiInputFormats: asStringList(
        d.allowed_midi_input_formats,
        base.allowedMidiInputFormats
      ),
      rateLimits: {
        ...base.rateLimits,
        ...Object.fromEntries(
          Object.entries(r)
            .filter(
              ([k, v]) =>
                k !== "window_seconds" &&
                k !== "windows" &&
                k !== "shared" &&
                typeof v === "number"
            )
            .map(([k, v]) => [k, v as number])
        ),
      },
      windows: { ...base.windows, ...asNumberMap(r.windows) },
      windowSeconds: asNumber(r.window_seconds, base.windowSeconds),
      sharedAllowances: readShared(r.shared, base.sharedAllowances),
      downloadCache: readDownloadCache(d.retention, base.downloadCache),
      retention: {
        separation: readRetention(ret.separation, base.retention.separation),
        audio_tools: readRetention(ret.audio_tools, base.retention.audio_tools),
        transcription: readRetention(ret.transcription, base.retention.transcription),
      },
    };
  } catch {
    return base;
  }
}

/**
 * The duration cap for one job tool in seconds, or NULL when it has none.
 * Exempt tools return null: a cap the client invents is as bad as one it omits.
 */
export function durationCapFor(limits: Limits, tool: string): number | null {
  if (limits.durations.exemptTools.includes(tool)) return null;
  return limits.durations.audioToolsPerToolSeconds[tool] ?? limits.durations.audioToolsDefaultSeconds;
}

/** The window for one tool, per-tool map first. Prefer over windowSeconds. */
export function windowFor(limits: Limits, tool: string): number {
  return limits.windows[tool] ?? limits.windowSeconds;
}

/** For an `accept` attribute: ".mp3,.wav,.flac". */
export function acceptAttribute(formats: string[]): string {
  return formats.map((f) => `.${f}`).join(",");
}

export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
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

/** The pool a route draws from, or NULL when it has its own bucket. */
export function sharedAllowanceFor(
  limits: Limits,
  route: string
): SharedAllowanceSpec | null {
  const want = normalizeRouteKey(route);
  return (
    limits.sharedAllowances.find((a) =>
      a.routes.some((r) => normalizeRouteKey(r) === want)
    ) ?? null
  );
}

/** "10 per hour, 30 per day". Every window the pool enforces, shortest first. */
export function sharedAllowanceLabel(allowance: SharedAllowanceSpec): string {
  return allowance.windows
    .map((w) => rateLimitLabel(w.maxRequests, w.windowSeconds))
    .join(", ");
}

/**
 * The complete limit label for a route.
 *
 * Reads the shared pool when the route is in one, so both windows show, and
 * falls back to the flat key otherwise. Use this anywhere a limit is displayed
 * rather than reading `rateLimits` directly — the flat keys hold one number and
 * quietly omit a second window.
 *
 * `route` is the backend path ("youtube/separate"), `flatKey` the flat
 * rate_limits key ("youtube_separate"); the two naming schemes do not overlap.
 */
export function limitLabelFor(limits: Limits, route: string, flatKey: string): string {
  const shared = sharedAllowanceFor(limits, route);
  if (shared) return sharedAllowanceLabel(shared);
  const max = limits.rateLimits[flatKey];
  return rateLimitLabel(max ?? 0, windowFor(limits, flatKey));
}

/**
 * "shared across the vocal remover, stem splitter and both YouTube tools" —
 * the sentence that stops a user reading a pool as a per-tool budget.
 *
 * Returns null for a route with its own bucket, so a caller can drop the clause
 * entirely rather than printing something empty.
 */
export function sharedPoolNote(limits: Limits, route: string): string | null {
  const shared = sharedAllowanceFor(limits, route);
  if (!shared || shared.routes.length < 2) return null;
  return `This allowance is shared across all ${shared.routes.length} separation tools, so a split on any one of them draws from the same total.`;
}

/**
 * The two sentences a retention FAQ needs, built from the shape.
 *
 * `input` and `output` are returned separately because they are different
 * facts; conflating them is what put a wrong deletion claim on /vocal-remover
 * for weeks.
 */
export function retentionSentences(r: Retention): { input: string; output: string } {
  const input =
    r.inputDeletedWhen === "job_end" || r.inputSeconds === null
      ? "Your upload is deleted as soon as processing finishes, not on a timer, and whether the job succeeded or failed."
      : `Your upload is kept for ${durationLabel(r.inputSeconds)}, then deleted automatically.`;

  const window = durationLabel(r.outputSeconds);

  const output =
    r.outputKind === "text"
      ? `The transcript is available for ${window}, then removed. Nothing is stored on disk afterwards.`
      : r.outputKind === "files"
        ? `The results are available to download for ${window}, then removed automatically.`
        : `The processed file is available to download for ${window}, then removed automatically.`;

  return { input, output };
}