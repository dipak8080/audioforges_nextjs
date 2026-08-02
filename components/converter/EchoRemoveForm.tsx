"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";

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
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Modeling the room reflections" },
        { at: 8, label: "Subtracting the echo" },
        { at: 14, label: "Writing the output file" },
      ]}
    />
  );
}