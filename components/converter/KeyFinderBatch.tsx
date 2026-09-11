"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { AnalysisResultCard, toAnalysisResult } from "@/components/converter/AnalysisResultCard";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import { analyzeAudioFile, isAbortError, ApiError } from "@/lib/api/railway";
import type { AnalysisResult } from "@/lib/types/converter";

export const MAX_BATCH_FILES = 20;

const BUSY_RETRY_SECONDS = 10;
const BUSY_MAX_TRIES = 3;

type RowStatus = "waiting" | "analysing" | "done" | "failed";

interface Row {
  id: string;
  file: File;
  name: string;
  status: RowStatus;
  result: AnalysisResult | null;
  error: string | null;
}

type SortKey = "camelot" | "bpm" | null;

/** 8A sorts before 8B, and 9A after both. String order gets 10A before 2A. */
function camelotRank(code: string): number {
  const m = /^(\d{1,2})([AB])$/i.exec(code.trim());
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]) * 2 + (m[2].toUpperCase() === "B" ? 1 : 0);
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildCsv(rows: Row[]): string {
  const header = ["file", "key", "camelot", "bpm", "key_confidence", "bpm_confidence"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    if (row.status !== "done" || !row.result) continue;
    lines.push(
      [
        row.name,
        row.result.key,
        row.result.camelot,
        row.result.bpm,
        row.result.confidence,
        row.result.bpmConfidence,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\n");
}

function StatusDot({ status }: { status: RowStatus }) {
  const tone =
    status === "done"
      ? "bg-amber-500"
      : status === "analysing"
        ? "bg-amber-400 animate-pulse motion-reduce:animate-none"
        : status === "failed"
          ? "bg-red-500/70"
          : "bg-graphite-600";
  return <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", tone)} aria-hidden />;
}

function SortHeader({
  label,
  active,
  asc,
  onClick,
}: {
  label: string;
  active: boolean;
  asc: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-left hover:text-amber-400"
    >
      {label}
      {active && (asc ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}

export function KeyFinderBatch({
  files,
  onReset,
}: {
  files: File[];
  onReset: () => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    files.map((file, i) => {
      const validation = validateAudioFile(file);
      return {
        id: `${i}-${file.name}-${file.size}`,
        file,
        name: file.name,
        status: validation.isValid ? ("waiting" as RowStatus) : ("failed" as RowStatus),
        result: null,
        error: validation.isValid ? null : validation.error || "That file can't be used here",
      };
    })
  );
  const [running, setRunning] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  const patch = useCallback((id: string, next: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  /*
    One request at a time, in order. The queue is a single async loop rather
    than one effect per row: parallel requests are what a synchronous endpoint
    with four global slots cannot take.
  */
  useEffect(() => {
    let stopped = false;
    cancelledRef.current = false;

    const sleep = (seconds: number) =>
      new Promise<void>((resolve) => {
        let left = seconds;
        setCooldownSeconds(left);
        const tick = setInterval(() => {
          left -= 1;
          setCooldownSeconds(Math.max(0, left));
          if (left <= 0) {
            clearInterval(tick);
            resolve();
          }
        }, 1000);
      });

    async function run() {
      for (const row of rows) {
        if (stopped || cancelledRef.current) return;
        if (row.status !== "waiting") continue;

        let busyTries = 0;
        for (;;) {
          if (stopped || cancelledRef.current) return;
          const controller = new AbortController();
          abortRef.current = controller;
          patch(row.id, { status: "analysing" });
          try {
            const data = await analyzeAudioFile(row.file, { signal: controller.signal });
            if (stopped || cancelledRef.current) return;
            patch(row.id, { status: "done", result: toAnalysisResult(data), error: null });
            break;
          } catch (err) {
            if (stopped || cancelledRef.current || isAbortError(err) || controller.signal.aborted) return;

            if (err instanceof ApiError && err.isRateLimit) {
              patch(row.id, { status: "waiting" });
              await sleep(Math.max(1, err.retryAfterSeconds ?? getRetryAfterFallback("analyze")));
              continue;
            }
            if (err instanceof ApiError && err.isServerBusy && busyTries < BUSY_MAX_TRIES - 1) {
              busyTries += 1;
              patch(row.id, { status: "waiting" });
              await sleep(BUSY_RETRY_SECONDS);
              continue;
            }
            patch(row.id, {
              status: "failed",
              error: err instanceof ApiError ? err.message : "Analysis failed",
            });
            break;
          } finally {
            abortRef.current = null;
          }
        }
      }
      if (!stopped) setRunning(false);
    }

    void run();
    return () => {
      stopped = true;
    };
    // Started once for this set of files. rows is seeded from `files` and only
    // ever patched, so re-running on every patch would restart the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch]);

  const doneCount = rows.filter((r) => r.status === "done").length;
  const settled = rows.filter((r) => r.status === "done" || r.status === "failed").length;
  const currentIndex = rows.findIndex((r) => r.status === "analysing");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortKey === "camelot" ? camelotRank(a.result?.camelot ?? "") : (a.result?.bpm ?? NaN);
      const bv = sortKey === "camelot" ? camelotRank(b.result?.camelot ?? "") : (b.result?.bpm ?? NaN);
      const aBad = !Number.isFinite(av);
      const bBad = !Number.isFinite(bv);
      if (aBad && bBad) return 0;
      if (aBad) return 1;
      if (bBad) return -1;
      return sortAsc ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortAsc]);

  function toggleSort(key: Exclude<SortKey, null>) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function cancel() {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setCooldownSeconds(0);
    setRows((prev) => prev.map((r) => (r.status === "waiting" || r.status === "analysing" ? { ...r, status: "failed", error: "Cancelled" } : r)));
  }

  function downloadCsv() {
    const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audioforges-key-bpm.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const openRow = rows.find((r) => r.id === openId && r.status === "done" && r.result);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted" role="status" aria-live="polite">
          {running ? (
            cooldownSeconds > 0 ? (
              <>Waiting {cooldownSeconds}s, then continuing</>
            ) : (
              <>
                Analysing {Math.min(currentIndex + 1 || settled + 1, rows.length)} of {rows.length}
              </>
            )
          ) : (
            <>
              {doneCount} of {rows.length} analysed
            </>
          )}
        </p>
        <div className="flex gap-2">
          {running ? (
            <Button variant="outline" size="sm" onClick={cancel}>
              <X />
              Cancel
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw />
              Start over
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={doneCount === 0}>
            <Download />
            Download CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-graphite-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-graphite-900 text-xs text-text-subtle">
            <tr>
              <th className="px-3 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium">Key</th>
              <th className="px-3 py-2 font-medium">
                <SortHeader
                  label="Camelot"
                  active={sortKey === "camelot"}
                  asc={sortAsc}
                  onClick={() => toggleSort("camelot")}
                />
              </th>
              <th className="px-3 py-2 font-medium">
                <SortHeader
                  label="BPM"
                  active={sortKey === "bpm"}
                  asc={sortAsc}
                  onClick={() => toggleSort("bpm")}
                />
              </th>
              <th className="hidden px-3 py-2 font-medium sm:table-cell">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite-800">
            {sorted.map((row) => {
              const clickable = row.status === "done";
              return (
                <tr
                  key={row.id}
                  onClick={() => clickable && setOpenId(openId === row.id ? null : row.id)}
                  className={cn(
                    "bg-graphite-950/40",
                    clickable && "cursor-pointer hover:bg-graphite-900",
                    openId === row.id && "bg-amber-500/[0.06]"
                  )}
                >
                  <td className="max-w-[16rem] px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <StatusDot status={row.status} />
                      <span className="truncate text-text-primary">{row.name}</span>
                    </span>
                    {row.error && <span className="mt-0.5 block text-xs text-red-400">{row.error}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{row.result?.key ?? "N/A"}</td>
                  <td className="px-3 py-2.5 font-mono text-amber-400">{row.result?.camelot ?? "N/A"}</td>
                  <td className="px-3 py-2.5 font-mono tabular-nums text-text-muted">
                    {row.result ? Math.round(row.result.bpm) : "N/A"}
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono tabular-nums text-text-subtle sm:table-cell">
                    {row.result ? `${Math.round(row.result.confidence * 100)}%` : "N/A"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openRow?.result && <AnalysisResultCard result={openRow.result} />}

      <p className="text-xs text-text-subtle">
        Files run one after another, not at once, so the analyser is never overloaded. Click a row
        for its full result and Camelot neighbours.
      </p>
    </div>
  );
}