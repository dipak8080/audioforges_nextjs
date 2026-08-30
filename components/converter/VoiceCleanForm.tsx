"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";
import { getRateLimitLabel } from "@/lib/data/rate-limits";

/**
 * One change, and there is nothing else to make: this tool has no parameters.
 * Denoise and normalize are applied at fixed settings, so the shell does all of
 * it — no control to restyle, no state to get wrong.
 *
 * A 429 now names the limit, read from RATE_LIMITS rather than typed.
 */

const RATE_LIMIT_LABEL = getRateLimitLabel("voice-clean");

export function VoiceCleanForm() {
  return (
    <JobToolForm
      endpoint="voice-clean"
      pollIntervalMs={2500}
      toolLabel="Voice cleanup"
      toolMeta="denoise + normalize"
      submitLabel="Clean up"
      processingLabel="Cleaning up your recording"
      expectedRange="a few seconds"
      resultVerb="Cleaned"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Voice cleanup is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Reducing background noise" },
        { at: 8, label: "Normalizing loudness" },
        { at: 13, label: "Writing the output file" },
      ]}
    />
  );
}