"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ThresholdMeter } from "@/components/converter/ThresholdMeter";
import { cn } from "@/lib/utils/cn";
import { WaveformCanvas } from "@/components/ui/WaveformCanvas";
import { computeWaveformEnvelopeAsync, type WaveformEnvelope } from "@/lib/utils/waveform";
import { computeDbTimelineAsync, findQuietRanges, type DbTimeline } from "@/lib/utils/silenceDetection";

const DEFAULT_THRESHOLD_DB = -30;
const DEFAULT_MIN_DURATION = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
        const Ctx =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        try {
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          if (cancelled) return;
          setDuration(buffer.duration);
          // Both passes are sliced so a long file can't block the page
          // — see lib/utils/scheduling. The waveform lands first so
          // there's something to look at while the dB scan finishes.
          const nextEnvelope = await computeWaveformEnvelopeAsync(buffer, undefined, abort.signal);
          if (!cancelled) setEnvelope(nextEnvelope);
          const nextTimeline = await computeDbTimelineAsync(buffer, abort.signal);
          if (!cancelled) setTimeline(nextTimeline);
        } finally {
          ctx.close();
        }
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
        Couldn&apos;t analyze this file for a live preview — the settings below still apply normally when you run it.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Preview — what these settings would cut</span>
        {duration !== null && (
          <span className="font-mono text-xs tabular-nums text-text-subtle">{formatTime(duration)} total</span>
        )}
      </div>

      <div className="relative h-24 overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850">
        {duration === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-text-subtle">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
            ? `~${removedPercent}% of the track would be removed across ${quietRanges.length} gap${quietRanges.length === 1 ? "" : "s"}.`
            : "No gaps meet both thresholds — nothing would be cut at these settings."}
          {removedPercent > 50 ? " That's aggressive — check the threshold isn't cutting into wanted audio." : ""}
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
          onMinDurationChange={setMinDuration}
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
    <div className={cn("space-y-5", !file && "opacity-60")}>
      {file ? (
        <CutPreview file={file} thresholdDb={thresholdDb} minDuration={minDuration} />
      ) : (
        <p className="text-xs text-text-subtle">
          Both settings have sensible defaults — they work well for most podcast and voice-memo cleanup
          without any adjustment. Upload a file to preview exactly what would be cut.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">Silence threshold</label>
          <span className="font-mono text-sm font-semibold text-amber-400">{thresholdDb} dB</span>
        </div>
        <ThresholdMeter
          value={thresholdDb}
          min={-90}
          max={-10}
          defaultValue={DEFAULT_THRESHOLD_DB}
          disabled={disabled || !file}
          onChange={onThresholdChange}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">Minimum gap length</label>
          <span className="flex items-center gap-1.5">
            <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.1}
                value={minDuration}
                disabled={disabled || !file}
                onChange={(e) => onMinDurationChange(clamp(Number(e.target.value), 0.1, 10))}
                className="w-14 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="flex flex-col border-l border-graphite-700">
                <button
                  type="button"
                  aria-label="Increase"
                  disabled={disabled || !file}
                  onClick={() => onMinDurationChange(clamp(Math.round((minDuration + 0.1) * 10) / 10, 0.1, 10))}
                  className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  aria-label="Decrease"
                  disabled={disabled || !file}
                  onClick={() => onMinDurationChange(clamp(Math.round((minDuration - 0.1) * 10) / 10, 0.1, 10))}
                  className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </span>
            </span>
            <span className="text-xs text-text-subtle">s</span>
          </span>
        </div>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={minDuration}
          onChange={(e) => onMinDurationChange(Number(e.target.value))}
          disabled={disabled || !file}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-graphite-700 accent-amber-500 disabled:opacity-40"
          aria-label="Minimum silence gap duration in seconds"
        />
        <div className="flex justify-between text-[11px] text-text-subtle">
          <span>0.1s — cuts short pauses</span>
          <span>Default (0.5s)</span>
          <span>10s — only long dead air</span>
        </div>
      </div>

    </div>
  );
}