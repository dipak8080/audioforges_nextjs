"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronDown, Loader2, ListMusic } from "lucide-react";
import { MultiOutputToolForm } from "@/components/converter/MultiOutputToolForm";
import { ThresholdMeter } from "@/components/converter/ThresholdMeter";
import { computeWaveformPeaks } from "@/lib/utils/waveform";
import { computeDbTimeline, findQuietRanges, findAudibleSegments, type DbTimeline } from "@/lib/utils/silenceDetection";
import { submitJob } from "@/lib/api/railway";
import { cn } from "@/lib/utils/cn";

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
const OUTPUT_FORMATS = Object.keys(FORMAT_SPECS);

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
const WAVEFORM_BUCKETS = 200;

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
/* Live split preview — decodes once, re-derives boundaries on the fly  */
/* ------------------------------------------------------------------ */

function SplitPreview({ file, thresholdDb, minDuration }: { file: File; thresholdDb: number; minDuration: number }) {
  const [duration, setDuration] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [timeline, setTimeline] = useState<DbTimeline | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDuration(null);
    setPeaks(null);
    setTimeline(null);
    setFailed(false);

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
          setPeaks(computeWaveformPeaks(buffer, WAVEFORM_BUCKETS));
          setTimeline(computeDbTimeline(buffer));
        } finally {
          ctx.close();
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (failed) {
    return (
      <p className="text-xs text-text-subtle">
        Couldn&apos;t analyze this file for a live preview — splitting still runs normally.
      </p>
    );
  }

  const quietRanges = timeline ? findQuietRanges(timeline, thresholdDb, minDuration) : [];
  const segments = duration !== null ? findAudibleSegments(duration, quietRanges) : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Preview — where it would split</span>
        {duration !== null && (
          <span className="font-mono text-xs tabular-nums text-text-subtle">{formatTime(duration)} total</span>
        )}
      </div>

      <div className="relative h-16 overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850">
        {duration === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-text-subtle">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing track…
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center gap-px px-1 opacity-70">
              {peaks ? (
                peaks.map((p, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-graphite-600" style={{ height: `${Math.max(p * 100, 4)}%` }} />
                ))
              ) : (
                <div className="h-px w-full bg-graphite-700" />
              )}
            </div>

            {/* Dim the gaps that will be cut away between segments */}
            {quietRanges.map((gap, i) => {
              const leftPercent = (gap.startSeconds / duration) * 100;
              const widthPercent = ((gap.endSeconds - gap.startSeconds) / duration) * 100;
              return (
                <div
                  key={i}
                  className="pointer-events-none absolute inset-y-0 bg-graphite-950/70"
                  style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                />
              );
            })}

            {/* Split-point markers at each gap boundary */}
            {quietRanges.map((gap, i) => (
              <div
                key={`marker-${i}`}
                className="pointer-events-none absolute inset-y-0 w-px bg-amber-400"
                style={{ left: `${(gap.startSeconds / duration) * 100}%` }}
              />
            ))}
          </>
        )}
      </div>

      {duration !== null && (
        <>
          <p className="flex items-center gap-1.5 text-[11px] text-text-subtle">
            {segments.length > 1 ? (
              <>Would produce {segments.length} tracks at these settings.</>
            ) : (
              <>
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
                No qualifying gaps found — this would produce a single track. Try a higher threshold or
                shorter minimum gap.
              </>
            )}
          </p>

          {segments.length > 1 && (
            <div className="max-h-40 divide-y divide-graphite-800 overflow-y-auto rounded-lg border border-graphite-700">
              {segments.map((seg, i) => (
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
      rateLimitMessage="You've reached the limit (3 splits per 5 minutes). Try again shortly."
      renderControls={(file, disabled) => (
        <div className="space-y-5">
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="mb-2 text-sm font-medium text-text-primary">Output format</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Output format">
              {OUTPUT_FORMATS.map((fmt) => {
                const spec = FORMAT_SPECS[fmt];
                const selected = format === fmt;
                return (
                  <button
                    key={fmt}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setFormat(fmt)}
                    disabled={disabled}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left transition-all",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      selected
                        ? "border-amber-500/60 bg-amber-500/[0.07]"
                        : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                    )}
                  >
                    <span
                      className={cn(
                        "block font-mono text-xs font-semibold uppercase",
                        selected ? "text-amber-400" : "text-text-primary"
                      )}
                    >
                      {fmt}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-text-subtle">{spec.detail}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">Silence threshold</label>
              <span className="font-mono text-sm font-semibold text-amber-400">{thresholdDb} dB</span>
            </div>
            <ThresholdMeter
              value={thresholdDb}
              min={THRESHOLD_MIN_DB}
              max={THRESHOLD_MAX_DB}
              defaultValue={THRESHOLD_DEFAULT}
              disabled={disabled || !file}
              onChange={setThresholdDb}
            />
            <p className="text-[11px] leading-snug text-text-subtle">
              Lower (toward {THRESHOLD_MIN_DB} dB) catches quieter background noise as silence too. Higher
              (toward {THRESHOLD_MAX_DB} dB) only cuts near-total silence.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">Minimum gap length</label>
              <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
                <input
                  type="number"
                  min={MIN_DURATION_MIN}
                  max={MIN_DURATION_MAX}
                  step={0.1}
                  value={minDurationSeconds}
                  disabled={disabled || !file}
                  onChange={(e) => setMinDurationSeconds(clamp(Number(e.target.value), MIN_DURATION_MIN, MIN_DURATION_MAX))}
                  className="w-14 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="flex flex-col border-l border-graphite-700">
                  <button
                    type="button"
                    aria-label="Increase"
                    disabled={disabled || !file}
                    onClick={() =>
                      setMinDurationSeconds((v) => clamp(Math.round((v + 0.1) * 10) / 10, MIN_DURATION_MIN, MIN_DURATION_MAX))
                    }
                    className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                  >
                    <ChevronUp className="h-2.5 w-2.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Decrease"
                    disabled={disabled || !file}
                    onClick={() =>
                      setMinDurationSeconds((v) => clamp(Math.round((v - 0.1) * 10) / 10, MIN_DURATION_MIN, MIN_DURATION_MAX))
                    }
                    className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                  >
                    <ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </span>
              </span>
            </div>
            <input
              type="range"
              min={MIN_DURATION_MIN}
              max={MIN_DURATION_MAX}
              step={0.1}
              value={minDurationSeconds}
              onChange={(e) => setMinDurationSeconds(Number(e.target.value))}
              disabled={disabled || !file}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-graphite-700 accent-amber-500 disabled:opacity-40"
            />
            <p className="text-[11px] leading-snug text-text-subtle">
              How long a quiet stretch must last before it counts as a split point — shorter values cut
              on brief pauses too, longer values only cut long gaps.
            </p>
          </div>

          {file ? (
            <SplitPreview file={file} thresholdDb={thresholdDb} minDuration={minDurationSeconds} />
          ) : (
            <p className="text-xs text-text-subtle">Upload a file to preview exactly where it would split.</p>
          )}
        </div>
      )}
    />
  );
}