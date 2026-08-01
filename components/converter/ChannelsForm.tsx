"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

type ChannelTarget = "mono" | "stereo";

const CHANNEL_SPECS: Record<ChannelTarget, { detail: string; use: string }> = {
  mono: {
    detail: "1 channel · downmixed",
    use: "Voice, phone lines, podcasts — smaller file",
  },
  stereo: {
    detail: "2 channels · duplicated",
    use: "Platforms that require stereo input",
  },
};

export function ChannelsForm() {
  const [target, setTarget] = useState<ChannelTarget>("mono");

  return (
    <JobToolForm
      endpoint="channels"
      pollIntervalMs={2500}
      toolLabel="Channel converter"
      toolMeta={`→ ${target}`}
      submitLabel={`Convert to ${target}`}
      processingLabel={`Converting to ${target}`}
      expectedRange="a few seconds"
      resultVerb="Converted"
      stages={[
        { at: 0, label: "Reading the source channels" },
        { at: 3, label: target === "mono" ? "Downmixing to mono" : "Duplicating to stereo" },
        { at: 8, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ target })}
      renderControls={(file, disabled) => (
        <ChannelSelect value={target} onChange={setTarget} disabled={disabled} />
      )}
    />
  );
}

/* ------------------------------------------------------------------ */

interface ChannelSelectProps {
  value: ChannelTarget;
  onChange: (value: ChannelTarget) => void;
  disabled: boolean;
}

function ChannelSelect({ value, onChange, disabled }: ChannelSelectProps) {
  const options: ChannelTarget[] = ["mono", "stereo"];

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-text-primary">Convert to</legend>

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Channel target">
        {options.map((option) => {
          const spec = CHANNEL_SPECS[option];
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option)}
              disabled={disabled}
              className={cn(
                "rounded-lg border p-3.5 text-left transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                "disabled:cursor-not-allowed disabled:opacity-40",
                selected
                  ? "border-amber-500/60 bg-amber-500/[0.07]"
                  : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
              )}
            >
              <span
                className={cn(
                  "text-base font-semibold capitalize tracking-tight",
                  selected ? "text-amber-400" : "text-text-primary"
                )}
              >
                {option}
              </span>
              <p className="mt-1.5 font-mono text-xs text-text-muted">{spec.detail}</p>
              <p className="mt-1 text-[11px] leading-snug text-text-subtle">{spec.use}</p>
            </button>
          );
        })}
      </div>

      {value === "mono" && (
        <p className="flex items-start gap-1.5 text-[11px] text-text-subtle">
          <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          A stereo source downmixed to mono can't be split back into two independent channels later.
        </p>
      )}
    </fieldset>
  );
}