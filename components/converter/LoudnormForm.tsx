"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ControlField, Hint, OptionCards, Stepper, type CardOption } from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE CUSTOM FIELD PRODUCED NaN AND SUBMITTED IT. Every target here is
 *    NEGATIVE, so typing one starts with "-" — and `Number("-")` is NaN, which
 *    survives clamp and roundHalf untouched. It lands in customLufs, renders
 *    the header as "NaN LUFS", and goes to the backend as `custom_lufs: "NaN"`.
 *    The custom preset's entire purpose was unreachable by typing; only the
 *    drag and the arrows worked. Same bug as VolumeForm, worse here because
 *    every legitimate value trips it.
 *
 * 2. SWITCHING TO CUSTOM THREW AWAY WHERE YOU WERE. Pick Club (-9), click
 *    Custom, and the marker jumps to -14 — customLufs' own default, unrelated
 *    to what you were just looking at. Custom is where you go to ADJUST the
 *    preset you nearly wanted, so it now starts from that value.
 *
 * 3. THE REFERENCE LABELS COLLIDED ON A PHONE. -23, -14, -9 and 0 sit at 63%,
 *    75%, 81% and 93% of a -70..+5 ruler, so "Broadcast", "Streaming" and
 *    "Club" overlap below about 400px. The words hide on small screens; the
 *    numbers, which are the part that positions anything, stay.
 *
 * 4. THE NON-NULL ASSERTIONS ARE GONE. `PRESETS.find(...)!.lufs!` was two
 *    assertions guarding an invariant nothing enforces — a preset added
 *    without a lufs value would have crashed the render rather than failed a
 *    typecheck.
 *
 * 5. A 429 NAMES THE LIMIT. Key is `loudness-normalizer`, endpoint is
 *    `loudnorm`.
 */

type Preset = "streaming" | "club" | "broadcast" | "custom";

const PRESET_LUFS: Record<Exclude<Preset, "custom">, number> = {
  streaming: -14,
  club: -9,
  broadcast: -23,
};

const PRESET_OPTIONS: CardOption<Preset>[] = [
  { value: "streaming", title: "Streaming", meta: "-14", detail: "Spotify, YouTube, Apple Music" },
  { value: "club", title: "Club / DJ", meta: "-9", detail: "Louder, club-ready masters" },
  { value: "broadcast", title: "Broadcast", meta: "-23", detail: "EBU R128 / ATSC A/85" },
  { value: "custom", title: "Custom", detail: "Set your own target" },
];

const CUSTOM_LUFS_MIN = -70;
const CUSTOM_LUFS_MAX = 5;
const KEY_STEP = 0.5;
const KEY_STEP_LARGE = 3;

const RATE_LIMIT_LABEL = getRateLimitLabel("loudness-normalizer");

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

/** Snaps to the nearest half-dB and refuses NaN — the guard the old custom
 *  field was missing, which is how "NaN LUFS" reached the request body. */
function normalizeLufs(value: number, fallback = -14): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(clamp(value, CUSTOM_LUFS_MIN, CUSTOM_LUFS_MAX) * 2) / 2;
}

/** Maps an LUFS value to a 0–100 position on the ruler. */
function percentFor(lufs: number): number {
  return clamp(((lufs - CUSTOM_LUFS_MIN) / (CUSTOM_LUFS_MAX - CUSTOM_LUFS_MIN)) * 100, 0, 100);
}

function riskFor(lufs: number): { label: string; tone: "warn" | "bad" } | null {
  if (lufs >= -1) return { label: "High clipping risk", tone: "bad" };
  if (lufs >= -6) return { label: "Loud — watch true peak", tone: "warn" };
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
      onChange(normalizeLufs(CUSTOM_LUFS_MIN + fraction * (CUSTOM_LUFS_MAX - CUSTOM_LUFS_MIN)));
    },
    [onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // pointercancel too: an interrupted drag otherwise leaves `dragging` true
    // and these listeners attached.
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, setFromClientX]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive || disabled) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(normalizeLufs(value - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(normalizeLufs(value + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(CUSTOM_LUFS_MIN);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(CUSTOM_LUFS_MAX);
    }
  };

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
            interactive &&
              !disabled &&
              "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
            dragging && "scale-110"
          )}
          style={{ left: `${percentFor(value)}%` }}
        />
      </div>

      {/* Reference labels under the ruler. The four marks sit at 63%, 75%, 81%
          and 93% of the scale, so the WORDS collide below ~400px — they hide
          on small screens and the numbers, which are what actually position
          anything, stay. */}
      <div className="relative h-8 text-[10px] text-text-subtle">
        {REFERENCE_MARKS.map((mark) => (
          <span
            key={mark.label}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap"
            style={{ left: `${percentFor(mark.lufs)}%` }}
          >
            <span className="font-mono">{mark.lufs}</span>
            <span className="hidden sm:block">{mark.label}</span>
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

  // No non-null assertions: a preset without a target falls back to the
  // custom value rather than crashing the render.
  const activeLufs = preset === "custom" ? customLufs : (PRESET_LUFS[preset] ?? customLufs);
  const risk = riskFor(activeLufs);
  const isCustom = preset === "custom";

  /**
   * Switching to Custom carries the value you were looking at.
   *
   * It used to jump to customLufs' own default, so choosing Club (-9) and then
   * Custom landed on -14 — a number you never asked for. Custom is where you
   * go to nudge the preset you nearly wanted.
   */
  const choosePreset = (next: Preset) => {
    if (next === "custom" && preset !== "custom") setCustomLufs(activeLufs);
    setPreset(next);
  };

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
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Loudness normalization is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
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
      renderControls={(_file, disabled) => (
        <div className="space-y-5">
          <ControlField as="fieldset" label="Target loudness">
            <OptionCards
              label="Loudness preset"
              options={PRESET_OPTIONS}
              value={preset}
              onChange={choosePreset}
              columns={4}
              disabled={disabled}
            />
          </ControlField>

          {/* Ruler always visible — shows where the active preset (or
              custom value) sits against real-world reference points,
              instead of a bare number with no context. */}
          <div className="rounded-xl border border-graphite-800 bg-graphite-850/60 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-text-muted">
                {isCustom ? "Drag or use arrow keys to set your target" : "Target for this preset"}
              </span>
              <span className="shrink-0 font-mono text-sm font-semibold text-amber-400">
                {activeLufs} LUFS
              </span>
            </div>

            <LoudnessRuler
              value={activeLufs}
              interactive={isCustom}
              disabled={disabled}
              onChange={setCustomLufs}
            />

            {isCustom && (
              <div className="mt-3 flex justify-center">
                {/* Every target here is negative, so typing one starts with a
                    "-". The kit's field keeps a draft while focused; the old
                    one turned that first keystroke into NaN. */}
                <Stepper
                  label="Target"
                  value={customLufs}
                  step={KEY_STEP}
                  bigStep={KEY_STEP}
                  precision={1}
                  unit="LUFS"
                  disabled={disabled}
                  onChange={(v) => setCustomLufs(normalizeLufs(v, customLufs))}
                />
              </div>
            )}

            {risk && (
              <div className="mt-3">
                <Hint tone={risk.tone}>
                  {risk.label} — targets above -6 LUFS leave little headroom before the true peak
                  clips.
                </Hint>
              </div>
            )}

            <p className="mt-2 text-[11px] leading-snug text-text-subtle">
              Lower (more negative) is quieter with more headroom. Higher (closer to 0) is louder,
              with a greater risk of clipping.
            </p>
          </div>
        </div>
      )}
    />
  );
}