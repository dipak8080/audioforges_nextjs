"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Mic2, Music4, Sparkles, Bell, BellOff, Info } from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { buttonStyles } from "@/components/ui/Button";
import {
  submitYoutubeSeparate,
  getYoutubeSeparatePreviewUrl,
  getYoutubeSeparateDownloadUrl,
  type SeparationQuality,
} from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import type { StemType } from "@/lib/types/converter";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { MeteredToolKey } from "@/lib/types/credits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE UPGRADE'S POLL CEILING IS NOW PASSED EXPLICITLY. An upgrade always
 *    produces an HQ job, but YouTubeUrlForm previously polled it against
 *    whatever `maxPollMs` the quality toggle was on — Standard, in practice,
 *    since nobody upgrades a job they already ran at HQ. That is a 12-minute
 *    frontend cap on a run the backend allows 30 minutes for, so a slow
 *    upgrade was declared stuck while it was still working.
 *
 * 2. BOTH RADIOGROUPS ARE KEYBOARD-OPERABLE. `role="radiogroup"` with plain
 *    focusable buttons is a broken promise: a radiogroup is one tab stop with
 *    arrow keys between options, and assistive tech tells the user to expect
 *    exactly that.
 *
 * 3. THE NOTIFY FLAGS ARE READ THROUGH REFS. They happened to work here
 *    because the toggle is disabled while busy, so `notifyOnDone` could never
 *    be captured in its off state — but that is an accident of one disabled
 *    attribute, and the same code in VocalRemoverForm silently never fired.
 *    Refs make it correct by construction rather than by coincidence.
 */

interface YouTubeSeparateFormProps {
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
  detail: "Vocals and instrumental",
  rateLimitKey: "youtube/separate",
  toolKey: null,
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  time: "1–2 min",
  detail: "Cleaner separation, same 2 stems",
  rateLimitKey: "youtube/separate-hq",
  toolKey: "youtube/separate-hq",
};

// Fallback shown only if a key is ever missing from RATE_LIMITS (e.g. someone
// renames a key in rate-limits.ts without updating this file) — keeps the UI
// from rendering "undefined" instead of failing loudly in dev.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";

// Must cover the BACKEND's actual timeout ceiling (DEMUCS_TIMEOUT_SECONDS_HQ =
// 1800s / DEMUCS_TIMEOUT_SECONDS = 600s in config.py), not the typical-case
// estimate shown in the UI. A tighter frontend cap means the poll gives up and
// shows "stuck" on a job the backend is still correctly processing.
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
 * the role promises and what assistive tech tells the user to expect. Plain
 * buttons inside `role="radiogroup"` give a tab stop per option and no arrows,
 * which is worse than having used no role at all.
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
  { at: 15, label: "Isolating vocals" },
  { at: 40, label: "Rendering vocals and instrumental" },
];

const HQ_STAGES = [
  { at: 0, label: "Downloading the audio" },
  { at: 5, label: "Running the studio-quality model" },
  { at: 30, label: "Isolating vocals" },
  { at: 90, label: "Rendering vocals and instrumental" },
];

function SeparateResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [activeStem, setActiveStem] = useState<StemType>("vocals");
  const stemRadio = useRovingRadio(
    ["vocals", "instrumental"] as const,
    activeStem,
    (v) => setActiveStem(v)
  );

  return (
    <div className="space-y-4">
      <div className="border-b border-graphite-800 pb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal-400">Done</p>
        <p className="mt-1.5 truncate text-sm font-medium text-text-primary">
          {title || "Separation complete"}
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="Stem"
        onKeyDown={stemRadio.onKeyDown}
      >
        {(["vocals", "instrumental"] as StemType[]).map((stem, i) => {
          const selected = activeStem === stem;
          return (
            <button
              key={stem}
              ref={(el) => {
                stemRadio.refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveStem(stem)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors",
                "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                selected
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
              )}
            >
              {stem === "vocals" ? (
                <Mic2 className="h-4 w-4" aria-hidden />
              ) : (
                <Music4 className="h-4 w-4" aria-hidden />
              )}
              {stem}
            </button>
          );
        })}
      </div>

      <AudioPlayer key={activeStem} src={getYoutubeSeparatePreviewUrl(jobId, activeStem)} />

      {/* Stays an <a> — a real download URL, so middle-click and open-in-new-tab
          keep working. Borrows the Button styles rather than repeating them. */}
      <a
        href={getYoutubeSeparateDownloadUrl(jobId, activeStem)}
        download
        className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
      >
        <Download />
        Download {activeStem}
      </a>
    </div>
  );
}

export function YouTubeSeparateForm({ hqAvailable = false }: YouTubeSeparateFormProps) {
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
   * inside its polling loop. Reading the state values directly is only safe
   * while the toggle is disabled mid-job; refs make it correct regardless.
   */
  const notifyEnabledRef = useRef(false);
  const notifyPermissionRef = useRef<NotificationPermission | "unsupported">("default");
  notifyEnabledRef.current = notifyEnabled;
  notifyPermissionRef.current = notifyPermission;

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
      endpoint="youtube/separate"
      onSubmit={(url) => submitYoutubeSeparate(url, effectiveQuality)}
      // Credits wiring. `meteredToolKey` reflects the CURRENT selection, so it's
      // null while Standard is chosen and the 429 offer stays out of the free
      // tier's way.
      meteredToolKey={isHq ? "youtube/separate-hq" : null}
      upgradeFamily="separate"
      pollIntervalMs={isHq ? POLL_INTERVAL_MS_HQ : POLL_INTERVAL_MS_STANDARD}
      maxPollMs={isHq ? MAX_POLL_MS_HQ : MAX_POLL_MS_STANDARD}
      // An upgrade is ALWAYS to HQ, and it starts from a result the user got on
      // the Standard tier — so without these it would inherit the standard
      // 12-minute cap and be declared stuck at minute twelve of a run the
      // backend allows thirty for.
      upgradePollIntervalMs={POLL_INTERVAL_MS_HQ}
      upgradeMaxPollMs={MAX_POLL_MS_HQ}
      toolLabel="Vocal remover"
      toolMeta={`${spec.label} · From YouTube · ${spec.time}`}
      submitLabel={isHq ? "Remove vocals (Studio Quality)" : "Remove vocals"}
      processingLabel={
        isHq ? "Running studio quality vocal removal" : "Downloading and separating vocals"
      }
      expectedRange={spec.time}
      stages={isHq ? HQ_STAGES : STANDARD_STAGES}
      rateLimitMessage={
        isHq
          ? `You've reached the studio quality limit (${hqLimitLabel}). Try again later.`
          : `You've reached the free limit (${standardLimitLabel}). Try again later.`
      }
      onComplete={() =>
        notifyOnDone("Vocals separated", "Your vocal and instrumental tracks are ready.")
      }
      onFailed={(message) =>
        notifyOnDone("Separation failed", message || "The job didn't complete.")
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
      renderComplete={(jobId, title) => <SeparateResult jobId={jobId} title={title} />}
    />
  );
}