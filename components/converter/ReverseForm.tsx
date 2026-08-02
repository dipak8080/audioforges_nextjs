"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";

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
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 2, label: "Reversing the waveform" },
        { at: 5, label: "Writing the output file" },
      ]}
    />
  );
}