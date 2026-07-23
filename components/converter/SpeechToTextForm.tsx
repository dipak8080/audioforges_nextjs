"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, AlertTriangle, Copy, Check, FileText, Captions } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { validateAudioFile } from "@/lib/utils/validation";
import {
  submitJob,
  getJobStatus,
  getTranscriptResult,
  ApiError,
  type TranscriptResult,
} from "@/lib/api/railway";

type UiState = "idle" | "uploading" | "processing" | "complete" | "failed" | "error";

const POLL_INTERVAL_MS = 4000; // slower interval per backend guidance — this is the slowest tool

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function buildSrt(transcript: TranscriptResult): string {
  return transcript.segments
    .map((seg, i) => `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text.trim()}\n`)
    .join("\n");
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SpeechToTextForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptResult | null>(null);
  const [copied, setCopied] = useState(false);
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

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const result = await getJobStatus("speech-to-text", jobId);
        if (result.status === "complete") {
          stopPolling();
          try {
            const fullTranscript = await getTranscriptResult(jobId);
            setTranscript(fullTranscript);
            setStatus("complete");
          } catch {
            setErrorMessage("Transcript finished but couldn't be retrieved. Please try again.");
            setStatus("error");
          }
        } else if (result.status === "failed") {
          stopPolling();
          setErrorMessage(result.error || "We couldn't detect any speech in this file.");
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
    setTranscript(null);
    setCopied(false);
  };

  const handleReset = () => {
    stopPolling();
    setFile(null);
    setStatus("idle");
    setValidationError(null);
    setErrorMessage(null);
    setTranscript(null);
    setCopied(false);
  };

  const handleSubmit = async () => {
    if (!file) return;

    setStatus("uploading");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { job_id } = await submitJob("speech-to-text", formData, 30_000);
      setStatus("processing");
      startPolling(job_id);
    } catch (error) {
      console.error("Transcription submit error:", error);
      let userMessage = "Something went wrong. Please try again.";
      if (error instanceof ApiError) {
        if (error.isRateLimit) {
          userMessage = "You've reached the limit (2 transcriptions per 5 minutes). Please wait.";
          setCooldownSeconds(error.retryAfterSeconds ?? 300);
        } else {
          userMessage = error.message;
        }
      }
      setErrorMessage(userMessage);
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const canSubmit = file && !isBusy && status !== "complete";

  const formatCooldown = (seconds: number) => {
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
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff"
        />
      )}

      {validationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">{validationError}</span>
        </div>
      )}

      {(status === "uploading" || status === "processing") && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Waveform />
          <p className="text-sm text-text-muted">
            {status === "uploading" ? "Uploading your file…" : "Transcribing…"}
          </p>
          <div className="w-full max-w-xs h-1.5 rounded-full bg-graphite-800 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-amber-500 animate-indeterminate" />
          </div>
          <p className="text-xs font-mono text-text-subtle tabular-nums">
            {formatElapsed(elapsedSeconds)} elapsed
          </p>
          {status === "processing" && (
            <p className="text-xs text-text-subtle text-center max-w-xs">
              This can take a few minutes for longer files — transcription runs on
              CPU, one file at a time.
            </p>
          )}
        </div>
      )}

      {status === "complete" && transcript && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-teal-400 font-medium">Transcript ready</span>
            <span className="text-text-subtle font-mono text-xs">
              {transcript.language.toUpperCase()} · {Math.round(transcript.language_probability * 100)}% confidence
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-graphite-700 bg-graphite-850 p-4">
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {transcript.text}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="md" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => downloadTextFile("transcript.txt", transcript.text, "text/plain")}
            >
              <FileText className="h-4 w-4" />
              .txt
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => downloadTextFile("transcript.srt", buildSrt(transcript), "text/plain")}
            >
              <Captions className="h-4 w-4" />
              .srt
            </Button>
          </div>

          <SupportBlock />

          <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
            Transcribe another file
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
          <Mic className="h-5 w-5" />
          {cooldownSeconds > 0
            ? `Try again in ${formatCooldown(cooldownSeconds)}`
            : isFailed
            ? "Try again"
            : "Transcribe"}
        </Button>
      )}

      {status !== "complete" && (
        <p className="text-xs text-text-subtle text-center">
          Limited to 2 transcriptions per 5 minutes — only one runs at a time.
        </p>
      )}
    </div>
  );
}