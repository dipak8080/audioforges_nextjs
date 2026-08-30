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
 *
 * WHY THESE AREN'T <Button>: they're radio segments — full-height, stacked
 * label over value, and painted by a sliding indicator that lives behind them
 * rather than by their own background. Running them through Button would mean
 * overriding its height, padding, radius, background and press behaviour, at
 * which point nothing of the component is left.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. "BEST VALUE" WAS ONLY VISIBLE ONCE YOU'D ALREADY PICKED IT. The label
 *    rendered only when the best-value pack happened to be the selected one,
 *    so the thing it exists to advertise was invisible until you'd found it by
 *    accident. It's marked on the segment now, so it can be seen before it's
 *    chosen.
 *
 * 2. CHANGING PACKS WAS SILENT TO A SCREEN READER. The segments announce a
 *    bare number — "30" — and the price, per-run cost and saving all live in a
 *    separate readout with no association to the group. Arrowing through the
 *    rail changed three figures nobody was told about. Each option now carries
 *    the whole offer in its accessible name.
 *
 * 3. THE THIRD READOUT PRINTED A NUMBER ALREADY ON SCREEN. When the selected
 *    pack was the baseline (no saving) it swapped to "Runs — 30", which is the
 *    same figure as the segment above it in the same typeface. It says "Base"
 *    now, which is a fact the other two cells don't already carry.
 *
 * 4. AN EMPTY RAIL WAS INDISTINGUISHABLE FROM A MISSING ONE. `return null` on
 *    no selection meant a caller that passed a key not in `packs` — or an empty
 *    array — rendered nothing at all, with no clue why. Empty still renders
 *    nothing (the callers handle that case with their own copy), but a
 *    mismatched key now falls back to the default pack rather than blanking the
 *    control.
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

  if (packs.length === 0) return null;

  /* A key that isn't in the list used to blank the whole control. Falling back
     to the default keeps the rail on screen and visibly out of sync with its
     parent, which is far easier to notice than a component that vanished. */
  const requested = packs.findIndex((p) => p.key === selectedKey);
  const selectedIndex = requested >= 0 ? requested : Math.min(1, packs.length - 1);
  const selected = packs[selectedIndex];

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
          const isBestValue = pack.key === bestValueKey;
          const packPerRun = pack.price_usd / pack.credits;
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
              /* The whole offer, not just the number. Arrowing along this rail
                 changed the price, the per-run cost and the saving underneath,
                 and announced none of them — the segment said "30". */
              aria-label={`${pack.credits} credits for $${pack.price_usd.toFixed(
                2
              )}, $${packPerRun.toFixed(2)} per run${isBestValue ? ", best value" : ""}`}
              onClick={() => onSelect(pack)}
              className={cn(
                "relative z-10 flex-1 rounded-md px-2 py-3 text-center outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950",
                isSelected ? "text-graphite-950" : "text-text-muted hover:text-text-primary"
              )}
            >
              {/* Marks best value ON the segment, so it can be seen before it's
                  picked. The header label above only ever appeared once you had
                  already landed on it — advertising a choice exclusively to the
                  people who had already made it. */}
              {isBestValue && !isSelected && (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-1 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500"
                />
              )}
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
        {/* Was "Runs — 30" on the baseline pack, which reprints the number
            already displayed two rows up in the same typeface. "Base" is a
            fact neither of the other cells carries. */}
        <Readout label="You save" value={savingPct >= 1 ? `${savingPct}%` : "Base"} />
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
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{label}</p>
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