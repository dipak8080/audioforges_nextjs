"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Lock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
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
 * ── THE CHANGE THAT MATTERS: KO-FI OPENS IN A NEW TAB ──────────────────
 *
 * This used to navigate the current tab. The stated reason was that credits
 * had to land in the tab the user came from — but they always do: `af_sid` is
 * a cookie scoped to .audioforges.com, so a balance is visible in EVERY tab
 * of that browser, and CreditProvider revalidates on refocus. There was no
 * mechanism that required a same-tab jump.
 *
 * What the same-tab jump DID do was destroy the tool page, taking the user's
 * selected file or pasted URL with it. They paid, came back, and had to
 * upload the track again — at the exact moment they had just spent money to
 * avoid friction.
 *
 * In a new tab the tool page survives with the file still attached, and this
 * modal turns into a live "waiting for your payment" state that flips to
 * "ready" by itself when the webhook lands. The buyer's next action is the
 * run they wanted, not a re-upload.
 *
 * POPUP BLOCKING is the one real cost, and it's handled: the tab is opened
 * SYNCHRONOUSLY inside the click, before the `await`, because a window.open
 * after an await has lost its user-gesture and gets blocked. If it's blocked
 * anyway, we fall back to the old same-tab navigation rather than stranding
 * anyone.
 */

const EMAIL_STORAGE_KEY = "af_claim_email";
/** Poll while the buyer is on Ko-fi. Focus events do most of the work; this
 *  is the backstop for someone who leaves this tab visible on a second
 *  monitor. */
const CHECK_INTERVAL_MS = 5_000;
/** Stop watching eventually. Ko-fi checkout abandoned, tab closed, whatever —
 *  an interval running for an hour helps nobody. */
const WATCH_CEILING_MS = 15 * 60_000;

type Phase = "form" | "waiting" | "done";

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
  // Lazy state initializer rather than an effect. Setting state from an
  // effect renders once empty and once filled, so the field visibly flickers
  // from blank to prefilled — and the React compiler lint rejects it.
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
    if (phase !== "waiting") return;

    const onReturn = () => {
      if (document.visibilityState === "visible") void checkNow();
    };

    const timer = setInterval(() => {
      if (Date.now() - watchStarted.current > WATCH_CEILING_MS) {
        clearInterval(timer);
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

    // Opened here, inside the gesture, NOT after the await. A window.open
    // that follows an await has lost its user activation and gets blocked.
    const tab = window.open("", "_blank");

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
        baseline.current = balance;
        watchStarted.current = Date.now();
        settled.current = false;
        setSubmitting(false);
        setPhase("waiting");
      } else {
        // Popup blocked. Same-tab is the old behaviour and still works — the
        // user just loses their file, which is what the new tab was for.
        window.location.href = res.buy_url;
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
      <div className="space-y-5 py-2 text-center">
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
        <Button
          variant="primary"
          size="lg"
          onClick={onPurchased ?? onBack}
          className="w-full"
        >
          Back to your track
        </Button>
        <p className="text-xs leading-relaxed text-text-subtle">
          Your file is still loaded. Credits never expire, and a failed run
          returns its credit automatically.
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* On Ko-fi, waiting for the webhook                                 */
  /* ---------------------------------------------------------------- */

  if (phase === "waiting") {
    return (
      <div className="space-y-5 py-2" role="status" aria-live="polite">
        <div className="text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-graphite-700 bg-graphite-950">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400 motion-reduce:animate-none" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-text-primary">
            Finish up in the other tab
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            Ko-fi opened in a new tab. Pay there and come back — your credits
            appear here on their own, and your track is still loaded.
          </p>
        </div>

        <Button
          variant="outline"
          size="md"
          loading={checking}
          onClick={() => void checkNow()}
          className="w-full"
        >
          I&apos;ve paid — check now
        </Button>

        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-md py-1 text-center text-xs text-text-subtle outline-none transition-colors hover:text-text-muted focus-visible:ring-2 focus-visible:ring-amber-400/70"
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
        className="flex items-center gap-1.5 rounded-md text-sm text-text-muted outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Change pack
      </button>

      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
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
          <label
            htmlFor="claim-email"
            className="block text-sm font-medium text-text-primary"
          >
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
            className="w-full rounded-md border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary outline-none transition-colors placeholder:text-text-subtle/60 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50"
          />
          {error ? (
            <p id="claim-email-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : (
            <p id="claim-email-help" className="text-xs leading-relaxed text-text-subtle">
              Use the same email you&apos;ll pay with. It&apos;s how we match
              your payment back to this browser — Ko-fi doesn&apos;t tell us who
              paid.
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          className="w-full"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Pay ${pack.price_usd.toFixed(2)} on Ko-fi
        </Button>
      </form>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-text-subtle">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          Ko-fi opens in a new tab so your track stays loaded here. Payment is
          handled entirely by Ko-fi — we never see your card, and your email is
          used only to deliver your credits.
        </span>
      </p>
    </div>
  );
}