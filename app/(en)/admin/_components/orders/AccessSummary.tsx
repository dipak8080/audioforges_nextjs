"use client";

import { cn } from "@/lib/utils/cn";
import type { OrdersData } from "./orders-types";
import { num, usd } from "./orders-format";
import { Surface } from "./OrdersPrimitives";

export function AccessSummary({ data, loading }: { data: OrdersData | null; loading: boolean }) {
  const c = data?.counts;
  const total = data?.orders.length ?? 0;
  const seg = (n: number) => (total ? `${(100 * n) / total}%` : "0%");
  const avg = total && data ? Math.round(data.revenue_cents / total) : null;

  return (
    <Surface className="px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
          <Stat label={total === 1 ? "order" : "orders"} value={loading && !data ? "—" : num(total)} />
          <Stat label={`in the last ${data?.days ?? "…"} days`} value={usd(data?.revenue_cents)} accent />
          <Stat label="avg per order" value={avg === null ? "—" : usd(avg)} muted />
        </div>
        {c && c.receipt_failed > 0 && (
          <p className="text-[13px] text-red-300">
            {c.receipt_failed} receipt {c.receipt_failed === 1 ? "email" : "emails"} failed to send
          </p>
        )}
      </div>

      <div
        className="mt-4 flex h-2 gap-px overflow-hidden rounded-full bg-graphite-800"
        role="img"
        aria-label="How buyers reached their credits"
      >
        <div className="rounded-l-full bg-teal-400/90 transition-[width] duration-500" style={{ width: seg(c?.in_tab ?? 0) }} />
        <div className="bg-amber-400/90 transition-[width] duration-500" style={{ width: seg(c?.signed_in ?? 0) }} />
        <div
          className={cn("rounded-r-full transition-[width] duration-500", c?.not_yet_stale ? "bg-red-500/90" : "bg-graphite-600")}
          style={{ width: seg(c?.not_yet ?? 0) }}
        />
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
        <Legend dot="bg-teal-400" label="Credits appeared in their tab" value={num(c?.in_tab)} />
        <Legend dot="bg-amber-400" label="Got in through the email link" value={num(c?.signed_in)} />
        <Legend
          dot={c?.not_yet_stale ? "bg-red-500" : "bg-graphite-600"}
          label="Not seen since paying"
          value={num(c?.not_yet)}
          valueClass={c?.not_yet_stale ? "text-red-300" : undefined}
        />
      </dl>
    </Surface>
  );
}

function Stat({ value, label, accent, muted }: { value: string; label: string; accent?: boolean; muted?: boolean }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums leading-none",
          accent ? "text-amber-400" : muted ? "text-text-muted" : "text-text-primary"
        )}
      >
        {value}
      </span>
      <span className="text-[13px] text-text-muted">{label}</span>
    </p>
  );
}

function Legend({ dot, label, value, valueClass }: { dot: string; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
      <dt className="text-text-muted">{label}</dt>
      <dd className={cn("font-medium tabular-nums text-text-primary", valueClass)}>{value}</dd>
    </div>
  );
}