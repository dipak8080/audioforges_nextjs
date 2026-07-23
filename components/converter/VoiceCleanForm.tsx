"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";

export function VoiceCleanForm() {
  return (
    <JobToolForm
      endpoint="voice-clean"
      pollIntervalMs={2500}
      submitLabel="Clean up"
      processingLabel="Cleaning up your recording…"
      expectedRange="usually a few seconds"
      resultVerb="Cleaned"
    />
  );
}