"use client";

import { useState } from "react";
import { Download, Mic2, Music4 } from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitYoutubeSeparate,
  getYoutubeSeparatePreviewUrl,
  getYoutubeSeparateDownloadUrl,
} from "@/lib/api/railway";
import type { StemType } from "@/lib/types/converter";
import { cn } from "@/lib/utils/cn";

// Two fixed stems here rather than the variable-length list
// MultiOutputToolForm handles - /youtube/separate produces exactly
// vocals + instrumental, same as the file-based /separate, so a simple
// two-button toggle is the right shape.
function SeparateResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [activeStem, setActiveStem] = useState<StemType>("vocals");

  return (
    <div className="space-y-4">
      <div className="border-b border-graphite-800 pb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">Done</p>
        <p className="mt-1.5 truncate text-sm font-medium text-text-primary">{title || "Separation complete"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Stem">
        {(["vocals", "instrumental"] as StemType[]).map((stem) => {
          const selected = activeStem === stem;
          return (
            <button
              key={stem}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setActiveStem(stem)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                selected
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
              )}
            >
              {stem === "vocals" ? <Mic2 className="h-4 w-4" /> : <Music4 className="h-4 w-4" />}
              {stem}
            </button>
          );
        })}
      </div>

      <AudioPlayer key={activeStem} src={getYoutubeSeparatePreviewUrl(jobId, activeStem)} />

      <a
        href={getYoutubeSeparateDownloadUrl(jobId, activeStem)}
        download
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-graphite-950 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
      >
        <Download className="h-4 w-4" />
        Download {activeStem}
      </a>
    </div>
  );
}

export function YouTubeSeparateForm() {
  return (
    <YouTubeUrlForm
      endpoint="youtube/separate"
      onSubmit={submitYoutubeSeparate}
      pollIntervalMs={12_000}
      toolLabel="Vocal remover"
      toolMeta="From YouTube · 2–6 min"
      submitLabel="Remove vocals"
      processingLabel="Downloading and separating vocals"
      expectedRange="2–6 minutes"
      stages={[
        { at: 0, label: "Downloading the audio" },
        { at: 15, label: "Analyzing frequencies" },
        { at: 45, label: "Isolating vocals" },
        { at: 120, label: "Rendering vocals and instrumental" },
      ]}
      rateLimitMessage="You've reached the limit for this tool. Try again in a few minutes."
      renderComplete={(jobId, title) => <SeparateResult jobId={jobId} title={title} />}
    />
  );
}