"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";

export function ReverseForm() {
  return (
    <JobToolForm
      endpoint="reverse"
      pollIntervalMs={2500}
      submitLabel="Reverse"
      processingLabel="Reversing…"
      expectedRange="usually a few seconds"
      resultVerb="Reversed"
    />
  );
}