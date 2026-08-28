"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Music4, RotateCcw, Sparkles, Layers } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import { getAudioToMidiHqResult, type MidiHqResult } from "@/lib/api/railway";

/**
 * TWO ENGINES, NOT TWO QUALITY LEVELS.
 *
 * /audio-to-midi runs basic-pitch: one MIDI track, tunable onset and sustain
 * detection. /audio-to-midi-hq runs YourMT3, a transformer that emits note
 * events — there is NO detector to tune, so the sensitivity sliders do not
 * exist on that side. FastAPI silently drops unknown form fields, so sending
 * them anyway would fail quietly rather than error.
 *
 * That is why the two tiers show different controls rather than the same panel
 * with a quality switch, and why HQ has no presets: four of the six free
 * presets differ ONLY in sensitivity, so they would all collapse into the same
 * request. Presenting six options that do three things is worse than
 * presenting the two controls that actually exist.
 *
 * The other trap: HQ pitch bounds are MIDI NOTE NUMBERS, not Hz. The free tool
 * converts note→Hz at submit because basic-pitch's API takes Hz; that
 * conversion must NOT happen here.
 */

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

/**
 * The ONLY evidence the paid tier did what it promised.
 *
 * MIDI is not playable audio in a browser, so unlike every separation tool
 * there is nothing to listen to — the user downloads a file and finds out in
 * their DAW. Per-instrument track names, note counts and ranges are
 * recognisable to a musician immediately, and they are the one thing the free
 * tool cannot produce at any setting.
 *
 * Renders nothing on failure. The download already works; a broken summary
 * must not make a successful run look failed.
 */
function MidiHqResultSummary({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<MidiHqResult | null>(null);

  // No `setResult(null)` here: the caller keys this component on jobId, so a
  // new job mounts a fresh one with empty state. Resetting inside the effect
  // would be a synchronous setState in an effect body, which the compiler lint
  // rejects and which renders once with stale data before clearing it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await getAudioToMidiHqResult(jobId);
        if (!cancelled) setResult(next);
      } catch {
        /* silent — see above */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (!result || result.tracks.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-graphite-800 bg-graphite-950/40">
      <div className="flex items-baseline justify-between gap-3 border-b border-graphite-800 px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
          Detected
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

      {result.notes_dropped_by_filter > 0 && (
        /*
          The honest answer to "why does this look sparse?". It points at the
          user's OWN shortest-note or pitch-range setting rather than at the
          model, which is both true and the version they can act on.
        */
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

const TIERS: { id: Tier; label: string; blurb: string }[] = [
  {
    id: "free",
    label: "Single track",
    blurb: "One MIDI track with every detected note. Free, unlimited.",
  },
  {
    id: "hq",
    label: "Multi-track",
    blurb: "One track per instrument, each with a General MIDI program set.",
  },
];

/** A radiogroup is ONE tab stop with arrows between the options — matching
 *  every other tier picker on the site. */
function useRovingRadio<T extends string>(
  values: readonly T[],
  current: T,
  onChange: (next: T) => void
) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(e: React.KeyboardEvent) {
    const i = values.indexOf(current);
    if (i < 0) return;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (i + 1) % values.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (i - 1 + values.length) % values.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = values.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(values[next]);
    refs.current[next]?.focus();
  }
  return { refs, onKeyDown };
}

export function AudioToMidiForm({ hqAvailable = false }: { hqAvailable?: boolean }) {
  const [tier, setTier] = useState<Tier>("free");
  const isHq = hqAvailable && tier === "hq";
  const tierRadio = useRovingRadio(["free", "hq"] as const, tier, (v) => setTier(v));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  const rateLimitLabel = getRateLimitLabel(isHq ? "audio-to-midi-hq" : "audio-to-midi");

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
      // Different ROUTE, not a quality flag — the two tiers are different
      // models with different parameter sets.
      key={isHq ? "hq" : "free"}
      endpoint={isHq ? "audio-to-midi-hq" : "audio-to-midi"}
      // Sends af_sid so a balance can be seen and spent. False on the free
      // route, which returns no billing block at all.
      metered={isHq}
      renderResult={isHq ? (jobId) => <MidiHqResultSummary key={jobId} jobId={jobId} /> : undefined}
      fileAccept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.opus,.webm"
      submitLabel={isHq ? "Convert to multi-track MIDI" : TOOL_COPY.submitLabel}
      toolLabel={TOOL_COPY.toolLabel}
      toolMeta={isHq ? "multi-track · up to 10 min" : TOOL_COPY.toolMeta}
      processingLabel={TOOL_COPY.processingLabel}
      expectedRange={TOOL_COPY.expectedRange}
      resultVerb={TOOL_COPY.resultVerb}
      icon={Music4}
      hidePreview
      pollIntervalMs={3000}
      submitTimeoutMs={90_000}
      rateLimitMessage={rateLimitHint}
      buildExtraFields={() => {
        // Pitch limiting is opt-in on both tiers. When it's off nothing is
        // sent at all and the backend uses its unbounded defaults — safer than
        // sending a bound, and one less thing that can fail validation.
        const bounded = settings.limitPitch && settings.lowNote < settings.highNote;

        if (isHq) {
          // NOTE NUMBERS, NOT Hz — no midiToHz here. And `min_note_ms`, not
          // `minimum_note_length`. Sending the free tool's field names would
          // be dropped silently by FastAPI and produce an unfiltered result
          // that looks like the setting did nothing.
          const fields: Record<string, string> = {
            min_note_ms: String(settings.minimumNoteLength),
          };
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
          {/*
            ENGINE, not quality. Named for what the user gets — one track vs
            one track per instrument — because that is the difference they can
            verify the moment they open the file, and it is the only thing the
            free tier genuinely cannot do at any setting.

            Deliberately NOT sold as "more accurate": on a solo guitar or a
            short clip YourMT3 often returns a single track at program 0, and
            promising separate instruments for that upload would be a refund
            request waiting to happen.
          */}
          {hqAvailable && (
            <fieldset disabled={disabled} className="space-y-2">
              <legend className="mb-2 text-sm font-medium text-text-primary">Output</legend>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Transcription engine"
                onKeyDown={tierRadio.onKeyDown}
              >
                {TIERS.map((option, i) => {
                  const active = tier === option.id;
                  return (
                    <button
                      key={option.id}
                      ref={(el) => {
                        tierRadio.refs.current[i] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setTier(option.id)}
                      disabled={disabled}
                      className={cn(
                        "rounded-lg border p-3.5 text-left transition-all",
                        "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                        active
                          ? "border-amber-500/60 bg-amber-500/[0.07]"
                          : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-sm font-semibold",
                          active ? "text-amber-400" : "text-text-primary"
                        )}
                      >
                        {option.id === "hq" ? (
                          <Layers className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Music4 className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {option.label}
                        {/* Renders nothing while this rule is off. */}
                        {option.id === "hq" && <FreeTierBadge tool="audio-to-midi-hq" />}
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-text-muted">
                        {option.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* ---- Presets: free tier only. On HQ four of the six would send
                 an identical request, so there is nothing to choose. ---- */}
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
                {/* Detection — FREE TIER ONLY.
                    YourMT3 emits note events directly; there is no onset or
                    sustain detector behind it to tune. The API accepts these
                    fields and ignores them, so showing the sliders on HQ would
                    be two controls that visibly do nothing. */}
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
                    // 2000 is the real backend ceiling on BOTH tools; the free
                    // tool's 1000 was a UI choice. HQ gets the full range since
                    // it has fewer controls to reach for.
                    max={isHq ? 2000 : 1000}
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