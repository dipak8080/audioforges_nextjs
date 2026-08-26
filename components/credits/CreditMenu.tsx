"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { CreditAccountPanel } from "./CreditAccountPanel";

/**
 * The balance pill, upgraded to a menu.
 *
 * WHY A MENU AND NOT JUST A LINK
 *
 * Three things had no home in the UI and all three belong to the same
 * person — someone who has paid:
 *
 *  1. SIGN OUT. There was no way to sign out at all. On a shared or work
 *     machine that is a real problem, not a nicety: the cookie lasts two
 *     years and the next person inherits the balance.
 *  2. SECOND DEVICE. The QR lives here rather than only on the checkout
 *     page, because people want their phone linked days after buying, not
 *     in the thirty seconds after paying.
 *  3. WHICH ACCOUNT. "48 credits" doesn't say whose. When someone has two
 *     addresses and credits on one, the email is the answer.
 *
 * The anonymous case keeps the old behaviour exactly: a plain link to
 * /pricing, no menu, no chevron. Nobody without an account should have to
 * discover a dropdown to learn they have two free runs.
 */
export function CreditMenu({ className }: { className?: string }) {
  const { enabled, loading, me, balance, freeRemaining, heldCredits } = useCredits();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!enabled) return null;

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
  if (!hasCredits && !hasFree) return null;

  const label = hasCredits
    ? `${balance} ${balance === 1 ? "credit" : "credits"}`
    : `${freeRemaining} free`;

  const triggerClass = cn(
    "hidden items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium sm:flex",
    "transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60",
    hasCredits
      ? "border-amber-500/25 bg-amber-500/5 text-amber-400/90 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300"
      : "border-graphite-700 text-text-muted hover:border-amber-500/40 hover:text-amber-400",
    className
  );

  // Anonymous, or free-tier only: no account exists yet, so there is
  // nothing to sign out of and no device to link. Stays a plain link.
  if (!me?.authenticated) {
    return (
      <Link
        href="/pricing"
        title={`${freeRemaining} free Studio Quality ${
          freeRemaining === 1 ? "run" : "runs"
        } left this month`}
        className={triggerClass}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={triggerClass}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{label}</span>
        {heldCredits > 0 && (
          <span className="text-xs text-text-subtle" aria-hidden="true">
            ·{heldCredits} in use
          </span>
        )}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 shadow-2xl"
        >
          <CreditAccountPanel variant="desktop" onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/**
 * Mobile header chip.
 *
 * Icon and number only — "48 credits" is what makes the desktop pill too
 * wide for a phone header, and the number is the part people check at a
 * glance. Tapping opens the mobile sheet, where CreditAccountPanel
 * carries the full account block.
 *
 * Deliberately NOT a menu of its own: two competing dropdowns in a 375px
 * header is exactly the clutter this was meant to avoid.
 */
export function CreditChipMobile({ onClick }: { onClick: () => void }) {
  const { enabled, loading, balance, freeRemaining } = useCredits();

  if (!enabled || loading) return null;

  const hasCredits = balance > 0;
  if (!hasCredits && freeRemaining <= 0) return null;

  const value = hasCredits ? balance : freeRemaining;
  const title = hasCredits
    ? `${balance} ${balance === 1 ? "credit" : "credits"}`
    : `${freeRemaining} free ${freeRemaining === 1 ? "run" : "runs"} left this month`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      title={title}
      className={cn(
        "flex items-center gap-1 rounded-md border px-2.5 py-2 text-sm font-medium tabular-nums sm:hidden",
        "transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60",
        hasCredits
          ? "border-amber-500/25 bg-amber-500/5 text-amber-400/90"
          : "border-graphite-700 text-text-muted"
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {value}
    </button>
  );
}