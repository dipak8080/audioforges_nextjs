"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TrimState {
  duration: number | null;
  start: number;
  end: number;
}

let currentTrimState: TrimState = { duration: null, start: 0, end: 0 };

export function TrimForm() {
  return (
    <JobToolForm
      endpoint="trim"
      pollIntervalMs={2500}
      submitLabel="Trim"
      processingLabel="Trimming…"
      expectedRange="usually a few seconds"
      resultVerb="Trimmed"
      missingFieldsMessage="Please select a valid start and end point."
      buildExtraFields={() => {
        const { duration, start, end } = currentTrimState;
        if (duration === null || end <= start) return null;
        return { start_seconds: String(start), end_seconds: String(end) };
      }}
      renderControls={(file, disabled) => <TrimControls file={file} disabled={disabled} />}
    />
  );
}

interface TrimControlsProps {
  file: File | null;
  disabled: boolean;
}

const PEAK_COUNT = 400;

function TrimControls({ file, disabled }: TrimControlsProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) {
      setDuration(null);
      setPeaks(null);
      return;
    }

    setIsDecoding(true);
    let cancelled = false;

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        const channel = audioBuffer.getChannelData(0);
        const blockSize = Math.floor(channel.length / PEAK_COUNT);
        const computedPeaks: number[] = [];
        for (let i = 0; i < PEAK_COUNT; i++) {
          const blockStart = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const abs = Math.abs(channel[blockStart + j] || 0);
            if (abs > max) max = abs;
          }
          computedPeaks.push(max);
        }

        setDuration(audioBuffer.duration);
        setStart(0);
        setEnd(audioBuffer.duration);
        setPeaks(computedPeaks);
        audioCtx.close();
      } catch (err) {
        console.error("Waveform decode failed, falling back to duration only:", err);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
          if (cancelled) return;
          setDuration(audio.duration);
          setStart(0);
          setEnd(audio.duration);
          setPeaks(null);
        };
        audio.src = url;
      } finally {
        if (!cancelled) setIsDecoding(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [file]);

  useEffect(() => {
    currentTrimState = { duration, start, end };
  }, [duration, start, end]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || duration === null) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / peaks.length;
    const startX = (start / duration) * width;
    const endX = (end / duration) * width;

    peaks.forEach((peak, i) => {
      const x = i * barWidth;
      const barHeight = Math.max(2, peak * height);
      const y = (height - barHeight) / 2;
      const inSelection = x >= startX && x <= endX;
      ctx.fillStyle = inSelection ? "#e8a23d" : "#34343a";
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    });
  }, [peaks, start, end, duration]);

  const timeFromClientX = useCallback(
    (clientX: number): number => {
      const container = containerRef.current;
      if (!container || duration === null) return 0;
      const rect = container.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging || duration === null) return;
      const time = timeFromClientX(e.clientX);
      if (dragging === "start") {
        setStart(Math.min(time, end - 0.1));
      } else {
        setEnd(Math.max(time, start + 0.1));
      }
    },
    [dragging, duration, start, end, timeFromClientX]
  );

  const handlePointerUp = useCallback(() => setDragging(null), []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  if (!file) return null;

  if (isDecoding) {
    return <p className="text-sm text-text-muted py-4 text-center">Reading audio…</p>;
  }

  if (duration === null) return null;

  const startPercent = (start / duration) * 100;
  const endPercent = (end / duration) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Clip range</label>
        <span className="text-sm font-mono text-amber-400">
          {formatTime(start)} – {formatTime(end)}
        </span>
      </div>

      <div
        ref={containerRef}
        className="relative h-20 rounded-lg bg-graphite-850 overflow-hidden select-none touch-none"
      >
        {peaks ? (
          <canvas ref={canvasRef} width={800} height={80} className="w-full h-full" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-text-subtle">
            Preview unavailable for this file — use the sliders below
          </div>
        )}

        <div
          className="absolute inset-y-0 left-0 bg-graphite-950/60 pointer-events-none"
          style={{ width: `${startPercent}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-graphite-950/60 pointer-events-none"
          style={{ width: `${100 - endPercent}%` }}
        />

        <div
          className="absolute inset-y-0 w-3 -ml-1.5 cursor-ew-resize group"
          style={{ left: `${startPercent}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging("start");
          }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-amber-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-3 rounded-sm bg-amber-500 group-hover:bg-amber-400 transition-colors" />
        </div>

        <div
          className="absolute inset-y-0 w-3 -ml-1.5 cursor-ew-resize group"
          style={{ left: `${endPercent}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging("end");
          }}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-amber-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-3 rounded-sm bg-amber-500 group-hover:bg-amber-400 transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-text-subtle">Start: {formatTime(start)}</label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={start}
            disabled={disabled}
            onChange={(e) => {
              const value = Math.min(Number(e.target.value), end - 0.1);
              setStart(Math.max(0, value));
            }}
            className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
            aria-label="Start time"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-text-subtle">End: {formatTime(end)}</label>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={end}
            disabled={disabled}
            onChange={(e) => {
              const value = Math.max(Number(e.target.value), start + 0.1);
              setEnd(Math.min(duration, value));
            }}
            className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
            aria-label="End time"
          />
        </div>
      </div>

      <p className="text-xs text-text-subtle">
        Full length: {formatTime(duration)} — selected clip: {formatTime(end - start)}
      </p>
    </div>
  );
}