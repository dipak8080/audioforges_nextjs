"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  Section,
  ValidationNote,
  WorkingPanel,
  easedProgress,
  formatCooldown,
  stageIndexFor,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
  type ProcessingStage,
} from "@/components/tools/JobFormKit";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { AnalysisResultCard, toAnalysisResult } from "@/components/converter/AnalysisResultCard";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import { analyzeAudioFile, isAbortError, ApiError } from "@/lib/api/railway";
import type { AnalysisResult, ProcessingState } from "@/lib/types/converter";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. A CLIENT-SIDE RATE LIMIT THAT ISN'T THE REAL ONE. `checkRateLimit(
 *    "keyfinder", 10, 60000)` refused an eleventh analysis in a minute — a
 *    rule that exists nowhere on the backend. /analyze has no entry in
 *    RATE_LIMITS at all, so this number was invented here and enforced only
 *    here.
 *
 *    It also protects nothing: it lives in the tab and a reload clears it. What
 *    it does reliably is block the one session that matters — a DJ checking a
 *    folder of tracks, which is the entire use case for this tool. Removed;
 *    see the note in handleAnalyze for the one-line revert.
 *
 * 2. THERE WAS NO WAY TO CANCEL, AND NO ABORT ON UNMOUNT. /analyze runs up to
 *    90 seconds synchronously with no cancel affordance anywhere on the card,
 *    and navigating away mid-analysis left the request in flight to resolve
 *    into setState on an unmounted component. It takes an AbortSignal — it
 *    just was never given one.
 *
 * 3. THE COOLDOWN GUESSED 60 SECONDS. /analyze isn't in RATE_LIMITS, so
 *    getRetryAfterFallback returns its own 300s default — which is the honest
 *    answer when we don't know the window, rather than a number picked to look
 *    reasonable. The server's Retry-After overrides it whenever present.
 *
 * 4. THE RESPONSE MAPPING IS SHARED. This file and YouTubeAnalyzeForm carried
 *    identical copies of the AnalyzeResponse → AnalysisResult conversion. It
 *    lives beside AnalysisResultCard now, so the same track can't report
 *    different confidence depending on whether it was uploaded or pasted.
 *
 * 5. IT USES THE SHELL. Step rail (File → Analyze → Result), the working panel
 *    with its stage checklist, the shared error panel, and the action pinned to
 *    the footer instead of moving with the content.
 */

const STEPS = ["File", "Analyze", "Result"] as const;

const STAGES: ProcessingStage[] = [
  { at: 0, label: "Reading the audio" },
  { at: 6, label: "Reading the tempo grid" },
  { at: 16, label: "Estimating the key" },
  { at: 28, label: "Cross-checking both detectors" },
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

export function KeyFinderForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);

  const isProcessing = status === "processing";
  const isComplete = status === "complete";
  const isFailed = status === "error";

  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isProcessing);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  const cooldownCeilingRef = useRef(getRetryAfterFallback("analyze"));

  /** /analyze can run for ninety seconds. Without this there is no way to stop
   *  waiting, and no way to stop the response arriving after unmount. */
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canAnalyze = Boolean(file) && !isProcessing && !isComplete && cooldownSeconds === 0;
  const step: 1 | 2 | 3 = isComplete ? 3 : isProcessing ? 2 : 1;

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

    /*
      NO CLIENT-SIDE RATE LIMIT HERE ANY MORE.

      There used to be `checkRateLimit("keyfinder", 10, 60000)` — ten per
      minute, a number that exists nowhere on the backend; /analyze has no
      RATE_LIMITS entry at all. Checking a folder of tracks is the entire point
      of this tool, and that rule refused the eleventh while protecting
      nothing: it lives in the tab and a reload clears it. To restore it, put
      the call back at the top of this function.
    */

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
      // Shared with YouTubeAnalyzeForm — see AnalysisResultCard.
      setResult(toAnalysisResult(data));
      setStatus("complete");
    } catch (err) {
      // A cancelled request rejects with a raw AbortError rather than an
      // ApiError, so this guard comes first — otherwise pressing Cancel
      // renders "Something went wrong".
      if (cancelledRef.current || isAbortError(err) || controller.signal.aborted) return;

      console.error("Analysis error:", err);
      if (err instanceof ApiError && err.isRateLimit) {
        setError({
          title: "You're going a little fast",
          hint: "Wait for the timer, then try again.",
        });
        // /analyze isn't in RATE_LIMITS, so this is the helper's own default
        // rather than a number invented to look plausible. Retry-After wins
        // whenever the server sends one.
        const wait = err.retryAfterSeconds ?? getRetryAfterFallback("analyze");
        cooldownCeilingRef.current = Math.max(1, wait);
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

  const stageIndex = stageIndexFor(STAGES, elapsedSeconds);

  /* One button, two jobs — so the styling switches with the job. As a reset
     it's `outline`, matching "Process another file" in every other form; as the
     primary action it's amber. It used to stay amber in both states, which made
     "Analyze another" compete with the results it sat under.

     Hidden entirely while idle with no file: a dimmed amber fill at 40% opacity
     renders as a muddy brown bar, and there's nothing to analyse yet anyway. */
  const footer =
    file || isComplete || isFailed ? (
      <div className="space-y-2">
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
              ? "Analyze another"
              : cooldownSeconds > 0
                ? `Try again in ${formatCooldown(cooldownSeconds)}`
                : "Analyze audio"}
        </Button>
        <CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeilingRef.current} />
      </div>
    ) : undefined;

  return (
    <FormShell
      toolLabel="Key & BPM finder"
      toolMeta="Camelot · cross-checked"
      steps={STEPS}
      step={step}
      busy={isProcessing}
      failed={isFailed}
      complete={isComplete}
      footer={footer}
    >
      {/* SOURCE */}
      {!isComplete && (
        <Section className="space-y-4">
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isProcessing}
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          />
          {/* An error about the file belongs beside the file. */}
          {validationError && <ValidationNote message={validationError} />}
        </Section>
      )}

      {/* WORKING */}
      {isProcessing && (
        <Section>
          <WorkingPanel
            stageLabel={STAGES[stageIndex]?.label ?? "Analyzing"}
            stages={STAGES}
            stageIndex={stageIndex}
            showStageList
            elapsedSeconds={elapsedSeconds}
            progress={easedProgress(elapsedSeconds, 18)}
            expectedRange="30–60 seconds"
            chargedRun={false}
            onCancel={handleCancel}
            waveform={<Waveform />}
          />
        </Section>
      )}

      {/* RESULT */}
      {isComplete && result && (
        <Section>
          <div className="space-y-4" role="status" aria-live="polite">
            <AnalysisResultCard result={result} />
            <SupportBlock />
          </div>
        </Section>
      )}

      {/* FAILED */}
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