"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Download, Info } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";
import { getAllowedTargets, getSourceExtension } from "@/lib/data/conversions";

/* ------------------------------------------------------------------ */
/* Format reference                                                    */
/* ------------------------------------------------------------------ */

interface FormatSpec {
  quality: "Lossless" | "Compressed";
  detail: string;
}

const FORMAT_SPECS: Record<string, FormatSpec> = {
  wav: { quality: "Lossless", detail: "Uncompressed · universal in DAWs" },
  aiff: { quality: "Lossless", detail: "Uncompressed · Apple standard" },
  flac: { quality: "Lossless", detail: "Compressed, no quality loss · ~50% smaller" },
  alac: { quality: "Lossless", detail: "Compressed, no quality loss · Apple" },
  mp3: { quality: "Compressed", detail: "320 kbps · plays everywhere" },
  aac: { quality: "Compressed", detail: "Better than MP3 at the same size" },
  m4a: { quality: "Compressed", detail: "AAC in an Apple container" },
  ogg: { quality: "Compressed", detail: "Open format · good at low bitrates" },
  opus: { quality: "Compressed", detail: "Best quality per byte · newer players" },
};

const LOSSLESS = new Set(["wav", "aiff", "flac", "alac"]);

function specFor(ext: string): FormatSpec {
  return FORMAT_SPECS[ext.toLowerCase()] ?? { quality: "Compressed", detail: "Audio file" };
}

/* ------------------------------------------------------------------ */

export function ConvertForm() {
  const [targetFormat, setTargetFormat] = useState<string>("");

  return (
    <JobToolForm
      endpoint="convert"
      pollIntervalMs={2500}
      toolLabel="Audio converter"
      toolMeta={targetFormat ? `→ ${targetFormat.toUpperCase()}` : "any format"}
      icon={Download}
      submitLabel={targetFormat ? `Convert to ${targetFormat.toUpperCase()}` : "Convert"}
      processingLabel="Converting your file"
      expectedRange="a few seconds"
      resultVerb="Converted"
      downloadFilename={targetFormat || undefined}
      missingFieldsMessage="Choose an output format first"
      stages={[
        { at: 0, label: "Reading the source file" },
        { at: 3, label: "Re-encoding the audio" },
        { at: 10, label: "Writing the output file" },
      ]}
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

/* ------------------------------------------------------------------ */

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
      <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
        <div>
          <p className="text-sm font-medium text-text-primary">
            .{sourceExt || "This file type"} can&apos;t be used as a source
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Export it as WAV or MP3 from your DAW, then convert from there.
          </p>
        </div>
      </div>
    );
  }

  const lossySource = sourceExt ? !LOSSLESS.has(sourceExt.toLowerCase()) : false;
  const losslessTarget = value ? LOSSLESS.has(value.toLowerCase()) : false;
  const upconverting = lossySource && losslessTarget;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-text-primary">Convert to</label>
        {sourceExt && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-subtle">
            {sourceExt.toUpperCase()}
            <ArrowRight className="h-3 w-3" aria-hidden />
            <span className={value ? "text-amber-400" : ""}>
              {value ? value.toUpperCase() : "—"}
            </span>
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Output format">
        {allowedTargets.map((target) => {
          const spec = specFor(target);
          const selected = value === target;
          return (
            <button
              key={target}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(target)}
              disabled={disabled}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                "disabled:cursor-not-allowed disabled:opacity-40",
                selected
                  ? "border-amber-500/60 bg-amber-500/[0.07]"
                  : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-sm font-semibold uppercase tracking-tight",
                    selected ? "text-amber-400" : "text-text-primary"
                  )}
                >
                  {target}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wider",
                    selected ? "text-amber-500/80" : "text-text-subtle"
                  )}
                >
                  {spec.quality}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-text-muted">{spec.detail}</p>
            </button>
          );
        })}
      </div>

      {upconverting && (
        <p className="flex items-start gap-1.5 text-[11px] text-text-subtle">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          Converting a compressed source to {value.toUpperCase()} changes the container, not the
          quality — the detail lost in the original encode doesn&apos;t come back.
        </p>
      )}
    </div>
  );
}