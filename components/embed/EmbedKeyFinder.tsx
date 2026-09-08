"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music, RotateCcw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import { analyzeAudioFile, isAbortError, ApiError } from "@/lib/api/railway";
import { toAnalysisResult } from "@/components/converter/AnalysisResultCard";
import { SITE_URL } from "@/lib/constants";
import type { AnalysisResult, ProcessingState } from "@/lib/types/converter";

type EmbedError = { title: string; hint: string };

function humanizeError(raw: string): EmbedError {
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
  return { title: raw, hint: "Run it again, or try a different file." };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-graphite-800 bg-graphite-900/60 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="mt-0.5 text-xl font-semibold leading-tight text-text-primary">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-text-secondary">{sub}</div> : null}
    </div>
  );
}

export function EmbedKeyFinder() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<EmbedError | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const isProcessing = status === "processing";
  const isComplete = status === "complete";

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setInterval(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownSeconds]);

  const handleFileSelect = (selected: File) => {
    setValidationError(null);
    const validation = validateAudioFile(selected);
    if (!validation.isValid) {
      setValidationError(validation.error || "That file can't be used here");
      return;
    }
    setFile(selected);
    setResult(null);
    setStatus("idle");
    setError(null);
  };

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    setStatus("processing");
    setResult(null);
    setError(null);

    try {
      const data = await analyzeAudioFile(file, { signal: controller.signal });
      if (cancelledRef.current) return;
      setResult(toAnalysisResult(data));
      setStatus("complete");
    } catch (err) {
      if (cancelledRef.current || isAbortError(err) || controller.signal.aborted) return;
      if (err instanceof ApiError && err.isRateLimit) {
        setError({ title: "Too many analyses right now", hint: "Wait for the timer, then try again." });
        setCooldownSeconds(err.retryAfterSeconds ?? getRetryAfterFallback("analyze"));
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, [file]);

  const handleReset = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setResult(null);
    setStatus("idle");
    setValidationError(null);
    setError(null);
  };

  const canAnalyze = Boolean(file) && !isProcessing && !isComplete && cooldownSeconds === 0;

  return (
    <div className="flex min-h-full flex-col gap-3 p-4">
      {!isComplete && (
        <FileDropZone
          onFileSelect={handleFileSelect}
          currentFile={file}
          onClear={handleReset}
          disabled={isProcessing}
          accept="audio/*"
        />
      )}

      {validationError && (
        <p className="text-sm text-red-400">{validationError}</p>
      )}

      {error && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2.5">
          <p className="text-sm font-medium text-red-300">{error.title}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{error.hint}</p>
        </div>
      )}

      {result && isComplete && (
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Key" value={result.key} sub={`${result.confidence}% confidence`} />
          <Stat label="Camelot" value={result.camelot} />
          <Stat label="BPM" value={String(result.bpm)} sub={`${result.bpmConfidence}% confidence`} />
        </div>
      )}

      <div className="mt-auto space-y-2.5">
        {(file || isComplete) && (
          <Button
            variant={isComplete ? "outline" : "primary"}
            size="lg"
            className="w-full"
            onClick={isComplete ? handleReset : handleAnalyze}
            disabled={isComplete ? false : !canAnalyze && !isProcessing}
            loading={isProcessing}
            loadingLabel="Analyzing"
          >
            {!isProcessing && (isComplete ? <RotateCcw /> : <Music />)}
            {isProcessing
              ? "Analyzing"
              : isComplete
                ? "Analyze another track"
                : cooldownSeconds > 0
                  ? `Wait ${cooldownSeconds}s`
                  : "Detect key & BPM"}
          </Button>
        )}

        <a
          href={`${SITE_URL}/key-finder?utm_source=embed&utm_medium=widget`}
          target="_blank"
          rel="noopener"
          className="flex items-center justify-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-amber-400"
        >
          Powered by AudioForges
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}