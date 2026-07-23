"use client";

import { useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";

const DEFAULT_THRESHOLD_DB = -30;
const DEFAULT_MIN_DURATION = 0.5;

export function SilenceRemoveForm() {
  const [thresholdDb, setThresholdDb] = useState(DEFAULT_THRESHOLD_DB);
  const [minDuration, setMinDuration] = useState(DEFAULT_MIN_DURATION);

  return (
    <JobToolForm
      endpoint="silence-remove"
      pollIntervalMs={2500}
      submitLabel="Remove silence"
      processingLabel="Removing silent gaps…"
      expectedRange="usually a few seconds"
      resultVerb="Silence removed"
      buildExtraFields={() => ({
        threshold_db: String(thresholdDb),
        min_duration_seconds: String(minDuration),
      })}
      renderControls={(file, disabled) => (
        <SilenceControls
          thresholdDb={thresholdDb}
          onThresholdChange={setThresholdDb}
          minDuration={minDuration}
          onMinDurationChange={setMinDuration}
          disabled={disabled || !file}
        />
      )}
    />
  );
}

interface SilenceControlsProps {
  thresholdDb: number;
  onThresholdChange: (value: number) => void;
  minDuration: number;
  onMinDurationChange: (value: number) => void;
  disabled: boolean;
}

function SilenceControls({
  thresholdDb,
  onThresholdChange,
  minDuration,
  onMinDurationChange,
  disabled,
}: SilenceControlsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">Silence threshold</label>
          <span className="text-sm font-mono font-semibold text-amber-400">{thresholdDb} dB</span>
        </div>
        <input
          type="range"
          min={-90}
          max={-10}
          step={1}
          value={thresholdDb}
          onChange={(e) => onThresholdChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
          aria-label="Silence threshold in decibels"
        />
        <div className="flex justify-between text-xs text-text-subtle">
          <span>-90 (aggressive)</span>
          <span>Default (-30)</span>
          <span>-10 (conservative)</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">Minimum gap length</label>
          <span className="text-sm font-mono font-semibold text-amber-400">{minDuration}s</span>
        </div>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={minDuration}
          onChange={(e) => onMinDurationChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full h-1.5 rounded-full appearance-none bg-graphite-700 accent-amber-500 disabled:opacity-40 cursor-pointer"
          aria-label="Minimum silence gap duration in seconds"
        />
        <div className="flex justify-between text-xs text-text-subtle">
          <span>0.1s (cuts short pauses)</span>
          <span>Default (0.5s)</span>
          <span>10s (only long dead air)</span>
        </div>
      </div>

      <p className="text-xs text-text-subtle">
        Both settings have sensible defaults — the defaults work well for most
        podcast and voice-memo cleanup without any adjustment.
      </p>
    </div>
  );
}