"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, AlertTriangle, ClipboardPaste, Link2, X, Music2, Wrench } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import {
  CooldownBar,
  ErrorPanel,
  easedProgress,
  formatCooldown,
  formatElapsed,
  useCooldownSeconds,
  useElapsedSeconds,
  type FormError,
} from "@/components/tools/JobFormKit";
import { StudioStage, type StageTier } from "@/components/tools/StudioStage";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";
import { sanitizeUserInput } from "@/lib/utils/validation";
import { getRetryAfterFallback, getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel } from "@/lib/data/tool-limits";
import { convertTikTokToMp3, base64ToBlob, isAbortError, ApiError, RAILWAY_API_BASE } from "@/lib/api/railway";

type UiState = "idle" | "working" | "complete" | "error";

const RATE_LIMIT_LABEL = getRateLimitLabel("tiktok-to-mp3");
const DURATION_LABEL = getDurationLabel("tiktok-to-mp3") ?? "10 minutes";

const TIERS: StageTier<"free">[] = [
  {
    value: "free",
    name: "Free",
    model: "MP3 · 44.1 kHz stereo",
    time: "a few seconds",
    footnote: RATE_LIMIT_LABEL ?? undefined,
  },
];

// Same deterministic strip the YouTube stage forms draw while busy.
const BUSY_BARS = Array.from({ length: 260 }, (_, i) => {
  const t = i / 260;
  const env = 0.45 + 0.55 * Math.pow(Math.sin(t * Math.PI), 0.5);
  const a = Math.abs(Math.sin(i * 1.93 + 0.7));
  const b = Math.abs(Math.cos(i * 0.71 + 2.1));
  const c = Math.abs(Math.sin(i * 0.13));
  return Math.max(0.05, env * (0.12 + (a * 0.45 + b * 0.35) * (0.5 + c * 0.5)));
});

interface ConversionResult {
  objectUrl: string;
  filename: string;
  title: string;
  /** Null on a cache hit - the backend cache stores audio and title only. */
  duration: number | null;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Host recognition only; the backend owns every real rejection.
function isLikelyTikTokUrl(input: string): boolean {
  const value = input.trim();
  if (!value || /\s/.test(value)) return false;
  return /^(https?:\/\/)?([\w-]+\.)*tiktok\.com\/\S+/i.test(value);
}

function buildFilename(title: string, id: string | null): string {
  const safe = (title || "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${safe || `tiktok-${id || "audio"}`}.mp3`;
}

// Sitewide pause switch, read once on mount. A flaky status check must
// never hide the tool, so any fetch problem reads as "not paused".
function useTikTokMaintenance(): string | null {
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${RAILWAY_API_BASE}/tiktok/status`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { maintenance?: boolean; message?: string | null } | null) => {
        if (data?.maintenance && data.message) setNotice(data.message);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return notice;
}

// Right pane of the idle stage. Facts only, nothing invented.
function TikTokAside() {
  const rows: Array<[string, string]> = [
    ["Output", "MP3, 44.1 kHz stereo"],
    ["Source", "Converted once from TikTok's own audio stream"],
    ["Length", `Sounds up to ${DURATION_LABEL}`],
    ["Free", "No account, nothing to install"],
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 px-5 py-6 sm:px-7">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-3">
          <span className="w-20 shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
            {label}
          </span>
          <span className="text-sm leading-snug text-text-primary">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function TikTokToMp3Form() {
  const [url, setUrl] = useState("");
  const maintenance = useTikTokMaintenance();
  const [status, setStatus] = useState<UiState>("idle");
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [showInvalid, setShowInvalid] = useState(false);

  const isWorking = status === "working";
  const isComplete = status === "complete";
  const isFailed = status === "error";

  const [elapsedSeconds, setElapsedSeconds] = useElapsedSeconds(isWorking);
  const [cooldownSeconds, setCooldownSeconds] = useCooldownSeconds();
  const [cooldownCeiling, setCooldownCeiling] = useState(getRetryAfterFallback("tiktok-to-mp3"));

  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // A failure the backend says cannot succeed on retry. A rate limit is
  // NOT one of these; the timer is the retry.
  const isDeadEnd = isFailed && Boolean(error) && !error?.retryable;
  const looksValid = useMemo(() => isLikelyTikTokUrl(url), [url]);
  const canConvert = looksValid && !isWorking && cooldownSeconds === 0 && !maintenance;

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

  // Debounced so the field doesn't flash red on every keystroke.
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
      if (text) setUrl(sanitizeUserInput(text.trim(), 2048));
    } catch {
      // Clipboard blocked - the field is still there to type into.
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
      if (cancelledRef.current || isAbortError(err) || controller.signal.aborted) return;
      console.error("tiktok-to-mp3 error:", err);

      if (err instanceof ApiError) {
        // Message and retry decision come from the backend. A 429 is
        // retryable by definition; the timer is the retry.
        setError({
          message: err.message,
          retryable:
            err.isRateLimit ||
            Boolean(err.retryable) ||
            err.isTimeout ||
            err.isServerBusy ||
            err.status === 0,
        });
        if (err.isRateLimit) {
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
        title: error.message,
        hint: error.retryable
          ? "Wait for the timer if there is one, then run it again."
          : "That link can't be converted. Try a different one.",
      }
    : null;

  const idle = (
    <div>
      <label htmlFor="tiktok-url" className="display block text-5xl text-text-primary sm:text-6xl">
        Paste a link
      </label>

      <div className="relative mt-5 flex items-center">
        <Link2
          className={cn(
            "pointer-events-none absolute left-4 h-4 w-4 transition-colors",
            looksValid ? "text-text-primary" : "text-text-subtle"
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
          disabled={isWorking || Boolean(maintenance)}
          autoComplete="off"
          spellCheck={false}
          maxLength={2048}
          aria-invalid={showInvalid}
          aria-describedby={showInvalid ? "tiktok-url-error" : "tiktok-url-hint"}
          className={cn(
            "w-full rounded-lg border bg-graphite-950/60 py-3.5 pl-11 pr-24 text-sm text-text-primary transition-colors placeholder:text-text-subtle focus:outline-none focus:ring-2 disabled:opacity-50",
            showInvalid
              ? "border-red-500/60 focus:ring-red-500/25"
              : "border-graphite-700 focus:border-text-primary/50 focus:ring-white/10"
          )}
        />
        <div className="absolute right-2.5 flex items-center gap-1">
          {url && !isWorking && (
            <button
              type="button"
              onClick={handleReset}
              aria-label="Clear link"
              className="rounded-md p-1.5 text-text-subtle outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {!url && (
            <button
              type="button"
              onClick={handlePaste}
              disabled={isWorking || Boolean(maintenance)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-muted outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:pointer-events-none disabled:opacity-60"
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
              Paste
            </button>
          )}
        </div>
      </div>

      {showInvalid ? (
        <p id="tiktok-url-error" role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          That doesn&apos;t look like a TikTok link
        </p>
      ) : (
        <p id="tiktok-url-hint" className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
          Share links · vt.tiktok.com · vm.tiktok.com
        </p>
      )}
    </div>
  );

  const busyView = (fraction: number) => (
    <div className="flex h-44 flex-col px-5 py-4 sm:h-52 sm:px-7 lg:h-56">
      <p className="truncate text-sm font-medium text-text-primary">Pulling the audio from TikTok</p>
      <div className="relative mt-3 min-h-0 flex-1" aria-hidden>
        <div className="absolute inset-0 flex items-center gap-px">
          {BUSY_BARS.map((h, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 transition-colors duration-700",
                i % 2 === 1 && "max-sm:hidden",
                i / BUSY_BARS.length < fraction ? "bg-amber-500" : "bg-graphite-600"
              )}
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
        <span
          className="absolute inset-y-0 w-px bg-amber-400 shadow-[0_0_12px_rgba(232,162,61,0.8)] transition-[left] duration-1000 ease-out motion-reduce:transition-none"
          style={{ left: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );

  const note = (
    <>
      {maintenance && !isComplete && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3"
        >
          <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">TikTok to MP3 is paused</p>
            <p className="mt-0.5 text-[13px] text-text-muted">{maintenance}</p>
          </div>
        </div>
      )}
      {isFailed && formError && (
        <div className="mt-4 space-y-4 first:mt-0">
          <ErrorPanel error={formError} />
          <SupportBlock mood="sheepish" />
        </div>
      )}
    </>
  );

  const resultNode =
    isComplete && result ? (
      <div className="space-y-4" role="status" aria-live="polite">
        <AudioPlayer src={result.objectUrl} />
        <a
          href={result.objectUrl}
          download={result.filename}
          className={buttonStyles({ variant: "primary", size: "lg", className: "w-full sm:w-auto sm:min-w-56" })}
        >
          <Download />
          Download MP3
        </a>
      </div>
    ) : undefined;

  return (
    <StudioStage
      label="TikTok to MP3"
      custom={{
        ready: looksValid,
        idle,
        busy: busyView,
        idleActionLabel: "Paste a link",
        onIdleAction: handlePaste,
      }}
      onClear={handleReset}
      tiers={TIERS}
      tier="free"
      onTierChange={() => {}}
      jobTier="free"
      aside={<TikTokAside />}
      busy={isWorking}
      failed={isFailed}
      progress={easedProgress(elapsedSeconds, 4)}
      stageLabel="Pulling the audio from TikTok"
      elapsed={formatElapsed(elapsedSeconds)}
      onCancel={handleCancel}
      actionLabel={
        cooldownSeconds > 0
          ? `Try again in ${formatCooldown(cooldownSeconds)}`
          : isDeadEnd
            ? "Try another link"
            : isFailed
              ? "Try again"
              : "Convert to MP3"
      }
      actionIcon={<Music2 />}
      actionDisabled={isDeadEnd ? false : !canConvert}
      onAction={isDeadEnd ? handleReset : handleConvert}
      belowAction={<CooldownBar seconds={cooldownSeconds} ceiling={cooldownCeiling} />}
      result={resultNode}
      doneTitle={result?.title}
      doneMeta={
        result
          ? `MP3 · ${formatBytes(result.size)}${
              result.duration !== null ? ` · ${formatElapsed(Math.round(result.duration))}` : ""
            }`
          : undefined
      }
      doneFooter={<SupportBlock variant="line" />}
      resetLabel="Convert another"
      labels={{ working: "Converting" }}
      note={note}
    />
  );
}