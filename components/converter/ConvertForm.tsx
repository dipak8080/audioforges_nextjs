"use client";

import { useEffect, useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { getAllowedTargets, getSourceExtension } from "@/lib/data/conversions";

export function ConvertForm() {
  const [targetFormat, setTargetFormat] = useState<string>("");

  return (
    <JobToolForm
      endpoint="convert"
      pollIntervalMs={2500}
      submitLabel="Convert"
      processingLabel="Converting…"
      expectedRange="usually a few seconds"
      resultVerb="Converted"
      missingFieldsMessage="Please choose an output format above."
      buildExtraFields={() => (targetFormat ? { target_format: targetFormat } : null)}
      renderControls={(file, disabled) => (
        <TargetFormatSelect
          file={file}
          value={targetFormat}
          onChange={setTargetFormat}
          disabled={disabled}
        />
      )}
    />
  );
}

interface TargetFormatSelectProps {
  file: File | null;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

function TargetFormatSelect({ file, value, onChange, disabled }: TargetFormatSelectProps) {
  const allowedTargets = file ? getAllowedTargets(file.name) : [];
  const sourceExt = file ? getSourceExtension(file.name) : null;

  useEffect(() => {
    onChange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  if (!file) return null;

  if (allowedTargets.length === 0) {
    return (
      <p className="text-sm text-red-500">
        .{sourceExt || "this file"} isn&apos;t a supported source format for conversion.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-primary">Convert to</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {allowedTargets.map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => onChange(target)}
            disabled={disabled}
            className={`rounded-lg border px-3 py-2.5 text-sm font-mono font-semibold uppercase transition-colors disabled:opacity-40 ${
              value === target
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
            }`}
          >
            {target}
          </button>
        ))}
      </div>
    </div>
  );
}