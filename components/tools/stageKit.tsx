"use client";

import { Bell, BellOff } from "lucide-react";
import { useCredits } from "@/components/credits/CreditProvider";
import { AlwaysFreeTag, FreeTierBadge } from "@/components/credits/FreeTierBadge";
import type { StageTier } from "@/components/tools/StudioStage";
import { DEMO_DURATION, DEMO_PEAKS_STANDARD, DEMO_PEAKS_STUDIO } from "@/lib/data/demo-peaks";
import type { MeteredToolKey } from "@/lib/types/credits";
import { cn } from "@/lib/utils/cn";

export const STAGE_DEMO_CREDIT =
  "What Would It Mean by H4RRIS feat. Nicole Apollonio, used with permission";

export interface StageTierSpec {
  name: string;
  model: string;
  time: string;
}

function limitText(max: number, windowSeconds: number): string {
  if (windowSeconds === 3600) return `${max} per hour`;
  if (windowSeconds === 60) return `${max} per min`;
  if (windowSeconds > 3600) return `${max} per ${Math.round(windowSeconds / 3600)} hr`;
  return `${max} per ${Math.round(windowSeconds / 60)} min`;
}

// Standard and Studio tiers for a separation tool, with live cost and limits.
export function useSeparationTiers({
  hqAvailable,
  hqToolKey,
  standard,
  studio,
  standardLimitLabel,
  hqLimitLabel,
  demoStandardSrc,
  demoStudioSrc,
  demoPeaks,
}: {
  hqAvailable: boolean;
  hqToolKey: MeteredToolKey;
  standard: StageTierSpec;
  studio: StageTierSpec;
  standardLimitLabel: string;
  hqLimitLabel: string;
  demoStandardSrc?: string;
  demoStudioSrc?: string;
  /** Waveform data for the demo clips. Defaults to the vocal demo. */
  demoPeaks?: { standard: number[]; studio: number[]; duration: number };
}): StageTier<string>[] {
  const { rateLimitFor, enabled, loading, isToolMetered, me } = useCredits();
  const metered = enabled && !loading && isToolMetered(hqToolKey);
  const cost = me?.paywall?.tools?.[hqToolKey]?.credits ?? 1;
  const live = rateLimitFor(hqToolKey);

  const tiers: StageTier<string>[] = [
    {
      value: "standard",
      name: standard.name,
      short: "Standard",
      model: standard.model,
      time: standard.time,
      footnote: standardLimitLabel,
      badge: <AlwaysFreeTag pairedTool={hqToolKey} />,
      demo: demoStandardSrc
        ? {
            src: demoStandardSrc,
            peaks: demoPeaks?.standard ?? DEMO_PEAKS_STANDARD,
            duration: demoPeaks?.duration ?? DEMO_DURATION,
          }
        : undefined,
    },
  ];
  if (hqAvailable) {
    tiers.push({
      value: "hq",
      name: studio.name,
      short: "Studio",
      premium: true,
      model: studio.model,
      time: studio.time,
      footnote: metered
        ? `${cost} ${cost === 1 ? "credit" : "credits"} per track after your free runs`
        : loading
          ? undefined
          : live
            ? limitText(live.max_requests, live.window_seconds)
            : hqLimitLabel,
      badge: <FreeTierBadge tool={hqToolKey} />,
      demo: demoStudioSrc
        ? {
            src: demoStudioSrc,
            peaks: demoPeaks?.studio ?? DEMO_PEAKS_STUDIO,
            duration: demoPeaks?.duration ?? DEMO_DURATION,
          }
        : undefined,
    });
  }
  return tiers;
}

export function NotifyBell({
  permission,
  on,
  busy,
  onToggle,
}: {
  permission: NotificationPermission | "unsupported";
  on: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  if (permission === "unsupported") return null;
  const title =
    permission === "denied"
      ? "Notifications are blocked in your browser settings"
      : on
        ? "We will notify you when it is done"
        : "Notify me when it is done";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy || permission === "denied"}
      aria-pressed={on}
      aria-label={title}
      title={title}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:cursor-not-allowed disabled:opacity-50",
        on
          ? "border-text-primary/70 text-text-primary"
          : "border-graphite-700 text-text-subtle hover:border-graphite-500 hover:text-text-primary"
      )}
    >
      {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </button>
  );
}