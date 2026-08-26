"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SubmitBilling } from "@/lib/types/converter";

/**
 * WHAT A PAID RESULT LOOKS LIKE.
 *
 * Until now, a Studio Quality result was visually identical to a free
 * one. The only difference was something MISSING — the tip block — which
 * is the worst possible way to acknowledge a purchase: the one person who
 * paid you got a page that looked like everyone else's, minus a thing.
 *
 * Two elements fix that, and neither is celebration for its own sake:
 *
 *  - The TAG marks the artifact. Someone who downloads four stems over a
 *    week needs to know which files came from which model, and the
 *    filename doesn't say.
 *
 *  - The RECEIPT confirms the charge landed. "1 credit used · 48 left" is
 *    the sentence that stops someone opening the ledger to check, and it
 *    is the same sentence that makes a FREE run visibly free rather than
 *    ambiguous.
 *
 * Both render from the `billing` block the server returned, so they state
 * what actually happened rather than what the UI assumed.
 */

/** Small marker for a result that came from the paid model. */
export function StudioQualityTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-400",
        className
      )}
    >
      <Sparkles className="h-2.5 w-2.5" aria-hidden />
      Studio Quality
    </span>
  );
}

/**
 * One quiet line under a finished metered job.
 *
 * Renders nothing when `billing` is absent, which is every free tool and
 * every standard-tier run — so call sites need no condition of their own.
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

  const text =
    charged === "free"
      ? `Free Studio Quality run used · ${free_remaining} left this month`
      : `1 credit used · ${balance} ${balance === 1 ? "credit" : "credits"} remaining`;

  return (
    <p
      className={cn("text-center text-[11px] text-text-subtle", className)}
      // Announced once when the result appears, rather than politely
      // interrupting — the balance is confirmation, not an alert.
      role="status"
    >
      {text}
      {charged === "credit" && (
        <>
          {" · "}
          <span className="text-text-muted">
            refunded automatically if a run ever fails
          </span>
        </>
      )}
    </p>
  );
}