"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import {
  Upload,
  X,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Download,
  Layers,
  RotateCcw,
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  Section,
  ValidationNote,
  WorkingPanel,
  ResultHeader,
  easedProgress,
  formatCooldown,
  formatElapsed,
  serverFailure,
  stageIndexFor,
  terminalPollError,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
  type ProcessingStage,
  type UiState,
} from "@/components/tools/JobFormKit";
import { ControlField, Hint, OptionCards, type CardOption } from "@/components/converter/ToolControls";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRateLimitLabel, getRetryAfterFallback } from "@/lib/data/rate-limits";
import { getToolLimits } from "@/lib/data/tool-limits";
import {
  submitJob,
  getJobStatus,
  getJobPreviewUrl,
  getJobDownloadUrl,
  ApiError,
} from "@/lib/api/railway";

/**
 * ── THIS PASS: IT USES THE SHELL NOW ───────────────────────────────────
 *
 * This form was a second implementation of everything JobFormKit owns. Not by
 * choice — JobToolForm assumes exactly one file via FileDropZone, and this
 * takes ten with reordering, so it can't adopt the FORM. But the kit exists
 * precisely so the presentation can be adopted without it.
 *
 * What that fixes, beyond looking like the rest of the site:
 *
 *  · NO STEP RAIL. Every other tool shows its three stages across the top.
 *    This one gave no sense of where you were.
 *  · ITS OWN POLL LOOP, which never got the fix the kit's did: a 401 or 403
 *    was treated as a slow job and retried every 2.5s until the ten-minute
 *    ceiling, instead of being read as an answer. `terminalPollError` does it.
 *  · ITS OWN ELAPSED AND COOLDOWN TIMERS, its own progress curve, its own
 *    working panel — same three things, different easing, different radius, no
 *    stage checklist, no cooldown bar.
 *  · SECTION RHYTHM. `space-y-6` in one padded box left the format picker
 *    floating; the kit's `divide-y` hairlines are what make Source / Settings
 *    / Result read as distinct zones everywhere else.
 *  · THE PRIMARY ACTION MOVED between states — it was the last item in
 *    whichever stack rendered. The shell's footer pins it to the bottom edge.
 *
 * KEPT FROM THE LAST PASS: the total-duration gate, stable row ids, the real
 * cooldown fallback, limits read from TOOL_LIMITS.
 *
 * ALSO: the drop-zone hint read "150.0 MB". formatBytes puts a decimal on
 * anything over 1MB, which is right for a file's size and wrong for a rule.
 */

/** Read, not restated — see TOOL_LIMITS.join, which carries all three. */
const JOIN_LIMITS = getToolLimits("join");
const MAX_FILES = JOIN_LIMITS?.maxFiles ?? 10;
const MAX_TOTAL_BYTES = JOIN_LIMITS?.maxTotalBytes ?? 150 * 1024 * 1024;
const MAX_TOTAL_DURATION_SECONDS = JOIN_LIMITS?.maxTotalDurationSeconds ?? 5400;
const MAX_POLL_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 2500;

const RATE_LIMIT_LABEL = getRateLimitLabel("join");

const STEPS = ["Files", "Join", "Result"] as const;

const STAGES: ProcessingStage[] = [
  { at: 0, label: "Reading each file" },
  { at: 3, label: "Matching sample rates" },
  { at: 8, label: "Joining into one track" },
];

interface FormatSpec {
  quality: "Lossless" | "Compressed";
  detail: string;
}

// Same copy as ConvertForm's format specs. Worth centralizing into a
// shared constant if a third tool ends up needing this list too.
const FORMAT_SPECS: Record<string, FormatSpec> = {
  wav: { quality: "Lossless", detail: "Uncompressed" },
  aiff: { quality: "Lossless", detail: "Uncompressed" },
  flac: { quality: "Lossless", detail: "~50% smaller, no loss" },
  mp3: { quality: "Compressed", detail: "320 kbps" },
  m4a: { quality: "Compressed", detail: "AAC container" },
  aac: { quality: "Compressed", detail: "Smaller than MP3" },
  ogg: { quality: "Compressed", detail: "Open format" },
};

const FORMAT_OPTIONS: CardOption<string>[] = Object.entries(FORMAT_SPECS).map(([fmt, spec]) => ({
  value: fmt,
  title: fmt,
  detail: spec.detail,
}));

/** A file plus the identity the list is keyed on. The id is assigned once, on
 *  add, so reordering moves rows rather than remounting them. */
interface Entry {
  id: string;
  file: File;
  duration: number | null;
}

let entrySeq = 0;
function makeEntry(file: File): Entry {
  entrySeq += 1;
  return { id: `f${entrySeq}`, file, duration: null };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** A file's own size, where a decimal is informative. */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A LIMIT, where it isn't: "150.0 MB" reads as a measurement of something
 *  rather than a rule. */
function formatByteLimit(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** "1h 30m" — the total-duration cap is stated in these units, so the running
 *  total has to be too. */
function formatLongDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toUpperCase() : "FILE";
}

function humanizeError(raw: string): FormError {
  const text = raw.toLowerCase();
  if (text.includes("format") || text.includes("codec")) {
    return {
      title: "One of these files isn't supported",
      hint: "Remove it and try joining the rest.",
    };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Add your files again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return { title: raw, hint: "Run it again. If it keeps failing, try removing one file at a time." };
}

/* ------------------------------------------------------------------ */
/* File row — probes its own duration, handles drag reorder            */
/* ------------------------------------------------------------------ */

interface FileRowProps {
  entry: Entry;
  index: number;
  total: number;
  disabled: boolean;
  isDragOver: boolean;
  onDuration: (id: string, seconds: number) => void;
  onDragStart: (index: number) => void;
  onDragEnter: (index: number) => void;
  onDragEnd: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}

function FileRow({
  entry,
  index,
  total,
  disabled,
  isDragOver,
  onDuration,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onMove,
  onRemove,
}: FileRowProps) {
  const { file, duration } = entry;
  const onDurationRef = useRef(onDuration);
  useEffect(() => {
    onDurationRef.current = onDuration;
  });

  useEffect(() => {
    // Already known — a reorder no longer remounts this row, and a re-render
    // shouldn't re-probe either.
    if (duration !== null) return;

    let released = false;
    const objectUrl = URL.createObjectURL(file);
    const probe = new Audio();
    const release = () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        onDurationRef.current(entry.id, probe.duration);
      }
      release();
    };
    probe.onerror = release;
    probe.src = objectUrl;
    return () => {
      probe.onloadedmetadata = null;
      probe.onerror = null;
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id, file, duration === null]);

  return (
    <div
      draggable={!disabled}
      onDragStart={(e: ReactDragEvent<HTMLDivElement>) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragEnter={() => onDragEnter(index)}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2.5 transition-colors",
        isDragOver && "bg-amber-500/[0.06]"
      )}
    >
      <GripVertical
        className={cn(
          "h-4 w-4 shrink-0",
          disabled ? "text-text-subtle/40" : "cursor-grab text-text-subtle"
        )}
        aria-hidden
      />
      <span className="w-5 shrink-0 text-center font-mono text-xs text-text-subtle">
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text-primary">{file.name}</p>
        <p className="font-mono text-[11px] text-text-subtle">
          {fileExtension(file.name)} · {formatBytes(file.size)}
          {duration !== null ? ` · ${formatElapsed(Math.round(duration))}` : ""}
        </p>
      </div>

      {/* Compound control: three icon targets sharing a row, sized to the
          row rather than to a standalone button. Not <Button> material -
          see the matching note on the steppers in TrimForm. */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={disabled || index === 0}
          aria-label={`Move ${file.name} up`}
          className="rounded p-1 text-text-muted transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={disabled || index === total - 1}
          aria-label={`Move ${file.name} down`}
          className="rounded p-1 text-text-muted transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
          className="rounded p-1 text-text-muted transition-colors hover:bg-graphite-800 hover:text-red-400 disabled:pointer-events-none disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main form                                                            */
/* ------------------------------------------------------------------ */

export function JoinForm() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [format, setFormat] = useState("mp3");
  const [status, setStatus] = useState<UiState>("idle");
  const [addError, setAddError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [isDragOverZone, setIsDragOverZone] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isBusy = status === "uploading" || status === "processing";
  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isBusy);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  const cooldownCeilingRef = useRef(1);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // dragleave fires when the pointer crosses a child element, which made
  // the zone highlight flicker on and off while dragging over it.
  // Counting enters and leaves is the same fix FileDropZone uses.
  const dragDepth = useRef(0);

  const files = entries.map((e) => e.file);
  const totalBytes = entries.reduce((sum, e) => sum + e.file.size, 0);
  /** Null until every row has reported — a partial sum would flash a warning
   *  that disappears once the last probe lands. */
  const knownDurations = entries.filter((e) => e.duration !== null);
  const totalDuration =
    knownDurations.length === entries.length && entries.length > 0
      ? knownDurations.reduce((sum, e) => sum + (e.duration ?? 0), 0)
      : null;
  const overDuration = totalDuration !== null && totalDuration > MAX_TOTAL_DURATION_SECONDS;

  const isFailed = status === "failed" || status === "error";
  const isComplete = status === "complete";
  const canSubmit = entries.length >= 2 && !isBusy && cooldownSeconds === 0 && !overDuration;

  const step: 1 | 2 | 3 = isComplete ? 3 : isBusy ? 2 : 1;

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const recordDuration = useCallback((id: string, seconds: number) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, duration: seconds } : entry))
    );
  }, []);

  /* --- polling: recursive timeout, capped duration ------------------ */
  const poll = useCallback(
    (id: string) => {
      if (cancelledRef.current) return;

      if (Date.now() - pollStartedAtRef.current > MAX_POLL_MS) {
        stopPolling();
        setError({
          title: "This is taking unusually long",
          hint: "The job may be stuck. Add your files again to start a fresh run.",
        });
        setStatus("failed");
        return;
      }

      getJobStatus("join", id)
        .then((result) => {
          if (cancelledRef.current) return;
          if (result.status === "complete") {
            stopPolling();
            setResultTitle(result.title ?? null);
            setStatus("complete");
            return;
          }
          if (result.status === "failed") {
            stopPolling();
            // Verbatim: routes/_shared.py writes these for the user.
            setError(
              serverFailure(result.error, {
                title: "Joining failed",
                hint: "Run it again. If it keeps failing, try removing one file at a time.",
              })
            );
            setStatus("failed");
            return;
          }
          pollRef.current = setTimeout(() => poll(id), POLL_INTERVAL_MS);
        })
        .catch((err) => {
          if (cancelledRef.current) return;
          /* A 401/403/404 is an ANSWER, not a blip. The old loop only
             short-circuited on 404, so a rejected poll was retried every 2.5s
             until the ten-minute ceiling — the exact bug the kit's helper was
             written for. */
          const terminal = terminalPollError(err);
          if (terminal) {
            stopPolling();
            setError(terminal);
            setStatus("failed");
            return;
          }
          pollRef.current = setTimeout(() => poll(id), POLL_INTERVAL_MS);
        });
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      poll(id);
    },
    [poll, stopPolling]
  );

  /* --- adding files --------------------------------------------------
   * A validation failure on one file used to abort the whole batch via
   * `break`, silently discarding every valid file after it in the same
   * drop. Invalid files are skipped individually (`continue`) and only
   * the count/size caps — which really do apply to everything after
   * them — stop the loop early.
   */
  const addFiles = (incoming: FileList | File[]) => {
    setAddError(null);
    const incomingArray = Array.from(incoming);
    const accepted: Entry[] = [];
    let runningTotal = totalBytes;
    let runningCount = entries.length;
    let lastError: string | null = null;

    for (const file of incomingArray) {
      const validation = validateAudioFile(file);
      if (!validation.isValid) {
        lastError = `'${file.name}': ${validation.error || "invalid file"}`;
        continue;
      }
      if (runningCount + 1 > MAX_FILES) {
        lastError = `You can join up to ${MAX_FILES} files at a time.`;
        break;
      }
      if (runningTotal + file.size > MAX_TOTAL_BYTES) {
        lastError = `Adding '${file.name}' would exceed the ${formatByteLimit(
          MAX_TOTAL_BYTES
        )} combined limit.`;
        break;
      }
      accepted.push(makeEntry(file));
      runningTotal += file.size;
      runningCount += 1;
    }

    if (accepted.length > 0) setEntries((prev) => [...prev, ...accepted]);
    if (lastError) setAddError(lastError);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
    e.target.value = "";
  };

  const handleZoneDrop = (e: ReactDragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragOverZone(false);
    if (isBusy) return;
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
    setAddError(null);
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    setEntries((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  /* --- row drag reorder ---------------------------------------------- */
  const handleRowDrop = () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setEntries((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dragOverIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  useEffect(() => {
    if (dragIndex === null) return;
    window.addEventListener("drop", handleRowDrop);
    window.addEventListener("dragend", handleRowDrop);
    return () => {
      window.removeEventListener("drop", handleRowDrop);
      window.removeEventListener("dragend", handleRowDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragIndex, dragOverIndex]);

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    setEntries([]);
    setStatus("idle");
    setAddError(null);
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setElapsedSeconds(0);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stopPolling();
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setElapsedSeconds(0);
  };

  const handleSubmit = async () => {
    if (entries.length < 2) return;

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    cancelledRef.current = false;

    const formData = new FormData();
    // Order matters: output order matches append order, which is
    // exactly the order shown on screen after any reordering.
    for (const file of files) formData.append("files", file);
    formData.append("target_format", format);

    try {
      const { job_id } = await submitJob("join", formData, 60_000);
      if (cancelledRef.current) return;
      setJobId(job_id);
      setStatus("processing");
      startPolling(job_id);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("join submit error:", err);
      if (err instanceof ApiError && err.isRateLimit) {
        setError({
          title: RATE_LIMIT_LABEL
            ? `You've hit the joining limit (${RATE_LIMIT_LABEL})`
            : "You've reached the joining limit for now",
          hint: "Wait for the timer, then try again.",
        });
        // Was a flat 60. /join is 5 per 5 minutes, so the button used to
        // re-enable four minutes early and walk straight into another 429.
        const seconds = err.retryAfterSeconds ?? getRetryAfterFallback("join");
        cooldownCeilingRef.current = Math.max(1, seconds);
        setCooldownSeconds(seconds);
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    }
  };

  const stageIndex = stageIndexFor(STAGES, elapsedSeconds);
  const stageLabel =
    status === "uploading"
      ? `Uploading ${entries.length} files`
      : (STAGES[stageIndex]?.label ?? "Joining into one track");

  const capacityPercent = Math.min(100, Math.round((totalBytes / MAX_TOTAL_BYTES) * 100));

  const footer = isComplete ? null : (
    <div className="space-y-2">
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={handleSubmit}
        disabled={!canSubmit && !isBusy}
        loading={isBusy}
        loadingLabel="Joining"
      >
        {!isBusy && <Layers />}
        {isBusy
          ? "Working"
          : cooldownSeconds > 0
            ? `Try again in ${formatCooldown(cooldownSeconds)}`
            : isFailed
              ? "Try again"
              : "Join files"}
      </Button>

      <CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeilingRef.current} />

      {entries.length === 1 && !isBusy && <ValidationNote message="Add one more file to join." />}
    </div>
  );

  return (
    <FormShell
      toolLabel="Audio joiner"
      toolMeta={`${entries.length}/${MAX_FILES} files · ${formatBytes(totalBytes)}${
        totalDuration !== null ? ` · ${formatLongDuration(totalDuration)}` : ""
      }`}
      steps={STEPS}
      step={step}
      busy={isBusy}
      failed={isFailed}
      complete={isComplete}
      footer={footer}
    >
      {!isComplete && (
        <Section>
          <div className="space-y-4">
            {/* Matches FileDropZone: solid border at rest, dashed and
                amber only while a file is over it. A permanently dashed
                box reads as a placeholder - "nothing here yet" - which is
                exactly the wrong message for the primary action. */}
            <button
              type="button"
              disabled={isBusy}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                if (isBusy) return;
                dragDepth.current += 1;
                setIsDragOverZone(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) setIsDragOverZone(false);
              }}
              onDrop={handleZoneDrop}
              className={cn(
                "group flex w-full flex-col items-center justify-center gap-2.5 rounded-xl border px-4 py-6 text-center",
                "transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                "disabled:cursor-not-allowed disabled:opacity-40",
                isDragOverZone
                  ? "border-dashed border-amber-500/60 bg-amber-500/[0.06]"
                  : "border-graphite-800 bg-graphite-850/40 hover:border-graphite-700 hover:bg-graphite-850/70"
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                  isDragOverZone
                    ? "border-amber-500/40 bg-amber-500/10"
                    : "border-graphite-700 bg-graphite-800 group-hover:border-amber-500/30"
                )}
              >
                <Upload
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isDragOverZone ? "text-amber-400" : "text-text-subtle group-hover:text-amber-500"
                  )}
                  aria-hidden
                />
              </span>

              <span>
                <span className="block text-sm text-text-primary">
                  {isDragOverZone ? (
                    <span className="text-amber-400">Release to add</span>
                  ) : (
                    <>
                      Drop audio files, or{" "}
                      <span className="text-amber-400 underline underline-offset-2">browse</span>
                    </>
                  )}
                </span>
                {/* "150 MB", not "150.0 MB": a decimal belongs on a
                    measurement, not on a rule. */}
                <span className="mt-1 block font-mono text-[11px] text-text-subtle">
                  MP3, WAV, FLAC, M4A and more · up to {MAX_FILES} files,{" "}
                  {formatByteLimit(MAX_TOTAL_BYTES)},{" "}
                  {formatLongDuration(MAX_TOTAL_DURATION_SECONDS)}
                </span>
              </span>

              <input
                ref={inputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff"
                onChange={handleFileInput}
                disabled={isBusy}
                className="hidden"
              />
            </button>

            {addError && <Hint tone="bad">{addError}</Hint>}

            {/* The third limit, and the only one that used to be invisible.
                Ten twenty-minute files pass both the count and the byte cap,
                upload in full, and are refused on the far side. */}
            {overDuration && totalDuration !== null && (
              <Hint tone="bad" title="Too long to join">
                These files total {formatLongDuration(totalDuration)}, over the{" "}
                {formatLongDuration(MAX_TOTAL_DURATION_SECONDS)} combined limit. Remove one and try
                again — nothing has been uploaded.
              </Hint>
            )}

            {entries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>Drag rows or use the arrows to set the output order</span>
                  <span className="font-mono text-text-subtle">{formatBytes(totalBytes)}</span>
                </div>

                <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      capacityPercent > 90 ? "bg-red-400" : "bg-amber-500"
                    )}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>

                <div className="max-h-72 divide-y divide-graphite-800 overflow-y-auto rounded-xl border border-graphite-700">
                  {entries.map((entry, index) => (
                    <FileRow
                      /* Stable id, not the array index: an index key made a
                         reorder remount every row after the moved one, and
                         each remount re-probed its duration. */
                      key={entry.id}
                      entry={entry}
                      index={index}
                      total={entries.length}
                      disabled={isBusy}
                      isDragOver={dragOverIndex === index}
                      onDuration={recordDuration}
                      onDragStart={setDragIndex}
                      onDragEnter={setDragOverIndex}
                      onDragEnd={handleRowDrop}
                      onMove={moveFile}
                      onRemove={removeFile}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {!isComplete && entries.length > 0 && (
        <Section>
          <ControlField as="fieldset" label="Output format">
            <OptionCards
              label="Output format"
              options={FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
              columns={4}
              disabled={isBusy}
              mono
            />
          </ControlField>
        </Section>
      )}

      {isBusy && (
        <Section>
          <WorkingPanel
            stageLabel={stageLabel}
            stages={STAGES}
            stageIndex={stageIndex}
            showStageList={status === "processing"}
            elapsedSeconds={elapsedSeconds}
            progress={easedProgress(elapsedSeconds, 10)}
            expectedRange="usually well under a minute"
            chargedRun={false}
            onCancel={handleCancel}
            waveform={<Waveform />}
          />
        </Section>
      )}

      {isComplete && jobId && (
        <Section>
          <div className="space-y-4">
            <ResultHeader
              verb="Joined"
              title={resultTitle || `${entries.length} files combined`}
              meta={`Finished in ${formatElapsed(elapsedSeconds)}`}
            />

            <AudioPlayer src={getJobPreviewUrl("join", jobId)} />

            {/* Stays an <a> - a real download URL, so middle-click and
                open-in-new-tab keep working. Borrows the Button styles
                rather than repeating them. */}
            <a
              href={getJobDownloadUrl("join", jobId)}
              download
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              <Download />
              Download
            </a>

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw />
              Join more files
            </Button>
          </div>
        </Section>
      )}

      {isFailed && error && (
        <Section>
          <div className="space-y-4">
            <ErrorPanel error={error} />
            <SupportBlock />
          </div>
        </Section>
      )}
    </FormShell>
  );
}