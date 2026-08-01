"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";
import { computeWaveformPeaks } from "@/lib/utils/waveform";

const RINGTONE_MAX_SECONDS = 40;
const WAVEFORM_BUCKETS = 220;
const KEY_STEP = 1;
const KEY_STEP_LARGE = 5;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type DragTarget = "start" | "end" | "move" | null;

interface SelectionWindowProps {
  file: File;
  disabled: boolean;
  start: number;
  duration: number;
  onChange: (start: number, duration: number) => void;
}

function SelectionWindow({ file, disabled, start, duration, onChange }: SelectionWindowProps) {
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [dragging, setDragging] = useState<DragTarget>(null);
  const [dragMoveAnchor, setDragMoveAnchor] = useState<{ pointerFraction: number; start: number } | null>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const end = start + duration;

  /* --- new file: reset, probe duration, decode waveform ------------- */
  useEffect(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    setFileDuration(null);
    setPeaks(null);
    setIsPreviewing(false);

    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = url;
      audioElRef.current.load();
    }

    let cancelled = false;
    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const Ctx =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        try {
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          if (!cancelled) setPeaks(computeWaveformPeaks(buffer, WAVEFORM_BUCKETS));
        } finally {
          ctx.close();
        }
      } catch {
        // Decode not supported for this format — plain track, tool still
        // fully works via <audio>'s own (broader) format support.
        if (!cancelled) setPeaks(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (previewStopRef.current) clearTimeout(previewStopRef.current);
    };
  }, []);

  /* --- clamp start/duration down once real duration is known -------- */
  useEffect(() => {
    if (fileDuration === null) return;
    const maxDuration = Math.min(RINGTONE_MAX_SECONDS, fileDuration);
    const nextDuration = clamp(duration, 1, maxDuration);
    const nextStart = clamp(start, 0, Math.max(0, fileDuration - nextDuration));
    if (nextStart !== start || nextDuration !== duration) onChange(nextStart, nextDuration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileDuration]);

  const stopPreview = useCallback(() => {
    audioElRef.current?.pause();
    setIsPreviewing(false);
    if (previewStopRef.current) {
      clearTimeout(previewStopRef.current);
      previewStopRef.current = null;
    }
  }, []);

  const startPreview = useCallback(async () => {
    const audio = audioElRef.current;
    if (!audio || fileDuration === null) return;
    audio.currentTime = start;
    await audio.play().catch(() => {});
    setIsPreviewing(true);
    if (previewStopRef.current) clearTimeout(previewStopRef.current);
    previewStopRef.current = setTimeout(() => stopPreview(), duration * 1000);
  }, [start, duration, fileDuration, stopPreview]);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    const handleEnd = () => setIsPreviewing(false);
    audio.addEventListener("ended", handleEnd);
    audio.addEventListener("pause", handleEnd);
    return () => {
      audio.removeEventListener("ended", handleEnd);
      audio.removeEventListener("pause", handleEnd);
    };
  }, []);

  /* --- drag handling: start handle, end handle, or move whole window - */
  const fractionFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }, []);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (fileDuration === null || !dragging) return;
      const fraction = fractionFromClientX(clientX);
      const timeAtX = fraction * fileDuration;
      const maxDuration = Math.min(RINGTONE_MAX_SECONDS, fileDuration);

      if (dragging === "start") {
        const nextStart = clamp(timeAtX, 0, end - 1);
        const nextDuration = clamp(end - nextStart, 1, maxDuration);
        onChange(clamp(end - nextDuration, 0, fileDuration), nextDuration);
      } else if (dragging === "end") {
        const nextEnd = clamp(timeAtX, start + 1, Math.min(fileDuration, start + maxDuration));
        onChange(start, nextEnd - start);
      } else if (dragging === "move" && dragMoveAnchor) {
        const deltaFraction = fraction - dragMoveAnchor.pointerFraction;
        const deltaSeconds = deltaFraction * fileDuration;
        const nextStart = clamp(dragMoveAnchor.start + deltaSeconds, 0, fileDuration - duration);
        onChange(nextStart, duration);
      }
    },
    [dragging, dragMoveAnchor, fileDuration, start, end, duration, fractionFromClientX, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX);
    const onUp = () => {
      setDragging(null);
      setDragMoveAnchor(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, handlePointerMove]);

  const startDrag = (target: DragTarget, clientX: number) => {
    if (disabled) return;
    if (isPreviewing) stopPreview();
    if (target === "move") setDragMoveAnchor({ pointerFraction: fractionFromClientX(clientX), start });
    setDragging(target);
  };

  const nudge = (which: "start" | "duration", delta: number) => {
    if (fileDuration === null) return;
    const maxDuration = Math.min(RINGTONE_MAX_SECONDS, fileDuration);
    if (which === "start") {
      const nextStart = clamp(start + delta, 0, fileDuration - duration);
      onChange(nextStart, duration);
    } else {
      const nextDuration = clamp(duration + delta, 1, Math.min(maxDuration, fileDuration - start));
      onChange(start, nextDuration);
    }
  };

  const handleKeyDown = (target: "start" | "end") => (e: React.KeyboardEvent) => {
    if (disabled || fileDuration === null) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      target === "start" ? nudge("start", -step) : nudge("duration", -step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      target === "start" ? nudge("start", step) : nudge("duration", step);
    }
  };

  const startPercent = fileDuration ? (start / fileDuration) * 100 : 0;
  const endPercent = fileDuration ? (end / fileDuration) * 100 : 0;
  const maxDuration = fileDuration ? Math.min(RINGTONE_MAX_SECONDS, fileDuration) : RINGTONE_MAX_SECONDS;

  return (
    <div className="space-y-3">
      <audio
        ref={audioElRef}
        preload="metadata"
        onLoadedMetadata={(e) => setFileDuration(e.currentTarget.duration)}
      />

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Ringtone window</label>
        {fileDuration !== null && (
          <span className="font-mono text-xs tabular-nums text-text-subtle">{formatTime(fileDuration)} total</span>
        )}
      </div>

      {/* Timeline: waveform + draggable selection window, anchored to the
          real track length — this is what the old 0–600s slider had no
          relationship to at all. */}
      <div
        ref={containerRef}
        className="relative h-20 select-none overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850"
      >
        {fileDuration === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-text-subtle">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reading track…
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

            {/* Dimmed regions outside the selection */}
            <div className="pointer-events-none absolute inset-y-0 left-0 bg-graphite-950/60" style={{ width: `${startPercent}%` }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 bg-graphite-950/60" style={{ width: `${100 - endPercent}%` }} />

            {/* The selection window itself — draggable to move both edges together */}
            <div
              onPointerDown={(e) => startDrag("move", e.clientX)}
              className={cn(
                "absolute inset-y-0 border-x-2 border-amber-500/70 bg-amber-500/10",
                !disabled && "cursor-grab active:cursor-grabbing"
              )}
              style={{ left: `${startPercent}%`, width: `${endPercent - startPercent}%` }}
            />

            {/* Start handle */}
            <div
              role="slider"
              aria-label="Start time"
              aria-valuemin={0}
              aria-valuemax={fileDuration}
              aria-valuenow={start}
              aria-valuetext={formatTime(start)}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.stopPropagation();
                startDrag("start", e.clientX);
              }}
              onKeyDown={handleKeyDown("start")}
              className="absolute inset-y-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus:outline-none"
              style={{ left: `${startPercent}%` }}
            >
              <div className="h-full w-0.5 bg-amber-500" />
              <div className="absolute h-3 w-3 rounded-full border-2 border-amber-500 bg-graphite-900" />
            </div>

            {/* End handle */}
            <div
              role="slider"
              aria-label="End time"
              aria-valuemin={0}
              aria-valuemax={fileDuration}
              aria-valuenow={end}
              aria-valuetext={formatTime(end)}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.stopPropagation();
                startDrag("end", e.clientX);
              }}
              onKeyDown={handleKeyDown("end")}
              className="absolute inset-y-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus:outline-none"
              style={{ left: `${endPercent}%` }}
            >
              <div className="h-full w-0.5 bg-amber-500" />
              <div className="absolute h-3 w-3 rounded-full border-2 border-amber-500 bg-graphite-900" />
            </div>
          </>
        )}
      </div>

      {/* Numeric entry + preview */}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Start
          <Stepper
            value={start}
            disabled={disabled || fileDuration === null}
            onIncrement={() => nudge("start", KEY_STEP)}
            onDecrement={() => nudge("start", -KEY_STEP)}
            onChange={(v) => fileDuration !== null && onChange(clamp(v, 0, fileDuration - duration), duration)}
            max={fileDuration ?? 0}
          />
          s
        </label>

        <button
          type="button"
          onClick={isPreviewing ? stopPreview : startPreview}
          disabled={disabled || fileDuration === null}
          className="flex items-center gap-1.5 rounded-full border border-graphite-700 bg-graphite-850 px-3.5 py-1.5 text-text-muted transition-colors hover:border-amber-500/40 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
        >
          {isPreviewing ? <Square className="h-3 w-3" fill="currentColor" /> : <Play className="h-3 w-3" fill="currentColor" />}
          {isPreviewing ? "Stop" : "Preview"}
        </button>

        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Length
          <Stepper
            value={duration}
            disabled={disabled || fileDuration === null}
            onIncrement={() => nudge("duration", KEY_STEP)}
            onDecrement={() => nudge("duration", -KEY_STEP)}
            onChange={(v) => onChange(start, clamp(v, 1, maxDuration))}
            max={maxDuration}
          />
          s
        </label>
      </div>

      <p className="text-center text-xs text-text-subtle">
        Drag the window or its edges — iPhone ringtones max out at {RINGTONE_MAX_SECONDS}s, capped
        automatically to your track&apos;s length.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stepper({
  value,
  disabled,
  max,
  onIncrement,
  onDecrement,
  onChange,
}: {
  value: number;
  disabled: boolean;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
      <input
        type="number"
        min={0}
        max={max}
        step={1}
        value={Math.round(value)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="flex flex-col border-l border-graphite-700">
        <button
          type="button"
          aria-label="Increase"
          disabled={disabled}
          onClick={onIncrement}
          className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          aria-label="Decrease"
          disabled={disabled}
          onClick={onDecrement}
          className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function RingtoneForm() {
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(30);

  return (
    <JobToolForm
      endpoint="ringtone"
      pollIntervalMs={2500}
      toolLabel="Ringtone maker"
      toolMeta={`${formatTime(start)} → ${formatTime(start + duration)}`}
      submitLabel="Make ringtone"
      processingLabel="Trimming and encoding"
      expectedRange="a few seconds"
      resultVerb="Ready"
      downloadFilename="ringtone.m4r"
      stages={[
        { at: 0, label: "Trimming the selection" },
        { at: 3, label: "Encoding for iPhone" },
        { at: 6, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({
        start_seconds: String(start),
        duration_seconds: String(duration),
      })}
      renderControls={(file, disabled) =>
        file ? (
          <SelectionWindow
            file={file}
            disabled={disabled}
            start={start}
            duration={duration}
            onChange={(s, d) => {
              setStart(s);
              setDuration(d);
            }}
          />
        ) : null
      }
    />
  );
}