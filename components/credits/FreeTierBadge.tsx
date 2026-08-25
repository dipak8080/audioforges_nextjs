"use client";

import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import type { MeteredToolKey } from "@/lib/types/credits";

/**
 * The small badge on the Studio Quality option.
 *
 * THIS IS THE HIGHEST-LEVERAGE ELEMENT IN PR3, and it's four words.
 *
 * Right now the Studio Quality card says "1–2 min" and nothing else. It
 * gives a first-time visitor no reason to click it — slower, no stated
 * benefit they can verify, and once the paywall is on, an unknown cost.
 * So most people never try the good mode, never hear the difference, and
 * never become someone who would pay for it.
 *
 * Two free runs a month already exist server-side. They are currently
 * invisible everywhere in the UI. Making them visible BEFORE they're
 * spent converts the toggle from a risk into an invitation, and the whole
 * funnel behind it depends on people reaching the top of it.
 *
 * `free_remaining` from the backend is already min(user_left, ip_left),
 * so this never promises a run that will 402.
 */
export function FreeTierBadge({
  tool,
  className,
}: {
  tool: MeteredToolKey;
  className?: string;
}) {
  const { enabled, loading, balance, freeRemaining, isToolMetered } = useCredits();

  // Nothing to say while the paywall is off or this specific tool isn't
  // metered — Studio Quality is simply free, and a "free" badge on a free
  // thing is noise.
  if (!enabled || loading || !isToolMetered(tool)) return null;

  // Credits in hand: state the price, not the balance. The pill in the
  // navbar already carries the balance, and repeating it here turns a
  // decision into an accounting readout.
  if (balance > 0) {
    return (
      <Badge className={className} tone="neutral">
        1 credit
      </Badge>
    );
  }

  if (freeRemaining > 0) {
    return (
      <Badge className={className} tone="free">
        {freeRemaining} free {freeRemaining === 1 ? "run" : "runs"} left
      </Badge>
    );
  }

  // Out of both. Still say the price rather than "locked" — the cost is
  // the useful fact, and the gate explains the rest at the moment of use.
  return (
    <Badge className={className} tone="neutral">
      1 credit
    </Badge>
  );
}

function Badge({
  tone,
  className,
  children,
}: {
  tone: "free" | "neutral";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
        tone === "free"
          ? "border-teal-500/40 bg-teal-500/10 text-teal-400"
          : "border-graphite-600 text-text-subtle",
        className
      )}
    >
      {children}
    </span>
  );
}