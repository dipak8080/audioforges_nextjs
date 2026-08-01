"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Picks a "nice" tick spacing (10, 20, 25, 50...) so a -90..-10 range and
 *  a 0..97 range both get a sane number of ticks instead of either a
 *  cluttered mess or two bare endpoints. */
function niceTickStep(range: number, targetTicks = 6): number {
  const rough = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

interface ThresholdMeterProps {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  disabled: boolean;
  onChange: (v: number) => void;
  /** Unit suffix shown in the floating value bubble, e.g. "dB". */
  unit?: string;
  /** Overrides the three zone labels (low third / mid third / high
   * third of the range). Defaults suit a dB threshold; pass your own
   * for a differently-shaped scale. */
  zoneLabels?: [string, string, string];
}

/** Zoned, draggable, keyboard-operable meter — a generic "aggressive ↔
 *  conservative" style scale, shared wherever a bounded numeric control
 *  needs to feel like an instrument rather than a bare <input range>. */
export function ThresholdMeter({
  value,
  min,
  max,
  defaultValue,
  disabled,
  onChange,
  unit = "dB",
  zoneLabels = ["Aggressive", "Balanced", "Conservative"],
}: ThresholdMeterProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);

  const percentFor = useCallback((v: number) => clamp(((v - min) / (max - min)) * 100, 0, 100), [min, max]);

  const ticks = useMemo(() => {
    const step = niceTickStep(max - min);
    const start = Math.ceil(min / step) * step;
    const values: number[] = [];
    for (let v = start; v <= max; v += step) values.push(Math.round(v * 100) / 100);
    return values;
  }, [min, max]);

  const zoneFor = (v: number): string => {
    const fraction = (v - min) / (max - min);
    if (fraction <= 1 / 3) return zoneLabels[0];
    if (fraction <= 2 / 3) return zoneLabels[1];
    return zoneLabels[2];
  };

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      onChange(Math.round(clamp(min + fraction * (max - min), min, max)));
    },
    [min, max, onChange]
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
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.round(clamp(value - step, min, max)));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.round(clamp(value + step, min, max)));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  };

  const showBubble = dragging || hovering;
  const handlePercent = percentFor(value);

  return (
    <div className="space-y-1 pt-6">
      <div
        ref={trackRef}
        className="relative h-3 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
        style={{
          background:
            "linear-gradient(to right, rgb(248 113 113 / 0.5), rgb(245 158 11 / 0.45) 50%, rgb(45 212 191 / 0.4))",
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          setDragging(true);
          setFromClientX(e.clientX);
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Ruler ticks across the whole scale, not just the endpoints */}
        {ticks.map((t) => (
          <div
            key={t}
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-graphite-950/40"
            style={{ left: `${percentFor(t)}%` }}
          />
        ))}

        {/* Default-value marker, taller than the regular ticks */}
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-graphite-950/70"
          style={{ left: `${percentFor(defaultValue)}%` }}
        />

        {/* Floating live-value bubble — the thing this was missing */}
        {showBubble && (
          <div
            className="pointer-events-none absolute -top-9 -translate-x-1/2 whitespace-nowrap rounded-md border border-graphite-700 bg-graphite-950 px-2 py-1 text-center shadow-lg"
            style={{ left: `${clamp(handlePercent, 8, 92)}%` }}
          >
            <span className="block font-mono text-xs font-semibold text-text-primary">
              {value}
              {unit ? ` ${unit}` : ""}
            </span>
            <span className="block text-[9px] uppercase tracking-wide text-text-subtle">{zoneFor(value)}</span>
          </div>
        )}

        <div
          role="slider"
          aria-label="Threshold"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${value} ${unit}, ${zoneFor(value)}`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onFocus={() => setHovering(true)}
          onBlur={() => setHovering(false)}
          className={cn(
            "absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-500 bg-graphite-900 shadow-md transition-transform focus:outline-none",
            !disabled &&
              "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
            dragging && "scale-110",
            disabled && "opacity-50"
          )}
          style={{ left: `${handlePercent}%` }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-text-subtle">
        <span>
          {min} · {zoneLabels[0]}
        </span>
        <span>Default ({defaultValue})</span>
        <span>
          {max} · {zoneLabels[2]}
        </span>
      </div>
    </div>
  );
}