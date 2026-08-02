"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";

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
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Reducing background noise" },
        { at: 8, label: "Normalizing loudness" },
        { at: 13, label: "Writing the output file" },
      ]}
    />
  );
}