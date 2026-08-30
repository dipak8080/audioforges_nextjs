"use client";

import { useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ThresholdMeter } from "@/components/converter/ThresholdMeter";
import { ControlField, Hint, Stepper } from "@/components/converter/ToolControls";
import { Button } from "@/components/ui/Button";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. IT REBUILT A CONTROL THAT ALREADY EXISTED. StrengthMeter was
 *    ThresholdMeter with the gradient reversed: same track, same default tick,
 *    same drag handling, same keyboard map, same handle. ThresholdMeter's own
 *    docstring says it is "shared wherever a bounded numeric control needs to
 *    feel like an instrument" — this is that, and it went and wrote its own.
 *
 *    Two small props made the shared one fit rather than bending this tool to
 *    it: `gradient="cool-to-hot"` (here MORE is more aggressive, the opposite
 *    of a dB threshold) and `zoneAt` (the Light/Moderate/Aggressive boundaries
 *    are 20 and 45, not thirds of 0.01–97, which would put them at 32 and 65).
 *
 *    The local copy also lacked the floating value bubble, so dragging showed
 *    the number only in the header — the one place you are not looking while
 *    dragging.
 *
 * 2. THE STRENGTH FIELD ACCEPTED NaN. `Math.round(clamp(Number(""), …))` is
 *    NaN, and clearing the box to retype is the obvious way to reach it: the
 *    header rendered "NaN", and submit posted `strength: "NaN"`. Third form
 *    with this exact bug.
 *
 * 3. "Reset to default" WAS AN UNDERLINED SPAN PRETENDING TO BE A LINK. It's a
 *    button that changes a value on this page, so it reads as one now.
 *
 * 4. THE ZONE COLOUR AND THE RISK COPY DISAGREED. `zoneFor` turns red above 45
 *    while `riskCopy` stays silent until 60 — so between 45 and 60 the readout
 *    was red with no explanation, and the copy that finally appeared was amber
 *    while the number was red. Both now derive from the same boundaries.
 *
 * 5. A 429 NAMES THE LIMIT.
 */

const MIN_STRENGTH = 0.01;
const MAX_STRENGTH = 97;
const DEFAULT_STRENGTH = 12;
const KEY_STEP = 1;

/** The two boundaries every other piece of this form derives from: the zone
 *  name, the readout colour, and which risk sentence shows. They used to be
 *  stated three times with two different sets of numbers. */
const ZONE_BOUNDS: [number, number] = [20, 45];
const ZONE_LABELS: [string, string, string] = ["Light", "Moderate", "Aggressive"];

const RATE_LIMIT_LABEL = getRateLimitLabel("noise-remove");

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeStrength(value: number, fallback = DEFAULT_STRENGTH): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(clamp(value, MIN_STRENGTH, MAX_STRENGTH));
}

function zoneIndex(value: number): 0 | 1 | 2 {
  if (value <= ZONE_BOUNDS[0]) return 0;
  if (value <= ZONE_BOUNDS[1]) return 1;
  return 2;
}

function riskCopy(value: number): string | null {
  // Keyed to the same boundaries as the zone, so the colour and the sentence
  // can't disagree the way they used to between 45 and 60.
  if (value > ZONE_BOUNDS[1]) {
    return "At this strength, expect audible warbling on the wanted audio — especially with music or sustained tones.";
  }
  if (value > ZONE_BOUNDS[0]) {
    return "Getting firm. Check the result by ear — vocals and cymbals are usually first to show artifacts.";
  }
  return null;
}

export function NoiseRemoveForm() {
  const [strength, setStrength] = useState(DEFAULT_STRENGTH);
  const zone = zoneIndex(strength);
  const risk = riskCopy(strength);

  return (
    <JobToolForm
      endpoint="noise-remove"
      pollIntervalMs={2500}
      toolLabel="Noise remover"
      toolMeta={`${ZONE_LABELS[zone]} · ${strength}`}
      submitLabel="Remove noise"
      processingLabel="Removing noise"
      expectedRange="a few seconds"
      resultVerb="Denoised"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Noise removal is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the noise profile" },
        { at: 3, label: "Suppressing the noise floor" },
        { at: 7, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({ strength: String(strength) })}
      renderControls={(file, disabled) => (
        <ControlField
          as="fieldset"
          label="Reduction strength"
          meta={
            <span
              className={cn(
                "text-[13px] font-semibold",
                zone === 0 && "text-teal-400",
                zone === 1 && "text-amber-400",
                zone === 2 && "text-red-400"
              )}
            >
              {ZONE_LABELS[zone]} · {strength}
            </span>
          }
          hint={
            risk ? (
              <Hint tone={zone === 2 ? "bad" : "warn"}>{risk}</Hint>
            ) : (
              "The default works well for most recordings — raise it only if noise is still noticeable."
            )
          }
        >
          {/* The shared instrument, not a second copy of it. `cool-to-hot`
              because on this scale MORE is more aggressive — the reverse of
              the dB threshold it was originally built for. */}
          <ThresholdMeter
            value={strength}
            min={MIN_STRENGTH}
            max={MAX_STRENGTH}
            defaultValue={DEFAULT_STRENGTH}
            disabled={disabled || !file}
            onChange={setStrength}
            unit=""
            gradient="cool-to-hot"
            zoneAt={ZONE_BOUNDS}
            zoneLabels={ZONE_LABELS}
          />

          <div className="flex items-center justify-center gap-2 pt-1">
            <Stepper
              label="Strength"
              value={strength}
              step={KEY_STEP}
              bigStep={KEY_STEP}
              precision={0}
              disabled={disabled || !file}
              onChange={(v) => setStrength(normalizeStrength(v, strength))}
            />

            {/* Was an underlined span styled like a link. It changes a value on
                this page and navigates nowhere, so it's a button. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled || !file || strength === DEFAULT_STRENGTH}
              onClick={() => setStrength(DEFAULT_STRENGTH)}
              className="text-text-subtle hover:text-amber-400"
            >
              Reset to default
            </Button>
          </div>
        </ControlField>
      )}
    />
  );
}