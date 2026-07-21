"use client";

import { useEffect, useRef, useState } from "react";
import { Mic2, AlertTriangle, Download, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { validateAudioFile } from "@/lib/utils/validation";
import {
  submitSeparation,
  getSeparationStatus,
  getSeparationPreviewUrl,
  getSeparationDownloadUrl,
  ApiError,
} from "@/lib/api/railway";
import type { SeparationUiState, StemType } from "@/lib/types/converter";

const POLL_INTERVAL_MS = 12_000;

export function VocalRemoverForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SeparationUiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [activeStem, setActiveStem] = useState<StemType>("vocals");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount so it never fires against a stale job after navigation.
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
          setErrorMessage(result.error || "Separation failed. Please try a different file.");
          setStatus("failed");
        }
        // status === "processing" → keep polling silently
      } catch (error) {
        // A single missed poll (e.g. transient network blip) shouldn't kill the flow —
        // only stop on a 404 (job genuinely expired/gone).
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
      const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setStatus("error");
      if (error instanceof ApiError && error.isRateLimit) {
        // Backend limit is 1/hour — respect the real Retry-After if given,
        // otherwise fall back to a full hour rather than pretending it's short.
        setCooldownSeconds(error.retryAfterSeconds ?? 3600);
      }
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
        </div>
      )}

      {status === "processing" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <Waveform />
          <p className="text-sm text-text-muted">Separating vocals from instrumental…</p>
          <p className="text-xs text-text-subtle">
            This runs on CPU and usually takes 1–5 minutes. You can leave this tab open —
            it&apos;ll update automatically.
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

          {/* key= forces the <audio> element to remount and load the new src when the tab changes */}
          <audio
            key={activeStem}
            controls
            className="w-full"
            src={getSeparationPreviewUrl(jobId, activeStem)}
          >
            Your browser doesn&apos;t support inline audio playback.
          </audio>

          <a
            href={getSeparationDownloadUrl(jobId, activeStem)}
            download
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download {activeStem}
          </a>

          <a
            href="https://ko-fi.com/audioforges"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-graphite-700 px-4 py-2.5 text-sm text-text-muted hover:text-amber-400 hover:border-amber-500/40 transition-colors"
          >
            <Heart className="h-3.5 w-3.5" />
            Enjoying this? Support the servers on Ko-fi
          </a>

          <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
            Separate another track
          </Button>
        </div>
      )}

      {(status === "failed" || status === "error") && errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">{errorMessage}</span>
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
            : status === "failed" || status === "error"
            ? "Try again"
            : "Remove vocals"}
        </Button>
      )}

      {status !== "complete" && (
        <p className="text-xs text-text-subtle text-center">
          Limited to 1 separation per hour per person — this process is CPU-intensive
          to run for free.
        </p>
      )}
    </div>
  );
}
