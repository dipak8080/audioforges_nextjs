"use client";

import { useCallback, useEffect, useState } from "react";
import { Music, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { AnalysisResultCard } from "@/components/converter/AnalysisResultCard";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile, checkRateLimit } from "@/lib/utils/validation";
import { analyzeAudioFile, ApiError } from "@/lib/api/railway";
import type { AnalysisResult, ProcessingState } from "@/lib/types/converter";

const STAGES = [
  { at: 0, label: "Reading the audio" },
  { at: 6, label: "Reading the tempo grid" },
  { at: 16, label: "Estimating the key" },
  { at: 28, label: "Cross-checking both detectors" },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function stageLabelFor(elapsed: number): string {
  let label = STAGES[0].label;
  for (const stage of STAGES) if (elapsed >= stage.at) label = stage.label;
  return label;
}

function humanizeError(raw: string): { title: string; hint: string } {
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

export function KeyFinderForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const isProcessing = status === "processing";
  const canAnalyze = Boolean(file) && !isProcessing && status !== "complete" && cooldownSeconds === 0;

  useEffect(() => {
    if (!isProcessing) return;
    setElapsedSeconds(0);
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isProcessing]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

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

  const handleAnalyze = useCallback(async () => {
    if (!file) return;

    const rateLimit = checkRateLimit("keyfinder", 10, 60000);
    if (!rateLimit.allowed) {
      setError({
        title: "You've hit this tool's limit",
        hint: rateLimit.message || "Wait a moment before trying again.",
      });
      setStatus("error");
      return;
    }

    setStatus("processing");
    setResult(null);
    setError(null);

    try {
      const data = await analyzeAudioFile(file);

      const toPct = (n: number) => Math.round(n > 1 ? n : n * 100);

      setResult({
        key: (data.key as string) || "Unknown",
        camelot: (data.camelot as string) || "N/A",
        bpm: Math.round(Number(data.bpm) || 0),
        confidence: toPct(Number(data.confidence) || 0),
        bpmConfidence: toPct(Number(data.bpm_confidence) || 0),
        keyAgrees: typeof data.cross_check?.key_agrees === "boolean" ? data.cross_check.key_agrees : null,
        bpmAgrees: typeof data.cross_check?.bpm_agrees === "boolean" ? data.cross_check.bpm_agrees : null,
      });
      setStatus("complete");
    } catch (err) {
      console.error("Analysis error:", err);
      if (err instanceof ApiError && err.isRateLimit) {
        setError({ title: "You're going a little fast", hint: "Wait for the timer, then try again." });
        setCooldownSeconds(err.retryAfterSeconds ?? 60);
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    }
  }, [file]);

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setElapsedSeconds(0);
  };

  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 18)) * 100));

  const formatCooldown = (seconds: number) => {
    if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
    return `${seconds}s`;
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className={cn("h-1.5 w-1.5 rounded-full bg-amber-500", isProcessing && "animate-pulse motion-reduce:animate-none")}
            aria-hidden
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            Key & BPM finder
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-subtle">Camelot · cross-checked</span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {status !== "complete" && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isProcessing}
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          />
        )}

        {validationError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <span className="text-sm text-text-primary">{validationError}</span>
          </div>
        )}

        {isProcessing && (
          <div
            className="space-y-3 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-primary">{stageLabelFor(elapsedSeconds)}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="opacity-60 motion-reduce:hidden">
              <Waveform />
            </div>
            <p className="text-xs text-text-subtle">Typically 30–60 seconds. Keep this tab open.</p>
          </div>
        )}

        {status === "complete" && result && (
          <div className="space-y-4" role="status" aria-live="polite">
            <AnalysisResultCard result={result} />
            <SupportBlock />
          </div>
        )}

        {status === "error" && error && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-text-primary">{error.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{error.hint}</p>
              </div>
            </div>
            <SupportBlock />
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={status === "complete" ? handleReset : handleAnalyze}
          disabled={status === "complete" ? false : !canAnalyze}
          loading={isProcessing}
        >
          {!isProcessing && (status === "complete" ? <RotateCcw className="h-4 w-4" /> : <Music className="h-5 w-5" />)}
          {isProcessing
            ? "Analyzing"
            : status === "complete"
              ? "Analyze another"
              : cooldownSeconds > 0
                ? `Try again in ${formatCooldown(cooldownSeconds)}`
                : "Analyze audio"}
        </Button>
      </div>
    </div>
  );
}