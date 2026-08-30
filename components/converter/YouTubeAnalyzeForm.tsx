"use client";

import { useEffect, useState } from "react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AnalysisResultCard, toAnalysisResult } from "@/components/converter/AnalysisResultCard";
import { Hint } from "@/components/converter/ToolControls";
import { submitYoutubeAnalyze, getYoutubeAnalyzeResult, ApiError } from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import type { AnalysisResult } from "@/lib/types/converter";

/**
 * FROM THE PREVIOUS PASS, all still true:
 *
 * The cleanest of the four /youtube/* forms — no quality tier, no credits, no
 * notify toggle, and it never drew the duplicate result header the other two
 * did.
 *
 * 1. THE RATE-LIMIT COPY DIDN'T SAY WHAT THE LIMIT WAS. "You've reached the
 *    limit for this tool. Try again in a few minutes" is a guess wearing a
 *    fact's clothes — the number is in RATE_LIMITS, and "a few minutes" is
 *    wrong if the window is an hour.
 *
 * 2. THE ERROR WAS A HAND-ROLLED RED BOX, missing the icon and the role="alert"
 *    every other failure on the site has. Hint carries both.
 *
 * 3. progressTau IS EXPLICIT. The default of 20 happens to suit a 20–60s job,
 *    but it was the default rather than a decision — and now that its siblings
 *    set 45 and 110, leaving this one implicit reads as an oversight rather
 *    than a fit.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * THE RESPONSE MAPPING WAS THE SECOND COPY. KeyFinderForm carried the same
 * conversion character for character — the same `toPct`, the same fallbacks,
 * the same `typeof … === "boolean"` guards on cross_check. Both tools hit the
 * same analysis backend, so two copies means two places to fix when the
 * response gains a field, and the first symptom of drift would be the same
 * track reporting different confidence depending on whether it was uploaded or
 * pasted.
 *
 * It lives beside AnalysisResultCard now — the component that consumes it — so
 * a change to the shape and a change to the rendering land in the same file.
 * The percentage rule is documented there too, including why a clean 1.0 has
 * to read as 100% rather than 1%.
 */

const RATE_LIMIT_LABEL = getRateLimitLabel("youtube/analyze");

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
        // Shared with KeyFinderForm — see AnalysisResultCard. Both tools hit
        // the same backend and must not read it differently.
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

  // Was a bare red <p> — no icon, no role="alert", nothing the rest of the site
  // uses to say "this went wrong".
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

/* ------------------------------------------------------------------ */

export function YouTubeAnalyzeForm() {
  return (
    <YouTubeUrlForm
      endpoint="youtube/analyze"
      onSubmit={submitYoutubeAnalyze}
      pollIntervalMs={3000}
      // Explicit rather than inherited: its siblings run 45 and 110, so an
      // unstated default here would read as something nobody looked at.
      progressTau={25}
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
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `This tool is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : "You've reached the limit for this tool. Wait for the timer, then run it again."
      }
      renderComplete={(jobId) => <AnalyzeResult jobId={jobId} />}
    />
  );
}