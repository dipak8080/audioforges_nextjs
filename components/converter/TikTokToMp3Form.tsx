"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  AlertTriangle,
  ClipboardPaste,
  Link2,
  X,
  RotateCcw,
  Music2,
} from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { sanitizeUserInput } from "@/lib/utils/validation";
import { convertTikTokToMp3, base64ToBlob, ApiError } from "@/lib/api/railway";

type UiState = "idle" | "working" | "complete" | "error";

interface ConversionResult {
  objectUrl: string;
  filename: string;
  title: string;
  /** Null on a cache hit - the backend cache stores audio and title only. */
  duration: number | null;
  size: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Deliberately loose: host recognition only.
 *
 * The backend owns every real rejection - photo posts, age gates,
 * region blocks, over-length videos - and returns a message written for
 * that exact case. Duplicating any of that here would mean two sources
 * of truth that drift, and the client version would always be the worse
 * one. This exists purely so an obviously-not-a-link paste doesn't cost
 * a network round trip to find out.
 */
function isLikelyTikTokUrl(input: string): boolean {
  const value = input.trim();
  if (!value || /\s/.test(value)) return false;
  return /^(https?:\/\/)?([\w-]+\.)*tiktok\.com\/\S+/i.test(value);
}

/**
 * TikTok captions carry emoji, hashtags, slashes and newlines - none of
 * which belong in a filename. Strip to a safe set and fall back to the
 * numeric post id, which always is one.
 */
function buildFilename(title: string, id: string | null): string {
  const safe = (title || "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${safe || `tiktok-${id || "audio"}`}.mp3`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function TikTokToMp3Form() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<UiState>("idle");
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showInvalid, setShowInvalid] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const isWorking = status === "working";
  const isComplete = status === "complete";
  /**
   * A failure the backend says cannot succeed on retry - a photo post, a
   * deleted video, a region block. The action has to CHANGE, not just be
   * relabelled: pressing convert again on the same link reproduces the
   * same error, so this clears the field and hands focus back instead.
   */
  const isDeadEnd = status === "error" && Boolean(error) && !error?.retryable;
  const looksValid = useMemo(() => isLikelyTikTokUrl(url), [url]);
  const canConvert = looksValid && !isWorking && cooldownSeconds === 0;

  /* --- one object URL alive at a time, revoked on replace/unmount ---
     A 1 MB blob per conversion adds up fast on a page where someone
     grabs several sounds in a row. */
  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => releaseObjectUrl, [releaseObjectUrl]);

  useEffect(() => {
    if (!isWorking) return;
    setElapsedSeconds(0);
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isWorking]);

  /* Debounced by 400ms, matching the YouTube forms: deriving this
     straight from `looksValid` would flash the field red on every
     keystroke of a link being typed out. */
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      setShowInvalid(false);
      return;
    }
    const timer = setTimeout(() => setShowInvalid(!isLikelyTikTokUrl(trimmed)), 400);
    return () => clearTimeout(timer);
  }, [url]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  // Same eased curve as every other form, with a shorter time constant
  // to suit a 2-8s job rather than a 20s one. Caps at 92% and only
  // completes when the conversion actually does.
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / 4)) * 100));

  const handleCancel = () => {
    // Matches YouTubeConverterForm: this stops the UI waiting and
    // discards the response. The request itself keeps running on the
    // server until it finishes - convertTikTokToMp3 would need to accept
    // an AbortSignal to hard-cancel it.
    cancelledRef.current = true;
    setStatus("idle");
    setError(null);
    setElapsedSeconds(0);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(sanitizeUserInput(e.target.value, 2048));
    if (status === "error") {
      setStatus("idle");
      setError(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      // Share links copied out of the TikTok app frequently carry a
      // trailing space or newline.
      if (text) setUrl(sanitizeUserInput(text.trim(), 2048));
    } catch {
      // Clipboard blocked — the field is still there to type into.
    }
    inputRef.current?.focus();
  };

  const handleReset = () => {
    cancelledRef.current = true;
    releaseObjectUrl();
    setUrl("");
    setStatus("idle");
    setError(null);
    setResult(null);
    setElapsedSeconds(0);
    inputRef.current?.focus();
  };

  const handleConvert = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    releaseObjectUrl();
    cancelledRef.current = false;
    setStatus("working");
    setError(null);
    setResult(null);

    try {
      const data = await convertTikTokToMp3(trimmed);
      if (cancelledRef.current) return;

      const blob = base64ToBlob(data.audio, "audio/mpeg");
      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      setResult({
        objectUrl,
        filename: buildFilename(data.title, data.id),
        title: data.title || "TikTok audio",
        duration: typeof data.duration === "number" ? data.duration : null,
        size: blob.size,
      });
      setStatus("complete");
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("tiktok-to-mp3 error:", err);

      if (err instanceof ApiError) {
        // The message and the retry decision both come from the backend.
        // No rewriting, no prefixing, and no local opinion about which
        // failures are worth retrying - seven of the ten failure kinds
        // fail identically forever, and a retry button on those is worse
        // than no button at all.
        setError({
          message: err.message,
          retryable: Boolean(err.retryable) || err.isTimeout || err.isServerBusy,
        });
        if (err.isRateLimit) setCooldownSeconds(err.retryAfterSeconds ?? 60);
      } else {
        setError({ message: "Something went wrong. Please try again.", retryable: true });
      }
      setStatus("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canConvert) {
      e.preventDefault();
      handleConvert();
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full bg-amber-500",
              isWorking && "animate-pulse motion-reduce:animate-none"
            )}
            aria-hidden
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
            TikTok to MP3
          </span>
        </div>
        {/* Format facts, not a quality claim. No bitrate number here on
            purpose: TikTok's source audio is ~64 kbps AAC, so any figure
            we print invites a comparison we'd lose to competitors happily
            printing "320 kbps" over the same source. */}
        <span className="font-mono text-[11px] text-text-subtle">MP3 · 44.1 kHz stereo</span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {!isComplete && (
          <div className="space-y-2">
            <label htmlFor="tiktok-url" className="text-sm font-medium text-text-primary">
              Paste a TikTok link
            </label>

            <div className="relative flex items-center">
              <Link2
                className={cn(
                  "pointer-events-none absolute left-4 h-4 w-4 transition-colors",
                  looksValid ? "text-amber-500" : "text-text-subtle"
                )}
                aria-hidden
              />
              <input
                ref={inputRef}
                id="tiktok-url"
                type="url"
                value={url}
                onChange={handleUrlChange}
                onKeyDown={handleKeyDown}
                placeholder="https://www.tiktok.com/@user/video/..."
                disabled={isWorking}
                autoComplete="off"
                spellCheck={false}
                maxLength={2048}
                aria-invalid={showInvalid}
                aria-describedby={showInvalid ? "tiktok-url-error" : "tiktok-url-hint"}
                className={cn(
                  "w-full rounded-lg border bg-graphite-850 py-3.5 pl-11 pr-24 text-text-primary",
                  "placeholder:text-text-subtle transition-colors",
                  "focus:outline-none focus:ring-2 disabled:opacity-50",
                  showInvalid
                    ? "border-red-500/60 focus:ring-red-500/25"
                    : looksValid
                      ? "border-amber-500/40 focus:ring-amber-500/20"
                      : "border-graphite-700 focus:border-amber-500/50 focus:ring-amber-500/20"
                )}
              />

              <div className="absolute right-2.5 flex items-center gap-1">
                {url && !isWorking && (
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
                    disabled={isWorking}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:pointer-events-none disabled:opacity-60"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Paste
                  </button>
                )}
              </div>
            </div>

            {showInvalid ? (
              <p
                id="tiktok-url-error"
                role="alert"
                className="flex items-center gap-1.5 text-sm text-red-400"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                That doesn&apos;t look like a TikTok link
              </p>
            ) : (
              <p id="tiktok-url-hint" className="text-xs text-text-subtle">
                Works with the app&apos;s Share link, vt.tiktok.com and vm.tiktok.com
              </p>
            )}
          </div>
        )}

        {/* ---------- Working ----------
            Same panel as every other tool: stage label, elapsed clock,
            eased progress bar, waveform, cancel, expectation line. */}
        {isWorking && (
          <div
            className="space-y-3 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-primary">
                Pulling the audio from TikTok
              </span>
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

            <p className="text-xs text-text-subtle">
              Typically a few seconds. Keep this tab open.
            </p>
          </div>
        )}

        {/* ---------- Complete ---------- */}
        {isComplete && result && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">Ready</p>
              {/* Captions run long and carry emoji and hashtags - clamped
                  to two lines rather than truncated to one, since the
                  first line is often all hashtags and tells you nothing
                  about which sound this is. */}
              <p className="mt-1.5 line-clamp-2 text-sm font-medium text-text-primary">
                {result.title}
              </p>
              <p className="mt-1 font-mono text-[11px] text-text-subtle">
                MP3 · {formatBytes(result.size)}
                {/* duration is null on a cache hit, which is every repeat
                    request for the same video - so this line has to read
                    correctly with it missing, not just with it present. */}
                {result.duration !== null ? ` · ${formatElapsed(Math.round(result.duration))}` : ""}
              </p>
            </div>

            <AudioPlayer src={result.objectUrl} />

            <a
              href={result.objectUrl}
              download={result.filename}
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              <Download />
              Download MP3
            </a>

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw />
              Convert another
            </Button>
          </div>
        )}

        {/* ---------- Error ----------
            One message, straight from the backend. The retry button
            appears only when the backend says a retry can succeed:
            photo posts, deleted videos and region blocks fail the same
            way forever, and offering a retry there sends someone into a
            loop that cannot end well. */}
        {status === "error" && error && (
          <div className="space-y-4">
            <div
              className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <p className="text-sm text-text-primary">{error.message}</p>
            </div>
            <SupportBlock />
          </div>
        )}

        {/* ---------- Action ---------- */}
        {!isComplete && (
          <Button
            /* Outline on a dead end: the only useful move is to start
               over with another link, which is a secondary action, not
               the primary one. Amber here would put the loudest element
               on the card behind a button that can't succeed. */
            variant={isDeadEnd ? "outline" : looksValid ? "primary" : "secondary"}
            size="lg"
            className="w-full"
            onClick={isDeadEnd ? handleReset : handleConvert}
            disabled={isDeadEnd ? false : !canConvert && !isWorking}
            loading={isWorking}
          >
            {!isWorking && (isDeadEnd ? <RotateCcw /> : <Music2 />)}
            {isWorking
              ? "Converting"
              : cooldownSeconds > 0
                ? `Try again in ${cooldownSeconds}s`
                : isDeadEnd
                  ? "Try another link"
                  : status === "error"
                    ? "Try again"
                    : "Convert to MP3"}
          </Button>
        )}
      </div>
    </div>
  );
}