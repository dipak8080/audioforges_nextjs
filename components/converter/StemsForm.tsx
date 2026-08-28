"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Bell, BellOff, Info } from "lucide-react";
import { MultiOutputToolForm } from "@/components/converter/MultiOutputToolForm";
import { submitStems, type SeparationQuality } from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { MeteredToolKey } from "@/lib/types/credits";

/**
 * ── THIS PASS: FOUR FIXES ──────────────────────────────────────────────
 *
 * 1. THE NOTIFY FLAGS ARE READ THROUGH REFS. `notifyOnDone` is handed to
 *    MultiOutputToolForm and called from inside its polling loop. Whether that
 *    sees the current values depends entirely on how that component builds its
 *    poll callback — in VocalRemoverForm the equivalent code captured the
 *    mount-time render and the notification never fired for anyone. Refs make
 *    it correct here regardless of what the parent does.
 *
 * 2. THE NOTIFY TOGGLE HAD NO `aria-pressed`. It's a toggle, and without it a
 *    screen reader announces the same thing whether notifications are on or
 *    off. The visible label changes; the accessible state didn't.
 *
 * 3. THE QUALITY RADIOGROUP IS KEYBOARD-OPERABLE. A radiogroup is one tab stop
 *    with arrows between options — that is what the role promises and what
 *    assistive tech tells the user to expect. Plain buttons inside one give a
 *    tab stop per option and no arrows, which is worse than using no role.
 *
 * 4. THE UPGRADE'S POLL CEILING IS PASSED EXPLICITLY. An upgrade is always to
 *    HQ, but MultiOutputToolForm polled it with whatever `maxPollMs` the
 *    quality toggle was on — Standard, since nobody upgrades a job they
 *    already ran at HQ. That put a 12-minute frontend cap on a run the backend
 *    allows 1800s for. Fixed in MultiOutputToolForm and wired here.
 */

interface StemsFormProps {
  hqAvailable?: boolean;
}

interface QualitySpec {
  value: SeparationQuality;
  label: string;
  time: string;
  detail: string;
  /** Key into RATE_LIMITS (lib/data/rate-limits.ts). */
  rateLimitKey: string;
  /** Metered-tool key. Null on the free tier: nothing to meter, nothing to badge. */
  toolKey: MeteredToolKey | null;
}

const STANDARD_SPEC: QualitySpec = {
  value: "standard",
  label: "Standard",
  time: "20 sec–1 min",
  detail: "Vocals, drums, bass, other",
  rateLimitKey: "stems",
  toolKey: null,
};

const HQ_SPEC: QualitySpec = {
  value: "hq",
  label: "Studio Quality",
  time: "1–2 min",
  detail: "Cleaner separation, same 4 stems",
  rateLimitKey: "stems-hq",
  toolKey: "stems-hq",
};

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
 * number is in the table lies to one of those groups. /credits/me returns the
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

// Stage timestamps rescaled to fit the corrected times above — previously ran
// to 80s (standard) and 280s (HQ), well beyond the current ~1 min and ~2 min
// estimates.
const STANDARD_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Analyzing frequencies" },
  { at: 10, label: "Isolating vocals" },
  { at: 20, label: "Isolating drums and bass" },
  { at: 40, label: "Rendering stems" },
];

const HQ_STAGES = [
  { at: 0, label: "Uploading and queuing" },
  { at: 5, label: "Running the studio-quality model" },
  { at: 30, label: "Separating vocals" },
  { at: 65, label: "Separating drums and bass" },
  { at: 95, label: "Refining and rendering stems" },
];

export function StemsForm({ hqAvailable = false }: StemsFormProps) {
  const [quality, setQuality] = useState<SeparationQuality>("standard");
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  const effectiveQuality: SeparationQuality = hqAvailable ? quality : "standard";
  const isHq = effectiveQuality === "hq";
  const spec = isHq ? HQ_SPEC : STANDARD_SPEC;

  const { rateLimitFor } = useCredits();

  const standardLimitLabel =
    getRateLimitLabel(STANDARD_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;
  const hqLimitLabel = getRateLimitLabel(HQ_SPEC.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL;

  const qualityRadio = useRovingRadio(
    ["standard", "hq"] as const,
    quality,
    (v) => setQuality(v)
  );

  /**
   * Read by notifyOnDone, which runs inside the parent's polling loop. Reading
   * the state values directly only works if that loop is rebuilt on every
   * render — an assumption this file has no way to verify and that has already
   * proved false elsewhere in the codebase.
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
    <MultiOutputToolForm
      endpoint="stems"
      queryParam="stem"
      onSubmit={(file) => submitStems(file, effectiveQuality)}
      // Credits wiring. `meteredToolKey` reflects the CURRENT selection, so it's
      // null while Standard is chosen and the 429 offer stays out of the free
      // tier's way.
      meteredToolKey={isHq ? "stems-hq" : null}
      upgradeFamily="stems"
      pollIntervalMs={isHq ? POLL_INTERVAL_MS_HQ : POLL_INTERVAL_MS_STANDARD}
      maxPollMs={isHq ? MAX_POLL_MS_HQ : MAX_POLL_MS_STANDARD}
      // An upgrade is ALWAYS to HQ and always starts from a Standard result, so
      // without these it inherits the 12-minute standard cap and gets declared
      // stuck at minute twelve of a run the backend allows thirty for.
      upgradePollIntervalMs={POLL_INTERVAL_MS_HQ}
      upgradeMaxPollMs={MAX_POLL_MS_HQ}
      toolLabel="Stem separator"
      toolMeta={`${spec.label} · ${spec.time}`}
      stages={isHq ? HQ_STAGES : STANDARD_STAGES}
      submitLabel={isHq ? "Split into stems (Studio Quality)" : "Split into stems"}
      processingLabel={
        isHq
          ? "Running studio quality stem separation"
          : "Separating vocals, drums, bass, and other"
      }
      expectedRange={`usually ${spec.time}`}
      resultVerb="Split"
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
      renderControls={(file, disabled) => (
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
                  Studio Quality can take a minute or two. Worth turning on the
                  notification below so you don&apos;t have to babysit this tab.
                </p>
              )}
            </fieldset>
          )}

          {/*
            HIDDEN UNTIL THERE IS A FILE, not shown disabled — the same rule
            MultiOutputToolForm already states on its submit button. With no
            file chosen this was a full-width greyed-out row that does nothing,
            and a disabled control is still a control the eye has to process
            and dismiss. Nothing to notify you about until there's a job.

            aria-pressed: it's a toggle, and without it a screen reader
            announces the same thing whether notifications are on or off.
          */}
          {notifyPermission !== "unsupported" && file && (
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
    />
  );
}