"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail, AlertCircle } from "lucide-react";
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
 * Money has left their account. Whatever happens next, this page must never
 * leave them at a spinner with no recourse — that is how a $3 purchase
 * becomes a chargeback and a one-star review.
 *
 * THREE RULES, EACH LOAD-BEARING:
 *
 * 1. THE POLL HAS A CEILING. 60 seconds, then it stops and says so.
 * 2. IT DOES NOT READ THE PROVIDER'S STATE. A payment can land while
 *    PAYWALL_ENABLED is false — /credits/claim deliberately works with the
 *    paywall off — and the provider is inert in that state, reporting a
 *    permanent zero. This page calls getCreditsMe() directly and only syncs
 *    the provider afterwards, to refresh the navbar pill.
 * 3. THE FAILURE STATE IS ACTIONABLE. The two real causes (slow webhook,
 *    paid from a different browser) have two different fixes and the user
 *    can perform both.
 *
 * THREE BUGS FIXED IN THIS PASS:
 *
 *   a. StrictMode killed the poll. `stopped.current` was set true by the
 *      cleanup of the first mount and never reset, so on the second mount
 *      tick() returned immediately and the page sat on "checking" until the
 *      ceiling — in dev, every single time. Both refs now reset on entry.
 *   b. `next.recent.some(...)` threw if the payload had no `recent` array.
 *      An exception inside tick() rejected an un-awaited promise, killing
 *      the loop silently with the spinner still on screen. Now guarded, and
 *      the whole body is wrapped so a transient failure retries instead of
 *      ending the poll.
 *   c. Fixed 2s polling meant 30 requests to /credits/me in a minute, on the
 *      one endpoint this codebase deliberately keeps cheap. Now backs off:
 *      ~1.5s while the webhook is plausibly in flight, then 3s, then 5s —
 *      about 15 requests, with a faster first check than before.
 *
 * WHY IT USUALLY RESOLVES INSTANTLY: the Ko-fi webhook is confirmed at <10ms
 * and fires before the browser finishes redirecting here, so the FIRST fetch
 * normally already shows the purchase. Polling is for the rare case.
 */

const POLL_CEILING_MS = 60_000;
/** Past this, say so. Silence for a minute reads as a broken page. */
const SLOW_AFTER_MS = 15_000;
/** A purchase older than this belongs to an earlier visit, not this one. */
const RECENT_PURCHASE_WINDOW_MS = 30 * 60_000;
const DEFAULT_RETURN = { path: "/vocal-remover", label: "Vocal Remover" };

function pollDelay(elapsedMs: number) {
  if (elapsedMs < 10_000) return 1_500;
  if (elapsedMs < 30_000) return 3_000;
  return 5_000;
}

type Phase = "checking" | "confirmed" | "timeout";
type ReturnTarget = { path: string; label: string | null };

/**
 * Where the user was when they opened the gate. Written by CreditGateModal
 * before the same-tab redirect to Ko-fi, because that redirect tears down the
 * tool page and this one would otherwise send everybody to /vocal-remover —
 * wrong the moment they were splitting stems from a YouTube link.
 *
 * Lazy initializer, not an effect: no blank-then-filled flicker, and no
 * setState inside an effect.
 */
function readReturnTarget(): ReturnTarget {
  if (typeof window === "undefined") return DEFAULT_RETURN;
  try {
    const raw = window.localStorage.getItem("af_return_to");
    if (!raw) return DEFAULT_RETURN;
    const parsed = JSON.parse(raw) as Partial<ReturnTarget>;
    // Same-origin paths only. Never navigate to something a storage value
    // could have been made to contain.
    if (typeof parsed.path === "string" && /^\/[^/\\]/.test(parsed.path)) {
      return { path: parsed.path, label: parsed.label ?? null };
    }
  } catch {
    /* storage disabled or malformed */
  }
  return DEFAULT_RETURN;
}

export default function CheckoutSuccessPage() {
  const { refresh: refreshProvider } = useCredits();

  const [phase, setPhase] = useState<Phase>("checking");
  const [slow, setSlow] = useState(false);
  const [me, setMe] = useState<CreditsMe | null>(null);
  const [returnTo] = useState<ReturnTarget>(readReturnTarget);

  // Captured on the first fetch. Comparing against it is what detects a
  // top-up by someone who ALREADY had credits — "balance > 0" would read as
  // success the instant the page loaded and would celebrate a purchase that
  // never landed.
  const baselineBalance = useRef<number | null>(null);
  // Set inside the effect, not at render: Date.now() is impure, and calling
  // it during render makes the deadline shift on every re-render.
  const startedAt = useRef(0);
  const stopped = useRef(false);

  const succeed = useCallback(
    (next: CreditsMe) => {
      if (stopped.current) return;
      stopped.current = true;
      setMe(next);
      setPhase("confirmed");
      trackCredits("credits_purchase_confirmed", { balance: next.balance });
      // Sync the navbar pill. Fire-and-forget: this page already holds the
      // authoritative number, so a failure here changes nothing on screen.
      void refreshProvider();
      try {
        window.localStorage.removeItem("af_return_to");
      } catch {
        /* storage disabled */
      }
    },
    [refreshProvider]
  );

  useEffect(() => {
    // FIX (a): reset every ref on entry. StrictMode remounts, and a
    // `stopped` left true from the first cleanup kills the second poll.
    stopped.current = false;
    baselineBalance.current = null;
    startedAt.current = Date.now();
    setSlow(false);

    trackCredits("credits_checkout_returned");

    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      if (stopped.current) return;

      // FIX (b): one throw used to end the poll for good, leaving the
      // spinner up. A bad tick is now just a tick that found nothing.
      try {
        const next = await getCreditsMe();

        if (next) {
          setMe(next);

          if (baselineBalance.current === null) {
            baselineBalance.current = next.balance;

            // The common case: the webhook landed before this page rendered,
            // so the purchase is already sitting in `recent`.
            const justPurchased = (next.recent ?? []).some((entry) => {
              if (entry.kind !== "purchase") return false;
              const at = Date.parse(entry.created_at);
              return !Number.isNaN(at) && Date.now() - at < RECENT_PURCHASE_WINDOW_MS;
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
      } catch {
        /* transient — fall through and retry until the ceiling */
      }

      if (stopped.current) return;

      const elapsed = Date.now() - startedAt.current;
      if (elapsed >= SLOW_AFTER_MS) setSlow(true);

      if (elapsed >= POLL_CEILING_MS) {
        stopped.current = true;
        setPhase("timeout");
        trackCredits("credits_checkout_timeout");
        return;
      }

      timer = setTimeout(tick, pollDelay(elapsed));
    }

    void tick();

    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
    // Runs once on mount. `succeed` is stable via useCallback.
  }, [succeed]);

  return (
    <main id="main" className="mx-auto max-w-md px-4 py-16 sm:py-24">
      {phase === "checking" && <CheckingState slow={slow} />}
      {phase === "confirmed" && me && <ConfirmedState me={me} returnTo={returnTo} />}
      {phase === "timeout" && <TimeoutState returnTo={returnTo} />}
    </main>
  );
}

/* ------------------------------------------------------------------ */

function CheckingState({ slow }: { slow: boolean }) {
  return (
    <div
      className="space-y-4 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-graphite-700 bg-graphite-900">
        <Loader2 className="h-5 w-5 animate-spin text-amber-400 motion-reduce:animate-none" />
      </div>
      <h1 className="text-xl font-semibold text-text-primary">
        Confirming your payment
      </h1>
      {/* Says what's happening and roughly how long. "Please wait" tells the
          user nothing and makes ten seconds feel like a minute. */}
      <p className="text-sm leading-relaxed text-text-muted">
        This usually takes a few seconds. Keep this tab open — your credits
        appear here on their own.
      </p>
      {slow && (
        <p className="text-sm leading-relaxed text-text-subtle">
          Still going. Ko-fi is occasionally slow to notify us; your payment
          isn&apos;t affected and nothing needs doing yet.
        </p>
      )}
    </div>
  );
}

function ConfirmedState({
  me,
  returnTo,
}: {
  me: CreditsMe;
  returnTo: ReturnTarget;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <Check className="h-6 w-6 text-amber-400" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Credits added
          </h1>
          {/* Not "thanks for supporting AudioForges" — that's Ko-fi's donation
              register leaking in, and it reframes a purchase as charity right
              after someone paid for a product. */}
          <p className="text-sm text-text-muted">
            They&apos;re on this browser and ready now.
          </p>
        </div>
      </div>

      {/* The number, in the same mono readout language as the pack rail. */}
      <div className="overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/5">
        <div className="px-6 py-5 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400/70">
            Balance
          </p>
          <p className="mt-1 font-mono text-4xl font-semibold tabular-nums text-amber-400">
            {me.balance}
          </p>
          <p className="mt-0.5 text-sm text-text-muted">
            {me.balance === 1 ? "credit" : "credits"}
          </p>
        </div>
        {me.email && (
          /*
            Pre-empts the only friction point in the access model: credits
            live on this browser's cookie, so a phone or a work machine shows
            zero until it's linked. That question becomes a support message
            if the answer isn't on screen at the moment they're most
            receptive — and the link is already in their inbox, so it costs
            one sentence.
          */
          <p className="border-t border-amber-500/15 px-5 py-3.5 text-xs leading-relaxed text-text-subtle">
            We emailed{" "}
            <span className="text-text-muted">{me.email}</span> a sign-in link.
            Open it on your phone or any other browser to use these credits
            there too.
          </p>
        )}
      </div>

      {/*
        The four-second version of the emailed link, offered at the one moment
        the user is definitely at a computer with their phone nearby.
      */}
      {me.authenticated && (
        <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
          <DeviceLinkQr />
        </div>
      )}

      {/*
        Straight back to work, and back to the RIGHT tool — they came here to
        separate a track, and the purchase was an obstacle they just cleared.
      */}
      <div className="space-y-2">
        <Link href={returnTo.path} className="block">
          <Button variant="primary" size="lg" className="w-full">
            {returnTo.label ? `Back to ${returnTo.label}` : "Back to the tool"}
          </Button>
        </Link>

        {/*
          Honest about the one thing that IS lost. Paying is a same-tab trip
          to Ko-fi, so the tool page was torn down and the file went with it.
          Better said here than discovered as an empty upload box.
        */}
        <p className="px-2 pt-1 text-center text-xs leading-relaxed text-text-subtle">
          You&apos;ll need to add your track again — the trip to Ko-fi cleared
          the page. The run itself will use one credit.
        </p>
      </div>

      <p className="border-t border-graphite-800 pt-5 text-center text-xs leading-relaxed text-text-subtle">
        Credits never expire and work on every tool that takes them. If a run
        ever fails, its credit returns automatically.
      </p>
    </div>
  );
}

/**
 * The 60-second ceiling was reached. Two real causes, two real fixes — both
 * offered here rather than a dead-end "contact support".
 */
function TimeoutState({ returnTo }: { returnTo: ReturnTarget }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The address typed at checkout, so the recovery form is usually pre-filled
  // and one click away. Lazy initializer rather than an effect: no
  // blank-then-filled flicker, and no setState inside an effect.
  const [email, setEmailValue] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem("af_claim_email") ?? "";
    } catch {
      return "";
    }
  });

  async function send() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter the email you paid with.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await requestMagicLink(trimmed);
      trackCredits("credits_magic_link_requested", { source: "checkout_timeout" });
      setSent(true);
    } catch {
      setError("That didn't send. Email us instead and we'll do it by hand.");
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
          The most important sentence on the page. The fear right now is that
          the money vanished. It didn't, and saying so plainly — before any
          instructions — is the whole job.
        */}
        <p className="text-sm leading-relaxed text-text-muted">
          If your payment went through, your credits are safe. They&apos;re
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
          <p
            role="status"
            className="mt-4 flex items-start gap-2 text-sm text-amber-400"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              If that email has credits, a sign-in link is on its way. It
              expires in 30 minutes.
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
              aria-invalid={!!error}
              className="w-full rounded-md border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary outline-none transition-colors placeholder:text-text-subtle/60 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50"
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
          Email us with the address you paid from and we&apos;ll add your
          credits by hand.{" "}
          <EmailLink
            user="contact"
            domain="audioforges.com"
            className="text-amber-400 underline-offset-4 hover:underline"
          />
        </p>
      </div>

      <p className="text-center text-xs text-text-subtle">
        <Link
          href={returnTo.path}
          className="underline-offset-4 hover:text-text-muted hover:underline"
        >
          {returnTo.label ? `Back to ${returnTo.label}` : "Back to AudioForges"}
        </Link>
      </p>
    </div>
  );
}