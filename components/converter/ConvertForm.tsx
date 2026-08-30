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

/* ------------------------------------------------------------------ */
/* Format reference                                                    */
/* ------------------------------------------------------------------ */

interface FormatSpec {
  quality: "Lossless" | "Compressed";
  detail: string;
}

/**
 * Copy for every format the picker can offer.
 *
 * The seven that CONVERSION_TARGETS actually produces, plus alac and opus,
 * which it doesn't — those two are in ALL_FORMATS on neither side today. They
 * stay because conversions.ts is explicitly built so adding an eighth format
 * is a one-line change, and a new target arriving with no spec would render
 * the `specFor` fallback: "Audio file", on a card that's supposed to explain
 * what you're choosing. Having the copy ready is cheaper than noticing later.
 */
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

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * One addition: a 429 now names the limit.
 *
 * /convert is 5 per MINUTE — the tightest window on the site, and the one a
 * user is most likely to hit by accident, since converting a handful of files
 * in a row is the normal way to use this tool. Without the message the shell
 * fell back to "Wait for the timer, then run it again", which is true and
 * tells them nothing about whether that's ten seconds or an hour.
 *
 * Read from RATE_LIMITS rather than typed, for the reason PitchForm's FAQ
 * demonstrates: a hardcoded limit outlives the config change that invalidates
 * it, and nobody notices because the copy still reads plausibly.
 *
 * The other change is one line of copy: getSourceExtension returns NULL for a
 * file with no extension, and the unsupported-source title interpolated it as
 * `.${sourceExt || "This file type"}` — which renders ".This file type can't
 * be used as a source", with a leading dot attached to a phrase that isn't an
 * extension. Rare, but it's the message someone sees at their most confused.
 *
 * EVERYTHING ELSE HERE WAS ALREADY DONE and is deliberately unchanged — the
 * picker is OptionCards (nine tab stops became one), the reset-on-file-change
 * is a keyed remount rather than an effect with a suppressed lint rule, and
 * the two hint rows are the shared Hint component.
 */
const RATE_LIMIT_LABEL = getRateLimitLabel("convert");

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
        />
      )}
    />
  );
}

/* ------------------------------------------------------------------ */

/**
 * FROM THE PREVIOUS PASS, all still true:
 *
 * 1. THE FORMAT PICKER WAS NINE TAB STOPS PRETENDING TO BE ONE. It declared
 *    `role="radiogroup"`, which tells assistive tech "one stop, use the
 *    arrows" — and then rendered plain buttons with no tabIndex management and
 *    no key handling. So a screen reader announced a control that behaved
 *    nothing like what it had just described, and a keyboard user tabbed
 *    through every audio format on the way to the Convert button. That's worse
 *    than declaring no role at all. OptionCards carries the roving behaviour,
 *    so this can't be got wrong by omission again.
 *
 * 2. THE RESET-ON-FILE-CHANGE EFFECT DISABLED ITS OWN LINT RULE to hide that
 *    `onChange` wasn't in its deps. It's a parent setter and stable in
 *    practice, but the escape hatch was load-bearing rather than explanatory.
 *    Keyed remount does the same job with no effect and no suppression — the
 *    same pattern TrimForm already uses for its controls.
 *
 * 3. THE UNSUPPORTED-SOURCE PANEL AND THE UPCONVERT NOTE WERE TWO HAND-ROLLED
 *    versions of the same Info/AlertTriangle row that appears in four other
 *    forms, in four slightly different paddings.
 */

interface TargetFormatSelectProps {
  file: File | null;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

function TargetFormatSelect({ file, value, onChange, disabled }: TargetFormatSelectProps) {
  if (!file) return null;
  return (
    /* Keyed per file: a different source remounts this with no selection,
       rather than an effect that clears it on the next tick — which is what
       needed the eslint-disable. Same pattern as TrimControls. */
    <FormatPicker
      key={`${file.name}:${file.size}:${file.lastModified}`}
      file={file}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

function FormatPicker({
  file,
  value,
  onChange,
  disabled,
}: {
  file: File;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const allowedTargets = useMemo(() => getAllowedTargets(file.name), [file]);
  const sourceExt = useMemo(() => getSourceExtension(file.name), [file]);

  /* The remount above gives this component a clean slate; the PARENT's
     `targetFormat` outlives it, so it still has to be told. Once, on mount. */
  useEffect(() => {
    onChange("");
    // The mount reset is the whole point — re-running it whenever `onChange`
    // changes identity would clear a selection the user just made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (allowedTargets.length === 0) {
    /* The dot belongs to an extension, not to a fallback phrase.
       getSourceExtension returns null for a file with no extension at all, and
       interpolating that produced ".This file type can't be used as a source". */
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
    return {
      value: target,
      title: target,
      meta: spec.quality,
      detail: spec.detail,
    };
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