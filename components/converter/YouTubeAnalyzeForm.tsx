"use client";

import { useEffect, useState } from "react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AnalysisResultCard, toAnalysisResult } from "@/components/converter/AnalysisResultCard";
import { Hint } from "@/components/converter/ToolControls";
import type { StageTier } from "@/components/tools/StudioStage";
import { submitYoutubeAnalyze, getYoutubeAnalyzeResult, ApiError } from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel } from "@/lib/data/tool-limits";
import type { AnalysisResult } from "@/lib/types/converter";

const RATE_LIMIT_LABEL = getRateLimitLabel("youtube/analyze");
const DURATION_LABEL = getDurationLabel("youtube/analyze") ?? "40 minutes";

const TIERS: StageTier<"free">[] = [
  {
    value: "free",
    name: "Free",
    model: "TempoCNN · Essentia",
    time: "20–60 seconds",
    footnote: RATE_LIMIT_LABEL ?? undefined,
  },
];

// Right pane of the idle stage. Every line is measured, published or read from
// the limits table, nothing invented.
function AnalyzeAside() {
  const rows: Array<[string, string]> = [
    ["Reads", "Key, BPM and Camelot code"],
    ["Measured", "75% exact BPM on the 662-track GiantSteps set"],
    ["Length", `Videos up to ${DURATION_LABEL}`],
    ["Free", "No account, no download step"],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 px-5 py-6 sm:px-7">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-3">
          <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
            {label}
          </span>
          <span className="text-sm leading-snug text-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}

// Fetches the analysis result once the job flips to complete. YouTubeUrlForm
// only knows generic job status, not this tool's key/BPM payload.
function AnalyzeResult({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getYoutubeAnalyzeResult(jobId);
        if (cancelled) return;
        // Shared with KeyFinderForm — see AnalysisResultCard.
        setResult(toAnalysisResult(data));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load the result.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) return <Hint tone="bad">{error}</Hint>;

  if (!result) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-[132px] animate-pulse rounded-xl bg-graphite-850 motion-reduce:animate-none" />
        <div className="h-[104px] animate-pulse rounded-xl bg-graphite-850 motion-reduce:animate-none" />
      </div>
    );
  }

  return <AnalysisResultCard result={result} />;
}

export function YouTubeAnalyzeForm() {
  return (
    <YouTubeUrlForm
      endpoint="youtube/analyze"
      onSubmit={(url, key) => submitYoutubeAnalyze(url, {}, key)}
      pollIntervalMs={3000}
      progressTau={25}
      toolLabel="YouTube key & BPM finder"
      submitLabel="Find key & BPM"
      processingLabel="Downloading and analyzing"
      expectedRange="20–60 seconds"
      stages={[
        { at: 0, label: "Downloading the audio" },
        { at: 8, label: "Reading the tempo grid" },
        { at: 20, label: "Estimating the key" },
        { at: 34, label: "Cross-checking both detectors" },
      ]}
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `This tool is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : "You've reached the limit for this tool. Wait for the timer, then run it again."
      }
      stage={{
        tiers: TIERS,
        tier: "free",
        onTierChange: () => {},
        aside: <AnalyzeAside />,
        doneFallback: "Analysis complete",
        resetLabel: "Analyze another link",
      }}
      renderComplete={(jobId) => <AnalyzeResult jobId={jobId} />}
    />
  );
}