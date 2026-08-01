"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.0;
const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.1;

const PRESETS: { label: string; value: number }[] = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1.0 },
  { label: "125%", value: 1.25 },
  { label: "200%", value: 2.0 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDelta(originalSeconds: number, newSeconds: number): string {
  const delta = newSeconds - originalSeconds;
  const sign = delta < 0 ? "-" : "+";
  return `${sign}${formatDuration(Math.abs(delta))}`;
}

/* ------------------------------------------------------------------ */
/* Speed meter — zoned, draggable, keyboard-operable                   */
/* ------------------------------------------------------------------ */

function SpeedMeter({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const percentFor = (v: number) => clamp(((v - MIN_FACTOR) / (MAX_FACTOR - MIN_FACTOR)) * 100, 0, 100);

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      const next = MIN_FACTOR + fraction * (MAX_FACTOR - MIN_FACTOR);
      onChange(Math.round(clamp(next, MIN_FACTOR, MAX_FACTOR) * 100) / 100);
    },
    [onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, setFromClientX]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.round(clamp(value - step, MIN_FACTOR, MAX_FACTOR) * 100) / 100);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.round(clamp(value + step, MIN_FACTOR, MAX_FACTOR) * 100) / 100);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(MIN_FACTOR);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(MAX_FACTOR);
    }
  };

  return (
    <div className="space-y-1.5 pt-1">
      <div
        ref={trackRef}
        className={cn("relative h-2.5 rounded-full", !disabled && "cursor-pointer")}
        style={{
          background:
            "linear-gradient(to right, rgb(45 212 191 / 0.4), rgb(148 163 184 / 0.25) 50%, rgb(245 158 11 / 0.5))",
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          setDragging(true);
          setFromClientX(e.clientX);
        }}
      >
        {/* Normal-speed tick */}
        <div
          className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-graphite-950/50"
          style={{ left: `${percentFor(1.0)}%` }}
        />

        <div
          role="slider"
          aria-label="Playback speed"
          aria-valuemin={MIN_FACTOR}
          aria-valuemax={MAX_FACTOR}
          aria-valuenow={value}
          aria-valuetext={`${Math.round(value * 100)}%`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-graphite-900 shadow-sm transition-transform focus:outline-none",
            value > 1 ? "border-amber-500" : value < 1 ? "border-teal-400" : "border-text-subtle",
            !disabled && "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
            dragging && "scale-110"
          )}
          style={{ left: `${percentFor(value)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-text-subtle">
        <span>50% — half speed</span>
        <span>100%</span>
        <span>200% — double speed</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live duration prediction — probes the file's real length            */
/* ------------------------------------------------------------------ */

function DurationPreview({ file, tempoFactor }: { file: File; tempoFactor: number }) {
  const [originalDuration, setOriginalDuration] = useState<number | null>(null);

  useEffect(() => {
    let released = false;
    const url = URL.createObjectURL(file);
    const probe = new Audio();
    const release = () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(url);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      setOriginalDuration(probe.duration);
      release();
    };
    probe.onerror = release;
    probe.src = url;
    return () => {
      probe.onloadedmetadata = null;
      probe.onerror = null;
      release();
    };
  }, [file]);

  if (originalDuration === null) return null;

  const newDuration = originalDuration / tempoFactor;

  return (
    <div className="flex items-center justify-between rounded-lg border border-graphite-800 bg-graphite-850/60 px-3.5 py-2.5">
      <div className="flex items-baseline gap-2 font-mono text-sm">
        <span className="text-text-subtle line-through decoration-text-subtle/50">
          {formatDuration(originalDuration)}
        </span>
        <span className="text-text-subtle">→</span>
        <span className={cn("font-semibold", tempoFactor > 1 ? "text-amber-400" : tempoFactor < 1 ? "text-teal-400" : "text-text-primary")}>
          {formatDuration(newDuration)}
        </span>
      </div>
      {tempoFactor !== 1 && (
        <span className="font-mono text-xs text-text-subtle">{formatDelta(originalDuration, newDuration)}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function TempoForm() {
  const [tempoFactor, setTempoFactor] = useState(1.0);
  const percent = Math.round(tempoFactor * 100);

  return (
    <JobToolForm
      endpoint="tempo"
      pollIntervalMs={2500}
      toolLabel="Speed changer"
      toolMeta={`${percent}%`}
      submitLabel="Change speed"
      processingLabel="Changing speed"
      expectedRange="can take a moment on longer files"
      resultVerb="Speed changed"
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Time-stretching" },
        { at: 10, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ tempo_factor: String(tempoFactor) })}
      renderControls={(file, disabled) => (
        <div className={cn("space-y-3", !file && "opacity-60")}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">Speed</label>
            <span
              className={cn(
                "font-mono text-sm font-semibold",
                tempoFactor > 1 ? "text-amber-400" : tempoFactor < 1 ? "text-teal-400" : "text-text-muted"
              )}
            >
              {percent}%
            </span>
          </div>

          <SpeedMeter value={tempoFactor} disabled={disabled || !file} onChange={setTempoFactor} />

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
              <input
                type="number"
                min={MIN_FACTOR * 100}
                max={MAX_FACTOR * 100}
                step={1}
                value={percent}
                disabled={disabled || !file}
                onChange={(e) => setTempoFactor(clamp(Number(e.target.value) / 100, MIN_FACTOR, MAX_FACTOR))}
                className="w-16 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="flex flex-col border-l border-graphite-700">
                <button
                  type="button"
                  aria-label="Increase speed"
                  disabled={disabled || !file}
                  onClick={() => setTempoFactor((v) => Math.round(clamp(v + KEY_STEP_LARGE, MIN_FACTOR, MAX_FACTOR) * 100) / 100)}
                  className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  aria-label="Decrease speed"
                  disabled={disabled || !file}
                  onClick={() => setTempoFactor((v) => Math.round(clamp(v - KEY_STEP_LARGE, MIN_FACTOR, MAX_FACTOR) * 100) / 100)}
                  className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </span>
            </span>
            <span className="text-xs text-text-subtle">%</span>
          </div>

          <div className="flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setTempoFactor(preset.value)}
                disabled={disabled || !file}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-mono transition-colors disabled:opacity-40",
                  tempoFactor === preset.value
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {file ? (
            <DurationPreview file={file} tempoFactor={tempoFactor} />
          ) : (
            <p className="text-xs text-text-subtle">Upload a file to see the predicted output length.</p>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-text-subtle">
              Adjust, then apply once you&apos;re happy with the value.
            </p>
            <span className="shrink-0 whitespace-nowrap rounded-full border border-graphite-700 bg-graphite-850 px-2 py-1 font-mono text-[10px] text-text-subtle">
              3 req / 5 min
            </span>
          </div>
        </div>
      )}
    />
  );
}