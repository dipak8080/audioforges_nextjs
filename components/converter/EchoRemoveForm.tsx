"use client";

import { JobToolForm } from "@/components/converter/JobToolForm";

export function EchoRemoveForm() {
  return (
    <JobToolForm
      endpoint="echo-remove"
      pollIntervalMs={2500}
      submitLabel="Reduce echo"
      processingLabel="Reducing echo…"
      expectedRange="usually a few seconds"
      resultVerb="Processed"
    />
  );
}