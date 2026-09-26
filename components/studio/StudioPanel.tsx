"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { BatchSeparation } from "@/components/converter/BatchSeparation";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StudioInput, type StudioStartRequest } from "./StudioInput";
import { StudioProcessing } from "./StudioProcessing";
import { StudioResult } from "./StudioResult";
import { readLocalAudio, type LocalAudio } from "@/lib/studio/local-audio";
import { useStudioRun } from "@/lib/studio/use-studio-run";
import type { StudioPresetKey } from "@/lib/studio/presets";
import { cn } from "@/lib/utils/cn";

export function StudioPanel({ preset }: { preset: StudioPresetKey }) {
  const { t, fill } = useI18n();
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
        <StudioResult run={state.run} status={state.status} early={state.analysis} onNewSong={newSong} />
      )}
    </div>
  );
}