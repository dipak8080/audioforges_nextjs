"use client";

import { useMemo, useRef, useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

const MIN_SEMITONES = -12;
const MAX_SEMITONES = 12;

const PRESETS: { label: string; value: number }[] = [
  { label: "-1 oct", value: -12 },
  { label: "-5th", value: -7 },
  { label: "Normal", value: 0 },
  { label: "+5th", value: 7 },
  { label: "+1 oct", value: 12 },
];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const WHITE_INDEX_WITHIN_OCTAVE: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };
// Approximate standard piano-key geometry: black key center offset,
// measured in white-key-width units from the start of its octave.
const BLACK_OFFSET_WITHIN_OCTAVE: Record<number, number> = { 1: 0.65, 3: 1.65, 6: 3.6, 8: 4.55, 10: 5.55 };
const WHITE_KEYS_PER_OCTAVE = 7;

const INTERVAL_NAMES: Record<number, string> = {
  0: "Unison",
  1: "Minor 2nd",
  2: "Major 2nd",
  3: "Minor 3rd",
  4: "Major 3rd",
  5: "Perfect 4th",
  6: "Tritone",
  7: "Perfect 5th",
  8: "Minor 6th",
  9: "Major 6th",
  10: "Minor 7th",
  11: "Major 7th",
  12: "Octave",
};

function noteNameFor(semitone: number): string {
  const pitchClass = ((semitone % 12) + 12) % 12;
  return NOTE_NAMES[pitchClass];
}

function intervalNameFor(semitone: number): string {
  const name = INTERVAL_NAMES[Math.abs(semitone)] ?? `${Math.abs(semitone)} semitones`;
  if (semitone === 0) return name;
  return `${name} ${semitone > 0 ? "up" : "down"}`;
}

interface KeyGeometry {
  semitone: number;
  isWhite: boolean;
  leftPercent: number;
  widthPercent: number;
}

/** Lays out -12..+12 semitones as a real two-octave piano, white keys
 *  sequential and black keys positioned over their boundaries — this is
 *  what makes "+7" legible as "a fifth up" at a glance instead of a
 *  number you have to mentally translate every time. */
function buildKeyboardGeometry(): KeyGeometry[] {
  const totalWhiteKeys =
    Math.floor((MAX_SEMITONES - MIN_SEMITONES) / 12) * WHITE_KEYS_PER_OCTAVE + 1;
  const whiteWidthPercent = 100 / totalWhiteKeys;

  const keys: KeyGeometry[] = [];
  for (let s = MIN_SEMITONES; s <= MAX_SEMITONES; s++) {
    const pitchClass = ((s % 12) + 12) % 12;
    const octave = Math.floor((s - MIN_SEMITONES) / 12);
    const isWhite = WHITE_PITCH_CLASSES.has(pitchClass);

    if (isWhite) {
      const whiteIndexGlobal = octave * WHITE_KEYS_PER_OCTAVE + WHITE_INDEX_WITHIN_OCTAVE[pitchClass];
      keys.push({ semitone: s, isWhite: true, leftPercent: whiteIndexGlobal * whiteWidthPercent, widthPercent: whiteWidthPercent });
    } else {
      const offset = octave * WHITE_KEYS_PER_OCTAVE + BLACK_OFFSET_WITHIN_OCTAVE[pitchClass];
      keys.push({ semitone: s, isWhite: false, leftPercent: offset * whiteWidthPercent, widthPercent: whiteWidthPercent * 0.62 });
    }
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* Keyboard visual                                                     */
/* ------------------------------------------------------------------ */

interface PianoKeyboardProps {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}

function PianoKeyboard({ value, disabled, onChange }: PianoKeyboardProps) {
  const geometry = useMemo(buildKeyboardGeometry, []);
  const whiteKeys = geometry.filter((k) => k.isWhite);
  const blackKeys = geometry.filter((k) => !k.isWhite);
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const focusSemitone = (semitone: number) => {
    const clamped = Math.min(Math.max(semitone, MIN_SEMITONES), MAX_SEMITONES);
    onChange(clamped);
    buttonRefs.current.get(clamped)?.focus();
  };

  const handleKeyDown = (semitone: number) => (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusSemitone(semitone + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusSemitone(semitone - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusSemitone(MIN_SEMITONES);
    } else if (e.key === "End") {
      e.preventDefault();
      focusSemitone(MAX_SEMITONES);
    }
  };

  return (
    <div
      role="group"
      aria-label="Pitch shift keyboard"
      className={cn("relative h-24 select-none rounded-md bg-graphite-950/40", disabled && "opacity-50")}
    >
      {/* White keys — sequential, non-overlapping */}
      <div className="absolute inset-0 flex">
        {whiteKeys.map((key) => {
          const selected = key.semitone === value;
          return (
            <button
              key={key.semitone}
              ref={(el) => {
                if (el) buttonRefs.current.set(key.semitone, el);
              }}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${noteNameFor(key.semitone)}, ${intervalNameFor(key.semitone)}`}
              tabIndex={selected || (value < MIN_SEMITONES && key.semitone === MIN_SEMITONES) ? 0 : -1}
              onClick={() => onChange(key.semitone)}
              onKeyDown={handleKeyDown(key.semitone)}
              style={{ width: `${key.widthPercent}%` }}
              className={cn(
                "relative flex h-full flex-col items-center justify-end border-r border-graphite-800 pb-1.5 transition-colors last:border-r-0",
                "focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-inset",
                selected ? "bg-amber-500/25" : "bg-graphite-100/[0.04] hover:bg-graphite-100/[0.08]",
                !disabled && "cursor-pointer"
              )}
            >
              {key.semitone === 0 && (
                <span className="absolute top-1.5 h-1 w-1 rounded-full bg-text-subtle" aria-hidden />
              )}
              <span
                className={cn(
                  "text-[9px] font-mono",
                  selected ? "font-semibold text-amber-400" : "text-text-subtle"
                )}
              >
                {noteNameFor(key.semitone)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Black keys, overlaid */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%]">
        {blackKeys.map((key) => {
          const selected = key.semitone === value;
          return (
            <button
              key={key.semitone}
              ref={(el) => {
                if (el) buttonRefs.current.set(key.semitone, el);
              }}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${noteNameFor(key.semitone)}, ${intervalNameFor(key.semitone)}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(key.semitone)}
              onKeyDown={handleKeyDown(key.semitone)}
              style={{ left: `${key.leftPercent}%`, width: `${key.widthPercent}%` }}
              className={cn(
                "pointer-events-auto absolute top-0 h-full rounded-b-sm border border-graphite-950 shadow-sm transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
                selected ? "bg-amber-500" : "bg-graphite-950 hover:bg-graphite-900",
                !disabled && "cursor-pointer"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function PitchForm() {
  const [semitones, setSemitonesState] = useState(0);
  const setSemitones = (v: number) => setSemitonesState(Math.min(Math.max(v, MIN_SEMITONES), MAX_SEMITONES));

  const direction = semitones > 0 ? "text-amber-400" : semitones < 0 ? "text-teal-400" : "text-text-muted";

  return (
    <JobToolForm
      endpoint="pitch"
      pollIntervalMs={2500}
      toolLabel="Pitch shifter"
      toolMeta={`${noteNameFor(0)} → ${noteNameFor(semitones)}`}
      submitLabel="Shift pitch"
      processingLabel="Shifting pitch"
      expectedRange="can take a moment on longer files"
      resultVerb="Pitch shifted"
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Shifting the pitch" },
        { at: 10, label: "Resynthesizing the waveform" },
        { at: 18, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ semitones: String(semitones) })}
      renderControls={(file, disabled) => (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">Pitch shift</label>
            <span className={cn("font-mono text-sm font-semibold", direction)}>
              {semitones > 0 ? "+" : ""}
              {semitones} st · {intervalNameFor(semitones)}
            </span>
          </div>

          <PianoKeyboard value={semitones} disabled={disabled || !file} onChange={setSemitones} />

          <div className="flex gap-1.5 pt-1">
            {PRESETS.map((preset) => {
              const selected = semitones === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setSemitones(preset.value)}
                  disabled={disabled || !file}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
                    selected
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                      : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] leading-snug text-text-subtle">
              Click a key or arrow through them, then apply once you&apos;re happy with the value.
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