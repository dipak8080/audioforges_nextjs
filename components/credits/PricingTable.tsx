"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { CreditGateModal } from "./CreditGateModal";
import { trackCredits } from "@/lib/analytics";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * The pack table on /pricing.
 *
 * Packs come from /credits/me via the provider — never hardcoded. The
 * same rule as the gate modal: change a price in the backend config and
 * this page reflects it with no deploy.
 *
 * Buying reuses CreditGateModal with a SYNTHESIZED payload rather than
 * duplicating the email step and the trust copy. There is exactly one
 * checkout flow in this product, and it lives in one file — so a change
 * to it can't half-land.
 */
export function PricingTable() {
  const { me, loading, balance, freeRemaining } = useCredits();
  const [openPayload, setOpenPayload] = useState<InsufficientCreditsPayload | null>(null);

  // Memoized rather than `me?.packs ?? []` inline: the `?? []` allocates a
  // fresh array on every render, which would invalidate the useMemo below
  // every time and re-run the reduce for nothing.
  const packs = useMemo(() => me?.packs ?? [], [me]);

  const bestValueKey = useMemo(() => {
    if (packs.length < 2) return null;
    return packs.reduce((best, p) =>
      p.price_usd / p.credits < best.price_usd / best.credits ? p : best
    ).key;
  }, [packs]);

  function openCheckout(pack: CreditPack) {
    if (!me) return;
    trackCredits("credits_pack_selected", {
      pack: pack.key,
      credits: pack.credits,
      value: pack.price_usd,
      currency: "USD",
      source: "pricing_page",
    });
    // Synthesized, not received from a 402 — the user came here
    // deliberately rather than by hitting a limit. Same shape, so the
    // modal neither knows nor cares which path opened it.
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
      <div className="flex items-center justify-center rounded-xl border border-graphite-800 bg-graphite-900 py-16">
        <Loader2 className="h-5 w-5 animate-spin text-text-subtle" />
      </div>
    );
  }

  return (
    <>
      {/* Current standing, when there is any. Someone arriving with credits
          or unspent free runs should see that before a price — otherwise
          the page is selling them something they already have. */}
      {(balance > 0 || freeRemaining > 0) && (
        <div className="mb-6 flex items-center gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
          <span className="text-text-muted">
            {balance > 0 ? (
              <>
                You have{" "}
                <span className="font-medium text-amber-400">
                  {balance} {balance === 1 ? "credit" : "credits"}
                </span>
                .
              </>
            ) : (
              <>
                You have{" "}
                <span className="font-medium text-amber-400">
                  {freeRemaining} free {freeRemaining === 1 ? "run" : "runs"}
                </span>{" "}
                left this month.
              </>
            )}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {packs.map((pack) => {
          const perCredit = pack.price_usd / pack.credits;
          const isBest = pack.key === bestValueKey;
          return (
            <div
              key={pack.key}
              className={cn(
                "relative flex flex-col rounded-xl border p-5 transition-colors",
                isBest
                  ? "border-amber-500/40 bg-amber-500/[0.05]"
                  : "border-graphite-800 bg-graphite-900"
              )}
            >
              {isBest && (
                <span className="absolute -top-2.5 left-5 rounded-full border border-amber-500/40 bg-graphite-950 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  Best value
                </span>
              )}

              <p className="text-sm font-medium text-text-muted">{pack.label}</p>

              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold text-text-primary">
                  ${pack.price_usd.toFixed(2)}
                </span>
                <span className="text-xs text-text-subtle">once</span>
              </div>

              <p className="mt-1.5 text-xs text-text-subtle">
                ${perCredit.toFixed(2)} per run
              </p>

              <button
                type="button"
                onClick={() => openCheckout(pack)}
                className={cn(
                  "mt-5 w-full rounded-md px-4 py-2.5 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-1 focus-visible:ring-amber-500/60",
                  isBest
                    ? "bg-amber-500 text-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-amber-400"
                    : "border border-graphite-700 bg-graphite-900/40 text-text-primary hover:border-graphite-600 hover:bg-graphite-850"
                )}
              >
                Get {pack.credits} credits
              </button>
            </div>
          );
        })}
      </div>

      {openPayload && (
        <CreditGateModal
          payload={openPayload}
          open
          onClose={() => setOpenPayload(null)}
        />
      )}
    </>
  );
}