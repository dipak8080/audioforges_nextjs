import { RATE_LIMITS } from "@/lib/data/rate-limits";
import { TOOL_LIMITS } from "@/lib/data/tool-limits";

/**
 * `GET /limits` — the backend's own account of every FREE-TIER limit.
 *
 * WHY THIS EXISTS
 *
 * lib/data/rate-limits.ts and lib/data/tool-limits.ts mirror backend config BY
 * HAND, are read from 22 places, and nothing verifies them. That drift has
 * already shipped four wrong numbers to users:
 *
 *   - /youtube-vocal-remover advertised 15-minute videos against a 10-minute
 *     cap, so people waited through a download on a paid residential proxy for
 *     a job that could never run
 *   - /audio-to-midi reported 3 per 5 min when the real allowance was 5
 *   - /download reported 15 per hour when it was 18
 *   - the four HQ keys said "1 per hour" when the API returned 2
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
 */

const RAILWAY_API_BASE =
  process.env.NEXT_PUBLIC_RAILWAY_API_BASE || "https://api.audioforges.com";

export interface Limits {
  /** Upload ceiling for ordinary audio routes, in MB. */
  maxUploadMb: number;
  /**
   * /video-to-text caps LOWER than the general video upload limit, because a
   * 200MB video is almost certainly past the duration cap and accepting the
   * upload only to reject it wastes the whole transfer. Use this on that route
   * and nowhere else.
   */
  maxVideoTranscribeMb: number;
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
  durations: {
    midi: number;
    midiHq: number;
    separationHq: number;
    transcription: number;
  };
  /** Free-tier max requests per window, keyed as the backend names them. */
  rateLimits: Record<string, number>;
  windowSeconds: number;
}

/**
 * Fail-closed defaults, read from the hand-maintained tables so a backend blip
 * shows today's numbers rather than blanks or zeroes. A page rendering "up to 0
 * minutes" would be worse than a slightly stale figure.
 */
function fallback(): Limits {
  return {
    maxUploadMb: 80,
    maxVideoTranscribeMb: 100,
    // Fails closed: an unreachable backend hides the paid tool rather than
    // offering something that would 503.
    midiHqEnabled: false,
    durations: {
      midi: TOOL_LIMITS["audio-to-midi"]?.maxTotalDurationSeconds ?? 600,
      midiHq: TOOL_LIMITS["audio-to-midi-hq"]?.maxTotalDurationSeconds ?? 600,
      separationHq: TOOL_LIMITS["separate-hq"]?.maxTotalDurationSeconds ?? 600,
      transcription: 1200,
    },
    rateLimits: {
      audio_to_midi: RATE_LIMITS["audio-to-midi"]?.limit ?? 5,
      audio_to_midi_hq: RATE_LIMITS["audio-to-midi-hq"]?.limit ?? 2,
      speech_to_text: RATE_LIMITS["speech-to-text"]?.limit ?? 2,
      video_to_text: RATE_LIMITS["video-to-text"]?.limit ?? 2,
      youtube_transcribe: RATE_LIMITS["youtube/transcribe"]?.limit ?? 2,
    },
    windowSeconds: 3600,
  };
}

const asNumber = (v: unknown, or: number) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : or;

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

    return {
      maxUploadMb: asNumber(d.max_upload_mb, base.maxUploadMb),
      maxVideoTranscribeMb: asNumber(d.max_video_transcribe_mb, base.maxVideoTranscribeMb),
      midiHqEnabled: Boolean(f.midi_hq_enabled),
      durations: {
        midi: asNumber(f.midi_max_duration_seconds, base.durations.midi),
        midiHq: asNumber(f.midi_hq_max_duration_seconds, base.durations.midiHq),
        separationHq: asNumber(
          f.separation_hq_max_duration_seconds,
          base.durations.separationHq
        ),
        transcription: asNumber(
          f.transcription_max_duration_seconds,
          base.durations.transcription
        ),
      },
      rateLimits: {
        ...base.rateLimits,
        ...Object.fromEntries(
          Object.entries(r)
            .filter(([k, v]) => k !== "window_seconds" && typeof v === "number")
            .map(([k, v]) => [k, v as number])
        ),
      },
      windowSeconds: asNumber(r.window_seconds, base.windowSeconds),
    };
  } catch {
    return base;
  }
}

/** "10 minutes" / "90 seconds". Derived, so a cap change can't leave prose stale. */
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
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