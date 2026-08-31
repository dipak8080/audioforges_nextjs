"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, AlertTriangle, ClipboardPaste, Link2, X, RotateCcw, Music2 } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import {
  CooldownBar,
  ErrorPanel,
  FormShell,
  ResultHeader,
  Section,
  WorkingPanel,
  easedProgress,
  formatCooldown,
  formatElapsed,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
} from "@/components/tools/JobFormKit";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { Waveform } from "@/components/ui/Waveform";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { sanitizeUserInput } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import { convertTikTokToMp3, base64ToBlob, isAbortError, ApiError } from "@/lib/api/railway";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. A RATE LIMIT SENT THE USER TO A DEAD END. `toTikTokError` sets
 *    `retryable: false` on the 429 — correct for its own purposes, since that
 *    path handles a plain-string detail from shared middleware and can't tell
 *    a permanent failure from a temporary one. But this form derives
 *    `isDeadEnd` from `!retryable`, so a rate limit flipped the button to "Try
 *    another link" and wired it to handleReset.
 *
 *    So: convert 31 times in an hour, get told to try a DIFFERENT LINK, press
 *    it, and your link is wiped — while the cooldown timer that would have let
 *    you retry the same one is still running underneath. The one failure on
 *    this page that is definitely temporary was the one presented as
 *    permanent.
 *
 *    A 429 is retryable by definition: the timer IS the retry. Folded into the
 *    retryable expression rather than special-cased at the render site, so
 *    every consumer of that flag agrees.
 *
 * 2. THE COOLDOWN GUESSED 60 SECONDS AND PRINTED RAW SECONDS. /tiktok-to-mp3
 *    runs on a 30-per-HOUR window, so a 429 with no Retry-After re-enabled the
 *    button in a minute — straight into another 429. And when the header WAS
 *    present the label read "Try again in 3600s". getRetryAfterFallback and
 *    formatCooldown, as everywhere else.
 *
 * 3. CANCEL NOW ACTUALLY CANCELS. convertTikTokToMp3 takes a signal and was
 *    never given one, so Cancel stopped the UI waiting while the request ran
 *    on — up to 95 seconds of held connection for a result nobody would read.
 *    Also aborts on unmount.
 *
 * 4. IT USES THE SHELL — step rail, working panel, result header, error panel,
 *    cooldown bar.
 *
 * NOT A BUG, though I thought it was: the object-URL lifecycle is already
 * correct. handleConvert releases the previous URL before starting, the
 * cancelled-guard sits BEFORE the blob is created so a cancelled run never
 * makes one, and the unmount effect releases whatever is live. Nothing leaks.
 */

type UiState = "idle" | "working" | "complete" | "error";

const STEPS = ["Link", "Convert", "Download"] as const;

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
  const [showInvalid, setShowInvalid] = useState(false);

  const isWorking = status === "working";
  const isComplete = status === "complete";
  const isFailed = status === "error";

  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isWorking);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  /**
   * STATE, NOT A REF, because CooldownBar renders it. As a ref it only showed
   * the right ceiling because the setCooldownSeconds call on the next line
   * happened to trigger the render that read it.
   */
  const [cooldownCeiling, setCooldownCeiling] = useState(getRetryAfterFallback("tiktok-to-mp3"));

  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * A failure the backend says cannot succeed on retry - a photo post, a
   * deleted video, a region block. The action has to CHANGE, not just be
   * relabelled: pressing convert again on the same link reproduces the
   * same error, so this clears the field and hands focus back instead.
   *
   * A RATE LIMIT IS NOT ONE OF THESE. See the note on `retryable` in the catch
   * below — it used to land here and tell a rate-limited user to try a
   * different link.
   */
  const isDeadEnd = isFailed && Boolean(error) && !error?.retryable;
  const looksValid = useMemo(() => isLikelyTikTokUrl(url), [url]);
  const canConvert = looksValid && !isWorking && cooldownSeconds === 0;
  const step: 1 | 2 | 3 = isComplete ? 3 : isWorking ? 2 : 1;

  /* --- one object URL alive at a time, revoked on replace/unmount ---
     A 1 MB blob per conversion adds up fast on a page where someone
     grabs several sounds in a row. */
  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      releaseObjectUrl();
      abortRef.current?.abort();
    },
    [releaseObjectUrl]
  );

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

  const handleCancel = () => {
    /* Now a real abort, not just a flag. convertTikTokToMp3 takes a signal and
       was never given one, so Cancel used to stop the UI waiting while the
       request kept running — up to 95 seconds of held connection for a result
       nobody would ever read. */
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setError(null);
    setElapsedSeconds(0);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(sanitizeUserInput(e.target.value, 2048));
    if (isFailed) {
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
    abortRef.current?.abort();
    abortRef.current = null;
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
    const controller = new AbortController();
    abortRef.current = controller;
    cancelledRef.current = false;

    setStatus("working");
    setElapsedSeconds(0);
    setError(null);
    setResult(null);

    try {
      const data = await convertTikTokToMp3(trimmed, { signal: controller.signal });
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
      // A cancelled request rejects with a raw AbortError, not an ApiError.
      if (cancelledRef.current || isAbortError(err) || controller.signal.aborted) return;
      console.error("tiktok-to-mp3 error:", err);

      if (err instanceof ApiError) {
        // The message and the retry decision both come from the backend.
        // No rewriting, no prefixing, and no local opinion about which
        // failures are worth retrying - seven of the ten failure kinds
        // fail identically forever, and a retry button on those is worse
        // than no button at all.
        //
        // WITH ONE EXCEPTION, and it's the reason this line changed: a 429
        // arrives through toTikTokError's plain-string branch, which sets
        // `retryable: false` because it can't tell a permanent failure from a
        // temporary one. That flag drives `isDeadEnd`, so a rate limit
        // relabelled the button "Try another link" and wired it to a reset —
        // wiping the user's link while the cooldown that would have let them
        // retry it ticked down underneath. A 429 is retryable by definition;
        // the timer IS the retry.
        setError({
          message: err.message,
          retryable:
            err.isRateLimit || Boolean(err.retryable) || err.isTimeout || err.isServerBusy,
        });
        if (err.isRateLimit) {
          // 30 per HOUR, not the flat 60 seconds this used to guess.
          const wait = err.retryAfterSeconds ?? getRetryAfterFallback("tiktok-to-mp3");
          setCooldownCeiling(Math.max(1, wait));
          setCooldownSeconds(wait);
        }
      } else {
        setError({ message: "Something went wrong. Please try again.", retryable: true });
      }
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canConvert) {
      e.preventDefault();
      void handleConvert();
    }
  };

  const formError: FormError | null = error
    ? {
        // Straight from the backend — it writes these for the end user and they
        // carry the specifics. The hint is ours and must not contradict it.
        title: error.message,
        hint: error.retryable
          ? "Wait for the timer if there is one, then run it again."
          : "That link can't be converted. Try a different one.",
      }
    : null;

  const footer = isComplete ? (
    <Button variant="outline" size="lg" className="w-full" onClick={handleReset}>
      <RotateCcw />
      Convert another
    </Button>
  ) : (
    <div className="space-y-2">
      <Button
        /* Outline on a dead end: the only useful move is to start over with
           another link, which is a secondary action, not the primary one.
           Amber here would put the loudest element on the card behind a button
           that can't succeed. */
        variant={isDeadEnd ? "outline" : looksValid ? "primary" : "secondary"}
        size="lg"
        className="w-full"
        onClick={isDeadEnd ? handleReset : handleConvert}
        disabled={isDeadEnd ? false : !canConvert && !isWorking}
        loading={isWorking}
        loadingLabel="Converting"
      >
        {!isWorking && (isDeadEnd ? <RotateCcw /> : <Music2 />)}
        {isWorking
          ? "Converting"
          : cooldownSeconds > 0
            ? `Try again in ${formatCooldown(cooldownSeconds)}`
            : isDeadEnd
              ? "Try another link"
              : isFailed
                ? "Try again"
                : "Convert to MP3"}
      </Button>
      <CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeiling} />
    </div>
  );

  return (
    <FormShell
      toolLabel="TikTok to MP3"
      /* Format facts, not a quality claim. No bitrate number here on purpose:
         TikTok's source audio is ~64 kbps AAC, so any figure we print invites a
         comparison we'd lose to competitors happily printing "320 kbps" over
         the same source. */
      toolMeta="MP3 · 44.1 kHz stereo"
      steps={STEPS}
      step={step}
      busy={isWorking}
      failed={isFailed}
      complete={isComplete}
      footer={footer}
    >
      {/* SOURCE */}
      {!isComplete && (
        <Section>
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
                  "w-full rounded-xl border bg-graphite-850 py-3.5 pl-11 pr-24 text-text-primary",
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
                    className="rounded-md p-1.5 text-text-subtle outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-500/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {!url && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    disabled={isWorking}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:pointer-events-none disabled:opacity-60"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
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
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                That doesn&apos;t look like a TikTok link
              </p>
            ) : (
              <p id="tiktok-url-hint" className="text-xs text-text-subtle">
                Works with the app&apos;s Share link, vt.tiktok.com and vm.tiktok.com
              </p>
            )}
          </div>
        </Section>
      )}

      {/* WORKING */}
      {isWorking && (
        <Section>
          <WorkingPanel
            stageLabel="Pulling the audio from TikTok"
            stageIndex={-1}
            showStageList={false}
            elapsedSeconds={elapsedSeconds}
            /* Shorter time constant than the job tools: this is a 2–8 second
               conversion, not a 20-second one. */
            progress={easedProgress(elapsedSeconds, 4)}
            expectedRange="a few seconds"
            chargedRun={false}
            onCancel={handleCancel}
            waveform={<Waveform />}
          />
        </Section>
      )}

      {/* COMPLETE */}
      {isComplete && result && (
        <Section>
          <div className="space-y-4" role="status" aria-live="polite">
            {/* Captions run long and carry emoji and hashtags. ResultHeader
                truncates to one line; the meta carries the facts. */}
            <ResultHeader
              verb="Ready"
              title={result.title}
              meta={`MP3 · ${formatBytes(result.size)}${
                /* duration is null on a cache hit, which is every repeat
                   request for the same video — so this line has to read
                   correctly with it missing, not just with it present. */
                result.duration !== null ? ` · ${formatElapsed(Math.round(result.duration))}` : ""
              }`}
            />

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
          </div>
        </Section>
      )}

      {/* FAILED */}
      {isFailed && formError && (
        <Section>
          <div className="space-y-4">
            <ErrorPanel error={formError} />
            <SupportBlock />
          </div>
        </Section>
      )}
    </FormShell>
  );
}