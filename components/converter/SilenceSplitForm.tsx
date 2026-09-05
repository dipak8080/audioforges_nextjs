"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListMusic, Loader2 } from "lucide-react";
import { MultiOutputToolForm } from "@/components/converter/MultiOutputToolForm";
import { ThresholdMeter } from "@/components/converter/ThresholdMeter";
import { ControlField, Hint, OptionCards, Stepper, type CardOption } from "@/components/converter/ToolControls";
import { WaveformCanvas } from "@/components/ui/WaveformCanvas";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getToolLimits } from "@/lib/data/tool-limits";
import { computeWaveformEnvelopeAsync, type WaveformEnvelope } from "@/lib/utils/waveform";
import {
  computeDbTimelineAsync,
  findQuietRanges,
  findAudibleSegments,
  type DbTimeline,
} from "@/lib/utils/silenceDetection";
import { submitJob } from "@/lib/api/railway";
import { cn } from "@/lib/utils/cn";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE PREVIEW PROMISED TRACKS THE BACKEND WILL NEVER RETURN. It counted
 *    every audible stretch between gaps, while the backend drops any segment
 *    under SILENCE_SPLIT_MIN_SEGMENT_SECONDS (1.0s) and caps the whole run at
 *    SILENCE_SPLIT_MAX_SEGMENTS (50). Both numbers are already in TOOL_LIMITS.
 *    So on a track with lots of short bursts — applause, drum hits, a noisy
 *    room — the preview happily said "would produce 68 tracks" and the run
 *    came back with something else entirely. The preview is the whole reason
 *    this tool has settings, and it was answering a different question from
 *    the one the server answers.
 *
 *    Segments under the floor are now excluded from the count and the list,
 *    and going over the ceiling says so before you spend a run on it.
 *
 * 2. "No qualifying gaps found — this would produce a single track" WAS ALSO
 *    THE ZERO CASE. Push the threshold to -10 dB on a quiet recording and
 *    every segment falls below the floor, so the real answer is "nothing would
 *    come back", which is the opposite of one track. Separate branch.
 *
 * 3. THE RATE LIMIT WAS TYPED INTO THE COPY. "3 splits per 5 minutes" happens
 *    to match config.py today, which is luck rather than design — the same
 *    sentence in PitchForm was two attempts short for months. Read from
 *    RATE_LIMITS.
 *
 * 4. FLOATING-POINT DRIFT IN THE SUBMITTED VALUE. The range steps by 0.1 from
 *    0.1, so `min_duration_seconds` could be posted as 0.30000000000000004.
 *    The header hid it behind toFixed(1); the request body did not.
 *
 * 5. AN AudioContext PER FILE, a fake radiogroup on the format picker, and two
 *    more arrow buttons announcing "Increase" with no context.
 */

interface FormatSpec {
  quality: "Lossless" | "Compressed";
  detail: string;
}

// Same copy as ConvertForm/JoinForm's format specs — worth centralizing
// into one shared constant now that a third tool needs it.
const FORMAT_SPECS: Record<string, FormatSpec> = {
  wav: { quality: "Lossless", detail: "Uncompressed" },
  aiff: { quality: "Lossless", detail: "Uncompressed" },
  flac: { quality: "Lossless", detail: "~50% smaller, no loss" },
  mp3: { quality: "Compressed", detail: "320 kbps" },
  m4a: { quality: "Compressed", detail: "AAC container" },
  aac: { quality: "Compressed", detail: "Smaller than MP3" },
  ogg: { quality: "Compressed", detail: "Open format" },
};

const FORMAT_OPTIONS: CardOption<string>[] = Object.entries(FORMAT_SPECS).map(([fmt, spec]) => ({
  value: fmt,
  title: fmt,
  detail: spec.detail,
}));

// Mirrors the backend's SILENCE_THRESHOLD_MIN_DB/MAX_DB and
// SILENCE_MIN_DURATION_SECONDS/MAX_SECONDS bounds — kept as plain
// constants here (not fetched) since these are fixed validation ranges,
// not something that changes at runtime the way the HQ flag does.
const THRESHOLD_MIN_DB = -90;
const THRESHOLD_MAX_DB = -10;
const THRESHOLD_DEFAULT = -30;
const MIN_DURATION_MIN = 0.1;
const MIN_DURATION_MAX = 10;
const MIN_DURATION_DEFAULT = 0.5;
const GAP_STEP = 0.1;
// Mirrors SILENCE_SPLIT_MIN_SEGMENT_SECONDS / SILENCE_SPLIT_MIN_SEGMENT_MAX_SECONDS.
const MIN_SEGMENT_MAX = 600;
const SEGMENT_STEP = 1;

/** The two rules the SERVER applies to the segment list, which the preview
 *  used to ignore. Read from TOOL_LIMITS rather than restated. */
const SPLIT_LIMITS = getToolLimits("silence-split");
const MAX_SEGMENTS = SPLIT_LIMITS?.maxOutputSegments ?? 50;
const MIN_SEGMENT_SECONDS = SPLIT_LIMITS?.minOutputSegmentSeconds ?? 1;

const RATE_LIMIT_LABEL = getRateLimitLabel("silence-split");

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Snaps to a tenth and refuses NaN. The range input's own output needs this:
 *  stepping by 0.1 from 0.1 produces 0.30000000000000004. */
function normalizeGap(value: number, fallback = MIN_DURATION_DEFAULT): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(clamp(value, MIN_DURATION_MIN, MIN_DURATION_MAX) * 10) / 10;
}

function normalizeSegment(value: number, fallback = MIN_SEGMENT_SECONDS): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(clamp(value, MIN_SEGMENT_SECONDS, MIN_SEGMENT_MAX));
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

/**
 * One AudioContext for the page, created on first use, never closed. Chrome
 * throws past six per document and construction opens an audio device.
 */
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

/* ------------------------------------------------------------------ */
/* Live split preview — decodes once, re-derives boundaries on the fly  */
/* ------------------------------------------------------------------ */

function SplitPreview({
  file,
  thresholdDb,
  minDuration,
  minSegment,
}: {
  file: File;
  thresholdDb: number;
  minDuration: number;
  minSegment: number;
}) {
  const [duration, setDuration] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<WaveformEnvelope | null>(null);
  const [timeline, setTimeline] = useState<DbTimeline | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        // The shared context, not one built and closed per file.
        const buffer = await getAudioContext().decodeAudioData(arrayBuffer);
        if (cancelled) return;
        setDuration(buffer.duration);
        // Both passes are sliced so a long file can't block the page
        // — see lib/utils/scheduling. The waveform lands first so
        // there's something to look at while the dB scan finishes.
        const nextEnvelope = await computeWaveformEnvelopeAsync(buffer, undefined, abort.signal);
        if (!cancelled) setEnvelope(nextEnvelope);
        const nextTimeline = await computeDbTimelineAsync(buffer, abort.signal);
        if (!cancelled) setTimeline(nextTimeline);
      } catch {
        // An abort lands here too, and is silent: cancelled is already
        // true, so nothing is written.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [file]);

  /* Memoized so the isSelected callback below stays referentially
     stable — an inline recompute would hand the canvas a new function
     every render and redraw the whole waveform for nothing. */
  const quietRanges = useMemo(
    () => (timeline ? findQuietRanges(timeline, thresholdDb, minDuration) : []),
    [timeline, thresholdDb, minDuration]
  );

  /* The segments the SERVER would actually return. findAudibleSegments gives
     every audible stretch; the backend then drops anything shorter than
     SILENCE_SPLIT_MIN_SEGMENT_SECONDS. Counting the unfiltered list is what
     made this preview promise tracks that never arrived. */
  const segments = useMemo(() => {
    if (duration === null) return [];
    return findAudibleSegments(duration, quietRanges).filter(
      (seg) => seg.endSeconds - seg.startSeconds >= minSegment
    );
  }, [duration, quietRanges, minSegment]);

  /* Audio that survives as a track is highlighted; the gaps that get
     cut away render grey. */
  const isKept = useCallback(
    (time: number) =>
      segments.some((seg) => time >= seg.startSeconds && time <= seg.endSeconds),
    [segments]
  );

  const overCap = segments.length > MAX_SEGMENTS;

  if (failed) {
    return (
      <p className="text-xs text-text-subtle">
        Couldn&apos;t analyze this file for a live preview — splitting still runs normally.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Preview — where it would split</span>
        {duration !== null && (
          <span className="font-mono text-xs tabular-nums text-text-subtle">
            {formatTime(duration)} total
          </span>
        )}
      </div>

      <div className="relative h-24 overflow-hidden rounded-xl border border-graphite-700 bg-graphite-850">
        {duration === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-text-subtle">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            Analyzing track…
          </div>
        ) : (
          <>
            <WaveformCanvas
              envelope={envelope}
              duration={duration}
              start={0}
              end={duration}
              isSelected={timeline ? isKept : undefined}
              className="absolute inset-0 block"
            />

            {/* Split-point markers at each kept segment's start */}
            {segments.map((seg, i) => (
              <div
                key={`marker-${i}`}
                className="pointer-events-none absolute inset-y-0 w-px bg-amber-400"
                style={{ left: `${(seg.startSeconds / duration) * 100}%` }}
              />
            ))}

            {!timeline && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-text-subtle">
                Scanning for silence gaps…
              </div>
            )}
          </>
        )}
      </div>

      {duration !== null && timeline && (
        <>
          {segments.length === 0 ? (
            /* Distinct from "one track". At a high threshold on a quiet
               recording every stretch falls under the length floor, and the
               honest answer is that nothing comes back at all. */
            <Hint tone="warn">
              Nothing would survive at these settings — every stretch is shorter than{" "}
              {minSegment}s once the gaps are cut. Lower the threshold, raise the minimum gap,
              or lower the minimum track length.
            </Hint>
          ) : segments.length === 1 ? (
            <Hint tone="warn">
              No qualifying gaps found — this would produce a single track. Try a higher threshold
              or a shorter minimum gap.
            </Hint>
          ) : (
            <>
              <p className="text-[11px] text-text-subtle">
                About {overCap ? MAX_SEGMENTS : segments.length} tracks at these settings
                {minSegment > 0 ? `, ignoring anything under ${minSegment}s` : ""}.
              </p>
              {overCap && (
                <Hint tone="warn">
                  This would produce over {MAX_SEGMENTS} tracks, so the shortest gaps will be
                  merged automatically to fit the {MAX_SEGMENTS}-track limit. Raise the minimum
                  gap or minimum track length to control which cuts survive.
                </Hint>
              )}
            </>
          )}

          {segments.length > 1 && (
            <div className="max-h-40 divide-y divide-graphite-800 overflow-y-auto rounded-xl border border-graphite-700">
              {segments.slice(0, MAX_SEGMENTS).map((seg, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <ListMusic className="h-3.5 w-3.5 shrink-0 text-text-subtle" aria-hidden />
                  <span className="w-16 shrink-0 text-text-muted">Track {i + 1}</span>
                  <span className="flex-1 font-mono text-text-subtle">
                    {formatTime(seg.startSeconds)}–{formatTime(seg.endSeconds)}
                  </span>
                  <span className="shrink-0 font-mono text-text-subtle">
                    {formatTime(seg.endSeconds - seg.startSeconds)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function SilenceSplitForm() {
  const [format, setFormat] = useState("mp3");
  const [thresholdDb, setThresholdDb] = useState(THRESHOLD_DEFAULT);
  const [minDurationSeconds, setMinDurationSeconds] = useState(MIN_DURATION_DEFAULT);
  const [minSegmentSeconds, setMinSegmentSeconds] = useState(MIN_SEGMENT_SECONDS);

  const setGap = (v: number) => setMinDurationSeconds(normalizeGap(v, minDurationSeconds));
  const setSegment = (v: number) => setMinSegmentSeconds(normalizeSegment(v, minSegmentSeconds));

  return (
    <MultiOutputToolForm
      endpoint="silence-split"
      queryParam="segment"
      onSubmit={(file) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("target_format", format);
        fd.append("threshold_db", String(thresholdDb));
        fd.append("min_duration_seconds", String(minDurationSeconds));
        fd.append("min_segment_seconds", String(minSegmentSeconds));
        return submitJob("silence-split", fd, 30_000);
      }}
      pollIntervalMs={3_000}
      toolLabel="Silence splitter"
      toolMeta={`${thresholdDb} dB · ${minDurationSeconds.toFixed(1)}s+`}
      submitLabel="Split into tracks"
      processingLabel="Detecting silence and splitting"
      expectedRange="a few seconds to a couple minutes"
      resultVerb="Split"
      stages={[
        { at: 0, label: "Scanning for silence gaps" },
        { at: 5, label: "Cutting into segments" },
        { at: 15, label: "Encoding each track" },
        { at: 30, label: "Packaging the results" },
      ]}
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `You've reached the limit (${RATE_LIMIT_LABEL}). Try again shortly.`
          : undefined
      }
      renderControls={(file, disabled) => (
        <div className="space-y-5">
          {file ? (
            <SplitPreview
              file={file}
              thresholdDb={thresholdDb}
              minDuration={minDurationSeconds}
              minSegment={minSegmentSeconds}
            />
          ) : (
            <p className="text-xs text-text-subtle">
              Upload a file to preview exactly where it would split.
            </p>
          )}

          <ControlField as="fieldset" label="Output format">
            <OptionCards
              label="Output format"
              options={FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
              columns={4}
              disabled={disabled}
              mono
            />
          </ControlField>

          <ControlField
            as="fieldset"
            label="Silence threshold"
            meta={<span className="text-[13px] font-semibold text-amber-400">{thresholdDb} dB</span>}
            hint={`Lower (toward ${THRESHOLD_MIN_DB} dB) catches quieter background noise as silence too. Higher (toward ${THRESHOLD_MAX_DB} dB) only cuts near-total silence.`}
          >
            <ThresholdMeter
              value={thresholdDb}
              min={THRESHOLD_MIN_DB}
              max={THRESHOLD_MAX_DB}
              defaultValue={THRESHOLD_DEFAULT}
              disabled={disabled || !file}
              onChange={setThresholdDb}
            />
          </ControlField>

          <ControlField
            as="fieldset"
            label="Minimum gap length"
            meta={
              <Stepper
                label="Minimum gap"
                value={minDurationSeconds}
                step={GAP_STEP}
                bigStep={GAP_STEP}
                precision={1}
                unit="s"
                disabled={disabled || !file}
                onChange={setGap}
              />
            }
            hint="How long a quiet stretch must last before it counts as a split point — shorter values cut on brief pauses too, longer values only cut long gaps."
          >
            {/* Native range for the same reason as SilenceRemoveForm:
                ThresholdMeter rounds to whole numbers, which would quantise
                this to 1-second steps. */}
            <input
              type="range"
              min={MIN_DURATION_MIN}
              max={MIN_DURATION_MAX}
              step={GAP_STEP}
              value={minDurationSeconds}
              onChange={(e) => setGap(Number(e.target.value))}
              disabled={disabled || !file}
              className={cn(
                "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-graphite-700",
                "accent-amber-500 disabled:opacity-40"
              )}
              aria-label="Minimum silence gap duration in seconds"
            />
          </ControlField>

          <ControlField
            as="fieldset"
            label="Minimum track length"
            meta={
              <Stepper
                label="Minimum track length"
                value={minSegmentSeconds}
                step={SEGMENT_STEP}
                bigStep={10}
                precision={0}
                unit="s"
                disabled={disabled || !file}
                onChange={setSegment}
              />
            }
            hint="Stretches shorter than this are dropped rather than saved as their own track. Raise it on speech or lecture recordings to skip clips that are just a few words long."
          >
            <input
              type="range"
              min={MIN_SEGMENT_SECONDS}
              max={MIN_SEGMENT_MAX}
              step={SEGMENT_STEP}
              value={minSegmentSeconds}
              onChange={(e) => setSegment(Number(e.target.value))}
              disabled={disabled || !file}
              className={cn(
                "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-graphite-700",
                "accent-amber-500 disabled:opacity-40"
              )}
              aria-label="Minimum track length in seconds"
            />
          </ControlField>
        </div>
      )}
    />
  );
}