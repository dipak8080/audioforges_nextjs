"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { CreditGateModal } from "./CreditGateModal";
import { PackRail, defaultPackKey } from "./PackRail";
import { trackCredits } from "@/lib/analytics";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * The pack selector on /pricing.
 *
 * Packs come from /credits/me via the provider — never hardcoded. Change a
 * price in the backend config and this reflects it with no deploy.
 *
 * The rail itself is PackRail, shared with the gate modal, so /pricing and
 * the paywall cannot drift into badging different packs as best value or
 * doing the per-run maths differently.
 *
 * Buying reuses CreditGateModal with a SYNTHESIZED payload rather than
 * duplicating the email step and the trust copy. There is exactly one
 * checkout flow in this product and it lives in one file.
 */
export function PricingTable() {
  const { me, loading, balance, freeRemaining } = useCredits();
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [openPayload, setOpenPayload] = useState<InsufficientCreditsPayload | null>(null);
  /** Which step the modal opens on — "signin" for someone recovering a purchase. */
  const [openStep, setOpenStep] = useState<"packs" | "signin">("packs");

  // Memoized rather than `me?.packs ?? []` inline: the `?? []` allocates a
  // fresh array on every render, invalidating every downstream useMemo.
  const packs = useMemo(() => me?.packs ?? [], [me]);

  // Derived, not set in an effect, so there is no flash of an unselected rail.
  const selectedKey =
    chosenKey && packs.some((p) => p.key === chosenKey)
      ? chosenKey
      : defaultPackKey(packs);
  const selected = packs.find((p) => p.key === selectedKey) ?? null;

  /**
   * Recovery, reachable WITHOUT starting a purchase.
   *
   * Credits live on a browser cookie, so someone who paid on a laptop and then
   * opens the site on their phone sees a balance of zero and a pricing page —
   * which reads as being asked to pay a second time. The sign-in link existed,
   * but only inside the checkout flow, two clicks deep behind a buy button. The
   * one person who must never be asked to buy again was the one who had to
   * start buying again to find the way out.
   */
  function openSignIn() {
    if (!me) return;
    setOpenStep("signin");
    setOpenPayload({
      error: "insufficient_credits",
      message: "",
      tool: "separate-hq",
      credits_needed: 1,
      balance: me.balance,
      free_remaining: me.free_remaining,
      free_resets_at: me.free_resets_at,
      packs: me.packs,
    });
  }

  function openCheckout(pack: CreditPack) {
    if (!me) return;
    setOpenStep("packs");
    trackCredits("credits_pack_selected", {
      pack: pack.key,
      credits: pack.credits,
      value: pack.price_usd,
      currency: "USD",
      source: "pricing_page",
    });
    // Synthesized, not received from a 402 — this user came here deliberately
    // rather than by hitting a limit. Same shape, so the modal neither knows
    // nor cares which path opened it.
    setOpenPayload({
      error: "insufficient_credits",
      message: "",
      tool: "separate-hq",
      credits_needed: 1,
      balance: me.balance,
      free_remaining: me.free_remaining,
      free_resets_at: me.free_resets_at,
      packs: me.packs,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-graphite-800 bg-graphite-900 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-text-subtle motion-reduce:animate-none" />
      </div>
    );
  }

  // Empty state says what happened and what to do, in the interface's voice.
  if (!selected) {
    return (
      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-6">
        <p className="text-sm leading-relaxed text-text-muted">
          Prices aren&apos;t loading right now. Reload the page — nothing has
          been charged and no purchase was started.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* What you already have, before what you could buy. Someone arriving
          with unspent credits or free runs should see that first, or the page
          is selling them something they're holding. */}
      {(balance > 0 || freeRemaining > 0) && (
        <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-text-muted">
            {balance > 0 ? (
              <>
                You have{" "}
                <span className="font-medium text-amber-400">
                  {balance} {balance === 1 ? "credit" : "credits"}
                </span>{" "}
                already.
              </>
            ) : (
              <>
                You have{" "}
                <span className="font-medium text-amber-400">
                  {freeRemaining} free {freeRemaining === 1 ? "run" : "runs"}
                </span>{" "}
                left this month — no need to buy yet.
              </>
            )}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-4 sm:p-5">
        <PackRail
          packs={packs}
          selectedKey={selectedKey}
          onSelect={(p) => setChosenKey(p.key)}
        />

        <button
          type="button"
          onClick={() => openCheckout(selected)}
          className={cn(
            "mt-4 w-full rounded-md bg-amber-500 px-4 py-3 text-sm font-semibold text-graphite-950 outline-none",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-amber-400",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
          )}
        >
          Continue — {selected.credits} credits for ${selected.price_usd.toFixed(2)}
        </button>

        <p className="mt-3 text-center text-xs leading-relaxed text-text-subtle">
          Next you&apos;ll enter an email, then pay on Ko-fi. The email is how we
          match the payment back to this browser — there&apos;s no account to
          create and no password.
        </p>

        {/* The three claims a subscription competitor structurally cannot
            print, at the moment of decision rather than in a footnote. */}
        <button
          type="button"
          onClick={openSignIn}
          className="mt-4 w-full rounded-md border-t border-graphite-800 pt-4 text-center text-sm text-text-muted outline-none transition-colors hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          Already bought? Sign in to use your credits here
        </button>

        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-graphite-800 pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
          <li>No subscription</li>
          <li aria-hidden className="text-graphite-700">/</li>
          <li>Never expires</li>
          <li aria-hidden className="text-graphite-700">/</li>
          <li>Failed run refunded</li>
        </ul>
      </div>

      {openPayload && (
        <CreditGateModal
          payload={openPayload}
          open
          initialStep={openStep}
          onClose={() => setOpenPayload(null)}
        />
      )}
    </>
  );
}