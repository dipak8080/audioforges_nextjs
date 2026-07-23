"use client";

import { useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";

const MIN_SEMITONES = -12;
const MAX_SEMITONES = 12;

const PRESETS: { label: string; value: number }[] = [
  { label: "-1 oct", value: -12 },
  { label: "-5th", value: -7 },
  { label: "Normal", value: 0 },
  { label: "+5th", value: 7 },
  { label: "+1 oct", value: 12 },
];

export function PitchForm() {
  const [semitones, setSemitones] = useState(0);

  return (
    <JobToolForm
      endpoint="pitch"
      pollIntervalMs={2500}
      submitLabel="Shift pitch"
      processingLabel="Shifting pitch…"
      expectedRange="can take a moment on longer files"
      resultVerb="Pitch shifted"
      buildExtraFields={() => ({ semitones: String(semitones) })}
      renderControls={(file, disabled) => (
        <SemitoneSlider value={semitones} onChange={setSemitones} disabled={disabled || !file} />
      )}
    />
  );
}

interface SemitoneSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
}

function SemitoneSlider({ value, onChange, disabled }: SemitoneSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Pitch shift</label>
        <span
          className={`text-sm font-mono font-semibold ${
            value > 0 ? "text-amber-400" : value < 0 ? "text-teal-400" : "text-text-muted"
          }`}
        >
          {value > 0 ? "+" : ""}
          {value} semitone{Math.abs(value) === 1 ? "" : "s"}
        </span>
      </div>
      <input
        type="range"
        min={MIN_SEMITONES}
        max={MAX_SEMITONES}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
        aria-label="Pitch shift in semitones"
      />
      <div className="flex justify-between text-xs text-text-subtle">
        <span>-12 (1 oct down)</span>
        <span>0</span>
        <span>+12 (1 oct up)</span>
      </div>
      <div className="flex gap-2 pt-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            disabled={disabled}
            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
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
        Pitch shifting is more CPU-intensive than other tools — limited to 3
        requests per 5 minutes. Adjust the slider, then apply once you&apos;re
        happy with the value.
      </p>
    </div>
  );
}