"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Mail, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { DeviceLinkQr } from "./DeviceLinkQr";
import { logout, requestMagicLink } from "@/lib/api/credits";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";

/**
 * The account block. ONE implementation, rendered in the desktop navbar
 * popover and at the top of the mobile sheet, so the two can't drift into
 * saying different things about the same account.
 *
 * THE DESKTOP / MOBILE DIFFERENCE THAT MATTERS
 * The QR is a DESKTOP-TO-PHONE affordance — you scan it with a different
 * device than the one showing it. "Use on my phone" rendered on a phone is
 * nonsense; there's no second camera to point at the screen. Mobile gets the
 * honest equivalent: email a sign-in link, which is how you'd reach a laptop
 * from here. Same job, right tool for the device.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * IT NO LONGER RENDERS NOTHING FOR FREE USERS. This returned `null` unless
 * authenticated, so a free-tier visitor opening the mobile sheet saw no trace
 * of the two runs they have. The free state is the top of the entire funnel —
 * it gets a block of its own, with the reset date and a route to /pricing.
 *
 * The balance is set in the same mono readout language as the pack rail and
 * the checkout screen, so the number looks like the same number everywhere it
 * appears.
 */
export function CreditAccountPanel({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "mobile";
  /** Close the containing menu/sheet after a navigation. */
  onNavigate?: () => void;
}) {
  const { enabled, me, balance, freeRemaining, heldCredits, refresh } = useCredits();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // The server is the source of truth for whether the session survived,
      // so refetching is the honest next step either way.
    }
    await refresh();
    setSigningOut(false);
    onNavigate?.();
  }, [signingOut, refresh, onNavigate]);

  // Hoisted out of the dep list: `me?.free_resets_at` as a dependency is an
  // optional member expression the compiler can't track, so it can't verify
  // the memo. A plain local reads identically and is checkable.
  const resetsAt = me?.free_resets_at;
  const resetsOn = useMemo(() => {
    if (!resetsAt) return null;
    const d = new Date(resetsAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }, [resetsAt]);

  const isMobile = variant === "mobile";

  if (!enabled) return null;

  /**
   * Free tier, no account. Nothing to sign out of and no device to link, so
   * this is a statement of what they have rather than a menu.
   */
  if (!me?.authenticated) {
    if (freeRemaining <= 0) return null;
    return (
      <div
        className={cn(
          isMobile
            ? "rounded-xl border border-graphite-800 bg-graphite-900 p-4"
            : "px-4 py-3"
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
            Free this month
          </p>
        </div>
        <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-amber-400">
          {freeRemaining}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          Studio Quality {freeRemaining === 1 ? "run" : "runs"} left
          {resetsOn ? `, resets ${resetsOn}` : ""}
        </p>
        <Link
          href="/pricing"
          onClick={onNavigate}
          className={cn(
            "mt-3 block rounded-lg border border-graphite-700 px-4 py-2.5 text-center text-sm font-medium text-text-muted",
            "outline-none transition-colors hover:border-amber-500/40 hover:text-amber-400",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70"
          )}
        >
          See what credits cost
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(isMobile && "space-y-3")}>
      <div
        className={cn(
          isMobile
            ? "rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3.5"
            : "border-b border-graphite-800 px-4 py-3.5"
        )}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
          Balance
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-400">
          {balance}
        </p>
        <p className="text-xs text-text-muted">
          {balance === 1 ? "credit" : "credits"}
        </p>
        {/* Whose account. Matters the moment someone has a work address and a
            personal one, with credits on only one. */}
        <p className="mt-2 truncate text-xs text-text-subtle" title={me.email ?? undefined}>
          {me.email}
        </p>
        {heldCredits > 0 && (
          /*
            This said "held by a running job — returned automatically if it
            fails", which is true and still leaves someone stuck. The common way
            to see it is: start a job, press Cancel, and find a credit still
            held. Cancel stops the PAGE watching; it does not stop the job, so
            the hold is correct and the user has no way to know that.
            So it now says what the hold is waiting for and that it resolves
            without them — the two facts that turn a worry into a wait.
          */
          <p className="mt-2 border-t border-amber-500/15 pt-2 text-[11px] leading-relaxed text-text-muted">
            {heldCredits === 1 ? "1 credit is" : `${heldCredits} credits are`} held
            while a run finishes. Closing the page or pressing Cancel doesn&apos;t
            stop the run — it keeps going on our servers. If it succeeds the
            credit is spent; if it fails or never finishes, it comes back on its
            own. Nothing to do either way.
          </p>
        )}
      </div>

      <div
        className={cn(
          isMobile
            ? "rounded-xl border border-graphite-800 bg-graphite-900 p-4"
            : "border-b border-graphite-800 px-4 py-3"
        )}
      >
        {isMobile ? <EmailDeviceLink /> : <DeviceLinkQr />}
      </div>

      <div className={cn(isMobile ? "space-y-1" : "p-2")}>
        <Link
          href="/pricing"
          onClick={onNavigate}
          className={cn(
            "block text-sm text-text-muted outline-none transition-colors hover:text-text-primary",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70",
            isMobile
              ? "rounded-xl px-4 py-3 font-medium hover:bg-graphite-900"
              : "rounded-md px-2 py-2 hover:bg-graphite-850"
          )}
        >
          Buy more credits
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "flex w-full items-center gap-2 text-left text-sm text-text-muted outline-none transition-colors hover:text-text-primary disabled:opacity-50",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70",
            isMobile
              ? "rounded-xl px-4 py-3 font-medium hover:bg-graphite-900"
              : "rounded-md px-2 py-2 hover:bg-graphite-850"
          )}
        >
          {signingOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <LogOut className="h-3.5 w-3.5" aria-hidden />
          )}
          Sign out
        </button>

        {/* Says what sign-out actually does. The server nulls the account link
            but the ledger is append-only, so nothing is lost — exactly what
            someone hesitating over this button needs to know first. */}
        <p
          className={cn(
            "text-[11px] leading-relaxed text-text-subtle",
            isMobile ? "px-4 pt-1" : "px-2 pb-1 pt-1.5"
          )}
        >
          Your credits stay on your account — sign back in any time with{" "}
          {me.email}.
        </p>
      </div>
    </div>
  );
}

/**
 * The mobile counterpart to the QR: mail myself a link so I can sign in on a
 * laptop or tablet.
 */
function EmailDeviceLink() {
  const { me } = useCredits();
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = me?.email;

  const send = useCallback(async () => {
    if (sending || !email) return;
    setSending(true);
    setError(null);
    try {
      await requestMagicLink(email);
      trackCredits("credits_magic_link_requested", { source: "mobile_menu" });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many sign-in emails. Try again in an hour."
          : "That didn't send. Try again in a moment."
      );
    } finally {
      setSending(false);
    }
  }, [sending, email]);

  if (sent) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 text-xs leading-relaxed text-amber-400"
      >
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Sign-in link sent. Open it on the device you want to use — it works
          once and expires in 30 minutes.
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={send}
        disabled={sending}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border border-graphite-700 px-4 py-2.5 text-sm font-medium text-text-muted",
          "outline-none transition-colors hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-50",
          "focus-visible:ring-2 focus-visible:ring-amber-400/70"
        )}
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Mail className="h-4 w-4" aria-hidden />
        )}
        Use on another device
      </button>
      {error ? (
        <p role="alert" className="text-[11px] text-red-400">
          {error}
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Emails a sign-in link you can open on a laptop or tablet.
        </p>
      )}
    </div>
  );
}