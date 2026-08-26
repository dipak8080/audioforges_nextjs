"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getCreditsMe, requestMagicLink } from "@/lib/api/credits";
import { DeviceLinkQr } from "@/components/credits/DeviceLinkQr";
import { useCredits } from "@/components/credits/CreditProvider";
import { trackCredits } from "@/lib/analytics";
import EmailLink from "@/components/EmailLink";
import type { CreditsMe } from "@/lib/types/credits";

/**
 * THE SCARIEST SCREEN IN THE PRODUCT.
 *
 * The user has just paid. Money has left their account. Whatever happens
 * next, this page must never leave them staring at a spinner with no
 * recourse — that is how a $3 purchase becomes a chargeback and a
 * one-star review.
 *
 * THREE DESIGN RULES, EACH LOAD-BEARING:
 *
 * 1. THE POLL HAS A CEILING. 60 seconds, then it stops and says so. An
 *    unbounded spinner is worse than an honest "this is taking longer
 *    than usual, here's what to do".
 *
 * 2. IT DOES NOT USE THE CREDIT PROVIDER'S STATE. A payment can land at
 *    any moment, including while PAYWALL_ENABLED is false — /credits/claim
 *    deliberately works with the paywall off. The provider is INERT in
 *    that state and would report a permanent zero. So this page calls
 *    getCreditsMe() directly and only syncs the provider afterwards, to
 *    refresh the navbar pill.
 *
 * 3. THE FAILURE STATE IS ACTIONABLE. Not "contact support" — a
 *    resend-my-sign-in-link button and a real email address, because the
 *    two actual causes (slow webhook, paid from a different browser) have
 *    two different fixes and the user can perform both.
 *
 * WHY IT USUALLY RESOLVES INSTANTLY: the Ko-fi webhook is confirmed at
 * <10ms and fires before the buyer's browser finishes redirecting back
 * here. So the FIRST fetch normally already shows the purchase. The
 * polling exists for the rare case, not the common one.
 */

const POLL_INTERVAL_MS = 2_000;
const POLL_CEILING_MS = 60_000;
/** A purchase older than this belongs to an earlier visit, not this one. */
const RECENT_PURCHASE_WINDOW_MS = 30 * 60_000;

type Phase = "checking" | "confirmed" | "timeout";

export default function CheckoutSuccessPage() {
  const { refresh: refreshProvider } = useCredits();

  const [phase, setPhase] = useState<Phase>("checking");
  const [me, setMe] = useState<CreditsMe | null>(null);

  // Captured on the first fetch. Comparing against it is what lets us
  // detect a top-up by someone who ALREADY had credits — "balance > 0"
  // would read as success the instant the page loaded and would have
  // celebrated a purchase that never landed.
  const baselineBalance = useRef<number | null>(null);
  // Set inside the effect, not at render time: Date.now() is impure, and
  // calling it during render makes the deadline shift on any re-render.
  const startedAt = useRef(0);
  const stopped = useRef(false);

  const succeed = useCallback(
    (next: CreditsMe) => {
      if (stopped.current) return;
      stopped.current = true;
      setMe(next);
      setPhase("confirmed");
      trackCredits("credits_purchase_confirmed", { balance: next.balance });
      // Sync the navbar pill. Fire-and-forget: this page already has the
      // authoritative number, so a failure here changes nothing on screen.
      void refreshProvider();
    },
    [refreshProvider]
  );

  useEffect(() => {
    trackCredits("credits_checkout_returned");
    startedAt.current = Date.now();

    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (stopped.current) return;

      const next = await getCreditsMe();

      if (next) {
        setMe(next);

        // First response establishes the baseline AND covers the common
        // case: the webhook already landed, so a purchase is sitting in
        // `recent` before this page even rendered.
        if (baselineBalance.current === null) {
          baselineBalance.current = next.balance;

          const justPurchased = next.recent.some((entry) => {
            if (entry.kind !== "purchase") return false;
            const at = Date.parse(entry.created_at);
            return (
              !Number.isNaN(at) && Date.now() - at < RECENT_PURCHASE_WINDOW_MS
            );
          });

          if (justPurchased) {
            succeed(next);
            return;
          }
        } else if (next.balance > baselineBalance.current) {
          // The webhook landed while we were watching.
          succeed(next);
          return;
        }
      }

      if (Date.now() - startedAt.current >= POLL_CEILING_MS) {
        stopped.current = true;
        setPhase("timeout");
        trackCredits("credits_checkout_timeout");
        return;
      }

      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    void tick();

    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
    // Runs once on mount. `succeed` is stable via useCallback.
  }, [succeed]);

  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-16 sm:py-24">
      {phase === "checking" && <CheckingState />}
      {phase === "confirmed" && me && <ConfirmedState me={me} />}
      {phase === "timeout" && <TimeoutState />}
    </main>
  );
}

/* ------------------------------------------------------------------ */

function CheckingState() {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-graphite-700 bg-graphite-900">
        <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
      </div>
      <h1 className="text-xl font-semibold text-text-primary">
        Confirming your payment
      </h1>
      {/*
        Says what is happening and roughly how long. "Please wait" tells
        the user nothing and makes ten seconds feel like a minute.
      */}
      <p className="text-sm leading-relaxed text-text-muted">
        This usually takes a few seconds. Keep this tab open — your credits
        will appear here automatically.
      </p>
    </div>
  );
}

function ConfirmedState({ me }: { me: CreditsMe }) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
        <Check className="h-6 w-6 text-amber-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          You&apos;re all set
        </h1>
        <p className="text-sm text-text-muted">Thanks for supporting AudioForges.</p>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-6 py-5">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-3xl font-semibold text-amber-400">
            {me.balance}
          </span>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {me.balance === 1 ? "credit" : "credits"} ready to use
        </p>
        {me.email && (
          /*
            Pre-empts the ONLY friction point in the whole access model:
            credits live on this browser's cookie, so a phone or a work
            machine shows zero until it's linked. That question becomes a
            support message if the answer isn't already on screen at the
            moment they're most receptive — and the link is already in
            their inbox, so the answer costs one sentence.
          */
          <p className="mt-3 border-t border-amber-500/15 pt-3 text-xs leading-relaxed text-text-subtle">
            Ready to use on this device right now. We&apos;ve also emailed{" "}
            <span className="text-text-muted">{me.email}</span> a sign-in link —
            open it on your phone or any other browser to use these credits
            there too.
          </p>
        )}
      </div>

      {/*
        The four-second version of the emailed link, offered at the one
        moment the user is definitely at a computer with their phone
        nearby. The email is still sent — this just removes the wait for
        anyone who wants their phone linked now.
      */}
      {me.authenticated && (
        <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 text-left">
          <DeviceLinkQr />
        </div>
      )}

      {/*
        Straight back to work. The user came here to separate a track, not
        to buy credits; the purchase was an obstacle they just cleared.
      */}
      <div className="space-y-2">
        <Link href="/vocal-remover" className="block">
          <Button variant="primary" size="lg" className="w-full">
            Back to Vocal Remover
          </Button>
        </Link>
        <Link href="/stems" className="block">
          <Button variant="ghost" size="md" className="w-full">
            Or split into stems
          </Button>
        </Link>
      </div>

      <p className="text-xs leading-relaxed text-text-subtle">
        Credits never expire. If a run ever fails, its credit returns
        automatically.
      </p>
    </div>
  );
}

/**
 * The 60-second ceiling was reached. Two real causes, two real fixes —
 * both offered here rather than a dead-end "contact support".
 */
function TimeoutState() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The address they typed at checkout, so the recovery form is usually
  // pre-filled and one click away. Lazy initializer rather than an effect:
  // no blank-then-filled flicker, and no setState inside an effect.
  const [email, setEmailValue] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem("af_claim_email") ?? "";
    } catch {
      /* storage disabled */
      return "";
    }
  });

  async function send() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter the email you paid with.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await requestMagicLink(trimmed);
      trackCredits("credits_magic_link_requested", { source: "checkout_timeout" });
      setSent(true);
    } catch {
      setError("We couldn't send that right now. Please email us instead.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-graphite-700 bg-graphite-900">
          <AlertCircle className="h-5 w-5 text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">
          Taking longer than usual
        </h1>
        {/*
          The most important sentence on the page. The user's fear right
          now is that their money vanished. It didn't, and saying so
          plainly — before any instructions — is the whole job.
        */}
        <p className="text-sm leading-relaxed text-text-muted">
          If your payment went through, your credits are safe — they&apos;re
          attached to the email you paid with, not to this page. Nothing is
          lost.
        </p>
      </div>

      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
        <h2 className="text-sm font-medium text-text-primary">
          Get your credits on this browser
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          Enter the email you paid with and we&apos;ll send a sign-in link.
        </p>

        {sent ? (
          <p className="mt-4 flex items-start gap-2 text-sm text-amber-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              If that email has credits, a sign-in link is on its way. It expires
              in 30 minutes.
            </span>
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-label="Email you paid with"
              value={email}
              onChange={(e) => {
                setEmailValue(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              disabled={sending}
              placeholder="you@example.com"
              className="w-full rounded-md border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary placeholder:text-text-subtle/60 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50"
            />
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <Button
              variant="primary"
              size="md"
              loading={sending}
              onClick={() => void send()}
              className="w-full"
            >
              <Mail className="h-4 w-4" />
              Send sign-in link
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
        <h2 className="text-sm font-medium text-text-primary">Still stuck?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          Email us with the address you paid from and we&apos;ll add your credits
          manually.{" "}
          <EmailLink
            user="contact"
            domain="audioforges.com"
            className="text-amber-400 underline-offset-4 hover:underline"
          />
        </p>
      </div>

      <p className="text-center text-xs text-text-subtle">
        <Link href="/" className="underline-offset-4 hover:text-text-muted hover:underline">
          Back to AudioForges
        </Link>
      </p>
    </div>
  );
}