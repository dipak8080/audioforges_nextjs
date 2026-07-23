"use client";

import { useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";

const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2.0;

const PRESETS: { label: string; value: number }[] = [
  { label: "50%", value: 0.5 },
  { label: "75%", value: 0.75 },
  { label: "100%", value: 1.0 },
  { label: "125%", value: 1.25 },
  { label: "200%", value: 2.0 },
];

export function TempoForm() {
  const [tempoFactor, setTempoFactor] = useState(1.0);

  return (
    <JobToolForm
      endpoint="tempo"
      pollIntervalMs={2500}
      submitLabel="Change speed"
      processingLabel="Changing speed…"
      expectedRange="can take a moment on longer files"
      resultVerb="Speed changed"
      buildExtraFields={() => ({ tempo_factor: String(tempoFactor) })}
      renderControls={(file, disabled) => (
        <TempoSlider value={tempoFactor} onChange={setTempoFactor} disabled={disabled || !file} />
      )}
    />
  );
}

interface TempoSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

function TempoSlider({ value, onChange, disabled }: TempoSliderProps) {
  const percent = Math.round(value * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Speed</label>
        <span
          className={`text-sm font-mono font-semibold ${
            value > 1 ? "text-amber-400" : value < 1 ? "text-teal-400" : "text-text-muted"
          }`}
        >
          {percent}%
        </span>
      </div>
      <input
        type="range"
        min={MIN_FACTOR}
        max={MAX_FACTOR}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
        aria-label="Tempo percentage"
      />
      <div className="flex justify-between text-xs text-text-subtle">
        <span>50% (half speed)</span>
        <span>100%</span>
        <span>200% (double speed)</span>
      </div>
      <div className="flex gap-2 pt-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            disabled={disabled}
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-mono transition-colors disabled:opacity-40 ${
              value === preset.value
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-subtle pt-1">
        Speed changes are more CPU-intensive than other tools — limited to 3
        requests per 5 minutes. Adjust the slider, then apply once you&apos;re
        happy with the value. Output duration will differ from the original.
      </p>
    </div>
  );
}