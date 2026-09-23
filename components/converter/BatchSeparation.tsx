"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Layers,
  Mic2,
  Music4,
  Plus,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Section, ValidationNote, ErrorPanel, type FormError } from "@/components/tools/JobFormKit";
import { StemMixer } from "@/components/converter/StemMixer";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile } from "@/lib/utils/validation";
import { triggerDownload } from "@/lib/utils/download";
import {
  ApiError,
  getSeparationPreviewUrl,
  getSeparationDownloadUrl,
  getStemsPreviewUrl,
  getStemsDownloadUrl,
} from "@/lib/api/railway";
import type { StemType } from "@/lib/types/converter";
import {
  addToBatch,
  cancelBatch,
  clearStoredBatch,
  createBatch,
  getBatchDownloadUrl,
  getBatchStatus,
  startBatch,
  storeBatch,
  type BatchJobStatus,
  type BatchKind,
  type BatchStatusResponse,
} from "@/lib/api/batch";
import { useCredits } from "@/components/credits/CreditProvider";
import { useCreditGate } from "@/components/credits/useCreditGate";

export const MAX_BATCH_TRACKS = 20;
const POLL_MS = 5_000;
const ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac";

type RowStatus = "pending" | "invalid" | "uploading" | BatchJobStatus | "skipped";

interface Row {
  id: string;
  file: File | null;
  name: string;
  size: number;
  status: RowStatus;
  jobId?: string;
  error?: string;
  stems: string[];
}

type Phase = "ready" | "uploading" | "running" | "finished" | "cancelled";

export interface BatchSeparationProps {
  kind: BatchKind;
  files: File[];
  resumeBatchId?: string;
  onExit: () => void;
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function stemLabel(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function rowFromFile(file: File): Row {
  const v = validateAudioFile(file);
  return {
    id: newId(),
    file,
    name: file.name,
    size: file.size,
    status: v.isValid ? "pending" : "invalid",
    error: v.isValid ? undefined : v.error || "That file can't be used here",
    stems: [],
  };
}

function StatusPill({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, [string, string]> = {
    pending: ["Ready", "text-text-subtle border-graphite-700"],
    invalid: ["Skipped", "text-red-400 border-red-500/30"],
    uploading: ["Uploading", "text-amber-400 border-amber-500/40"],
    queued: ["Queued", "text-text-muted border-graphite-700"],
    processing: ["Separating", "text-amber-400 border-amber-500/40"],
    complete: ["Done", "text-teal-400 border-teal-500/30"],
    failed: ["Failed", "text-red-400 border-red-500/30"],
    expired: ["Expired", "text-text-subtle border-graphite-700"],
    skipped: ["Skipped", "text-text-subtle border-graphite-700"],
  };
  const [label, tone] = map[status];
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em]",
        tone,
        status === "processing" && "animate-pulse"
      )}
    >
      {label}
    </span>
  );
}

function Strip({ rows }: { rows: Row[] }) {
  return (
    <div className={cn("flex h-1.5 items-stretch", rows.length > 12 ? "gap-px" : "gap-[3px]")} aria-hidden>
      {rows.map((r) => (
        <span
          key={r.id}
          className={cn(
            "min-w-0 flex-1 rounded-[2px] transition-colors",
            r.status === "complete" && "bg-teal-400",
            r.status === "processing" && "animate-pulse bg-amber-400",
            r.status === "uploading" && "bg-amber-400/60",
            r.status === "queued" && "bg-graphite-600",
            (r.status === "failed" || r.status === "invalid") && "bg-red-500/70",
            (r.status === "pending" || r.status === "skipped" || r.status === "expired") && "bg-graphite-800"
          )}
        />
      ))}
    </div>
  );
}

export function BatchSeparation({ kind, files, resumeBatchId, onExit }: BatchSeparationProps) {
  const [rows, setRows] = useState<Row[]>(() => files.slice(0, MAX_BATCH_TRACKS).map(rowFromFile));
  const [phase, setPhase] = useState<Phase>(resumeBatchId ? "running" : "ready");
  const [batchId, setBatchId] = useState<string | null>(resumeBatchId ?? null);
  const [notice, setNotice] = useState<string | null>(
    files.length > MAX_BATCH_TRACKS
      ? `${files.length} files dropped. The first ${MAX_BATCH_TRACKS} were kept, which is the limit per batch.`
      : null
  );
  const [error, setError] = useState<FormError | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [format, setFormat] = useState<"wav" | "mp3">("wav");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadRef = useRef(false);
  const startRef = useRef<() => void>(() => {});

  const { balance, freeRemaining, enabled: creditsEnabled, loading: creditsLoading, me, applyBalance, refresh } =
    useCredits();
  const { catchCreditError, gate } = useCreditGate({ onCredited: () => startRef.current() });

  const ruleKey = kind === "stems" ? "stems-hq" : "separate-hq";
  const costPerTrack = me?.paywall?.tools?.[ruleKey]?.credits ?? 1;

  const valid = rows.filter((r) => r.status !== "invalid");
  const toCharge = rows.filter((r) => r.status === "pending").length;
  const creditsNeeded = Math.max(0, toCharge - freeRemaining) * costPerTrack;
  const shortfall = Math.max(0, creditsNeeded - balance);

  const done = rows.filter((r) => r.status === "complete");
  const failed = rows.filter((r) => r.status === "failed");
  const settled = rows.filter((r) => ["complete", "failed", "expired", "skipped", "invalid"].includes(r.status));
  const current = rows.find((r) => r.status === "processing" || r.status === "uploading");

  useEffect(() => {
    deadRef.current = false;
    return () => {
      deadRef.current = true;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "running" && phase !== "uploading") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const applyStatus = useCallback(
    (s: BatchStatusResponse) => {
      setRows((prev) => {
        const byJob = new Map(s.jobs.map((j) => [j.job_id, j]));
        const next = prev.map((r) => {
          if (!r.jobId) return r;
          const j = byJob.get(r.jobId);
          if (!j) return r;
          return { ...r, status: j.status, error: j.error ?? undefined, stems: j.stems, name: j.title ?? r.name };
        });
        if (prev.length === 0) {
          return s.jobs.map((j) => ({
            id: j.job_id,
            file: null,
            name: j.title ?? `Track ${j.index}`,
            size: 0,
            status: j.status,
            jobId: j.job_id,
            error: j.error ?? undefined,
            stems: j.stems,
          }));
        }
        return next;
      });
      if (s.status === "done" || s.status === "expired") setPhase("finished");
      if (s.status === "cancelled") setPhase("cancelled");
      if (s.status === "done" || s.status === "cancelled" || s.status === "expired") {
        clearStoredBatch(kind);
        void refresh();
      }
    },
    [kind, refresh]
  );

  const pollFnRef = useRef<(id: string) => void>(() => {});
  const poll = useCallback(
    (id: string) => {
      if (deadRef.current) return;
      getBatchStatus(id)
        .then((s) => {
          if (deadRef.current) return;
          if (s.status === "collecting") {
            if (s.jobs.length > 0) {
              applyStatus(s);
              void startBatch(id)
                .then(() => {
                  if (deadRef.current) return;
                  setStartedAt(Date.now());
                  setPhase("running");
                  pollRef.current = setTimeout(() => pollFnRef.current(id), POLL_MS);
                })
                .catch(() => {
                  if (!deadRef.current) pollRef.current = setTimeout(() => pollFnRef.current(id), POLL_MS * 2);
                });
            } else {
              void cancelBatch(id).catch(() => {});
              clearStoredBatch(kind);
              setPhase("finished");
              setError({ title: "The earlier batch had no tracks", hint: "Drop the files again to run a new batch." });
            }
            return;
          }
          applyStatus(s);
          if (s.status === "running") {
            pollRef.current = setTimeout(() => pollFnRef.current(id), POLL_MS);
          }
        })
        .catch((err) => {
          if (deadRef.current) return;
          if (err instanceof ApiError && err.status === 404) {
            clearStoredBatch(kind);
            setError({ title: "This batch expired", hint: "Results are kept for 4 hours. Drop the files again to run a new batch." });
            setPhase("finished");
            return;
          }
          pollRef.current = setTimeout(() => pollFnRef.current(id), POLL_MS * 2);
        });
    },
    [applyStatus, kind]
  );
  useEffect(() => {
    pollFnRef.current = poll;
  }, [poll]);

  useEffect(() => {
    if (resumeBatchId) poll(resumeBatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (picked: File[]) => {
    if (phase !== "ready") return;
    setRows((prev) => {
      const room = MAX_BATCH_TRACKS - prev.length;
      const kept = picked.slice(0, Math.max(0, room));
      if (picked.length > kept.length) {
        setNotice(`Only ${MAX_BATCH_TRACKS} tracks fit in one batch. ${picked.length - kept.length} left out.`);
      }
      return [...prev, ...kept.map(rowFromFile)];
    });
  };

  const removeRow = (id: string) => {
    if (phase !== "ready") return;
    setRows((prev) => prev.filter((r) => r.id !== id || r.status === "queued"));
  };

  const onDrag = (e: DragEvent, type: "enter" | "leave" | "over" | "drop") => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "enter" || type === "over") setDragging(true);
    if (type === "leave") setDragging(false);
    if (type === "drop") {
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files ?? []));
    }
  };

  const uploadFrom = async (id: string, list: Row[]): Promise<Row[]> => {
    let working = list;
    for (let i = 0; i < working.length; i++) {
      const row = working[i];
      if (row.status !== "pending" || !row.file) continue;
      working = working.map((r) => (r.id === row.id ? { ...r, status: "uploading" } : r));
      setRows(working);
      try {
        const res = await addToBatch(id, row.file);
        if (deadRef.current) return working;
        working = working.map((r) =>
          r.id === row.id ? { ...r, status: "queued", jobId: res.job_id, name: res.title || r.name } : r
        );
        applyBalance(res.billing.balance, res.billing.free_remaining);
      } catch (err) {
        if (deadRef.current) return working;
        if (catchCreditError(err)) {
          working = working.map((r) => (r.id === row.id ? { ...r, status: "pending" } : r));
          setRows(working);
          throw err;
        }
        const message = err instanceof ApiError ? err.message : "Upload failed";
        working = working.map((r) => (r.id === row.id ? { ...r, status: "failed", error: message } : r));
      }
      setRows(working);
    }
    return working;
  };

  const handleStart = useCallback(async () => {
    setError(null);
    setNotice(null);
    let id = batchId;
    let list = rows;
    if (valid.length === 0) return;
    setPhase("uploading");
    try {
      if (!id) {
        const created = await createBatch(kind, valid.length);
        if (deadRef.current) return;
        id = created.batch_id;
        setBatchId(id);
        storeBatch(kind, id);
        applyBalance(created.balance, created.free_remaining);
      }
      list = await uploadFrom(id, list);
      if (deadRef.current) return;
      const queued = list.filter((r) => r.status === "queued").length;
      if (queued === 0) {
        setPhase("ready");
        setError({ title: "No track could be added", hint: "Check the messages on each row, then try again." });
        return;
      }
      await startBatch(id);
      if (deadRef.current) return;
      setRows(list.map((r) => (r.status === "pending" ? { ...r, status: "skipped" } : r)));
      setStartedAt(Date.now());
      setPhase("running");
      poll(id);
    } catch (err) {
      if (deadRef.current) return;
      if (err instanceof ApiError && err.kind === "insufficient_credits") {
        setPhase("ready");
        return;
      }
      if (catchCreditError(err)) {
        setPhase("ready");
        return;
      }
      setPhase("ready");
      if (err instanceof ApiError && err.isRateLimit) {
        setError({ title: "Too many batch requests", hint: `Wait ${formatWait(err.retryAfterSeconds ?? 60)} and try again.` });
      } else if (err instanceof ApiError && err.isServerBusy) {
        setError({ title: "The batch queue is full", hint: err.message });
      } else {
        setError({ title: "The batch could not start", hint: err instanceof ApiError ? err.message : "Try again in a moment." });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, rows, valid.length, kind, applyBalance, catchCreditError, poll]);

  useEffect(() => {
    startRef.current = () => {
      void handleStart();
    };
  });

  const handleCancel = async () => {
    if (!batchId) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    try {
      await cancelBatch(batchId);
    } catch {
      /* the poll picks up the real state either way */
    }
    clearStoredBatch(kind);
    setPhase("cancelled");
    setRows((prev) =>
      prev.map((r) => (r.status === "queued" || r.status === "uploading" || r.status === "pending" ? { ...r, status: "skipped" } : r))
    );
    void refresh();
    if (batchId) poll(batchId);
  };

  const handleStartUploaded = async () => {
    if (!batchId) return;
    setError(null);
    try {
      await startBatch(batchId);
      if (deadRef.current) return;
      setRows((prev) => prev.map((r) => (r.status === "pending" ? { ...r, status: "skipped" } : r)));
      setStartedAt(Date.now());
      setPhase("running");
      poll(batchId);
    } catch (err) {
      if (deadRef.current) return;
      setError({ title: "The batch could not start", hint: err instanceof ApiError ? err.message : "Try again in a moment." });
    }
  };

  const handleExit = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    if (batchId && phase === "ready") {
      void cancelBatch(batchId).then(() => refresh()).catch(() => {});
    }
    clearStoredBatch(kind);
    onExit();
  };

  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const eta = useMemo(() => {
    if (phase !== "running" || done.length === 0 || !startedAt) return null;
    const perTrack = elapsed / done.length;
    const left = rows.filter((r) => r.status === "queued" || r.status === "processing").length;
    return perTrack * left;
  }, [phase, done.length, startedAt, elapsed, rows]);

  const mixerFor = (row: Row) => {
    if (!row.jobId || row.status !== "complete") return null;
    const jobId = row.jobId;
    const names = row.stems.length ? row.stems : kind === "stems" ? ["vocals", "drums", "bass", "other"] : ["vocals", "instrumental"];
    const previewUrl = (s: string) => (kind === "stems" ? getStemsPreviewUrl(jobId, s) : getSeparationPreviewUrl(jobId, s as StemType));
    const downloadUrl = (s: string, f: "wav" | "mp3") =>
      kind === "stems" ? getStemsDownloadUrl(jobId, s, f) : getSeparationDownloadUrl(jobId, s as StemType, "separate", f);
    return (
      <StemMixer
        key={jobId}
        stems={names.map((s) => ({
          name: stemLabel(s),
          url: previewUrl(s),
          downloadName: `${s}.wav`,
          icon: s === "vocals" ? <Mic2 className="h-4 w-4" aria-hidden /> : <Music4 className="h-4 w-4" aria-hidden />,
        }))}
        mp3
        onDownload={(display, f) => triggerDownload(downloadUrl(display.toLowerCase(), f ?? "wav"))}
        sourceTitle={row.name}
      />
    );
  };

  const headline =
    phase === "ready"
      ? `${valid.length} ${valid.length === 1 ? "track" : "tracks"} ready`
      : phase === "uploading"
        ? `Uploading ${current?.name ?? ""}`
        : phase === "running"
          ? current
            ? `Separating ${current.name}`
            : "Waiting for a free slot"
          : phase === "cancelled"
            ? `Stopped. ${done.length} finished, credits for the rest returned`
            : failed.length
              ? `${done.length} of ${rows.length} finished, ${failed.length} failed and refunded`
              : `${done.length} ${done.length === 1 ? "track" : "tracks"} finished`;

  const sub =
    phase === "ready"
      ? creditsEnabled && !creditsLoading
        ? creditsNeeded === 0
          ? toCharge > 0 && toCharge <= freeRemaining
            ? "Covered by your free run"
            : `${toCharge} credits, you have ${balance}`
          : shortfall > 0
            ? `Needs ${creditsNeeded} credits, you have ${balance}. ${shortfall} more to run all ${toCharge}.`
            : `${creditsNeeded} credits from your ${balance}${freeRemaining > 0 ? ", first track on your free run" : ""}`
        : "Studio Quality, 1 credit per track"
      : phase === "running"
        ? `${done.length} of ${rows.length} done${eta && eta > 5 ? `, about ${formatWait(eta)} left` : ""}`
        : phase === "uploading"
          ? `${rows.filter((r) => r.status === "queued").length} of ${valid.length} uploaded`
          : `Results stay available for 4 hours`;

  return (
    <div className="surface grain overflow-clip rounded-2xl border border-graphite-800">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-graphite-800 px-4 py-2.5 sm:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              phase === "finished" ? "bg-teal-400" : phase === "running" || phase === "uploading" ? "animate-pulse bg-amber-500" : "bg-graphite-600"
            )}
            aria-hidden
          />
          <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            {kind === "stems" ? "Stem splitter" : "Vocal remover"} · Batch
          </span>
        </div>
        <span className="shrink-0 rounded border border-amber-500/40 px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] text-amber-400">
          Studio Quality
        </span>
      </div>

      <Section className="space-y-5">
        <div
          onDragEnter={(e) => onDrag(e, "enter")}
          onDragLeave={(e) => onDrag(e, "leave")}
          onDragOver={(e) => onDrag(e, "over")}
          onDrop={(e) => onDrag(e, "drop")}
          className={cn(
            "-m-2 space-y-4 rounded-2xl p-2 outline outline-1 outline-offset-4 outline-transparent transition-[outline-color,background-color] duration-200",
            dragging && phase === "ready" && "bg-amber-500/[0.04] outline-dashed outline-amber-500/60"
          )}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0" role="status" aria-live="polite">
              <p className="truncate text-lg font-semibold tracking-tight text-text-primary">{headline}</p>
              <p className="mt-1 font-mono text-xs tabular-nums text-text-muted">{sub}</p>
            </div>
            {phase === "ready" && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={rows.length >= MAX_BATCH_TRACKS}>
                  <Plus />
                  Add files
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    e.target.value = "";
                  }}
                />
              </div>
            )}
            {(phase === "finished" || phase === "cancelled") && done.length > 0 && batchId && (
              <div className="flex items-center gap-2">
                <div className="flex overflow-hidden rounded-lg border border-graphite-700" role="group" aria-label="Download format">
                  {(["wav", "mp3"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      aria-pressed={format === f}
                      className={cn(
                        "px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70",
                        format === f ? "bg-text-primary text-graphite-950" : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <Button size="sm" onClick={() => triggerDownload(getBatchDownloadUrl(batchId, format))}>
                  <Download />
                  Download all ({done.length})
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Strip rows={rows} />
            <p className="flex justify-between font-mono text-[11px] tabular-nums text-text-subtle">
              <span>
                {rows.length} of {MAX_BATCH_TRACKS} slots
              </span>
              <span className="font-sans">
                {phase === "ready" ? (dragging ? "Release to add" : "Drop more files here") : `${settled.length} settled`}
              </span>
            </p>
          </div>

          {notice && <ValidationNote message={notice} />}
          {error && <ErrorPanel error={error} />}

          <ul className="divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950/40">
            {rows.map((row, i) => {
              const open = openId === row.id && row.status === "complete";
              return (
                <li key={row.id} className="jt-in">
                  <div className="flex items-center gap-3 py-2 pl-3 pr-1.5 sm:pl-4">
                    <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-text-subtle">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", row.status === "invalid" ? "text-text-muted" : "text-text-primary")}>
                        {row.name}
                      </span>
                      {row.error && (row.status === "failed" || row.status === "invalid") && (
                        <span className="block truncate text-xs text-red-400">{row.error}</span>
                      )}
                      {row.status === "complete" && row.stems.length > 0 && (
                        <span className="block text-[11px] text-text-subtle">{row.stems.map(stemLabel).join(" · ")}</span>
                      )}
                    </span>
                    {row.size > 0 && (
                      <span className="hidden w-14 shrink-0 text-right font-mono text-xs tabular-nums text-text-subtle sm:inline">
                        {formatSize(row.size)}
                      </span>
                    )}
                    <StatusPill status={row.status} />
                    {phase === "ready" && row.status !== "queued" ? (
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${row.name}`} onClick={() => removeRow(row.id)}>
                        <X />
                      </Button>
                    ) : row.status === "complete" ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={open ? `Close ${row.name}` : `Open ${row.name} in Forge Mixer`}
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : row.id)}
                      >
                        {open ? <ChevronDown /> : <Layers />}
                      </Button>
                    ) : (
                      <span className="h-8 w-8 shrink-0" aria-hidden />
                    )}
                  </div>
                  {open && <div className="border-t border-graphite-800 p-3 sm:p-4">{mixerFor(row)}</div>}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite-800 pt-5">
          <div className="flex items-center gap-2">
            {phase === "ready" && (
              <Button size="lg" onClick={() => void handleStart()} disabled={valid.length === 0 || creditsLoading}>
                <Check />
                {shortfall > 0 && creditsEnabled
                  ? `Get ${shortfall} ${shortfall === 1 ? "credit" : "credits"} and run ${valid.length}`
                  : `Run ${valid.length} ${valid.length === 1 ? "track" : "tracks"} in Studio Quality`}
              </Button>
            )}
            {phase === "ready" && batchId && rows.some((r) => r.status === "queued") && (
              <Button variant="outline" size="lg" onClick={() => void handleStartUploaded()}>
                Run the {rows.filter((r) => r.status === "queued").length} already uploaded
              </Button>
            )}
            {(phase === "running" || phase === "uploading") && (
              <Button variant="outline" size="lg" onClick={() => void handleCancel()} disabled={!batchId}>
                <Square />
                Stop and refund the rest
              </Button>
            )}
            {(phase === "finished" || phase === "cancelled") && (
              <Button variant="outline" size="lg" onClick={handleExit}>
                <RotateCcw />
                New batch
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {phase === "running" && (
              <span className="font-mono text-xs tabular-nums text-text-subtle">{formatWait(elapsed)} elapsed</span>
            )}
            {phase === "ready" && (
              <Button variant="ghost" size="sm" onClick={handleExit}>
                Back to single track
              </Button>
            )}
          </div>
        </div>
      </Section>

      {gate}
    </div>
  );
}