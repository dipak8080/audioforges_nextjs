import { RATE_LIMITS } from "@/lib/data/rate-limits";
import { TOOL_LIMITS } from "@/lib/data/tool-limits";

/**
 * `GET /limits` — the backend's own account of every FREE-TIER limit.
 *
 * WHY THIS EXISTS
 *
 * lib/data/rate-limits.ts and lib/data/tool-limits.ts mirror backend config BY
 * HAND, are read from 22 places, and nothing verifies them. That drift has
 * already shipped five wrong numbers to users:
 *
 *   - /youtube-vocal-remover advertised 15-minute videos against a 10-minute
 *     cap, so people waited through a download on a paid residential proxy for
 *     a job that could never run
 *   - /audio-to-midi reported 3 per 5 min when the real allowance was 5
 *   - /download reported 15 per hour when it was 18
 *   - the four HQ keys said "1 per hour" when the API returned 2
 *   - /stems omitted AIFF from its format list while the tool accepted it
 *
 * Every one was the same bug and every one was found by accident. This makes
 * the backend the source and the tables the fallback.
 *
 * WHAT THIS IS NOT
 *
 * /limits is static and cacheable precisely BECAUSE it does not know who is
 * asking. It carries free-tier numbers only. A credit holder gets 30/hour where
 * free gets 2, and the only thing that knows which applies is
 * `rate_limit.tools` on GET /credits/me — so client forms keep calling
 * rateLimitFor() and treat anything here as the free-tier fallback.
 *
 * COST: server-side only, `revalidate: 3600`, and it changes solely on
 * redeploy. Zero client requests, same pattern as getFeatureFlags(). Never
 * import this into a client component — see the Footer incident in
 * FRONTEND_ARCHITECTURE.md §7.2.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * Absorbs everything the backend published on 2026-08-30.
 *
 * 1. DURATION CAPS, and the one that is live right now. The per-tool overrides
 *    for pitch and tempo sat in config with NO READERS for weeks — every tool
 *    silently took the 3600 fallback, so those 900s entries were decoration.
 *    They were wired up this morning, which means pitch and tempo dropped from
 *    an hour to fifteen minutes TODAY. Any page still saying an hour is now
 *    rejecting real uploads it promised to accept.
 *
 * 2. `exempt_tools` MATTERS MORE THAN IT LOOKS. /convert has no duration cap at
 *    all — it is the only caller anywhere passing check_duration=False.
 *    Applying the 3600 fallback to it would reject uploads the server would
 *    happily take. A cap the client invents is as bad as one it omits, so
 *    durationCapFor() returns null for an exempt tool rather than a number.
 *
 * 3. THREE FORMAT LISTS, not one. Video and MIDI were both enforced and
 *    neither was published — the exact mechanism that let /stems omit AIFF.
 *    Bare lowercase extensions, no dots, no MIME types.
 *
 * 4. FOUR UPLOAD CAPS, not two. max_upload_mb does NOT cover video: 80 audio,
 *    200 /video-to-audio, 100 /video-to-text, and /join is 150 total with the
 *    per-file 80 still applying to each. A page showing one number for two of
 *    those routes is wrong for one of them.
 *
 * 5. STATUS POLLS ARE UNAUTHENTICATED. Confirmed by reading every handler:
 *    _tool_status takes no identity parameter, and HQ jobs share the standard
 *    status routes. The warning comment in railway.ts about /audio-to-midi-hq
 *    possibly scoping by subject can be deleted — it doesn't.
 */

const RAILWAY_API_BASE =
  process.env.NEXT_PUBLIC_RAILWAY_API_BASE || "https://api.audioforges.com";

/**
 * Which retention shape a tool follows. Three, and they are genuinely
 * different sentences — see retentionSentences().
 */
export type RetentionShape = "separation" | "audio_tools" | "transcription";

/**
 * THE DOWNLOAD CACHE — a fourth retention shape, and the only one that isn't
 * about a user's file.
 *
 * It gets its own type rather than joining Retention because the input/output
 * pair is meaningless here: /download takes a URL, not an upload, so
 * `inputDeletedWhen` would describe something that never happened. What's
 * stored is converted audio derived from a public video — nobody's file.
 *
 * `guaranteed` is the field that decides the sentence. The cache is
 * LRU-evicted against a size cap, so maxAgeSeconds is a CEILING, not a
 * promise: a rarely-requested entry can vanish long before it. "Up to 30 days"
 * is honest; "for 30 days" is not. Read this flag before writing either.
 */
export interface DownloadCache {
  /** "per_video" means one person's conversion serves the next person's
   *  request for the same URL and format. No visitor identity in the key. */
  scope: string;
  keyedOn: string[];
  maxAgeSeconds: number;
  eviction: string;
  /** FALSE when entries can be evicted early — say "up to", never "for". */
  guaranteed: boolean;
  stores: string;
}

export interface Retention {
  /**
   * "job_end" means the upload is gone the moment the job finishes — win,
   * lose, or killed by a redeploy. "ttl" means it is held for `inputSeconds`.
   * Separation is the only shape that uses "ttl", and only so the one-click
   * Studio Quality re-run works without a second upload.
   */
  inputDeletedWhen: "job_end" | "ttl";
  /**
   * NULL, not 0, when inputDeletedWhen is "job_end". The distinction is the
   * whole point: 0 would render as "deleted after zero seconds", which is
   * nonsense. Null means "no timer applies — say the other sentence".
   */
  inputSeconds: number | null;
  outputSeconds: number;
  /**
   * "text" is transcription: the result is inline in the job record, so
   * nothing sits on disk after processing at all. "Your file is available for
   * an hour" is the wrong sentence for a transcript.
   */
  outputKind: "file" | "files" | "text";
}

export interface Durations {
  /** Applies to any job tool without its own entry, and NOT to exempt tools. */
  audioToolsDefaultSeconds: number;
  /**
   * Overrides. A tool MISSING from here is not an omission — it takes the
   * default. Same shape _validate_duration_or_reject uses, so there is no
   * flattened per-tool list to drift.
   */
  audioToolsPerToolSeconds: Record<string, number>;
  /**
   * Tools with NO duration check at all. Currently just /convert, which is the
   * only route passing check_duration=False. Read this before applying the
   * default or you invent a cap the server doesn't have.
   */
  exemptTools: string[];
  videoExtractMaxSeconds: number;
  /**
   * The DOWNLOADER's cap, governing /download and every /youtube/* chained
   * tool. Named without "transcribe" on purpose: it lived in the frontend's
   * TRANSCRIPTION_LIMITS for months, which is a different subsystem, and the
   * name is what stops it drifting back there.
   *
   * Not the binding cap on most /youtube/* pages — separation caps at 600 and
   * transcription at 1200, and the SMALLER of a stacked pair is the one a user
   * actually hits. It IS binding on /youtube-to-wav and /youtube-to-mp3, where
   * nothing downstream refuses on length.
   */
  youtubeDownloadMaxSeconds: number;
  /** TOTAL across every file in one /join request, not per file. */
  joinMaxTotalSeconds: number;
  /** Lower bounds — the only ones on the site. Below this there isn't enough
   *  signal and the result is a guaranteed empty MIDI. */
  midiMinSeconds: number;
  midiHqMinSeconds: number;
}

export interface Limits {
  /** Upload ceiling for ordinary audio routes, in MB. */
  maxUploadMb: number;
  /** /video-to-audio. Higher than the transcribe cap — different route, different rule. */
  maxVideoUploadMb: number;
  /**
   * /video-to-text caps LOWER than the general video upload limit, because a
   * 200MB video is almost certainly past the duration cap and accepting the
   * upload only to reject it wastes the whole transfer. Use this on that route
   * and nowhere else.
   */
  maxVideoTranscribeMb: number;
  /**
   * /join's four caps, published together under `join` because they are facets
   * of one request shape rather than four unrelated numbers.
   *
   * BOTH "total" FIGURES REJECT INDEPENDENTLY, and neither is implied by the
   * other or by the per-file cap: ten 20MB files pass maxPerFileMb and fail
   * maxTotalMb; ten four-minute tracks pass any per-file duration intuition
   * and fail durations.joinMaxTotalSeconds at forty minutes combined. A page
   * that states only one of them is wrong about the other.
   */
  join: {
    maxFiles: number;
    maxTotalMb: number;
    /** Applies to each file separately. NOT derivable from maxTotalMb, which
     *  is why the backend publishes it rather than leaving it implied. */
    maxPerFileMb: number;
  };
  /**
   * Kill switch for the multi-track MIDI tool. FALSE means the route returns
   * 503 — hide the option entirely.
   *
   * This is a DIFFERENT question from paywall_tools["audio-to-midi-hq"], which
   * answers whether it costs a credit. Tying them together made turning off
   * charging hide the tool instead of making it free.
   */
  midiHqEnabled: boolean;
  /** Seconds. Read per route — the tiers genuinely differ. */
  featureDurations: {
    midi: number;
    midiHq: number;
    separationHq: number;
    transcription: number;
  };
  /** Caps for the ordinary job tools. See durationCapFor(). */
  durations: Durations;
  /** Bare lowercase extensions, no dots. `.${fmt}` for an accept attribute,
   *  bare for display. */
  allowedAudioFormats: string[];
  /** Only /video-to-audio and /video-to-text take these, and no endpoint
   *  outputs one — which is why they're a separate list rather than folded in. */
  allowedVideoFormats: string[];
  /** The audio set plus opus and webm. Published complete so it can be
   *  rendered directly rather than reconstructed. */
  allowedMidiInputFormats: string[];
  /** Free-tier max requests per window, keyed as the backend names them. */
  rateLimits: Record<string, number>;
  /**
   * Per-tool windows, keyed as the backend names them. Prefer this over
   * `windowSeconds` — see windowFor(). The flat value was wrong for
   * /audio-to-midi, which is what prompted the backend to publish this map.
   */
  windows: Record<string, number>;
  /** Legacy flat window. Correct for everything except the keys in `windows`,
   *  and kept so nothing breaks mid-migration. */
  windowSeconds: number;
  /** How long uploads and results are kept, by shape. */
  retention: Record<RetentionShape, Retention>;
  /** The /download cache. Not a Retention — see DownloadCache. */
  downloadCache: DownloadCache;
}

/**
 * Fail-closed defaults, read from the hand-maintained tables so a backend blip
 * shows today's numbers rather than blanks or zeroes. A page rendering "up to 0
 * minutes" would be worse than a slightly stale figure.
 *
 * The retention and duration defaults are the values confirmed on 2026-08-30
 * and pinned in .env rather than sitting on framework defaults. Retention
 * figures are privacy claims, so a fallback that quietly understates a TTL
 * would be worse than one that understates a rate limit.
 */
function fallback(): Limits {
  return {
    maxUploadMb: 80,
    maxVideoUploadMb: 200,
    maxVideoTranscribeMb: 100,
    join: { maxFiles: 10, maxTotalMb: 150, maxPerFileMb: 80 },
    // Fails closed: an unreachable backend hides the paid tool rather than
    // offering something that would 503.
    midiHqEnabled: false,
    featureDurations: {
      midi: TOOL_LIMITS["audio-to-midi"]?.maxTotalDurationSeconds ?? 600,
      midiHq: TOOL_LIMITS["audio-to-midi-hq"]?.maxTotalDurationSeconds ?? 600,
      separationHq: TOOL_LIMITS["separate-hq"]?.maxTotalDurationSeconds ?? 600,
      transcription: 1200,
    },
    durations: {
      audioToolsDefaultSeconds: 3600,
      // 900 for both, wired up on the backend 2026-08-30. Before that morning
      // these entries existed and had no readers, so every tool took the 3600
      // fallback — which is why a page saying "an hour" was right yesterday
      // and rejects real uploads today.
      audioToolsPerToolSeconds: { pitch: 900, tempo: 900 },
      // /convert alone. Inventing a cap here rejects uploads the server takes.
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
      audio_to_midi: RATE_LIMITS["audio-to-midi"]?.limit ?? 5,
      audio_to_midi_hq: RATE_LIMITS["audio-to-midi-hq"]?.limit ?? 2,
      speech_to_text: RATE_LIMITS["speech-to-text"]?.limit ?? 2,
      video_to_text: RATE_LIMITS["video-to-text"]?.limit ?? 2,
      youtube_transcribe: RATE_LIMITS["youtube/transcribe"]?.limit ?? 2,
    },
    // Seeded from the hand table for the one key the flat window was wrong
    // about, so even the fallback stops publishing /audio-to-midi as hourly.
    windows: {
      audio_to_midi: RATE_LIMITS["audio-to-midi"]?.windowSeconds ?? 300,
    },
    windowSeconds: 3600,
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

/**
 * Like asNumber, but NULL is a legitimate answer rather than a miss.
 *
 * `input_seconds: null` means "no timer applies — the upload is deleted when
 * the job ends". Running that through asNumber would substitute a number and
 * turn a correct sentence into a false one, which on a retention claim is the
 * expensive direction to be wrong in.
 */
const asNullableNumber = (v: unknown, or: number | null): number | null => {
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return or;
};

/** Bare lowercase extensions only. Anything else in the array is dropped
 *  rather than rendered as a broken accept token. */
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
    // Defaults to FALSE, not to `base`: an unreadable value must not let a
    // page promise a retention window the cache doesn't guarantee.
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
    // Replaced wholesale, not merged. A tool REMOVED from the backend map has
    // gone back to the default, and merging would keep applying a cap that no
    // longer exists.
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

export async function getLimits(): Promise<Limits> {
  const base = fallback();
  try {
    const res = await fetch(`${RAILWAY_API_BASE}/limits`, {
      // Changes only on redeploy, so an hour is generous rather than risky.
      next: { revalidate: 3600 },
      // Without a deadline, a VPS that accepts the connection but never answers
      // blocks the whole server render and burns Vercel function duration.
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
      // NESTED under `join`, not top-level. It has been published this way all
      // along; a grep for "max_join_files" finds nothing because the key is
      // `join.max_files`.
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
            // `windows` is an object and `window_seconds` is the flat legacy
            // value — neither belongs in the per-tool max map.
            .filter(([k, v]) => k !== "window_seconds" && k !== "windows" && typeof v === "number")
            .map(([k, v]) => [k, v as number])
        ),
      },
      windows: { ...base.windows, ...asNumberMap(r.windows) },
      windowSeconds: asNumber(r.window_seconds, base.windowSeconds),
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
 * The duration cap for one job tool, in seconds, or NULL when it has none.
 *
 * READ THIS RATHER THAN THE DEFAULT DIRECTLY. Three cases, and the third is
 * the one that bites:
 *
 *   · exempt   → null. /convert passes check_duration=False, so a cap applied
 *                here would reject uploads the server accepts. A cap the
 *                client invents is as bad as one it omits.
 *   · override → the per-tool value. pitch and tempo are 900 as of 2026-08-30,
 *                down from the 3600 they silently took while the overrides had
 *                no readers.
 *   · missing  → the default. Absence from the map is the answer, not a gap.
 */
export function durationCapFor(limits: Limits, tool: string): number | null {
  if (limits.durations.exemptTools.includes(tool)) return null;
  return limits.durations.audioToolsPerToolSeconds[tool] ?? limits.durations.audioToolsDefaultSeconds;
}

/**
 * The window for one tool, per-tool map first.
 *
 * ALWAYS PREFER THIS over reading `windowSeconds` directly. The flat value is
 * correct for most routes and wrong for the ones that have their own entry —
 * /audio-to-midi is 5 per 5 minutes and the flat value said hourly, which is
 * exactly why the map exists.
 */
export function windowFor(limits: Limits, tool: string): number {
  return limits.windows[tool] ?? limits.windowSeconds;
}

/** For an `accept` attribute: ".mp3,.wav,.flac". Bare extensions are for
 *  display; the dots belong only here. */
export function acceptAttribute(formats: string[]): string {
  return formats.map((f) => `.${f}`).join(",");
}

/**
 * "2 hours" / "10 minutes" / "90 seconds". Derived, so a cap change can't leave
 * prose stale.
 *
 * THE HOUR BRANCH IS NOT COSMETIC. Every duration-cap caller passes 20 minutes
 * or less, so minutes were always right. Retention passes 3600 and 7200 — and
 * without this the copy read "your upload is kept for 120 minutes", which is
 * accurate, unidiomatic, and reads like a machine filled in a template. On a
 * privacy answer that is the wrong impression to give.
 */
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** "5 per hour" / "2 per 5 minutes". Same shape getRateLimitLabel produced. */
export function rateLimitLabel(max: number, windowSeconds: number): string {
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

/**
 * The two sentences a retention FAQ needs, built from the shape.
 *
 * WHY A HELPER AND NOT PROSE ON EACH PAGE
 *
 * The wrong version of this answer sat on /vocal-remover for weeks: it said
 * uploads were deleted when processing finished, while a feature on the same
 * page depended on them being kept for two hours. It was written from
 * assumption, and it was only caught by reading the upgrade component's
 * docstring.
 *
 * Twenty pages typing that sentence by hand is twenty chances to repeat it.
 * One function, fed by the backend's own numbers, is one.
 *
 * Returns `input` and `output` separately because they are different facts and
 * conflating them is the specific mistake that caused the original error. A
 * page can join them with a space; nothing here decides that.
 */
export function retentionSentences(r: Retention): { input: string; output: string } {
  const input =
    r.inputDeletedWhen === "job_end" || r.inputSeconds === null
      ? "Your upload is deleted as soon as processing finishes — not on a timer, and whether the job succeeded or failed."
      : `Your upload is kept for ${durationLabel(r.inputSeconds)}, then deleted automatically.`;

  const window = durationLabel(r.outputSeconds);

  // "text" is the transcription case: the result lives inline in the job
  // record, so there is no file sitting on disk to describe. Saying "your file
  // is available for an hour" about a transcript is wrong in a way nobody
  // would notice until someone went looking for the file.
  const output =
    r.outputKind === "text"
      ? `The transcript is available for ${window}, then removed. Nothing is stored on disk afterwards.`
      : r.outputKind === "files"
        ? `The results are available to download for ${window}, then removed automatically.`
        : `The processed file is available to download for ${window}, then removed automatically.`;

  return { input, output };
}