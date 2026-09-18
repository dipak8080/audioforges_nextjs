"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Mail,
  MousePointerClick,
  Receipt,
  ShoppingBag,
  UserX,
} from "lucide-react";
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

const ACCESS_LABEL: Record<Access, string> = {
  in_tab: "In tab",
  signed_in: "Signed in",
  not_yet: "Not yet",
};

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
/* primitives, local on purpose (same reason as GatePanel)             */
/* ------------------------------------------------------------------ */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-graphite-800 bg-graphite-900/70", className)}>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-medium text-text-subtle">{children}</p>;
}

function Stat({
  label,
  value,
  sub,
  tone = "plain",
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "accent" | "good" | "alarm";
  icon?: typeof ShoppingBag;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3.5 py-3 transition-colors",
        tone === "alarm"
          ? "border-red-500/30 bg-red-500/[0.06]"
          : "border-graphite-800 bg-graphite-900/70 hover:border-graphite-700"
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-text-subtle" aria-hidden />}
        <SectionLabel>{label}</SectionLabel>
      </div>
      <p
        className={cn(
          "mt-1.5 text-xl font-semibold leading-none tabular-nums",
          tone === "alarm"
            ? "text-red-400"
            : tone === "accent"
              ? "text-amber-400"
              : tone === "good"
                ? "text-teal-400"
                : "text-text-primary"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-text-subtle">{sub}</p>}
    </div>
  );
}

function Badge({
  children,
  tone = "plain",
  title,
}: {
  children: React.ReactNode;
  tone?: "plain" | "good" | "bad" | "accent" | "muted";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        tone === "good" && "border-teal-500/30 bg-teal-500/10 text-teal-300",
        tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-300",
        tone === "accent" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
        tone === "muted" && "border-graphite-700 bg-graphite-850 text-text-subtle",
        tone === "plain" && "border-graphite-700 bg-graphite-850 text-text-muted"
      )}
    >
      {children}
    </span>
  );
}

function CopyEmail({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy email"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        });
      }}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-text-subtle outline-none transition-colors hover:bg-graphite-800 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
    >
      {done ? <Check className="h-3 w-3 text-teal-400" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
    </button>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 whitespace-nowrap border-b border-graphite-800 bg-graphite-900/95 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-subtle backdrop-blur",
        right && "text-right"
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, right, className }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={cn("whitespace-nowrap px-3 py-2 text-[13px] text-text-primary", right && "text-right tabular-nums", className)}>
      {children}
    </td>
  );
}

function Kv({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "bad" | "good" }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-text-subtle">{k}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-[13px] tabular-nums",
          tone === "bad" ? "text-red-300" : tone === "good" ? "text-teal-300" : "text-text-primary"
        )}
      >
        {v}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function accessTone(a: Access, stale: boolean): "good" | "accent" | "bad" | "muted" {
  if (a === "in_tab") return "good";
  if (a === "signed_in") return "accent";
  return stale ? "bad" : "muted";
}

function OrderDetail({ o }: { o: OrderRow }) {
  const toSignIn = minutesBetween(o.created_at, o.first_session_after);
  const receiptState = o.receipt_error
    ? { label: "Failed", tone: "bad" as const }
    : o.receipt_sent_at
      ? { label: "Sent", tone: "good" as const }
      : { label: "Not recorded", tone: undefined };

  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-relaxed text-text-muted">{ACCESS_HINT[o.access]}</p>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kv k="Paid" v={whenLocal(o.created_at)} />
        <Kv k="Provider order" v={o.provider_order_id} />
        <Kv k="Account" v={o.account_id ?? "—"} />
        <Kv k="Browser linked at purchase" v={o.subject_id ? "Yes" : "No"} tone={o.subject_id ? "good" : undefined} />

        <Kv
          k="First sign-in after"
          v={
            o.first_session_after
              ? `${whenLocal(o.first_session_after)}${toSignIn !== null ? ` (${toSignIn} min later)` : ""}`
              : "None"
          }
          tone={o.first_session_after ? "good" : o.access === "not_yet" ? "bad" : undefined}
        />
        <Kv k="Sessions since" v={num(o.sessions_after)} />
        <Kv k="Sign-in links since" v={`${num(o.links_used_after)} used of ${num(o.links_after)}`} />
        <Kv k="Receipt email" v={receiptState.label} tone={receiptState.tone} />

        <Kv k="Spent since" v={`${num(o.spent_since)} credits`} />
        <Kv k="Balance now" v={`${num(o.balance)} credits`} />
        <Kv k="Last login" v={o.last_login_at ? ago(o.last_login_at) : "Never"} />
      </div>

      {o.receipt_error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
          <p className="text-[12px] leading-snug text-red-300">
            Receipt failed to send. If the claim also missed, this buyer has no automatic way to their
            credits. Error: <span className="font-mono">{o.receipt_error}</span>
          </p>
        </div>
      )}

      {o.access === "not_yet" && !o.receipt_error && (
        <p className="text-[12px] leading-snug text-text-subtle">
          The receipt went out with a sign-in link. If they bought straight from Ko-fi rather than through
          the gate, that email is their only way in. Look them up in Customer to grant by hand if needed.
        </p>
      )}
    </div>
  );
}

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
    if (!problemsOnly) return all;
    return all.filter((o) => o.access === "not_yet" || o.receipt_error);
  }, [data, problemsOnly]);

  const counts = data?.counts;
  const alarm = (counts?.not_yet_stale ?? 0) + (counts?.receipt_failed ?? 0);

  return (
    <div className="af-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-3.5 w-3.5 text-text-subtle" aria-hidden />
          <SectionLabel>Every paid order and whether the buyer reached their credits</SectionLabel>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={problemsOnly}
            onClick={() => setProblemsOnly((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
              problemsOnly
                ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                : "border-graphite-800 bg-graphite-900/70 text-text-muted hover:text-text-primary"
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Problems only
          </button>
          <div className="flex items-center gap-1 rounded-xl border border-graphite-800 bg-graphite-900/70 p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setDays(w.key)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[12px] font-medium tabular-nums transition-colors",
                  days === w.key ? "bg-graphite-800 text-text-primary" : "text-text-subtle hover:text-text-primary"
                )}
              >
                {w.label}
              </button>
            ))}
            {loading && <Loader2 className="mx-1 h-3 w-3 animate-spin text-text-subtle" aria-hidden />}
          </div>
        </div>
      </div>

      {error && (
        <Card className="flex items-start gap-2 border-red-500/30 bg-red-500/[0.06] p-3.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
          <p className="text-[13px] leading-snug text-red-300">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Orders" value={num(data?.orders.length)} sub={`${usd(data?.revenue_cents)} in window`} tone="accent" icon={ShoppingBag} />
        <Stat label="In tab" value={num(counts?.in_tab)} sub="Silent, the way it should go" tone="good" icon={MousePointerClick} />
        <Stat label="Signed in" value={num(counts?.signed_in)} sub="Got there by email link" icon={Mail} />
        <Stat
          label="Not yet"
          value={num(counts?.not_yet)}
          sub={counts?.not_yet_stale ? `${counts.not_yet_stale} older than an hour` : "Paid, not seen since"}
          tone={counts?.not_yet_stale ? "alarm" : "plain"}
          icon={UserX}
        />
        <Stat
          label="Receipt failed"
          value={num(counts?.receipt_failed)}
          sub="Email never left the server"
          tone={counts?.receipt_failed ? "alarm" : "plain"}
          icon={Receipt}
        />
      </div>

      {alarm > 0 && (
        <Card className="flex items-start gap-2 border-red-500/30 bg-red-500/[0.06] p-3.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
          <p className="text-[13px] leading-snug text-red-300">
            {alarm} order{alarm === 1 ? "" : "s"} need{alarm === 1 ? "s" : ""} a look. Open the row for the
            trail, then use Customer to grant by hand if they are stuck.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-text-muted">
              {loading ? "Loading." : problemsOnly ? "Every buyer reached their credits" : "No orders in this window"}
            </p>
          </div>
        ) : (
          <div className="af-scroll max-h-[32rem] overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Access</Th>
                  <Th>Email</Th>
                  <Th>Pack</Th>
                  <Th right>Paid</Th>
                  <Th right>Spent</Th>
                  <Th right>Balance</Th>
                  <Th>Receipt</Th>
                  <Th right>When</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const isOpen = open === o.id;
                  return (
                    <Fragment key={o.id}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : o.id)}
                        className="cursor-pointer border-b border-graphite-800/60 transition-colors hover:bg-graphite-850/60"
                      >
                        <Td>
                          <Badge tone={accessTone(o.access, o.stale)} title={ACCESS_HINT[o.access]}>
                            {ACCESS_LABEL[o.access]}
                            {o.stale && <AlertTriangle className="h-3 w-3" aria-hidden />}
                          </Badge>
                        </Td>
                        <Td className="max-w-[16rem]">
                          <span className="inline-flex items-center gap-1">
                            <span className="truncate text-amber-300">{o.email}</span>
                            <CopyEmail value={o.email} />
                          </span>
                        </Td>
                        <Td>
                          <span className="text-text-muted">{o.pack}</span>{" "}
                          <span className="tabular-nums">{o.credits}</span>
                        </Td>
                        <Td right>{usd(o.amount_cents)}</Td>
                        <Td right>{num(o.spent_since)}</Td>
                        <Td right>{num(o.balance)}</Td>
                        <Td>
                          {o.receipt_error ? (
                            <Badge tone="bad">Failed</Badge>
                          ) : o.receipt_sent_at ? (
                            <Badge tone="good">Sent</Badge>
                          ) : (
                            <Badge tone="muted">—</Badge>
                          )}
                        </Td>
                        <Td right className="text-text-subtle">{ago(o.created_at)}</Td>
                        <Td right>
                          <ChevronDown
                            className={cn("inline h-3.5 w-3.5 text-text-subtle transition-transform", isOpen && "rotate-180")}
                            aria-hidden
                          />
                        </Td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-graphite-800/60">
                          <td colSpan={9} className="bg-graphite-950/40 px-4 py-4">
                            <OrderDetail o={o} />
                            {onOpenCustomer && (
                              <button
                                type="button"
                                onClick={() => onOpenCustomer(o.email)}
                                className="mt-4 inline-flex h-8 items-center rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-[12px] font-medium text-text-primary transition-colors hover:border-graphite-600"
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
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Abandoned checkouts</SectionLabel>
            <span className="text-[13px] font-semibold tabular-nums text-text-primary">
              {num(data?.signals.abandoned_checkouts)}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-text-subtle">
            Typed an email at the gate, went to Ko-fi, never paid.
          </p>
          {(data?.signals.abandoned_recent ?? []).length === 0 ? (
            <p className="mt-3 text-[13px] text-text-subtle">{loading ? "Loading." : "None in this window."}</p>
          ) : (
            <ul className="mt-3 divide-y divide-graphite-800/60">
              {data!.signals.abandoned_recent.map((r) => (
                <li key={`${r.email}-${r.created_at}`} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                  <span className="truncate text-text-muted">{r.email}</span>
                  <span className="shrink-0 text-text-subtle">
                    {r.pack ?? "—"} · {ago(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <SectionLabel>Sign-in links with no order</SectionLabel>
            <span className="text-[13px] font-semibold tabular-nums text-text-primary">
              {num(data?.signals.signins_without_order.length)}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-text-subtle">
            Asked to sign in but never bought. Usually someone who hit the paywall and went looking for a
            login. Repeats mean the first link did not do what they expected.
          </p>
          {(data?.signals.signins_without_order ?? []).length === 0 ? (
            <p className="mt-3 text-[13px] text-text-subtle">{loading ? "Loading." : "None in this window."}</p>
          ) : (
            <ul className="mt-3 divide-y divide-graphite-800/60">
              {data!.signals.signins_without_order.map((r) => (
                <li key={r.email} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                  <span className="truncate text-text-muted">{r.email}</span>
                  <span className="shrink-0 tabular-nums text-text-subtle">
                    {r.used}/{r.requested} used · {ago(r.last_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}