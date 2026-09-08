"use client";

import { Music4, ExternalLink } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { SITE_URL } from "@/lib/constants";

export function EmbedAudioToMidi() {
  return (
    <div className="flex min-h-full flex-col gap-3 p-4">
      <JobToolForm
        endpoint="audio-to-midi"
        submitLabel="Convert to MIDI"
        processingLabel="Converting"
        resultVerb="Converted"
        toolLabel="Audio to MIDI"
        icon={Music4}
        expectedRange="up to a minute"
        progressTau={25}
        pollIntervalMs={3000}
        downloadFilename="mid"
        hidePreview
        hideSupport
        stages={[
          { at: 0, label: "Reading the audio" },
          { at: 8, label: "Detecting notes" },
          { at: 20, label: "Writing the MIDI file" },
        ]}
      />

      <a
        href={`${SITE_URL}/audio-to-midi?utm_source=embed&utm_medium=widget`}
        target="_blank"
        rel="noopener"
        className="flex items-center justify-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-amber-400"
      >
        Powered by AudioForges
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}