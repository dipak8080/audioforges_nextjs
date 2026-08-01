"use client";

import { useEffect, useState } from "react";
import { Download, Mic2, Drum, Guitar, Music2, AudioLines, Play } from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitYoutubeStems,
  getYoutubeStemsStatus,
  getYoutubeStemsPreviewUrl,
  getYoutubeStemsDownloadUrl,
} from "@/lib/api/railway";
import { cn } from "@/lib/utils/cn";

function stemIcon(name: string) {
  const key = name.toLowerCase();
  if (key === "vocals") return <Mic2 className="h-4 w-4" />;
  if (key === "drums") return <Drum className="h-4 w-4" />;
  if (key === "bass" || key === "guitar") return <Guitar className="h-4 w-4" />;
  if (key === "other") return <Music2 className="h-4 w-4" />;
  return <AudioLines className="h-4 w-4" />;
}

function formatStemName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// YouTubeUrlForm's polling only tracks generic job status - it doesn't
// know which stem names this particular job produced. That list lives in
// the /youtube/stems status response, so one extra fetch happens here
// once the job completes, same pattern as YouTubeAnalyzeForm's result
// fetch.
function StemsResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [stems, setStems] = useState<string[]>([]);
  const [activeStem, setActiveStem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getYoutubeStemsStatus(jobId);
        if (cancelled) return;
        setStems(result.outputs);
        setActiveStem(result.outputs[0] ?? null);
      } catch {
        if (!cancelled) setError("Could not load the stem list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (stems.length === 0) return <p className="text-sm text-text-muted">Loading stems…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-teal-400">
        <span className="font-medium">Done{title ? ` — ${title}` : ""}</span>
      </div>

      <div className="rounded-lg border border-graphite-700 divide-y divide-graphite-800">
        {stems.map((name) => {
          const isActive = activeStem === name;
          return (
            <div
              key={name}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 transition-colors",
                isActive ? "bg-amber-500/5" : "hover:bg-graphite-850/60"
              )}
            >
              <button
                type="button"
                onClick={() => setActiveStem(name)}
                className="flex flex-1 min-w-0 items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-amber-500 text-graphite-950" : "bg-graphite-800 text-text-muted"
                  )}
                >
                  {isActive ? <Play className="h-3.5 w-3.5" fill="currentColor" /> : stemIcon(name)}
                </span>
                <span className={cn("truncate text-sm font-medium", isActive ? "text-amber-400" : "text-text-primary")}>
                  {formatStemName(name)}
                </span>
              </button>

              <a
                href={getYoutubeStemsDownloadUrl(jobId, name)}
                download
                onClick={(e) => e.stopPropagation()}
                aria-label={`Download ${formatStemName(name)}`}
                className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-graphite-800 hover:text-amber-400 transition-colors"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          );
        })}
      </div>

      {activeStem && (
        <AudioPlayer key={activeStem} src={getYoutubeStemsPreviewUrl(jobId, activeStem)} />
      )}
    </div>
  );
}

export function YouTubeStemForm() {
  return (
    <YouTubeUrlForm
      endpoint="youtube/stems"
      onSubmit={submitYoutubeStems}
      pollIntervalMs={12_000}
      submitLabel="Split into stems"
      processingLabel="Downloading and splitting into stems…"
      expectedRange="usually 2–6 minutes"
      rateLimitMessage="You've reached the limit for this tool. Please try again in a few minutes."
      renderComplete={(jobId, title) => <StemsResult jobId={jobId} title={title} />}
    />
  );
}