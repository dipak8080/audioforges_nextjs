"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Lock, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, buttonStyles } from "@/components/ui/Button";
import { claimPack, getCreditsMe } from "@/lib/api/credits";
import { useCredits } from "./CreditProvider";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";
import type { CreditPack } from "@/lib/types/credits";

/**
 * THE HIGHEST-FRICTION SCREEN IN THE PRODUCT.
 *
 * Everything before this is free and anonymous. This is the first moment we
 * ask for anything, and every element is either load-bearing or removed:
 *
 *  - ONE field. No name, no confirm-email, no checkbox, no account.
 *  - The reason we need it is stated in one line, because "why do you want my
 *    email" is the actual objection and refusing to answer reads as a
 *    mailing-list harvest.
 *  - The email is remembered locally, so a returning buyer types nothing.
 *  - The button says where it's going and what it costs.
 *
 * WHY THE EMAIL IS GENUINELY REQUIRED (not a growth tactic): Ko-fi's webhook
 * carries no custom data field. There is no order id we can round-trip. The
 * buyer's email is the ONLY thing tying a payment back to this browser, which
 * is why /credits/claim records it in `pending_claims` BEFORE checkout.
 *
 * KO-FI OPENS IN A NEW TAB (2026-08-21). This used to navigate the current tab,
 * which destroyed the tool page and took the user's selected file with it.
 * They paid, came back, and had to upload the track again — at the exact moment
 * they had just spent money to avoid friction. `af_sid` is a cookie scoped to
 * .audioforges.com, so the balance is visible in every tab of that browser
 * anyway; nothing ever required a same-tab jump.
 *
 * The tab is opened SYNCHRONOUSLY inside the click, before the `await`, because
 * a window.open after an await has lost its user gesture and gets blocked.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. A BLOCKED POPUP SILENTLY DESTROYED THE PAGE. The fallback was
 *    `window.location.href = res.buy_url` — the old same-tab behaviour, which
 *    is exactly the thing the new tab exists to prevent. Someone with a popup
 *    blocker (or on an in-app browser, which is most social traffic) lost their
 *    loaded track without being told it was about to happen. They now get the
 *    checkout link as a button: one extra click, and the click is a real user
 *    gesture so it opens reliably.
 *
 * 2. THE WATCHER GAVE UP WITHOUT SAYING SO. The poll stops at a 15-minute
 *    ceiling, but the screen kept promising "your credits appear here on their
 *    own" — which stopped being true the moment the interval cleared. It now
 *    says it stopped watching and offers the manual check.
 *
 * 3. THE SUCCESS STATE WASN'T ANNOUNCED. The waiting state is a live region;
 *    the state it flips to is not, so a screen reader user heard the spinner
 *    text and then silence — on the confirmation that their money arrived.
 *
 * 4. THE NEW TAB OPENED AS A BLANK WHITE PAGE for as long as the claim call
 *    took. It says where it's going now, which also makes a slow claim look
 *    deliberate rather than broken.
 *
 * 5. EVERY BUTTON IS `buttonStyles`.
 */

const EMAIL_STORAGE_KEY = "af_claim_email";
/** Poll while the buyer is on Ko-fi. Focus events do most of the work; this
 *  is the backstop for someone who leaves this tab visible on a second
 *  monitor. */
const CHECK_INTERVAL_MS = 5_000;
/** Stop watching eventually. Ko-fi checkout abandoned, tab closed, whatever —
 *  an interval running for an hour helps nobody. */
const WATCH_CEILING_MS = 15 * 60_000;

type Phase = "form" | "waiting" | "blocked" | "done";

const inputClass = cn(
  "w-full rounded-lg border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary",
  "outline-none transition-colors placeholder:text-text-subtle/60",
  "hover:border-graphite-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20",
  "disabled:opacity-50"
);

export function EmailCaptureStep({
  pack,
  onBack,
  onPurchased,
}: {
  pack: CreditPack;
  onBack: () => void;
  /** Called when the buyer taps through from the "credits added" state.
   *  Wire this to the modal's onClose so they land back on their track. */
  onPurchased?: () => void;
}) {
  const { balance, refresh } = useCredits();

  // A returning buyer should type nothing. localStorage rather than a cookie:
  // this never needs to reach the server — the server already knows the email
  // once the claim is recorded.
  //
  // Lazy state initializer rather than an effect. Setting state from an effect
  // renders once empty and once filled, so the field visibly flickers from
  // blank to prefilled — and the React compiler lint rejects it.
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? "";
    } catch {
      /* private mode / storage disabled — just start empty */
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  /** Set only when the popup was blocked — the checkout URL, for a manual click. */
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
  /** The watcher hit its ceiling. Kept separate from `phase` because the screen
   *  is otherwise identical — only the promise it makes changes. */
  const [gaveUp, setGaveUp] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const baseline = useRef(0);
  const watchStarted = useRef(0);
  const settled = useRef(false);

  useEffect(() => {
    if (phase === "form") inputRef.current?.focus();
  }, [phase]);

  const land = useCallback(
    (nextBalance: number) => {
      if (settled.current) return;
      settled.current = true;
      setNewBalance(nextBalance);
      setPhase("done");
      trackCredits("credits_purchase_confirmed", { balance: nextBalance });
      void refresh();
    },
    [refresh]
  );

  const checkNow = useCallback(async () => {
    if (settled.current) return;
    setChecking(true);
    try {
      const me = await getCreditsMe();
      if (me && me.balance > baseline.current) land(me.balance);
    } catch {
      /* transient — the interval will come back around */
    } finally {
      setChecking(false);
    }
  }, [land]);

  /**
   * Watch for the webhook while the buyer is on Ko-fi. Focus and
   * visibilitychange are the important triggers: returning to this tab is
   * almost always the moment the payment has just completed.
   */
  useEffect(() => {
    if (phase !== "waiting" && phase !== "blocked") return;

    const onReturn = () => {
      if (document.visibilityState === "visible") void checkNow();
    };

    const timer = setInterval(() => {
      if (Date.now() - watchStarted.current > WATCH_CEILING_MS) {
        clearInterval(timer);
        // Say so. The copy on this screen promises the balance appears by
        // itself, and that promise expires with the interval.
        setGaveUp(true);
        return;
      }
      void checkNow();
    }, CHECK_INTERVAL_MS);

    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [phase, checkNow]);

  /** Shared by both success paths: the popup opened, or the user clicked the
   *  fallback link. Either way we're now waiting on the webhook. */
  function beginWatching(next: Phase) {
    baseline.current = balance;
    watchStarted.current = Date.now();
    settled.current = false;
    setGaveUp(false);
    setSubmitting(false);
    setPhase(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || phase !== "form") return;

    const trimmed = email.trim();
    // Deliberately loose. The backend runs real validation; this only catches
    // the obvious typo before spending a round trip. Anything stricter starts
    // rejecting valid addresses, which is a far worse failure than one wasted
    // request.
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("That email doesn't look right — check it and try again.");
      inputRef.current?.focus();
      return;
    }

    // Opened here, inside the gesture, NOT after the await. A window.open that
    // follows an await has lost its user activation and gets blocked.
    const tab = window.open("", "_blank");

    // about:blank is same-origin, so this is writable — and without it the new
    // tab is a blank white page for however long the claim call takes, which
    // reads as a broken link rather than a slow one.
    if (tab) {
      try {
        tab.document.write(
          '<!doctype html><meta charset="utf-8"><title>Opening Ko-fi…</title>' +
            '<body style="margin:0;display:grid;place-items:center;height:100vh;' +
            'background:#0f0f11;color:#9a968d;font:14px system-ui,sans-serif">' +
            "Opening Ko-fi…</body>"
        );
        tab.document.close();
      } catch {
        /* blocked by policy — the blank tab still works */
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await claimPack(trimmed, pack.key);

      try {
        window.localStorage.setItem(EMAIL_STORAGE_KEY, trimmed);
      } catch {
        /* non-fatal */
      }

      trackCredits("credits_claim_submitted", {
        pack: pack.key,
        credits: pack.credits,
        value: pack.price_usd,
        currency: "USD",
      });
      trackCredits("credits_checkout_started", { pack: pack.key });

      if (tab && !tab.closed) {
        tab.location.href = res.buy_url;
        // Sever the back-reference now that the destination is set, so Ko-fi
        // can't touch window.opener.
        try {
          tab.opener = null;
        } catch {
          /* cross-origin already — nothing to do */
        }
        beginWatching("waiting");
      } else {
        /*
          Popup blocked — common on in-app browsers, which is most social
          traffic. The old fallback navigated THIS tab, which is precisely the
          behaviour the new tab was introduced to stop: the user's loaded track
          is destroyed without warning, right after they paid to avoid friction.

          A link instead. One extra click, and because that click is a genuine
          user gesture it opens reliably even with a blocker running.
        */
        trackCredits("credits_checkout_popup_blocked", { pack: pack.key });
        setBlockedUrl(res.buy_url);
        beginWatching("blocked");
      }
    } catch (err) {
      tab?.close();
      setSubmitting(false);

      // Branch on `kind`, never on message — the backend owns the copy for
      // cases it knows about, and we own the copy for the rest.
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setError("That email doesn't look right — check it and try again.");
        } else if (err.kind === "unknown_pack") {
          setError("That pack is no longer available. Pick another one.");
        } else if (err.kind === "checkout_unavailable") {
          setError(
            "Checkout is unavailable right now. Nothing was charged — try again in a few minutes."
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Nothing was charged — try again.");
      }
      inputRef.current?.focus();
    }
  }

  const perCredit = pack.price_usd / pack.credits;

  /* ---------------------------------------------------------------- */
  /* Credits landed                                                    */
  /* ---------------------------------------------------------------- */

  if (phase === "done") {
    return (
      /* Announced. The waiting state was a live region and this one wasn't, so
         a screen reader heard the spinner copy and then silence — on the
         confirmation that the money arrived. */
      <div className="space-y-5 py-2 text-center" role="status" aria-live="polite">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <Check className="h-5 w-5 text-amber-400" aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Credits added</h3>
          <p className="mt-1.5 font-mono text-3xl font-semibold tabular-nums text-amber-400">
            {newBalance}
          </p>
          <p className="text-sm text-text-muted">
            {newBalance === 1 ? "credit" : "credits"} on this browser
          </p>
        </div>
        {/* The whole point of the new tab: the track is still loaded behind
            this modal, so the next action is the run, not a re-upload. */}
        <Button variant="primary" size="lg" onClick={onPurchased ?? onBack} className="w-full">
          Back to your track
        </Button>
        <p className="text-xs leading-relaxed text-text-subtle">
          Your file is still loaded. Credits never expire, and a failed run returns its credit
          automatically.
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* On Ko-fi (or about to be), waiting for the webhook                */
  /* ---------------------------------------------------------------- */

  if (phase === "waiting" || phase === "blocked") {
    const blocked = phase === "blocked";
    return (
      <div className="space-y-5 py-2" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-graphite-700 bg-graphite-950">
            {gaveUp ? (
              <Loader2 className="h-5 w-5 text-text-subtle" aria-hidden />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-amber-400 motion-reduce:animate-none" />
            )}
          </div>
          <h3 className="mt-4 text-lg font-semibold text-text-primary">
            {blocked ? "One more tap to open Ko-fi" : "Finish up in the other tab"}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            {blocked ? (
              <>
                Your browser blocked the new tab. Use the button below — your track stays loaded
                here either way.
              </>
            ) : gaveUp ? (
              /* The promise below expires with the interval, so the copy has
                 to expire with it. */
              <>
                We&apos;ve stopped checking for now. If you&apos;ve paid, press the button below
                and your credits will appear.
              </>
            ) : (
              <>
                Ko-fi opened in a new tab. Pay there and come back — your credits appear here on
                their own, and your track is still loaded.
              </>
            )}
          </p>
        </div>

        {blocked && blockedUrl && (
          <a
            href={blockedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
          >
            <ExternalLink />
            Pay ${pack.price_usd.toFixed(2)} on Ko-fi
          </a>
        )}

        <Button
          variant="outline"
          size="md"
          loading={checking}
          loadingLabel="Checking"
          onClick={() => void checkNow()}
          className="w-full"
        >
          I&apos;ve paid — check now
        </Button>

        <button
          type="button"
          onClick={onBack}
          className={buttonStyles({
            variant: "ghost",
            size: "sm",
            className: "w-full text-xs text-text-subtle hover:text-text-muted",
          })}
        >
          Didn&apos;t pay? Go back
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* The form                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className={buttonStyles({
          variant: "ghost",
          size: "sm",
          className: "-ml-2 text-text-muted",
        })}
      >
        <ArrowLeft aria-hidden />
        Change pack
      </button>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium text-text-primary">{pack.label}</span>
          <span className="font-mono text-lg tabular-nums text-amber-400">
            ${pack.price_usd.toFixed(2)}
          </span>
        </div>
        <p className="mt-1 text-xs text-text-subtle">
          ${perCredit.toFixed(2)} per run · never expires
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="claim-email" className="block text-sm font-medium text-text-primary">
            Your email
          </label>
          <input
            ref={inputRef}
            id="claim-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            disabled={submitting}
            placeholder="you@example.com"
            aria-invalid={!!error}
            aria-describedby={error ? "claim-email-error" : "claim-email-help"}
            className={inputClass}
          />
          {error ? (
            <p id="claim-email-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : (
            <p id="claim-email-help" className="text-xs leading-relaxed text-text-subtle">
              Use the same email you&apos;ll pay with. It&apos;s how we match your payment back to
              this browser — Ko-fi doesn&apos;t tell us who paid.
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          loadingLabel="Opening Ko-fi"
          className="w-full"
        >
          <ExternalLink aria-hidden />
          Pay ${pack.price_usd.toFixed(2)} on Ko-fi
        </Button>
      </form>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-text-subtle">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          Ko-fi opens in a new tab so your track stays loaded here. Payment is handled entirely by
          Ko-fi — we never see your card, and your email is used only to deliver your credits.
        </span>
      </p>
    </div>
  );
}