"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronDown,
  Music4,
  RotateCcw,
  Layers,
  Sparkles,
  Piano,
  Disc3,
  Guitar,
  Lightbulb,
} from "lucide-react";
import { JobToolForm, type ProcessingStage } from "@/components/converter/JobToolForm";
import { OptionCards, type CardOption } from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { MeteredToolKey } from "@/lib/types/credits";
import { getAudioToMidiHqResult, getJobDownloadUrl, type MidiHqResult } from "@/lib/api/railway";

/**
 * Two engines, not two quality levels. /audio-to-midi runs basic-pitch with
 * tunable onset/sustain detection. /audio-to-midi-hq routes per instrument
 * (stems | transkun | basic-pitch-guitar) and has no detector to tune, so the
 * sensitivity sliders and presets do not exist on that side.
 *
 * HQ pitch bounds are MIDI NOTE NUMBERS. The free tool converts note→Hz at
 * submit because basic-pitch's API takes Hz; that conversion must not happen
 * on the HQ path.
 */

/** Only mounts after a job completes, so it stays out of the first load. */
const MidiResultPlayer = dynamic(
  () => import("@/components/converter/MidiResultPlayer").then((m) => m.MidiResultPlayer),
  { ssr: false },
);

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

const ALL_NOTES = Array.from({ length: MIDI_HIGH - MIDI_LOW + 1 }, (_, i) => MIDI_LOW + i);
const WHITE_NOTES = ALL_NOTES.filter((n) => WHITE_PC.has(n % 12));
const BLACK_NOTES = ALL_NOTES.filter((n) => !WHITE_PC.has(n % 12));
const WHITE_W = 100 / WHITE_NOTES.length;
const BLACK_W = WHITE_W * 0.62;
const WHITE_INDEX = new Map(WHITE_NOTES.map((n, i) => [n, i] as const));
const OCTAVE_MARKS = WHITE_NOTES.filter((n) => n % 12 === 0);

function noteBounds(n: number) {
  if (WHITE_PC.has(n % 12)) {
    const i = WHITE_INDEX.get(n) ?? 0;
    return { left: i * WHITE_W, width: WHITE_W };
  }
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
  /** HQ only, off by default: the HQ engines emit note events with no
   *  threshold noise to filter, so carrying basic-pitch's 127.7ms default
   *  across would discard real notes on a paid run. */
  limitNoteLength: boolean;
  limitPitch: boolean;
  lowNote: number;
  highNote: number;
};

const DEFAULTS: Settings = {
  onsetThreshold: 0.5,
  frameThreshold: 0.3,
  minimumNoteLength: 127.7,
  limitNoteLength: false,
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
      limitNoteLength: false,
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
      limitNoteLength: false,
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
      limitNoteLength: false,
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
      limitNoteLength: false,
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
      limitNoteLength: false,
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
  a.limitNoteLength === b.limitNoteLength &&
  a.limitPitch === b.limitPitch &&
  (!a.limitPitch || (a.lowNote === b.lowNote && a.highNote === b.highNote));

function thresholdWord(v: number) {
  if (v <= 0.25) return "Very sensitive";
  if (v <= 0.4) return "Sensitive";
  if (v <= 0.6) return "Balanced";
  if (v <= 0.8) return "Strict";
  return "Very strict";
}

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

/** The static table carries the free-tier figure, and the HQ rule is tiered
 *  (2/hour free, 30/hour credited), so the live limit wins when available. */
function formatRateLimit(max: number, windowSeconds: number): string {
  const unit =
    windowSeconds >= 3600
      ? windowSeconds === 3600
        ? "hour"
        : `${Math.round(windowSeconds / 3600)} hr`
      : windowSeconds >= 60
        ? windowSeconds === 60
          ? "min"
          : `${Math.round(windowSeconds / 60)} min`
        : `${windowSeconds} sec`;
  return `${max} per ${unit}`;
}

/* ------------------------------------------------------------------ *
 * HQ instrument routing
 * ------------------------------------------------------------------ */

type Instrument = "auto" | "piano" | "guitar";

const INSTRUMENTS: { id: Instrument; label: string; blurb: string; credits: 1 | 3 }[] = [
  {
    id: "auto",
    label: "Full mix",
    credits: 3,
    blurb:
      "Splits the track first, then transcribes each part with the model best at it. Separate tracks for bass, piano, guitar, vocals and other. Bass, keys and vocal lines come back cleanest; synth leads and pads are the weakest.",
  },
  {
    id: "piano",
    label: "Piano, keys & synths",
    credits: 1,
    blurb:
      "Piano, electric piano, synth chords and plucks — anything played on keys. Best on a single sound; for keys inside a song, turn on isolation below.",
  },
  {
    id: "guitar",
    label: "Guitar",
    credits: 1,
    blurb: "Riffs, chords and arpeggios on a guitar-specific engine. Isolation available for guitar inside a mix.",
  },
];

const INSTRUMENT_ICONS: Record<Instrument, typeof Sparkles> = {
  auto: Disc3,
  piano: Piano,
  guitar: Guitar,
};

const SINGLE_SOUND_HINT = /\b(loop|stem|sample|one[- ]?shot|chord|pluck|lead|pad|riff|arp|melody|solo|dry|di)\b/i;
const BASS_VOCAL_HINT = /\b(bass|808|sub|vocal|vox|voice|acapella|a cappella)\b/i;

type Hint = { text: string; action?: { label: string; instrument?: Instrument; isolate?: boolean } };

/**
 * Filename only. File size is not a usable proxy here: a three minute 128 kbps
 * MP3 is under 3 MB, so a size test flags whole songs as single sounds and
 * pushes them off the only engine that handles a full mix.
 */
function presetHint(file: File | null, instrument: Instrument, isolate: boolean): Hint | null {
  if (!file) return null;
  const name = file.name.replace(/\.[^.]+$/, "");
  const looksSingle = SINGLE_SOUND_HINT.test(name);
  const looksBassOrVocal = BASS_VOCAL_HINT.test(name);

  if (looksBassOrVocal && instrument !== "auto") {
    return {
      text: "Bass and vocal lines are only transcribed by Full mix — there is no single-instrument preset for them.",
      action: { label: "Use Full mix", instrument: "auto", isolate: false },
    };
  }
  if (looksSingle && instrument === "auto") {
    return {
      text: "This looks like a single sound. An instrument preset with isolation off usually beats Full mix here, and it is 1 credit instead of 3.",
      action: { label: "Switch to Piano, keys & synths", instrument: "piano", isolate: false },
    };
  }
  if (looksSingle && isolate) {
    return {
      text: "This looks like a solo recording. Isolation would strip most of it — leave it off.",
      action: { label: "Turn isolation off", isolate: false },
    };
  }
  return null;
}

function PresetHint({
  hint,
  disabled,
  onApply,
}: {
  hint: Hint | null;
  disabled: boolean;
  onApply: (a: NonNullable<Hint["action"]>) => void;
}) {
  if (!hint) {
    return (
      <details className="group text-[11px] leading-snug text-text-subtle">
        <summary className="cursor-pointer select-none list-none text-text-muted transition-colors hover:text-text-primary">
          Not sure which to pick?
        </summary>
        <ul className="mt-1.5 space-y-1 pl-3">
          <li>One sound — a loop, a stem, a solo recording: pick that instrument, isolation off.</li>
          <li>Synth chords, plucks, pads: Piano, keys &amp; synths.</li>
          <li>Piano or guitar inside a song: that instrument, isolation on.</li>
          <li>A whole song with bass, keys and vocals: Full mix.</li>
        </ul>
      </details>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-snug text-text-muted">
      <Lightbulb className="h-3 w-3 shrink-0 translate-y-[1px] text-amber-400/80" aria-hidden />
      <span className="flex-1 basis-[16rem]">{hint.text}</span>
      {hint.action && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onApply(hint.action!)}
          className="font-medium text-amber-400 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {hint.action.label}
        </button>
      )}
    </div>
  );
}

const hqToolKey = (instrument: Instrument): MeteredToolKey =>
  instrument === "auto" ? "audio-to-midi-hq-mix" : "audio-to-midi-hq";

type MidiHqResultExtra = MidiHqResult & {
  engine?: string;
  isolated?: boolean;
  notes_dropped_by_cleanup?: number;
  bpm?: number | null;
  stems_used?: string[];
  stems_skipped?: string[];
};

const ENGINE_LABEL: Record<string, string> = {
  stems: "split per instrument",
  transkun: "piano engine",
  "basic-pitch-guitar": "guitar engine",
  yourmt3: "multi-track model",
};

/* ------------------------------------------------------------------ *
 * Progress pacing
 *
 * progressTau must sit near the tool's TYPICAL duration or the bar reaches
 * ~92% in the first few seconds and then stalls for the rest of the run.
 * ------------------------------------------------------------------ */

const FREE_STAGES: ProcessingStage[] = [
  { at: 0, label: "Reading the audio" },
  { at: 8, label: "Detecting notes" },
  { at: 20, label: "Writing the MIDI file" },
];

const MIX_STAGES: ProcessingStage[] = [
  { at: 0, label: "Reading the audio" },
  { at: 10, label: "Splitting into stems" },
  { at: 40, label: "Transcribing each part" },
  { at: 100, label: "Merging the tracks" },
];

const ISOLATE_STAGES: ProcessingStage[] = [
  { at: 0, label: "Reading the audio" },
  { at: 10, label: "Isolating the part" },
  { at: 40, label: "Transcribing notes" },
  { at: 80, label: "Writing the MIDI file" },
];

const HQ_STAGES: ProcessingStage[] = [
  { at: 0, label: "Reading the audio" },
  { at: 8, label: "Transcribing notes" },
  { at: 35, label: "Writing the MIDI file" },
];

/* ------------------------------------------------------------------ *
 * Shared slider styling
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

/** Two stacked range inputs over a rendered keyboard. Pointer events live on
 *  the thumbs only so both stay grabbable, and each handle clamps against the
 *  other so low < high always holds. */
function PitchRange({ low, high, disabled, onChange }: PitchRangeProps) {
  const span = MIDI_HIGH - MIDI_LOW;
  const lowPct = ((low - MIDI_LOW) / span) * 100;
  const highPct = ((high - MIDI_LOW) / span) * 100;

  const lowEdge = noteBounds(low).left;
  const highEdge = noteBounds(high).left + noteBounds(high).width;

  const inRange = (n: number) => n >= low && n <= high;

  return (
    <div className="space-y-2">
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

          <div
            style={{ width: `${lowEdge}%` }}
            className="absolute left-0 top-0 h-full bg-black/65"
          />
          <div
            style={{ left: `${highEdge}%`, right: 0 }}
            className="absolute top-0 h-full bg-black/65"
          />
        </div>

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
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
        checked ? "bg-amber-500" : "bg-graphite-700",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Multi-track result summary (HQ only)
 * ------------------------------------------------------------------ */

/** Renders nothing on failure: the download already works, and a broken
 *  summary must not make a successful run look failed. */
function MidiHqResultSummary({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<MidiHqResultExtra | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = (await getAudioToMidiHqResult(jobId)) as MidiHqResultExtra;
        if (!cancelled) setResult(next);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (!result || result.tracks.length === 0) return null;

  const isGuitarEngine = result.engine === "basic-pitch-guitar";
  const engineLabel = result.engine ? ENGINE_LABEL[result.engine] : undefined;
  const cleaned = result.notes_dropped_by_cleanup ?? 0;
  const skipped = (result.stems_skipped ?? []).filter((stem) => stem !== "drums");

  return (
    <div className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950/40">
      <div className="flex items-baseline justify-between gap-3 border-b border-graphite-800 px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
          Detected
          {engineLabel && (
            <span className="ml-2 normal-case tracking-normal text-amber-400/80">
              {engineLabel}
              {result.isolated ? " · isolated from mix" : ""}
              {result.bpm ? ` · ${Math.round(result.bpm)} BPM set as tempo` : ""}
            </span>
          )}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-amber-400">
          {result.track_count} {result.track_count === 1 ? "track" : "tracks"} ·{" "}
          {result.note_count.toLocaleString()} notes
        </span>
      </div>

      <ul className="divide-y divide-graphite-800">
        {result.tracks.map((track, i) => (
          <li
            key={`${track.program}-${i}`}
            className="flex items-baseline justify-between gap-3 px-4 py-2.5"
          >
            <span className="min-w-0 truncate text-sm text-text-primary">
              {track.name}
              {track.is_drum && (
                <span className="ml-1.5 font-mono text-[10px] uppercase tracking-wide text-text-subtle">
                  drums
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-subtle">
              {track.notes.toLocaleString()} · {midiToName(track.low)}–{midiToName(track.high)}
            </span>
          </li>
        ))}
      </ul>

      {skipped.length > 0 && (
        <p className="border-t border-graphite-800 px-4 py-2.5 text-[11px] leading-relaxed text-text-subtle">
          No {skipped.join(", ")} part was found in this track, so{" "}
          {skipped.length === 1 ? "that stem was" : "those stems were"} left out.
        </p>
      )}

      {isGuitarEngine && cleaned > 0 && (
        <p className="border-t border-graphite-800 px-4 py-2.5 text-[11px] leading-relaxed text-text-subtle">
          {cleaned.toLocaleString()} {cleaned === 1 ? "ghost note" : "ghost notes"}{" "}
          (string harmonics and doubled attacks) removed automatically.
        </p>
      )}

      {result.notes_dropped_by_filter > 0 && (
        <p className="border-t border-graphite-800 px-4 py-2.5 text-[11px] leading-relaxed text-text-subtle">
          {result.notes_dropped_by_filter.toLocaleString()} more{" "}
          {result.notes_dropped_by_filter === 1 ? "note was" : "notes were"} detected
          and removed by your shortest-note and pitch-range settings. Loosen them to
          keep more.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Main form
 * ------------------------------------------------------------------ */

type Tier = "free" | "hq";

const TIERS: { id: Tier; label: string; cost: string; blurb: string }[] = [
  {
    id: "free",
    label: "Standard",
    cost: "always free",
    blurb:
      "Every detected note in one track. Fine for a simple melody or bassline you'll tidy up yourself.",
  },
  {
    id: "hq",
    label: "High accuracy",
    cost: "",
    blurb:
      "A dedicated model per instrument. Full mixes are split into stems first so bass, keys, guitar and vocals each land on their own track.",
  },
];

export function AudioToMidiForm({ hqAvailable = false }: { hqAvailable?: boolean }) {
  const [tier, setTier] = useState<Tier>("free");
  const isHq = hqAvailable && tier === "hq";
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [instrument, setInstrument] = useState<Instrument>("auto");
  const [isolate, setIsolate] = useState(false);
  const isGuitar = isHq && instrument === "guitar";
  const isPiano = isHq && instrument === "piano";
  const canIsolate = isGuitar || isPiano;
  const isFullMix = isHq && instrument === "auto";
  const isIsolated = canIsolate && isolate;

  const { rateLimitFor } = useCredits();

  const liveLimit = isHq ? rateLimitFor("audio-to-midi-hq") : null;
  const rateLimitLabel = liveLimit
    ? formatRateLimit(liveLimit.max_requests, liveLimit.window_seconds)
    : getRateLimitLabel(isHq ? "audio-to-midi-hq" : "audio-to-midi");

  const activePresetId = useMemo(
    () => PRESETS.find((p) => sameSettings(settings, p.values))?.id ?? null,
    [settings],
  );

  /** Counts only what the ACTIVE tier actually sends. */
  const changedCount = useMemo(() => {
    let n = 0;
    if (isHq) {
      if (settings.limitNoteLength !== DEFAULTS.limitNoteLength) n++;
      if (settings.limitNoteLength && settings.minimumNoteLength !== DEFAULTS.minimumNoteLength) {
        n++;
      }
    } else {
      if (settings.onsetThreshold !== DEFAULTS.onsetThreshold) n++;
      if (settings.frameThreshold !== DEFAULTS.frameThreshold) n++;
      if (settings.minimumNoteLength !== DEFAULTS.minimumNoteLength) n++;
    }
    if (settings.limitPitch !== DEFAULTS.limitPitch) n++;
    return n;
  }, [settings, isHq]);

  const patch = (next: Partial<Settings>) =>
    setSettings((prev) => ({ ...prev, ...next }));

  const rateLimitHint = rateLimitLabel
    ? `You have reached the limit (${rateLimitLabel}). Try again shortly.`
    : "You are going a little fast. Try again shortly.";

  const tierOptions: CardOption<Tier>[] = TIERS.map((option) => ({
    value: option.id,
    title: option.label,
    titleBefore:
      option.id === "hq" ? (
        <Layers className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Music4 className="h-3.5 w-3.5" aria-hidden />
      ),
    titleAfter: option.id === "hq" ? <FreeTierBadge tool={hqToolKey(instrument)} /> : undefined,
    meta: option.cost || undefined,
    detail: option.blurb,
  }));

  const instrumentOptions: CardOption<Instrument>[] = INSTRUMENTS.map((option) => {
    const Icon = INSTRUMENT_ICONS[option.id];
    return {
      value: option.id,
      title: option.label,
      titleBefore: <Icon className="h-3.5 w-3.5" aria-hidden />,
      detail: `${option.blurb} ${option.credits} ${option.credits === 1 ? "credit" : "credits"} per run.`,
    };
  });

  const stages = !isHq ? FREE_STAGES : isFullMix ? MIX_STAGES : isIsolated ? ISOLATE_STAGES : HQ_STAGES;
  const progressTau = !isHq ? 20 : isFullMix ? 80 : isIsolated ? 60 : 35;

  return (
    <JobToolForm
      breakoutOnComplete
      endpoint={isHq ? "audio-to-midi-hq" : "audio-to-midi"}
      metered={isHq}
      renderResult={(jobId, file) => (
        <>
          <MidiResultPlayer
            key={jobId}
            src={getJobDownloadUrl(isHq ? "audio-to-midi-hq" : "audio-to-midi", jobId)}
            sourceFile={file}
          />
          {isHq && <MidiHqResultSummary jobId={jobId} />}
        </>
      )}
      fileAccept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.opus,.webm"
      submitLabel={isHq ? "Convert with high accuracy" : TOOL_COPY.submitLabel}
      toolLabel={TOOL_COPY.toolLabel}
      toolMeta={isHq ? "high accuracy · up to 10 min" : TOOL_COPY.toolMeta}
      processingLabel={
        isFullMix
          ? "Splitting into stems, then transcribing each"
          : isIsolated
            ? `Isolating ${instrument}, then transcribing`
            : TOOL_COPY.processingLabel
      }
      stages={stages}
      progressTau={progressTau}
      expectedRange={isFullMix || isIsolated ? "one to a few minutes" : TOOL_COPY.expectedRange}
      resultVerb={TOOL_COPY.resultVerb}
      icon={Music4}
      hidePreview
      pollIntervalMs={3000}
      submitTimeoutMs={90_000}
      /* Full mix is Demucs plus up to five engines on up to ten minutes of
         audio. The 10 minute default gave up on jobs that were still running
         and already charged. */
      maxPollMs={isFullMix ? 25 * 60 * 1000 : isHq ? 15 * 60 * 1000 : 10 * 60 * 1000}
      /* NO SUBMIT RETRY ON THE METERED ROUTE. A retry re-POSTs the whole file,
         and if the first request reached the server and started a job before
         the client timed out, the retry starts a SECOND one: second GPU run,
         second credit. Free route keeps the retry. */
      maxSubmitRetries={isHq ? 0 : 1}
      rateLimitMessage={rateLimitHint}
      buildExtraFields={() => {
        const bounded = settings.limitPitch && settings.lowNote < settings.highNote;

        if (isHq) {
          /* Note numbers, not Hz, and `min_note_ms` rather than
             `minimum_note_length`. FastAPI drops unknown fields silently. */
          const fields: Record<string, string> = { instrument };
          if (canIsolate && isolate) {
            fields.isolate = "true";
          }
          if (settings.limitNoteLength) {
            fields.min_note_ms = String(settings.minimumNoteLength);
          }
          if (bounded) {
            fields.min_pitch = String(settings.lowNote);
            fields.max_pitch = String(settings.highNote);
          }
          return fields;
        }

        const fields: Record<string, string> = {
          onset_threshold: String(settings.onsetThreshold),
          frame_threshold: String(settings.frameThreshold),
          minimum_note_length: String(settings.minimumNoteLength),
        };
        if (bounded) {
          fields.minimum_frequency = String(clampHz(midiToHz(settings.lowNote)));
          fields.maximum_frequency = String(clampHz(midiToHz(settings.highNote)));
        }
        return fields;
      }}
      renderControls={(file, disabled) => (
        <div className="space-y-3">
          {hqAvailable && (
            <fieldset disabled={disabled} className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-text-primary">Quality</legend>
              <OptionCards
                label="Transcription quality"
                options={tierOptions}
                value={tier}
                onChange={setTier}
                columns={2}
                disabled={disabled}
              />
            </fieldset>
          )}

          {isHq && (
            <fieldset disabled={disabled} className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-text-primary">
                What are you transcribing?
              </legend>
              <OptionCards
                label="Instrument"
                options={instrumentOptions}
                value={instrument}
                onChange={setInstrument}
                columns={2}
                disabled={disabled}
              />

              <PresetHint
                hint={presetHint(file, instrument, isolate)}
                disabled={disabled}
                onApply={(a) => {
                  if (a.instrument) setInstrument(a.instrument);
                  if (a.isolate !== undefined) setIsolate(a.isolate);
                }}
              />

              {canIsolate && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-graphite-800 bg-graphite-850/60 px-3.5 py-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {isGuitar ? "Guitar" : "Piano"} is inside a full mix
                    </p>
                    <p className="mt-0.5 text-[11px] leading-snug text-text-subtle">
                      Pulls the {isGuitar ? "guitar" : "piano"} out first, then transcribes just
                      that. Off for loops, stems and solo recordings.
                    </p>
                  </div>
                  <Toggle
                    checked={isolate}
                    disabled={disabled}
                    label={`Isolate ${isGuitar ? "guitar" : "piano"} from mix`}
                    onChange={setIsolate}
                  />
                </div>
              )}
            </fieldset>
          )}

          {!isHq && (
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
          )}

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
                {/* Detection: free tier only. The HQ engines emit note events,
                    so there is no detector behind them to tune. */}
                {!isHq && (
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
                )}

                {!isHq && <div className="h-px bg-graphite-800" />}

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-widest text-text-subtle">
                        Cleanup
                      </p>
                      {isHq && (
                        <p className="mt-1 text-[11px] leading-snug text-text-subtle">
                          {isGuitar
                            ? "Off by default. The guitar engine already removes string harmonics and doubled attacks — turn this on only if the result still looks cluttered."
                            : "Off by default. Each engine already cleans its own output — turn this on only if the result looks cluttered."}
                        </p>
                      )}
                    </div>
                    {isHq && (
                      <Toggle
                        checked={settings.limitNoteLength}
                        disabled={disabled}
                        label="Drop very short notes"
                        onChange={(next) => patch({ limitNoteLength: next })}
                      />
                    )}
                  </div>

                  <div
                    className={cn(
                      "transition-opacity",
                      isHq && !settings.limitNoteLength && "pointer-events-none opacity-40"
                    )}
                    aria-hidden={isHq && !settings.limitNoteLength}
                  >
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
                      max={isHq ? 2000 : 1000}
                      step={0.1}
                      value={settings.minimumNoteLength}
                      disabled={isHq && !settings.limitNoteLength}
                      onChange={(v) => patch({ minimumNoteLength: Math.round(v * 10) / 10 })}
                    />
                  </div>
                </div>

                <div className="h-px bg-graphite-800" />

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