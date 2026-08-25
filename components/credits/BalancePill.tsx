"use client";

import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";

/**
 * Navbar balance indicator.
 *
 * Renders NOTHING when the paywall is off, which is its state today —
 * `useCredits()` returns the inert context and the first branch fires.
 * The component is mounted regardless so that flipping PAYWALL_ENABLED
 * makes it appear without a deploy.
 *
 * WHY IT SHOWS "2 free" RATHER THAN NOTHING AT ZERO BALANCE
 *
 * A pill that only appears once you've paid is a receipt. A pill that
 * shows the free allowance before you've spent it is an invitation — it's
 * the thing that makes someone notice Studio Quality exists at all. The
 * free tier is 2/month and it is currently invisible everywhere in the
 * UI, which means most people will never learn the good mode is free to
 * try. That's the conversion leak this closes.
 *
 * `free_remaining` from the backend is already min(user_left, ip_left),
 * so it never promises a run that will 402.
 */
export function BalancePill({ className }: { className?: string }) {
  const { enabled, loading, balance, freeRemaining, heldCredits } = useCredits();

  if (!enabled) return null;

  // A skeleton would be worse than nothing here: this sits in a sticky
  // header on every page, so a shimmering placeholder on every navigation
  // reads as jank. A quiet spinner only shows during the genuine first load.
  if (loading) {
    return (
      <span
        className={cn(
          "hidden items-center gap-1.5 rounded-md border border-graphite-800 px-3 py-2 text-sm text-text-subtle sm:flex",
          className
        )}
        aria-hidden="true"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }

  const hasCredits = balance > 0;
  const hasFree = freeRemaining > 0;

  // Nothing to say: no credits, no free runs left. Rather than render a
  // dead "0 credits" badge — which is a nag, not information — the
  // out-of-credits case is handled where it's actionable: the gate modal
  // at the moment of use.
  if (!hasCredits && !hasFree) return null;

  const label = hasCredits
    ? `${balance} ${balance === 1 ? "credit" : "credits"}`
    : `${freeRemaining} free`;

  const title = hasCredits
    ? heldCredits > 0
      ? `${balance} credits available, ${heldCredits} in use on a running job`
      : `${balance} Studio Quality ${balance === 1 ? "run" : "runs"} available`
    : `${freeRemaining} free Studio Quality ${
        freeRemaining === 1 ? "run" : "runs"
      } left this month`;

  return (
    <Link
      href="/pricing"
      title={title}
      aria-label={title}
      className={cn(
        "hidden items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium sm:flex",
        "transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60",
        hasCredits
          ? "border-amber-500/25 bg-amber-500/5 text-amber-400/90 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300"
          : "border-graphite-700 text-text-muted hover:border-amber-500/40 hover:text-amber-400",
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span>{label}</span>
      {/* A held credit means a job is mid-flight. Showing it prevents the
          "it took my credit" support email when the balance drops before
          the result appears. */}
      {heldCredits > 0 && (
        <span className="text-xs text-text-subtle" aria-hidden="true">
          ·{heldCredits} in use
        </span>
      )}
    </Link>
  );
}