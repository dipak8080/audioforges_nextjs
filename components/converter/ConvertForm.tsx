"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import {
  ControlField,
  Hint,
  OptionCards,
  type CardOption,
} from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getAllowedTargets, getSourceExtension } from "@/lib/data/conversions";

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

const RATE_LIMIT_LABEL = getRateLimitLabel("convert");

export function ConvertForm({ defaultTarget }: { defaultTarget?: string } = {}) {
  const [targetFormat, setTargetFormat] = useState<string>(defaultTarget ?? "");

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
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Conversions are limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
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
          defaultTarget={defaultTarget}
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
  defaultTarget?: string;
}

function TargetFormatSelect({
  file,
  value,
  onChange,
  disabled,
  defaultTarget,
}: TargetFormatSelectProps) {
  if (!file) return null;
  return (
    <FormatPicker
      key={`${file.name}:${file.size}:${file.lastModified}`}
      file={file}
      value={value}
      onChange={onChange}
      disabled={disabled}
      defaultTarget={defaultTarget}
    />
  );
}

function FormatPicker({
  file,
  value,
  onChange,
  disabled,
  defaultTarget,
}: {
  file: File;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  defaultTarget?: string;
}) {
  const allowedTargets = useMemo(() => getAllowedTargets(file.name), [file]);
  const sourceExt = useMemo(() => getSourceExtension(file.name), [file]);

  // On each new file (keyed remount), seed the page's preset if it's a valid
  // target for this source; otherwise clear so the user picks. The old code
  // reset to "" unconditionally, which killed defaultTarget on upload.
  useEffect(() => {
    const preset = defaultTarget?.toLowerCase();
    const match = preset ? allowedTargets.find((t) => t.toLowerCase() === preset) : undefined;
    onChange(match ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (allowedTargets.length === 0) {
    return (
      <Hint
        tone="bad"
        title={
          sourceExt
            ? `.${sourceExt} can't be used as a source`
            : "This file type can't be used as a source"
        }
      >
        Export it as WAV or MP3 from your DAW, then convert from there.
      </Hint>
    );
  }

  const options: CardOption<string>[] = allowedTargets.map((target) => {
    const spec = specFor(target);
    return { value: target, title: target, meta: spec.quality, detail: spec.detail };
  });

  const lossySource = sourceExt ? !LOSSLESS.has(sourceExt.toLowerCase()) : false;
  const losslessTarget = value ? LOSSLESS.has(value.toLowerCase()) : false;
  const upconverting = lossySource && losslessTarget;

  return (
    <ControlField
      as="fieldset"
      label="Convert to"
      meta={
        sourceExt ? (
          <span className="flex items-center gap-1.5">
            {sourceExt.toUpperCase()}
            <ArrowRight className="h-3 w-3" aria-hidden />
            <span className={value ? "text-amber-400" : ""}>
              {value ? value.toUpperCase() : "—"}
            </span>
          </span>
        ) : undefined
      }
      hint={
        upconverting ? (
          <Hint>
            Converting a compressed source to {value.toUpperCase()} changes the container, not the
            quality — the detail lost in the original encode doesn&apos;t come back.
          </Hint>
        ) : undefined
      }
    >
      <OptionCards
        label="Output format"
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        mono
      />
    </ControlField>
  );
}