"use client";

import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import type { MeteredToolKey } from "@/lib/types/credits";

/**
 * The small marker on the Studio Quality option.
 *
 * THIS IS THE HIGHEST-LEVERAGE ELEMENT IN THE PAYWALL, and it's four words.
 *
 * The Studio Quality card otherwise says "1–2 min" and nothing else. It gives a
 * first-time visitor no reason to click it — slower, no stated benefit they can
 * verify, and once the paywall is on, an unknown cost. So most people never try
 * the good mode, never hear the difference, and never become someone who would
 * pay for it.
 *
 * Two free runs a month already exist server-side and are invisible everywhere
 * in the UI. Making them visible BEFORE they're spent turns the toggle from a
 * risk into an invitation, and the whole funnel behind it depends on people
 * reaching the top of it.
 *
 * `free_remaining` from the backend is already min(user_left, ip_left), so this
 * never promises a run that will 402.
 *
 * ── WHY A METER AND NOT A PILL ─────────────────────────────────────────
 *
 * "2 FREE RUNS LEFT" in a rounded outline is the badge every dashboard ships,
 * and at 9px it reads as decoration — the eye skips it exactly like it skips
 * "NEW" and "BETA". Tick marks read as a quantity before they read as text:
 * two marks is visibly one more than one mark, so a returning user sees their
 * allowance shrink without parsing a sentence. It is also the vernacular of the
 * rest of the product — a meter, in a room full of meters.
 *
 * The marks are the count, so there is no hardcoded monthly total to drift out
 * of sync with the backend.
 */

/** Past this, marks stop being countable at a glance and a numeral is clearer. */
const MAX_MARKS = 5;

export function FreeTierBadge({
  tool,
  className,
}: {
  tool: MeteredToolKey;
  className?: string;
}) {
  const { enabled, loading, balance, freeRemaining, isToolMetered } = useCredits();

  // Nothing to say while the paywall is off or this specific tool isn't metered
  // — Studio Quality is simply free, and a "free" badge on a free thing is
  // noise.
  if (!enabled || loading || !isToolMetered(tool)) return null;

  // Credits in hand: state the price, not the balance. The pill in the navbar
  // already carries the balance, and repeating it here turns a decision into an
  // accounting readout.
  //
  // Out of both free runs and credits lands here too. Still the price rather
  // than "locked" — the cost is the useful fact, and the gate explains the rest
  // at the moment of use.
  if (balance > 0 || freeRemaining <= 0) {
    return (
      <span
        className={cn(
          "shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-subtle",
          className
        )}
      >
        1 credit
      </span>
    );
  }

  const showMarks = freeRemaining <= MAX_MARKS;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      {/* The count, as a quantity rather than a sentence. */}
      {showMarks ? (
        <span aria-hidden className="flex items-center gap-[2px]">
          {Array.from({ length: freeRemaining }, (_, i) => (
            <span key={i} className="h-2.5 w-[3px] rounded-[1px] bg-teal-400" />
          ))}
        </span>
      ) : (
        <span
          aria-hidden
          className="font-mono text-[10px] font-semibold tabular-nums text-teal-400"
        >
          {freeRemaining}
        </span>
      )}
      <span
        aria-hidden
        className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-teal-400"
      >
        free
      </span>
      {/* The marks carry the number visually; this carries it for everyone
          else. Without it a screen reader announces "free" and no quantity. */}
      <span className="sr-only">
        {freeRemaining} free {freeRemaining === 1 ? "run" : "runs"} left this
        month
      </span>
    </span>
  );
}