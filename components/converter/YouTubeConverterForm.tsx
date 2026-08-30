"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, AlertTriangle, CheckCircle2, ClipboardPaste, Link2, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  Section,
  WorkingPanel,
  easedProgress,
  formatCooldown,
  formatElapsed,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
  type ProcessingStage,
} from "@/components/tools/JobFormKit";
import { ControlField } from "@/components/converter/ToolControls";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { Waveform } from "@/components/ui/Waveform";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { cn } from "@/lib/utils/cn";
import { validateYouTubeUrl, sanitizeUserInput } from "@/lib/utils/validation";
import { getRateLimitLabel, getRetryAfterFallback } from "@/lib/data/rate-limits";
import {
  downloadYouTubeAudio,
  inlineDownloadUrl,
  resolveDownloadUrl,
  ApiError,
} from "@/lib/api/railway";
import { FORMAT_OPTIONS, type OutputFormat, type ProcessingState } from "@/lib/types/converter";
import { SupportBlock } from "@/components/ui/SupportBlock";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * The highest-traffic form on the site, so the bar is different: this isn't
 * about tidying, it's about the two things a first-time visitor hits.
 *
 * 1. A CLIENT-SIDE RATE LIMIT THAT ISN'T THE REAL ONE. `checkRateLimit(
 *    "youtube", 5, 60000)` refused a SIXTH conversion in a minute with "Slow
 *    down a moment" — a limit that exists nowhere on the backend. The real one
 *    is DOWNLOAD_RATE_LIMIT_MAX_REQUESTS: 18 per HOUR. So the two disagree in
 *    both directions: someone pasting six links in a minute (a playlist, by
 *    hand — the single most common power-user session on this page) was
 *    blocked by a rule the server would have allowed, while the rule that
 *    actually governs them was never mentioned.
 *
 *    It also protects nothing. It lives in the tab; a reload clears it. The
 *    server's limiter is what defends the proxy bill, and it's stricter in
 *    aggregate. Removed — see the note by the submit handler for the one-line
 *    revert if you'd rather keep it.
 *
 * 2. THE COOLDOWN PRINTED RAW SECONDS AND GUESSED THE WRONG NUMBER. On a 429
 *    with no Retry-After it fell back to 10 seconds against an hour-long
 *    window, so the button re-enabled almost immediately into another 429 —
 *    and the label read "Try again in 3600s" when the header WAS present.
 *    `getRetryAfterFallback("download")` and `formatCooldown` between them fix
 *    both halves.
 *
 * 3. IT USES THE SHELL. Step rail (Link → Convert → Download — and Download is
 *    a real step here, since nothing saves itself), hairline sections, the
 *    working panel with its stage checklist, and the primary action pinned to
 *    the footer instead of moving with the content.
 *
 * KEPT, deliberately, because the reasoning in the original is right: no
 * auto-download; the Saved / Not saved badge; `handleClearUrl` not touching
 * `result`; the neutral-until-parsed submit button; `loading` without
 * `disabled` so focus survives; `defaultFormat` so /youtube-to-mp3 doesn't
 * contradict its own H1.
 *
 * 4. IT NO LONGER HOLDS THE FILE IN MEMORY. This is the one that was killing
 *    phones, and it needed the backend change that shipped alongside it.
 *
 *    Before: the audio came back as base64 inside the JSON, held as a string
 *    AND as a decoded Blob. Forty minutes of WAV — the backend's own
 *    MAX_VIDEO_DURATION_SECONDS — is ~420MB of audio, so ~560MB of base64 on
 *    top, near a gigabyte peak for one conversion. iOS Safari kills a tab well
 *    before that, and the failure looks like a bounce rather than an error.
 *
 *    Now: `response=url` returns a signed link, served with FileResponse. The
 *    <a download> and the preview player both point at it, so the browser
 *    streams to disk and neither side holds the file. It also means resumable
 *    downloads (Range) and a real progress bar from the browser rather than
 *    the invented curve above.
 *
 *    THE TWO NEW FAILURE MODES THIS INTRODUCES, both handled below:
 *      · The link is signed for one hour. Convert, wander off, come back at
 *        90 minutes, press Download — that's a 403 on a file that used to be
 *        sitting in the tab forever. `expires_at` is checked first and the
 *        POST is silently repeated.
 *      · The file is served from the LRU cache, which can evict it between
 *        our POST and our GET. On a 404 we re-POST once and use the fresh
 *        link. Once only: a second 404 is a different problem.
 */

/** Single source of truth for format copy lives in FORMAT_OPTIONS. */
function formatOption(value: OutputFormat) {
  return FORMAT_OPTIONS.find((o) => o.value === value) ?? FORMAT_OPTIONS[0];
}

const RATE_LIMIT_LABEL = getRateLimitLabel("download");
const STEPS = ["Link", "Convert", "Download"] as const;

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

/** Strip only what a filesystem actually rejects. The old rule was
 *  `[^a-zA-Z0-9\s\-_]`, which erased every Devanagari, Cyrillic, CJK and
 *  accented character — a track titled entirely in one of those scripts
 *  came out as the empty string and fell through to "youtube-audio".
 *  Windows is the strictest target, so we match its reserved set. */
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

/**
 * Is the file still on the far end?
 *
 * A HEAD costs nothing and answers the eviction case — the cache can drop a
 * file between the POST that signed the link and the GET that asks for it.
 * Anything other than a clean 404 is treated as present: a network wobble here
 * must not send us into a needless re-conversion, and the download itself will
 * surface a real failure if there is one.
 */
/**
 * Is the signature still valid?
 *
 * The 30-second margin covers the gap between deciding and the request
 * actually leaving — checking `now < expiresAt` exactly would let a link that
 * dies mid-flight through.
 */
function isFresh(expiresAt: number, marginSeconds = 30): boolean {
  if (!expiresAt) return false;
  return Date.now() / 1000 < expiresAt - marginSeconds;
}

async function confirmPresent(href: string): Promise<boolean> {
  try {
    const res = await fetch(href, { method: "HEAD" });
    return res.status !== 404;
  } catch {
    return true;
  }
}

/** Pipeline stages, keyed to elapsed seconds. Labels describe what the
 *  backend is actually doing — no invented milestones. */
function stagesFor(format: OutputFormat): ProcessingStage[] {
  return [
    { at: 0, label: "Connecting to YouTube" },
    { at: 3, label: "Reading the video stream" },
    { at: 9, label: "Separating the audio track" },
    { at: 19, label: `Encoding to ${formatOption(format).label}` },
    { at: 34, label: "Transferring your file" },
  ];
}

/** Errors should say what happened and what to do next. */
function humanizeError(error: unknown): FormError {
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
      hint: RATE_LIMIT_LABEL
        ? `Downloads are limited to ${RATE_LIMIT_LABEL}. Wait for the timer and run it again.`
        : "The queue is busy. Wait a few seconds and run it again.",
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
  /** Absolute, signed, one-hour link. Not a Blob — see the header note. */
  href: string;
  filename: string;
  format: OutputFormat;
  /** Unix seconds. Checked before every download rather than discovered
   *  as a 403 halfway through one. */
  expiresAt: number;
  /** Omitted, not null, when the server couldn't stat the file. */
  sizeBytes?: number;
}

interface YouTubeConverterFormProps {
  /**
   * Which format the selector starts on.
   *
   * Added 2026-08-23 for /youtube-to-mp3. That page's H1 promises MP3, and
   * with the format hardcoded to "wav" the tool underneath it would have
   * opened on WAV — the page contradicting itself in the first thing the
   * visitor looks at.
   *
   * This is the INITIAL value only. The FormatSelector stays fully
   * interactive on both pages; someone who lands on /youtube-to-mp3 and
   * decides they want WAV can still switch, and vice versa.
   */
  defaultFormat?: OutputFormat;
}

export function YouTubeConverterForm({ defaultFormat = "wav" }: YouTubeConverterFormProps = {}) {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<OutputFormat>(defaultFormat);
  const [status, setStatus] = useState<ProcessingState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<FormError | null>(null);
  const [preview, setPreview] = useState<VideoPreview | null>(null);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [result, setResult] = useState<ConversionResult | null>(null);

  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const [hasDownloaded, setHasDownloaded] = useState(false);
  /** A silent re-POST is in flight because the link expired or was evicted. */
  const [refreshing, setRefreshing] = useState(false);

  const isProcessing = status === "processing";
  const isComplete = status === "complete" && result !== null;
  const isFailed = status === "error";

  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isProcessing);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  const cooldownCeilingRef = useRef(1);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const downloadSlotRef = useRef<HTMLDivElement>(null);

  const videoId = useMemo(() => extractVideoId(url.trim()), [url]);
  const canConvert = Boolean(videoId) && !validationError && cooldownSeconds === 0;
  const step: 1 | 2 | 3 = isComplete ? 3 : isProcessing ? 2 : 1;

  /* --- abort any in-flight request on unmount --------------------- */
  useEffect(() => () => abortRef.current?.abort(), []);

  /* No object URL to manage any more — the result IS a URL. The whole
     create/revoke/30-second-timer dance went with the Blob. */

  /* --- move focus to the download button when a run finishes ------
     The primary action changed out from under the user, so a keyboard
     or screen-reader user should land on it rather than hunt for it. */
  useEffect(() => {
    if (!isComplete) return;
    const id = window.setTimeout(() => {
      downloadSlotRef.current?.querySelector("button")?.focus();
    }, 80);
    return () => window.clearTimeout(id);
  }, [isComplete]);

  /* --- debounced validation + preview lookup ---------------------- */
  useEffect(() => {
    const trimmed = url.trim();

    if (!trimmed) {
      setValidationError(null);
      setPreview(null);
      return;
    }

    const controller = new AbortController();
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
      // the thumbnail alone is enough to confirm the right video. Aborted on
      // cleanup so a fast typist doesn't leave a queue of these resolving
      // out of order into the preview.
      fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
        { signal: controller.signal }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          setPreview((prev) =>
            prev?.id === id ? { id, title: data.title ?? null, author: data.author_name ?? null } : prev
          );
        })
        .catch(() => {});
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
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
      if (text) setUrl(sanitizeUserInput(text.trim(), 500));
    } catch {
      // Clipboard permission denied — the input is still there to type into.
    }
    inputRef.current?.focus();
  };

  /** Clears the link only. Used by the X inside the input. It must NOT
   *  touch `result`: nothing downloads automatically, so wiping the blob
   *  here would silently destroy a file the user hasn't saved. */
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

  /** Full reset — new track, discard the finished file.
   *
   *  Format returns to `defaultFormat`, not a hardcoded "wav": on
   *  /youtube-to-mp3 a reset that silently flipped the selector back to
   *  WAV would contradict the page a second time. */
  const handleReset = () => {
    setUrl("");
    setFormat(defaultFormat);
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setPreview(null);
    setResult(null);
    setPreviewDuration(null);
    setHasDownloaded(false);
    setRefreshing(false);
    setCooldownSeconds(0);
    setElapsedSeconds(0);
    inputRef.current?.focus();
  };

  /**
   * One POST, in url mode, mapped to a ConversionResult.
   *
   * Extracted because it now runs from two places: the Convert button, and the
   * silent re-POST when a link has expired or been evicted.
   */
  const runConversion = useCallback(
    async (signal: AbortSignal): Promise<ConversionResult> => {
      const check = validateYouTubeUrl(url.trim());
      const payload = await downloadYouTubeAudio(check.normalizedUrl || url.trim(), format, {
        signal,
        response: "url",
      });

      const href = resolveDownloadUrl(payload);
      if (!href) {
        // url mode asked for, base64 returned. Means the backend's flag was
        // rolled back under us — say so plainly rather than rendering a
        // broken player.
        throw new Error("The server didn't return a download link.");
      }

      const rawTitle =
        (payload.title as string) || (payload.filename as string) || preview?.title || "youtube-audio";

      return {
        href,
        filename: `${safeFilename(rawTitle)}.${format}`,
        format,
        expiresAt: typeof payload.expires_at === "number" ? payload.expires_at : 0,
        sizeBytes: typeof payload.size_bytes === "number" ? payload.size_bytes : undefined,
      };
    },
    [url, format, preview?.title]
  );

  const handleConvert = async () => {
    const trimmed = url.trim();
    const check = validateYouTubeUrl(trimmed);
    if (!check.isValid) {
      setValidationError(check.error || "That doesn't look like a YouTube link");
      return;
    }

    /*
      NO CLIENT-SIDE RATE LIMIT HERE ANY MORE.
      There used to be `checkRateLimit("youtube", 5, 60000)` — five per minute,
      a number that exists nowhere on the backend, which allows 18 per hour.
      Six links pasted in a minute is an ordinary session on this page and it
      was refused by a rule that protects nothing: it lives in the tab and a
      reload clears it. To restore it, put the call back at the top of this
      function.
    */

    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    setStatus("processing");
    setElapsedSeconds(0);
    setError(null);
    setResult(null);
    setPreviewDuration(null);
    setHasDownloaded(false);

    try {
      const next = await runConversion(controller.signal);
      if (cancelledRef.current) return;
      // No auto-download. The user saves it themselves, from a real click.
      setResult(next);
      setStatus("complete");
    } catch (err) {
      // A cancelled request rejects with a raw AbortError rather than an
      // ApiError, so this guard has to come before anything else — otherwise
      // pressing Cancel renders "The conversion failed".
      if (cancelledRef.current || controller.signal.aborted) return;
      console.error("Conversion error:", err);
      setError(humanizeError(err));
      setStatus("error");
      if (err instanceof ApiError && err.isRateLimit) {
        // Was 10 seconds against an hour-long window: the button re-enabled
        // almost immediately, straight into another 429.
        const seconds = err.retryAfterSeconds ?? getRetryAfterFallback("download");
        cooldownCeilingRef.current = Math.max(1, seconds);
        setCooldownSeconds(seconds);
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

  /** Starts the browser's own download from a real click. */
  const startDownload = (target: ConversionResult) => {
    const a = document.createElement("a");
    a.href = target.href;
    a.download = target.filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setHasDownloaded(true);
  };

  /**
   * TWO WAYS A LINK CAN BE DEAD, and neither existed while the file lived in
   * the tab:
   *
   *  · EXPIRED. The signature is good for an hour. Someone who converts,
   *    switches apps and comes back after lunch would otherwise get a 403 on
   *    a button that had been sitting there looking ready.
   *  · EVICTED. The file is served from the LRU cache, and at 20GB with
   *    420MB WAVs that's roughly 47 entries — under load it can be gone
   *    between our POST and our GET.
   *
   * Both are answered the same way: re-POST once and use the fresh link. The
   * expiry case is checked BEFORE the click does anything, because we can;
   * the eviction case can only be discovered by asking, so it's a HEAD.
   *
   * Once only. A second failure is not a stale link, it's something else, and
   * looping would just spend the user's rate limit on it.
   */
  const handleDownload = async () => {
    if (!result || refreshing) return;

    // Fresh and (as far as we know) present — the common path, no round trip.
    if (isFresh(result.expiresAt)) {
      const stillThere = await confirmPresent(result.href);
      if (stillThere) {
        startDownload(result);
        return;
      }
    }

    setRefreshing(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const next = await runConversion(controller.signal);
      setResult(next);
      startDownload(next);
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("Download refresh error:", err);
      setError({
        title: "That download link expired",
        hint: "We tried to refresh it and couldn't. Press Convert again to make a new one.",
      });
      setStatus("error");
    } finally {
      abortRef.current = null;
      setRefreshing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canConvert && !isProcessing) {
      e.preventDefault();
      handleConvert();
    }
  };

  const stages = stagesFor(format);
  let stageIndex = 0;
  for (let i = 0; i < stages.length; i += 1) {
    if (elapsedSeconds >= stages[i].at) stageIndex = i;
  }

  const resultThumbId = preview?.id ?? videoId;

  /* ------------------------------------------------------------------ */

  const footer = (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        {(status === "idle" || status === "error") && (
          /* Neutral until the link parses. A disabled amber fill at 40%
             opacity renders as a muddy brown bar — it reads as broken rather
             than inactive, and on an empty form it's the loudest thing on the
             card. Grey says "not yet"; amber is earned once there's a real
             video ID. */
          <Button
            variant={videoId || isFailed ? "primary" : "secondary"}
            size="lg"
            className="w-full sm:flex-1"
            onClick={handleConvert}
            disabled={!canConvert}
          >
            <Download />
            {cooldownSeconds > 0
              ? `Try again in ${formatCooldown(cooldownSeconds)}`
              : `Convert to ${formatOption(format).label}`}
          </Button>
        )}

        {isProcessing && (
          /* loading alone, not loading + disabled: disabled drops focus to
             <body>, so a keyboard user loses their place the moment the
             conversion starts. */
          <Button variant="outline" size="lg" className="w-full sm:flex-1" loading loadingLabel="Converting">
            Converting
          </Button>
        )}

        {isComplete && result && (
          <>
            {/* Wrapper exists so the completion effect can focus the button
                without <Button> having to forward a ref. */}
            <div ref={downloadSlotRef} className="w-full sm:flex-1">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                loading={refreshing}
                loadingLabel="Refreshing the link"
                onClick={() => void handleDownload()}
              >
                <Download />
                {hasDownloaded ? "Download again" : `Download ${formatOption(result.format).label}`}
              </Button>
            </div>
            <Button variant="outline" size="lg" onClick={handleReset}>
              <RotateCcw />
              Convert another
            </Button>
          </>
        )}
      </div>

      <CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeilingRef.current} />
    </div>
  );

  return (
    <FormShell
      toolLabel="YouTube to audio"
      toolMeta={formatOption(isComplete && result ? result.format : format).spec}
      steps={STEPS}
      step={step}
      busy={isProcessing}
      failed={isFailed}
      complete={isComplete}
      footer={footer}
    >
      {/* ---------- Link ----------
          Hidden on completion so the finished file is the only thing on the
          card, matching YouTubeUrlForm. */}
      {!isComplete && (
        <Section>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="youtube-url" className="text-sm font-medium text-text-primary">
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
                <p id="url-error" role="alert" className="flex items-center gap-1.5 text-sm text-red-400">
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
            {preview && !isProcessing && (
              <div className="flex items-center gap-4 rounded-xl border border-graphite-800 bg-graphite-850/60 p-3">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-graphite-800">
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
          </div>
        </Section>
      )}

      {/* ---------- Format ---------- */}
      {!isComplete && (
        <Section>
          <ControlField as="fieldset" label="Output format">
            <FormatSelector
              options={FORMAT_OPTIONS}
              value={format}
              onChange={setFormat}
              disabled={isProcessing}
            />
          </ControlField>
        </Section>
      )}

      {/* ---------- Working ---------- */}
      {isProcessing && (
        <Section>
          <WorkingPanel
            stageLabel={stages[stageIndex]?.label ?? "Converting"}
            stages={stages}
            stageIndex={stageIndex}
            showStageList
            elapsedSeconds={elapsedSeconds}
            progress={easedProgress(elapsedSeconds, 16)}
            expectedRange="under a minute for most videos"
            chargedRun={false}
            onCancel={handleCancel}
            waveform={<Waveform />}
          />
        </Section>
      )}

      {/* ---------- Complete ----------
          The file exists in the browser but nothing has left it yet, so the
          card's job is: confirm it's the right track, let them hear it, and
          make saving the obvious next move. */}
      {isComplete && result && (
        <Section>
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="overflow-hidden rounded-xl border border-teal-400/25 bg-teal-400/[0.07]">
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
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" aria-hidden />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-text-primary">{result.filename}</p>
                  {/* The size is gone: url mode never sends the bytes here, so
                      there is nothing to measure. Worth asking the backend for
                      a `size_bytes` field — it already knows — rather than
                      spending a HEAD on Content-Length just to print it. */}
                  <p className="mt-1 font-mono text-[11px] text-text-subtle">
                    {formatOption(result.format).spec}
                    {result.sizeBytes !== undefined ? ` · ${formatBytes(result.sizeBytes)}` : ""}
                    {previewDuration ? ` · ${formatElapsed(Math.round(previewDuration))}` : ""}
                  </p>
                </div>

                {/* One job: say whether this file is on their disk yet.
                    Without it, removing the auto-download leaves no signal
                    that the work isn't finished. */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                    hasDownloaded ? "bg-teal-400/15 text-teal-300" : "bg-amber-500/15 text-amber-400"
                  )}
                >
                  {hasDownloaded ? "Saved" : "Not saved"}
                </span>
              </div>

              {/* The shared player, not a bespoke scrubber — it already draws
                  the DAW envelope via WaveformCanvas and brings keyboard
                  seeking, volume, speed and a decode-failure fallback with it. */}
              {/* Same signed link, ?disposition=inline appended.
                  FileResponse(filename=...) sets Content-Disposition:
                  attachment, and the download button NEEDS that header — <a
                  download> is ignored cross-origin, so it's the only thing
                  making a click save rather than navigate. But an attachment
                  is not playable, so the player asks for the inline variant of
                  the same token. Range support is identical; only the header
                  differs. */}
              <div className="border-t border-teal-400/15 px-4 py-3">
                <AudioPlayer
                  src={inlineDownloadUrl(result.href)}
                  onDuration={setPreviewDuration}
                  className="border-0 bg-transparent p-0"
                />
              </div>
            </div>

            <SupportBlock />
          </div>
        </Section>
      )}

      {/* ---------- Error ---------- */}
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