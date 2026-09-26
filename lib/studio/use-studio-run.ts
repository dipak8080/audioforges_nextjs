"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, analyzeAudioFile, cancelJob, isAbortError } from "@/lib/api/railway";
import { getRunStatus, submitRun, upgradeRun, type RunStatus, type StartedRun, type SubmitInput } from "./run";
import type { StudioSelection } from "./presets";

export type RunPhase = "idle" | "submitting" | "running" | "done" | "failed";

export interface RunAnalysis {
  key: string | null;
  camelot: string | null;
  bpm: number | null;
}

export interface RunFailure {
  message: string;
  needsSongs: boolean;
  rateLimited: boolean;
  retryAfterSeconds: number | null;
  status: number;
}

const plainFailure = (message = ""): RunFailure => ({
  message,
  needsSongs: false,
  rateLimited: false,
  retryAfterSeconds: null,
  status: 0,
});

export interface StudioRunState {
  phase: RunPhase;
  input: SubmitInput | null;
  run: StartedRun | null;
  status: RunStatus | null;
  analysis: RunAnalysis | null;
  failure: RunFailure | null;
  startedAt: number;
}

const IDLE: StudioRunState = {
  phase: "idle",
  input: null,
  run: null,
  status: null,
  analysis: null,
  failure: null,
  startedAt: 0,
};

const MAX_RUN_MS = 30 * 60 * 1000;

function toFailure(err: unknown): RunFailure {
  if (err instanceof ApiError) {
    return {
      message: err.message,
      needsSongs: err.status === 402,
      rateLimited: err.status === 429,
      retryAfterSeconds: err.retryAfterSeconds ?? null,
      status: err.status,
    };
  }
  return plainFailure("Something went wrong. Please try again.");
}

export function useStudioRun({ readyTitle, onSettled }: { readyTitle: string; onSettled?: () => void }) {
  const [state, setState] = useState<StudioRunState>(IDLE);
  const ctrlRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const titleRef = useRef<string | null>(null);
  const settledRef = useRef(onSettled);

  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  const restoreTitle = useCallback(() => {
    if (titleRef.current !== null) {
      document.title = titleRef.current;
      titleRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => {
    stop();
    restoreTitle();
  }, [stop, restoreTitle]);

  const launch = useCallback(
    (input: SubmitInput, submit: (signal: AbortSignal) => Promise<StartedRun>, keep: RunAnalysis | null) => {
      stop();
      restoreTitle();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      const startedAt = Date.now();
      setState({ ...IDLE, phase: "submitting", input, startedAt, analysis: keep });

      if (!keep && input.source.kind === "file") {
        analyzeAudioFile(input.source.file, { signal: ctrl.signal })
          .then((a) => {
            if (ctrl.signal.aborted) return;
            const analysis: RunAnalysis = {
              key: typeof a.key === "string" ? a.key : null,
              camelot: typeof a.camelot === "string" && a.camelot !== "Unknown" ? a.camelot : null,
              bpm: typeof a.bpm === "number" ? Math.round(a.bpm) : null,
            };
            setState((s) => (s.startedAt === startedAt ? { ...s, analysis } : s));
          })
          .catch(() => {});
      }

      const poll = async (run: StartedRun, delay: number) => {
        if (ctrl.signal.aborted) return;
        try {
          const status = await getRunStatus(run, ctrl.signal);
          if (ctrl.signal.aborted) return;
          if (status.status === "complete") {
            titleRef.current = document.title;
            document.title = `✓ ${readyTitle}`;
            setState((s) => ({ ...s, phase: "done", status }));
            settledRef.current?.();
            return;
          }
          if (status.status === "failed") {
            setState((s) => ({ ...s, phase: "failed", status, failure: plainFailure(status.error ?? "") }));
            settledRef.current?.();
            return;
          }
          setState((s) => ({ ...s, status }));
        } catch (err) {
          if (isAbortError(err) || ctrl.signal.aborted) return;
        }
        if (Date.now() - startedAt > MAX_RUN_MS) {
          setState((s) => ({ ...s, phase: "failed", failure: plainFailure() }));
          return;
        }
        const next = Date.now() - startedAt > 90_000 ? 4000 : 2000;
        timerRef.current = window.setTimeout(() => void poll(run, next), delay);
      };

      submit(ctrl.signal)
        .then((run) => {
          if (ctrl.signal.aborted) return;
          setState((s) => ({ ...s, phase: "running", run }));
          timerRef.current = window.setTimeout(() => void poll(run, 2000), 1500);
        })
        .catch((err) => {
          if (isAbortError(err) || ctrl.signal.aborted) return;
          setState((s) => ({ ...s, phase: "failed", failure: toFailure(err) }));
        });
    },
    [readyTitle, restoreTitle, stop]
  );

  const start = useCallback(
    (input: SubmitInput) => launch(input, (signal) => submitRun(input, signal, crypto.randomUUID()), null),
    [launch]
  );

  const upgrade = useCallback(
    (from: StartedRun, input: SubmitInput, selection: StudioSelection, keep: RunAnalysis | null) =>
      launch({ ...input, engine: "studio", selection }, (signal) => upgradeRun(from, selection, signal), keep),
    [launch]
  );

  const cancel = useCallback(() => {
    const jobId = state.run?.jobId;
    stop();
    restoreTitle();
    if (jobId) void cancelJob(jobId);
    setState(IDLE);
  }, [restoreTitle, state.run?.jobId, stop]);

  const reset = useCallback(() => {
    stop();
    restoreTitle();
    setState(IDLE);
  }, [restoreTitle, stop]);

  return { state, start, upgrade, cancel, reset };
}