"use client";

import { useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";

const MIN_STRENGTH = 0.01;
const MAX_STRENGTH = 97;
const DEFAULT_STRENGTH = 12;

export function NoiseRemoveForm() {
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);

  return (
    <JobToolForm
      endpoint="noise-remove"
      pollIntervalMs={2500}
      submitLabel="Remove noise"
      processingLabel="Removing noise…"
      expectedRange="usually a few seconds"
      resultVerb="Denoised"
      buildExtraFields={() => ({ strength: String(strength) })}
      renderControls={(file, disabled) => (
        <StrengthSlider value={strength} onChange={setStrength} disabled={disabled || !file} />
      )}
    />
  );
}

interface StrengthSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

function StrengthSlider({ value, onChange, disabled }: StrengthSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Reduction strength</label>
        <span className="text-sm font-mono font-semibold text-amber-400">{value}</span>
      </div>
      <input
        type="range"
        min={MIN_STRENGTH}
        max={MAX_STRENGTH}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
        aria-label="Noise reduction strength"
      />
      <div className="flex justify-between text-xs text-text-subtle">
        <span>Light</span>
        <span>Default (12)</span>
        <span>Aggressive</span>
      </div>
      <p className="text-xs text-text-subtle pt-1">
        Higher values remove more noise but risk warbling artifacts on the wanted
        audio, especially on music. The default works well for most recordings —
        raise it only if noise is still noticeable.
      </p>
    </div>
  );
}