"use client";

import { useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";

const MIN_GAIN = -30;
const MAX_GAIN = 30;
const DEFAULT_GAIN = 6; // sensible perceptible boost per backend guidance, always valid

export function VolumeForm() {
  const [gainDb, setGainDb] = useState(DEFAULT_GAIN);

  return (
    <JobToolForm
      endpoint="volume"
      pollIntervalMs={2500}
      submitLabel="Adjust volume"
      processingLabel="Adjusting volume…"
      expectedRange="usually a few seconds"
      resultVerb="Volume adjusted"
      buildExtraFields={() => ({ gain_db: String(gainDb) })}
      renderControls={(file, disabled) => (
        <GainSlider value={gainDb} onChange={setGainDb} disabled={disabled || !file} />
      )}
    />
  );
}

interface GainSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

function GainSlider({ value, onChange, disabled }: GainSliderProps) {
  const percent = ((value - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)) * 100;
  const isBoost = value > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Gain</label>
        <span
          className={`text-sm font-mono font-semibold ${
            isBoost ? "text-amber-400" : value < 0 ? "text-teal-400" : "text-text-muted"
          }`}
        >
          {value > 0 ? "+" : ""}
          {value} dB
        </span>
      </div>
      <input
        type="range"
        min={MIN_GAIN}
        max={MAX_GAIN}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
        style={{
          background: `linear-gradient(to right, #34343a ${percent}%, #34343a ${percent}%)`,
        }}
        aria-label="Gain in decibels"
      />
      <div className="flex justify-between text-xs text-text-subtle">
        <span>-30 dB</span>
        <span>0 dB</span>
        <span>+30 dB</span>
      </div>
      <div className="flex gap-2 pt-1">
        {[-10, -6, 0, 6, 10].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            disabled={disabled}
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-mono transition-colors disabled:opacity-40 ${
              value === preset
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
            }`}
          >
            {preset > 0 ? "+" : ""}
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}