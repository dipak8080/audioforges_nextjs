"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { buttonStyles } from "@/components/ui/Button";
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
 * THE EMPTY CASE HAS A DOOR (2026-08-21). This returned `null` when balance and
 * free runs were both zero — meaning the person who just burned their
 * allowance, the single most likely buyer on the site, had no route to /pricing
 * from the navbar at all. They get a quiet "Credits" link.
 *
 * ARIA (2026-08-21). `role="menu"` on a container of links and buttons is
 * invalid — a menu's children must be menuitems, and screen readers announce
 * the mismatch as an empty menu. It's a disclosure, so it's labelled as one.
 *
 * FOCUS IS MANAGED (2026-08-21). Opening moved focus nowhere and Escape
 * returned it nowhere, so a keyboard user opened a popover they could not reach
 * and closed it into limbo.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. AN EMPTY DIV WAS EATING 8px OF THE PHONE HEADER. The trigger is
 *    `hidden md:flex`, but its positioning wrapper wasn't — so on mobile a
 *    zero-width div still sat in the header's `gap-2` flex row and pushed
 *    everything after it across. The wrapper hides with its contents now.
 *
 * 2. THE POPOVER'S LABEL WASN'T EXPOSED. `aria-label` on a plain <div> with no
 *    role is ignored outright, so the thing that opened announced as nothing.
 *
 * 3. HELD CREDITS WERE VISUAL-ONLY. The "+2 held" figure carried `aria-hidden`
 *    and never made it into the trigger's accessible name, so a screen reader
 *    heard a balance with no explanation of why it looked short.
 *
 * 4. EVERY BUTTON SURFACE HERE IS `buttonStyles` NOW. The pill, the two link
 *    variants and the mobile chip were four hand-rolled sets of padding,
 *    radius, transition and focus ring — four chances to drift from the rest of
 *    the site, and they already had (no press state on any of them).
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
      "button:not([disabled]), a[href], input:not([disabled])"
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
          "hidden h-10 items-center gap-1.5 rounded-lg border border-graphite-800 px-3 text-sm text-text-subtle md:flex",
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

  /* One definition for all three shapes this takes — pill, free link, empty
     link — so they can't drift apart the way four hand-rolled versions did. */
  const pillClass = buttonStyles({
    variant: "outline",
    size: "md",
    className: cn(
      "hidden md:inline-flex",
      hasCredits
        ? "border-amber-500/25 bg-amber-500/5 text-amber-400/90 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300"
        : "text-text-muted hover:border-amber-500/40 hover:text-amber-400",
      className
    ),
  });

  /**
   * ORDER MATTERS HERE, and it was wrong.
   *
   * The zero-balance branch below used to run BEFORE this check, so a signed-in
   * customer who spent their last credit lost the entire account menu — sign
   * out, the device QR, their email, "buy more credits" — and got a bare
   * "Credits" link indistinguishable from a visitor who had never paid. That is
   * precisely the person most likely to buy again, and the one who most needs
   * the device link.
   *
   * A signed-in account is worth a menu at any balance, including zero. Zero is
   * a real number and worth showing.
   */
  if (!me?.authenticated && !hasCredits && !hasFree) {
    // Genuinely nothing: no account, no balance, no free runs. A quiet link,
    // not a pill — dressing an empty state in amber is a badge for zero.
    return (
      <Link
        href="/pricing"
        className={buttonStyles({
          variant: "ghost",
          size: "md",
          className: cn("hidden text-text-muted hover:text-amber-400 md:inline-flex", className),
        })}
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
        /* Not "free Studio Quality runs". `free_usage` has no tool in its key
           — the allowance is N ops TOTAL across HQ separation, transcription
           and multi-track MIDI. Naming one tool sends someone who spent theirs
           on transcripts to a stem page expecting runs they no longer have. */
        title={`${freeRemaining} free ${
          freeRemaining === 1 ? "run" : "runs"
        } left this month, usable on any paid tool`}
        className={pillClass}
      >
        <Sparkles aria-hidden />
        <span>{freeRemaining} free</span>
      </Link>
    );
  }

  const label = hasCredits
    ? `${balance} ${balance === 1 ? "credit" : "credits"}`
    : hasFree
      ? `${freeRemaining} free`
      : // Signed in and empty. Says so plainly rather than reading as a balance
        // the UI failed to load.
        "0 credits";

  /* The held figure is visual-only in the pill, so it has to reach the
     accessible name some other way — otherwise a screen reader hears a balance
     that looks short with nothing explaining why. */
  const triggerLabel =
    heldCredits > 0
      ? `${label}, plus ${heldCredits} held by a running job. Open account menu`
      : `${label}. Open account menu`;

  return (
    <div
      ref={rootRef}
      /* `hidden md:block`, not just `relative`. The trigger inside was already
         desktop-only, but this wrapper wasn't — so on a phone it stayed in the
         header's flex row as a zero-width child and still collected its `gap-2`,
         shifting everything to its right by 8px for no reason. */
      className="relative hidden md:block"
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
        aria-haspopup="true"
        aria-controls={panelId}
        aria-label={triggerLabel}
        className={pillClass}
      >
        <Sparkles aria-hidden />
        <span className="tabular-nums">{label}</span>
        {heldCredits > 0 && (
          <span className="font-mono text-[11px] text-text-subtle" aria-hidden="true">
            +{heldCredits} held
          </span>
        )}
        <ChevronDown
          aria-hidden
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          /* A label needs a role to be exposed at all. Without one this
             announced as an unnamed group of links. */
          role="group"
          aria-label="Your credits"
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 shadow-2xl shadow-graphite-950/60"
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
 * FIXED (2026-08-21): this always opened the nav sheet, including for anonymous
 * free-tier users — for whom CreditAccountPanel renders nothing, so tapping a
 * credits chip produced a list of forty tools and no mention of credits.
 * Anonymous now goes straight to /pricing, matching the desktop pill.
 */
export function CreditChipMobile({ onOpenSheet }: { onOpenSheet: () => void }) {
  const { enabled, loading, me, balance, freeRemaining } = useCredits();

  if (!enabled) return null;

  if (loading) {
    return (
      <span
        aria-hidden="true"
        className={buttonStyles({
          variant: "outline",
          size: "md",
          className: "gap-1 px-2.5 tabular-nums text-text-muted md:hidden",
        })}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
      </span>
    );
  }

  const hasCredits = balance > 0;
  const isEmpty = !me?.authenticated && !hasCredits && freeRemaining <= 0;

  /*
    THE EMPTY STATE USED TO RETURN NULL, AND THAT DELETED THE ONLY WAY TO BUY.

    Desktop answers this case with a quiet "Credits" link (see CreditMenu
    above). Mobile answered it with nothing at all, so an anonymous visitor who
    had spent their allowance got a header with Donate and no route to
    /pricing — on the one device where this chip is the entire credit UI. The
    old reasoning ("nothing to spend gets nothing") reads as restraint, but a
    first-time visitor has free runs and does get a chip: the only people it
    hid from were the ones who had just used everything, which is the moment
    they are worth talking to.

    Zero is a real number. It renders as the muted variant, not amber — an
    empty state dressed in amber is a badge for nothing.
  */

  const value = hasCredits ? balance : freeRemaining;
  const title = hasCredits
    ? `${balance} ${balance === 1 ? "credit" : "credits"}`
    : isEmpty
      ? "No free runs left this month — see credit packs"
      : `${freeRemaining} free ${freeRemaining === 1 ? "run" : "runs"} left this month`;

  const chipClass = buttonStyles({
    variant: "outline",
    size: "md",
    className: cn(
      "gap-1 px-2.5 tabular-nums md:hidden",
      hasCredits
        ? "border-amber-500/25 bg-amber-500/5 text-amber-400/90"
        : "text-text-muted"
    ),
  });

  if (!me?.authenticated) {
    return (
      <Link href="/pricing" aria-label={title} title={title} className={chipClass}>
        <Sparkles aria-hidden />
        {value}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenSheet}
      aria-label={`${title}. Open account menu`}
      title={title}
      className={chipClass}
    >
      <Sparkles aria-hidden />
      {value}
    </button>
  );
}