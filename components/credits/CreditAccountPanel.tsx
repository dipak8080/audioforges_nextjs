"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Loader2, LogOut, Mail, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { DeviceLinkQr } from "./DeviceLinkQr";
import { logout, requestMagicLink } from "@/lib/api/credits";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";

/**
 * The account block. ONE implementation, rendered in two places — the
 * desktop navbar popover and the mobile sheet — so the two can't drift
 * into saying different things about the same account.
 *
 * THE DESKTOP / MOBILE DIFFERENCE THAT ACTUALLY MATTERS
 *
 * The QR code is a DESKTOP-TO-PHONE affordance. You scan it with a
 * different device than the one displaying it. Rendering "Use on my
 * phone" on a phone is nonsense — there is no second camera to point at
 * the screen.
 *
 * So mobile gets the honest equivalent instead: email me a sign-in link,
 * which is how you'd reach a laptop or a tablet from here. Same job,
 * right tool for the device.
 */
export function CreditAccountPanel({
  variant,
  onNavigate,
}: {
  variant: "desktop" | "mobile";
  /** Close the containing menu/sheet after a navigation. */
  onNavigate?: () => void;
}) {
  const { me, balance, heldCredits, refresh } = useCredits();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // The server is the source of truth for whether the session
      // survived, so refetching is the honest next step either way.
    }
    await refresh();
    setSigningOut(false);
    onNavigate?.();
  }, [signingOut, refresh, onNavigate]);

  if (!me?.authenticated) return null;

  const isMobile = variant === "mobile";

  return (
    <div className={cn(isMobile && "space-y-3")}>
      <div
        className={cn(
          isMobile
            ? "rounded-xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3"
            : "border-b border-graphite-800 px-4 py-3"
        )}
      >
        <p className="font-mono text-lg text-amber-400">
          {balance} {balance === 1 ? "credit" : "credits"}
        </p>
        {/* Whose account. Matters the moment someone has a work address
            and a personal one, with credits on only one. */}
        <p className="mt-0.5 truncate text-xs text-text-subtle">{me.email}</p>
        {heldCredits > 0 && (
          <p className="mt-1.5 text-[11px] text-text-muted">
            {heldCredits} held by a running job — returned automatically if it
            fails.
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
            "block text-sm text-text-muted transition-colors hover:text-text-primary",
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
            "flex w-full items-center gap-2 text-left text-sm text-text-muted transition-colors hover:text-text-primary disabled:opacity-50",
            isMobile
              ? "rounded-xl px-4 py-3 font-medium hover:bg-graphite-900"
              : "rounded-md px-2 py-2 hover:bg-graphite-850"
          )}
        >
          {signingOut ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LogOut className="h-3.5 w-3.5" />
          )}
          Sign out
        </button>

        {/* Says what sign-out actually does. The server nulls the account
            link but the ledger is append-only, so nothing is lost — which
            is exactly what someone hesitating over this button needs to
            know before pressing it. */}
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
 * The mobile counterpart to the QR: mail myself a link so I can sign in
 * on a laptop or tablet.
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
          : "Couldn't send that right now. Please try again."
      );
    } finally {
      setSending(false);
    }
  }, [sending, email]);

  if (sent) {
    return (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-400">
        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-graphite-700 px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:border-amber-500/40 hover:text-amber-400 disabled:opacity-50"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
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