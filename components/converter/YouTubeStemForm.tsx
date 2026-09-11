"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic2,
  Drum,
  Guitar,
  Music2,
  AudioLines,
  Sparkles,
  Bell,
  BellOff,
} from "lucide-react";
import { YouTubeUrlForm } from "@/components/converter/YouTubeUrlForm";
import { StemMixer } from "@/components/converter/StemMixer";
import { triggerDownload, triggerDownloadsStaggered } from "@/lib/utils/download";
import {
  ControlField,
  Hint,
  OptionCards,
  ToggleRow,
  type CardOption,
} from "@/components/converter/ToolControls";
import {
  submitYoutubeStems,
  getYoutubeStemsStatus,
  getYoutubeStemsPreviewUrl,
  getYoutubeStemsDownloadUrl,
  type SeparationQuality,
} from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { useCredits } from "@/components/credits/CreditProvider";
import { AlwaysFreeTag, FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { MeteredToolKey } from "@/lib/types/credits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE RESULT RENDERED ITS HEADER TWICE. Same seam as YouTubeSeparateForm:
 *    YouTubeUrlForm draws a ResultHeader — "DONE", the track title, the
 *    thumbnail, the elapsed time, the Studio Quality tag — and THEN calls
 *    renderComplete, which opened with its own "Done" eyebrow and title. Two
 *    identical lines stacked on every finished job. The kit's is the one that
 *    carries the thumbnail and the tag, so the local block goes.
 *
 * 2. THE PROGRESS BAR FROZE ON THE SLOWEST JOB IN THE PRODUCT. YouTubeUrlForm's
 *    curve was fixed at a 20-second time constant, so it parked at ~92% about a
 *    minute into a four-stem HQ run that can take several. A bar that stops
 *    moving reads as a hung job — on the one tool where the wait is longest and
 *    the user is most likely to have paid for it. `progressTau` per tier now.
 *
 * 3. useRovingRadio IS GONE. Third hand-rolled copy of the same keyboard
 *    behaviour; OptionCards carries it. The quality picker was declaring
 *    `role="radiogroup"` — one tab stop, arrows between options — over plain
 *    buttons that gave a tab stop each and no arrows.
 *
 * KEPT, because they were right: `aria-pressed` on the stem rows, which is the
 * only thing that makes "which stem is playing" answerable without sight; the
 * `key={jobId}` remount so an upgraded job can't inherit a stale error; the
 * explicit upgrade poll ceilings, which matter most here because four-stem HQ
 * is the slowest thing the backend runs; notify flags through refs.
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
 * Time constants for the progress curve, in seconds — near each tier's TYPICAL
 * duration, not its ceiling. Four stems take longer than two, so these run
 * above YouTubeSeparateForm's.
 */
const PROGRESS_TAU_STANDARD = 45;
const PROGRESS_TAU_HQ = 110;

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

/**
 * Only what sits BELOW the kit's result header: the stem list, the player and
 * the per-stem downloads. The header — verb, title, thumbnail, elapsed time,
 * Studio Quality tag — is YouTubeUrlForm's, and this used to draw a second one.
 */
function StemsResult({ jobId, title }: { jobId: string; title: string | null }) {
  const [stems, setStems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getYoutubeStemsStatus(jobId);
        if (cancelled) return;
        setStems(result.outputs);
      } catch {
        if (!cancelled) setError("Could not load the stem list.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error) return <Hint tone="bad">{error}</Hint>;
  if (stems.length === 0) return <p className="text-sm text-text-muted">Loading stems…</p>;

  return (
    <StemMixer
      stems={stems.map((name) => ({
        name: formatStemName(name),
        url: getYoutubeStemsPreviewUrl(jobId, name),
        downloadName: `${name}.wav`,
        icon: stemIcon(name),
      }))}
      onDownload={(display) => {
        const raw = stems.find((n) => formatStemName(n) === display) ?? display;
        triggerDownload(getYoutubeStemsDownloadUrl(jobId, raw));
      }}
      onDownloadAll={() =>
        triggerDownloadsStaggered(stems.map((n) => getYoutubeStemsDownloadUrl(jobId, n)))
      }
      sourceTitle={title}
    />
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
        breakoutOnComplete
        showMixerTeaser
      endpoint="youtube/stems"
      onSubmit={(url) => submitYoutubeStems(url, effectiveQuality)}
      // Credits wiring. `meteredToolKey` reflects the CURRENT selection, so it's
      // null while Standard is chosen and the 429 offer stays out of the free
      // tier's way.
      meteredToolKey={isHq ? "youtube/stems-hq" : null}
      upgradeFamily="stems"
      pollIntervalMs={isHq ? POLL_INTERVAL_MS_HQ : POLL_INTERVAL_MS_STANDARD}
      maxPollMs={isHq ? MAX_POLL_MS_HQ : MAX_POLL_MS_STANDARD}
      // Four stems is the longest wait in the product, so the curve has to keep
      // moving for minutes rather than parking at 92% after one.
      progressTau={isHq ? PROGRESS_TAU_HQ : PROGRESS_TAU_STANDARD}
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
      renderComplete={(jobId, title) => <StemsResult key={jobId} jobId={jobId} title={title} />}
    />
  );
}