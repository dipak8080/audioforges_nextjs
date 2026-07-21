"use client";

import { useCallback, useEffect, useState } from "react";
import { FileVideo, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { Waveform } from "@/components/ui/Waveform";
import { cn } from "@/lib/utils/cn";
import {
  validateYouTubeUrl,
  checkRateLimit,
  sanitizeUserInput,
} from "@/lib/utils/validation";
import {
  downloadYouTubeAudio,
  extractBase64Audio,
  base64ToBlob,
  ApiError,
} from "@/lib/api/railway";
import { FORMAT_OPTIONS, type OutputFormat, type ProcessingState } from "@/lib/types/converter";
import { SupportBlock } from "@/components/ui/SupportBlock";

export function YouTubeConverterForm() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<OutputFormat>("wav");
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [urlTouched, setUrlTouched] = useState(false);
  const [completedTitle, setCompletedTitle] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  const handleUrlBlur = useCallback(() => {
    setUrlTouched(true);
    if (url.trim()) {
      const result = validateYouTubeUrl(url);
      setValidationError(result.isValid ? null : result.error || null);
    } else {
      setValidationError(null);
    }
  }, [url]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(sanitizeUserInput(e.target.value, 500));
    if (validationError) setValidationError(null);
  };

  const handleConvert = async () => {
    const trimmedUrl = url.trim();
    const urlValidation = validateYouTubeUrl(trimmedUrl);
    if (!urlValidation.isValid) {
      setValidationError(urlValidation.error || "Invalid URL");
      return;
    }

    const rateLimit = checkRateLimit("youtube", 5, 60000);
    if (!rateLimit.allowed) {
      setErrorMessage(rateLimit.message || "Too many requests");
      setStatus("error");
      return;
    }

    setStatus("processing");
    setErrorMessage(null);
    setCompletedTitle(null);

    try {
      const payload = await downloadYouTubeAudio(urlValidation.normalizedUrl || trimmedUrl, format);
      const base64 = extractBase64Audio(payload);
      if (!base64) throw new Error("Server did not return audio data.");

      const mimeType =
        (payload.mime_type as string) ||
        (payload.mimeType as string) ||
        (format === "mp3" ? "audio/mpeg" : "audio/wav");

      const rawTitle = (payload.title as string) || (payload.filename as string) || "youtube-audio";
      const safeTitle =
        rawTitle
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/[^a-zA-Z0-9\s\-_]/g, "")
          .replace(/\s+/g, "_")
          .slice(0, 100) || "youtube-audio";

      const blob = base64ToBlob(base64, mimeType);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${safeTitle}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      setCompletedTitle(rawTitle);
      setStatus("complete");
    } catch (error) {
      console.error("Conversion error:", error);
      const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
      setErrorMessage(message);
      setStatus("error");
      if (error instanceof ApiError && error.isRateLimit) {
        setCooldownSeconds(error.retryAfterSeconds ?? 10);
      }
    }
  };

  const handleReset = () => {
    setUrl("");
    setStatus("idle");
    setValidationError(null);
    setErrorMessage(null);
    setUrlTouched(false);
    setCompletedTitle(null);
    setCooldownSeconds(0);
  };

  const isProcessing = status === "processing";
  const hasValidUrl = url.trim().length > 0 && !validationError;
  const showUrlError = urlTouched && validationError && url.trim().length > 0;

  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-900 p-6 sm:p-8 space-y-6">
      <div className="space-y-2">
        <label htmlFor="youtube-url" className="text-sm font-medium text-text-primary">
          YouTube URL
        </label>
        <div className="relative">
          <FileVideo className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-subtle" />
          <input
            id="youtube-url"
            type="url"
            value={url}
            onChange={handleUrlChange}
            onBlur={handleUrlBlur}
            placeholder="https://youtube.com/watch?v=..."
            disabled={isProcessing}
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
            className={cn(
              "w-full rounded-lg border bg-graphite-850 py-3.5 pl-12 pr-4 text-text-primary placeholder:text-text-subtle",
              "focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors",
              showUrlError
                ? "border-red-500/60 focus:ring-red-500/30"
                : "border-graphite-700 focus:border-amber-500/50 focus:ring-amber-500/20"
            )}
          />
        </div>
        {showUrlError && (
          <p className="flex items-center gap-1.5 text-sm text-red-500" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {validationError}
          </p>
        )}
        <p className="text-xs text-text-subtle">Supports youtube.com/watch, youtu.be, and shorts links</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text-primary">Output format</label>
        <FormatSelector options={FORMAT_OPTIONS} value={format} onChange={setFormat} disabled={isProcessing} />
      </div>

      {isProcessing && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Waveform />
          <p className="text-sm text-text-muted">Extracting {format.toUpperCase()} audio…</p>
          <p className="text-xs text-text-subtle">Usually takes 20–40 seconds</p>
        </div>
      )}

      {status === "complete" && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-teal-400/30 bg-teal-400/10 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                Downloaded {completedTitle || "your audio"} as {format.toUpperCase()}
              </p>
              <p className="text-xs text-text-muted mt-0.5">Check your Downloads folder.</p>
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

      <div className="flex flex-col sm:flex-row gap-3">
        {(status === "idle" || status === "error") && (
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={handleConvert}
            disabled={!hasValidUrl || cooldownSeconds > 0}
          >
            <FileVideo className="h-5 w-5" />
            {cooldownSeconds > 0 ? `Try again in ${cooldownSeconds}s` : `Convert to ${format.toUpperCase()}`}
          </Button>
        )}

        {isProcessing && (
          <Button variant="outline" size="lg" className="flex-1" loading disabled>
            Processing…
          </Button>
        )}

        {status === "complete" && (
          <>
            <Button variant="primary" size="lg" className="flex-1" onClick={handleConvert}>
              <Download className="h-5 w-5" />
              Download again
            </Button>
            <Button variant="outline" size="lg" onClick={handleReset}>
              Convert another
            </Button>
          </>
        )}
      </div>
    </div>
  );
}