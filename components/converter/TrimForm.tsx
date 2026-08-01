"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";
import { computeWaveformPeaks } from "@/lib/utils/waveform";

const WAVEFORM_BUCKETS = 220;
const KEY_STEP = 0.1;
const KEY_STEP_LARGE = 1;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/* Form — start/end now live in real React state, not a module-level   */
/* mutable variable. buildExtraFields closes over the current render's */
/* values directly, so a submit can never read a stale trim range from */
/* a previous file or a previous render.                               */
/* ------------------------------------------------------------------ */

export function TrimForm() {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  return (
    <JobToolForm
      endpoint="trim"
      pollIntervalMs={2500}
      toolLabel="Audio trimmer"
      toolMeta={end > start ? `${formatTime(start)} → ${formatTime(end)}` : undefined}
      submitLabel="Trim"
      processingLabel="Trimming"
      expectedRange="a few seconds"
      resultVerb="Trimmed"
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 2, label: "Cutting the selection" },
        { at: 5, label: "Writing the output file" },
      ]}
      missingFieldsMessage="Select a valid start and end point above."
      buildExtraFields={() => {
        if (end <= start) return null;
        return { start_seconds: String(start), end_seconds: String(end) };
      }}
      renderControls={(file, disabled) =>
        file ? (
          <TrimControls
            file={file}
            disabled={disabled}
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
          />
        ) : null
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Controls — purely driven by props; all file probing/decoding lives  */
/* here, but the actual start/end values are owned by the parent.      */
/* ------------------------------------------------------------------ */

interface TrimControlsProps {
  file: File;
  disabled: boolean;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

type DragTarget = "start" | "end" | null;

function TrimControls({ file, disabled, start, end, onChange }: TrimControlsProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [dragging, setDragging] = useState<DragTarget>(null);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --- new file: reset, probe duration, decode waveform ------------- */
  useEffect(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    setDuration(null);
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
        // Decode not supported for this format — plain track, the tool
        // still fully works via <audio>'s own (broader) format support.
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

  /* --- once real duration is known, default to the full track ------ */
  useEffect(() => {
    if (duration === null) return;
    onChange(0, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

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
    if (!audio || duration === null || end <= start) return;
    audio.currentTime = start;
    await audio.play().catch(() => {});
    setIsPreviewing(true);
    if (previewStopRef.current) clearTimeout(previewStopRef.current);
    previewStopRef.current = setTimeout(() => stopPreview(), (end - start) * 1000);
  }, [start, end, duration, stopPreview]);

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

  /* --- drag handling -------------------------------------------------*/
  const fractionFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }, []);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (duration === null || !dragging) return;
      const timeAtX = fractionFromClientX(clientX) * duration;
      if (dragging === "start") {
        onChange(clamp(timeAtX, 0, end - 0.1), end);
      } else {
        onChange(start, clamp(timeAtX, start + 0.1, duration));
      }
    },
    [dragging, duration, start, end, fractionFromClientX, onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX);
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, handlePointerMove]);

  const startDrag = (target: DragTarget) => {
    if (disabled) return;
    if (isPreviewing) stopPreview();
    setDragging(target);
  };

  const nudge = (which: "start" | "end", delta: number) => {
    if (duration === null) return;
    if (which === "start") onChange(clamp(start + delta, 0, end - 0.1), end);
    else onChange(start, clamp(end + delta, start + 0.1, duration));
  };

  const handleKeyDown = (target: "start" | "end") => (e: React.KeyboardEvent) => {
    if (disabled || duration === null) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(target, -step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(target, step);
    } else if (e.key === "Home" && target === "start") {
      e.preventDefault();
      onChange(0, end);
    } else if (e.key === "End" && target === "end") {
      e.preventDefault();
      onChange(start, duration);
    }
  };

  if (duration === null) {
    return (
      <div className="flex h-20 items-center justify-center gap-2 rounded-lg border border-graphite-700 bg-graphite-850 text-xs text-text-subtle">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Reading audio…
      </div>
    );
  }

  const startPercent = (start / duration) * 100;
  const endPercent = (end / duration) * 100;

  return (
    <div className="space-y-3">
      <audio ref={audioElRef} preload="metadata" />

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Clip range</label>
        <span className="font-mono text-sm text-amber-400">
          {formatTime(start)} – {formatTime(end)}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative h-20 select-none overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850 touch-none"
      >
        <div className="absolute inset-0 flex items-center gap-px px-1 opacity-70">
          {peaks ? (
            peaks.map((p, i) => (
              <div key={i} className="flex-1 rounded-sm bg-graphite-600" style={{ height: `${Math.max(p * 100, 4)}%` }} />
            ))
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-text-subtle">
              Preview unavailable for this format — drag the handles below
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 bg-graphite-950/60" style={{ width: `${startPercent}%` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 bg-graphite-950/60" style={{ width: `${100 - endPercent}%` }} />

        {/* Start handle */}
        <div
          role="slider"
          aria-label="Start time"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={start}
          aria-valuetext={formatTime(start)}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            startDrag("start");
          }}
          onKeyDown={handleKeyDown("start")}
          className="absolute inset-y-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus:outline-none"
          style={{ left: `${startPercent}%` }}
        >
          <div className="h-full w-0.5 bg-amber-500" />
          <div className="absolute h-3 w-3 rounded-full border-2 border-amber-500 bg-graphite-900 shadow-sm transition-transform hover:scale-110" />
        </div>

        {/* End handle */}
        <div
          role="slider"
          aria-label="End time"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={end}
          aria-valuetext={formatTime(end)}
          tabIndex={disabled ? -1 : 0}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            startDrag("end");
          }}
          onKeyDown={handleKeyDown("end")}
          className="absolute inset-y-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus:outline-none"
          style={{ left: `${endPercent}%` }}
        >
          <div className="h-full w-0.5 bg-amber-500" />
          <div className="absolute h-3 w-3 rounded-full border-2 border-amber-500 bg-graphite-900 shadow-sm transition-transform hover:scale-110" />
        </div>
      </div>

      {/* Numeric entry + preview — replaces the old duplicate pair of
          range sliders below the waveform, which could visually drift
          from the drag handles despite sharing the same state. */}
      <div className="flex items-center justify-between gap-3">
        <Stepper
          label="Start"
          value={start}
          disabled={disabled}
          onIncrement={() => nudge("start", KEY_STEP_LARGE)}
          onDecrement={() => nudge("start", -KEY_STEP_LARGE)}
          onChange={(v) => onChange(clamp(v, 0, end - 0.1), end)}
        />

        <button
          type="button"
          onClick={isPreviewing ? stopPreview : startPreview}
          disabled={disabled || end <= start}
          className="flex items-center gap-1.5 rounded-full border border-graphite-700 bg-graphite-850 px-3.5 py-1.5 text-text-muted transition-colors hover:border-amber-500/40 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
        >
          {isPreviewing ? <Square className="h-3 w-3" fill="currentColor" /> : <Play className="h-3 w-3" fill="currentColor" />}
          {isPreviewing ? "Stop" : "Preview"}
        </button>

        <Stepper
          label="End"
          value={end}
          disabled={disabled}
          onIncrement={() => nudge("end", KEY_STEP_LARGE)}
          onDecrement={() => nudge("end", -KEY_STEP_LARGE)}
          onChange={(v) => onChange(start, clamp(v, start + 0.1, duration))}
        />
      </div>

      <p className="text-center text-xs text-text-subtle">
        Full length: {formatTime(duration)} — selected clip: {formatTime(Math.max(0, end - start))}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stepper({
  label,
  value,
  disabled,
  onIncrement,
  onDecrement,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-muted">
      {label}
      <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
        <input
          type="number"
          step={0.1}
          value={Math.round(value * 10) / 10}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-16 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="flex flex-col border-l border-graphite-700">
          <button
            type="button"
            aria-label={`Increase ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={onIncrement}
            className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
          >
            <ChevronUp className="h-2.5 w-2.5" />
          </button>
          <button
            type="button"
            aria-label={`Decrease ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={onDecrement}
            className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
          >
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        </span>
      </span>
      s
    </label>
  );
}