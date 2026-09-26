"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LOCALE_INFO } from "@/lib/i18n/locales";
import { downloadInvoice, fetchHistory, fetchOrders, type HistoryItem, type Order } from "@/lib/studio/account";

export function BillingSection() {
  const { t, locale, plural, usd } = useI18n();
  const a = t.account;
  const kinds = a.kinds;
  const statuses = a.status;
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState<string | null>(null);
  const [invoiceMsg, setInvoiceMsg] = useState<{ id: string; text: string } | null>(null);
  const fmt = new Intl.DateTimeFormat(LOCALE_INFO[locale].intl, { day: "numeric", month: "short", year: "numeric" });
  const date = (iso: string) => (Number.isFinite(Date.parse(iso)) ? fmt.format(new Date(iso)) : iso);

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchOrders(), fetchHistory(null)]).then(([o, h]) => {
      if (!alive) return;
      setOrders(o ?? []);
      setItems(h?.items ?? []);
      setNext(h?.next ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function more() {
    if (!next) return;
    setLoadingMore(true);
    const h = await fetchHistory(next);
    setLoadingMore(false);
    if (!h) return;
    setItems((cur) => [...(cur ?? []), ...h.items]);
    setNext(h.next);
  }

  async function invoice(id: string) {
    setInvoiceBusy(id);
    setInvoiceMsg(null);
    const r = await downloadInvoice(id);
    setInvoiceBusy(null);
    if (r !== "ok") setInvoiceMsg({ id, text: r === "rate_limited" ? a.invoiceLimit : a.invoiceError });
  }

  if (!orders || !items) return <div className="h-32 rounded-xl bg-graphite-850 motion-safe:animate-pulse" />;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{a.purchasesTitle}</p>
        {orders.length === 0 ? (
          <p className="text-sm text-text-muted">{a.noPurchases}</p>
        ) : (
          <ul className="divide-y divide-graphite-800 rounded-xl border border-graphite-800">
            {orders.map((o) => (
              <li key={o.orderId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block text-text-primary">
                    {o.pack === "pass" ? t.unlock.passTitle : plural(o.songs, t.songs.count)}
                    <span className="ml-2 font-mono text-text-muted">{usd(o.amountUsd)}</span>
                  </span>
                  <span className="block font-mono text-[11px] text-text-subtle">
                    {date(o.createdAt)} · {statuses[o.status as keyof typeof statuses] ?? o.status}
                  </span>
                  {invoiceMsg?.id === o.orderId && <span className="mt-1 block text-xs text-red-400">{invoiceMsg.text}</span>}
                </span>
                {o.invoiceAvailable && (
                  <Button size="sm" variant="outline" onClick={() => void invoice(o.orderId)} loading={invoiceBusy === o.orderId}>
                    <Download />
                    {a.downloadInvoice}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{a.activityTitle}</p>
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">{a.billingEmpty}</p>
        ) : (
          <ul className="divide-y divide-graphite-800 rounded-xl border border-graphite-800">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-text-primary">{kinds[r.kind as keyof typeof kinds] ?? kinds.other}</span>
                  <span className="block font-mono text-[11px] text-text-subtle">{date(r.createdAt)}</span>
                </span>
                <span className={r.delta > 0 ? "font-mono text-teal-400" : "font-mono text-text-muted"}>
                  {r.delta > 0 ? "+" : "−"}
                  {plural(Math.abs(r.delta), t.songs.count)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {next && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => void more()} loading={loadingMore}>
            {a.loadMore}
          </Button>
        )}
      </div>

      <p className="text-xs text-text-subtle">{a.billingReceipts}</p>
    </div>
  );
}