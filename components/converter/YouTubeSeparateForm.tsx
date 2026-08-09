"use client";

import { useEffect, useState } from "react";
import { Download, Mic2, Music4, Sparkles, Bell, BellOff, Info } from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitYoutubeSeparate,
  getYoutubeSeparatePreviewUrl,
  getYoutubeSeparateDownloadUrl,
  type SeparationQuality,
} from "@/lib/api/railway";
import type { StemType } from "@/lib/types/converter";
import { cn } from "@/lib/utils/cn";

interface YouTubeSeparateFormProps {
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
  time: "1–3 min",
  detail: "Vocals and instrumental",
  rateLimit: "3 per hour",
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  time: "4–7 min",
  detail: "Cleaner separation, same 2 stems",
  rateLimit: "1 per hour",
};

const STANDARD_STAGES = [
  { at: 0, label: "Downloading the audio" },
  { at: 10, label: "Analyzing frequencies" },
  { at: 30, label: "Isolating vocals" },
  { at: 80, label: "Rendering vocals and instrumental" },
];

const HQ_STAGES = [
  { at: 0, label: "Downloading the audio" },
  { at: 15, label: "Running the studio-quality model" },
  { at: 120, label: "Isolating vocals" },
  { at: 300, label: "Rendering vocals and instrumental" },
];

function SeparateResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [activeStem, setActiveStem] = useState<StemType>("vocals");

  return (
    <div className="space-y-4">
      <div className="border-b border-graphite-800 pb-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-teal-400">Done</p>
        <p className="mt-1.5 truncate text-sm font-medium text-text-primary">{title || "Separation complete"}</p>
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

      <AudioPlayer key={activeStem} src={getYoutubeSeparatePreviewUrl(jobId, activeStem)} />

      <a
        href={getYoutubeSeparateDownloadUrl(jobId, activeStem)}
        download
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 py-3 font-medium text-graphite-950 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
      >
        <Download className="h-4 w-4" />
        Download {activeStem}
      </a>
    </div>
  );
}

export function YouTubeSeparateForm({ hqAvailable = false }: YouTubeSeparateFormProps) {
  const [quality, setQuality] = useState<SeparationQuality>("standard");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");

  const effectiveQuality: SeparationQuality = hqAvailable ? quality : "standard";
  const isHq = effectiveQuality === "hq";
  const spec = isHq ? HQ_SPEC : STANDARD_SPEC;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

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

  return (
    <YouTubeUrlForm
      endpoint="youtube/separate"
      onSubmit={(url) => submitYoutubeSeparate(url, effectiveQuality)}
      pollIntervalMs={isHq ? 20_000 : 8_000}
      maxPollMs={isHq ? 10 * 60 * 1000 : 5 * 60 * 1000}
      toolLabel="Vocal remover"
      toolMeta={`${spec.label} · From YouTube · ${spec.time}`}
      submitLabel={isHq ? "Remove vocals (Studio Quality)" : "Remove vocals"}
      processingLabel={isHq ? "Running studio quality vocal removal" : "Downloading and separating vocals"}
      expectedRange={spec.time}
      stages={isHq ? HQ_STAGES : STANDARD_STAGES}
      rateLimitMessage={
        isHq
          ? "You've reached the studio quality limit (1 per hour). Try again later."
          : "You've reached the free limit (3 separations per hour). Try again later."
      }
      onComplete={() => notifyOnDone("Vocals separated", "Your vocal and instrumental tracks are ready.")}
      onFailed={(message) => notifyOnDone("Separation failed", message || "The job didn't complete.")}
      renderControls={(videoId, disabled) => (
        <div className="space-y-5">
          {hqAvailable && (
            <fieldset className="space-y-2" disabled={disabled}>
              <legend className="mb-2 text-sm font-medium text-text-primary">Quality</legend>
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
                      disabled={disabled}
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
                        <span
                          className={cn(
                            "flex items-center gap-1.5 text-sm font-semibold",
                            selected ? "text-amber-400" : "text-text-primary"
                          )}
                        >
                          {option.value === "hq" && <Sparkles className="h-3.5 w-3.5" />}
                          {option.label}
                        </span>
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            selected ? "text-amber-500/80" : "text-text-subtle"
                          )}
                        >
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
                  Studio Quality can take a few minutes, plus the download. Keep this tab open.
                </p>
              )}
            </fieldset>
          )}

          {notifyPermission !== "unsupported" && (
            <button
              type="button"
              onClick={handleNotifyToggle}
              disabled={disabled || !videoId}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-40",
                notifyEnabled && notifyPermission === "granted"
                  ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-graphite-700/60 hover:text-text-primary"
              )}
            >
              {notifyEnabled && notifyPermission === "granted" ? (
                <Bell className="h-4 w-4 shrink-0" />
              ) : (
                <BellOff className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">
                {notifyPermission === "denied"
                  ? "Notifications blocked — enable them in your browser settings to use this"
                  : notifyEnabled && notifyPermission === "granted"
                    ? "We'll notify you when it's done"
                    : "Notify me when it's done"}
              </span>
            </button>
          )}
        </div>
      )}
      renderComplete={(jobId, title) => <SeparateResult jobId={jobId} title={title} />}
    />
  );
}