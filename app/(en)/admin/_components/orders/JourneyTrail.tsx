"use client";

import { cn } from "@/lib/utils/cn";
import type { OrderRow } from "./orders-types";
import { ago } from "./orders-format";

export function JourneyTrail({ o, compact = false }: { o: OrderRow; compact?: boolean }) {
  const reached = o.access !== "not_yet";
  const spent = o.spent_since > 0;
  const stale = o.access === "not_yet" && o.stale;
  const reachedLabel =
    o.access === "in_tab" ? "Reached credits in tab" : o.access === "signed_in" ? "Reached credits by email" : "Has not reached credits";

  const mark = (on: boolean, alarm = false) =>
    cn(
      "relative z-10 h-2.5 w-2.5 rounded-full ring-2 ring-graphite-900 transition-colors",
      on ? "bg-amber-400" : alarm ? "bg-red-500" : "bg-graphite-700",
      on && !compact && "shadow-[0_0_0_3px_rgba(232,162,61,0.12)]"
    );
  const rule = (on: boolean) => cn("h-px flex-1 transition-colors", on ? "bg-amber-400/70" : "bg-graphite-700");

  const line = (
    <div className="flex items-center" aria-hidden>
      <span className={mark(true)} />
      <span className={rule(reached)} />
      <span className={mark(reached, stale)} />
      <span className={rule(spent)} />
      <span className={mark(spent)} />
    </div>
  );

  const srText = `Paid. ${reachedLabel}. ${spent ? `${o.spent_since} credits spent.` : "Nothing spent yet."}`;

  if (compact) {
    return (
      <div className="w-[7.5rem]" title={srText}>
        {line}
        <span className="sr-only">{srText}</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      {line}
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px]">
        <span className="text-text-subtle">Paid {ago(o.created_at)}</span>
        <span
          className={cn(
            reached ? "text-amber-300" : stale ? "text-red-300" : "text-text-subtle"
          )}
        >
          {o.access === "in_tab" ? "In tab" : o.access === "signed_in" ? "By email" : stale ? "Not yet" : "Waiting"}
        </span>
        <span className={cn("tabular-nums", spent ? "text-text-muted" : "text-text-subtle")}>
          {spent ? `${o.spent_since} of ${o.credits} spent` : "Nothing spent"}
        </span>
      </div>
      <span className="sr-only">{srText}</span>
    </div>
  );
}