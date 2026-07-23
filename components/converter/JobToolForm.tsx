"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, AlertTriangle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { validateAudioFile } from "@/lib/utils/validation";
import {
  submitJob,
  getJobStatus,
  getJobPreviewUrl,
  getJobDownloadUrl,
  ApiError,
} from "@/lib/api/railway";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface JobToolFormProps {
  /** Backend route segment, e.g. "convert", "trim", "volume" */
  endpoint: string;
  /** Accept string for the file input, e.g. "audio/*,.mp3,.wav" */
  fileAccept?: string;
  /** How often to poll status, ms. Convert/trim/etc are fast (~2.5s); separation is slow (12s). */
  pollIntervalMs?: number;
  /** Button label when idle, e.g. "Convert" */
  submitLabel: string;
  /** Label while processing, e.g. "Converting…" */
  processingLabel: string;
  /** e.g. "usually a few seconds" */
  expectedRange?: string;
  /** e.g. "Converted" -> "Converted — filename.wav" */
  resultVerb: string;
  /**
   * Optional extra controls rendered above the submit button (e.g. a target-format
   * select for /convert, a start/end input for /trim). Receives current file + disabled state.
   */
  renderControls?: (file: File | null, disabled: boolean) => ReactNode;
  /**
   * Builds the extra (non-file) form fields to send with the job. Return null to block
   * submission (e.g. required control not filled in yet) — an error message will show instead.
   */
  buildExtraFields?: (file: File) => Record<string, string> | null;
  /** Message shown if buildExtraFields returns null */
  missingFieldsMessage?: string;
  /** Suggested download filename extension override, e.g. "wav" — falls back to backend's header if omitted */
  downloadFilename?: string;
}

export function JobToolForm({
  endpoint,
  fileAccept = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff",
  pollIntervalMs = 2500,
  submitLabel,
  processingLabel,
  expectedRange,
  resultVerb,
  renderControls,
  buildExtraFields,
  missingFieldsMessage = "Please fill in the required options above.",
  downloadFilename,
}: JobToolFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (status !== "uploading" && status !== "processing") return;
    if (status === "uploading") setElapsedSeconds(0);
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await getJobStatus(endpoint, id);
        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setStatus("complete");
        } else if (result.status === "failed") {
          stopPolling();
          setErrorMessage(result.error || "Processing failed. Please try a different file.");
          setStatus("failed");
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          stopPolling();
          setErrorMessage("This job expired. Please upload your file again.");
          setStatus("failed");
        }
      }
    }, pollIntervalMs);
  };

  const handleFileSelect = (selectedFile: File) => {
    setValidationError(null);
    const validation = validateAudioFile(selectedFile);
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid file");
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
    setErrorMessage(null);
    setJobId(null);
    setResultTitle(null);
  };

  const handleReset = () => {
    stopPolling();
    setFile(null);
    setStatus("idle");
    setValidationError(null);
    setErrorMessage(null);
    setJobId(null);
    setResultTitle(null);
  };

  const handleSubmit = async () => {
    if (!file) return;

    const extraFields = buildExtraFields ? buildExtraFields(file) : {};
    if (buildExtraFields && extraFields === null) {
      setErrorMessage(missingFieldsMessage);
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);
    cancelledRef.current = false;

    try {
      const formData = new FormData();
      formData.append("file", file);
      for (const [key, value] of Object.entries(extraFields || {})) {
        formData.append(key, value);
      }

      const { job_id } = await submitJob(endpoint, formData);
      if (cancelledRef.current) return;
      setJobId(job_id);
      setStatus("processing");
      startPolling(job_id);
    } catch (error) {
      if (cancelledRef.current) return;
      console.error(`${endpoint} submit error:`, error);
      let userMessage = "Something went wrong. Please try again.";
      if (error instanceof ApiError) {
        if (error.isRateLimit) {
          userMessage = "You're going a little fast — please wait a moment before trying again.";
          setCooldownSeconds(error.retryAfterSeconds ?? 60);
        } else {
          userMessage = error.message;
        }
      }
      setErrorMessage(userMessage);
      setStatus("error");
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stopPolling();
    setStatus("idle");
    setErrorMessage(null);
    setJobId(null);
    setResultTitle(null);
  };

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const canSubmit = file && !isBusy && status !== "complete";

  const formatCooldown = (seconds: number) => {
    if (seconds >= 3600) return `${Math.ceil(seconds / 3600)}h`;
    if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
    return `${seconds}s`;
  };

  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8 space-y-6">
      {status !== "complete" && (
        <FileDropZone
          onFileSelect={handleFileSelect}
          currentFile={file}
          onClear={handleReset}
          disabled={isBusy}
          accept={fileAccept}
        />
      )}

      {validationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">{validationError}</span>
        </div>
      )}

      {status !== "complete" && renderControls && (
        <div>{renderControls(file, isBusy)}</div>
      )}

      {(status === "uploading" || status === "processing") && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Waveform />
          <p className="text-sm text-text-muted">
            {status === "uploading" ? "Uploading your file…" : processingLabel}
          </p>
          <div className="w-full max-w-xs h-1.5 rounded-full bg-graphite-800 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-amber-500 animate-indeterminate" />
          </div>
          <p className="text-xs font-mono text-text-subtle tabular-nums">
            {formatElapsed(elapsedSeconds)} elapsed
            {expectedRange ? ` — ${expectedRange}` : ""}
          </p>
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs text-text-subtle hover:text-red-500 underline transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {status === "complete" && jobId && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-teal-400">
            <span className="font-medium">
              {resultVerb}
              {resultTitle ? ` — ${resultTitle}` : ""}
            </span>
          </div>

          <AudioPlayer src={getJobPreviewUrl(endpoint, jobId)} />

          {/* ✅ FIXED: Added missing <a> tag */}
          <a
            href={getJobDownloadUrl(endpoint, jobId)}
            download={downloadFilename || true}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </a>

          <SupportBlock />

          <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
            Process another file
          </Button>
        </div>
      )}

      {isFailed && errorMessage && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="text-sm text-text-primary">{errorMessage}</span>
          </div>
          <SupportBlock />
        </div>
      )}

      {status !== "complete" && (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || cooldownSeconds > 0}
        >
          <Wand2 className="h-5 w-5" />
          {cooldownSeconds > 0
            ? `Try again in ${formatCooldown(cooldownSeconds)}`
            : isFailed
            ? "Try again"
            : submitLabel}
        </Button>
      )}
    </div>
  );
}