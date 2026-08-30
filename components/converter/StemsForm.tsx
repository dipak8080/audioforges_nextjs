"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Sparkles } from "lucide-react";
import { MultiOutputToolForm } from "@/components/converter/MultiOutputToolForm";
import {
  ControlField,
  Hint,
  OptionCards,
  ToggleRow,
  type CardOption,
} from "@/components/converter/ToolControls";
import { submitStems, type SeparationQuality } from "@/lib/api/railway";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { useCredits } from "@/components/credits/CreditProvider";
import { FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { MeteredToolKey } from "@/lib/types/credits";
import type { RateLimitRule } from "@/lib/types/credits";

/**
 * KEPT FROM EARLIER PASSES, all still true:
 *
 * 1. The notify flags are read through REFS. `notifyOnDone` is handed to
 *    MultiOutputToolForm and called from inside its polling loop. Whether that
 *    sees current values depends on how that component builds its poll callback
 *    — in VocalRemoverForm the equivalent code captured the mount-time render
 *    and the notification never fired for anyone.
 *
 * 2. The upgrade's poll ceiling is passed explicitly. An upgrade is always to
 *    HQ, but the parent polled it with whatever `maxPollMs` the quality toggle
 *    was on — Standard, since nobody upgrades a job they already ran at HQ.
 *    That put a 12-minute frontend cap on a run the backend allows 1800s for.
 *
 * 3. The quality picker and the notify toggle are the shared controls, so the
 *    roving-radio behaviour is OptionCards' rather than a fourth hand-rolled
 *    copy.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE PROGRESS BAR FROZE ON THE LONGEST JOB IN THE PRODUCT. The shell's
 *    curve defaults to a 25-second time constant, so it reached ~92% about a
 *    minute into a four-stem HQ run and then sat perfectly still — on the one
 *    tool where the wait is longest and the user has most likely just spent a
 *    credit. A bar that stops moving reads as a hung job.
 *
 * 2. THE MISSING-LIMIT FALLBACK IS GONE. There was a
 *    FALLBACK_RATE_LIMIT_LABEL = "rate limited" here, substituted whenever
 *    getRateLimitLabel came back empty — so a missing key would have rendered
 *    those two words in the slot where the other card shows "2 per hour", and
 *    the 429 would have read "You've reached the free limit (rate limited)."
 *
 *    TO BE CLEAR ABOUT WHY: this is DEFENSIVE, not a bug fix. I originally
 *    changed it believing "stems" was absent from RATE_LIMITS and the card was
 *    live-rendering that placeholder. It wasn't — `separate` and `stems` are
 *    both in the table at 6 per hour, written as unquoted keys, and the card
 *    has always shown the right number. The claim was mine and it was wrong.
 *
 *    The change stays because the principle holds regardless: a parenthetical
 *    exists to carry a figure, and filling it with an apology is worse than
 *    omitting the line. If a key ever does go missing, this fails quietly
 *    instead of loudly saying nothing.
 *
 * NUMBERS CONFIRMED AGAINST THE SERVER (2026-08-30), so don't "fix" them:
 *   stems           6 per hour
 *   stems-hq        2 per hour free, 30 credited
 * The free HQ figure resolves from `rule.free_rate_limit`, which short-circuits
 * the config constant /limits publishes — which is why /limits says 1 and the
 * limiter enforces 2. rateLimitFor() reads /credits/me, which resolves through
 * the limiter's own code path, so it is right by construction. Keep it as the
 * source; the static table below is only the server-render fallback.
 */

interface StemsFormProps {
  hqAvailable?: boolean;
}

interface QualitySpec {
  value: SeparationQuality;
  label: string;
  time: string;
  detail: string;
  /** Key into RATE_LIMITS (lib/data/rate-limits.ts). MAY BE ABSENT from the
   *  table — see limitLabelFor. */
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

// Must cover the BACKEND's actual timeout ceiling (DEMUCS_TIMEOUT_SECONDS_HQ =
// 1800s / DEMUCS_TIMEOUT_SECONDS = 600s in config.py), not the typical-case
// estimate shown in the UI.
const MAX_POLL_MS_STANDARD = 12 * 60 * 1000;
const MAX_POLL_MS_HQ = 32 * 60 * 1000;
const POLL_INTERVAL_MS_STANDARD = 8_000;
const POLL_INTERVAL_MS_HQ = 20_000;

/**
 * Time constants for the shell's progress curve, in seconds — near each tier's
 * TYPICAL duration, not its ceiling. The shell defaults to 25, which puts the
 * bar at ~92% one minute in and leaves it there for the rest of a four-stem HQ
 * run. Four stems take longer than two, so these sit above the vocal remover's.
 */
const PROGRESS_TAU_STANDARD = 45;
const PROGRESS_TAU_HQ = 110;

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
 * The limit for a tier, or undefined when we genuinely don't have one.
 *
 * There used to be a FALLBACK_RATE_LIMIT_LABEL = "rate limited" here, and
 * "stems" isn't a key in RATE_LIMITS — so the Standard card rendered those two
 * words in the slot where the HQ card shows a real figure. A placeholder that
 * says nothing is worse than no line: it reads as something we tried to state
 * and couldn't.
 *
 * Live limit first (it's the one that applies to THIS visitor), static table
 * second, nothing third. Every call site omits rather than substitutes.
 */
function limitLabelFor(spec: QualitySpec, live: RateLimitRule | null): string | undefined {
  if (live) return formatRateLimit(live.max_requests, live.window_seconds);
  return getRateLimitLabel(spec.rateLimitKey) ?? undefined;
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

  /**
   * Read by notifyOnDone, which runs inside the parent's polling loop. Reading
   * the state values directly only works if that loop is rebuilt on every
   * render — an assumption this file has no way to verify and that has already
   * proved false elsewhere in the codebase.
   */
  const notifyEnabledRef = useRef(false);
  const notifyPermissionRef = useRef<NotificationPermission | "unsupported">("default");
  /*
    Synced in an EFFECT, not assigned during render. Writing to a ref while
    rendering is what react-hooks/refs rejects, and it stops being merely untidy
    the moment the React Compiler is enabled: a memoised render can be skipped,
    and the assignment with it.
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
      // Some browsers restrict Notification() outside a service worker context
      // — silently skip rather than throw.
    }
  };

  const notifyOn = notifyEnabled && notifyPermission === "granted";

  /** The limit for the tier that's about to run — used by the 429 copy. */
  const activeLimitLabel = limitLabelFor(spec, spec.toolKey ? rateLimitFor(spec.toolKey) : null);
  const tierWord = isHq ? "studio quality" : "free";

  /** Built here rather than inline so the live per-visitor limit is resolved
   *  once per render instead of once per card. */
  const qualityOptions: CardOption<SeparationQuality>[] = [STANDARD_SPEC, HQ_SPEC].map(
    (option) => {
      const liveLimit = option.toolKey ? rateLimitFor(option.toolKey) : null;
      return {
        value: option.value,
        title: option.label,
        titleBefore:
          option.value === "hq" ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : undefined,
        // Renders nothing unless this tool is metered right now.
        titleAfter: option.toolKey ? <FreeTierBadge tool={option.toolKey} /> : undefined,
        meta: option.time,
        detail: option.detail,
        // Omitted when there's no real figure, rather than filled with a
        // placeholder that reads as a shrug.
        footnote: limitLabelFor(option, liveLimit),
      };
    }
  );

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
      // Four stems is the longest wait in the product, so the curve has to keep
      // moving for minutes rather than parking at 92% after one.
      progressTau={isHq ? PROGRESS_TAU_HQ : PROGRESS_TAU_STANDARD}
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
      /*
        No parenthetical when there's no number to put in it. This used to read
        "You've reached the free limit (rate limited). Try again later." — the
        brackets exist to carry a figure, and the fallback constant turned them
        into an apology.
      */
      rateLimitMessage={
        activeLimitLabel
          ? `You've reached the ${tierWord} limit (${activeLimitLabel}). Try again later.`
          : `You've reached the ${tierWord} limit. Try again later.`
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
            <ControlField
              as="fieldset"
              label="Quality"
              hint={
                isHq ? (
                  <Hint>
                    Studio Quality can take a minute or two. Worth turning on the notification
                    below so you don&apos;t have to babysit this tab.
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
            HIDDEN UNTIL THERE IS A FILE, not shown disabled — the same rule the
            shell already states on its submit button. With no file chosen this
            was a full-width greyed-out row that does nothing, and a disabled
            control is still a control the eye has to process and dismiss.
            Nothing to notify you about until there's a job.
          */}
          {notifyPermission !== "unsupported" && file && (
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
    />
  );
}