"use client";

import { useEffect, useState } from "react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AnalysisResultCard } from "@/components/converter/AnalysisResultCard";
import { submitYoutubeAnalyze, getYoutubeAnalyzeResult, ApiError } from "@/lib/api/railway";
import type { AnalysisResult } from "@/lib/types/converter";

/* ------------------------------------------------------------------ */
/* Result fetch                                                        */
/* ------------------------------------------------------------------ */

// Fetches the analysis result once the job status flips to "complete" -
// YouTubeUrlForm only knows generic job status (status/title/error), not
// this tool's actual key/BPM payload, so that one extra fetch happens
// here, scoped to this tool alone.
function AnalyzeResult({ jobId }: { jobId: string }) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getYoutubeAnalyzeResult(jobId);
        if (cancelled) return;

        const toPct = (n: number) => Math.round(n > 1 ? n : n * 100);

        setResult({
          key: (data.key as string) || "Unknown",
          camelot: (data.camelot as string) || "N/A",
          bpm: Math.round(Number(data.bpm) || 0),
          confidence: toPct(Number(data.confidence) || 0),
          bpmConfidence: toPct(Number(data.bpm_confidence) || 0),
          keyAgrees:
            typeof data.cross_check?.key_agrees === "boolean" ? data.cross_check.key_agrees : null,
          bpmAgrees:
            typeof data.cross_check?.bpm_agrees === "boolean" ? data.cross_check.bpm_agrees : null,
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load the result.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/25 bg-red-500/[0.07] px-4 py-3 text-sm text-text-primary">
        {error}
      </p>
    );
  }

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

/* ------------------------------------------------------------------ */

export function YouTubeAnalyzeForm() {
  return (
    <YouTubeUrlForm
      endpoint="youtube/analyze"
      onSubmit={submitYoutubeAnalyze}
      pollIntervalMs={3000}
      toolLabel="Key & BPM finder"
      toolMeta="Camelot · cross-checked"
      submitLabel="Find key & BPM"
      processingLabel="Downloading and analyzing"
      expectedRange="20–60 seconds"
      stages={[
        { at: 0, label: "Downloading the audio" },
        { at: 8, label: "Reading the tempo grid" },
        { at: 20, label: "Estimating the key" },
        { at: 34, label: "Cross-checking both detectors" },
      ]}
      rateLimitMessage="You've reached the limit for this tool. Try again in a few minutes."
      renderComplete={(jobId) => <AnalyzeResult jobId={jobId} />}
    />
  );
}