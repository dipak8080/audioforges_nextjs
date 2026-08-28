"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Mic2,
  Drum,
  Guitar,
  Music2,
  AudioLines,
  Play,
  Sparkles,
  Bell,
  BellOff,
  Info,
} from "lucide-react";
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

/**
 * ── THIS PASS: FIVE FIXES ──────────────────────────────────────────────
 *
 * 1. THE UPGRADE'S POLL CEILING IS PASSED EXPLICITLY. An upgrade always
 *    produces an HQ job, but YouTubeUrlForm polled it against whatever
 *    `maxPollMs` the toggle was on — Standard, in practice, since nobody
 *    upgrades a job they already ran at HQ. That put a 12-minute frontend cap
 *    on a run the backend allows 30 minutes for, so a slow upgrade was
 *    declared stuck while it was still working. Four-stem HQ is the slowest
 *    job in the product, which makes this the file it was most likely to bite.
 *
 * 2. THE STEM LIST WAS INAUDIBLE TO SCREEN READERS. Which stem is selected was
 *    conveyed by amber text and a swapped icon and nothing else — no
 *    `aria-pressed`, no `aria-current`. A blind user could tab the list and
 *    never learn which one the player was playing.
 *
 * 3. A FAILED STEM-LIST FETCH WAS PERMANENT. `error` was never cleared when
 *    `jobId` changed, so if the first load failed, upgrading the job left the
 *    error on screen forever and the new stems never rendered.
 *
 * 4. THE NOTIFY TOGGLE HAD NO `aria-pressed`. The other two separation forms
 *    carry it with a comment explaining why; this one was missed, so a screen
 *    reader announced the same thing whether notifications were on or off.
 *
 * 5. THE QUALITY RADIOGROUP IS KEYBOARD-OPERABLE. A radiogroup is one tab stop
 *    with arrows between options — plain buttons inside one are worse than
 *    having used no role at all.
 */

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

// rateLimit strings are intentionally NOT hardcoded here — they're looked up
// from RATE_LIMITS via rateLimitKey below, so a backend limit change only needs
// updating in lib/data/rate-limits.ts.
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

// Fallback shown only if a key is ever missing from RATE_LIMITS (e.g. someone
// renames a key in rate-limits.ts without updating this file) — keeps the UI
// from rendering "undefined" instead of failing loudly in dev.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";

// Must cover the BACKEND's actual timeout ceiling (DEMUCS_TIMEOUT_SECONDS_HQ =
// 1800s / DEMUCS_TIMEOUT_SECONDS = 600s in config.py), not the typical-case
// estimate shown in the UI.
const MAX_POLL_MS_STANDARD = 12 * 60 * 1000;
const MAX_POLL_MS_HQ = 32 * 60 * 1000;
const POLL_INTERVAL_MS_STANDARD = 8_000;
const POLL_INTERVAL_MS_HQ = 20_000;

/**
 * The static table in lib/data/rate-limits.ts cannot be right for a tiered
 * limit — metered routes are 2/hour free and 30/hour credited, so whichever
 * number sits in the table lies to one of those groups. /credits/me returns the
 * limit that applies to THIS visitor, resolved through the same code the
 * limiter uses.
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

/**
 * A radiogroup is ONE tab stop with arrows between the options — that is what
 * the role promises and what assistive tech tells the user to expect.
 */
function useRovingRadio<T extends string>(
  values: readonly T[],
  current: T,
  onChange: (next: T) => void
) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent) {
    const i = values.indexOf(current);
    if (i < 0) return;
    let next: number;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (i + 1) % values.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (i - 1 + values.length) % values.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = values.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(values[next]);
    refs.current[next]?.focus();
  }

  return { refs, onKeyDown };
}

// Stage timestamps (seconds elapsed) are proportional progress cues, rescaled
// to match current GPU-era processing times — NOT the backend timeout ceiling.
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
  if (key === "vocals") return <Mic2 className="h-4 w-4" aria-hidden />;
  if (key === "drums") return <Drum className="h-4 w-4" aria-hidden />;
  if (key === "bass" || key === "guitar") return <Guitar className="h-4 w-4" aria-hidden />;
  if (key === "other") return <Music2 className="h-4 w-4" aria-hidden />;
  return <AudioLines className="h-4 w-4" aria-hidden />;
}

function formatStemName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function StemsResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [stems, setStems] = useState<string[]>([]);
  const [activeStem, setActiveStem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The component is keyed on jobId by its caller, so a new job mounts fresh
    // and there is no stale error to clear — which also keeps a synchronous
    // setState out of this effect body.
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

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (stems.length === 0) return <p className="text-sm text-text-muted">Loading stems…</p>;

  return (
    <div className="space-y-4">
      <div className="border-b border-graphite-800 pb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-400">Done</p>
        <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
          {title || "Stems ready"}
        </p>
      </div>

      <div
        role="group"
        aria-label="Stems"
        className="divide-y divide-graphite-800 overflow-hidden rounded-lg border border-graphite-700"
      >
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
                // The selected stem was signalled by amber text and a swapped
                // icon — both invisible to a screen reader. aria-pressed is
                // what makes "which one is playing" answerable without sight.
                aria-pressed={isActive}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-amber-500 text-graphite-950" : "bg-graphite-800 text-text-muted"
                  )}
                >
                  {isActive ? (
                    <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
                  ) : (
                    stemIcon(name)
                  )}
                </span>
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    isActive ? "text-amber-400" : "text-text-primary"
                  )}
                >
                  {formatStemName(name)}
                </span>
              </button>

              {/* Stays an <a> — a real download URL, so middle-click and
                  open-in-new-tab keep working. */}
              <a
                href={getYoutubeStemsDownloadUrl(jobId, name)}
                download
                aria-label={`Download ${formatStemName(name)}`}
                className="shrink-0 rounded-lg p-2 text-text-muted outline-none transition-colors hover:bg-graphite-800 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                <Download className="h-4 w-4" aria-hidden />
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
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  const effectiveQuality: SeparationQuality = hqAvailable ? quality : "standard";
  const isHq = effectiveQuality === "hq";
  const spec = isHq ? HQ_SPEC : STANDARD_SPEC;

  const { rateLimitFor } = useCredits();

  // Looked up here (not hardcoded) so both the quality-picker cards and the
  // rate-limit-exceeded message always agree with each other and with
  // lib/data/rate-limits.ts.
  const standardLimitLabel =
    getRateLimitLabel(STANDARD_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;
  const hqLimitLabel = getRateLimitLabel(HQ_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;

  const qualityRadio = useRovingRadio(
    ["standard", "hq"] as const,
    quality,
    (v) => setQuality(v)
  );

  /**
   * Read by notifyOnDone, which is handed to YouTubeUrlForm and called from
   * inside its polling loop. Refs make it correct by construction rather than
   * relying on the toggle being disabled mid-job.
   */
  const notifyEnabledRef = useRef(false);
  const notifyPermissionRef = useRef<NotificationPermission | "unsupported">("default");
  /*
    Synced in an EFFECT, not assigned during render. Writing to a ref while
    rendering is what react-hooks/refs rejects, and it stops being merely
    untidy the moment the React Compiler is enabled: a memoised render can be
    skipped, and the assignment with it. An effect with no dependency array
    runs after every render, so the value a callback reads is always the
    latest one.
  */
  useEffect(() => {
    notifyEnabledRef.current = notifyEnabled;
    notifyPermissionRef.current = notifyPermission;
  });

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
    if (!notifyEnabledRef.current || notifyPermissionRef.current !== "granted") return;
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
      // Credits wiring. `meteredToolKey` reflects the CURRENT selection, so it's
      // null while Standard is chosen and the 429 offer stays out of the free
      // tier's way.
      meteredToolKey={isHq ? "youtube/stems-hq" : null}
      upgradeFamily="stems"
      pollIntervalMs={isHq ? POLL_INTERVAL_MS_HQ : POLL_INTERVAL_MS_STANDARD}
      maxPollMs={isHq ? MAX_POLL_MS_HQ : MAX_POLL_MS_STANDARD}
      // An upgrade is ALWAYS to HQ and always starts from a Standard result, so
      // without these it inherits the 12-minute standard cap. Four-stem HQ is
      // the slowest job in the product — this is the file where that stale cap
      // was most likely to fail a run the backend was still working on.
      upgradePollIntervalMs={POLL_INTERVAL_MS_HQ}
      upgradeMaxPollMs={MAX_POLL_MS_HQ}
      toolLabel="Stem separator"
      toolMeta={`${spec.label} · From YouTube · ${spec.time}`}
      submitLabel={isHq ? "Split into stems (Studio Quality)" : "Split into stems"}
      processingLabel={
        isHq ? "Running studio quality stem separation" : "Downloading and splitting into stems"
      }
      expectedRange={spec.time}
      stages={isHq ? HQ_STAGES : STANDARD_STAGES}
      rateLimitMessage={
        isHq
          ? `You've reached the studio quality limit (${hqLimitLabel}). Try again later.`
          : `You've reached the free limit (${standardLimitLabel}). Try again later.`
      }
      onComplete={() =>
        notifyOnDone("Stems are ready", "Your separated tracks finished processing.")
      }
      onFailed={(message) =>
        notifyOnDone("Stem separation failed", message || "The job didn't complete.")
      }
      renderControls={(disabled, hasUrl) => (
        <div className="space-y-5">
          {hqAvailable && (
            <fieldset className="space-y-2" disabled={disabled}>
              <legend className="mb-2 text-sm font-medium text-text-primary">Quality</legend>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Separation quality"
                onKeyDown={qualityRadio.onKeyDown}
              >
                {[STANDARD_SPEC, HQ_SPEC].map((option, i) => {
                  const selected = quality === option.value;
                  const liveLimit = option.toolKey ? rateLimitFor(option.toolKey) : null;
                  const rateLimitLabel = liveLimit
                    ? formatRateLimit(liveLimit.max_requests, liveLimit.window_seconds)
                    : (getRateLimitLabel(option.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL);
                  return (
                    <button
                      key={option.value}
                      ref={(el) => {
                        qualityRadio.refs.current[i] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setQuality(option.value)}
                      disabled={disabled}
                      className={cn(
                        "rounded-lg border p-3.5 text-left transition-all",
                        "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
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
                          {option.value === "hq" && (
                            <Sparkles className="h-3.5 w-3.5" aria-hidden />
                          )}
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
                      <p className="mt-1 text-[11px] leading-snug text-text-muted">
                        {option.detail}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-text-subtle">
                        {rateLimitLabel}
                      </p>
                    </button>
                  );
                })}
              </div>

              {isHq && (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-subtle">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                  Studio Quality can take a minute or two, plus the download. Keep
                  this tab open.
                </p>
              )}
            </fieldset>
          )}

          {/*
            HIDDEN UNTIL THERE IS A LINK, not shown disabled. With an empty
            field this was a full-width greyed-out row that does nothing, and a
            disabled control is still a control the eye has to process and
            dismiss. Nothing to notify you about until there's a job.

            aria-pressed: it's a toggle, and without it a screen reader
            announces the same thing whether notifications are on or off.
          */}
          {notifyPermission !== "unsupported" && hasUrl && (
            <button
              type="button"
              onClick={handleNotifyToggle}
              disabled={disabled}
              aria-pressed={notifyEnabled && notifyPermission === "granted"}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                "disabled:pointer-events-none disabled:opacity-40",
                notifyEnabled && notifyPermission === "granted"
                  ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:border-graphite-700/60 hover:text-text-primary"
              )}
            >
              {notifyEnabled && notifyPermission === "granted" ? (
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <BellOff className="h-4 w-4 shrink-0" aria-hidden />
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
      renderComplete={(jobId, title) => <StemsResult key={jobId} jobId={jobId} title={title} />}
    />
  );
}