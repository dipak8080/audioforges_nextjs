"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import {
  ControlField,
  Hint,
  Segmented,
  Stepper,
  useMediaDuration,
} from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel, getToolLimits } from "@/lib/data/tool-limits";
import { cn } from "@/lib/utils/cn";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE PERCENT BOX COULD NOT BE TYPED INTO. `onChange` ran
 *    `clamp(Number(value) / 100, 0.5, 2)` on every keystroke against a
 *    controlled input — so typing "125" went: "1" → 1% → clamped to 50% → the
 *    box was rewritten to "50" under the cursor before the second key landed.
 *    Every value in the range was reachable only by dragging or by the arrows.
 *    The shared Stepper now holds a draft while the field has focus, commits
 *    each keystroke, and snaps to the clamped value on blur.
 *
 * 2. `formatDuration` COULD PRINT "1:60". It used `Math.round(seconds % 60)`,
 *    so 119.7s rendered as 1:60 instead of 2:00 — and this component's whole
 *    job is showing a predicted length, which lands on fractional seconds
 *    almost every time. TrimForm's copy of this function uses floor and is
 *    correct; this one drifted.
 *
 * 3. THE RATE-LIMIT PILL IS GONE, AND IT WAS WRONG. "3 req / 5 min" hardcoded,
 *    while config.py has allowed 5 per 5 minutes since 2026-08-22 — raised
 *    deliberately because tempo and pitch are the only ITERATIVE tools here.
 *    Removed rather than corrected, for the reasons in PitchForm: a permanent
 *    counter advertises a restriction before it is relevant, no other tool
 *    form carries one, and a decorative number rots unnoticed. The figure now
 *    appears only in the 429 message, read from RATE_LIMITS.
 *
 * 4. THE HAND-ROLLED STEPPER IS THE SHARED ONE. Same three-part control
 *    TrimForm had, third copy on the site.
 *
 * WHY SpeedMeter IS NOT ThresholdMeter: that control rounds to whole numbers
 * (`Math.round` on every change), which is right for dB and destroys a 0.01
 * factor. Expressing tempo in percent would fit its rounding, but its zone
 * thirds would then label 100% as "slower" — the boundary falls exactly there.
 * A shared control that needs its maths bent to fit isn't shared, it's copied.
 */

const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.0;
const KEY_STEP = 0.01;
const KEY_STEP_LARGE = 0.1;

/* Keyed by percent as a string — Segmented compares strings, and percent is
   the unit this control speaks in everywhere else. */
const PRESETS = [
  { value: "50", label: "50%" },
  { value: "75", label: "75%" },
  { value: "100", label: "100%" },
  { value: "125", label: "125%" },
  { value: "200", label: "200%" },
] as const;

const RATE_LIMIT_LABEL = getRateLimitLabel("tempo");

/**
 * Enforced per-tool by the backend since 2026-08-30
 * (AUDIO_TOOL_MAX_DURATION_SECONDS, now wired into the submit path). Read from
 * TOOL_LIMITS so the figure lives in one place.
 */
const MAX_DURATION_SECONDS = getToolLimits("tempo")?.maxTotalDurationSeconds ?? 900;
const MAX_DURATION_LABEL = getDurationLabel("tempo") ?? "15 minutes";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds to a whole second FIRST, then splits — otherwise 119.7s renders as
 *  "1:60", because the minutes come from the unrounded value and the seconds
 *  from a rounded remainder. */
function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDelta(originalSeconds: number, newSeconds: number): string {
  const delta = newSeconds - originalSeconds;
  const sign = delta < 0 ? "-" : "+";
  return `${sign}${formatDuration(Math.abs(delta))}`;
}

/** 0.5 → 2.0 held to two decimals, so preset equality checks stay exact. */
function roundFactor(v: number): number {
  return Math.round(clamp(v, MIN_FACTOR, MAX_FACTOR) * 100) / 100;
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

  const percentFor = (v: number) =>
    clamp(((v - MIN_FACTOR) / (MAX_FACTOR - MIN_FACTOR)) * 100, 0, 100);

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      onChange(roundFactor(MIN_FACTOR + fraction * (MAX_FACTOR - MIN_FACTOR)));
    },
    [onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // pointercancel too: a drag interrupted by a system gesture or a
    // scroll takeover otherwise leaves `dragging` true and the window
    // listeners attached until the next pointerup anywhere on the page.
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, setFromClientX]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(roundFactor(value - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(roundFactor(value + step));
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
          aria-valuetext={`${Math.round(value * 100)} percent`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-graphite-900 shadow-sm transition-transform focus:outline-none",
            value > 1 ? "border-amber-500" : value < 1 ? "border-teal-400" : "border-text-subtle",
            !disabled &&
              "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
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

function DurationPreview({
  originalDuration,
  tempoFactor,
}: {
  originalDuration: number;
  tempoFactor: number;
}) {
  const newDuration = originalDuration / tempoFactor;

  return (
    <div className="flex items-center justify-between rounded-xl border border-graphite-800 bg-graphite-850/60 px-3.5 py-2.5">
      <div className="flex items-baseline gap-2 font-mono text-sm">
        <span className="text-text-subtle line-through decoration-text-subtle/50">
          {formatDuration(originalDuration)}
        </span>
        <span className="text-text-subtle" aria-hidden>
          →
        </span>
        <span
          className={cn(
            "font-semibold",
            tempoFactor > 1 ? "text-amber-400" : tempoFactor < 1 ? "text-teal-400" : "text-text-primary"
          )}
        >
          {formatDuration(newDuration)}
        </span>
      </div>
      {tempoFactor !== 1 && (
        <span className="font-mono text-xs text-text-subtle">
          {formatDelta(originalDuration, newDuration)}
        </span>
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
  /**
   * Lifted out of DurationPreview. It probed the file itself, which was one
   * decode; the duration gate needs the same number at submit time, where
   * DurationPreview's state is unreachable. One probe, two readers.
   */
  const [file, setFile] = useState<File | null>(null);
  const duration = useMediaDuration(file);
  // null means the browser couldn't decode the container — let the server
  // decide rather than blocking a file that may be perfectly valid.
  const tooLong = duration !== null && duration > MAX_DURATION_SECONDS;

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
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Speed changes are limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Time-stretching" },
        { at: 10, label: "Writing the output file" },
      ]}
      /*
        THE UPLOAD IS THE EXPENSIVE PART, AND THE SERVER CANNOT SKIP IT. Its
        duration check runs ffprobe on a file already written to disk, so a
        40-minute upload transfers in full and is rejected at the end. The
        browser knows the length before the first byte leaves.
      */
      buildExtraFields={() => (tooLong ? null : { tempo_factor: String(tempoFactor) })}
      missingFieldsMessage={
        tooLong && duration !== null
          ? `This file is ${formatDuration(duration)}. Speed changes are limited to ${MAX_DURATION_LABEL} — trim it first.`
          : undefined
      }
      renderControls={(selected, disabled) => (
        <ControlField
          as="fieldset"
          label="Speed"
          meta={
            <span
              className={cn(
                "text-[13px] font-semibold",
                tempoFactor > 1
                  ? "text-amber-400"
                  : tempoFactor < 1
                    ? "text-teal-400"
                    : "text-text-muted"
              )}
            >
              {percent}%
            </span>
          }
          hint="Adjust, then apply once you're happy with the value."
        >
          <FileWatcher file={selected} onFile={setFile} />

          {tooLong && duration !== null && (
            <Hint tone="bad" title={`Too long for a speed change (${formatDuration(duration)})`}>
              The limit is {MAX_DURATION_LABEL}. Trim the section you need first — nothing has
              been uploaded.
            </Hint>
          )}

          <SpeedMeter
            value={tempoFactor}
            disabled={disabled || !selected}
            onChange={setTempoFactor}
          />

          <div className="flex justify-center pt-1">
            {/* Percent, not factor: it's the unit the whole control speaks in,
                and 125 is a number people type. The kit's field keeps a draft
                while focused, which is what makes it typable at all under a
                clamp — see the note in ToolControls. */}
            <Stepper
              label="Speed"
              value={percent}
              step={1}
              bigStep={KEY_STEP_LARGE * 100}
              precision={0}
              unit="%"
              disabled={disabled || !selected}
              onChange={(v) => setTempoFactor(roundFactor(v / 100))}
            />
          </div>

          <div className="pt-1">
            <Segmented
              label="Speed presets"
              mono
              options={PRESETS.map((preset) => ({
                value: preset.value,
                label: preset.label,
                ariaLabel: `Set speed to ${preset.value} percent`,
              }))}
              value={PRESETS.some((p) => p.value === String(percent)) ? String(percent) : ""}
              onChange={(v) => setTempoFactor(roundFactor(Number(v) / 100))}
              disabled={disabled || !selected}
            />
          </div>

          {duration !== null ? (
            <DurationPreview originalDuration={duration} tempoFactor={tempoFactor} />
          ) : (
            <p className="text-xs text-text-subtle">
              {selected
                ? "Reading the file length…"
                : "Upload a file to see the predicted output length."}
            </p>
          )}
        </ControlField>
      )}
    />
  );
}

/**
 * Mirrors the shell's file into this component's state.
 *
 * renderControls hands the file down as an argument; buildExtraFields is a
 * sibling callback that never sees it, and the duration gate has to be
 * readable from both.
 */
function FileWatcher({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  useEffect(() => {
    onFile(file);
  }, [file, onFile]);
  return null;
}