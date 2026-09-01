"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Clock, Loader2, Mail, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, buttonStyles } from "@/components/ui/Button";
import { getCreditsMe, requestMagicLink } from "@/lib/api/credits";
import { useCredits } from "./CreditProvider";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";
import EmailLink from "@/components/EmailLink";
import type { CreditsMe } from "@/lib/types/credits";

/**
 * Landing page for the magic-link redirect.
 *
 * The backend redirects here as ?status=ok|expired|used|invalid. Those four
 * were deliberately separated (they used to be two) because three of them are
 * RECOVERABLE and only one isn't — and "invalid" reads like an accusation when
 * the real cause is a 30-minute timeout.
 *
 * Anything unrecognised is treated as `invalid`. A malformed status must never
 * render a blank page on the screen where someone is trying to reach credits
 * they paid for.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. A FAILED LOOKUP TOLD PEOPLE THEIR ACCOUNT WAS EMPTY. `getCreditsMe()`
 *    returns null on any failure — network, CORS, a 500 — and this read
 *    `me?.balance ?? 0`, so one flaky request on the recovery page rendered
 *    "this account doesn't have any credits yet" and told them to email support
 *    about a payment that is sitting there fine. Null is now "we couldn't
 *    check", with a retry, and it is a different screen from a real zero.
 *
 * 2. IT FETCHED THE SAME ENDPOINT TWICE, A MILLISECOND APART. `getCreditsMe()`
 *    for the local render and `refreshProvider()` for the navbar, fired back to
 *    back. The provider's refresh RETURNS the payload, so asking it first
 *    answers both — and when the paywall is off it returns null without a
 *    request at all, which is the case the direct call exists for. One request
 *    either way now.
 *
 * 3. <Button> WAS NESTED INSIDE <Link>. Interactive content inside an anchor is
 *    invalid HTML: the accessibility tree gets a button inside a link, and
 *    which one activates on Enter depends on the browser. `buttonStyles` is in
 *    the design system precisely so a link can look like a button without being
 *    wrapped around one.
 *
 * 4. IT ALWAYS SENT PEOPLE TO /vocal-remover. Checkout already records where
 *    the buyer was, in `af_return_to`. When that's present — a link opened on
 *    the same device it was requested from — it's a better destination than a
 *    guess, and the guess remains as the fallback.
 */

export type VerifyStatus = "ok" | "expired" | "used" | "invalid";

const RETURN_KEY = "af_return_to";
const EMAIL_KEY = "af_claim_email";

const inputClass = cn(
  "w-full rounded-lg border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary",
  "outline-none transition-colors placeholder:text-text-subtle/60",
  "hover:border-graphite-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20",
  "disabled:opacity-50"
);

function readLocal(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    /* private mode / storage disabled */
    return null;
  }
}

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
        // The genuinely likely case first: they may already be signed in on
        // this browser and simply clicked the email a second time.
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

type Lookup = { state: "loading" } | { state: "ok"; me: CreditsMe | null } | { state: "failed" };

function SignedIn() {
  const { refresh: refreshProvider } = useCredits();
  const [lookup, setLookup] = useState<Lookup>({ state: "loading" });

  /**
   * ONE request, not two.
   *
   * The provider's refresh returns the payload it fetched, so asking it first
   * serves both this screen and the navbar. When the paywall is off it returns
   * null immediately WITHOUT a request — and a magic link can be used in that
   * state, which is the reason the direct call exists at all. So the fallback
   * fires exactly when the provider couldn't have answered.
   */
  const load = useCallback(async () => {
    setLookup({ state: "loading" });
    try {
      const viaProvider = await refreshProvider();
      const me = viaProvider ?? (await getCreditsMe());
      // Null here means the lookup itself failed — NOT that the account is
      // empty. Those are different screens.
      setLookup(me ? { state: "ok", me } : { state: "failed" });
    } catch {
      setLookup({ state: "failed" });
    }
  }, [refreshProvider]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Where checkout said they were, when the link was opened on the same
   *  device it was requested from. Better than a guess; often absent. */
  const returnTo = useMemo(() => {
    const raw = readLocal(RETURN_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { path?: string; label?: string | null };
      if (!parsed.path || !parsed.path.startsWith("/")) return null;
      return { path: parsed.path, label: parsed.label ?? null };
    } catch {
      return null;
    }
  }, []);

  /*
    CONSUMED, NOT JUST READ. /checkout/success removes this key after using it;
    this page did not, so one stale entry survived every later sign-in and sent
    everyone back to the same page indefinitely.

    In an effect rather than inside the memo above: clearing storage is a side
    effect, and the compiler drops memoization on an impure useMemo. The memo
    has already captured the value by the time this runs.
  */
  useEffect(() => {
    try {
      window.localStorage.removeItem(RETURN_KEY);
    } catch {
      /* storage disabled — nothing was readable anyway */
    }
  }, []);

  if (lookup.state === "loading") {
    return (
      <div className="space-y-4 text-center" role="status" aria-live="polite">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-graphite-700 bg-graphite-900">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400 motion-reduce:animate-none" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Signing you in</h1>
      </div>
    );
  }

  const balance = lookup.state === "ok" ? (lookup.me?.balance ?? 0) : 0;

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

      {lookup.state === "failed" ? (
        /*
          We could not read the balance. Saying "0 credits" here would be a
          claim we can't support, on the one page where the person is already
          worried their money went missing — and it used to send them to
          support about it.
        */
        <div className="rounded-xl border border-graphite-800 bg-graphite-900 px-5 py-4 text-left">
          <p className="text-sm leading-relaxed text-text-muted">
            You&apos;re signed in, but we couldn&apos;t read your balance just now — that&apos;s a
            connection problem on our side, not a problem with your credits.
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()} className="mt-3">
            <RefreshCw />
            Check again
          </Button>
        </div>
      ) : balance > 0 ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-6 py-5">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" aria-hidden />
            <span className="font-mono text-3xl font-semibold tabular-nums text-amber-400">
              {balance}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {balance === 1 ? "credit" : "credits"} ready to use
          </p>
        </div>
      ) : (
        /*
          Signed in and genuinely empty — the server answered, and the answer
          was zero. This is the "I paid and it's not here" case, and it needs a
          real next step rather than a bare zero: the most common cause is
          paying with a different address than the one used to sign in.
        */
        <div className="rounded-xl border border-graphite-800 bg-graphite-900 px-5 py-4 text-left">
          <p className="text-sm leading-relaxed text-text-muted">
            This account doesn&apos;t have any credits yet. If you&apos;ve paid, it may have gone
            through with a different email address — send us both addresses and we&apos;ll merge
            them.{" "}
            <EmailLink
              user="contact"
              domain="audioforges.com"
              className="text-amber-400 underline-offset-4 hover:underline"
            />
          </p>
        </div>
      )}

      {/* A <Button> inside a <Link> is interactive content inside an anchor —
          invalid, and it puts a button inside a link in the accessibility tree.
          buttonStyles exists so a link can wear the clothes without the
          wrapper. */}
      <div className="space-y-2">
        {returnTo ? (
          <>
            <Link
              href={returnTo.path}
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              Back to {returnTo.label ?? "your track"}
            </Link>
            <Link
              href="/tools"
              className={buttonStyles({ variant: "ghost", size: "md", className: "w-full" })}
            >
              Or browse all tools
            </Link>
          </>
        ) : (
          <>
            <Link
              href="/vocal-remover"
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              Back to Vocal Remover
            </Link>
            <Link
              href="/stems"
              className={buttonStyles({ variant: "ghost", size: "md", className: "w-full" })}
            >
              Or split into stems
            </Link>
          </>
        )}
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
  const [email, setEmail] = useState(() => readLocal(EMAIL_KEY) ?? "");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    if (sending) return;
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
  }, [sending, email]);

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
          <p className="flex items-start gap-2 text-sm text-amber-400" role="status">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {/*
              Conditional voice: the backend returns 200 whether or not the
              account exists, so that this can't be used to discover which
              emails have credits. Claiming "we sent it" would be false half the
              time.
            */}
            <span>
              If that email has credits, a new sign-in link is on its way. It expires in 30
              minutes.
            </span>
          </p>
        ) : (
          /* A real form, not an input with an Enter handler: it's what gives a
             phone keyboard a "Go" key and what makes the field and the button
             one control to assistive tech. */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="space-y-3"
          >
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
              disabled={sending}
              placeholder="you@example.com"
              aria-invalid={!!error}
              className={inputClass}
            />
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={sending}
              loadingLabel="Sending"
              className="w-full"
            >
              <Mail />
              Send a new link
            </Button>
          </form>
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