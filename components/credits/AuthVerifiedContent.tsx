"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail, Sparkles, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getCreditsMe, requestMagicLink } from "@/lib/api/credits";
import { useCredits } from "./CreditProvider";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";
import EmailLink from "@/components/EmailLink";
import type { CreditsMe } from "@/lib/types/credits";

/**
 * Landing page for the magic-link redirect.
 *
 * The backend redirects here as ?status=ok|expired|used|invalid. Those
 * four were deliberately separated (they used to be two) because three of
 * them are RECOVERABLE and only one isn't — and "invalid" reads like an
 * accusation when the real cause is a 30-minute timeout.
 *
 * Like the checkout return page, this calls getCreditsMe() directly
 * rather than reading the provider: a magic link can be used at any time,
 * including while PAYWALL_ENABLED is false, and the provider is inert in
 * that state.
 *
 * Anything unrecognised is treated as `invalid`. A malformed status must
 * never render a blank page on the screen where someone is trying to
 * reach credits they paid for.
 */

export type VerifyStatus = "ok" | "expired" | "used" | "invalid";

export function AuthVerifiedContent({ status }: { status: VerifyStatus }) {
  if (status === "ok") return <SignedIn />;
  if (status === "expired") {
    return (
      <RecoverableState
        icon={<Clock className="h-5 w-5 text-amber-400" />}
        title="That link has expired"
        // Names the cause and the fix in one sentence. Sign-in links are
        // short-lived on purpose, and saying so stops it reading as a bug.
        body="Sign-in links last 30 minutes for security. Enter your email and we'll send a fresh one."
      />
    );
  }
  if (status === "used") {
    return (
      <RecoverableState
        icon={<Check className="h-5 w-5 text-amber-400" />}
        title="That link was already used"
        // The genuinely likely case first: they may already be signed in
        // on this browser and simply clicked the email a second time.
        body="Each link works once. If you're already signed in here, your credits are ready — check the balance in the top bar. Otherwise, send yourself a new link."
      />
    );
  }
  return (
    <RecoverableState
      icon={<AlertCircle className="h-5 w-5 text-amber-400" />}
      title="We couldn't read that link"
      body="It may have been cut short by your email client. Enter your email and we'll send a new one."
      showSupport
    />
  );
}

/* ------------------------------------------------------------------ */
/* status=ok                                                           */
/* ------------------------------------------------------------------ */

function SignedIn() {
  const { refresh: refreshProvider } = useCredits();
  const [me, setMe] = useState<CreditsMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const next = await getCreditsMe();
      if (cancelled) return;
      setMe(next);
      setLoading(false);
      // Sync the navbar pill for the rest of the session.
      void refreshProvider();
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshProvider]);

  if (loading) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-graphite-700 bg-graphite-900">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Signing you in</h1>
      </div>
    );
  }

  const balance = me?.balance ?? 0;

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
        <Check className="h-6 w-6 text-amber-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          You&apos;re signed in
        </h1>
        <p className="text-sm text-text-muted">
          Your credits are now available in this browser.
        </p>
      </div>

      {balance > 0 ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-6 py-5">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="font-mono text-3xl font-semibold text-amber-400">
              {balance}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {balance === 1 ? "credit" : "credits"} ready to use
          </p>
        </div>
      ) : (
        /*
          Signed in but empty. This is the "I paid and it's not here" case,
          and it needs a real next step rather than a bare zero — the most
          common cause is paying with a different address than the one
          used to sign in.
        */
        <div className="rounded-xl border border-graphite-800 bg-graphite-900 px-5 py-4 text-left">
          <p className="text-sm leading-relaxed text-text-muted">
            This account doesn&apos;t have any credits yet. If you&apos;ve paid,
            it may have gone through with a different email address — send us
            both addresses and we&apos;ll merge them.{" "}
            <EmailLink
              user="contact"
              domain="audioforges.com"
              className="text-amber-400 underline-offset-4 hover:underline"
            />
          </p>
        </div>
      )}

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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* expired / used / invalid                                            */
/* ------------------------------------------------------------------ */

function RecoverableState({
  icon,
  title,
  body,
  showSupport = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  showSupport?: boolean;
}) {
  // Prefilled from the checkout step where possible. Lazy initializer, so
  // there's no blank-then-filled flicker on first paint.
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem("af_claim_email") ?? "";
    } catch {
      return "";
    }
  });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter the email you paid with.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await requestMagicLink(trimmed);
      trackCredits("credits_magic_link_requested", { source: "auth_verified" });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many sign-in emails. Please try again in an hour.");
      } else {
        setError("We couldn't send that right now. Please email us instead.");
      }
    } finally {
      setSending(false);
    }
  }, [email]);

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-graphite-700 bg-graphite-900">
          {icon}
        </div>
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        <p className="text-sm leading-relaxed text-text-muted">{body}</p>
      </div>

      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
        {sent ? (
          <p className="flex items-start gap-2 text-sm text-amber-400">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            {/*
              Conditional voice: the backend returns 200 whether or not the
              account exists, so that this can't be used to discover which
              emails have credits. Claiming "we sent it" would be false
              half the time.
            */}
            <span>
              If that email has credits, a new sign-in link is on its way. It
              expires in 30 minutes.
            </span>
          </p>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-label="Email you paid with"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
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
              Send a new link
            </Button>
          </div>
        )}
      </div>

      {showSupport && (
        <p className="text-center text-sm leading-relaxed text-text-muted">
          Still not working?{" "}
          <EmailLink
            user="contact"
            domain="audioforges.com"
            className="text-amber-400 underline-offset-4 hover:underline"
          />
        </p>
      )}

      <p className="text-center text-xs text-text-subtle">
        <Link href="/" className="underline-offset-4 hover:text-text-muted hover:underline">
          Back to AudioForges
        </Link>
      </p>
    </div>
  );
}