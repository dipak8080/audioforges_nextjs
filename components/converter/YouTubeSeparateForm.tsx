"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Mic2, Music4, Sparkles, Bell, BellOff } from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { buttonStyles } from "@/components/ui/Button";
import {
  ControlField,
  Hint,
  OptionCards,
  Segmented,
  ToggleRow,
  type CardOption,
} from "@/components/converter/ToolControls";
import {
  submitYoutubeSeparate,
  getYoutubeSeparatePreviewUrl,
  getYoutubeSeparateDownloadUrl,
  type SeparationQuality,
} from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import type { StemType } from "@/lib/types/converter";
import { useCredits } from "@/components/credits/CreditProvider";
import { AlwaysFreeTag, FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { MeteredToolKey } from "@/lib/types/credits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE RESULT RENDERED ITS HEADER TWICE. YouTubeUrlForm draws a ResultHeader
 *    — "DONE", the track title, the thumbnail, the elapsed time — and THEN
 *    calls renderComplete. This component's renderComplete opened with its own
 *    "Done" eyebrow and title, so a finished job showed the same two lines
 *    stacked, once in the kit's teal card and once in a bordered block
 *    underneath. It's the seam from when YouTubeUrlForm moved onto the kit and
 *    its consumers didn't. Local header deleted; the kit's is the one with the
 *    thumbnail and the Studio Quality tag on it.
 *
 * 2. THE PROGRESS BAR FROZE ON STUDIO QUALITY RUNS. YouTubeUrlForm's curve was
 *    fixed at a 20-second time constant, so it reached ~92% about a minute in
 *    and then stopped — for the remaining minute of a typical HQ job, and for
 *    however long a slow one takes. A bar that stops moving reads as a hung
 *    job. `progressTau` now matches the tier.
 *
 * 3. useRovingRadio IS GONE. It was correct, and it was the third hand-rolled
 *    copy of the same keyboard behaviour; OptionCards and Segmented carry it
 *    now. Both pickers here were declaring `role="radiogroup"` — one tab stop,
 *    arrows between options — over plain buttons that delivered neither.
 *
 * KEPT: the notify flags through refs (correct by construction rather than by
 * the accident of one disabled attribute); the explicit upgrade poll ceilings,
 * without which an upgrade inherits the Standard tier's 12-minute cap on a run
 * the backend allows thirty for; rate-limit labels read from RATE_LIMITS and
 * overridden by the live per-visitor limit.
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
 * Time constants for the progress curve, in seconds — near each tier's TYPICAL
 * duration, not its ceiling. The old fixed 20 put the bar at ~92% one minute
 * in and left it there for the rest of an HQ run.
 */
const PROGRESS_TAU_STANDARD = 40;
const PROGRESS_TAU_HQ = 90;

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

const STEM_OPTIONS = [
  { value: "vocals" as const, label: "Vocals", icon: <Mic2 className="h-4 w-4" aria-hidden /> },
  {
    value: "instrumental" as const,
    label: "Instrumental",
    icon: <Music4 className="h-4 w-4" aria-hidden />,
  },
];

/**
 * Only what sits BELOW the kit's result header: the stem switch, the player and
 * the download. The header itself — verb, title, thumbnail, elapsed time,
 * Studio Quality tag — is YouTubeUrlForm's, and this used to draw a second one.
 */
function SeparateResult({ jobId }: { jobId: string }) {
  const [activeStem, setActiveStem] = useState<StemType>("vocals");

  return (
    <div className="space-y-4">
      <Segmented
        label="Stem"
        value={activeStem}
        onChange={setActiveStem}
        options={STEM_OPTIONS}
      />

      {/* Keyed per stem so the player remounts on a new source. The envelope
          cache in waveform.ts means switching back and forth no longer
          re-decodes the file each time. */}
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

  /**
   * Read by notifyOnDone, which is handed to YouTubeUrlForm and called from
   * inside its polling loop. Reading the state values directly is only safe
   * while the toggle is disabled mid-job; refs make it correct regardless.
   */
  const notifyEnabledRef = useRef(false);
  const notifyPermissionRef = useRef<NotificationPermission | "unsupported">("default");
  /*
    Synced in an EFFECT, not assigned during render. Writing to a ref while
    rendering is what react-hooks/refs rejects, and it stops being merely
    untidy the moment the React Compiler is enabled: a memoised render can be
    skipped, and the assignment with it.
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

  const notifyOn = notifyEnabled && notifyPermission === "granted";

  const qualityOptions: CardOption<SeparationQuality>[] = [STANDARD_SPEC, HQ_SPEC].map(
    (option) => {
      const liveLimit = option.toolKey ? rateLimitFor(option.toolKey) : null;
      return {
        value: option.value,
        title: option.label,
        titleBefore:
          option.value === "hq" ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : undefined,
        // Renders nothing unless this tool is metered right now.
        // Both cards carry a cost marker or neither does. AlwaysFreeTag reads
        // the METERED sibling, so when the paywall is off both stay bare.
        titleAfter: option.toolKey ? (
          <FreeTierBadge tool={option.toolKey} />
        ) : HQ_SPEC.toolKey ? (
          <AlwaysFreeTag pairedTool={HQ_SPEC.toolKey} />
        ) : undefined,
        meta: option.time,
        detail: option.detail,
        footnote: liveLimit
          ? formatRateLimit(liveLimit.max_requests, liveLimit.window_seconds)
          : (getRateLimitLabel(option.rateLimitKey) ?? FALLBACK_RATE_LIMIT_LABEL),
      };
    }
  );

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
      // Sized to the tier, so the bar keeps moving for the whole run instead of
      // parking at 92% a minute in.
      progressTau={isHq ? PROGRESS_TAU_HQ : PROGRESS_TAU_STANDARD}
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
            <ControlField
              as="fieldset"
              label="Quality"
              hint={
                isHq ? (
                  <Hint>
                    Studio Quality can take a minute or two, plus the download. The notification
                    below saves you from babysitting this tab.
                  </Hint>
                ) : undefined
              }
            >
              <OptionCards
                label="Separation quality"
                options={qualityOptions}
                value={quality}
                onChange={setQuality}
                disabled={disabled}
              />
            </ControlField>
          )}

          {/*
            HIDDEN UNTIL THERE IS A LINK, not shown disabled. With an empty
            field this was a full-width greyed-out row that does nothing, and a
            disabled control is still a control the eye has to process and
            dismiss. Nothing to notify you about until there's a job.
          */}
          {notifyPermission !== "unsupported" && hasUrl && (
            <ToggleRow
              pressed={notifyOn}
              onToggle={handleNotifyToggle}
              disabled={disabled}
              iconOn={<Bell className="h-4 w-4" />}
              iconOff={<BellOff className="h-4 w-4" />}
            >
              {notifyPermission === "denied"
                ? "Notifications blocked — enable them in your browser settings to use this"
                : notifyOn
                  ? "We'll notify you when it's done"
                  : "Notify me when it's done"}
            </ToggleRow>
          )}
        </div>
      )}
      renderComplete={(jobId) => <SeparateResult jobId={jobId} />}
    />
  );
}