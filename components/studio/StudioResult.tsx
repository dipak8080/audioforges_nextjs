"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Disc3, Download, FileMusic, Piano } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StemMixer } from "@/components/converter/StemMixer";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils/cn";
import {
  djExportUrl,
  fetchTrackAnalysis,
  sortStems,
  stemDownloadUrl,
  stemPreviewUrl,
  type RunStatus,
  type StartedRun,
  type TrackAnalysis,
} from "@/lib/studio/run";
import type { RunAnalysis } from "@/lib/studio/use-studio-run";
import { setStemHandoff } from "@/lib/studio/handoff";
import type { StudioSelection } from "@/lib/studio/presets";
import { StudioUpsell } from "./StudioUpsell";
import { triggerDownload, triggerDownloadsStaggered } from "@/lib/utils/download";

export function StudioResult({
  run,
  status,
  early,
  selection,
  onNewSong,
  onUnlock,
  unlocking = false,
}: {
  run: StartedRun;
  status: RunStatus;
  early: RunAnalysis | null;
  selection: StudioSelection;
  onNewSong: () => void;
  onUnlock: () => void;
  unlocking?: boolean;
}) {
  const { t, plural } = useI18n();
  const r = t.result;
  const names = t.run.stems;
  const studio = run.engine === "studio";
  const router = useRouter();
  const [fetched, setFetched] = useState<{ jobId: string; data: TrackAnalysis | null } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchTrackAnalysis(run, ctrl.signal).then((data) => {
      if (!ctrl.signal.aborted) setFetched({ jobId: run.jobId, data });
    });
    return () => ctrl.abort();
  }, [run]);

  const analysis = (fetched?.jobId === run.jobId ? fetched.data : null) ?? early;
  const stems = sortStems(status.stems);
  const label = (n: string) => names[n as keyof typeof names] ?? n;
  const handoffStems = stems.filter((n) => n !== "instrumental");

  function openIn(stem: string, target: string) {
    const base = (status.title || "track").replace(/\.[a-z0-9]+$/i, "");
    setStemHandoff({ url: stemPreviewUrl(run, stem), name: `${base} - ${stem}.wav`, target });
    router.push(target);
  }

  const tag = [analysis?.camelot, analysis?.bpm ? `${analysis.bpm} BPM` : null].filter(Boolean).join(" · ");

  return (
    <section className="space-y-4">
      <div className="surface grain flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-graphite-800 bg-graphite-900 px-5 py-4">
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]",
              studio ? "text-amber-400" : "text-text-muted"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", studio ? "bg-amber-500" : "bg-text-muted")} />
            {studio ? t.panel.engine : t.panel.freeEngine}
          </span>
          <p className="display mt-1 truncate text-3xl text-text-primary md:text-4xl">{status.title || t.run.readyTitle}</p>
          <p className="mt-0.5 font-mono text-[11px] text-text-muted">
            {plural(stems.length, r.stemsCount)}
            {analysis?.key ? ` · ${analysis.key}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tag && (
            <span className="rounded-full border border-amber-500/40 px-3 py-1 font-mono text-sm tracking-wider text-amber-400">
              {tag}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={onNewSong}>
            {t.run.newSong}
          </Button>
        </div>
      </div>

      {!studio && (
        <StudioUpsell run={run} freeStems={stems} selection={selection} onUnlock={onUnlock} busy={unlocking} />
      )}

      <StemMixer
        key={run.jobId}
        stems={stems.map((name) => ({
          name: label(name),
          url: stemPreviewUrl(run, name),
          downloadName: `${name}.wav`,
        }))}
        mp3
        sourceTitle={status.title}
        onDownload={(display, format) => {
          const raw = stems.find((n) => label(n) === display) ?? display;
          triggerDownload(stemDownloadUrl(run, raw, format));
        }}
        onDownloadAll={() => triggerDownloadsStaggered(stems.map((n) => stemDownloadUrl(run, n)))}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="surface flex flex-col justify-between gap-3 rounded-xl border border-graphite-800 bg-graphite-900 p-4">
          <div className="flex items-start gap-3">
            <Disc3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-text-primary">{r.djTitle}</p>
              <p className="text-xs text-text-muted">{r.djDesc}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => triggerDownload(djExportUrl(run, "wav"))}>
              <Download />
              WAV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => triggerDownload(djExportUrl(run, "mp3"))}>
              MP3
            </Button>
          </div>
        </div>

        <HandoffCard
          icon={<Piano className="h-5 w-5" />}
          title={r.midiTitle}
          desc={r.midiDesc}
          hint={r.pickStem}
          stems={handoffStems}
          label={label}
          onPick={(stem) => openIn(stem, "/audio-to-midi")}
        />
        <HandoffCard
          icon={<FileMusic className="h-5 w-5" />}
          title={r.sheetTitle}
          desc={r.sheetDesc}
          hint={r.pickStem}
          stems={handoffStems}
          label={label}
          onPick={(stem) => openIn(stem, "/audio-to-sheet-music")}
        />
      </div>

    </section>
  );
}

function HandoffCard({
  icon,
  title,
  desc,
  hint,
  stems,
  label,
  onPick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  hint: string;
  stems: string[];
  label: (n: string) => string;
  onPick: (stem: string) => void;
}) {
  return (
    <div className="surface flex flex-col justify-between gap-3 rounded-xl border border-graphite-800 bg-graphite-900 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-text-muted">{icon}</span>
        <div>
          <p className="text-text-primary">{title}</p>
          <p className="text-xs text-text-muted">{desc}</p>
        </div>
      </div>
      <div>
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{hint}</p>
        <div className="flex flex-wrap gap-1.5">
          {stems.map((stem) => (
            <Button key={stem} size="sm" variant="outline" onClick={() => onPick(stem)}>
              {label(stem)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}