"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { claimPack } from "@/lib/api/credits";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";
import type { CreditPack } from "@/lib/types/credits";

/**
 * THE HIGHEST-FRICTION SCREEN IN THE PRODUCT.
 *
 * Everything before this is free and anonymous. This is the first moment
 * we ask for anything, and every element here is either load-bearing or
 * removed:
 *
 *  - ONE field. No name, no confirm-email, no checkbox, no account.
 *  - The reason we need it is stated in one line, because "why do you
 *    want my email" is the actual objection and refusing to answer it
 *    reads as a mailing-list harvest.
 *  - The email is remembered locally, so a returning buyer types nothing.
 *  - The button says where it's going. A button that silently navigates
 *    to a third-party payment host is how people bounce.
 *
 * WHY THE EMAIL IS GENUINELY REQUIRED (not a growth tactic):
 * Ko-fi's webhook carries no custom data field. There is no order id we
 * can round-trip. The buyer's email is the ONLY thing that ties a payment
 * back to this browser, which is why /credits/claim records it in
 * `pending_claims` BEFORE the redirect rather than after.
 */

const EMAIL_STORAGE_KEY = "af_claim_email";

export function EmailCaptureStep({
  pack,
  onBack,
}: {
  pack: CreditPack;
  onBack: () => void;
}) {
  // A returning buyer should type nothing. localStorage rather than a
  // cookie: this never needs to reach the server — the server already
  // knows the email once the claim is recorded.
  //
  // Read in a lazy state initializer rather than an effect. Setting state
  // from an effect would render once empty and once filled, so the field
  // visibly flickers from blank to prefilled — and the React compiler
  // lint rejects it outright.
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
  const [redirecting, setRedirecting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || redirecting) return;

    const trimmed = email.trim();
    // Deliberately loose. The backend runs real validation; this only
    // catches the obvious typo before spending a round trip. Anything
    // stricter starts rejecting valid addresses, which is a far worse
    // failure than one wasted request.
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("That email doesn't look right — please check it.");
      inputRef.current?.focus();
      return;
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

      // Same tab, deliberately. The whole pending_claims design exists so
      // credits appear in THIS tab on return — a new tab would leave the
      // original showing a stale balance and no way to know it changed.
      //
      // `redirecting` stays true through the navigation so the button
      // never flicks back to an idle state mid-jump.
      setRedirecting(true);
      window.location.href = res.buy_url;
    } catch (err) {
      setSubmitting(false);

      // Branch on `kind`, never on message — the backend owns the copy
      // for cases it knows about, and we own the copy for the rest.
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setError("That email doesn't look right — please check it.");
        } else if (err.kind === "unknown_pack") {
          setError("That pack is no longer available. Pick another one.");
        } else if (err.kind === "checkout_unavailable") {
          setError(
            "Checkout is temporarily unavailable. Nothing was charged — please try again in a few minutes."
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Nothing was charged — please try again.");
      }
      inputRef.current?.focus();
    }
  }

  const perCredit = pack.price_usd / pack.credits;

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        disabled={submitting || redirecting}
        className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Change pack
      </button>

      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium text-text-primary">{pack.label}</span>
          <span className="font-mono text-lg text-amber-400">
            ${pack.price_usd.toFixed(2)}
          </span>
        </div>
        <p className="mt-1 text-xs text-text-subtle">
          ${perCredit.toFixed(2)} per Studio Quality run · never expires
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
            disabled={submitting || redirecting}
            placeholder="you@example.com"
            aria-invalid={!!error}
            aria-describedby={error ? "claim-email-error" : "claim-email-help"}
            className="w-full rounded-md border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary placeholder:text-text-subtle/60 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50"
          />
          {error ? (
            <p id="claim-email-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : (
            <p id="claim-email-help" className="text-xs text-text-subtle">
              Use the same email you&apos;ll pay with. It&apos;s how we match your
              payment back to this browser — Ko-fi doesn&apos;t tell us who paid.
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting || redirecting}
          className="w-full"
        >
          {redirecting ? (
            "Taking you to Ko-fi…"
          ) : (
            <>
              <ExternalLink className="h-4 w-4" />
              Continue to Ko-fi
            </>
          )}
        </Button>
      </form>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-text-subtle">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          Payment is handled entirely by Ko-fi — we never see your card. Your
          email is used only to deliver your credits.
        </span>
      </p>
    </div>
  );
}