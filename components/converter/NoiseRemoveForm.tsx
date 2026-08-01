"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

const MIN_STRENGTH = 0.01;
const MAX_STRENGTH = 97;
const DEFAULT_STRENGTH = 12;
const KEY_STEP = 1;
const KEY_STEP_LARGE = 10;

// Rough bands for the zoned meter and the artifact-risk copy. Not exact
// science — sox/rnnoise-style denoisers don't have a hard cliff — but
// giving the value a named zone (rather than a bare number) is what
// actually helps someone calibrate it the first time.
const ZONES = [
  { max: 20, label: "Light", tone: "teal" as const },
  { max: 45, label: "Moderate", tone: "amber" as const },
  { max: MAX_STRENGTH, label: "Aggressive", tone: "red" as const },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function percentFor(value: number): number {
  return clamp(((value - MIN_STRENGTH) / (MAX_STRENGTH - MIN_STRENGTH)) * 100, 0, 100);
}

function zoneFor(value: number) {
  return ZONES.find((z) => value <= z.max) ?? ZONES[ZONES.length - 1];
}

function riskCopy(value: number): string | null {
  if (value > 60) {
    return "At this strength, expect audible warbling on the wanted audio — especially with music or sustained tones.";
  }
  if (value > 35) {
    return "Getting aggressive. Check the result by ear — vocals and cymbals are usually first to show artifacts.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Strength meter — draggable, keyboard-operable, zoned                */
/* ------------------------------------------------------------------ */

interface StrengthMeterProps {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}

function StrengthMeter({ value, disabled, onChange }: StrengthMeterProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      const next = MIN_STRENGTH + fraction * (MAX_STRENGTH - MIN_STRENGTH);
      onChange(Math.round(clamp(next, MIN_STRENGTH, MAX_STRENGTH)));
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
      onChange(Math.round(clamp(value - step, MIN_STRENGTH, MAX_STRENGTH)));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.round(clamp(value + step, MIN_STRENGTH, MAX_STRENGTH)));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(MIN_STRENGTH);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(MAX_STRENGTH);
    }
  };

  const markerPercent = percentFor(value);
  const defaultPercent = percentFor(DEFAULT_STRENGTH);

  return (
    <div className="space-y-1.5 pt-1">
      <div
        ref={trackRef}
        className={cn("relative h-2.5 rounded-full", !disabled && "cursor-pointer")}
        style={{
          background:
            "linear-gradient(to right, rgb(45 212 191 / 0.4), rgb(245 158 11 / 0.5) 55%, rgb(248 113 113 / 0.6))",
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          setDragging(true);
          setFromClientX(e.clientX);
        }}
      >
        {/* Default-value tick */}
        <div
          className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-graphite-950/50"
          style={{ left: `${defaultPercent}%` }}
        />

        <div
          role="slider"
          aria-label="Noise reduction strength"
          aria-valuemin={MIN_STRENGTH}
          aria-valuemax={MAX_STRENGTH}
          aria-valuenow={value}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-500 bg-graphite-900 shadow-sm transition-transform focus:outline-none",
            !disabled && "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
            dragging && "scale-110"
          )}
          style={{ left: `${markerPercent}%` }}
        />
      </div>

      <div className="flex justify-between text-[11px] text-text-subtle">
        <span>Light</span>
        <span className="relative">
          <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">Default ({DEFAULT_STRENGTH})</span>
        </span>
        <span>Aggressive</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function NoiseRemoveForm() {
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);
  const zone = zoneFor(strength);
  const risk = riskCopy(strength);

  return (
    <JobToolForm
      endpoint="noise-remove"
      pollIntervalMs={2500}
      toolLabel="Noise remover"
      toolMeta={`${zone.label} · ${strength}`}
      submitLabel="Remove noise"
      processingLabel="Removing noise"
      expectedRange="a few seconds"
      resultVerb="Denoised"
      stages={[
        { at: 0, label: "Reading the noise profile" },
        { at: 3, label: "Suppressing the noise floor" },
        { at: 7, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ strength: String(strength) })}
      renderControls={(file, disabled) => (
        <div className={cn("space-y-2", !file && "opacity-60")}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">Reduction strength</label>
            <span
              className={cn(
                "font-mono text-sm font-semibold",
                zone.tone === "teal" && "text-teal-400",
                zone.tone === "amber" && "text-amber-400",
                zone.tone === "red" && "text-red-400"
              )}
            >
              {zone.label} · {strength}
            </span>
          </div>

          <StrengthMeter value={strength} disabled={disabled || !file} onChange={setStrength} />

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
              <input
                type="number"
                min={MIN_STRENGTH}
                max={MAX_STRENGTH}
                step={1}
                value={strength}
                disabled={disabled || !file}
                onChange={(e) => setStrength(Math.round(clamp(Number(e.target.value), MIN_STRENGTH, MAX_STRENGTH)))}
                className="w-16 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="flex flex-col border-l border-graphite-700">
                <button
                  type="button"
                  aria-label="Increase strength"
                  disabled={disabled || !file}
                  onClick={() => setStrength((v) => Math.round(clamp(v + KEY_STEP, MIN_STRENGTH, MAX_STRENGTH)))}
                  className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  aria-label="Decrease strength"
                  disabled={disabled || !file}
                  onClick={() => setStrength((v) => Math.round(clamp(v - KEY_STEP, MIN_STRENGTH, MAX_STRENGTH)))}
                  className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </span>
            </span>
            <button
              type="button"
              disabled={disabled || !file}
              onClick={() => setStrength(DEFAULT_STRENGTH)}
              className="rounded-md px-2 py-1 text-xs text-text-subtle underline underline-offset-2 transition-colors hover:text-amber-400 disabled:opacity-40"
            >
              Reset to default
            </button>
          </div>

          {risk ? (
            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-amber-400/90">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {risk}
            </p>
          ) : (
            <p className="pt-1 text-[11px] text-text-subtle">
              The default works well for most recordings — raise it only if noise is still noticeable.
            </p>
          )}
        </div>
      )}
    />
  );
}