"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitYoutubeSeparate,
  getYoutubeSeparatePreviewUrl,
  getYoutubeSeparateDownloadUrl,
} from "@/lib/api/railway";
import type { StemType } from "@/lib/types/converter";

// Two fixed stems here rather than the variable-length list
// MultiOutputToolForm handles - /youtube/separate produces exactly
// vocals + instrumental, same as the file-based /separate, so a simple
// two-button toggle is the right shape.
function SeparateResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [activeStem, setActiveStem] = useState<StemType>("vocals");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-teal-400">
        <span className="font-medium">Done{title ? ` — ${title}` : ""}</span>
      </div>

      <div className="flex gap-2">
        {(["vocals", "instrumental"] as StemType[]).map((stem) => (
          <button
            key={stem}
            type="button"
            onClick={() => setActiveStem(stem)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
              activeStem === stem
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
            }`}
          >
            {stem}
          </button>
        ))}
      </div>

      <AudioPlayer key={activeStem} src={getYoutubeSeparatePreviewUrl(jobId, activeStem)} />

      <a
        href={getYoutubeSeparateDownloadUrl(jobId, activeStem)}
        download
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
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
      submitLabel="Remove vocals"
      processingLabel="Downloading and separating vocals…"
      expectedRange="usually 2–6 minutes"
      rateLimitMessage="You've reached the limit for this tool. Please try again in a few minutes."
      renderComplete={(jobId, title) => <SeparateResult jobId={jobId} title={title} />}
    />
  );
}