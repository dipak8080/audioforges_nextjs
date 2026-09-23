"use client";

import { AlertTriangle, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WINDOWS } from "./orders-types";

interface Props {
  q: string;
  onQ: (v: string) => void;
  problemsOnly: boolean;
  onProblemsOnly: () => void;
  problemCount: number;
  days: number;
  onDays: (d: number) => void;
  loading: boolean;
}

export function OrdersToolbar({ q, onQ, problemsOnly, onProblemsOnly, problemCount, days, onDays, loading }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[15px] font-medium text-text-primary">
        Every purchase, and whether the buyer got to what they paid for
      </h2>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            placeholder="Filter by email or order id"
            aria-label="Filter orders by email or order id"
            className="h-8 w-56 rounded-lg border border-graphite-800 bg-graphite-900/60 pl-8 pr-7 text-[13px] text-text-primary placeholder:text-text-subtle transition-colors hover:border-graphite-700 focus:border-amber-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button
              type="button"
              onClick={() => onQ("")}
              aria-label="Clear filter"
              className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-text-subtle hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}
        </div>

        <button
          type="button"
          aria-pressed={problemsOnly}
          onClick={onProblemsOnly}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
            problemsOnly
              ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
              : "border-graphite-800 bg-graphite-900/60 text-text-muted hover:text-text-primary"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Needs a look
          {problemCount > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[11px] tabular-nums",
                problemsOnly ? "bg-amber-500/25 text-amber-200" : "bg-graphite-800 text-text-muted"
              )}
            >
              {problemCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-0.5 rounded-lg border border-graphite-800 bg-graphite-900/60 p-0.5" role="group" aria-label="Window">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              aria-pressed={days === w.key}
              onClick={() => onDays(w.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                days === w.key ? "bg-graphite-800 text-text-primary" : "text-text-subtle hover:text-text-primary"
              )}
            >
              {w.label}
            </button>
          ))}
          {loading && <Loader2 className="mx-1.5 h-3 w-3 animate-spin text-text-subtle motion-reduce:animate-none" aria-hidden />}
        </div>
      </div>
    </div>
  );
}