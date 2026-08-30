"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Mail, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { buttonStyles } from "@/components/ui/Button";
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
 * IT NO LONGER RENDERS NOTHING FOR FREE USERS (2026-08-21). This returned
 * `null` unless authenticated, so a free-tier visitor opening the mobile sheet
 * saw no trace of the two runs they have. The free state is the top of the
 * entire funnel — it gets a block of its own.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 0. THE FREE ALLOWANCE IS NOT "STUDIO QUALITY RUNS". `free_usage` has no tool
 *    in its key — N ops is N TOTAL across HQ separation, transcription and
 *    multi-track MIDI, not N per tool. Calling them Studio Quality runs sends
 *    someone who spent both on transcripts to a stem page expecting runs they
 *    no longer have, which is the exact bounce the backend notes predict.
 *
 * 1. A SIGNED-IN USER'S FREE RUNS WERE INVISIBLE. The authenticated block shows
 *    the credit balance and nothing else, so someone with 0 credits and 2 free
 *    Studio Quality runs left read "0 credits" and concluded they had nothing.
 *    They then either bought a pack they didn't need yet or left. Free runs are
 *    now stated on the same card, in the same readout language.
 *
 * 2. `me.email` COULD RENDER AS AN EMPTY LINE. The type allows null, and both
 *    the balance card and the sign-out note printed it unguarded — one blank
 *    row, one sentence ending in " with .".
 *
 * 3. THE HELD-CREDITS NOTE WAS FOUR SENTENCES INSIDE A POPOVER. Everything it
 *    said was true and worth saying; it just didn't need to be said at that
 *    length in a 288px-wide panel. Two sentences, same facts.
 *
 * 4. EVERY BUTTON AND LINK HERE IS `buttonStyles` NOW. Four hand-rolled
 *    surfaces, four sets of padding and focus ring, none with a press state.
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

  /** Full-width row, used by every action in this panel. Mobile gets more
   *  height because it's a touch target; desktop stays compact in a popover. */
  const rowClass = (extra?: string) =>
    buttonStyles({
      variant: "ghost",
      size: isMobile ? "lg" : "md",
      className: cn(
        "w-full justify-start text-sm text-text-muted hover:text-text-primary",
        isMobile ? "rounded-xl px-4 font-medium" : "rounded-md px-2",
        extra
      ),
    });

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
          isMobile ? "rounded-xl border border-graphite-800 bg-graphite-900 p-4" : "px-4 py-3"
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
        {/* Says "runs", not "Studio Quality runs". The counter is per subject,
            not per tool: these are spendable on HQ separation, transcription or
            multi-track MIDI, whichever comes first. */}
        <p className="mt-0.5 text-xs text-text-muted">
          {freeRemaining === 1 ? "run" : "runs"} left on any paid tool
          {resetsOn ? `, resets ${resetsOn}` : ""}
        </p>
        <Link
          href="/pricing"
          onClick={onNavigate}
          className={buttonStyles({
            variant: "outline",
            size: "md",
            className: "mt-3 w-full text-text-muted hover:border-amber-500/40 hover:text-amber-400",
          })}
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
        <p className="text-xs text-text-muted">{balance === 1 ? "credit" : "credits"}</p>

        {/* A signed-in user's free runs used to be invisible here. Someone at 0
            credits with 2 free Studio Quality runs left read "0 credits" and
            concluded they had nothing to run with. */}
        {freeRemaining > 0 && (
          <p className="mt-1.5 text-xs text-text-muted">
            <span className="tabular-nums text-teal-400">{freeRemaining}</span> free{" "}
            {freeRemaining === 1 ? "run" : "runs"} left on any paid tool
            {resetsOn ? `, resets ${resetsOn}` : ""}
          </p>
        )}

        {/* Whose account. Matters the moment someone has a work address and a
            personal one, with credits on only one. Guarded: the type allows
            null, and an unguarded render left a blank row here. */}
        {me.email && (
          <p className="mt-2 truncate text-xs text-text-subtle" title={me.email}>
            {me.email}
          </p>
        )}

        {heldCredits > 0 && (
          /*
            This used to say "held by a running job — returned automatically if
            it fails", which is true and still leaves someone stuck: the common
            way to see it is start a job, press Cancel, and find a credit still
            held. Cancel stops the PAGE watching; it does not stop the job.

            The four-sentence version that replaced it was right and too long
            for a 288px popover. Same two facts, one line each: why it's held,
            and that it resolves without them.
          */
          <p className="mt-2 border-t border-amber-500/15 pt-2 text-[11px] leading-relaxed text-text-muted">
            {heldCredits === 1 ? "1 credit is" : `${heldCredits} credits are`} held while a run
            finishes — cancelling or closing the page doesn&apos;t stop it. Spent if it
            succeeds, returned on its own if it doesn&apos;t.
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
        <Link href="/pricing" onClick={onNavigate} className={rowClass()}>
          Buy more credits
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={rowClass()}
        >
          {signingOut ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" />
          ) : (
            <LogOut aria-hidden />
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
          Your credits stay on your account
          {me.email ? ` — sign back in any time with ${me.email}.` : " — sign back in any time."}
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
      <p role="status" className="flex items-start gap-2 text-xs leading-relaxed text-amber-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Sign-in link sent. Open it on the device you want to use — it works once and expires in
          30 minutes.
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={send}
        /* Disabled rather than `loading`: there's nothing underneath to keep in
           place, and this button genuinely can't be pressed again until the
           request settles. */
        disabled={sending || !email}
        className={buttonStyles({
          variant: "outline",
          size: "md",
          className: "w-full text-text-muted hover:border-amber-500/40 hover:text-amber-400",
        })}
      >
        {sending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Mail aria-hidden />}
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