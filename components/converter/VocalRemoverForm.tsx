"use client";

import { useEffect, useRef, useState } from "react";
import { Mic2, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { validateAudioFile } from "@/lib/utils/validation";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitSeparation,
  getSeparationStatus,
  getSeparationPreviewUrl,
  getSeparationDownloadUrl,
  ApiError,
} from "@/lib/api/railway";
import type { SeparationUiState, StemType } from "@/lib/types/converter";
import { SupportBlock } from "@/components/ui/SupportBlock";

const POLL_INTERVAL_MS = 12_000;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VocalRemoverForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SeparationUiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [activeStem, setActiveStem] = useState<StemType>("vocals");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Elapsed timer covers both "uploading" and "processing" so the count
  // reflects total wait time from submit, not just the processing phase.
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
        const result = await getSeparationStatus(id);
        if (result.status === "complete") {
          stopPolling();
          setResultTitle(result.title);
          setStatus("complete");
        } else if (result.status === "failed") {
          stopPolling();
          setErrorMessage(result.error || "Separation failed.");
          setStatus("failed");
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          stopPolling();
          setErrorMessage("This job expired. Please upload your file again.");
          setStatus("failed");
        }
      }
    }, POLL_INTERVAL_MS);
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

  const handleSubmit = async () => {
    if (!file) return;

    setStatus("uploading");
    setErrorMessage(null);

    try {
      const { job_id } = await submitSeparation(file);
      setJobId(job_id);
      setStatus("processing");
      startPolling(job_id);
    } catch (error) {
      console.error("Separation submit error:", error);

      let userMessage = "Something went wrong. Please try again.";

      if (error instanceof ApiError) {
        if (error.isRateLimit) {
          userMessage = "You've reached the free limit (1 separation per hour). Please try again later.";
          setCooldownSeconds(error.retryAfterSeconds ?? 3600);
        } else {
          userMessage = error.message;
        }
      }

      setErrorMessage(userMessage);
      setStatus("error");
    }
  };

  const handleReset = () => {
    stopPolling();
    setFile(null);
    setStatus("idle");
    setValidationError(null);
    setErrorMessage(null);
    setJobId(null);
    setResultTitle(null);
    setActiveStem("vocals");
  };

  const isBusy = status === "uploading" || status === "processing";
  const canSubmit = file && status !== "uploading" && status !== "processing" && status !== "complete";
  const isFailed = status === "failed" || status === "error";

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
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        />
      )}

      {validationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">{validationError}</span>
        </div>
      )}

      {status === "uploading" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Waveform />
          <p className="text-sm text-text-muted">Uploading your file…</p>
          <div className="w-full max-w-xs h-1.5 rounded-full bg-graphite-800 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-amber-500 animate-indeterminate" />
          </div>
          <p className="text-xs font-mono text-text-subtle tabular-nums">
            {formatElapsed(elapsedSeconds)} elapsed
          </p>
        </div>
      )}

      {status === "processing" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Waveform />
          <p className="text-sm text-text-muted">Separating vocals from instrumental…</p>
          <div className="w-full max-w-xs h-1.5 rounded-full bg-graphite-800 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-amber-500 animate-indeterminate" />
          </div>
          <p className="text-xs font-mono text-text-subtle tabular-nums">
            {formatElapsed(elapsedSeconds)} elapsed — usually 1–5 minutes
          </p>
        </div>
      )}

      {status === "complete" && jobId && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-teal-400">
            <span className="font-medium">
              Done{resultTitle ? ` — ${resultTitle}` : ""}
            </span>
          </div>

          <div className="flex gap-2">
            {(["vocals", "instrumental"] as StemType[]).map((stem) => (
              <button
                key={stem}
                type="button"
                onClick={() => setActiveStem(stem)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  activeStem === stem
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                    : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                }`}
              >
                {stem}
              </button>
            ))}
          </div>

          <AudioPlayer key={activeStem} src={getSeparationPreviewUrl(jobId, activeStem)} />

          <a
            href={getSeparationDownloadUrl(jobId, activeStem)}
            download
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download {activeStem}
          </a>

          <SupportBlock />

          <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
            Separate another track
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
          <Mic2 className="h-5 w-5" />
          {cooldownSeconds > 0
            ? `Try again in ${formatCooldown(cooldownSeconds)}`
            : isFailed
            ? "Try again"
            : "Remove vocals"}
        </Button>
      )}

      {status !== "complete" && (
        <p className="text-xs text-text-subtle text-center">
          Limited to 2 separation per hour per person.
        </p>
      )}
    </div>
  );
}
