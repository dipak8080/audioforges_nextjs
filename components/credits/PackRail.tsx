"use client";

import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import type { CreditPack } from "@/lib/types/credits";

/**
 * The pack selector. ONE implementation, used by /pricing and by the gate
 * modal, so the two surfaces cannot drift into pricing the same packs
 * differently or badging different ones as best value.
 *
 * WHY A RAIL AND NOT CARDS OR A LIST
 * Every pack buys the identical thing, only more of it. Three cards implies
 * the options differ in KIND, which is the shape of a SaaS plan chooser and
 * wrong here. A single track with detents says "one axis, pick a point on
 * it", and it lets one readout underneath do the arithmetic out loud instead
 * of repeating "$0.30 per run" three times in small grey text.
 *
 * It is also short. In the modal that matters: the old stacked list was
 * ~170px of the viewport, this is ~90px including the readout.
 */

/** Middle pack. Not the cheapest — that anchors the page at $3 — and not
 *  the dearest, which is us pushing. */
export function defaultPackKey(packs: CreditPack[]): string | null {
  if (!packs.length) return null;
  return packs[Math.min(1, packs.length - 1)].key;
}

/** Roving tabindex: arrows move within the group, Tab enters and leaves. */
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

export function PackRail({
  packs,
  selectedKey,
  onSelect,
  label = "How many",
}: {
  packs: CreditPack[];
  selectedKey: string | null;
  onSelect: (pack: CreditPack) => void;
  label?: string;
}) {
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Computed from the data the server just sent, never authored. A hardcoded
  // "Most popular" is a claim we can't support; lowest cost per credit is
  // arithmetic, and it stays correct if prices change.
  const bestValueKey = useMemo(() => {
    if (packs.length < 2) return null;
    return packs.reduce((best, p) =>
      p.price_usd / p.credits < best.price_usd / best.credits ? p : best
    ).key;
  }, [packs]);

  // Measured against the worst per-run price on offer, so the saving is a
  // fact about our own pack list rather than a number we invented.
  const worstPerRun = useMemo(
    () => (packs.length ? Math.max(...packs.map((p) => p.price_usd / p.credits)) : 0),
    [packs]
  );

  const selectedIndex = packs.findIndex((p) => p.key === selectedKey);
  const selected = selectedIndex >= 0 ? packs[selectedIndex] : null;
  if (!selected) return null;

  const perRun = selected.price_usd / selected.credits;
  const savingPct = worstPerRun > 0 ? Math.round((1 - perRun / worstPerRun) * 100) : 0;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const target = nextIndex(e.key, selectedIndex, packs.length);
    if (target === null) return;
    e.preventDefault();
    onSelect(packs[target]);
    btnRefs.current[target]?.focus();
  }

  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
          {label}
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
        {/* One sliding indicator rather than per-segment backgrounds: the
            movement IS the feedback, and it cannot desync from state. */}
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
              onClick={() => onSelect(pack)}
              className={cn(
                "relative z-10 flex-1 rounded-md px-2 py-3 text-center outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950",
                isSelected ? "text-graphite-950" : "text-text-muted hover:text-text-primary"
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

      <div className="mt-3 grid grid-cols-3 divide-x divide-graphite-800 overflow-hidden rounded-lg border border-graphite-800 bg-graphite-950/40">
        <Readout label="You pay" value={`$${selected.price_usd.toFixed(2)}`} accent />
        <Readout label="Per run" value={`$${perRun.toFixed(2)}`} />
        <Readout
          label={savingPct >= 1 ? "You save" : "Runs"}
          value={savingPct >= 1 ? `${savingPct}%` : `${selected.credits}`}
        />
      </div>
    </div>
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
    <div className="px-3 py-3 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-semibold tabular-nums",
          accent ? "text-amber-400" : "text-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}