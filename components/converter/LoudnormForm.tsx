"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

type Preset = "streaming" | "club" | "broadcast" | "custom";

interface PresetSpec {
  value: Preset;
  label: string;
  lufs: number | null;
  description: string;
}

const PRESETS: PresetSpec[] = [
  { value: "streaming", label: "Streaming", lufs: -14, description: "Spotify, YouTube, Apple Music" },
  { value: "club", label: "Club / DJ", lufs: -9, description: "Louder, club-ready masters" },
  { value: "broadcast", label: "Broadcast", lufs: -23, description: "EBU R128 / ATSC A/85" },
  { value: "custom", label: "Custom", lufs: null, description: "Set your own target" },
];

const CUSTOM_LUFS_MIN = -70;
const CUSTOM_LUFS_MAX = 5;
const KEY_STEP = 0.5;
const KEY_STEP_LARGE = 3;

// Reference points plotted on the ruler regardless of which preset is
// active, so "-14" always reads against something instead of floating
// in isolation.
const REFERENCE_MARKS: { lufs: number; label: string }[] = [
  { lufs: -23, label: "Broadcast" },
  { lufs: -14, label: "Streaming" },
  { lufs: -9, label: "Club" },
  { lufs: 0, label: "0 dBFS" },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Maps an LUFS value to a 0–100 position on the ruler. */
function percentFor(lufs: number): number {
  return clamp(((lufs - CUSTOM_LUFS_MIN) / (CUSTOM_LUFS_MAX - CUSTOM_LUFS_MIN)) * 100, 0, 100);
}

function riskFor(lufs: number): { label: string; tone: string } | null {
  if (lufs >= -1) return { label: "High clipping risk", tone: "text-red-400" };
  if (lufs >= -6) return { label: "Loud — watch true peak", tone: "text-amber-400" };
  return null;
}

/* ------------------------------------------------------------------ */
/* Ruler                                                                */
/* ------------------------------------------------------------------ */

interface LoudnessRulerProps {
  value: number;
  interactive: boolean;
  disabled: boolean;
  onChange: (v: number) => void;
}

function LoudnessRuler({ value, interactive, disabled, onChange }: LoudnessRulerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      const lufs = CUSTOM_LUFS_MIN + fraction * (CUSTOM_LUFS_MAX - CUSTOM_LUFS_MIN);
      onChange(roundHalf(clamp(lufs, CUSTOM_LUFS_MIN, CUSTOM_LUFS_MAX)));
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
    if (!interactive || disabled) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(roundHalf(clamp(value - step, CUSTOM_LUFS_MIN, CUSTOM_LUFS_MAX)));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(roundHalf(clamp(value + step, CUSTOM_LUFS_MIN, CUSTOM_LUFS_MAX)));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(CUSTOM_LUFS_MIN);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(CUSTOM_LUFS_MAX);
    }
  };

  const markerPercent = percentFor(value);

  return (
    <div className="space-y-2 pt-1">
      <div
        ref={trackRef}
        className={cn("relative h-2.5 rounded-full", interactive && !disabled && "cursor-pointer")}
        style={{
          background:
            "linear-gradient(to right, rgb(45 212 191 / 0.35), rgb(245 158 11 / 0.45) 70%, rgb(248 113 113 / 0.55))",
        }}
        onPointerDown={(e) => {
          if (!interactive || disabled) return;
          setDragging(true);
          setFromClientX(e.clientX);
        }}
      >
        {/* Reference tick marks */}
        {REFERENCE_MARKS.map((mark) => (
          <div
            key={mark.label}
            className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-graphite-950/50"
            style={{ left: `${percentFor(mark.lufs)}%` }}
          />
        ))}

        {/* Target marker */}
        <div
          role={interactive ? "slider" : undefined}
          aria-label={interactive ? "Target LUFS" : undefined}
          aria-valuemin={interactive ? CUSTOM_LUFS_MIN : undefined}
          aria-valuemax={interactive ? CUSTOM_LUFS_MAX : undefined}
          aria-valuenow={interactive ? value : undefined}
          aria-valuetext={interactive ? `${value} LUFS` : undefined}
          tabIndex={interactive && !disabled ? 0 : -1}
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-500 bg-graphite-900 shadow-sm transition-transform focus:outline-none",
            interactive && !disabled && "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
            dragging && "scale-110"
          )}
          style={{ left: `${markerPercent}%` }}
        />
      </div>

      {/* Reference labels under the ruler */}
      <div className="relative h-8 text-[10px] text-text-subtle">
        {REFERENCE_MARKS.map((mark) => (
          <span
            key={mark.label}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap"
            style={{ left: `${percentFor(mark.lufs)}%` }}
          >
            <span className="font-mono">{mark.lufs}</span>
            <span>{mark.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function LoudnormForm() {
  const [preset, setPreset] = useState<Preset>("streaming");
  const [customLufs, setCustomLufs] = useState(-14);

  const activeLufs = preset === "custom" ? customLufs : PRESETS.find((p) => p.value === preset)!.lufs!;
  const risk = riskFor(activeLufs);

  return (
    <JobToolForm
      endpoint="loudnorm"
      pollIntervalMs={2500}
      submitTimeoutMs={90_000}
      toolLabel="Loudness normalizer"
      toolMeta={`→ ${activeLufs} LUFS`}
      submitLabel="Normalize loudness"
      processingLabel="Measuring and normalizing loudness"
      expectedRange="10–30 seconds — two-pass analysis"
      resultVerb="Normalized"
      stages={[
        { at: 0, label: "First pass — measuring loudness" },
        { at: 6, label: "Calculating the gain curve" },
        { at: 12, label: "Second pass — applying normalization" },
        { at: 20, label: "Writing the output file" },
      ]}
      buildExtraFields={(): Record<string, string> => {
        if (preset === "custom") return { custom_lufs: String(customLufs) };
        return { preset };
      }}
      renderControls={(file, disabled) => (
        <div className="space-y-5">
          <fieldset className="space-y-2" disabled={disabled}>
            <legend className="mb-2 text-sm font-medium text-text-primary">Target loudness</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Loudness preset">
              {PRESETS.map((p) => {
                const selected = preset === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPreset(p.value)}
                    disabled={disabled}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-all",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      selected
                        ? "border-amber-500/60 bg-amber-500/[0.07]"
                        : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          selected ? "text-amber-400" : "text-text-primary"
                        )}
                      >
                        {p.label}
                      </span>
                      {p.lufs !== null && (
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            selected ? "text-amber-500/80" : "text-text-subtle"
                          )}
                        >
                          {p.lufs}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-text-muted">{p.description}</p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Ruler always visible — shows where the active preset (or
              custom value) sits against real-world reference points,
              instead of a bare number with no context. */}
          <div className="rounded-lg border border-graphite-800 bg-graphite-850/60 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-text-muted">
                {preset === "custom" ? "Drag or use arrow keys to set your target" : "Target for this preset"}
              </span>
              <span className="font-mono text-sm font-semibold text-amber-400">{activeLufs} LUFS</span>
            </div>

            <LoudnessRuler
              value={activeLufs}
              interactive={preset === "custom"}
              disabled={disabled}
              onChange={setCustomLufs}
            />

            {preset === "custom" && (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
                  <input
                    type="number"
                    min={CUSTOM_LUFS_MIN}
                    max={CUSTOM_LUFS_MAX}
                    step={0.5}
                    value={customLufs}
                    disabled={disabled}
                    onChange={(e) =>
                      setCustomLufs(roundHalf(clamp(Number(e.target.value), CUSTOM_LUFS_MIN, CUSTOM_LUFS_MAX)))
                    }
                    className="w-16 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="flex flex-col border-l border-graphite-700">
                    <button
                      type="button"
                      aria-label="Increase target LUFS"
                      disabled={disabled}
                      onClick={() => setCustomLufs((v) => roundHalf(clamp(v + KEY_STEP, CUSTOM_LUFS_MIN, CUSTOM_LUFS_MAX)))}
                      className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                    >
                      <ChevronUp className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Decrease target LUFS"
                      disabled={disabled}
                      onClick={() => setCustomLufs((v) => roundHalf(clamp(v - KEY_STEP, CUSTOM_LUFS_MIN, CUSTOM_LUFS_MAX)))}
                      className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                    >
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </span>
                </span>
                <span className="text-xs text-text-subtle">LUFS</span>
              </div>
            )}

            {risk && (
              <p className={cn("mt-3 flex items-start gap-1.5 text-[11px]", risk.tone)}>
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {risk.label} — targets above -6 LUFS leave little headroom before the true peak clips.
              </p>
            )}

            <p className="mt-2 text-[11px] leading-snug text-text-subtle">
              Lower (more negative) is quieter with more headroom. Higher (closer to 0) is louder, with
              a greater risk of clipping.
            </p>
          </div>
        </div>
      )}
    />
  );
}