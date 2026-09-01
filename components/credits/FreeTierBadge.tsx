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
 * Free runs already exist server-side and are invisible everywhere in the UI.
 * Making them visible BEFORE they're spent turns the toggle from a risk into an
 * invitation, and the whole funnel behind it depends on people reaching the top
 * of it.
 *
 * `free_remaining` from the backend is already min(user_left, ip_left), so this
 * never promises a run that will 402.
 *
 * WHY A METER AND NOT A PILL
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
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * THE LABEL HAD TO SAY BOTH FACTS, AND IT ONLY EVER SAID ONE.
 *
 * It read "FREE". On the audio-to-MIDI picker the standard card's own meta also
 * read "free", so a logged-out visitor saw the same word on both cards and had
 * nothing to tell them apart. They spent an allowance they never knew was
 * finite, then met a paywall from nowhere on the next run.
 *
 * A first pass changed it to "LEFT", which fixed the collision and broke the
 * meaning — on the vocal-remover and stems cards, where the standard option's
 * meta is a duration rather than the word "free", "LEFT" sat alone next to
 * "1-2 MIN" and answered no question a visitor was asking.
 *
 * "FREE LEFT" carries both: it is free right now, and it runs out. It also
 * matches the navbar pill's wording rather than inventing a third vocabulary
 * for the same allowance.
 *
 * WORTH A GLANCE AT paywall.guard TO CONFIRM: this assumes the backend spends
 * the free allowance before touching the balance. If it ever charges credits
 * first, this label flips back and the two branches swap.
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

  /**
   * FREE FIRST. A free run is what the next press actually costs whenever one
   * is left, whether or not there's a balance behind it — so that's what the
   * label says. Showing "1 credit" to someone holding free runs isn't a
   * conservative estimate, it's the wrong number in the direction that stops
   * the click.
   */
  if (freeRemaining <= 0) {
    // No free runs left. State the price, not the balance — the pill in the
    // navbar already carries the balance, and repeating it here turns a
    // decision into an accounting readout. Out of credits too lands here:
    // still the price, because the cost is the useful fact and the gate
    // explains the rest at the moment of use.
    return (
      <span
        className={cn(
          "shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]",
          balance > 0 ? "text-text-muted" : "text-text-subtle",
          className
        )}
        title={
          balance > 0
            ? `Uses 1 of your ${balance} credits`
            : "Uses 1 credit — free runs reset monthly"
        }
      >
        1 credit
      </span>
    );
  }

  const showMarks = freeRemaining <= MAX_MARKS;
  const runWord = freeRemaining === 1 ? "run" : "runs";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5", className)}
      /* The marks are legible as a quantity but not as a sentence, and a
         sighted user hovering one deserves the same explanation the screen
         reader gets. */
      title={`${freeRemaining} free ${runWord} left this month`}
    >
      {/* The count, as a quantity rather than a sentence. */}
      {showMarks ? (
        <span aria-hidden className="flex items-center gap-[2px]">
          {Array.from({ length: freeRemaining }, (_, i) => (
            <span key={i} className="h-2.5 w-[3px] rounded-[1px] bg-teal-400" />
          ))}
        </span>
      ) : (
        <span aria-hidden className="font-mono text-[10px] font-semibold tabular-nums text-teal-400">
          {freeRemaining}
        </span>
      )}
      <span
        aria-hidden
        className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-teal-400"
      >
        free left
      </span>
      {/* The marks carry the number visually; this carries it for everyone
          else. Without it a screen reader announces "free left" and no
          quantity. */}
      <span className="sr-only">
        {freeRemaining} free {runWord} left this month
      </span>
    </span>
  );
}

/**
 * The other half of the pair, and the reason the paid card stopped reading as
 * the free one.
 *
 * On the separation forms the standard card's meta slot is a DURATION, so the
 * only cost word anywhere in the picker was the one on the metered card. A
 * visitor comparing "20 sec-1 min" against "1 free left" is being asked which
 * is cheaper by a control that never mentions price on the free option.
 *
 * `pairedTool` is the METERED sibling, not this card: the marker exists only
 * to contrast with FreeTierBadge, so when the paywall is off — or that rule
 * isn't metered right now — both cards are free and neither should be
 * labelled. Rendering one marker and not the other is what created the
 * confusion in the first place.
 */
export function AlwaysFreeTag({
  pairedTool,
  className,
}: {
  pairedTool: MeteredToolKey;
  className?: string;
}) {
  const { enabled, loading, isToolMetered } = useCredits();

  if (!enabled || loading || !isToolMetered(pairedTool)) return null;

  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-subtle",
        className
      )}
      title="Free and unlimited \u2014 no credit, no monthly allowance"
    >
      always free
    </span>
  );
}