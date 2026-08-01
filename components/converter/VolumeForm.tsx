"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

const MIN_GAIN = -30;
const MAX_GAIN = 30;
const DEFAULT_GAIN = 6; // sensible perceptible boost per backend guidance, always valid
const KEY_STEP = 1;
const KEY_STEP_LARGE = 5;
const PRESETS = [-10, -6, 0, 6, 10];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Peak amplitude across every channel/sample, converted to dBFS — the
 *  loudest single point in the file. Flat gain has no limiter of its
 *  own, so this is what actually determines whether a given boost will
 *  clip: unlike LoudnormForm (which targets an average loudness),
 *  raising gain just adds dB straight onto whatever peak already
 *  exists. */
async function probePeakDbfs(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      let peak = 0;
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          const abs = Math.abs(data[i]);
          if (abs > peak) peak = abs;
        }
      }
      return peak > 0 ? 20 * Math.log10(peak) : -100;
    } finally {
      ctx.close();
    }
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
      onChange(Math.round(clamp(MIN_GAIN + fraction * (MAX_GAIN - MIN_GAIN), MIN_GAIN, MAX_GAIN)));
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
      onChange(Math.round(clamp(value - step, MIN_GAIN, MAX_GAIN)));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.round(clamp(value + step, MIN_GAIN, MAX_GAIN)));
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
        className={cn("relative h-3 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]", !disabled && "cursor-pointer")}
        style={{
          background: "linear-gradient(to right, rgb(45 212 191 / 0.4), rgb(148 163 184 / 0.2) 50%, rgb(245 158 11 / 0.5))",
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
          aria-valuetext={`${value} dB`}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onFocus={() => setHovering(true)}
          onBlur={() => setHovering(false)}
          className={cn(
            "absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-graphite-900 shadow-md transition-transform focus:outline-none",
            value > 0 ? "border-amber-500" : value < 0 ? "border-teal-400" : "border-text-subtle",
            !disabled && "cursor-ew-resize hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-amber-500/40",
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
    setPeakDbfs(null);
    setFailed(false);
    probePeakDbfs(file).then((result) => {
      if (cancelled) return;
      if (result === null) setFailed(true);
      else setPeakDbfs(result);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (failed) return null; // Cosmetic only — the tool still works normally.
  if (peakDbfs === null) {
    return <p className="text-xs text-text-subtle">Analyzing peak level…</p>;
  }

  const resultingPeak = peakDbfs + gainDb;
  const overage = resultingPeak - 0;

  return (
    <div className="space-y-1.5 rounded-lg border border-graphite-800 bg-graphite-850/60 px-3.5 py-2.5">
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-text-subtle">Loudest point: {peakDbfs.toFixed(1)} dBFS</span>
        <span className="text-text-subtle">→</span>
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
        <p className="flex items-start gap-1.5 text-[11px] text-red-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          This would clip by about {overage.toFixed(1)} dB at the loudest point. Lower the gain or expect
          distortion on peaks.
        </p>
      )}
      {overage <= 0 && overage > -1 && (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Right at the edge — less than 1 dB of headroom left on the loudest point.
        </p>
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
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Applying gain" },
        { at: 7, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ gain_db: String(gainDb) })}
      renderControls={(file, disabled) => (
        <div className={cn("space-y-3", !file && "opacity-60")}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">Gain</label>
            <span
              className={cn(
                "font-mono text-sm font-semibold",
                gainDb > 0 ? "text-amber-400" : gainDb < 0 ? "text-teal-400" : "text-text-muted"
              )}
            >
              {gainDb > 0 ? "+" : ""}
              {gainDb} dB
            </span>
          </div>

          <GainMeter value={gainDb} disabled={disabled || !file} onChange={setGainDb} />

          <div className="flex items-center justify-center gap-1.5 pt-1">
            <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
              <input
                type="number"
                min={MIN_GAIN}
                max={MAX_GAIN}
                step={1}
                value={gainDb}
                disabled={disabled || !file}
                onChange={(e) => setGainDb(Math.round(clamp(Number(e.target.value), MIN_GAIN, MAX_GAIN)))}
                className="w-16 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="flex flex-col border-l border-graphite-700">
                <button
                  type="button"
                  aria-label="Increase gain"
                  disabled={disabled || !file}
                  onClick={() => setGainDb((v) => Math.round(clamp(v + KEY_STEP, MIN_GAIN, MAX_GAIN)))}
                  className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronUp className="h-2.5 w-2.5" />
                </button>
                <button
                  type="button"
                  aria-label="Decrease gain"
                  disabled={disabled || !file}
                  onClick={() => setGainDb((v) => Math.round(clamp(v - KEY_STEP, MIN_GAIN, MAX_GAIN)))}
                  className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
                >
                  <ChevronDown className="h-2.5 w-2.5" />
                </button>
              </span>
            </span>
            <span className="text-xs text-text-subtle">dB</span>
          </div>

          <div className="flex gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setGainDb(preset)}
                disabled={disabled || !file}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs font-mono transition-colors disabled:opacity-40",
                  gainDb === preset
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                )}
              >
                {preset > 0 ? "+" : ""}
                {preset}
              </button>
            ))}
          </div>

          {file && <ClippingPreview file={file} gainDb={gainDb} />}
        </div>
      )}
    />
  );
}