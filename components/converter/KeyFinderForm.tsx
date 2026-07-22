"use client";

import { useEffect, useState } from "react";
import { Music, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { validateAudioFile, checkRateLimit } from "@/lib/utils/validation";
import { analyzeAudioFile, ApiError } from "@/lib/api/railway";
import type { AnalysisResult, ProcessingState } from "@/lib/types/converter";
import { SupportBlock } from "@/components/ui/SupportBlock";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function KeyFinderForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (status !== "processing") return;
    setElapsedSeconds(0);
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  const handleFileSelect = (selectedFile: File) => {
    setValidationError(null);
    const validation = validateAudioFile(selectedFile);
    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid file");
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setStatus("idle");
    setErrorMessage(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;

    const rateLimit = checkRateLimit("keyfinder", 10, 60000);
    if (!rateLimit.allowed) {
      setErrorMessage(rateLimit.message || "Too many requests");
      setStatus("error");
      return;
    }

    setStatus("processing");
    setResult(null);
    setErrorMessage(null);

    try {
      const data = await analyzeAudioFile(file);
      const rawConf = Number(data.confidence) || 0;
      const rawBpmConf = Number(data.bpm_confidence) || 0;
      const toPct = (n: number) => Math.round(n > 1 ? n : n * 100);

      setResult({
        key: (data.key as string) || "Unknown",
        camelot: (data.camelot as string) || "N/A",
        bpm: Math.round(Number(data.bpm) || 0),
        confidence: toPct(rawConf),
        bpmConfidence: toPct(rawBpmConf),
        keyAgrees: typeof data.cross_check?.key_agrees === "boolean" ? data.cross_check.key_agrees : null,
        bpmAgrees: typeof data.cross_check?.bpm_agrees === "boolean" ? data.cross_check.bpm_agrees : null,
      });
      setStatus("complete");
    } catch (error) {
      console.error("Analysis error:", error);
      const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setStatus("error");
    }
  };

  const handleClear = () => {
    setFile(null);
    setResult(null);
    setStatus("idle");
    setValidationError(null);
    setErrorMessage(null);
  };

  const isProcessing = status === "processing";
  const canAnalyze = file && !isProcessing && status !== "complete";

  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8 space-y-6">
      <FileDropZone
        onFileSelect={handleFileSelect}
        currentFile={file}
        onClear={handleClear}
        disabled={isProcessing}
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
      />

      {validationError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <span className="text-sm text-text-primary">{validationError}</span>
        </div>
      )}

      {isProcessing && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Waveform />
          <p className="text-sm text-text-muted">Analyzing audio…</p>
          <div className="w-full max-w-xs h-1.5 rounded-full bg-graphite-800 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-amber-500 animate-indeterminate" />
          </div>
          <p className="text-xs font-mono text-text-subtle tabular-nums">
            {formatElapsed(elapsedSeconds)} elapsed — usually 30–60 seconds
          </p>
        </div>
      )}

      {result && status === "complete" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-graphite-800 bg-graphite-850 p-4 text-center">
              <p className="text-xs text-text-muted">Musical Key</p>
              <p className="text-2xl font-mono font-bold text-amber-400 mt-1">{result.key}</p>
              {result.keyAgrees === false && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-medium px-2 py-0.5">
                  <Info className="h-3 w-3" /> Lower confidence
                </span>
              )}
            </div>
            <div className="rounded-lg border border-graphite-800 bg-graphite-850 p-4 text-center">
              <p className="text-xs text-text-muted">Camelot</p>
              <p className="text-2xl font-mono font-bold text-teal-400 mt-1">{result.camelot}</p>
            </div>
            <div className="rounded-lg border border-graphite-800 bg-graphite-850 p-4 text-center">
              <p className="text-xs text-text-muted">BPM</p>
              <p className="text-2xl font-mono font-bold text-text-primary mt-1">{result.bpm}</p>
              {result.bpmAgrees === false && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-medium px-2 py-0.5">
                  <Info className="h-3 w-3" /> Lower confidence
                </span>
              )}
            </div>
            <div className="rounded-lg border border-graphite-800 bg-graphite-850 p-4 text-center">
              <p className="text-xs text-text-muted">Confidence</p>
              <p className="text-2xl font-mono font-bold text-teal-400 mt-1">{result.confidence}%</p>
            </div>
          </div>

          <SupportBlock />
        </div>
      )}

      {status === "error" && errorMessage && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span className="text-sm text-text-primary">{errorMessage}</span>
          </div>

          <SupportBlock />
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={status === "complete" ? handleClear : handleAnalyze}
        disabled={(!canAnalyze && status !== "complete") || isProcessing}
      >
        <Music className="h-5 w-5" />
        {isProcessing ? "Analyzing…" : status === "complete" ? "Analyze another" : "Analyze audio"}
      </Button>
    </div>
  );
}