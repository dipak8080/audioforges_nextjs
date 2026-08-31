"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ControlField, Hint, Segmented, useMediaDuration } from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel, getToolLimits } from "@/lib/data/tool-limits";
import { cn } from "@/lib/utils/cn";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE RATE-LIMIT PILL IS GONE, AND IT WAS WRONG ANYWAY. It read
 *    "3 req / 5 min", hardcoded. config.py has allowed 5 per 5 minutes since
 *    2026-08-22 — raised deliberately, because pitch and tempo are the only
 *    ITERATIVE tools here (+2, listen, +3, listen) and three locked people out
 *    mid-decision. So the pill understated the allowance for months, which is
 *    exactly the drift rate-limits.ts opens by warning about.
 *
 *    Removed rather than corrected. A permanent counter advertises a
 *    restriction before it is relevant — nobody hits 5-in-5-minutes on a normal
 *    pass, but everybody reads the pill — and no other tool form carries one,
 *    so it was an artifact rather than a pattern. The number now lives only in
 *    the 429 message below, where it is load-bearing and therefore cannot rot
 *    unnoticed the way a decorative one did.
 *
 * 2. THE HEADER CLAIMED TO KNOW THE SOURCE KEY. `toolMeta` rendered
 *    `noteNameFor(0) → noteNameFor(semitones)` — "C → G" for +7. The uploaded
 *    track is not in C, and nothing here has analysed it. A pitch shifter moves
 *    by an INTERVAL; naming absolute notes tells a musician something false
 *    about their own file. The interval is the honest reading and it's the one
 *    they act on.
 *
 * 3. THE KEYBOARD IS A RADIOGROUP, NOT 25 TOGGLES. `role="group"` with
 *    `aria-pressed` on every key announces twenty-five independent on/off
 *    controls that happen to have one pressed. It's a single choice from a set
 *    — which is `radiogroup` / `radio` / `aria-checked`, the same semantics
 *    PackRail and OptionCards use. The roving tab behaviour it already had is
 *    what that role promises, so the code was right and the labels were wrong.
 *
 * 4. A 429 NOW SAYS WHAT THE LIMIT IS. The form never passed
 *    `rateLimitMessage`, so hitting the limit fell back to the generic "wait
 *    for the timer" — on the tool most likely to hit one.
 *
 * 5. DEAD CONDITION REMOVED. `value < MIN_SEMITONES` in the white-key tabIndex
 *    can never be true: setSemitones clamps to the range before it ever reaches
 *    the keyboard.
 */

const MIN_SEMITONES = -12;
const MAX_SEMITONES = 12;

/* Values are strings because Segmented keys on them — the semitone is parsed
   back out on selection. A preset row IS a radiogroup (one choice, shown
   selected), which is what the hand-rolled version was missing. */
const PRESETS = [
  { value: "-12", label: "-1 oct" },
  { value: "-7", label: "-5th" },
  { value: "0", label: "Normal" },
  { value: "7", label: "+5th" },
  { value: "12", label: "+1 oct" },
] as const;

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

/** The signed shift, as a musician would write it: "+7 st". */
function signedSemitones(semitone: number): string {
  return `${semitone > 0 ? "+" : ""}${semitone} st`;
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
      keys.push({
        semitone: s,
        isWhite: true,
        leftPercent: whiteIndexGlobal * whiteWidthPercent,
        widthPercent: whiteWidthPercent,
      });
    } else {
      const offset = octave * WHITE_KEYS_PER_OCTAVE + BLACK_OFFSET_WITHIN_OCTAVE[pitchClass];
      keys.push({
        semitone: s,
        isWhite: false,
        leftPercent: offset * whiteWidthPercent,
        widthPercent: whiteWidthPercent * 0.62,
      });
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
  const geometry = useMemo(() => buildKeyboardGeometry(), []);
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
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      focusSemitone(semitone + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
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

  /** One key per press of Tab, arrows to move within — which is exactly what
   *  `radiogroup` announces, and what the handler above already implements. */
  const registerRef = (semitone: number) => (el: HTMLButtonElement | null) => {
    if (el) buttonRefs.current.set(semitone, el);
    else buttonRefs.current.delete(semitone);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Pitch shift, in semitones"
      className={cn(
        "relative h-24 select-none overflow-hidden rounded-lg bg-graphite-950/40",
        disabled && "opacity-50"
      )}
    >
      {/* White keys — sequential, non-overlapping */}
      <div className="absolute inset-0 flex">
        {whiteKeys.map((key) => {
          const selected = key.semitone === value;
          return (
            <button
              key={key.semitone}
              ref={registerRef(key.semitone)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              aria-label={`${noteNameFor(key.semitone)}, ${intervalNameFor(key.semitone)}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(key.semitone)}
              onKeyDown={handleKeyDown(key.semitone)}
              style={{ width: `${key.widthPercent}%` }}
              className={cn(
                "relative flex h-full flex-col items-center justify-end border-r border-graphite-800 pb-1.5 transition-colors last:border-r-0",
                "focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/50",
                selected ? "bg-amber-500/25" : "bg-graphite-100/[0.04] hover:bg-graphite-100/[0.08]",
                !disabled && "cursor-pointer"
              )}
            >
              {key.semitone === 0 && (
                <span className="absolute top-1.5 h-1 w-1 rounded-full bg-text-subtle" aria-hidden />
              )}
              <span
                className={cn(
                  "font-mono text-[9px]",
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
              ref={registerRef(key.semitone)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
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

const RATE_LIMIT_LABEL = getRateLimitLabel("pitch");

/**
 * The backend enforces this per-tool now (AUDIO_TOOL_MAX_DURATION_SECONDS,
 * wired into the submit path 2026-08-30). Read from TOOL_LIMITS rather than
 * typed here, so the number lives in one place — the same rule the rate limit
 * follows two lines up.
 */
const MAX_DURATION_SECONDS = getToolLimits("pitch")?.maxTotalDurationSeconds ?? 900;
const MAX_DURATION_LABEL = getDurationLabel("pitch") ?? "15 minutes";

function formatClock(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

export function PitchForm() {
  const [semitones, setSemitonesState] = useState(0);
  /**
   * Set by renderControls, read by buildExtraFields. The duration probe needs
   * the file, and only renderControls is handed one.
   */
  const [file, setFile] = useState<File | null>(null);
  const duration = useMediaDuration(file);
  // null means the browser couldn't decode the container — let the server
  // decide rather than blocking a file that may be perfectly valid.
  const tooLong = duration !== null && duration > MAX_DURATION_SECONDS;
  const setSemitones = (v: number) =>
    setSemitonesState(Math.min(Math.max(v, MIN_SEMITONES), MAX_SEMITONES));

  const direction =
    semitones > 0 ? "text-amber-400" : semitones < 0 ? "text-teal-400" : "text-text-muted";

  return (
    <JobToolForm
      endpoint="pitch"
      pollIntervalMs={2500}
      toolLabel="Pitch shifter"
      /* Was `C → G`. Nothing here has analysed the upload, so naming absolute
         notes asserts a source key this tool does not know. An interval is what
         it actually does and what the user chose. */
      toolMeta={semitones === 0 ? "no change" : `${signedSemitones(semitones)} · ${intervalNameFor(semitones)}`}
      submitLabel="Shift pitch"
      processingLabel="Shifting pitch"
      expectedRange="can take a moment on longer files"
      resultVerb="Pitch shifted"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Pitch shifting is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Shifting the pitch" },
        { at: 10, label: "Resynthesizing the waveform" },
        { at: 18, label: "Writing the output file" },
      ]}
      /*
        THE UPLOAD IS THE EXPENSIVE PART, AND THE SERVER CANNOT SKIP IT.
        Its duration check runs ffprobe on a file already written to disk, so a
        40-minute upload transfers in full and is rejected at the end. The
        browser knows the length before the first byte leaves, so the submit is
        blocked here instead.
      */
      buildExtraFields={() => (tooLong ? null : { semitones: String(semitones) })}
      missingFieldsMessage={
        tooLong && duration !== null
          ? `This file is ${formatClock(duration)}. Pitch shifting is limited to ${MAX_DURATION_LABEL} — trim it first, then shift.`
          : undefined
      }
      renderControls={(selected, disabled) => (
        <ControlField
          as="fieldset"
          label="Pitch shift"
          meta={
            <span className={cn("text-[13px] font-semibold", direction)}>
              {signedSemitones(semitones)} · {intervalNameFor(semitones)}
            </span>
          }
          hint="Click a key or arrow through them, then apply once you're happy."
        >
          <FileWatcher file={selected} onFile={setFile} />

          {tooLong && duration !== null && (
            <Hint tone="bad" title={`Too long for pitch shifting (${formatClock(duration)})`}>
              The limit is {MAX_DURATION_LABEL}. Trim the section you need first — nothing has
              been uploaded.
            </Hint>
          )}

          <PianoKeyboard
            value={semitones}
            disabled={disabled || !selected}
            onChange={setSemitones}
          />

          <div className="pt-2">
            <Segmented
              label="Pitch presets"
              options={PRESETS.map((preset) => ({
                value: preset.value,
                label: preset.label,
                ariaLabel: `Set pitch to ${intervalNameFor(Number(preset.value))}`,
              }))}
              /* An empty value when the current shift isn't a preset: the row
                 shows nothing selected rather than lying about which one is
                 active, which the old `semitones === preset.value` check got
                 right visually and never told assistive tech. */
              value={
                PRESETS.some((preset) => Number(preset.value) === semitones)
                  ? String(semitones)
                  : ("" as string)
              }
              onChange={(v) => setSemitones(Number(v))}
              disabled={disabled || !selected}
            />
          </div>

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
 * readable from both. A one-line effect component keeps that sync out of the
 * render body, where a setState would cascade.
 */
function FileWatcher({ file, onFile }: { file: File | null; onFile: (f: File | null) => void }) {
  useEffect(() => {
    onFile(file);
  }, [file, onFile]);
  return null;
}