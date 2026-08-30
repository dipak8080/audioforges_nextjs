"use client";

import { useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ControlField, Hint, OptionCards, type CardOption } from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. ANOTHER radiogroup THAT WASN'T ONE. `role="radiogroup"` promises a single
 *    tab stop with arrows between the options; these were two plain buttons
 *    with no tabIndex management and no key handler, so a screen reader
 *    announced one control and got two. Same bug ConvertForm had. OptionCards
 *    carries the behaviour, so it can't be forgotten again.
 *
 * 2. A 429 NOW NAMES THE LIMIT. Note the key: this endpoint is `channels` but
 *    its RATE_LIMITS entry is `mono-stereo-converter` (the tool's public slug),
 *    which is why the lookup doesn't just reuse the endpoint string.
 */

type ChannelTarget = "mono" | "stereo";

const RATE_LIMIT_LABEL = getRateLimitLabel("mono-stereo-converter");

const CHANNEL_OPTIONS: CardOption<ChannelTarget>[] = [
  {
    value: "mono",
    title: "Mono",
    meta: "1 channel",
    detail: "Voice, phone lines, podcasts — smaller file",
    footnote: "downmixed",
  },
  {
    value: "stereo",
    title: "Stereo",
    meta: "2 channels",
    detail: "Platforms that require stereo input",
    footnote: "duplicated",
  },
];

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
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Channel conversions are limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the source channels" },
        { at: 3, label: target === "mono" ? "Downmixing to mono" : "Duplicating to stereo" },
        { at: 8, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ target })}
      /* The file argument is unused: this control has nothing to say about the
         upload, only about the output. */
      renderControls={(_file, disabled) => (
        <ControlField
          as="fieldset"
          label="Convert to"
          hint={
            target === "mono" ? (
              <Hint>
                A stereo source downmixed to mono can&apos;t be split back into two independent
                channels later.
              </Hint>
            ) : undefined
          }
        >
          <OptionCards
            label="Channel target"
            options={CHANNEL_OPTIONS}
            value={target}
            onChange={setTarget}
            disabled={disabled}
          />
        </ControlField>
      )}
    />
  );
}