"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";
import { getRateLimitLabel } from "@/lib/data/rate-limits";

/**
 * Same shape as VoiceCleanForm: no parameters, so the shell is the whole tool.
 * The only change is a 429 that names the limit, read from RATE_LIMITS.
 */

const RATE_LIMIT_LABEL = getRateLimitLabel("echo-remove");

export function EchoRemoveForm() {
  return (
    <JobToolForm
      endpoint="echo-remove"
      pollIntervalMs={2500}
      toolLabel="Echo reducer"
      toolMeta="de-reverb"
      submitLabel="Reduce echo"
      processingLabel="Reducing echo"
      expectedRange="a few seconds"
      resultVerb="Processed"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Echo reduction is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Modeling the room reflections" },
        { at: 8, label: "Subtracting the echo" },
        { at: 14, label: "Writing the output file" },
      ]}
    />
  );
}