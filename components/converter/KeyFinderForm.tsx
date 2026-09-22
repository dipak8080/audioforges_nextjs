"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music } from "lucide-react";
import {
  CooldownBar,
  ErrorPanel,
  ValidationNote,
  easedProgress,
  formatCooldown,
  formatElapsed,
  stageIndexFor,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
  type ProcessingStage,
} from "@/components/tools/JobFormKit";
import { StudioStage, type StageTier } from "@/components/tools/StudioStage";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { AnalysisResultCard, toAnalysisResult } from "@/components/converter/AnalysisResultCard";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import { analyzeAudioFile, isAbortError, ApiError } from "@/lib/api/railway";
import { KeyFinderBatch, type BatchPhase, type BatchStatus } from "@/components/converter/KeyFinderBatch";
import { BATCH_CONCURRENCY, MAX_BATCH_FILES } from "@/lib/data/key-finder";
import { cn } from "@/lib/utils/cn";
import type { AnalysisResult, ProcessingState } from "@/lib/types/converter";

// Timed for the sped-up /analyze (~8s warm on a full song).
const STAGES: ProcessingStage[] = [
  { at: 0, label: "Reading the audio" },
  { at: 2, label: "Reading the tempo grid" },
  { at: 4, label: "Estimating the key" },
  { at: 7, label: "Cross-checking both detectors" },
];

const TIERS: StageTier<"free">[] = [
  {
    value: "free",
    name: "Free",
    model: "TempoCNN · Essentia",
    time: "about 10 seconds",
    footnote: `Batch up to ${MAX_BATCH_FILES} files`,
  },
];

function humanizeError(raw: string): FormError {
  const text = raw.toLowerCase();
  if (text.includes("too large") || text.includes("size")) {
    return { title: "This file is too large", hint: "Trim it down or export at a smaller size." };
  }
  if (text.includes("format") || text.includes("codec") || text.includes("decode")) {
    return { title: "This file couldn't be read", hint: "Try re-exporting it as WAV or MP3." };
  }
  if (text.includes("network") || text.includes("timeout")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return { title: raw, hint: "Run it again. If it keeps failing, try a different file." };
}

// Right pane of the idle stage. Every line is measured or published, nothing invented.
function KeyFinderAside() {
  const rows: Array<[string, string]> = [
    ["Reads", "Key, BPM and Camelot code"],
    ["Measured", "75% exact BPM on the 662-track GiantSteps set"],
    ["Batch", `Up to ${MAX_BATCH_FILES} files. CSV or renamed-file export`],
    ["Privacy", "Deleted the moment analysis finishes"],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 px-5 py-6 sm:px-7">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-3">
          <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
            {label}
          </span>
          <span className="text-sm leading-snug text-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function KeyFinderForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[] | null>(null);
  const [batchNote, setBatchNote] = useState<string | null>(null);
  const [batchPhase, setBatchPhase] = useState<BatchPhase>("ready");
  const [batchCount, setBatchCount] = useState(0);

  const isProcessing = status === "processing";
  const isComplete = status === "complete";
  const isFailed = status === "error";

  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isProcessing);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  const [cooldownCeiling, setCooldownCeiling] = useState(getRetryAfterFallback("analyze"));

  // /analyze can run for ninety seconds; abort covers Cancel and unmount.
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canAnalyze = Boolean(file) && !isProcessing && !isComplete && cooldownSeconds === 0;

  const handleBatchStatus = useCallback((s: BatchStatus) => {
    setBatchPhase(s.phase);
    setBatchCount(s.count);
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    setValidationError(null);
    const validation = validateAudioFile(selectedFile);
    if (!validation.isValid) {
      setValidationError(validation.error || "That file can't be used here");
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setStatus("idle");
    setError(null);
  };

  // One file behaves exactly as before. Two or more switch to the queue.
  const handleFilesSelect = (selected: File[]) => {
    if (selected.length <= 1) {
      setBatchNote(null);
      if (selected[0]) handleFileSelect(selected[0]);
      return;
    }
    const kept = selected.slice(0, MAX_BATCH_FILES);
    setBatchNote(
      selected.length > MAX_BATCH_FILES
        ? `${selected.length} files dropped. The first ${MAX_BATCH_FILES} were kept, which is the limit per batch.`
        : null
    );
    setValidationError(null);
    setError(null);
    setResult(null);
    setStatus("idle");
    setFile(null);
    setBatchPhase("ready");
    setBatchCount(kept.length);
    setBatchFiles(kept);
  };

  const handleBatchReset = () => {
    setBatchFiles(null);
    setBatchNote(null);
    setBatchPhase("ready");
  };

  const handleAnalyze = useCallback(async () => {
    if (!file) return;

    // No client-side rate limit here on purpose; /analyze has no RATE_LIMITS
    // entry and checking a folder of tracks is the whole point of this tool.
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    setStatus("processing");
    setElapsedSeconds(0);
    setResult(null);
    setError(null);

    try {
      const data = await analyzeAudioFile(file, { signal: controller.signal });
      if (cancelledRef.current) return;
      setResult(toAnalysisResult(data));
      setStatus("complete");
    } catch (err) {
      if (cancelledRef.current || isAbortError(err) || controller.signal.aborted) return;

      console.error("Analysis error:", err);
      if (err instanceof ApiError && err.isRateLimit) {
        setError({
          title: "You're going a little fast",
          hint: "Wait for the timer, then try again.",
        });
        const wait = err.retryAfterSeconds ?? getRetryAfterFallback("analyze");
        setCooldownCeiling(Math.max(1, wait));
        setCooldownSeconds(wait);
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, [file, setElapsedSeconds, setCooldownSeconds]);

  const handleCancel = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setError(null);
    setElapsedSeconds(0);
  };

  const handleReset = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setResult(null);
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setElapsedSeconds(0);
  };

  // Batch mode keeps the stage frame but Forge Crate runs the show inside it.
  if (batchFiles) {
    const led =
      batchPhase === "finished"
        ? "bg-teal-400"
        : batchPhase === "running"
          ? "bg-amber-500"
          : "bg-graphite-600";
    return (
      <div className="surface grain overflow-clip rounded-2xl border border-graphite-800">
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-graphite-800 px-4 py-2.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", led, batchPhase === "running" && "animate-pulse")}
              aria-hidden
            />
            <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
              Key &amp; BPM finder
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-text-subtle">
            {batchCount} files · {BATCH_CONCURRENCY} at a time
          </span>
        </div>
        <KeyFinderBatch
          files={batchFiles}
          note={batchNote}
          onReset={handleBatchReset}
          onStatusChange={handleBatchStatus}
        />
      </div>
    );
  }

  const stageIndex = stageIndexFor(STAGES, elapsedSeconds);

  const note =
    validationError || (isFailed && error) ? (
      <div className="space-y-4">
        {validationError && <ValidationNote message={validationError} />}
        {isFailed && error && (
          <>
            <ErrorPanel error={error} />
            <SupportBlock mood="sheepish" />
          </>
        )}
      </div>
    ) : undefined;

  const resultNode =
    isComplete && result ? (
      <div role="status" aria-live="polite">
        <AnalysisResultCard result={result} />
      </div>
    ) : undefined;

  return (
    <StudioStage
      label="Key & BPM finder"
      file={file}
      onFileSelect={handleFileSelect}
      multiple
      onFilesSelect={handleFilesSelect}
      onClear={handleReset}
      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.aif"
      formats="MP3 · WAV · FLAC · M4A · AAC · OGG"
      tiers={TIERS}
      tier="free"
      onTierChange={() => {}}
      jobTier="free"
      aside={<KeyFinderAside />}
      dropTitle="Drop a song"
      busy={isProcessing}
      failed={isFailed}
      progress={easedProgress(elapsedSeconds, 8)}
      stageLabel={STAGES[stageIndex]?.label ?? "Analyzing"}
      elapsed={formatElapsed(elapsedSeconds)}
      onCancel={handleCancel}
      actionLabel={cooldownSeconds > 0 ? `Try again in ${formatCooldown(cooldownSeconds)}` : "Find key & BPM"}
      actionIcon={<Music />}
      actionDisabled={!canAnalyze}
      onAction={handleAnalyze}
      belowAction={<CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeiling} />}
      result={resultNode}
      doneTitle={file?.name}
      doneMeta={formatElapsed(elapsedSeconds)}
      doneFooter={<SupportBlock variant="line" />}
      resetLabel="Analyze another track"
      labels={{ dropHint: `Up to ${MAX_BATCH_FILES} at once, anywhere on this panel, or`, working: "Analyzing" }}
      note={note}
    />
  );
}