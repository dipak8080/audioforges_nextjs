"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { StemMixer } from "@/components/converter/StemMixer";
import { BatchSeparation } from "@/components/converter/BatchSeparation";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StudioInput, type StudioStartRequest } from "./StudioInput";
import { StudioProcessing } from "./StudioProcessing";
import { readLocalAudio, type LocalAudio } from "@/lib/studio/local-audio";
import { sortStems, stemDownloadUrl, stemPreviewUrl } from "@/lib/studio/run";
import { useStudioRun } from "@/lib/studio/use-studio-run";
import type { StudioPresetKey } from "@/lib/studio/presets";
import { triggerDownload, triggerDownloadsStaggered } from "@/lib/utils/download";

export function StudioPanel({ preset }: { preset: StudioPresetKey }) {
  const { t } = useI18n();
  const r = t.run;
  const { refresh } = useCredits();
  const onSettled = useCallback(() => void refresh(), [refresh]);
  const { state, start, cancel, reset } = useStudioRun({ readyTitle: r.readyTitle, onSettled });
  const [request, setRequest] = useState<StudioStartRequest | null>(null);
  const [local, setLocal] = useState<LocalAudio | null>(null);
  const [batch, setBatch] = useState<{ files: File[]; kind: "separate" | "stems" } | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const begin = useCallback(
    (req: StudioStartRequest) => {
      setRequest(req);
      setLocal(null);
      if (req.source.kind === "file" && req.source.files.length > 1) {
        setBatch({ files: req.source.files, kind: req.selection.output === 2 ? "separate" : "stems" });
        return;
      }
      const source =
        req.source.kind === "file" ? { kind: "file" as const, file: req.source.files[0] } : { kind: "link" as const, url: req.source.url };
      if (source.kind === "file") {
        void readLocalAudio(source.file).then(setLocal);
      }
      start({ engine: req.engine, source, selection: req.selection });
    },
    [start]
  );

  const newSong = useCallback(() => {
    reset();
    setRequest(null);
    setLocal(null);
    setBatch(null);
    setInputKey((k) => k + 1);
  }, [reset]);

  const stems = useMemo(() => sortStems(state.status?.stems ?? []), [state.status?.stems]);
  const running = state.phase === "submitting" || state.phase === "running";
  const title =
    state.status?.title ||
    (request?.source.kind === "file" ? request.source.files[0]?.name : request?.source.kind === "link" ? request.source.url : "") ||
    "";

  if (batch) {
    return <BatchSeparation kind={batch.kind} files={batch.files} onExit={newSong} />;
  }

  return (
    <div className="space-y-4">
      <StudioInput key={inputKey} preset={preset} onStart={begin} busy={running} hidden={state.phase !== "idle" && state.phase !== "failed"} />

      {running && request && (
        <StudioProcessing
          phase={state.phase}
          engine={request.engine}
          selection={request.selection}
          title={title}
          peaks={local?.peaks ?? null}
          trackSeconds={local?.duration ?? request.seconds}
          analysis={state.analysis}
          startedAt={state.startedAt}
          onCancel={cancel}
        />
      )}

      {state.phase === "failed" && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="text-sm">
              <p className="text-text-primary">{state.failure?.needsSongs ? r.notEnough : r.failed}</p>
              {state.failure?.message && !state.failure.needsSongs && (
                <p className="mt-0.5 text-text-muted">{state.failure.message}</p>
              )}
              {request?.engine === "studio" && !state.failure?.needsSongs && (
                <p className="mt-0.5 font-mono text-[11px] text-text-subtle">{r.refundNote}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {state.failure?.needsSongs ? (
              <Link href="/pricing" prefetch={false} className={buttonStyles({ variant: "accent", size: "sm" })}>
                {r.getSongs}
              </Link>
            ) : (
              request && (
                <Button variant="outline" size="sm" onClick={() => begin(request)}>
                  <RotateCcw />
                  {r.tryAgain}
                </Button>
              )
            )}
          </div>
        </div>
      )}

      {state.phase === "done" && state.run && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
                {state.run.engine === "studio" ? t.panel.engine : t.panel.freeEngine}
              </span>
              {(state.analysis?.camelot || state.analysis?.bpm) && (
                <span className="rounded-full border border-amber-500/40 px-3 py-1 font-mono text-xs text-amber-400">
                  {[state.analysis?.camelot, state.analysis?.bpm ? `${state.analysis.bpm} BPM` : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={newSong}>
              {r.newSong}
            </Button>
          </div>
          <StemMixer
            key={state.run.jobId}
            stems={stems.map((name) => ({
              name: r.stems[name as keyof typeof r.stems] ?? name,
              url: stemPreviewUrl(state.run!, name),
              downloadName: `${name}.wav`,
            }))}
            mp3
            sourceTitle={state.status?.title ?? null}
            onDownload={(display, format) => {
              const raw = stems.find((n) => (r.stems[n as keyof typeof r.stems] ?? n) === display) ?? display;
              triggerDownload(stemDownloadUrl(state.run!, raw, format));
            }}
            onDownloadAll={() => triggerDownloadsStaggered(stems.map((n) => stemDownloadUrl(state.run!, n)))}
          />
        </section>
      )}
    </div>
  );
}