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

/** Shared account block for the desktop popover and the mobile sheet. */
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
      // refresh() below reads the real session state
    }
    await refresh();
    setSigningOut(false);
    onNavigate?.();
  }, [signingOut, refresh, onNavigate]);

  const resetsAt = me?.free_resets_at;
  const resetsOn = useMemo(() => {
    if (!resetsAt) return null;
    const d = new Date(resetsAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }, [resetsAt]);

  const isMobile = variant === "mobile";

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

  if (!me?.authenticated) {
    const spent = freeRemaining <= 0;
    return (
      <div
        className={cn(
          isMobile ? "rounded-xl border border-graphite-800 bg-graphite-900 p-4" : "px-4 py-3"
        )}
      >
        <div className="flex items-center gap-2">
          <Sparkles
            className={cn("h-3.5 w-3.5", spent ? "text-text-subtle" : "text-amber-400")}
            aria-hidden
          />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
            Free this month
          </p>
        </div>
        <p
          className={cn(
            "mt-1.5 font-mono text-2xl font-semibold tabular-nums",
            spent ? "text-text-muted" : "text-amber-400"
          )}
        >
          {freeRemaining}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {spent
            ? `runs left${resetsOn ? `, resets ${resetsOn}` : " this month"}`
            : `${freeRemaining === 1 ? "run" : "runs"} left on any paid tool${
                resetsOn ? `, resets ${resetsOn}` : ""
              }`}
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
          {spent ? "Get credits to keep going" : "See what credits cost"}
        </Link>
      </div>
    );
  }

  const hasHistory = (me.recent?.length ?? 0) > 0;
  const isEmpty = balance <= 0 && heldCredits <= 0;
  const neverFunded = isEmpty && !hasHistory;

  const cardClass = isMobile
    ? "rounded-xl border border-graphite-800 bg-graphite-900 p-4"
    : "border-b border-graphite-800 px-4 py-3.5";

  const signOutBlock = (
    <div className={cn(isMobile ? "space-y-1" : "p-2")}>
      {!isEmpty && (
        <Link href="/pricing" onClick={onNavigate} className={rowClass()}>
          Buy more credits
        </Link>
      )}
      <button type="button" onClick={handleSignOut} disabled={signingOut} className={rowClass()}>
        {signingOut ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <LogOut aria-hidden />}
        Sign out
      </button>
      {!neverFunded && (
        <p
          className={cn(
            "text-[11px] leading-relaxed text-text-subtle",
            isMobile ? "px-4 pt-1" : "px-2 pb-1 pt-1.5"
          )}
        >
          Your credits stay on your account.
          {me.email ? ` Sign back in any time with ${me.email}.` : " Sign back in any time."}
        </p>
      )}
    </div>
  );

  if (isEmpty) {
    return (
      <div className={cn(isMobile && "space-y-3")}>
        <div className={cardClass}>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
            {neverFunded ? "Signed in" : "Balance"}
          </p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {neverFunded ? "No credits on this account yet" : "0 credits left"}
          </p>
          {me.email && (
            <p className="mt-0.5 truncate text-xs text-text-subtle" title={me.email}>
              {me.email}
            </p>
          )}

          {freeRemaining > 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-text-muted">
              You still have <span className="tabular-nums text-teal-400">{freeRemaining}</span> free{" "}
              {freeRemaining === 1 ? "run" : "runs"} this month{resetsOn ? ` (resets ${resetsOn})` : ""}. No need
              to buy yet.
            </p>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-text-muted">
              Free runs are used up{resetsOn ? ` until ${resetsOn}` : " for this month"}.
            </p>
          )}

          <p className="mt-2 text-xs leading-relaxed text-text-subtle">
            Credits unlock Studio Quality separation, transcription, high-accuracy MIDI and sheet music. Every
            other tool is free.
          </p>

          <Link
            href="/pricing"
            onClick={onNavigate}
            className={buttonStyles({
              variant: freeRemaining > 0 ? "outline" : "primary",
              size: "md",
              className: "mt-3 w-full",
            })}
          >
            {freeRemaining > 0 ? "See credit packs" : "Get credits"}
          </Link>

          {neverFunded && (
            <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
              Paid with a different email? Sign out and sign in with that one.
            </p>
          )}
        </div>
        {signOutBlock}
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
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">Balance</p>
        <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-400">{balance}</p>
        <p className="text-xs text-text-muted">{balance === 1 ? "credit" : "credits"}</p>

        {freeRemaining > 0 && (
          <p className="mt-1.5 text-xs text-text-muted">
            <span className="tabular-nums text-teal-400">{freeRemaining}</span> free{" "}
            {freeRemaining === 1 ? "run" : "runs"} left on any paid tool
            {resetsOn ? `, resets ${resetsOn}` : ""}
          </p>
        )}

        {me.email && (
          <p className="mt-2 truncate text-xs text-text-subtle" title={me.email}>
            {me.email}
          </p>
        )}

        {heldCredits > 0 && (
          <p className="mt-2 border-t border-amber-500/15 pt-2 text-[11px] leading-relaxed text-text-muted">
            {heldCredits === 1 ? "1 credit is" : `${heldCredits} credits are`} held while a run finishes.
            Closing the page doesn&apos;t stop it. Spent if it succeeds, returned on its own if it doesn&apos;t.
          </p>
        )}
      </div>

      <div className={cardClass}>{isMobile ? <EmailDeviceLink /> : <DeviceLinkQr />}</div>

      {signOutBlock}
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
          Sign-in link sent. Open it on the device you want to use. It works once and expires in
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