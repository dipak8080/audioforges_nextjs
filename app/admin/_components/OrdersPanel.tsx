"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import type { OrdersData, SortKey, SortState } from "./orders/orders-types";
import { isProblem, readOrders } from "./orders/orders-types";
import { ago, timeOf } from "./orders/orders-format";
import { Note } from "./orders/OrdersPrimitives";
import { OrdersToolbar } from "./orders/OrdersToolbar";
import { AccessSummary } from "./orders/AccessSummary";
import { OrdersTable } from "./orders/OrdersTable";
import { SignalCard } from "./orders/SignalCard";

export function OrdersPanel({ tick, onOpenCustomer }: { tick: number; onOpenCustomer?: (email: string) => void }) {
  const [days, setDays] = useState<number>(90);
  const [data, setData] = useState<OrdersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "when", dir: "desc" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await readOrders(days));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load orders.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const problemCount = useMemo(() => (data?.orders ?? []).filter(isProblem).length, [data]);

  const rows = useMemo(() => {
    let all = data?.orders ?? [];
    if (problemsOnly) all = all.filter(isProblem);
    const needle = q.trim().toLowerCase();
    if (needle) {
      all = all.filter(
        (o) => o.email.toLowerCase().includes(needle) || o.provider_order_id.toLowerCase().includes(needle)
      );
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...all].sort((a, b) => {
      if (sort.key === "paid") return dir * (a.amount_cents - b.amount_cents);
      if (sort.key === "spent") return dir * (a.spent_since - b.spent_since);
      return dir * (timeOf(a.created_at) - timeOf(b.created_at));
    });
  }, [data, problemsOnly, q, sort]);

  const onSort = useCallback((key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));
  }, []);

  const signins = useMemo(() => {
    const frustrated = (r: { used: number; requested: number }) => (r.used === 0 && r.requested > 1 ? 0 : 1);
    return [...(data?.signals.signins_without_order ?? [])].sort(
      (a, b) => frustrated(a) - frustrated(b) || timeOf(b.last_at) - timeOf(a.last_at)
    );
  }, [data]);

  const stuck = data?.counts.not_yet_stale ?? 0;
  const failed = data?.counts.receipt_failed ?? 0;

  const emptyText = loading
    ? "Loading."
    : q.trim()
      ? "No orders match that filter."
      : problemsOnly
        ? "Nothing needs a look. Every buyer reached their credits."
        : "No orders in this window.";

  return (
    <div className="af-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      <OrdersToolbar
        q={q}
        onQ={setQ}
        problemsOnly={problemsOnly}
        onProblemsOnly={() => setProblemsOnly((v) => !v)}
        problemCount={problemCount}
        days={days}
        onDays={setDays}
        loading={loading}
      />

      {error && (
        <Note tone="alarm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </Note>
      )}

      <AccessSummary data={data} loading={loading} />

      {(stuck > 0 || failed > 0) && (
        <Note tone="alarm">
          {stuck > 0 && (
            <>
              {stuck} {stuck === 1 ? "person" : "people"} paid over an hour ago and {stuck === 1 ? "has" : "have"} not
              reached their credits.
            </>
          )}
          {stuck > 0 && failed > 0 && " "}
          {failed > 0 && (
            <>
              {failed} receipt {failed === 1 ? "email" : "emails"} failed to send.
            </>
          )}{" "}
          Open the row for the trail. If they write in, grant from Customer.
        </Note>
      )}

      <OrdersTable
        rows={rows}
        openId={openId}
        onToggle={(id) => setOpenId((cur) => (cur === id ? null : id))}
        onOpenCustomer={onOpenCustomer}
        sort={sort}
        onSort={onSort}
        emptyText={emptyText}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SignalCard
          title="Started checkout, never paid"
          count={data?.signals.abandoned_checkouts}
          blurb="Typed an email and started checkout. The payment never came."
          rows={data?.signals.abandoned_recent ?? []}
          keyOf={(r) => `${r.email}-${r.created_at}`}
          loading={loading}
          render={(r) => (
            <div className="flex items-center justify-between gap-4">
              <span className="truncate text-text-muted">{r.email}</span>
              <span className="shrink-0 text-text-subtle">
                {r.pack ?? "unknown pack"}, {ago(r.created_at)}
              </span>
            </div>
          )}
        />
        <SignalCard
          title="Asked to sign in, never bought"
          count={data?.signals.signins_without_order.length}
          blurb="Mostly people who hit the paywall and went looking for a login. Repeated requests mean the first link didn't do what they hoped."
          rows={signins}
          keyOf={(r) => r.email}
          loading={loading}
          render={(r) => {
            const hot = r.used === 0 && r.requested > 1;
            return (
              <div className="flex items-center justify-between gap-4">
                <span className={cn("truncate", hot ? "text-text-primary" : r.used > 0 ? "text-text-subtle" : "text-text-muted")}>
                  {r.email}
                </span>
                <span className={cn("shrink-0 tabular-nums", hot ? "text-amber-300" : "text-text-subtle")}>
                  {r.used} of {r.requested} used, {ago(r.last_at)}
                </span>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}