"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { BatchSeparation } from "@/components/converter/BatchSeparation";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StudioInput, type StudioStartRequest } from "./StudioInput";
import { StudioProcessing } from "./StudioProcessing";
import { StudioResult } from "./StudioResult";
import { UnlockSheet } from "./UnlockSheet";
import { readLocalAudio, type LocalAudio } from "@/lib/studio/local-audio";
import { useStudioRun } from "@/lib/studio/use-studio-run";
import { stemCountOf, studioTool, vocalOptionsOf, type StudioPresetKey } from "@/lib/studio/presets";
import { useStudioPrice } from "@/lib/studio/price";
import { takeResume } from "@/lib/studio/resume";
import { cn } from "@/lib/utils/cn";
import { trackStudio } from "@/lib/studio/track";

export function StudioPanel({ preset }: { preset: StudioPresetKey }) {
  const { t, fill } = useI18n();
  const r = t.run;
  const { refresh } = useCredits();
  const onSettled = useCallback(() => void refresh(), [refresh]);
  const [request, setRequest] = useState<StudioStartRequest | null>(null);
  const [sheet, setSheet] = useState(false);
  const [openAfterRestore, setOpenAfterRestore] = useState(false);
  const onNeedSongs = useCallback(() => {
    setRequest((cur) => (cur ? { ...cur, engine: "one" } : cur));
    setSheet(true);
  }, []);
  const { state, start, upgrade, restore, cancel, reset } = useStudioRun({ readyTitle: r.readyTitle, onSettled, onNeedSongs });
  const pathname = usePathname() ?? "/";
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
      trackStudio("studio_upload", { engine: req.engine, output: req.selection.output, source: req.source.kind });
      start({ engine: req.engine, source, selection: req.selection });
    },
    [start]
  );

  const freeDone = state.phase === "done" && state.run?.engine === "one";
  const sel = request?.selection ?? { output: 2 as const, dereverb: false, leadBack: false };
  const unlockPrice = useStudioPrice(
    {
      tool: studioTool(sel.output, state.run?.family.startsWith("youtube") ? "link" : "file"),
      vocalOptions: vocalOptionsOf(sel),
      stemCount: stemCountOf(sel),
    },
    freeDone
  );

  const runUpgrade = useCallback(() => {
    if (!state.run || !state.input || !request) return;
    setRequest({ ...request, engine: "studio" });
    upgrade(state.run, state.input, request.selection, state.analysis);
  }, [request, state.analysis, state.input, state.run, upgrade]);

  const unlock = useCallback(() => {
    if (!state.run) return;
    trackStudio("studio_unlock_clicked", { family: state.run.family });
    if (unlockPrice && !unlockPrice.canRun) {
      setSheet(true);
      return;
    }
    runUpgrade();
  }, [runUpgrade, state.run, unlockPrice]);

  useEffect(() => {
    const saved = takeResume(pathname);
    if (!saved) return;
    void Promise.resolve().then(() => {
      const input = { engine: "one" as const, source: { kind: "link" as const, url: saved.title }, selection: saved.selection };
      setRequest({ ...input, seconds: null });
      setOpenAfterRestore(true);
      restore(saved.run, input);
    });
  }, [pathname, restore]);

  const sheetOpen = freeDone && (sheet || openAfterRestore);
  const closeSheet = useCallback(() => {
    setSheet(false);
    setOpenAfterRestore(false);
  }, []);
  const paid = useCallback(() => {
    closeSheet();
    runUpgrade();
  }, [closeSheet, runUpgrade]);

  const doneJob = state.phase === "done" ? state.run?.jobId : undefined;
  const doneEngine = state.run?.engine;
  useEffect(() => {
    if (doneJob) trackStudio(doneEngine === "studio" ? "studio_run_done" : "studio_free_done");
  }, [doneJob, doneEngine]);

  const newSong = useCallback(() => {
    reset();
    setRequest(null);
    setLocal(null);
    setBatch(null);
    setInputKey((k) => k + 1);
  }, [reset]);

  const running = state.phase === "submitting" || state.phase === "running";
  const blocked = !!state.failure && (state.failure.needsSongs || state.failure.rateLimited);
  const waitText = `${Math.max(1, Math.ceil((state.failure?.retryAfterSeconds ?? 3600) / 60))} min`;
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

      {state.phase === "failed" && state.failure && (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
            blocked ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-red-500/30 bg-red-500/[0.05]"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", blocked ? "text-amber-400" : "text-red-400")} />
            <div className="text-sm">
              <p className="text-text-primary">
                {state.failure.needsSongs ? r.notEnough : state.failure.rateLimited ? r.rateLimited : r.failed}
              </p>
              {state.failure.rateLimited ? (
                <p className="mt-0.5 text-text-muted">{fill(r.rateRetry, { time: waitText })}</p>
              ) : (
                !state.failure.needsSongs &&
                state.failure.message && <p className="mt-0.5 text-text-muted">{state.failure.message}</p>
              )}
              {request?.engine === "studio" && !blocked && (
                <p className="mt-0.5 font-mono text-[11px] text-text-subtle">{r.refundNote}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {blocked ? (
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

      {state.phase === "done" && state.run && state.status && (
        <StudioResult
          run={state.run}
          status={state.status}
          early={state.analysis}
          selection={request?.selection ?? { output: 2, dereverb: false, leadBack: false }}
          onNewSong={newSong}
          onUnlock={unlock}
        />
      )}

      {state.phase === "done" && state.run && request && (
        <UnlockSheet
          open={sheetOpen}
          songsNeeded={unlockPrice?.billable ? unlockPrice.songs : 1}
          title={title}
          run={state.run}
          selection={request.selection}
          onClose={closeSheet}
          onPaid={paid}
        />
      )}
    </div>
  );
}