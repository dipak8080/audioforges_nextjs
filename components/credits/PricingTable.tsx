"use client";

import { useCallback, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useCredits } from "./CreditProvider";
import { CreditGateModal } from "./CreditGateModal";
import { trackCredits } from "@/lib/analytics";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * Packs come from /credits/me via the provider, never hardcoded. Change a
 * price in the backend config and this reflects it with no deploy.
 *
 * Three cards, one per pack, is the layout every pricing page a visitor has
 * ever seen. The old segmented rail asked people to learn a control before
 * they could read a price. The gate modal keeps its own rail; this page does
 * not have to match it, it has to be legible at a glance.
 *
 * Checkout still goes through CreditGateModal, so there is exactly one
 * checkout flow in the product.
 */
export function PricingTable({
  studioCredits = 1,
  sheetCredits = 0,
}: {
  /** Credits per Studio Quality run, for the "what it buys" line. */
  studioCredits?: number;
  /** Credits per sheet-music song, or 0 to hide that line. */
  sheetCredits?: number;
}) {
  const { me, loading, balance, freeRemaining } = useCredits();
  const [openPayload, setOpenPayload] = useState<InsufficientCreditsPayload | null>(null);
  const [openStep, setOpenStep] = useState<"packs" | "signin">("packs");
  const [openPackKey, setOpenPackKey] = useState<string | undefined>(undefined);

  const packs = useMemo(() => me?.packs ?? [], [me]);

  const bestValueKey = useMemo(() => {
    if (!packs.length) return null;
    return packs.reduce((best, p) =>
      p.price_usd / p.credits < best.price_usd / best.credits ? p : best
    ).key;
  }, [packs]);

  const worstPerCredit = useMemo(
    () => (packs.length ? Math.max(...packs.map((p) => p.price_usd / p.credits)) : 0),
    [packs]
  );

  const buildPayload = useCallback((): InsufficientCreditsPayload | null => {
    if (!me) return null;
    return {
      error: "insufficient_credits",
      message: "",
      tool: "separate-hq",
      credits_needed: 1,
      balance: me.balance,
      free_remaining: me.free_remaining,
      free_resets_at: me.free_resets_at,
      packs: me.packs,
    };
  }, [me]);

  function openSignIn() {
    const payload = buildPayload();
    if (!payload) return;
    setOpenStep("signin");
    setOpenPackKey(undefined);
    setOpenPayload(payload);
  }

  function openCheckout(pack: CreditPack) {
    const payload = buildPayload();
    if (!payload) return;
    setOpenStep("packs");
    setOpenPackKey(pack.key);
    trackCredits("credits_pack_selected", {
      pack: pack.key,
      credits: pack.credits,
      value: pack.price_usd,
      currency: "USD",
      source: "pricing_page",
    });
    setOpenPayload(payload);
  }

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[260px] animate-pulse rounded-xl border border-graphite-800 bg-graphite-900 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (!packs.length) {
    return (
      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-6">
        <p className="text-sm leading-relaxed text-text-muted">
          Prices aren&apos;t loading right now. Reload the page. Nothing has been charged and no
          purchase was started.
        </p>
      </div>
    );
  }

  return (
    <>
      {(balance > 0 || freeRemaining > 0) && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
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
                left this month. No need to buy yet.
              </>
            )}
          </span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {packs.map((pack) => {
          const perCredit = pack.price_usd / pack.credits;
          const isBest = pack.key === bestValueKey;
          const saving = worstPerCredit ? Math.round((1 - perCredit / worstPerCredit) * 100) : 0;
          const studioRuns = Math.floor(pack.credits / studioCredits);
          const sheetSongs = sheetCredits ? Math.floor(pack.credits / sheetCredits) : 0;
          return (
            <div
              key={pack.key}
              className={cn(
                "relative flex flex-col rounded-xl border bg-graphite-900 p-5",
                isBest ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-graphite-800"
              )}
            >
              {isBest && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-graphite-950">
                  Best value
                </span>
              )}
              {pack.label.trim().toLowerCase() !== `${pack.credits} credits` && (
                <p className="text-xs text-text-subtle">{pack.label}</p>
              )}
              <p className="flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-semibold tabular-nums text-text-primary">
                  {pack.credits}
                </span>
                <span className="text-sm text-text-muted">credits</span>
              </p>
              <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-amber-400">
                ${pack.price_usd.toFixed(2)}
              </p>
              <p className="mt-0.5 text-xs text-text-subtle">
                ${perCredit.toFixed(2)} per credit
                {saving >= 1 ? (
                  <span className="ml-1.5 text-amber-400">save {saving}%</span>
                ) : (
                  <span className="ml-1.5 text-text-subtle/0" aria-hidden>
                    base
                  </span>
                )}
              </p>

              <ul className="mb-5 mt-4 space-y-1.5 border-t border-graphite-800 pt-4 text-sm text-text-muted">
                <li>
                  <span className="text-text-primary">{studioRuns}</span> Studio Quality separations
                </li>
                {sheetSongs > 0 && (
                  <li>
                    or <span className="text-text-primary">{sheetSongs}</span> sheet-music songs
                  </li>
                )}
                <li>Never expires</li>
                <li>Refunded if a run fails</li>
              </ul>

              <Button
                variant={isBest ? "primary" : "outline"}
                size="md"
                onClick={() => openCheckout(pack)}
                className="mt-auto w-full"
              >
                Buy {pack.credits} credits
              </Button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-text-subtle">
        Next you enter an email, then pay on Ko-fi. The email is how the payment is matched back to
        this browser. No account to create, no password.
      </p>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={openSignIn}
          className={buttonStyles({
            variant: "ghost",
            size: "sm",
            className: "text-text-muted hover:text-amber-400",
          })}
        >
          Already bought? Sign in to use your credits here
        </button>
      </div>

      {openPayload && (
        <CreditGateModal
          payload={openPayload}
          open
          initialStep={openStep}
          initialPackKey={openPackKey}
          onClose={() => setOpenPayload(null)}
        />
      )}
    </>
  );
}