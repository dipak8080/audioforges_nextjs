"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2, LogOut, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { DeviceLinkQr } from "./DeviceLinkQr";
import { logout } from "@/lib/api/credits";

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
  const { enabled, loading, me, balance, freeRemaining, heldCredits, refresh } =
    useCredits();

  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Even if the call fails, refetching is the honest next step — the
      // server is the source of truth for whether the session survived.
    }
    await refresh();
    setSigningOut(false);
    setOpen(false);
  }, [signingOut, refresh]);

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
          <div className="border-b border-graphite-800 px-4 py-3">
            <p className="font-mono text-lg text-amber-400">
              {balance} {balance === 1 ? "credit" : "credits"}
            </p>
            {/* Whose account. Matters the moment someone has two
                addresses and credits on only one of them. */}
            <p className="mt-0.5 truncate text-xs text-text-subtle">{me.email}</p>
            {heldCredits > 0 && (
              <p className="mt-1.5 text-[11px] text-text-muted">
                {heldCredits} held by a running job — returned automatically if it
                fails.
              </p>
            )}
          </div>

          <div className="border-b border-graphite-800 px-4 py-3">
            <DeviceLinkQr />
          </div>

          <div className="p-2">
            <Link
              href="/pricing"
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary"
            >
              Buy more credits
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary disabled:opacity-50"
            >
              {signingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              Sign out
            </button>
            {/* Says what sign-out actually does. The server unlinks the
                subject from the account, so this browser genuinely
                reverts to anonymous — and the credits are NOT lost, which
                is the thing someone hesitating over this button needs to
                know. */}
            <p className="px-2 pb-1 pt-1.5 text-[11px] leading-relaxed text-text-subtle">
              Your credits stay on your account — sign back in any time with{" "}
              {me.email}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}