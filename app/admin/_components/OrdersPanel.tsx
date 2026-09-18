"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

type Access = "in_tab" | "signed_in" | "not_yet";

interface OrderRow {
  id: string;
  email: string;
  pack: string;
  credits: number;
  amount_cents: number;
  currency: string;
  created_at: string;
  subject_id: string | null;
  account_id: string | null;
  provider: string;
  provider_order_id: string;
  receipt_sent_at: string | null;
  receipt_error: string | null;
  last_login_at: string | null;
  first_session_after: string | null;
  sessions_after: number;
  links_after: number;
  links_used_after: number;
  spent_since: number;
  balance: number;
  access: Access;
  stale: boolean;
}

interface AbandonedRow {
  email: string;
  pack: string | null;
  created_at: string;
}

interface NoOrderSignin {
  email: string;
  requested: number;
  used: number;
  last_at: string;
}

interface OrdersData {
  days: number;
  orders: OrderRow[];
  counts: {
    in_tab: number;
    signed_in: number;
    not_yet: number;
    not_yet_stale: number;
    receipt_failed: number;
  };
  revenue_cents: number;
  signals: {
    abandoned_checkouts: number;
    abandoned_recent: AbandonedRow[];
    signins_without_order: NoOrderSignin[];
  };
}

const WINDOWS = [
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
  { key: 365, label: "1y" },
] as const;

const ACCESS_HINT: Record<Access, string> = {
  in_tab: "Claim matched. Credits appeared silently in the tab they bought from.",
  signed_in: "Claim missed, but they signed in afterwards via the receipt link or the recovery form.",
  not_yet: "Paid, and nothing shows them reaching their credits. Check their inbox situation.",
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function num(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

function usd(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function ago(iso: string | null | undefined) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function whenLocal(iso: string | null | undefined) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

function minutesBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return Math.round((y - x) / 60000);
}

async function read<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

function Surface({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-graphite-800 bg-graphite-900/60", className)}>
      {children}
    </section>
  );
}

function Note({ tone, children }: { tone: "alarm" | "quiet"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-snug",
        tone === "alarm"
          ? "border-red-500/25 bg-red-500/[0.05] text-red-200"
          : "border-graphite-800 bg-graphite-900/60 text-text-muted"
      )}
    >
      <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "alarm" ? "text-red-400" : "text-text-subtle")} aria-hidden />
      <div>{children}</div>
    </div>
  );
}

function CopyEmail({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy email"
      aria-label={`Copy ${value}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        });
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
    >
      {done ? <Check className="h-3 w-3 text-teal-400" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* the journey trail                                                   */
/*                                                                     */
/* Paid → Reached credits → Spent. Three marks joined by a rule. The   */
/* rule fills as far as the buyer got, which reads faster than a badge */
/* and says what the badge cannot: HOW they got in, and whether the    */
/* credits have done anything since.                                   */
/* ------------------------------------------------------------------ */

function Trail({ o, compact = false }: { o: OrderRow; compact?: boolean }) {
  const reached = o.access !== "not_yet";
  const spent = o.spent_since > 0;
  const stale = o.access === "not_yet" && o.stale;
  const reachedLabel = o.access === "in_tab" ? "Reached credits in tab" : o.access === "signed_in" ? "Reached credits by email" : "Has not reached credits";

  const mark = (on: boolean, alarm = false) =>
    cn(
      "relative z-10 h-2.5 w-2.5 rounded-full ring-2 ring-graphite-900 transition-colors",
      on ? "bg-amber-400" : alarm ? "bg-red-500" : "bg-graphite-700"
    );
  const rule = (on: boolean) => cn("h-px flex-1 transition-colors", on ? "bg-amber-400/70" : "bg-graphite-700");

  return (
    <div className={cn("flex items-center", compact ? "w-[7.5rem]" : "w-full max-w-md")} title={`Paid. ${reachedLabel}. ${spent ? `${o.spent_since} spent.` : "Nothing spent yet."}`}>
      <span className={mark(true)} aria-hidden />
      <span className={rule(reached)} aria-hidden />
      <span className={mark(reached, stale)} aria-hidden />
      <span className={rule(spent)} aria-hidden />
      <span className={mark(spent)} aria-hidden />
      {!compact && (
        <span className="sr-only">
          Paid. {reachedLabel}. {spent ? `${o.spent_since} credits spent.` : "Nothing spent yet."}
        </span>
      )}
    </div>
  );
}

function accessWord(o: OrderRow) {
  if (o.access === "in_tab") return { text: "In tab", cls: "text-teal-300" };
  if (o.access === "signed_in") return { text: "By email", cls: "text-amber-300" };
  return { text: o.stale ? "Not yet" : "Waiting", cls: o.stale ? "text-red-300" : "text-text-subtle" };
}

/* ------------------------------------------------------------------ */
/* access bar: one line instead of five boxes                          */
/* ------------------------------------------------------------------ */

function AccessBar({ data, loading }: { data: OrdersData | null; loading: boolean }) {
  const c = data?.counts;
  const total = data?.orders.length ?? 0;
  const seg = (n: number) => (total ? `${(100 * n) / total}%` : "0%");

  return (
    <Surface className="px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-[15px] text-text-primary">
          <span className="text-2xl font-semibold tabular-nums">{loading && !data ? "—" : total}</span>
          <span className="text-text-muted"> {total === 1 ? "order" : "orders"}, </span>
          <span className="font-medium tabular-nums">{usd(data?.revenue_cents)}</span>
          <span className="text-text-muted"> in the last {data?.days ?? "…"} days</span>
        </p>
        {c && c.receipt_failed > 0 && (
          <p className="text-[13px] text-red-300">
            {c.receipt_failed} receipt {c.receipt_failed === 1 ? "email" : "emails"} failed to send
          </p>
        )}
      </div>

      <div className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-graphite-800" role="img" aria-label="How buyers reached their credits">
        <div className="bg-teal-400/90 transition-[width]" style={{ width: seg(c?.in_tab ?? 0) }} />
        <div className="bg-amber-400/90 transition-[width]" style={{ width: seg(c?.signed_in ?? 0) }} />
        <div className={cn("transition-[width]", c?.not_yet_stale ? "bg-red-500/90" : "bg-graphite-600")} style={{ width: seg(c?.not_yet ?? 0) }} />
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-teal-400" aria-hidden />
          <dt className="text-text-muted">Credits appeared in their tab</dt>
          <dd className="font-medium tabular-nums text-text-primary">{num(c?.in_tab)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          <dt className="text-text-muted">Got in through the email link</dt>
          <dd className="font-medium tabular-nums text-text-primary">{num(c?.signed_in)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", c?.not_yet_stale ? "bg-red-500" : "bg-graphite-600")} aria-hidden />
          <dt className="text-text-muted">Not seen since paying</dt>
          <dd className={cn("font-medium tabular-nums", c?.not_yet_stale ? "text-red-300" : "text-text-primary")}>
            {num(c?.not_yet)}
          </dd>
        </div>
      </dl>
    </Surface>
  );
}

/* ------------------------------------------------------------------ */

function Detail({ o }: { o: OrderRow }) {
  const toSignIn = minutesBetween(o.created_at, o.first_session_after);
  const rows: { k: string; v: React.ReactNode; tone?: "bad" | "good" }[] = [
    { k: "Paid", v: whenLocal(o.created_at) },
    { k: "Ko-fi order", v: o.provider_order_id },
    { k: "Browser linked at purchase", v: o.subject_id ? "Yes, claim matched" : "No, claim missed", tone: o.subject_id ? "good" : undefined },
    {
      k: "First sign-in after paying",
      v: o.first_session_after ? `${whenLocal(o.first_session_after)}${toSignIn !== null ? `, ${toSignIn} min later` : ""}` : "None",
      tone: o.first_session_after ? "good" : o.access === "not_yet" ? "bad" : undefined,
    },
    { k: "Sessions since", v: num(o.sessions_after) },
    { k: "Sign-in links since", v: `${num(o.links_used_after)} used of ${num(o.links_after)} sent` },
    { k: "Receipt email", v: o.receipt_error ? "Failed" : o.receipt_sent_at ? "Sent" : "Before tracking", tone: o.receipt_error ? "bad" : o.receipt_sent_at ? "good" : undefined },
    { k: "Spent since", v: `${num(o.spent_since)} of ${num(o.credits)} credits` },
    { k: "Balance now", v: `${num(o.balance)} credits` },
    { k: "Last login", v: o.last_login_at ? ago(o.last_login_at) : "Never" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div>
        <Trail o={o} />
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-text-muted">{ACCESS_HINT[o.access]}</p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.k} className="min-w-0">
              <dt className="text-[11px] text-text-subtle">{r.k}</dt>
              <dd className={cn("mt-0.5 truncate text-[13px] tabular-nums", r.tone === "bad" ? "text-red-300" : r.tone === "good" ? "text-teal-300" : "text-text-primary")}>
                {r.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-3 self-start">
        {o.receipt_error ? (
          <Note tone="alarm">
            The receipt never sent. If the claim also missed, this buyer has no automatic way in.
            <span className="mt-1 block font-mono text-[11px] text-red-300/80">{o.receipt_error}</span>
          </Note>
        ) : o.access === "not_yet" ? (
          <Note tone="quiet">
            The receipt carried a sign-in link. If they bought straight from Ko-fi, that email is their only route.
            Look them up in Customer and grant by hand if they write in.
          </Note>
        ) : null}
      </div>
    </div>
  );
}

const PREVIEW_ROWS = 6;

function SignalList<T>({
  title,
  count,
  blurb,
  rows,
  render,
  keyOf,
  loading,
}: {
  title: string;
  count: number | undefined;
  blurb: string;
  rows: T[];
  render: (row: T) => React.ReactNode;
  keyOf: (row: T) => string;
  loading: boolean;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW_ROWS);
  const more = rows.length - PREVIEW_ROWS;

  return (
    <Surface className="flex min-h-[16rem] flex-col p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[14px] font-medium text-text-primary">{title}</h3>
        <span className="text-xl font-semibold tabular-nums text-text-primary">{num(count)}</span>
      </div>
      <p className="mt-1 max-w-prose text-[12px] leading-snug text-text-subtle">{blurb}</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-[13px] text-text-subtle">{loading ? "Loading." : "None in this window."}</p>
      ) : (
        <ul className="mt-4 flex-1 divide-y divide-graphite-800/70">
          {shown.map((r) => (
            <li key={keyOf(r)} className="py-2 text-[13px]">
              {render(r)}
            </li>
          ))}
        </ul>
      )}

      {more > 0 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-3 self-start text-[12px] text-text-muted underline-offset-4 hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </Surface>
  );
}

/* ------------------------------------------------------------------ */

export function OrdersPanel({ tick, onOpenCustomer }: { tick: number; onOpenCustomer?: (email: string) => void }) {
  const [days, setDays] = useState<number>(90);
  const [data, setData] = useState<OrdersData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await read<OrdersData>(`/api/admin/credits?view=orders&days=${days}&limit=200`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load orders.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const rows = useMemo(() => {
    const all = data?.orders ?? [];
    return problemsOnly ? all.filter((o) => o.access === "not_yet" || o.receipt_error) : all;
  }, [data, problemsOnly]);

  const stuck = data?.counts.not_yet_stale ?? 0;
  const failed = data?.counts.receipt_failed ?? 0;

  return (
    <div className="af-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-medium text-text-primary">Every purchase, and whether the buyer got to what they paid for</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={problemsOnly}
            onClick={() => setProblemsOnly((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
              problemsOnly ? "border-amber-500/40 bg-amber-500/15 text-amber-300" : "border-graphite-800 bg-graphite-900/60 text-text-muted hover:text-text-primary"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Needs a look
          </button>
          <div className="flex items-center gap-0.5 rounded-lg border border-graphite-800 bg-graphite-900/60 p-0.5" role="group" aria-label="Window">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                aria-pressed={days === w.key}
                onClick={() => setDays(w.key)}
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

      {error && <Note tone="alarm">{error}</Note>}

      <AccessBar data={data} loading={loading} />

      {(stuck > 0 || failed > 0) && (
        <Note tone="alarm">
          {stuck > 0 && (
            <>
              {stuck} {stuck === 1 ? "person" : "people"} paid over an hour ago and {stuck === 1 ? "has" : "have"} not reached their credits.
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

      <Surface className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm text-text-muted">
              {loading ? "Loading." : problemsOnly ? "Nothing needs a look. Every buyer reached their credits." : "No orders in this window."}
            </p>
          </div>
        ) : (
          <div className="af-scroll max-h-[34rem] overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[12px] text-text-subtle">
                  <th className="sticky top-0 z-10 bg-graphite-900/95 px-5 py-2.5 font-normal backdrop-blur">Buyer</th>
                  <th className="sticky top-0 z-10 bg-graphite-900/95 px-3 py-2.5 font-normal backdrop-blur">Journey</th>
                  <th className="sticky top-0 z-10 bg-graphite-900/95 px-3 py-2.5 font-normal backdrop-blur">Reached credits</th>
                  <th className="sticky top-0 z-10 bg-graphite-900/95 px-3 py-2.5 text-right font-normal backdrop-blur">Paid</th>
                  <th className="sticky top-0 z-10 bg-graphite-900/95 px-3 py-2.5 text-right font-normal backdrop-blur">Spent</th>
                  <th className="sticky top-0 z-10 bg-graphite-900/95 px-3 py-2.5 text-right font-normal backdrop-blur">When</th>
                  <th className="sticky top-0 z-10 bg-graphite-900/95 px-3 py-2.5 backdrop-blur" />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const isOpen = open === o.id;
                  const w = accessWord(o);
                  return (
                    <Fragment key={o.id}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : o.id)}
                        aria-expanded={isOpen}
                        className={cn(
                          "group cursor-pointer border-t border-graphite-800/70 transition-colors hover:bg-graphite-850/50",
                          isOpen && "bg-graphite-850/40"
                        )}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1">
                            <span className="truncate text-text-primary">{o.email}</span>
                            <CopyEmail value={o.email} />
                          </div>
                          <div className="mt-0.5 text-[12px] text-text-subtle">
                            {o.credits} credits, {o.pack} pack
                          </div>
                        </td>
                        <td className="px-3 py-3"><Trail o={o} compact /></td>
                        <td className={cn("whitespace-nowrap px-3 py-3", w.cls)}>{w.text}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-primary">{usd(o.amount_cents)}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-primary">
                          {o.spent_since}<span className="text-text-subtle"> / {o.credits}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-text-subtle">{ago(o.created_at)}</td>
                        <td className="px-3 py-3 text-right">
                          <ChevronDown className={cn("inline h-3.5 w-3.5 text-text-subtle transition-transform", isOpen && "rotate-180")} aria-hidden />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-graphite-800/70">
                          <td colSpan={7} className="bg-graphite-950/50 px-5 py-5">
                            <Detail o={o} />
                            {onOpenCustomer && (
                              <button
                                type="button"
                                onClick={() => onOpenCustomer(o.email)}
                                className="mt-5 inline-flex h-8 items-center rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-[12px] font-medium text-text-primary transition-colors hover:border-graphite-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                              >
                                Open in Customer
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <div className="grid gap-4 lg:grid-cols-2">
        <SignalList
          title="Started checkout, never paid"
          count={data?.signals.abandoned_checkouts}
          blurb="Typed an email at the gate and went to Ko-fi. The payment never came."
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
        <SignalList
          title="Asked to sign in, never bought"
          count={data?.signals.signins_without_order.length}
          blurb="Mostly people who hit the paywall and went looking for a login. Repeated requests mean the first link didn't do what they hoped."
          rows={data?.signals.signins_without_order ?? []}
          keyOf={(r) => r.email}
          loading={loading}
          render={(r) => (
            <div className="flex items-center justify-between gap-4">
              <span className="truncate text-text-muted">{r.email}</span>
              <span className={cn("shrink-0 tabular-nums", r.used === 0 && r.requested > 1 ? "text-amber-300" : "text-text-subtle")}>
                {r.used} of {r.requested} used, {ago(r.last_at)}
              </span>
            </div>
          )}
        />
      </div>
    </div>
  );
}