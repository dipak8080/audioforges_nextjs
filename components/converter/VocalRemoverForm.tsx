"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic2, AlertTriangle, Download, Sparkles, Music4, Bell, BellOff, Info, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileDropZone } from "@/components/ui/FileDropZone";
import { Waveform } from "@/components/ui/Waveform";
import { validateAudioFile } from "@/lib/utils/validation";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitSeparation,
  getSeparationStatus,
  getSeparationPreviewUrl,
  getSeparationDownloadUrl,
  ApiError,
  type SeparationQuality,
} from "@/lib/api/railway";
import type { SeparationUiState, StemType } from "@/lib/types/converter";
import { SupportBlock } from "@/components/ui/SupportBlock";
import { cn } from "@/lib/utils/cn";

interface VocalRemoverFormProps {
  /**
   * Whether the HQ tier is currently available. Passed down from the
   * server-rendered page (see app/vocal-remover/page.tsx), which reads
   * this from the backend at request/cache time — NOT fetched client-side.
   * When false (the default), the toggle below simply never renders: no
   * disabled state, no tooltip, nothing in the DOM. This is the entire
   * mechanism for disabling HQ without it being noticeable — there is no
   * client-visible trace of the feature existing when this prop is false.
   */
  hqAvailable?: boolean;
}

interface QualitySpec {
  value: SeparationQuality;
  label: string;
  time: string;
  detail: string;
  rateLimit: string;
}

const STANDARD_SPEC: QualitySpec = {
  value: "standard",
  label: "Standard",
  time: "1–5 min",
  detail: "Vocals and instrumental",
  rateLimit: "2 per hour",
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  time: "10–20 min",
  detail: "Cleaner separation, same 2 stems",
  rateLimit: "1 per hour",
};

// Stage labels stretched across each tier's realistic duration — a flat
// "Separating…" for up to 20 minutes straight is the worst possible
// feedback for the single longest wait most people hit on this site.
const STANDARD_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 8, label: "Analyzing frequencies" },
  { at: 30, label: "Isolating vocals" },
  { at: 90, label: "Rendering vocals and instrumental" },
];

const HQ_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 15, label: "Running the studio-quality model" },
  { at: 180, label: "Isolating vocals" },
  { at: 600, label: "Refining and rendering both stems" },
];

const MAX_POLL_MS_STANDARD = 10 * 60 * 1000;
const MAX_POLL_MS_HQ = 25 * 60 * 1000;

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCooldown(seconds: number): string {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`;
  return `${seconds}s`;
}

function humanizeError(raw: string): { title: string; hint: string } {
  const text = raw.toLowerCase();
  if (text.includes("too large") || text.includes("size")) {
    return { title: "This file is too large", hint: "Trim it down or export at a smaller size." };
  }
  if (text.includes("expired")) {
    return { title: "This job expired", hint: "Upload the file again to re-run it." };
  }
  if (text.includes("network") || text.includes("timeout")) {
    return { title: "The connection dropped", hint: "Check your internet and run it again." };
  }
  return { title: raw || "Separation failed", hint: "Run it again. If it keeps failing, try a different file." };
}

export function VocalRemoverForm({ hqAvailable = false }: VocalRemoverFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<SeparationUiState>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; hint: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState<string | null>(null);
  const [activeStem, setActiveStem] = useState<StemType>("vocals");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Always starts at "standard" regardless of hqAvailable — a returning
  // visitor never lands on HQ by default, they have to actively pick it.
  const [quality, setQuality] = useState<SeparationQuality>("standard");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  const isBusy = status === "uploading" || status === "processing";
  const isFailed = status === "failed" || status === "error";
  const isHq = hqAvailable && quality === "hq";
  const spec = isHq ? HQ_SPEC : STANDARD_SPEC;
  const canSubmit = Boolean(file) && !isBusy && status !== "complete" && cooldownSeconds === 0;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!isBusy) return;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isBusy]);

  const notifyOnDone = (title: string, body: string) => {
    if (!notifyEnabled || notifyPermission !== "granted") return;
    if (typeof document !== "undefined" && !document.hidden) return;
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      // Some browsers restrict Notification() outside a service worker
      // context — silently skip rather than throw.
    }
  };

  const handleNotifyToggle = async () => {
    if (notifyPermission === "unsupported") return;
    if (notifyPermission === "default") {
      const result = await Notification.requestPermission();
      setNotifyPermission(result);
      if (result === "granted") setNotifyEnabled(true);
      return;
    }
    setNotifyEnabled((v) => !v);
  };

  /* --- polling: recursive timeout, capped, tier-aware interval ------ */
  const poll = useCallback(
    (id: string, forQuality: SeparationQuality) => {
      if (cancelledRef.current) return;

      const maxPollMs = forQuality === "hq" ? MAX_POLL_MS_HQ : MAX_POLL_MS_STANDARD;
      if (Date.now() - pollStartedAtRef.current > maxPollMs) {
        stopPolling();
        const humanized = { title: "This is taking unusually long", hint: "The job may be stuck. Upload the file again to start fresh." };
        setError(humanized);
        setStatus("failed");
        notifyOnDone("Separation failed", humanized.title);
        return;
      }

      getSeparationStatus(id)
        .then((result) => {
          if (cancelledRef.current) return;
          if (result.status === "complete") {
            stopPolling();
            setResultTitle(result.title);
            setStatus("complete");
            notifyOnDone("Vocals separated", "Your vocal and instrumental tracks are ready.");
            return;
          }
          if (result.status === "failed") {
            stopPolling();
            const humanized = humanizeError(result.error || "Separation failed.");
            setError(humanized);
            setStatus("failed");
            notifyOnDone("Separation failed", humanized.title);
            return;
          }
          const intervalMs = forQuality === "hq" ? 30_000 : 12_000;
          pollRef.current = setTimeout(() => poll(id, forQuality), intervalMs);
        })
        .catch((err) => {
          if (cancelledRef.current) return;
          if (err instanceof ApiError && err.status === 404) {
            stopPolling();
            const humanized = humanizeError("This job expired.");
            setError(humanized);
            setStatus("failed");
            notifyOnDone("Separation failed", humanized.title);
            return;
          }
          const intervalMs = forQuality === "hq" ? 30_000 : 12_000;
          pollRef.current = setTimeout(() => poll(id, forQuality), intervalMs);
        });
    },
    [stopPolling] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const startPolling = (id: string, forQuality: SeparationQuality) => {
    stopPolling();
    pollStartedAtRef.current = Date.now();
    poll(id, forQuality);
  };

  const handleFileSelect = (selectedFile: File) => {
    setValidationError(null);
    const validation = validateAudioFile(selectedFile);
    if (!validation.isValid) {
      setValidationError(validation.error || "That file can't be used here");
      return;
    }
    setFile(selectedFile);
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
  };

  const handleSubmit = async () => {
    if (!file) return;

    // Belt-and-braces: even if hqAvailable somehow became stale client-side
    // (e.g. flag flipped mid-session), never actually submit to the HQ
    // endpoint unless the prop says it's available.
    const effectiveQuality: SeparationQuality = hqAvailable ? quality : "standard";

    setStatus("uploading");
    setElapsedSeconds(0);
    setError(null);
    cancelledRef.current = false;

    try {
      const { job_id } = await submitSeparation(file, effectiveQuality);
      if (cancelledRef.current) return;
      setJobId(job_id);
      setStatus("processing");
      startPolling(job_id, effectiveQuality);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error("Separation submit error:", err);

      if (err instanceof ApiError && err.isRateLimit) {
        setError({
          title: effectiveQuality === "hq" ? "Studio quality limit reached" : "You've reached the free limit",
          hint:
            effectiveQuality === "hq"
              ? "1 studio-quality separation per hour. Try again later."
              : "2 separations per hour. Try again later.",
        });
        setCooldownSeconds(err.retryAfterSeconds ?? 3600);
      } else {
        setError(humanizeError(err instanceof ApiError ? err.message : "Something went wrong."));
      }
      setStatus("error");
    }
  };

  const handleReset = () => {
    stopPolling();
    cancelledRef.current = true;
    setFile(null);
    setStatus("idle");
    setValidationError(null);
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setActiveStem("vocals");
    setElapsedSeconds(0);
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    stopPolling();
    setStatus("idle");
    setError(null);
    setJobId(null);
    setResultTitle(null);
    setElapsedSeconds(0);
  };

  const stageLabel = (() => {
    const stages = isHq ? HQ_STAGES : STANDARD_STAGES;
    let label = stages[0].label;
    for (const s of stages) if (elapsedSeconds >= s.at) label = s.label;
    return label;
  })();
  const progress = Math.min(92, Math.round((1 - Math.exp(-elapsedSeconds / (isHq ? 200 : 25))) * 100));

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900">
      <div className="flex items-center justify-between border-b border-graphite-800 px-6 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className={cn("h-1.5 w-1.5 rounded-full bg-amber-500", isBusy && "animate-pulse motion-reduce:animate-none")} aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">Vocal remover</span>
        </div>
        <span className="font-mono text-[11px] text-text-subtle">{spec.label} · {spec.time}</span>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {status !== "complete" && (
          <FileDropZone
            onFileSelect={handleFileSelect}
            currentFile={file}
            onClear={handleReset}
            disabled={isBusy}
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          />
        )}

        {/*
          The entire block below only exists in the rendered tree when
          hqAvailable is true. When false, it's absent, not disabled.
        */}
        {hqAvailable && status !== "complete" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Quality</label>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Separation quality">
              {[STANDARD_SPEC, HQ_SPEC].map((option) => {
                const selected = quality === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setQuality(option.value)}
                    disabled={isBusy}
                    className={cn(
                      "rounded-lg border p-3.5 text-left transition-all",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      selected
                        ? "border-amber-500/60 bg-amber-500/[0.07]"
                        : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("flex items-center gap-1.5 text-sm font-semibold", selected ? "text-amber-400" : "text-text-primary")}>
                        {option.value === "hq" && <Sparkles className="h-3.5 w-3.5" />}
                        {option.label}
                      </span>
                      <span className={cn("font-mono text-[10px]", selected ? "text-amber-500/80" : "text-text-subtle")}>
                        {option.time}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-text-muted">{option.detail}</p>
                    <p className="mt-1 font-mono text-[10px] text-text-subtle">{option.rateLimit}</p>
                  </button>
                );
              })}
            </div>
            {isHq && (
              <p className="flex items-start gap-1.5 text-[11px] text-text-subtle">
                <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                Studio Quality can take up to 20 minutes — the notification below saves you from babysitting
                this tab.
              </p>
            )}
          </div>
        )}

        {notifyPermission !== "unsupported" && status !== "complete" && (
          <button
            type="button"
            onClick={handleNotifyToggle}
            disabled={isBusy || !file}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-40",
              notifyEnabled && notifyPermission === "granted"
                ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-graphite-700/60 hover:text-text-primary"
            )}
          >
            {notifyEnabled && notifyPermission === "granted" ? <Bell className="h-4 w-4 shrink-0" /> : <BellOff className="h-4 w-4 shrink-0" />}
            <span className="flex-1">
              {notifyPermission === "denied"
                ? "Notifications blocked — enable them in your browser settings to use this"
                : notifyEnabled && notifyPermission === "granted"
                  ? "We'll notify you when it's done"
                  : "Notify me when it's done"}
            </span>
          </button>
        )}

        {validationError && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <span className="text-sm text-text-primary">{validationError}</span>
          </div>
        )}

        {isBusy && (
          <div className="space-y-3 rounded-lg border border-graphite-800 bg-graphite-850/60 p-4" role="status" aria-live="polite" aria-busy="true">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-primary">
                {status === "uploading" ? "Uploading your file" : stageLabel}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">{formatElapsed(elapsedSeconds)}</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-graphite-800">
              <div className="h-full rounded-full bg-amber-500 transition-[width] duration-1000 ease-out" style={{ width: `${progress}%` }} />
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
            <p className="text-xs text-text-subtle">Typically {spec.time}. Keep this tab open, or use the notification above.</p>
          </div>
        )}

        {status === "complete" && jobId && (
          <div className="space-y-4" role="status" aria-live="polite">
            <div className="border-b border-graphite-800 pb-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">Done</p>
              <p className="mt-1.5 truncate text-sm font-medium text-text-primary">{resultTitle || "Separation complete"}</p>
            </div>

            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Stem">
              {(["vocals", "instrumental"] as StemType[]).map((stem) => {
                const selected = activeStem === stem;
                return (
                  <button
                    key={stem}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setActiveStem(stem)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                      selected
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                        : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                    )}
                  >
                    {stem === "vocals" ? <Mic2 className="h-4 w-4" /> : <Music4 className="h-4 w-4" />}
                    {stem}
                  </button>
                );
              })}
            </div>

            <AudioPlayer key={activeStem} src={getSeparationPreviewUrl(jobId, activeStem)} />

            <a
              href={getSeparationDownloadUrl(jobId, activeStem)}
              download
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-graphite-950 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
            >
              <Download className="h-4 w-4" />
              Download {activeStem}
            </a>

            <SupportBlock />

            <Button variant="outline" size="md" className="w-full" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Separate another track
            </Button>
          </div>
        )}

        {isFailed && error && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-4" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div>
                <p className="text-sm font-medium text-text-primary">{error.title}</p>
                <p className="mt-0.5 text-xs text-text-muted">{error.hint}</p>
              </div>
            </div>
            <SupportBlock />
          </div>
        )}

        {status !== "complete" && (
          <Button variant="primary" size="lg" className="w-full" onClick={handleSubmit} disabled={!canSubmit} loading={isBusy}>
            {!isBusy && <Mic2 className="h-5 w-5" />}
            {isBusy
              ? "Working"
              : cooldownSeconds > 0
                ? `Try again in ${formatCooldown(cooldownSeconds)}`
                : isFailed
                  ? "Try again"
                  : isHq
                    ? "Remove vocals (Studio Quality)"
                    : "Remove vocals"}
          </Button>
        )}
      </div>
    </div>
  );
}