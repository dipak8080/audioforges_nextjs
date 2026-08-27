"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "./CreditProvider";
import { CreditGateModal } from "./CreditGateModal";
import { trackCredits } from "@/lib/analytics";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * The pack selector on /pricing.
 *
 * Packs come from /credits/me via the provider — never hardcoded. Change a
 * price in the backend config and this reflects it with no deploy.
 *
 * Buying reuses CreditGateModal with a SYNTHESIZED payload rather than
 * duplicating the email step and the trust copy. There is exactly one
 * checkout flow in this product and it lives in one file.
 *
 * WHY A RAIL AND NOT THREE CARDS
 * Three price cards is the shape of a SaaS plan chooser, and it implies the
 * options differ in KIND. They don't — every pack buys the identical thing,
 * only more of it. A single track with three detents says that correctly,
 * and it lets one readout underneath do the arithmetic out loud instead of
 * repeating "$0.30 per run" three times in small grey text.
 */

/** Roving-tabindex radiogroup: arrows move, Tab enters and leaves. */
function nextIndex(key: string, i: number, len: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (i + 1) % len;
    case "ArrowLeft":
    case "ArrowUp":
      return (i - 1 + len) % len;
    case "Home":
      return 0;
    case "End":
      return len - 1;
    default:
      return null;
  }
}

export function PricingTable() {
  const { me, loading, balance, freeRemaining } = useCredits();
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [openPayload, setOpenPayload] = useState<InsufficientCreditsPayload | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Memoized rather than `me?.packs ?? []` inline: the `?? []` allocates a
  // fresh array on every render, invalidating every useMemo below.
  const packs = useMemo(() => me?.packs ?? [], [me]);

  const bestValueKey = useMemo(() => {
    if (packs.length < 2) return null;
    return packs.reduce((best, p) =>
      p.price_usd / p.credits < best.price_usd / best.credits ? p : best
    ).key;
  }, [packs]);

  // Default to the middle pack. Not the cheapest (which anchors the whole
  // page at $3) and not the dearest (which is us pushing). Derived, not set
  // in an effect, so there is no flash of an unselected rail.
  const defaultKey = packs.length ? packs[Math.min(1, packs.length - 1)].key : null;
  const selectedKey =
    chosenKey && packs.some((p) => p.key === chosenKey) ? chosenKey : defaultKey;
  const selectedIndex = packs.findIndex((p) => p.key === selectedKey);
  const selected = selectedIndex >= 0 ? packs[selectedIndex] : null;

  // Saving is measured against the worst per-run price on offer, so the
  // number is a fact about the pack list rather than a claim we authored.
  const worstPerRun = useMemo(
    () => (packs.length ? Math.max(...packs.map((p) => p.price_usd / p.credits)) : 0),
    [packs]
  );
  const perRun = selected ? selected.price_usd / selected.credits : 0;
  const savingPct = worstPerRun > 0 ? Math.round((1 - perRun / worstPerRun) * 100) : 0;

  function openCheckout(pack: CreditPack) {
    if (!me) return;
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (selectedIndex < 0) return;
    const target = nextIndex(e.key, selectedIndex, packs.length);
    if (target === null) return;
    e.preventDefault();
    setChosenKey(packs[target].key);
    btnRefs.current[target]?.focus();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-graphite-800 bg-graphite-900 py-24">
        <Loader2 className="h-5 w-5 animate-spin text-text-subtle" />
      </div>
    );
  }

  // Empty state says what happened and what to do, in the interface's voice.
  if (!selected) {
    return (
      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-6">
        <p className="text-sm text-text-muted">
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

      <div className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
        {/* ── The rail ───────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
              How many
            </span>
            {bestValueKey === selected.key && (
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-400">
                Best value
              </span>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="Credit pack"
            onKeyDown={handleKeyDown}
            className="relative flex rounded-lg border border-graphite-700 bg-graphite-950 p-1"
          >
            {/* One sliding indicator rather than per-segment backgrounds:
                the movement is the feedback, and it can't desync from state. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-amber-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform duration-200 ease-out motion-reduce:transition-none"
              style={{
                width: `calc((100% - 0.5rem) / ${packs.length})`,
                transform: `translateX(${selectedIndex * 100}%)`,
              }}
            />
            {packs.map((pack, i) => {
              const isSelected = pack.key === selected.key;
              return (
                <button
                  key={pack.key}
                  ref={(el) => {
                    btnRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setChosenKey(pack.key)}
                  className={cn(
                    "relative z-10 flex-1 rounded-md px-2 py-3 text-center outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950",
                    isSelected
                      ? "text-graphite-950"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  <span className="block font-mono text-xl font-semibold tabular-nums sm:text-2xl">
                    {pack.credits}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[11px]",
                      isSelected ? "text-graphite-950/70" : "text-text-subtle"
                    )}
                  >
                    credits
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── The readout ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-graphite-800 border-y border-graphite-800 bg-graphite-950/40">
          <Readout label="You pay" value={`$${selected.price_usd.toFixed(2)}`} accent />
          <Readout label="Per run" value={`$${perRun.toFixed(2)}`} />
          <Readout
            label={savingPct >= 1 ? "You save" : "Runs"}
            value={savingPct >= 1 ? `${savingPct}%` : `${selected.credits}`}
          />
        </div>

        {/* ── The action ─────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5">
          <button
            type="button"
            onClick={() => openCheckout(selected)}
            className={cn(
              "w-full rounded-md bg-amber-500 px-4 py-3 text-sm font-semibold text-graphite-950 outline-none",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-amber-400",
              "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
            )}
          >
            Continue — {selected.credits} credits for ${selected.price_usd.toFixed(2)}
          </button>

          <p className="mt-3 text-center text-xs leading-relaxed text-text-subtle">
            Next you&apos;ll enter an email, then pay on Ko-fi. The email is how
            we match the payment back to this browser — there&apos;s no account
            to create and no password.
          </p>

          {/* The three claims a subscription competitor structurally cannot
              print, at the moment of decision rather than in a footnote. */}
          <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-graphite-800 pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
            <li>No subscription</li>
            <li aria-hidden className="text-graphite-700">
              /
            </li>
            <li>Never expires</li>
            <li aria-hidden className="text-graphite-700">
              /
            </li>
            <li>Failed run refunded</li>
          </ul>
        </div>
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

function Readout({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="px-3 py-3.5 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-semibold tabular-nums sm:text-xl",
          accent ? "text-amber-400" : "text-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}