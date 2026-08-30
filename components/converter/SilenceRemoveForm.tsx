"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ThresholdMeter } from "@/components/converter/ThresholdMeter";
import { ControlField, Stepper } from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";
import { WaveformCanvas } from "@/components/ui/WaveformCanvas";
import { computeWaveformEnvelopeAsync, type WaveformEnvelope } from "@/lib/utils/waveform";
import { computeDbTimelineAsync, findQuietRanges, type DbTimeline } from "@/lib/utils/silenceDetection";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE GAP LENGTH DRIFTED INTO FLOATING-POINT NOISE. The range input steps
 *    by 0.1 from a 0.1 minimum, so the browser hands back values like
 *    0.30000000000000004 — which went straight into the header as
 *    "0.30000000000000004s+", into the number field, and into the request
 *    body. Rounded to a tenth at every entry point now.
 *
 * 2. FOUR BOUNDS, EACH WRITTEN FIVE TIMES. 0.1 and 10 appeared in the range
 *    input, the number input, both arrow handlers and the clamp — so a backend
 *    change to SILENCE_MIN/MAX_DURATION_SECONDS meant finding all five. Named
 *    once, used everywhere.
 *
 * 3. "Increase" / "Decrease" WITH NO CONTEXT, again. The hand-rolled stepper
 *    took no label, so its two buttons announced nothing about what they
 *    changed.
 *
 * 4. AN AudioContext PER FILE. Chrome caps a document at six, and this page
 *    can hold a decode for the waveform and another for the dB timeline.
 *
 * 5. A 429 NAMES THE LIMIT.
 *
 * WHY THE GAP LENGTH ISN'T A ThresholdMeter: that control rounds to whole
 * numbers on every change, which is right for dB and would quantise this to
 * 1-second steps — the difference between 0.3s and 0.5s is most of the useful
 * range here. A native range input is the honest fit, and it's the only one on
 * the site for exactly that reason.
 */

const DEFAULT_THRESHOLD_DB = -30;
const DEFAULT_MIN_DURATION = 0.5;

/** Mirrors SILENCE_THRESHOLD_MIN_DB / _MAX_DB in the backend's config.py. */
const THRESHOLD_MIN_DB = -90;
const THRESHOLD_MAX_DB = -10;
/** Mirrors SILENCE_MIN_DURATION_SECONDS / SILENCE_MAX_DURATION_SECONDS. */
const MIN_GAP_SECONDS = 0.1;
const MAX_GAP_SECONDS = 10;
const GAP_STEP = 0.1;

const RATE_LIMIT_LABEL = getRateLimitLabel("silence-remove");

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Snaps to a tenth of a second and refuses NaN.
 *
 * The range input's own output needs this as much as the typed field does:
 * stepping by 0.1 from 0.1 produces 0.30000000000000004, and that number was
 * being rendered and submitted verbatim.
 */
function normalizeGap(value: number, fallback = DEFAULT_MIN_DURATION): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(clamp(value, MIN_GAP_SECONDS, MAX_GAP_SECONDS) * 10) / 10;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Live cut preview                                                     */
/* ------------------------------------------------------------------ */

function CutPreview({
  file,
  thresholdDb,
  minDuration,
}: {
  file: File;
  thresholdDb: number;
  minDuration: number;
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

  const quietRanges = useMemo(() => {
    if (!timeline) return [];
    return findQuietRanges(timeline, thresholdDb, minDuration);
  }, [timeline, thresholdDb, minDuration]);

  const isKept = useCallback(
    (time: number) => !quietRanges.some((r) => time >= r.startSeconds && time <= r.endSeconds),
    [quietRanges]
  );

  const removedSeconds = quietRanges.reduce((sum, r) => sum + (r.endSeconds - r.startSeconds), 0);
  const removedPercent = duration ? Math.round((removedSeconds / duration) * 100) : 0;

  if (failed) {
    return (
      <p className="text-xs text-text-subtle">
        Couldn&apos;t analyze this file for a live preview — the settings below still apply normally
        when you run it.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Preview — what these settings would cut</span>
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

            {quietRanges.map((range, i) => {
              const leftPercent = (range.startSeconds / duration) * 100;
              const widthPercent = ((range.endSeconds - range.startSeconds) / duration) * 100;
              return (
                <div
                  key={i}
                  className="pointer-events-none absolute inset-y-0 bg-red-500/20"
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                />
              );
            })}

            {!timeline && (
              <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px] text-text-subtle">
                Scanning for quiet gaps…
              </div>
            )}
          </>
        )}
      </div>

      {duration !== null && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-[11px]",
            removedPercent > 50 ? "text-amber-400" : "text-text-subtle"
          )}
        >
          {removedPercent > 50 && <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />}
          {removedPercent > 0
            ? `~${removedPercent}% of the track would be removed across ${quietRanges.length} gap${
                quietRanges.length === 1 ? "" : "s"
              }.`
            : "No gaps meet both thresholds — nothing would be cut at these settings."}
          {removedPercent > 50
            ? " That's aggressive — check the threshold isn't cutting into wanted audio."
            : ""}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function SilenceRemoveForm() {
  const [thresholdDb, setThresholdDb] = useState(DEFAULT_THRESHOLD_DB);
  const [minDuration, setMinDuration] = useState(DEFAULT_MIN_DURATION);

  return (
    <JobToolForm
      endpoint="silence-remove"
      pollIntervalMs={2500}
      toolLabel="Silence remover"
      toolMeta={`${thresholdDb} dB · ${minDuration}s+`}
      submitLabel="Remove silence"
      processingLabel="Removing silent gaps"
      expectedRange="a few seconds"
      resultVerb="Silence removed"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Silence removal is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Scanning for quiet gaps" },
        { at: 3, label: "Cutting and stitching the audio" },
        { at: 7, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({
        threshold_db: String(thresholdDb),
        min_duration_seconds: String(minDuration),
      })}
      renderControls={(file, disabled) => (
        <SilenceControls
          file={file}
          thresholdDb={thresholdDb}
          onThresholdChange={setThresholdDb}
          minDuration={minDuration}
          onMinDurationChange={(v) => setMinDuration(normalizeGap(v, minDuration))}
          disabled={disabled}
        />
      )}
    />
  );
}

interface SilenceControlsProps {
  file: File | null;
  thresholdDb: number;
  onThresholdChange: (value: number) => void;
  minDuration: number;
  onMinDurationChange: (value: number) => void;
  disabled: boolean;
}

function SilenceControls({
  file,
  thresholdDb,
  onThresholdChange,
  minDuration,
  onMinDurationChange,
  disabled,
}: SilenceControlsProps) {
  return (
    <div className="space-y-5">
      {file ? (
        <CutPreview file={file} thresholdDb={thresholdDb} minDuration={minDuration} />
      ) : (
        <p className="text-xs text-text-subtle">
          Both settings have sensible defaults — they work well for most podcast and voice-memo
          cleanup without any adjustment. Upload a file to preview exactly what would be cut.
        </p>
      )}

      <ControlField
        as="fieldset"
        label="Silence threshold"
        meta={<span className="text-[13px] font-semibold text-amber-400">{thresholdDb} dB</span>}
      >
        <ThresholdMeter
          value={thresholdDb}
          min={THRESHOLD_MIN_DB}
          max={THRESHOLD_MAX_DB}
          defaultValue={DEFAULT_THRESHOLD_DB}
          disabled={disabled || !file}
          onChange={onThresholdChange}
        />
      </ControlField>

      <ControlField
        as="fieldset"
        label="Minimum gap length"
        meta={
          <Stepper
            label="Minimum gap"
            value={minDuration}
            step={GAP_STEP}
            bigStep={GAP_STEP}
            precision={1}
            unit="s"
            disabled={disabled || !file}
            onChange={onMinDurationChange}
          />
        }
      >
        {/* A native range, and deliberately the only one on the site:
            ThresholdMeter rounds to whole numbers, which would quantise this
            to 1-second steps — and the difference between 0.3s and 0.5s is
            most of the useful range here. */}
        <input
          type="range"
          min={MIN_GAP_SECONDS}
          max={MAX_GAP_SECONDS}
          step={GAP_STEP}
          value={minDuration}
          onChange={(e) => onMinDurationChange(Number(e.target.value))}
          disabled={disabled || !file}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-graphite-700 accent-amber-500 disabled:opacity-40"
          aria-label="Minimum silence gap duration in seconds"
        />
        <div className="flex justify-between text-[11px] text-text-subtle">
          <span>{MIN_GAP_SECONDS}s — cuts short pauses</span>
          <span>Default ({DEFAULT_MIN_DURATION}s)</span>
          <span>{MAX_GAP_SECONDS}s — only long dead air</span>
        </div>
      </ControlField>
    </div>
  );
}