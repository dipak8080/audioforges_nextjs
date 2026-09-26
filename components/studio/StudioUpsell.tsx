"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StudioAB } from "./StudioAB";
import { ApiError } from "@/lib/api/railway";
import { useStudioConfig } from "@/lib/studio/use-studio-config";
import { useStudioPrice } from "@/lib/studio/price";
import { estimateSongs, stemCountOf, studioTool, vocalOptionsOf, type StudioSelection } from "@/lib/studio/presets";
import { getRunStatus, requestStudioPreview, sortStems, type StartedRun } from "@/lib/studio/run";
import { trackStudio } from "@/lib/studio/track";

type PreviewState =
  | { phase: "idle" }
  | { phase: "making"; since: number }
  | { phase: "ready"; run: StartedRun; clip: { start: number; seconds: number }; stems: string[] }
  | { phase: "error"; message: string };

export function StudioUpsell({
  run,
  freeStems,
  selection,
  onUnlock,
  busy = false,
}: {
  run: StartedRun;
  freeStems: string[];
  selection: StudioSelection;
  onUnlock: () => void;
  busy?: boolean;
}) {
  const { t, fill, plural } = useI18n();
  const v = t.preview;
  const names = t.run.stems;
  const label = (n: string) => names[n as keyof typeof names] ?? n;
  const { config } = useStudioConfig();
  const [preview, setPreview] = useState<PreviewState>({ phase: "idle" });
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const source = run.family.startsWith("youtube") ? "link" : "file";
  const price = useStudioPrice({
    tool: studioTool(selection.output, source),
    vocalOptions: vocalOptionsOf(selection),
    stemCount: stemCountOf(selection),
  });
  const songs = price?.billable ? price.songs : estimateSongs(selection, config);
  const priceText = price?.willUse === "free" ? t.panel.priceFreeSong : plural(songs, t.songs.count);

  async function makePreview() {
    trackStudio("studio_preview_clicked", { family: run.family });
    setPreview({ phase: "making", since: Date.now() });
    try {
      const p = await requestStudioPreview(run, selection);
      const started = Date.now();
      while (aliveRef.current && Date.now() - started < 5 * 60 * 1000) {
        const st = await getRunStatus(p);
        if (st.status === "complete" && st.clip) {
          const shared = sortStems(st.stems.filter((s) => freeStems.includes(s)));
          if (aliveRef.current) setPreview({ phase: "ready", run: p, clip: st.clip, stems: shared.length ? shared : ["vocals"] });
          return;
        }
        if (st.status === "failed") throw new Error(st.error || v.unavailable);
        await new Promise((r) => window.setTimeout(r, 2000));
      }
    } catch (err) {
      if (!aliveRef.current) return;
      const reason = err instanceof ApiError ? err.kind : undefined;
      const message =
        reason === "daily_limit" ? v.dailyLimit : reason === "input_expired" ? v.expired : err instanceof Error && err.message ? err.message : v.unavailable;
      setPreview({ phase: "error", message });
    }
  }

  const unlockButton = (
    <Button variant="accent" size="lg" onClick={onUnlock} loading={busy} disabled={busy}>
      <Sparkles />
      {v.unlock}
      <span className="font-mono text-xs opacity-70">· {priceText}</span>
    </Button>
  );

  if (!config.preview) {
    return (
      <div className="surface flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-text-primary">{v.upgradeTitle}</p>
          <p className="text-sm text-text-muted">{v.upgradeDesc}</p>
        </div>
        {unlockButton}
      </div>
    );
  }

  return (
    <div className="surface grain overflow-hidden rounded-2xl border border-amber-500/30 bg-graphite-900">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-graphite-800 px-5 py-4">
        <div>
          <p className="display text-2xl text-text-primary md:text-3xl">{v.title}</p>
          <p className="mt-1 text-sm text-text-muted">{fill(v.desc, { n: config.previewSeconds })}</p>
        </div>
        {preview.phase === "idle" && (
          <Button variant="outline" size="lg" onClick={() => void makePreview()}>
            <Sparkles />
            {v.play}
          </Button>
        )}
      </div>

      <div className="px-5 py-4">
        {preview.phase === "making" && (
          <div className="flex items-center gap-3">
            <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-graphite-800">
              <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-amber-500 motion-safe:animate-pulse" />
            </span>
            <span className="font-mono text-[11px] text-amber-400">{v.making}</span>
          </div>
        )}
        {preview.phase === "ready" && (
          <StudioAB
            freeRun={run}
            previewRun={preview.run}
            clip={preview.clip}
            stems={preview.stems}
            label={label}
            freeLabel={v.free}
            studioLabel={v.studio}
            onFirstPlay={() => trackStudio("studio_preview_played", { family: run.family })}
          />
        )}
        {preview.phase === "error" && <p className="text-sm text-text-muted">{preview.message}</p>}
      </div>

      <div className="flex flex-col gap-3 border-t border-graphite-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[11px] text-text-subtle">{v.proof}</p>
        {unlockButton}
      </div>
    </div>
  );
}