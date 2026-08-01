"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Link2,
  X,
  RotateCcw,
} from "lucide-react";
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

/* ------------------------------------------------------------------ */
/* Format specs — the numbers producers actually care about            */
/* ------------------------------------------------------------------ */

/** Single source of truth for format copy lives in FORMAT_OPTIONS. */
function formatOption(value: OutputFormat) {
  return FORMAT_OPTIONS.find((o) => o.value === value) ?? FORMAT_OPTIONS[0];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function extractVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pipeline stages, keyed to elapsed seconds. Labels describe what the
 *  backend is actually doing — no invented milestones. */
const STAGES: { at: number; label: (f: OutputFormat) => string }[] = [
  { at: 0, label: () => "Connecting to YouTube" },
  { at: 3, label: () => "Reading the video stream" },
  { at: 9, label: () => "Separating the audio track" },
  { at: 19, label: (f) => `Encoding to ${formatOption(f).label}` },
  { at: 34, label: () => "Transferring your file" },
];

function currentStage(elapsed: number, format: OutputFormat): string {
  let label = STAGES[0].label(format);
  for (const stage of STAGES) {
    if (elapsed >= stage.at) label = stage.label(format);
  }
  return label;
}

/** Errors should say what happened and what to do next. */
function humanizeError(error: unknown): { title: string; hint: string } {
  const raw = error instanceof Error ? error.message : "";
  const text = raw.toLowerCase();

  if (text.includes("private") || text.includes("unavailable")) {
    return {
      title: "This video can't be accessed",
      hint: "It may be private, age-restricted, or region-locked. Try a different link.",
    };
  }
  if (text.includes("too long") || text.includes("duration")) {
    return {
      title: "This video is too long",
      hint: "Try a video under the length limit, or clip it before converting.",
    };
  }
  if (text.includes("rate") || text.includes("429")) {
    return {
      title: "Too many conversions right now",
      hint: "The queue is busy. Wait a few seconds and run it again.",
    };
  }
  if (text.includes("network") || text.includes("fetch") || text.includes("timeout")) {
    return {
      title: "The connection dropped",
      hint: "Check your internet and run the conversion again.",
    };
  }
  return {
    title: raw || "The conversion failed",
    hint: "Run it again. If it keeps failing, the video may not be supported.",
  };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

interface VideoPreview {
  id: string;
  title: string | null;
  author: string | null;
}

export function YouTubeConverterForm() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<OutputFormat>("wav");
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<{
    blob: Blob;
    filename: string;
    size: number;
    format: OutputFormat;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const objectUrlsRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isProcessing = status === "processing";
  const videoId = useMemo(() => extractVideoId(url.trim()), [url]);
  const canConvert = Boolean(videoId) && !validationError && cooldownSeconds === 0;

  /* --- cleanup: revoke any object URLs we handed to the browser ---- */
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      abortRef.current?.abort();
    };
  }, []);

  /* --- cooldown ticker ------------------------------------------- */
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  /* --- elapsed ticker -------------------------------------------- */
  useEffect(() => {
    if (!isProcessing) return;
    setElapsedSeconds(0);
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isProcessing]);

  /* --- debounced validation + preview lookup ---------------------- */
  useEffect(() => {
    const trimmed = url.trim();

    if (!trimmed) {
      setValidationError(null);
      setPreview(null);
      return;
    }

    const timer = setTimeout(() => {
      const check = validateYouTubeUrl(trimmed);
      const id = extractVideoId(trimmed);

      if (!check.isValid || !id) {
        setValidationError(check.error || "That doesn't look like a YouTube link");
        setPreview(null);
        return;
      }

      setValidationError(null);
      setThumbFailed(false);
      setPreview((prev) => (prev?.id === id ? prev : { id, title: null, author: null }));

      // Best-effort metadata. Silently skipped if the request is blocked —
      // the thumbnail alone is enough to confirm the right video.
      fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setPreview((prev) =>
            prev?.id === id
              ? { id, title: data.title ?? null, author: data.author_name ?? null }
              : prev
          );
        })
        .catch(() => {});
    }, 400);

    return () => clearTimeout(timer);
  }, [url]);

  /* --- handlers ---------------------------------------------------- */

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(sanitizeUserInput(e.target.value, 500));
    if (status === "error") {
      setStatus("idle");
      setError(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(sanitizeUserInput(text, 500));
        inputRef.current?.focus();
      }
    } catch {
      // Clipboard permission denied — the input is still there to type into.
      inputRef.current?.focus();
    }
  };

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    objectUrlsRef.current.push(objectUrl);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Safari and Firefox need the URL to outlive the click.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
  }, []);

  const handleConvert = async () => {
    const trimmed = url.trim();
    const check = validateYouTubeUrl(trimmed);
    if (!check.isValid) {
      setValidationError(check.error || "That doesn't look like a YouTube link");
      return;
    }

    const rateLimit = checkRateLimit("youtube", 5, 60000);
    if (!rateLimit.allowed) {
      setError({
        title: "Slow down a moment",
        hint: rateLimit.message || "You've hit the per-minute limit. Try again shortly.",
      });
      setStatus("error");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    setStatus("processing");
    setError(null);
    setResult(null);

    try {
      // To make Cancel abort the request for real (not just ignore the
      // response), add an options param to downloadYouTubeAudio and pass
      // { signal: controller.signal } here as a third argument.
      const payload = await downloadYouTubeAudio(check.normalizedUrl || trimmed, format);
      if (cancelledRef.current) return;

      const base64 = extractBase64Audio(payload);
      if (!base64) throw new Error("The server didn't return any audio data.");

      const mimeType =
        (payload.mime_type as string) ||
        (payload.mimeType as string) ||
        (format === "mp3" ? "audio/mpeg" : "audio/wav");

      const rawTitle =
        (payload.title as string) ||
        (payload.filename as string) ||
        preview?.title ||
        "youtube-audio";

      const safeTitle =
        rawTitle
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/[^a-zA-Z0-9\s\-_]/g, "")
          .replace(/\s+/g, "_")
          .slice(0, 100) || "youtube-audio";

      const blob = base64ToBlob(base64, mimeType);
      const filename = `${safeTitle}.${format}`;

      triggerDownload(blob, filename);
      setResult({ blob, filename, size: blob.size, format });
      setStatus("complete");
    } catch (err) {
      if (cancelledRef.current || controller.signal.aborted) return;
      console.error("Conversion error:", err);
      setError(humanizeError(err));
      setStatus("error");
      if (err instanceof ApiError && err.isRateLimit) {
        setCooldownSeconds(err.retryAfterSeconds ?? 10);
      }
    } finally {
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setError(null);
  };

  const handleReset = () => {
    setUrl("");
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setPreview(null);
    setResult(null);
    setCooldownSeconds(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canConvert && !isProcessing) {
      e.preventDefault();
      handleConvert();
    }
  };

  /* --- progress: eases toward 92%, snaps to 100 on success --------- */
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 16)) * 100));

  /* ------------------------------------------------------------------ */

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      {/* Header strip — reads like a device faceplate, not a web form */}
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            YouTube to audio
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-subtle">
          {formatOption(format).spec}
        </span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {/* ---------- URL input ---------- */}
        <div className="space-y-2">
          <label
            htmlFor="youtube-url"
            className="text-sm font-medium text-text-primary"
          >
            Paste a YouTube link
          </label>

          <div className="relative flex items-center">
            <Link2
              className={cn(
                "pointer-events-none absolute left-4 h-4 w-4 transition-colors",
                videoId ? "text-amber-500" : "text-text-subtle"
              )}
              aria-hidden
            />
            <input
              ref={inputRef}
              id="youtube-url"
              type="url"
              value={url}
              onChange={handleUrlChange}
              onKeyDown={handleKeyDown}
              placeholder="https://youtube.com/watch?v=..."
              disabled={isProcessing}
              autoComplete="off"
              spellCheck={false}
              maxLength={500}
              aria-invalid={Boolean(validationError)}
              aria-describedby={validationError ? "url-error" : "url-hint"}
              className={cn(
                "w-full rounded-lg border bg-graphite-850 py-3.5 pl-11 pr-24 text-text-primary",
                "placeholder:text-text-subtle transition-colors",
                "focus:outline-none focus:ring-2 disabled:opacity-50",
                validationError
                  ? "border-red-500/60 focus:ring-red-500/25"
                  : videoId
                    ? "border-amber-500/40 focus:ring-amber-500/20"
                    : "border-graphite-700 focus:border-amber-500/50 focus:ring-amber-500/20"
              )}
            />

            <div className="absolute right-2.5 flex items-center gap-1">
              {url && !isProcessing && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Clear link"
                  className="rounded-md p-1.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {!url && (
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Paste
                </button>
              )}
            </div>
          </div>

          {validationError ? (
            <p
              id="url-error"
              role="alert"
              className="flex items-center gap-1.5 text-sm text-red-400"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {validationError}
            </p>
          ) : (
            <p id="url-hint" className="text-xs text-text-subtle">
              Works with watch links, youtu.be, and Shorts
            </p>
          )}
        </div>

        {/* ---------- Video preview: confirms the right track ---------- */}
        {preview && !isProcessing && status !== "complete" && (
          <div className="flex items-center gap-4 rounded-lg border border-graphite-800 bg-graphite-850/60 p-3">
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-graphite-800">
              {!thumbFailed && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`https://i.ytimg.com/vi/${preview.id}/mqdefault.jpg`}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setThumbFailed(true)}
                  loading="lazy"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {preview.title || "Video ready to convert"}
              </p>
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {preview.author || preview.id}
              </p>
            </div>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-400" aria-hidden />
          </div>
        )}

        {/* ---------- Format ---------- */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">Output format</p>
          <FormatSelector
            options={FORMAT_OPTIONS}
            value={format}
            onChange={setFormat}
            disabled={isProcessing}
          />
        </div>

        {/* ---------- Processing ---------- */}
        {isProcessing && (
          <div
            className="space-y-3 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-primary">
                {currentStage(elapsedSeconds, format)}
              </span>
              <span className="font-mono text-xs tabular-nums text-text-subtle">
                {formatElapsed(elapsedSeconds)}
              </span>
            </div>

            <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="opacity-60 motion-reduce:hidden">
                <Waveform />
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded px-1 text-xs text-text-subtle underline underline-offset-2 transition-colors hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                Cancel
              </button>
            </div>

            {elapsedSeconds > 45 && (
              <p className="text-xs text-text-subtle">
                Longer videos take more time. Keep this tab open.
              </p>
            )}
          </div>
        )}

        {/* ---------- Complete ---------- */}
        {status === "complete" && result && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="rounded-lg border border-teal-400/25 bg-teal-400/[0.07] p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">Saved to Downloads</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-text-muted">
                    {result.filename}
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] text-text-subtle">
                    {formatOption(result.format).spec} · {formatBytes(result.size)}
                  </p>
                </div>
              </div>
            </div>
            <SupportBlock />
          </div>
        )}

        {/* ---------- Error ---------- */}
        {status === "error" && error && (
          <div className="space-y-4">
            <div
              className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-text-primary">{error.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{error.hint}</p>
              </div>
            </div>
            <SupportBlock />
          </div>
        )}

        {/* ---------- Actions ---------- */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {(status === "idle" || status === "error") && (
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handleConvert}
              disabled={!canConvert}
            >
              <Download className="h-5 w-5" />
              {cooldownSeconds > 0
                ? `Try again in ${cooldownSeconds}s`
                : `Convert to ${formatOption(format).label}`}
            </Button>
          )}

          {isProcessing && (
            <Button variant="outline" size="lg" className="flex-1" loading disabled>
              Converting
            </Button>
          )}

          {status === "complete" && result && (
            <>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={() => triggerDownload(result.blob, result.filename)}
              >
                <Download className="h-5 w-5" />
                Save again
              </Button>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Convert another
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}