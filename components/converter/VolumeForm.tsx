"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ControlField, Hint, Segmented, Stepper } from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { CHUNK_BUDGET_MS, yieldToBrowser } from "@/lib/utils/scheduling";
import { cn } from "@/lib/utils/cn";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE dB FIELD PRODUCED NaN, AND THE FORM SUBMITTED IT. `onChange` ran
 *    `Math.round(clamp(Number(e.target.value), …))` on every keystroke. To
 *    type -10 you must first type "-", and `Number("-")` is NaN — which
 *    survives clamp and round untouched, lands in state, renders the header as
 *    "NaN dB", and goes to the backend as `gain_db: "NaN"`. Every negative
 *    value was unreachable by typing, and any attempt left the form in a state
 *    that could only 422. The shared Stepper holds a draft while focused and
 *    ignores an unparseable one, so "-" is just a keystroke on the way to -10.
 *
 * 2. THE PEAK SCAN FROZE THE PAGE. probePeakDbfs walked every sample of every
 *    channel in one synchronous loop — 26 million iterations for a five-minute
 *    stereo track, on the main thread, immediately after the file lands. That
 *    is a visible hang at exactly the moment someone is reaching for the next
 *    control. It runs in slices now, yielding between them, using the same
 *    CHUNK_BUDGET_MS helpers the waveform scan already uses.
 *
 * 3. IT BUILT AN AudioContext PER FILE. Chrome caps a document at six and
 *    construction opens an audio device; a shared one costs nothing and is
 *    what waveform.ts already does.
 *
 * 4. THE SCAN COULDN'T BE CANCELLED. The `cancelled` flag stopped the RESULT
 *    being used but not the work — pick three files quickly and three full
 *    decodes and scans run to completion, competing for the same thread. The
 *    slices check an AbortSignal.
 *
 * 5. A 429 NOW NAMES THE LIMIT, read from RATE_LIMITS rather than typed.
 */

const MIN_GAIN = -30;
const MAX_GAIN = 30;
const DEFAULT_GAIN = 6; // sensible perceptible boost per backend guidance, always valid
const KEY_STEP = 1;
const KEY_STEP_LARGE = 5;
/* String values, because Segmented keys on them. The "+" is display only —
   `String(-10)` is the value, "+10" is the label. */
const PRESETS = [-10, -6, 0, 6, 10].map((db) => ({
  value: String(db),
  label: `${db > 0 ? "+" : ""}${db}`,
  ariaLabel: `Set gain to ${db} decibels`,
}));

const RATE_LIMIT_LABEL = getRateLimitLabel("volume");

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampGain(value: number): number {
  // Guarded against NaN: a bare clamp passes it straight through, which is how
  // "NaN dB" used to reach the header and the request body.
  if (!Number.isFinite(value)) return DEFAULT_GAIN;
  return Math.round(clamp(value, MIN_GAIN, MAX_GAIN));
}

/**
 * One AudioContext for the page, created on first use and never closed.
 * Chrome throws past six per document, and construction opens an audio device
 * — real time, every time a file is picked. A suspended context is harmless
 * and decodeAudioData works while suspended.
 */
let sharedCtx: AudioContext | null = null;

/**
 * Peak amplitude across every channel/sample, converted to dBFS — the loudest
 * single point in the file. Flat gain has no limiter of its own, so this is
 * what actually determines whether a given boost will clip: unlike
 * LoudnormForm (which targets an average loudness), raising gain just adds dB
 * straight onto whatever peak already exists.
 *
 * Sliced, because the scan is tens of millions of iterations on the main
 * thread and a single task's worth of that is a visible freeze right after the
 * file lands. Exactness matters here — a stride could step over the one sample
 * that clips — so the work is all still done, just not all at once.
 */
async function probePeakDbfs(file: File, signal?: AbortSignal): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (signal?.aborted) return null;

    if (!sharedCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new Ctx();
    }

    const buffer = await sharedCtx.decodeAudioData(arrayBuffer);
    if (signal?.aborted) return null;

    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      let i = 0;
      while (i < data.length) {
        if (signal?.aborted) return null;
        const deadline = performance.now() + CHUNK_BUDGET_MS;
        // The clock check is per batch, not per sample: performance.now() on
        // every iteration would cost more than the comparison it guards.
        do {
          const end = Math.min(i + 100_000, data.length);
          for (; i < end; i++) {
            const abs = Math.abs(data[i]);
            if (abs > peak) peak = abs;
          }
        } while (i < data.length && performance.now() < deadline);

        if (i < data.length) await yieldToBrowser();
      }
    }

    return peak > 0 ? 20 * Math.log10(peak) : -100;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Gain meter — zero-centered, draggable, keyboard-operable            */
/* ------------------------------------------------------------------ */

function GainMeter({
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
  const [hovering, setHovering] = useState(false);

  const percentFor = (v: number) => clamp(((v - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)) * 100, 0, 100);

  const setFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      onChange(clampGain(MIN_GAIN + fraction * (MAX_GAIN - MIN_GAIN)));
    },
    [onChange]
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // pointercancel too: a drag interrupted by a system gesture otherwise
    // leaves `dragging` true and these listeners attached.
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
      onChange(clampGain(value - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(clampGain(value + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(MIN_GAIN);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(MAX_GAIN);
    }
  };

  const showBubble = dragging || hovering;

  return (
    <div className="space-y-1 pt-6">
      <div
        ref={trackRef}
        className={cn(
          "relative h-3 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]",
          !disabled && "cursor-pointer"
        )}
        style={{
          background:
            "linear-gradient(to right, rgb(45 212 191 / 0.4), rgb(148 163 184 / 0.2) 50%, rgb(245 158 11 / 0.5))",
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          setDragging(true);
          setFromClientX(e.clientX);
        }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Unity (0 dB) tick — the meaningful reference on this scale */}
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-graphite-950/70"
          style={{ left: `${percentFor(0)}%` }}
        />

        {showBubble && (
          <div
            className="pointer-events-none absolute -top-9 -translate-x-1/2 whitespace-nowrap rounded-md border border-graphite-700 bg-graphite-950 px-2 py-1 text-center shadow-lg"
            style={{ left: `${clamp(percentFor(value), 8, 92)}%` }}
          >
            <span className="block font-mono text-xs font-semibold text-text-primary">
              {value > 0 ? "+" : ""}
              {value} dB
            </span>
            <span className="block text-[9px] uppercase tracking-wide text-text-subtle">
              {value > 0 ? "Boost" : value < 0 ? "Cut" : "Unity"}
            </span>
          </div>
        )}

        <div
          role="slider"
          aria-label="Gain"
          aria-valuemin={MIN_GAIN}
          aria-valuemax={MAX_GAIN}
          aria-valuenow={value}
          aria-valuetext={`${value > 0 ? "plus " : ""}${value} decibels`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onFocus={() => setHovering(true)}
          onBlur={() => setHovering(false)}
          className={cn(
            "absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-graphite-900 shadow-md transition-transform focus:outline-none",
            value > 0 ? "border-amber-500" : value < 0 ? "border-teal-400" : "border-text-subtle",
            !disabled &&
              "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
            dragging && "scale-110",
            disabled && "opacity-50"
          )}
          style={{ left: `${percentFor(value)}%` }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-text-subtle">
        <span>{MIN_GAIN} dB — cut</span>
        <span>0 dB — unity</span>
        <span>+{MAX_GAIN} dB — boost</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Clipping prediction — probes the actual file, not a generic warning */
/* ------------------------------------------------------------------ */

function ClippingPreview({ file, gainDb }: { file: File; gainDb: number }) {
  const [peakDbfs, setPeakDbfs] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The flag stopped the RESULT being used; the decode and the scan ran to
    // completion regardless. Pick three files quickly and three full scans
    // competed for the same thread.
    const abort = new AbortController();

    setPeakDbfs(null);
    setFailed(false);

    probePeakDbfs(file, abort.signal).then((result) => {
      if (cancelled) return;
      if (result === null) setFailed(true);
      else setPeakDbfs(result);
    });

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [file]);

  if (failed) return null; // Cosmetic only — the tool still works normally.
  if (peakDbfs === null) {
    return <p className="text-xs text-text-subtle">Analyzing peak level…</p>;
  }

  const resultingPeak = peakDbfs + gainDb;
  /** Headroom against 0 dBFS. Positive means it clips. */
  const overage = resultingPeak;

  return (
    <div className="space-y-1.5 rounded-xl border border-graphite-800 bg-graphite-850/60 px-3.5 py-2.5">
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-text-subtle">Loudest point: {peakDbfs.toFixed(1)} dBFS</span>
        <span className="text-text-subtle" aria-hidden>
          →
        </span>
        <span
          className={cn(
            "font-semibold",
            overage > 0 ? "text-red-400" : overage > -1 ? "text-amber-400" : "text-teal-400"
          )}
        >
          {resultingPeak > 0 ? "+" : ""}
          {resultingPeak.toFixed(1)} dBFS
        </span>
      </div>
      {overage > 0 && (
        <Hint tone="bad">
          This would clip by about {overage.toFixed(1)} dB at the loudest point. Lower the gain or
          expect distortion on peaks.
        </Hint>
      )}
      {overage <= 0 && overage > -1 && (
        <Hint tone="warn">
          Right at the edge — less than 1 dB of headroom left on the loudest point.
        </Hint>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                 */
/* ------------------------------------------------------------------ */

export function VolumeForm() {
  const [gainDb, setGainDb] = useState(DEFAULT_GAIN);

  return (
    <JobToolForm
      endpoint="volume"
      pollIntervalMs={2500}
      toolLabel="Volume adjuster"
      toolMeta={`${gainDb > 0 ? "+" : ""}${gainDb} dB`}
      submitLabel="Adjust volume"
      processingLabel="Adjusting volume"
      expectedRange="a few seconds"
      resultVerb="Volume adjusted"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Volume changes are limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Applying gain" },
        { at: 7, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ gain_db: String(gainDb) })}
      renderControls={(file, disabled) => (
        <ControlField
          as="fieldset"
          label="Gain"
          meta={
            <span
              className={cn(
                "text-[13px] font-semibold",
                gainDb > 0 ? "text-amber-400" : gainDb < 0 ? "text-teal-400" : "text-text-muted"
              )}
            >
              {gainDb > 0 ? "+" : ""}
              {gainDb} dB
            </span>
          }
        >
          <GainMeter value={gainDb} disabled={disabled || !file} onChange={setGainDb} />

          <div className="flex justify-center pt-1">
            {/* The kit's field keeps a draft while focused. That is what makes
                a negative value typable at all: "-" alone is not a number, and
                the old handler turned it into NaN and submitted it. */}
            <Stepper
              label="Gain"
              value={gainDb}
              step={KEY_STEP}
              bigStep={KEY_STEP}
              precision={0}
              unit="dB"
              disabled={disabled || !file}
              onChange={(v) => setGainDb(clampGain(v))}
            />
          </div>

          <div className="pt-1">
            <Segmented
              label="Gain presets"
              mono
              options={PRESETS}
              /* Empty when the current gain isn't one of the presets, so the
                 row never announces a selection it doesn't have. */
              value={PRESETS.some((p) => p.value === String(gainDb)) ? String(gainDb) : ""}
              onChange={(next) => setGainDb(clampGain(Number(next)))}
              disabled={disabled || !file}
            />
          </div>

          {file && <ClippingPreview file={file} gainDb={gainDb} />}
        </ControlField>
      )}
    />
  );
}