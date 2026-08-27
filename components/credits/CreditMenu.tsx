"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { CreditAccountPanel } from "./CreditAccountPanel";

/**
 * The balance pill, and the account popover behind it.
 *
 * WHY A MENU AND NOT JUST A LINK — three things had no home in the UI and
 * all three belong to someone who has paid:
 *
 *  1. SIGN OUT. There was no way to. On a shared or work machine that's real:
 *     the cookie lasts two years and the next person inherits the balance.
 *  2. SECOND DEVICE. The QR lives here rather than only on checkout, because
 *     people want their phone linked days after buying, not in the thirty
 *     seconds after paying.
 *  3. WHICH ACCOUNT. "48 credits" doesn't say whose. The moment someone has a
 *     work address and a personal one, the email is the answer.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * THE EMPTY CASE NOW HAS A DOOR. This returned `null` when balance and free
 * runs were both zero — meaning the person who just burned their allowance,
 * the single most likely buyer on the site, had no route to /pricing from the
 * navbar at all. They now get a quiet "Credits" link.
 *
 * ARIA FIXED. `role="menu"` on a container of links and buttons is invalid —
 * a menu's children must be menuitems, and screen readers announce the
 * mismatch as an empty menu. It's a disclosure, so it's labelled as one.
 *
 * FOCUS IS MANAGED. Opening moved focus nowhere and Escape returned it
 * nowhere, so a keyboard user opened a popover they could not reach and
 * closed it into limbo. Now: open moves focus in, Escape closes and returns
 * it to the trigger, and focus leaving the popover closes it.
 */
export function CreditMenu({ className }: { className?: string }) {
  const { enabled, loading, me, balance, freeRemaining, heldCredits } = useCredits();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    // Closing on focus leaving the popover is what makes Tab behave: the
    // popover gets out of the way instead of trailing behind the cursor.
    function onFocusIn(e: FocusEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  // Move focus into the popover on open, so the thing that just appeared is
  // the thing the next keystroke acts on.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled])'
    );
    first?.focus();
  }, [open]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  if (!enabled) return null;

  if (loading) {
    return (
      <span
        className={cn(
          "hidden items-center gap-1.5 rounded-md border border-graphite-800 px-3 py-2 text-sm text-text-subtle md:flex",
          className
        )}
        aria-hidden="true"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
      </span>
    );
  }

  const hasCredits = balance > 0;
  const hasFree = freeRemaining > 0;

  const triggerClass = cn(
    "hidden items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium md:flex",
    "transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
    hasCredits
      ? "border-amber-500/25 bg-amber-500/5 text-amber-400/90 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300"
      : "border-graphite-700 text-text-muted hover:border-amber-500/40 hover:text-amber-400",
    className
  );

  /**
   * Nothing to show and nothing to sign out of — but the paywall IS on, so
   * there is something to buy. A quiet link, not a pill: this person has no
   * balance, and dressing an empty state in amber is a badge for zero.
   */
  if (!hasCredits && !hasFree) {
    return (
      <Link
        href="/pricing"
        className={cn(
          "hidden rounded-md px-3 py-2 text-sm font-medium text-text-muted md:block",
          "outline-none transition-colors duration-200 hover:bg-graphite-900 hover:text-amber-400",
          "focus-visible:ring-2 focus-visible:ring-amber-400/70",
          className
        )}
      >
        Credits
      </Link>
    );
  }

  // Free tier, no account yet: nothing to sign out of and no device to link,
  // so it stays a plain link. Nobody without an account should have to
  // discover a dropdown to learn they have two free runs.
  if (!me?.authenticated) {
    return (
      <Link
        href="/pricing"
        title={`${freeRemaining} free Studio Quality ${
          freeRemaining === 1 ? "run" : "runs"
        } left this month`}
        className={triggerClass}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span>{freeRemaining} free</span>
      </Link>
    );
  }

  const label = hasCredits
    ? `${balance} ${balance === 1 ? "credit" : "credits"}`
    : `${freeRemaining} free`;

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(true) : setOpen(true))}
        aria-expanded={open}
        aria-controls={panelId}
        className={triggerClass}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span className="tabular-nums">{label}</span>
        {heldCredits > 0 && (
          <span className="font-mono text-[11px] text-text-subtle" aria-hidden="true">
            +{heldCredits} held
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "h-3 w-3 transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          aria-label="Your credits"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 shadow-2xl"
        >
          <CreditAccountPanel variant="desktop" onNavigate={() => close()} />
        </div>
      )}
    </div>
  );
}

/**
 * Mobile header chip.
 *
 * Icon and number only — "48 credits" is what makes the desktop pill too wide
 * for a phone header, and the number is what people check at a glance.
 *
 * Deliberately NOT a menu of its own: two competing dropdowns in a 375px
 * header is exactly the clutter this avoids.
 *
 * FIXED: this always opened the nav sheet, including for anonymous free-tier
 * users — for whom CreditAccountPanel renders nothing, so tapping a credits
 * chip produced a list of forty tools and no mention of credits. Anonymous
 * now goes straight to /pricing, matching what the desktop pill does.
 */
export function CreditChipMobile({ onOpenSheet }: { onOpenSheet: () => void }) {
  const { enabled, loading, me, balance, freeRemaining } = useCredits();

  if (!enabled || loading) return null;

  const hasCredits = balance > 0;
  if (!hasCredits && freeRemaining <= 0) return null;

  const value = hasCredits ? balance : freeRemaining;
  const title = hasCredits
    ? `${balance} ${balance === 1 ? "credit" : "credits"}`
    : `${freeRemaining} free ${freeRemaining === 1 ? "run" : "runs"} left this month`;

  const chipClass = cn(
    "flex items-center gap-1 rounded-md border px-2.5 py-2 text-sm font-medium tabular-nums md:hidden",
    "transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
    hasCredits
      ? "border-amber-500/25 bg-amber-500/5 text-amber-400/90"
      : "border-graphite-700 text-text-muted"
  );

  if (!me?.authenticated) {
    return (
      <Link href="/pricing" aria-label={title} title={title} className={chipClass}>
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        {value}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenSheet}
      aria-label={title}
      title={title}
      className={chipClass}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {value}
    </button>
  );
}