"use client";

import { Fragment } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OrderRow, SortKey, SortState } from "./orders-types";
import { ago, usd, whenLocal } from "./orders-format";
import { CopyEmail, StatusPill, Surface } from "./OrdersPrimitives";
import { JourneyTrail } from "./JourneyTrail";
import { OrderDetail } from "./OrderDetail";

interface Props {
  rows: OrderRow[];
  openId: string | null;
  onToggle: (id: string) => void;
  onOpenCustomer?: (email: string) => void;
  sort: SortState;
  onSort: (key: SortKey) => void;
  emptyText: string;
}

const th = "sticky top-0 z-10 bg-graphite-900/95 py-2.5 text-[11px] font-medium uppercase tracking-wider text-text-subtle backdrop-blur";

export function OrdersTable({ rows, openId, onToggle, onOpenCustomer, sort, onSort, emptyText }: Props) {
  if (rows.length === 0) {
    return (
      <Surface className="px-6 py-14 text-center">
        <Inbox className="mx-auto h-5 w-5 text-text-subtle" aria-hidden />
        <p className="mt-3 text-sm text-text-muted">{emptyText}</p>
      </Surface>
    );
  }

  return (
    <Surface className="overflow-hidden">
      <div className="af-scroll max-h-[34rem] overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left">
              <th className={cn(th, "px-5")}>Buyer</th>
              <th className={cn(th, "px-3")}>Journey</th>
              <th className={cn(th, "px-3")}>Reached credits</th>
              <SortableTh label="Paid" k="paid" sort={sort} onSort={onSort} />
              <SortableTh label="Spent" k="spent" sort={sort} onSort={onSort} />
              <SortableTh label="When" k="when" sort={sort} onSort={onSort} />
              <th className={cn(th, "px-3")} />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const isOpen = openId === o.id;
              const pct = o.credits > 0 ? Math.min(100, Math.round((100 * o.spent_since) / o.credits)) : 0;
              return (
                <Fragment key={o.id}>
                  <tr
                    onClick={() => onToggle(o.id)}
                    aria-expanded={isOpen}
                    className={cn(
                      "group cursor-pointer border-t border-graphite-800/70 transition-colors hover:bg-graphite-850/50",
                      isOpen && "bg-graphite-850/40"
                    )}
                  >
                    <td className="max-w-[16rem] px-5 py-3">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-text-primary">{o.email}</span>
                        <CopyEmail value={o.email} />
                      </div>
                      <div className="mt-0.5 text-[12px] text-text-subtle">
                        {o.credits} credits · {o.pack} pack
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <JourneyTrail o={o} compact />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <StatusPill o={o} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-primary">
                      {usd(o.amount_cents)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="h-1 w-12 overflow-hidden rounded-full bg-graphite-800" aria-hidden>
                          <span className="block h-full rounded-full bg-amber-400/80" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="tabular-nums text-text-primary">
                          {o.spent_since}
                          <span className="text-text-subtle"> / {o.credits}</span>
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-subtle" title={whenLocal(o.created_at)}>
                      {ago(o.created_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <ChevronDown
                        className={cn("inline h-3.5 w-3.5 text-text-subtle transition-transform", isOpen && "rotate-180")}
                        aria-hidden
                      />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-graphite-800/70">
                      <td colSpan={7} className="bg-graphite-950/50 px-5 py-5">
                        <OrderDetail o={o} onOpenCustomer={onOpenCustomer} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function SortableTh({ label, k, sort, onSort }: { label: string; k: SortKey; sort: SortState; onSort: (k: SortKey) => void }) {
  const active = sort.key === k;
  const Arrow = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn(th, "px-3 text-right")} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
          active ? "text-text-primary" : "hover:text-text-primary"
        )}
      >
        {label}
        <Arrow className={cn("h-3 w-3", active ? "opacity-100" : "opacity-0")} aria-hidden />
      </button>
    </th>
  );
}