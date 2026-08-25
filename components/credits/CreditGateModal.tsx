"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Check,
  Sparkles,
  ArrowLeft,
  Mail,
  Infinity as InfinityIcon,
  RotateCcw,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { EmailCaptureStep } from "./EmailCaptureStep";
import { requestMagicLink } from "@/lib/api/credits";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * THE GATE.
 *
 * Everything here renders from the 402 payload the server just sent. No
 * pack, price, or buy URL is hardcoded — change a price in the backend
 * config and this modal reflects it with no deploy. That is the whole
 * reason patch 1 in PR1 existed.
 *
 * POSITIONING, AND WHY IT'S NOT A GENERIC PAYWALL
 *
 * The competition sells subscriptions with expiring minutes. LALAL.AI's
 * free tier can't even download its output. We have three facts none of
 * them can print on this screen:
 *
 *   1. No subscription. One payment, done.
 *   2. Credits never expire.
 *   3. A failed run refunds automatically.
 *
 * Those three lines are the pitch. Everything else on this screen is
 * supporting cast, which is why they sit directly under the packs rather
 * than in a footnote.
 *
 * The other thing this screen must never do is imply the free tool got
 * worse. The user reached here by choosing Studio Quality — standard
 * separation is still free, unlimited, and fully downloadable, and the
 * closing line says so. A paywall that makes people doubt the free tier
 * costs more traffic than it earns revenue.
 */

type Step = "packs" | "email" | "signin";

export function CreditGateModal({
  payload,
  open,
  onClose,
}: {
  payload: InsufficientCreditsPayload;
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("packs");
  const [selected, setSelected] = useState<CreditPack | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Whatever had focus when the modal opened. Returning focus there on
  // close is what keeps keyboard users from being dumped at the top of
  // the document after dismissing a dialog.
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    trackCredits("credits_gate_shown", {
      tool: payload.tool,
      balance: payload.balance,
      free_remaining: payload.free_remaining,
    });
    return () => {
      restoreFocusTo.current?.focus?.();
    };
  }, [open, payload.tool, payload.balance, payload.free_remaining]);

  // Reset to the first step whenever the modal is dismissed, so reopening
  // never lands mid-flow on a stale pack selection.
  //
  // Adjusted DURING RENDER rather than in an effect. React documents this
  // pattern for "reset state when a prop changes": it re-renders once
  // before painting, so nobody ever sees the stale step — whereas an
  // effect would paint the old step for a frame, and the React compiler
  // lint rejects setState in an effect outright.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setStep("packs");
      setSelected(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape to close, Tab cycles within the dialog. Without the trap, Tab
  // walks into the page behind an open modal, which for a payment dialog
  // means the user can focus a "Remove vocals" button they can't see.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  /**
   * "Best value" is COMPUTED from the payload, never authored. A hardcoded
   * "Most popular" badge is a claim we can't support; lowest cost per
   * credit is arithmetic on data the server just sent, and it stays
   * correct if prices change.
   */
  const bestValueKey = useMemo(() => {
    if (payload.packs.length < 2) return null;
    return payload.packs.reduce((best, p) =>
      p.price_usd / p.credits < best.price_usd / best.credits ? p : best
    ).key;
  }, [payload.packs]);

  const resetsOn = useMemo(() => {
    const d = new Date(payload.free_resets_at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }, [payload.free_resets_at]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-graphite-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // mousedown, not click: a click that STARTS inside the dialog and
        // ends on the backdrop (a sloppy drag while selecting text) would
        // otherwise close the modal mid-purchase.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-gate-title"
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-lg rounded-t-2xl border border-graphite-800 bg-graphite-900 shadow-2xl sm:rounded-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md p-2 text-text-subtle outline-none transition-colors hover:bg-graphite-850 hover:text-text-primary focus-visible:ring-1 focus-visible:ring-amber-500/60"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pb-6 pt-6 sm:px-7 sm:pb-7">
          {step === "packs" && (
            <PackStep
              payload={payload}
              bestValueKey={bestValueKey}
              resetsOn={resetsOn}
              onSelect={(pack) => {
                trackCredits("credits_pack_selected", {
                  pack: pack.key,
                  credits: pack.credits,
                  value: pack.price_usd,
                  currency: "USD",
                });
                setSelected(pack);
                setStep("email");
              }}
              onSignIn={() => setStep("signin")}
            />
          )}

          {step === "email" && selected && (
            <>
              <h2 id="credit-gate-title" className="mb-1 text-lg font-semibold text-text-primary">
                Almost there
              </h2>
              <p className="mb-5 text-sm text-text-muted">
                One detail and we&apos;ll hand you over to Ko-fi.
              </p>
              <EmailCaptureStep pack={selected} onBack={() => setStep("packs")} />
            </>
          )}

          {step === "signin" && <SignInStep onBack={() => setStep("packs")} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — packs                                                      */
/* ------------------------------------------------------------------ */

function PackStep({
  payload,
  bestValueKey,
  resetsOn,
  onSelect,
  onSignIn,
}: {
  payload: InsufficientCreditsPayload;
  bestValueKey: string | null;
  resetsOn: string | null;
  onSelect: (pack: CreditPack) => void;
  onSignIn: () => void;
}) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-400" />
        <h2 id="credit-gate-title" className="text-lg font-semibold text-text-primary">
          Studio Quality
        </h2>
      </div>

      {/*
        NOT "You're out of credits." That frames the product as something
        that ran out on you. The user came here by choosing the better
        model — the sentence should describe what they're buying.
      */}
      <p className="mb-5 text-sm leading-relaxed text-text-muted">
        Cleaner separation with far less bleed between stems. Each run costs
        one credit.
        {resetsOn && payload.free_remaining === 0 && (
          <>
            {" "}
            Your free monthly runs reset on{" "}
            <span className="text-text-primary">{resetsOn}</span>.
          </>
        )}
      </p>

      <div className="space-y-2">
        {payload.packs.map((pack) => {
          const perCredit = pack.price_usd / pack.credits;
          const isBest = pack.key === bestValueKey;
          return (
            <button
              key={pack.key}
              type="button"
              onClick={() => onSelect(pack)}
              className={cn(
                "group flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-3.5 text-left outline-none transition-all duration-150",
                "focus-visible:ring-1 focus-visible:ring-amber-500/60",
                isBest
                  ? "border-amber-500/40 bg-amber-500/[0.07] hover:border-amber-500/70 hover:bg-amber-500/10"
                  : "border-graphite-700 hover:border-graphite-600 hover:bg-graphite-850"
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{pack.label}</span>
                  {isBest && (
                    <span className="rounded-full border border-amber-500/40 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                      Best value
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-subtle">
                  ${perCredit.toFixed(2)} per run
                </p>
              </div>
              <span className="shrink-0 font-mono text-lg text-text-primary transition-colors group-hover:text-amber-400">
                ${pack.price_usd.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        The three lines the competition cannot print. Directly under the
        prices, because this is where the "is this worth it" decision
        happens — not in a footnote nobody scrolls to.
      */}
      <ul className="mt-5 space-y-2 border-t border-graphite-800 pt-4">
        <TrustLine icon={<CreditCard className="h-3.5 w-3.5" />}>
          No subscription — pay once, nothing recurring
        </TrustLine>
        <TrustLine icon={<InfinityIcon className="h-3.5 w-3.5" />}>
          Credits never expire
        </TrustLine>
        <TrustLine icon={<RotateCcw className="h-3.5 w-3.5" />}>
          If a run fails, your credit comes back automatically
        </TrustLine>
      </ul>

      <div className="mt-5 space-y-3 border-t border-graphite-800 pt-4">
        <button
          type="button"
          onClick={onSignIn}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-text-muted underline-offset-4 transition-colors hover:text-amber-400 hover:underline"
        >
          <Mail className="h-3.5 w-3.5" />
          Already bought? Sign in
        </button>

        {/*
          The closing reassurance. Someone who decides not to pay must
          leave knowing the free tool is untouched — otherwise this modal
          costs us the visit AND the return visit.
        */}
        <p className="text-center text-xs leading-relaxed text-text-subtle">
          Standard separation stays free and unlimited, with full downloads and
          no watermark.
        </p>
      </div>
    </>
  );
}

function TrustLine({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-text-muted">
      <span className="text-amber-400/80" aria-hidden="true">
        {icon}
      </span>
      {children}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — sign in (recovery)                                         */
/* ------------------------------------------------------------------ */

/**
 * The cross-device path. Someone buys on their phone, then opens the site
 * on a laptop — different browser, different subject id, invisible
 * balance. Without this they are stuck with credits they paid for, and
 * that is the single worst support ticket this system can generate.
 */
function SignInStep({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("That email doesn't look right — please check it.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await requestMagicLink(trimmed);
      trackCredits("credits_magic_link_requested");
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many sign-in emails. Please try again in an hour.");
      } else {
        setError("We couldn't send that right now. Please try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 py-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <Check className="h-5 w-5 text-amber-400" />
        </div>
        <h2 id="credit-gate-title" className="text-lg font-semibold text-text-primary">
          Check your email
        </h2>
        {/*
          Conditional voice, deliberately. The backend returns 200 whether
          or not the account exists, so that an attacker can't use this to
          discover which emails have accounts. The copy has to match that
          — claiming "we sent it" would be a lie half the time.
        */}
        <p className="text-sm leading-relaxed text-text-muted">
          If <span className="text-text-primary">{email.trim()}</span> has credits,
          a sign-in link is on its way. It expires in 30 minutes.
        </p>
        <Button variant="outline" size="md" onClick={onBack} className="w-full">
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>

      <div>
        <h2 id="credit-gate-title" className="text-lg font-semibold text-text-primary">
          Sign in
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          Bought credits on another device or browser? Enter the email you paid
          with and we&apos;ll send a sign-in link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-label="Email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          disabled={submitting}
          placeholder="you@example.com"
          aria-invalid={!!error}
          className="w-full rounded-md border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary placeholder:text-text-subtle/60 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50"
        />
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          className="w-full"
        >
          Send sign-in link
        </Button>
      </form>
    </div>
  );
}