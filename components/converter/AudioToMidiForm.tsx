"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Music4, RotateCcw } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";

/**
 * PLACEHOLDER COPY - every string in TOOL_COPY below is a placeholder,
 * not final. Swap for real values once ranking keywords / actual
 * processing-time numbers are available. Kept in one block up top
 * specifically so it's a one-spot edit rather than hunting through JSX.
 */
const TOOL_COPY = {
  submitLabel: "Convert to MIDI",
  toolLabel: "Audio to MIDI",
  toolMeta: "up to 10 min input",
  processingLabel: "Transcribing notes",
  expectedRange: "a few seconds to a couple minutes",
  resultVerb: "Transcribed",
};

/* ------------------------------------------------------------------ *
 * Pitch helpers
 *
 * The backend takes minimum_frequency / maximum_frequency in Hz, but Hz
 * is a terrible unit for a musician to reason about. Everything below
 * works in MIDI note numbers and converts to Hz only at submit time.
 * ------------------------------------------------------------------ */

const MIDI_LOW = 21; // A0
const MIDI_HIGH = 108; // C8
const HZ_FLOOR = 20;
const HZ_CEIL = 20000;

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11]);

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const midiToName = (m: number) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);

const clampHz = (hz: number) =>
  Math.min(HZ_CEIL, Math.max(HZ_FLOOR, Math.round(hz * 10) / 10));

/* Keyboard geometry, computed once at module scope - it never changes. */
const ALL_NOTES = Array.from({ length: MIDI_HIGH - MIDI_LOW + 1 }, (_, i) => MIDI_LOW + i);
const WHITE_NOTES = ALL_NOTES.filter((n) => WHITE_PC.has(n % 12));
const BLACK_NOTES = ALL_NOTES.filter((n) => !WHITE_PC.has(n % 12));
const WHITE_W = 100 / WHITE_NOTES.length;
const BLACK_W = WHITE_W * 0.62;
const WHITE_INDEX = new Map(WHITE_NOTES.map((n, i) => [n, i] as const));
const OCTAVE_MARKS = WHITE_NOTES.filter((n) => n % 12 === 0);

/** Left edge + width of a key, as a percentage of the keyboard width. */
function noteBounds(n: number) {
  if (WHITE_PC.has(n % 12)) {
    const i = WHITE_INDEX.get(n) ?? 0;
    return { left: i * WHITE_W, width: WHITE_W };
  }
  // Every black key sits immediately above a white key, so anchor to that.
  const i = WHITE_INDEX.get(n - 1) ?? 0;
  return { left: (i + 1) * WHITE_W - BLACK_W / 2, width: BLACK_W };
}

/* ------------------------------------------------------------------ *
 * Settings model
 * ------------------------------------------------------------------ */

type Settings = {
  onsetThreshold: number;
  frameThreshold: number;
  minimumNoteLength: number;
  limitPitch: boolean;
  lowNote: number;
  highNote: number;
};

const DEFAULTS: Settings = {
  onsetThreshold: 0.5,
  frameThreshold: 0.3,
  minimumNoteLength: 127.7,
  limitPitch: false,
  lowNote: MIDI_LOW,
  highNote: MIDI_HIGH,
};

type Preset = { id: string; label: string; blurb: string; values: Settings };

const PRESETS: Preset[] = [
  {
    id: "default",
    label: "Balanced",
    blurb: "Even-handed first pass on any source.",
    values: DEFAULTS,
  },
  {
    id: "piano",
    label: "Piano & keys",
    blurb: "Keeps fast passages, full keyboard range.",
    values: {
      onsetThreshold: 0.45,
      frameThreshold: 0.3,
      minimumNoteLength: 60,
      limitPitch: true,
      lowNote: 21,
      highNote: 108,
    },
  },
  {
    id: "vocal",
    label: "Vocal & lead",
    blurb: "One line at a time, longer sustained notes.",
    values: {
      onsetThreshold: 0.4,
      frameThreshold: 0.25,
      minimumNoteLength: 140,
      limitPitch: true,
      lowNote: 40,
      highNote: 84,
    },
  },
  {
    id: "bass",
    label: "Bass",
    blurb: "Low register only, drops upper harmonics.",
    values: {
      onsetThreshold: 0.55,
      frameThreshold: 0.3,
      minimumNoteLength: 110,
      limitPitch: true,
      lowNote: 28,
      highNote: 60,
    },
  },
  {
    id: "guitar",
    label: "Guitar",
    blurb: "Chords and single notes across the mid range.",
    values: {
      onsetThreshold: 0.45,
      frameThreshold: 0.3,
      minimumNoteLength: 80,
      limitPitch: true,
      lowNote: 40,
      highNote: 88,
    },
  },
  {
    id: "dense",
    label: "Arps & fast runs",
    blurb: "Catches more notes. Expect more stray ones too.",
    values: {
      onsetThreshold: 0.3,
      frameThreshold: 0.2,
      minimumNoteLength: 40,
      limitPitch: false,
      lowNote: 21,
      highNote: 108,
    },
  },
];

const sameSettings = (a: Settings, b: Settings) =>
  a.onsetThreshold === b.onsetThreshold &&
  a.frameThreshold === b.frameThreshold &&
  a.minimumNoteLength === b.minimumNoteLength &&
  a.limitPitch === b.limitPitch &&
  (!a.limitPitch || (a.lowNote === b.lowNote && a.highNote === b.highNote));

function thresholdWord(v: number) {
  if (v <= 0.25) return "Very sensitive";
  if (v <= 0.4) return "Sensitive";
  if (v <= 0.6) return "Balanced";
  if (v <= 0.8) return "Strict";
  return "Very strict";
}

/* Rough musical equivalent, so "127.7 ms" means something to a producer. */
const DIVISIONS = [
  { label: "1/64", ms: 31.25 },
  { label: "1/32", ms: 62.5 },
  { label: "1/16", ms: 125 },
  { label: "1/8", ms: 250 },
  { label: "1/4", ms: 500 },
  { label: "1/2", ms: 1000 },
];

function nearestDivision(ms: number) {
  return DIVISIONS.reduce((best, d) =>
    Math.abs(d.ms - ms) < Math.abs(best.ms - ms) ? d : best,
  ).label;
}

/* ------------------------------------------------------------------ *
 * Shared slider styling
 *
 * Native range inputs look like a browser default no matter what, so the
 * track is drawn as a clipped background on the input itself and the
 * thumb is styled per-engine. bg-clip-content + vertical padding keeps
 * the visible track thin while the hit area stays finger-sized.
 * ------------------------------------------------------------------ */

const SLIDER_BASE =
  "h-6 w-full cursor-pointer appearance-none rounded-full bg-clip-content py-[9px] " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 " +
  "disabled:cursor-not-allowed " +
  "[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent";

const SLIDER_THUMB =
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 " +
  "[&::-webkit-slider-thumb]:border-graphite-850 [&::-webkit-slider-thumb]:bg-amber-400 " +
  "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 " +
  "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-graphite-850 [&::-moz-range-thumb]:bg-amber-400";

const AMBER = "rgb(245 158 11)";

function trackFill(pct: number) {
  return {
    backgroundImage: `linear-gradient(to right, ${AMBER} ${pct}%, rgb(255 255 255 / 0.08) ${pct}%)`,
  };
}

/* ------------------------------------------------------------------ *
 * Sub-components
 * ------------------------------------------------------------------ */

type SliderRowProps = {
  id: string;
  label: string;
  hint: string;
  readout: string;
  descriptor?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  leftEnd: string;
  rightEnd: string;
  onChange: (value: number) => void;
};

function SliderRow({
  id,
  label,
  hint,
  readout,
  descriptor,
  min,
  max,
  step,
  value,
  disabled,
  leftEnd,
  rightEnd,
  onChange,
}: SliderRowProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-text-primary">
          {label}
        </label>
        <span className="flex items-baseline gap-2">
          {descriptor && (
            <span className="text-[11px] uppercase tracking-wide text-text-subtle">
              {descriptor}
            </span>
          )}
          <span className="font-mono text-xs tabular-nums text-amber-400">{readout}</span>
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={trackFill(pct)}
        className={cn(SLIDER_BASE, SLIDER_THUMB, disabled && "opacity-40")}
      />

      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-text-subtle">
        <span>{leftEnd}</span>
        <span>{rightEnd}</span>
      </div>
      <p className="text-[11px] leading-snug text-text-subtle">{hint}</p>
    </div>
  );
}

type PitchRangeProps = {
  low: number;
  high: number;
  disabled?: boolean;
  onChange: (low: number, high: number) => void;
};

/**
 * Two stacked range inputs over a rendered keyboard. The inputs carry
 * pointer-events only on their thumbs so both stay grabbable, and each
 * handle clamps against the other so low < high always holds - which is
 * what keeps the backend's own min/max validation from ever rejecting us.
 */
function PitchRange({ low, high, disabled, onChange }: PitchRangeProps) {
  const span = MIDI_HIGH - MIDI_LOW;
  const lowPct = ((low - MIDI_LOW) / span) * 100;
  const highPct = ((high - MIDI_LOW) / span) * 100;

  const lowEdge = noteBounds(low).left;
  const highEdge = noteBounds(high).left + noteBounds(high).width;

  const inRange = (n: number) => n >= low && n <= high;

  return (
    <div className="space-y-2">
      {/* Keyboard */}
      <div className="relative h-16 overflow-hidden rounded-md border border-graphite-800 bg-graphite-850">
        <div className="absolute inset-x-0 top-0 h-12">
          {WHITE_NOTES.map((n) => {
            const { left } = noteBounds(n);
            return (
              <div
                key={n}
                style={{ left: `${left}%`, width: `${WHITE_W}%` }}
                className={cn(
                  "absolute top-0 h-full border-r border-graphite-800 transition-colors",
                  inRange(n) ? "bg-neutral-200" : "bg-neutral-500",
                )}
              />
            );
          })}
          {BLACK_NOTES.map((n) => {
            const { left } = noteBounds(n);
            return (
              <div
                key={n}
                style={{ left: `${left}%`, width: `${BLACK_W}%` }}
                className={cn(
                  "absolute top-0 h-[62%] rounded-b-sm transition-colors",
                  inRange(n) ? "bg-neutral-900" : "bg-neutral-800",
                )}
              />
            );
          })}

          {/* Excluded regions dimmed rather than hidden, so the user can
              still see how much of the keyboard they're throwing away. */}
          <div
            style={{ width: `${lowEdge}%` }}
            className="absolute left-0 top-0 h-full bg-black/65"
          />
          <div
            style={{ left: `${highEdge}%`, right: 0 }}
            className="absolute top-0 h-full bg-black/65"
          />
        </div>

        {/* Octave ruler */}
        <div className="absolute inset-x-0 bottom-0 h-4">
          {OCTAVE_MARKS.map((n) => (
            <span
              key={n}
              style={{ left: `${noteBounds(n).left}%` }}
              className={cn(
                "absolute font-mono text-[9px] leading-4",
                inRange(n) ? "text-amber-400" : "text-text-subtle",
              )}
            >
              {midiToName(n)}
            </span>
          ))}
        </div>
      </div>

      {/* Dual handle track */}
      <div className="relative h-6">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/[0.08]" />
        <div
          style={{ left: `${lowPct}%`, width: `${Math.max(highPct - lowPct, 0)}%` }}
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-amber-500"
        />
        <input
          type="range"
          aria-label="Lowest note"
          min={MIDI_LOW}
          max={MIDI_HIGH}
          step={1}
          value={low}
          disabled={disabled}
          onChange={(e) => onChange(Math.min(Number(e.target.value), high - 1), high)}
          className={cn(
            "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent focus:outline-none",
            SLIDER_THUMB,
            "[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto",
            disabled && "opacity-40",
          )}
        />
        <input
          type="range"
          aria-label="Highest note"
          min={MIDI_LOW}
          max={MIDI_HIGH}
          step={1}
          value={high}
          disabled={disabled}
          onChange={(e) => onChange(low, Math.max(Number(e.target.value), low + 1))}
          className={cn(
            "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent focus:outline-none",
            SLIDER_THUMB,
            "[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto",
            disabled && "opacity-40",
          )}
        />
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-text-subtle">
        <span>
          <span className="text-amber-400">{midiToName(low)}</span> · {clampHz(midiToHz(low))} Hz
        </span>
        <span>
          <span className="text-amber-400">{midiToName(high)}</span> ·{" "}
          {clampHz(midiToHz(high))} Hz
        </span>
      </div>
    </div>
  );
}

type ToggleProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
};

function Toggle({ checked, disabled, label, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
        checked ? "bg-amber-500" : "bg-graphite-700",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-graphite-850 transition-transform",
          checked ? "translate-x-[1.125rem]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Main form
 * ------------------------------------------------------------------ */

export function AudioToMidiForm() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  const rateLimitLabel = getRateLimitLabel("audio-to-midi");

  const activePresetId = useMemo(
    () => PRESETS.find((p) => sameSettings(settings, p.values))?.id ?? null,
    [settings],
  );

  const changedCount = useMemo(() => {
    let n = 0;
    if (settings.onsetThreshold !== DEFAULTS.onsetThreshold) n++;
    if (settings.frameThreshold !== DEFAULTS.frameThreshold) n++;
    if (settings.minimumNoteLength !== DEFAULTS.minimumNoteLength) n++;
    if (settings.limitPitch !== DEFAULTS.limitPitch) n++;
    return n;
  }, [settings]);

  const patch = (next: Partial<Settings>) =>
    setSettings((prev) => ({ ...prev, ...next }));

  const rateLimitHint = rateLimitLabel
    ? "You have reached the limit (" + rateLimitLabel + "). Try again shortly."
    : "You are going a little fast. Try again shortly.";

  return (
    <JobToolForm
      endpoint="audio-to-midi"
      fileAccept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.opus,.webm"
      submitLabel={TOOL_COPY.submitLabel}
      toolLabel={TOOL_COPY.toolLabel}
      toolMeta={TOOL_COPY.toolMeta}
      processingLabel={TOOL_COPY.processingLabel}
      expectedRange={TOOL_COPY.expectedRange}
      resultVerb={TOOL_COPY.resultVerb}
      icon={Music4}
      hidePreview
      pollIntervalMs={3000}
      submitTimeoutMs={90_000}
      rateLimitMessage={rateLimitHint}
      buildExtraFields={() => {
        const fields: Record<string, string> = {
          onset_threshold: String(settings.onsetThreshold),
          frame_threshold: String(settings.frameThreshold),
          minimum_note_length: String(settings.minimumNoteLength),
        };
        // Pitch limiting is opt-in. When it's off we send nothing at all
        // and let the backend use its unbounded defaults, which is both
        // safer and one less thing that can fail validation.
        if (settings.limitPitch && settings.lowNote < settings.highNote) {
          fields.minimum_frequency = String(clampHz(midiToHz(settings.lowNote)));
          fields.maximum_frequency = String(clampHz(midiToHz(settings.highNote)));
        }
        return fields;
      }}
      renderControls={(file, disabled) => (
        <div className="space-y-3">
          {/* ---- Presets: the primary control, always visible ---- */}
          <fieldset disabled={disabled} className="space-y-2">
            <legend className="mb-2 flex w-full items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-text-primary">
                What are you transcribing?
              </span>
              {!activePresetId && (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-400">
                  Custom
                </span>
              )}
            </legend>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRESETS.map((preset) => {
                const active = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSettings(preset.values)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      active
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-graphite-800 bg-graphite-850 hover:border-graphite-700",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        active ? "text-amber-400" : "text-text-primary",
                      )}
                    >
                      {preset.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-text-subtle">
                      {preset.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* ---- Fine tuning ---- */}
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            disabled={disabled}
            aria-expanded={advancedOpen}
            className="flex w-full items-center justify-between rounded-lg border border-graphite-700 bg-graphite-850 px-3.5 py-2.5 text-sm text-text-primary transition-colors hover:border-graphite-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex items-center gap-2">
              <span className="font-medium">Fine tuning</span>
              {changedCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-400">
                  {changedCount}
                </span>
              )}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-text-subtle transition-transform",
                advancedOpen && "rotate-180",
              )}
            />
          </button>

          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
              advancedOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="overflow-hidden">
              <fieldset
                className="space-y-5 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4"
                disabled={disabled}
              >
                {/* Detection */}
                <div className="space-y-4">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-text-subtle">
                    Note detection
                  </p>

                  <SliderRow
                    id="atm-onset"
                    label="Onset sensitivity"
                    hint="How obvious a note attack has to be before it counts as a new note."
                    readout={settings.onsetThreshold.toFixed(2)}
                    descriptor={thresholdWord(settings.onsetThreshold)}
                    leftEnd="More notes"
                    rightEnd="Fewer notes"
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    value={settings.onsetThreshold}
                    onChange={(v) => patch({ onsetThreshold: Number(v.toFixed(2)) })}
                  />

                  <SliderRow
                    id="atm-frame"
                    label="Sustain sensitivity"
                    hint="How quietly a note can ring on before it gets cut off."
                    readout={settings.frameThreshold.toFixed(2)}
                    descriptor={thresholdWord(settings.frameThreshold)}
                    leftEnd="Longer notes"
                    rightEnd="Shorter notes"
                    min={0.05}
                    max={0.95}
                    step={0.05}
                    value={settings.frameThreshold}
                    onChange={(v) => patch({ frameThreshold: Number(v.toFixed(2)) })}
                  />
                </div>

                <div className="h-px bg-graphite-800" />

                {/* Cleanup */}
                <div className="space-y-4">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-text-subtle">
                    Cleanup
                  </p>

                  <SliderRow
                    id="atm-minlen"
                    label="Shortest note"
                    hint={`Anything briefer is dropped as noise. About a ${nearestDivision(
                      settings.minimumNoteLength,
                    )} note at 120 BPM.`}
                    readout={`${Math.round(settings.minimumNoteLength)} ms`}
                    leftEnd="Keep everything"
                    rightEnd="Long notes only"
                    min={10}
                    max={1000}
                    step={0.1}
                    value={settings.minimumNoteLength}
                    onChange={(v) => patch({ minimumNoteLength: Math.round(v * 10) / 10 })}
                  />
                </div>

                <div className="h-px bg-graphite-800" />

                {/* Pitch range */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-text-subtle">
                        Pitch range
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-text-subtle">
                        Narrow the range to cut rumble below the part and hiss or
                        cymbals above it.
                      </p>
                    </div>
                    <Toggle
                      checked={settings.limitPitch}
                      disabled={disabled}
                      label="Limit pitch range"
                      onChange={(next) => patch({ limitPitch: next })}
                    />
                  </div>

                  <div
                    className={cn(
                      "transition-opacity",
                      !settings.limitPitch && "pointer-events-none opacity-40",
                    )}
                    aria-hidden={!settings.limitPitch}
                  >
                    <PitchRange
                      low={settings.lowNote}
                      high={settings.highNote}
                      disabled={disabled || !settings.limitPitch}
                      onChange={(lowNote, highNote) => patch({ lowNote, highNote })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-[11px] text-text-subtle">
                    {changedCount === 0
                      ? "Using default settings"
                      : `${changedCount} setting${changedCount === 1 ? "" : "s"} changed`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSettings(DEFAULTS)}
                    disabled={disabled || changedCount === 0}
                    className="flex items-center gap-1.5 text-xs text-text-subtle underline underline-offset-2 transition-colors hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>
              </fieldset>
            </div>
          </div>
        </div>
      )}
    />
  );
}