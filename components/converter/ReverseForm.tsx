"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";
import { getRateLimitLabel } from "@/lib/data/rate-limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * One change, and there is nothing else to make. This tool has no parameters:
 * the file goes in, the file comes out backwards. The shell does all of it, so
 * there is no control to restyle and no state to get wrong — the shortest form
 * on the site and the only one that needed nothing from the control kit.
 *
 * A 429 now names the limit, read from RATE_LIMITS rather than typed here.
 * Without it, hitting the limit fell back to the shell's generic "wait for the
 * timer" — which is fine, but this tool is one click, so it's also the easiest
 * one to hit by accident on a batch of files.
 */

const RATE_LIMIT_LABEL = getRateLimitLabel("reverse");

export function ReverseForm() {
  return (
    <JobToolForm
      endpoint="reverse"
      pollIntervalMs={2500}
      toolLabel="Audio reverser"
      toolMeta="plays backward"
      submitLabel="Reverse"
      processingLabel="Reversing"
      expectedRange="a few seconds"
      resultVerb="Reversed"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Reversing is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 2, label: "Reversing the waveform" },
        { at: 5, label: "Writing the output file" },
      ]}
    />
  );
}