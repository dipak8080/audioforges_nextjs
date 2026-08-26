"use client";

import { useEffect, useState } from "react";
import { Download, Mic2, Drum, Guitar, Music2, AudioLines, Play, Sparkles, Bell, BellOff, Info } from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  submitYoutubeStems,
  getYoutubeStemsStatus,
  getYoutubeStemsPreviewUrl,
  getYoutubeStemsDownloadUrl,
  type SeparationQuality,
} from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { MeteredToolKey } from "@/lib/types/credits";

interface YouTubeStemFormProps {
  hqAvailable?: boolean;
}

interface QualitySpec {
  value: SeparationQuality;
  label: string;
  time: string;
  detail: string;
  /** Key into RATE_LIMITS (lib/data/rate-limits.ts) — NOT a hardcoded string. */
  rateLimitKey: string;
  /** Metered-tool key. Null on the free tier: nothing to meter, nothing to badge. */
  toolKey: MeteredToolKey | null;
}

// rateLimit strings are intentionally NOT hardcoded here — they're
// looked up from RATE_LIMITS via rateLimitKey below, so a backend limit
// change only needs updating in lib/data/rate-limits.ts.
const STANDARD_SPEC: QualitySpec = {
  value: "standard",
  label: "Standard",
  time: "30 sec–1 min",
  detail: "Vocals, drums, bass, other",
  rateLimitKey: "youtube/stems",
  toolKey: null,
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  time: "1–2 min",
  detail: "Cleaner separation, same 4 stems",
  rateLimitKey: "youtube/stems-hq",
  toolKey: "youtube/stems-hq",
};

// Fallback shown only if a key is ever missing from RATE_LIMITS (e.g.
// someone renames a key in rate-limits.ts without updating this file) —
// keeps the UI from rendering "undefined" instead of failing loudly in dev.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";

/**
 * The static table in lib/data/rate-limits.ts cannot be right for a
 * tiered limit — metered routes are 2/hour free and 30/hour credited, so
 * whichever number sits in the table lies to one of those groups.
 * /credits/me returns the limit that applies to THIS visitor, resolved
 * through the same code the limiter uses.
 */
function formatRateLimit(max: number, windowSeconds: number): string {
  const unit =
    windowSeconds >= 3600
      ? windowSeconds === 3600
        ? "hour"
        : `${Math.round(windowSeconds / 3600)} hr`
      : windowSeconds >= 60
        ? windowSeconds === 60
          ? "min"
          : `${Math.round(windowSeconds / 60)} min`
        : `${windowSeconds} sec`;
  return `${max} per ${unit}`;
}

// Stage timestamps (seconds elapsed) are proportional progress-indicator
// cues, rescaled to match the current GPU-era processing times above —
// NOT the backend timeout ceiling (see maxPollMs below, which intentionally
// stays much higher as a safety margin).
const STANDARD_STAGES = [
  { at: 0, label: "Downloading the audio" },
  { at: 5, label: "Analyzing frequencies" },
  { at: 10, label: "Isolating vocals" },
  { at: 20, label: "Isolating drums and bass" },
  { at: 35, label: "Rendering stems" },
];

const HQ_STAGES = [
  { at: 0, label: "Downloading the audio" },
  { at: 5, label: "Running the studio-quality model" },
  { at: 35, label: "Separating vocals" },
  { at: 75, label: "Separating drums and bass" },
  { at: 110, label: "Refining and rendering stems" },
];

function stemIcon(name: string) {
  const key = name.toLowerCase();
  if (key === "vocals") return <Mic2 className="h-4 w-4" />;
  if (key === "drums") return <Drum className="h-4 w-4" />;
  if (key === "bass" || key === "guitar") return <Guitar className="h-4 w-4" />;
  if (key === "other") return <Music2 className="h-4 w-4" />;
  return <AudioLines className="h-4 w-4" />;
}

function formatStemName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function StemsResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [stems, setStems] = useState<string[]>([]);
  const [activeStem, setActiveStem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getYoutubeStemsStatus(jobId);
        if (cancelled) return;
        setStems(result.outputs);
        setActiveStem(result.outputs[0] ?? null);
      } catch {
        if (!cancelled) setError("Could not load the stem list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) return <p className="text-sm text-red-500">{error}</p>;
  if (stems.length === 0) return <p className="text-sm text-text-muted">Loading stems…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-teal-400">
        <span className="font-medium">Done{title ? ` — ${title}` : ""}</span>
      </div>

      <div className="rounded-lg border border-graphite-700 divide-y divide-graphite-800">
        {stems.map((name) => {
          const isActive = activeStem === name;
          return (
            <div
              key={name}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 transition-colors",
                isActive ? "bg-amber-500/5" : "hover:bg-graphite-850/60"
              )}
            >
              <button
                type="button"
                onClick={() => setActiveStem(name)}
                className="flex flex-1 min-w-0 items-center gap-3 text-left"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-amber-500 text-graphite-950" : "bg-graphite-800 text-text-muted"
                  )}
                >
                  {isActive ? <Play className="h-3.5 w-3.5" fill="currentColor" /> : stemIcon(name)}
                </span>
                <span className={cn("truncate text-sm font-medium", isActive ? "text-amber-400" : "text-text-primary")}>
                  {formatStemName(name)}
                </span>
              </button>

                <a
                href={getYoutubeStemsDownloadUrl(jobId, name)}
                download
                onClick={(e) => e.stopPropagation()}
                aria-label={`Download ${formatStemName(name)}`}
                className="shrink-0 rounded-lg p-2 text-text-muted hover:bg-graphite-800 hover:text-amber-400 transition-colors"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          );
        })}
      </div>

      {activeStem && (
        <AudioPlayer key={activeStem} src={getYoutubeStemsPreviewUrl(jobId, activeStem)} />
      )}
    </div>
  );
}

export function YouTubeStemForm({ hqAvailable = false }: YouTubeStemFormProps) {
  const [quality, setQuality] = useState<SeparationQuality>("standard");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");

  const effectiveQuality: SeparationQuality = hqAvailable ? quality : "standard";
  const isHq = effectiveQuality === "hq";
  const spec = isHq ? HQ_SPEC : STANDARD_SPEC;

  // Looked up here (not hardcoded) so both the quality-picker cards and
  // the rate-limit-exceeded message below always agree with each other
  // and with lib/data/rate-limits.ts.
  const { rateLimitFor } = useCredits();

  const standardLimitLabel = getRateLimitLabel(STANDARD_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;
  const hqLimitLabel = getRateLimitLabel(HQ_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;

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
      endpoint="youtube/stems"
      onSubmit={(url) => submitYoutubeStems(url, effectiveQuality)}
      // Credits wiring. `meteredToolKey` reflects the CURRENT selection,
      // so it's null while Standard is chosen and the 429 offer stays out
      // of the free tier's way.
      meteredToolKey={isHq ? "youtube/stems-hq" : null}
      upgradeFamily="stems"
      pollIntervalMs={isHq ? 20_000 : 8_000}
      // Must cover the BACKEND's actual timeout ceiling
      // (DEMUCS_TIMEOUT_SECONDS_HQ=1800s / DEMUCS_TIMEOUT_SECONDS=600s in
      // config.py), not the typical-case time estimate shown in the UI.
      maxPollMs={isHq ? 32 * 60 * 1000 : 12 * 60 * 1000}
      toolLabel="Stem separator"
      toolMeta={`${spec.label} · From YouTube · ${spec.time}`}
      submitLabel={isHq ? "Split into stems (Studio Quality)" : "Split into stems"}
      processingLabel={isHq ? "Running studio quality stem separation" : "Downloading and splitting into stems…"}
      expectedRange={spec.time}
      stages={isHq ? HQ_STAGES : STANDARD_STAGES}
      rateLimitMessage={
        isHq
          ? `You've reached the studio quality limit (${hqLimitLabel}). Try again later.`
          : `You've reached the free limit (${standardLimitLabel}). Try again later.`
      }
      onComplete={() => notifyOnDone("Stems are ready", "Your separated tracks finished processing.")}
      onFailed={(message) => notifyOnDone("Stem separation failed", message || "The job didn't complete.")}
      renderControls={(disabled, hasUrl) => (
        <div className="space-y-5">
          {hqAvailable && (
            <fieldset className="space-y-2" disabled={disabled}>
              <legend className="mb-2 text-sm font-medium text-text-primary">Quality</legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Separation quality">
                {[STANDARD_SPEC, HQ_SPEC].map((option) => {
                  const selected = quality === option.value;
                  const liveLimit = option.toolKey ? rateLimitFor(option.toolKey) : null;
                  const rateLimitLabel = liveLimit
                    ? formatRateLimit(liveLimit.max_requests, liveLimit.window_seconds)
                    : (getRateLimitLabel(option.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL);
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
                          {/* Renders nothing unless this tool is metered right now. */}
                          {option.toolKey && <FreeTierBadge tool={option.toolKey} />}
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
                      <p className="mt-1 font-mono text-[10px] text-text-subtle">{rateLimitLabel}</p>
                    </button>
                  );
                })}
              </div>

              {isHq && (
                <p className="flex items-start gap-1.5 text-[11px] text-text-subtle">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  Studio Quality can take a minute or two, plus the download. Keep this tab open.
                </p>
              )}
            </fieldset>
          )}

          {notifyPermission !== "unsupported" && (
            <button
              type="button"
              onClick={handleNotifyToggle}
              disabled={disabled || !hasUrl}
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
      renderComplete={(jobId, title) => <StemsResult jobId={jobId} title={title} />}
    />
  );
}