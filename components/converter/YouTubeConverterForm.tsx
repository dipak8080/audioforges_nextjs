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
import { AudioPlayer } from "@/components/ui/AudioPlayer";
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
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strip only what a filesystem actually rejects. The old rule was
 *  `[^a-zA-Z0-9\s\-_]`, which erased every Devanagari, Cyrillic, CJK and
 *  accented character — a track titled entirely in one of those scripts
 *  came out as the empty string and fell through to "youtube-audio".
 *  Windows is the strictest target, so we match its reserved set. */
function safeFilename(raw: string, fallback = "youtube-audio"): string {
  const cleaned = raw
    .replace(/\.[a-z0-9]+$/i, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 100)
    .trim();
  return cleaned || fallback;
}

/** Above this, skip the waveform decode. See the AudioPlayer call site
 *  in the complete state for the reasoning. Roughly a two-minute WAV. */
const WAVEFORM_DECODE_LIMIT_BYTES = 25 * 1024 * 1024;

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

interface ConversionResult {
  blob: Blob;
  filename: string;
  size: number;
  format: OutputFormat;
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
  const [result, setResult] = useState<ConversionResult | null>(null);

  /** Object URL for the preview player. Held in state (not a ref) so the
   *  player re-renders once it exists, and revoked by the same effect
   *  that created it — the old code pushed every URL into a ref array,
   *  set a 30s revoke timer, AND revoked again on unmount. */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const downloadSlotRef = useRef<HTMLDivElement>(null);

  const isProcessing = status === "processing";
  const isComplete = status === "complete" && result !== null;
  const videoId = useMemo(() => extractVideoId(url.trim()), [url]);
  const canConvert = Boolean(videoId) && !validationError && cooldownSeconds === 0;

  /* --- abort any in-flight request on unmount --------------------- */
  useEffect(() => () => abortRef.current?.abort(), []);

  /* --- one object URL per result, revoked when it's replaced ------- */
  useEffect(() => {
    if (!result) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(result.blob);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result]);

  /* --- move focus to the download button when a run finishes ------
     The primary action changed out from under the user, so a keyboard
     or screen-reader user should land on it rather than hunt for it.
     Queried through a wrapper div so this doesn't depend on <Button>
     forwarding refs. */
  useEffect(() => {
    if (!isComplete) return;
    const id = window.setTimeout(() => {
      downloadSlotRef.current?.querySelector("button")?.focus();
    }, 80);
    return () => window.clearTimeout(id);
  }, [isComplete]);

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
      if (text) setUrl(sanitizeUserInput(text, 500));
    } catch {
      // Clipboard permission denied — the input is still there to type into.
    }
    inputRef.current?.focus();
  };

  /** Clears the link only. Used by the X inside the input. It must NOT
   *  touch `result`: now that nothing downloads automatically, wiping
   *  the blob here would silently destroy a file the user hasn't saved.
   *  (The old code pointed this button at handleReset.) */
  const handleClearUrl = () => {
    setUrl("");
    setValidationError(null);
    setPreview(null);
    if (status === "error") {
      setStatus("idle");
      setError(null);
    }
    inputRef.current?.focus();
  };

  /** Full reset — new track, discard the finished file. */
  const handleReset = () => {
    setUrl("");
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setPreview(null);
    setResult(null);
    setPreviewDuration(null);
    setHasDownloaded(false);
    setCooldownSeconds(0);
    setElapsedSeconds(0);
    inputRef.current?.focus();
  };

  /** Always called from a click, never from an await — so the browser
   *  treats it as a trusted gesture and won't silently drop it. */
  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Safari and Firefox need the URL to outlive the click.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    setHasDownloaded(true);
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
    setPreviewDuration(null);
    setHasDownloaded(false);

    try {
      const payload = await downloadYouTubeAudio(check.normalizedUrl || trimmed, format, {
        signal: controller.signal,
      });
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

      const blob = base64ToBlob(base64, mimeType);
      const filename = `${safeFilename(rawTitle)}.${format}`;

      // No auto-download. The user saves it themselves, from a real click.
      setResult({ blob, filename, size: blob.size, format });
      setStatus("complete");
    } catch (err) {
      // A cancelled request now rejects with a raw AbortError rather than
      // an ApiError, so this guard has to come before anything else —
      // otherwise pressing Cancel renders "The conversion failed".
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canConvert && !isProcessing) {
      e.preventDefault();
      handleConvert();
    }
  };

  /* --- progress: eases toward 92%, snaps to 100 on success --------- */
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 16)) * 100));

  const resultThumbId = preview?.id ?? videoId;

  /* ------------------------------------------------------------------ */

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      {/* Header strip — reads like a device faceplate, not a web form */}
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-amber-500",
              isProcessing && "animate-pulse motion-reduce:animate-none"
            )}
            aria-hidden
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            YouTube to audio
          </span>
        </div>
        <span className="font-mono text-[11px] text-text-subtle">
          {formatOption(isComplete ? result.format : format).spec}
        </span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {/* ---------- URL input ----------
            Hidden on completion so the finished file is the only thing
            on the card, matching YouTubeUrlForm. */}
        {!isComplete && (
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

              {/* In-field controls: sized to sit inside the input, not
                  standalone buttons. Not <Button> material. */}
              <div className="absolute right-2.5 flex items-center gap-1">
                {url && !isProcessing && (
                  <button
                    type="button"
                    onClick={handleClearUrl}
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
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:pointer-events-none disabled:opacity-40"
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
        )}

        {/* ---------- Video preview: confirms the right track ---------- */}
        {preview && !isProcessing && !isComplete && (
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
        {!isComplete && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">Output format</p>
            <FormatSelector
              options={FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
              disabled={isProcessing}
            />
          </div>
        )}

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
              {/* Underlined text link, not a button shape - deliberately
                  not run through <Button>. */}
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

        {/* ---------- Complete ----------
            The file exists in the browser but nothing has left it yet,
            so the card's job is: confirm it's the right track, let them
            hear it, and make saving the obvious next move. */}
        {isComplete && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="overflow-hidden rounded-lg border border-teal-400/25 bg-teal-400/[0.07]">
              <div className="flex items-start gap-3 p-4">
                {resultThumbId && !thumbFailed ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`https://i.ytimg.com/vi/${resultThumbId}/mqdefault.jpg`}
                    alt=""
                    onError={() => setThumbFailed(true)}
                    className="h-12 w-20 shrink-0 rounded object-cover"
                  />
                ) : (
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-teal-400"
                    aria-hidden
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-text-primary">
                    {result.filename}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-text-subtle">
                    {formatOption(result.format).spec} · {formatBytes(result.size)}
                    {previewDuration ? ` · ${formatElapsed(previewDuration)}` : ""}
                  </p>
                </div>

                {/* One job: say whether this file is on their disk yet.
                    Without it, removing the auto-download leaves no signal
                    that the work isn't finished. */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                    hasDownloaded
                      ? "bg-teal-400/15 text-teal-300"
                      : "bg-amber-500/15 text-amber-400"
                  )}
                >
                  {hasDownloaded ? "Saved" : "Not saved"}
                </span>
              </div>

              {/* The shared player, not a bespoke scrubber — it already
                  draws the DAW envelope via WaveformCanvas and brings
                  keyboard seeking, volume, speed and a decode-failure
                  fallback with it. Its own border/background/padding are
                  overridden so it reads as part of this card rather than
                  a second box nested inside one. */}
              {previewUrl && (
                <div className="border-t border-teal-400/15 px-4 py-3">
                  <AudioPlayer
                    src={previewUrl}
                    onDuration={setPreviewDuration}
                    /* Of the eight places this player is mounted, only
                       this one holds a lossless local blob: a 4-minute
                       WAV is ~47MB, and decoding it for the drawing
                       expands it to ~90MB of Float32 held alongside the
                       blob itself. Fine on a laptop, a plausible tab
                       crash on a mid-range phone. Past the threshold the
                       player keeps every control and just falls back to
                       the plain amber rail. */
                    showWaveform={result.size <= WAVEFORM_DECODE_LIMIT_BYTES}
                    className="border-0 bg-transparent p-0"
                  />
                </div>
              )}
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
        {/* w-full sm:flex-1 on the children below, NOT flex-1 alone:
            this row is flex-col on mobile, so flex-1 resolves against the
            MAIN axis, which is vertical there. `flex-basis: 0%` then beats
            the h-12 from size="lg" and the button collapses to a short
            bar - visibly shorter than the same button on every other
            tool page. */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {(status === "idle" || status === "error") && (
            /* Neutral until the link parses. A disabled amber fill at 40%
               opacity renders as a muddy brown bar - it reads as broken
               rather than inactive, and on an empty form it's the loudest
               thing on the card. Grey says "not yet"; amber is earned
               once there's a real video ID. */
            <Button
              variant={videoId || status === "error" ? "primary" : "secondary"}
              size="lg"
              className="w-full sm:flex-1"
              onClick={handleConvert}
              disabled={!canConvert}
            >
              <Download />
              {cooldownSeconds > 0
                ? `Try again in ${cooldownSeconds}s`
                : `Convert to ${formatOption(format).label}`}
            </Button>
          )}

          {isProcessing && (
            /* loading alone, not loading + disabled: disabled drops focus
               to <body>, so a keyboard user loses their place the moment
               the conversion starts. */
            <Button variant="outline" size="lg" className="w-full sm:flex-1" loading>
              Converting
            </Button>
          )}

          {isComplete && (
            <>
              {/* Wrapper exists so the completion effect can focus the
                  button without <Button> having to forward a ref. */}
              <div ref={downloadSlotRef} className="w-full sm:flex-1">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => triggerDownload(result.blob, result.filename)}
                >
                  <Download />
                  {hasDownloaded
                    ? "Download again"
                    : `Download ${formatOption(result.format).label}`}
                </Button>
              </div>
              <Button variant="outline" size="lg" onClick={handleReset}>
                <RotateCcw />
                Convert another
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}