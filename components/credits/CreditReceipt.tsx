"use client";

import { cn } from "@/lib/utils/cn";
import type { SubmitBilling } from "@/lib/types/converter";

/**
 * WHAT A PAID RESULT LOOKS LIKE.
 *
 * A Studio Quality result used to be visually identical to a free one. The only
 * difference was something MISSING — the tip block — which is the worst
 * possible way to acknowledge a purchase: the one person who paid you got a
 * page that looked like everyone else's, minus a thing.
 *
 * Two elements fix that, and neither is celebration for its own sake:
 *
 *  - The TAG marks the artifact. Someone who downloads four stems over a week
 *    needs to know which files came from which model, and the filename doesn't
 *    say.
 *
 *  - The RECEIPT confirms the charge landed. "1 credit used · 47 left" is the
 *    sentence that stops someone opening the ledger to check, and the same
 *    sentence makes a FREE run visibly free rather than ambiguous.
 *
 * Both render from the `billing` block the server returned, so they state what
 * actually happened rather than what the UI assumed.
 *
 * ── WHY IT STILL DOESN'T SHOUT ─────────────────────────────────────────
 *
 * The instinct after a purchase is to celebrate it. Resist: this sits directly
 * under a Download button the user is reaching for, and anything with weight
 * competes with the thing they actually came for. What was wrong before wasn't
 * the volume, it was that a centred grey sentence looks like a disclaimer.
 *
 * So it's a ledger line — label left, figure right, leader dots between, all
 * mono. That's a receipt's own idiom, it's the same readout language as the
 * pack rail and the balance panel, and it makes the number scannable without
 * making it loud.
 */

/**
 * Marks a result that came from the paid model.
 *
 * Sits beside the teal "DONE" label, so it's typeset as its sibling rather than
 * as a pill. Two matched mono labels in different colours read as one
 * considered line; a bordered badge next to a bare label reads as two
 * components that have never met.
 */
export function StudioQualityTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-400",
        className
      )}
    >
      <span aria-hidden className="h-1 w-1 rounded-full bg-amber-400" />
      Studio Quality
    </span>
  );
}

/**
 * One ledger line under a finished metered job.
 *
 * Renders nothing when `billing` is absent, which is every free tool and every
 * standard-tier run — so call sites need no condition of their own.
 */
export function CreditReceipt({
  billing,
  className,
}: {
  billing: SubmitBilling | null | undefined;
  className?: string;
}) {
  if (!billing) return null;

  const { charged, balance, free_remaining } = billing;

  // `charged: null` means the route was metered but nothing was taken —
  // paywall mid-flight, or an already-upgraded job. Nothing to report.
  if (charged === null) return null;

  const isCredit = charged === "credit";

  const label = isCredit ? "1 credit used" : "Free run used";
  const figure = isCredit
    ? `${balance} left`
    : `${free_remaining} left this month`;

  return (
    <div
      // Announced once when the result appears, rather than politely
      // interrupting — the balance is confirmation, not an alert.
      role="status"
      className={cn("border-y border-graphite-800 py-2.5", className)}
    >
      <p className="flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="shrink-0 text-text-muted">{label}</span>
        {/* Leader dots. The one flourish here, and it's the thing that makes a
            receipt look like a receipt instead of a caption. */}
        <span
          aria-hidden
          className="min-w-3 flex-1 translate-y-[-0.25em] border-b border-dotted border-graphite-700"
        />
        <span
          className={cn(
            "shrink-0 tabular-nums",
            isCredit ? "text-amber-400" : "text-teal-400"
          )}
        >
          {figure}
        </span>
      </p>

      {isCredit && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
          Refunded automatically if a run ever fails.
        </p>
      )}
    </div>
  );
}