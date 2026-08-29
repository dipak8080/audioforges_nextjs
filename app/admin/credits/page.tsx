"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Coins, Loader2, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * CREDITS OPS.
 *
 * Exists to back a promise already printed on every Ko-fi listing: "Balance not
 * updated after a couple of minutes? Message me, I'll fix it by hand." Before
 * this page, "by hand" meant SSH and SQL against a live ledger.
 *
 * WHY TABLES AND NOT JSON
 *
 * The first version rendered every endpoint as pretty-printed JSON, because the
 * response shapes weren't documented. That was the wrong trade. A wall of JSON
 * is technically complete and operationally useless: it buried the fact that
 * audio-to-midi-hq had failed 9 jobs out of 12 inside a scrolling <pre>, which
 * is precisely the thing an ops screen exists to make impossible to miss.
 *
 * Shapes below are transcribed from live responses. Fields are read
 * defensively — a missing key renders a dash, never a crash and never a
 * silent 0.
 */

type View = "lookup" | "webhooks" | "overview" | "costs" | "jobs";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "lookup", label: "Find a customer", hint: "The 'I paid and got nothing' screen" },
  { id: "webhooks", label: "Webhooks", hint: "Payments that never matched an account" },
  { id: "overview", label: "Overview", hint: "Paywall state, liability, unit economics" },
  { id: "costs", label: "Costs", hint: "Day x tool: jobs, GPU seconds, dollars" },
  { id: "jobs", label: "Recent jobs", hint: "Cost joined to billing outcome" },
];

interface Overview {
  paywall?: {
    enabled?: boolean;
    provider?: string;
    metered_routes?: string[];
    free_monthly_ops?: number;
    free_monthly_ops_per_ip?: number;
  };
  accounts?: number;
  credits_outstanding?: number;
  holds_open?: number;
  jobs_refunded?: number;
  webhooks_unprocessed?: number;
  usage?: { jobs?: number; gpu_seconds?: number; est_cost_usd?: number };
}

interface CostRow {
  day: string;
  tool: string;
  jobs: number;
  completed: number;
  failed: number;
  input_minutes: number;
  gpu_seconds: number;
  est_cost_usd: number;
  paid_jobs: number;
  free_jobs: number;
}

interface JobRow {
  job_id: string;
  tool: string;
  status: string;
  input_seconds: number | null;
  gpu_seconds: number | null;
  est_cost_usd: number | null;
  charge_type: string | null;
  error: string | null;
  created_at: string;
  ended_at: string | null;
  charge_status: string | null;
  refund_reason: string | null;
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON — surfaced raw */
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `$${n.toFixed(4)}`;
const num = (n: number | null | undefined, dp = 0) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString(undefined, { maximumFractionDigits: dp });
const shortTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
};

export default function AdminCreditsPage() {
  const [view, setView] = useState<View>("lookup");

  return (
    <div className="mx-auto min-h-0 w-full max-w-7xl flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <header className="mb-4 flex items-center gap-2.5">
        <Coins className="h-5 w-5 text-amber-400" aria-hidden />
        <h1 className="text-lg font-semibold tracking-tight">Credits</h1>
      </header>

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Credits views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            title={v.hint}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-amber-400/70",
              view === v.id
                ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
            )}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {view === "lookup" ? <LookupPanel /> : <ReadPanel key={view} view={view} />}
    </div>
  );
}

function LookupPanel() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string) => {
    const trimmed = address.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await api(
        `/api/admin/credits?view=lookup&email=${encodeURIComponent(trimmed)}`
      )) as Record<string, unknown>;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(email);
        }}
        className="flex flex-wrap gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
            aria-hidden
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email they paid with"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-lg border border-graphite-700 bg-graphite-850 pl-10 pr-3 text-sm outline-none placeholder:text-text-subtle focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-graphite-950 outline-none transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
        </button>
      </form>

      {error && <ErrorNote message={error} />}
      {result && <LookupResult data={result} />}

      <AdjustForm email={email} onApplied={() => void lookup(email)} />
    </div>
  );
}

/**
 * The lookup response shape is the one still unconfirmed, so this surfaces the
 * numbers worth reading if present and keeps the rest behind a collapsed
 * details block. Guessing a table here would render blank rows, which on this
 * screen reads as "this customer has nothing" — the most expensive wrong
 * answer the page could give.
 */
function LookupResult({ data }: { data: Record<string, unknown> }) {
  const pick = (k: string) => (typeof data[k] === "number" ? (data[k] as number) : undefined);
  const known = [
    { label: "Balance", value: pick("balance") },
    { label: "Free left", value: pick("free_remaining") },
    { label: "Held", value: pick("held_credits") },
  ].filter((s) => s.value !== undefined);

  return (
    <section className="space-y-3">
      {known.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {known.map((s) => (
            <Stat key={s.label} label={s.label} value={num(s.value)} />
          ))}
        </div>
      )}
      <Raw label="Full record" data={data} />
    </section>
  );
}

function AdjustForm({ email, onApplied }: { email: string; onApplied: () => void }) {
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const parsed = Number(delta);
  const validDelta = Number.isInteger(parsed) && parsed !== 0 && Math.abs(parsed) <= 1000;
  const validNote = note.trim().length >= 3 && note.trim().length <= 200;
  const ready = Boolean(email.trim()) && validDelta && validNote && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = (await api("/api/admin/credits?action=adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          delta: parsed,
          note: note.trim(),
        }),
      })) as { applied?: boolean; balance?: number };

      // `applied: false` is a SAFE REPLAY — the idempotency key already existed
      // and nothing was written twice. Reporting both as "done" would let
      // someone click three times and believe they granted 30.
      setDone(
        res.applied === false
          ? `Already applied earlier — nothing written twice. Balance is ${res.balance ?? "?"}.`
          : `Applied. Balance is now ${res.balance ?? "?"}.`
      );
      setDelta("");
      setNote("");
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
      <div>
        <h2 className="text-sm font-semibold">Adjust balance</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Writes a new ledger row against{" "}
          <span className="text-text-primary">{email.trim() || "the email above"}</span>. The
          ledger is append-only, so a negative delta adds a −N entry rather than undoing a
          grant. Creates the account if the email is unknown — the normal case for a payment
          the webhook never matched.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="delta"
          className="h-11 w-28 rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-sm tabular-nums outline-none placeholder:text-text-subtle focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="note — e.g. Ko-fi order #1234, webhook never fired"
          className="h-11 min-w-0 flex-1 rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-sm outline-none placeholder:text-text-subtle focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready}
          className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-graphite-950 outline-none transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>

      {/* Note is required and deliberately has no default. Six months from now
          an unexplained +30 is indistinguishable from a bug, and the only
          person who can tell is whoever made it today. */}
      <p className="text-[11px] leading-relaxed text-text-subtle">
        Note required, 3–200 characters. Delta is a non-zero integer between −1000 and 1000.
      </p>

      {error && <ErrorNote message={error} />}
      {done && (
        <p className="flex items-start gap-2 text-xs text-teal-400" role="status">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {done}
        </p>
      )}
    </section>
  );
}

function ReadPanel({ view }: { view: View }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState("30");

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ view });
        if (view === "webhooks") params.set("unprocessed_only", "true");
        if (view === "costs") params.set("days", days);
        if (view === "jobs") params.set("limit", "100");
        const next = await api(`/api/admin/credits?${params.toString()}`);
        if (signal?.aborted) return;
        setData(next);
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Request failed.");
        setData(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [view, days]
  );

  /*
    The fetch is kicked off from an effect, but every setState happens AFTER an
    await — never synchronously in the effect body. The abort signal is what
    makes that safe: switching view mid-request would otherwise let a stale
    response overwrite the new one.
  */
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {view === "costs" && (
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="h-9 rounded-lg border border-graphite-700 bg-graphite-850 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500/20"
          >
            {["7", "30", "90"].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-sm text-text-muted outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </button>
      </div>

      {error && <ErrorNote message={error} />}
      {loading && !data && (
        <p className="flex items-center gap-2 py-6 text-sm text-text-subtle">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </p>
      )}

      {data !== null && view === "overview" && <OverviewPanel data={data as Overview} />}
      {data !== null && view === "costs" && (
        <CostsTable rows={(data as { daily?: CostRow[] }).daily ?? []} />
      )}
      {data !== null && view === "jobs" && (
        <JobsTable rows={(data as { jobs?: JobRow[] }).jobs ?? []} />
      )}
      {data !== null && view === "webhooks" && (
        <WebhooksPanel rows={(data as { webhooks?: unknown[] }).webhooks ?? []} />
      )}
    </div>
  );
}

function OverviewPanel({ data }: { data: Overview }) {
  const pw = data.paywall ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Outstanding credits are money already taken for work not yet done —
            the closest thing this business has to a balance-sheet liability. */}
        <Stat label="Outstanding" value={num(data.credits_outstanding)} accent />
        <Stat label="Accounts" value={num(data.accounts)} />
        <Stat label="Holds open" value={num(data.holds_open)} />
        <Stat label="Jobs refunded" value={num(data.jobs_refunded)} />
        <Stat
          label="Webhooks unmatched"
          value={num(data.webhooks_unprocessed)}
          alarm={Boolean(data.webhooks_unprocessed)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Jobs (all time)" value={num(data.usage?.jobs)} />
        <Stat label="GPU seconds" value={num(data.usage?.gpu_seconds, 1)} />
        <Stat label="Est. GPU spend" value={money(data.usage?.est_cost_usd)} />
      </div>

      <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
          Paywall
        </p>
        <p className="mt-2 text-sm">
          <span className={pw.enabled ? "text-teal-400" : "text-text-muted"}>
            {pw.enabled ? "Enabled" : "Disabled"}
          </span>
          {pw.provider ? ` · ${pw.provider}` : ""} · {num(pw.free_monthly_ops)} free/month per
          account, {num(pw.free_monthly_ops_per_ip)} per IP
        </p>
        {pw.metered_routes && pw.metered_routes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {pw.metered_routes.map((r) => (
              <span
                key={r}
                className="rounded-full border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] text-amber-400"
              >
                {r}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CostsTable({ rows }: { rows: CostRow[] }) {
  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          jobs: a.jobs + (r.jobs ?? 0),
          failed: a.failed + (r.failed ?? 0),
          cost: a.cost + (r.est_cost_usd ?? 0),
          paid: a.paid + (r.paid_jobs ?? 0),
        }),
        { jobs: 0, failed: 0, cost: 0, paid: 0 }
      ),
    [rows]
  );

  if (rows.length === 0) return <Empty>No jobs in this window.</Empty>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Jobs" value={num(totals.jobs)} />
        <Stat label="Failed" value={num(totals.failed)} alarm={totals.failed > 0} />
        <Stat label="Paid jobs" value={num(totals.paid)} />
        <Stat label="Est. spend" value={money(totals.cost)} accent />
      </div>

      <Table
        head={["Day", "Tool", "Jobs", "Failed", "Paid", "Free", "Min", "GPU s", "Cost"]}
        rightFrom={2}
      >
        {rows.map((r, i) => {
          // A failure rate this page must not let you scroll past.
          const bad = r.jobs > 0 && r.failed / r.jobs >= 0.25;
          return (
            <tr key={`${r.day}-${r.tool}-${i}`} className="border-t border-graphite-800">
              <Td className="whitespace-nowrap text-text-muted">{r.day}</Td>
              <Td className="font-mono text-[11px]">{r.tool}</Td>
              <Td right>{num(r.jobs)}</Td>
              <Td right className={bad ? "font-semibold text-red-400" : undefined}>
                {num(r.failed)}
                {bad ? ` (${Math.round((r.failed / r.jobs) * 100)}%)` : ""}
              </Td>
              <Td right>{num(r.paid_jobs)}</Td>
              <Td right className="text-text-subtle">
                {num(r.free_jobs)}
              </Td>
              <Td right className="text-text-subtle">
                {num(r.input_minutes, 1)}
              </Td>
              <Td right className="text-text-subtle">
                {num(r.gpu_seconds, 1)}
              </Td>
              <Td right className="text-amber-400">
                {money(r.est_cost_usd)}
              </Td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}

function JobsTable({ rows }: { rows: JobRow[] }) {
  if (rows.length === 0) return <Empty>No recent jobs.</Empty>;
  return (
    <Table head={["When", "Tool", "Status", "Charge", "Input s", "GPU s", "Cost"]} rightFrom={4}>
      {rows.map((r) => (
        <tr key={r.job_id} className="border-t border-graphite-800 align-top">
          <Td className="whitespace-nowrap text-text-subtle">{shortTime(r.created_at)}</Td>
          <Td className="font-mono text-[11px]">{r.tool}</Td>
          <Td>
            <span
              className={cn(
                r.status === "failed" && "text-red-400",
                r.status === "completed" && "text-teal-400"
              )}
            >
              {r.status}
            </span>
            {/* The server writes these for a human. Truncated, never hidden —
                why a job failed is the whole point of this row. */}
            {r.error && (
              <span className="mt-0.5 block max-w-md truncate text-[11px] text-text-subtle">
                {r.error}
              </span>
            )}
          </Td>
          <Td>
            <span
              className={cn(
                "font-mono text-[11px]",
                r.charge_type === "credit" ? "text-amber-400" : "text-text-subtle"
              )}
            >
              {r.charge_type ?? "—"}
            </span>
            {r.charge_status && r.charge_status !== "settled" && (
              <span className="ml-1.5 font-mono text-[10px] text-text-subtle">
                {r.charge_status}
              </span>
            )}
          </Td>
          <Td right className="text-text-subtle">
            {num(r.input_seconds, 1)}
          </Td>
          <Td right className="text-text-subtle">
            {num(r.gpu_seconds, 1)}
          </Td>
          <Td right className="text-amber-400">
            {money(r.est_cost_usd)}
          </Td>
        </tr>
      ))}
    </Table>
  );
}

function WebhooksPanel({ rows }: { rows: unknown[] }) {
  if (rows.length === 0) {
    return (
      <Empty>No unmatched webhooks. Every payment reached an account — nothing to chase.</Empty>
    );
  }
  // Shape unconfirmed until one appears. Replace with a table then.
  return <Raw label="Unmatched webhooks" data={rows} />;
}

function Stat({
  label,
  value,
  accent,
  alarm,
}: {
  label: string;
  value: string;
  accent?: boolean;
  alarm?: boolean;
}) {
  return (
    <div className="rounded-xl border border-graphite-800 bg-graphite-900 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-mono text-xl font-semibold tabular-nums",
          alarm ? "text-red-400" : accent ? "text-amber-400" : "text-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Table({
  head,
  rightFrom,
  children,
}: {
  head: string[];
  rightFrom: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-graphite-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-graphite-900">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                className={cn(
                  "px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-text-subtle",
                  i >= rightFrom && "text-right"
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return <td className={cn("px-3 py-2.5", right && "text-right tabular-nums", className)}>{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-graphite-800 bg-graphite-900 px-4 py-8 text-center text-sm text-text-subtle">
      {children}
    </p>
  );
}

/** Escape hatch for shapes not yet confirmed. Collapsed, so it can never
 *  become the page again. */
function Raw({ label, data }: { label: string; data: unknown }) {
  return (
    <details className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
      <summary className="cursor-pointer px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </summary>
      <pre className="max-h-96 overflow-auto border-t border-graphite-800 p-4 text-xs leading-relaxed text-text-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-3 text-xs leading-relaxed"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
      {message}
    </p>
  );
}