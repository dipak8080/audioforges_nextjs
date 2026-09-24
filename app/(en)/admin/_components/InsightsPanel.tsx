"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Flame, ShieldCheck, Users, Wallet } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api, isAbort, msg } from "./credits/credits-net";
import { money, num, relTime } from "./credits/credits-format";
import { Badge, Card, DataScroll, Empty, ErrorNote, SectionLabel, SkeletonPanel, Stat, Td, Th, Tr } from "./credits/CreditsUi";
import { toolLabel } from "./spend";

interface SourceRow {
  source: string;
  tool: string;
  orders: number;
  amount_cents: number;
  credits: number;
  last_at: string | null;
}
interface StartedRow {
  source: string;
  tool: string;
  checkouts: number;
}
interface Sources {
  days: number;
  paid: SourceRow[];
  checkouts_started: StartedRow[];
}
interface TopIp {
  ip_hash: string | null;
  runs: number;
  est_cost_usd: number;
  active_days: number;
  tools: string | null;
  last_at: string | null;
  failed: number;
}
interface Abuse {
  days: number;
  runs: number;
  ips: number;
  est_cost_usd: number;
  share_top10: number;
  top: TopIp[];
  daily: { day: string; runs: number; ips: number; est_cost_usd: number }[];
  budget: { daily_usd: number; today: { spent_usd: number; in_flight: number; projected_usd: number; jobs: number } };
  limits: { free_runs_before_challenge: number; daily_separation_cap: number | string | null };
  turnstile: { solved: number; active: number; enabled: boolean };
}
interface MonthRow {
  month: string;
  revenue_usd: number;
  orders: number;
  credits_sold: number;
  jobs: number;
  paid_jobs: number;
  free_jobs: number;
  gpu_cost_usd: number;
  free_gpu_cost_usd: number;
  fixed_cost_usd: number;
  net_usd: number;
}
interface Monthly {
  months: number;
  fixed_cost_usd: number;
  rows: MonthRow[];
  totals: { revenue_usd: number; gpu_cost_usd: number; fixed_cost_usd: number; net_usd: number };
}

const WINDOWS = [
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
] as const;

const SOURCE_LABEL: Record<string, string> = {
  "youtube-funnel": "YouTube funnel",
  "(none)": "Direct / untracked",
};

function sourceLabel(s: string) {
  return SOURCE_LABEL[s] ?? s;
}

function monthLabel(m: string) {
  const d = new Date(`${m}-01T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

export function InsightsPanel({ tick }: { tick: number }) {
  const [days, setDays] = useState<(typeof WINDOWS)[number]["key"]>(30);
  const key = `${days}:${tick}`;
  const [result, setResult] = useState<{
    key: string;
    sources?: Sources;
    abuse?: Abuse;
    monthly?: Monthly;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Sources>(`/api/admin/credits?view=sources&days=${days}`),
      api<Abuse>(`/api/admin/credits?view=abuse&days=${days}`),
      api<Monthly>(`/api/admin/credits?view=monthly&months=12`),
    ])
      .then(([sources, abuse, monthly]) => {
        if (alive) setResult({ key, sources, abuse, monthly });
      })
      .catch((e) => {
        if (!alive || isAbort(e)) return;
        setResult({ key, error: msg(e, "Could not load insights") });
      });
    return () => {
      alive = false;
    };
  }, [days, tick, key]);

  const loading = result?.key !== key;
  const sources = result?.sources ?? null;
  const abuse = result?.abuse ?? null;
  const monthly = result?.monthly ?? null;
  const error = result?.key === key ? result?.error ?? null : null;

  const started = useMemo(() => {
    const map = new Map<string, number>();
    sources?.checkouts_started.forEach((r) => map.set(`${r.source}|${r.tool}`, r.checkouts));
    return map;
  }, [sources]);

  const revenue = useMemo(
    () => (sources?.paid ?? []).reduce((n, r) => n + r.amount_cents, 0) / 100,
    [sources]
  );
  const orders = useMemo(() => (sources?.paid ?? []).reduce((n, r) => n + r.orders, 0), [sources]);

  const budget = abuse?.budget;
  const budgetPct =
    budget && budget.daily_usd > 0 ? Math.min(1, budget.today.projected_usd / budget.daily_usd) : null;
  const share = abuse?.share_top10 ?? 0;

  if (error) return <ErrorNote message={error} />;
  if (loading && !abuse) return <SkeletonPanel />;

  return (
    <div className="af-rise af-scroll -mr-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-6 pr-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionLabel>Window</SectionLabel>
          <p className="mt-0.5 text-[11px] text-text-subtle">Attribution and free-tier figures use it. Monthly net is always the last 12 months.</p>
        </div>
        <div className="flex rounded-full border border-graphite-700 bg-graphite-900/60 p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setDays(w.key)}
              aria-pressed={days === w.key}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70",
                days === w.key ? "bg-graphite-700 text-text-primary" : "text-text-muted hover:text-text-primary"
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Revenue" value={money(revenue, 2)} sub={`${num(orders)} paid orders in ${days}d`} tone="accent" icon={Wallet} />
        <Stat
          label="GPU today"
          value={money(budget?.today.projected_usd ?? 0, 2)}
          sub={
            budget && budget.daily_usd > 0
              ? `of $${budget.daily_usd.toFixed(2)} free budget, ${budget.today.in_flight} in flight`
              : "Budget switch is off"
          }
          tone={budgetPct !== null && budgetPct >= 0.8 ? "alarm" : "plain"}
          icon={Flame}
        />
        <Stat label="Free runs" value={num(abuse?.runs)} sub={`${num(abuse?.ips)} unique visitors, ${money(abuse?.est_cost_usd, 2)} GPU`} icon={Users} />
        <Stat
          label="Top 10 share"
          value={`${Math.round(share * 100)}%`}
          sub={share >= 0.5 ? "A few people eat most free runs" : "Spread across many people"}
          tone={share >= 0.5 ? "alarm" : "good"}
          icon={AlertTriangle}
        />
        <Stat
          label="Human checks"
          value={abuse?.turnstile.enabled ? num(abuse.turnstile.solved) : "Off"}
          sub={
            abuse?.turnstile.enabled
              ? `after ${abuse.limits.free_runs_before_challenge} free runs a day, ${num(abuse.turnstile.active)} passes active`
              : "Set TURNSTILE_SECRET_KEY to enable"
          }
          icon={ShieldCheck}
        />
      </div>

      <div className="grid shrink-0 gap-4 xl:grid-cols-2">
        <Card className="flex shrink-0 flex-col">
          <div className="flex items-baseline justify-between px-4 pt-4">
            <div>
              <p className="text-sm font-semibold">Where sales come from</p>
              <p className="mt-0.5 text-[11px] text-text-subtle">First touch that brought the buyer, and what opened checkout.</p>
            </div>
          </div>
          <div className="p-3">
            {!sources?.paid.length ? (
              <Empty title="No paid orders in this window" body="Attribution starts with orders placed after it shipped. Earlier sales show as Direct / untracked." />
            ) : (
              <DataScroll className="max-h-72">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <Th>Source</Th>
                      <Th>Opened by</Th>
                      <Th right>Checkouts</Th>
                      <Th right>Orders</Th>
                      <Th right>Converted</Th>
                      <Th right>Revenue</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.paid.map((r) => {
                      const s = started.get(`${r.source}|${r.tool}`) ?? 0;
                      const conv = s ? Math.round((r.orders / s) * 100) : null;
                      return (
                        <Tr key={`${r.source}|${r.tool}`}>
                          <Td>
                            <Badge tone={r.source === "youtube-funnel" ? "accent" : r.source === "(none)" ? "muted" : "plain"}>
                              {sourceLabel(r.source)}
                            </Badge>
                          </Td>
                          <Td className="text-text-muted">{r.tool === "pricing" ? "Pricing page" : !r.tool || r.tool === "(unknown)" ? "–" : toolLabel(r.tool)}</Td>
                          <Td right>{s ? num(s) : "–"}</Td>
                          <Td right className="font-medium text-text-primary">{num(r.orders)}</Td>
                          <Td right>{conv === null ? "–" : `${Math.min(conv, 100)}%`}</Td>
                          <Td right className="text-amber-400">{money(r.amount_cents / 100, 2)}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataScroll>
            )}
          </div>
        </Card>

        <Card className="flex shrink-0 flex-col">
          <div className="flex items-baseline justify-between px-4 pt-4">
            <div>
              <p className="text-sm font-semibold">Heaviest free users</p>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                Hashed IPs, never raw addresses.{abuse?.limits.daily_separation_cap ? ` Daily cap ${abuse.limits.daily_separation_cap} separations.` : ""}
              </p>
            </div>
          </div>
          <div className="p-3">
            {!abuse?.top.length ? (
              <Empty title="No free GPU runs in this window" />
            ) : (
              <DataScroll className="max-h-72">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <Th>Visitor</Th>
                      <Th right>Runs</Th>
                      <Th right>Days</Th>
                      <Th>Tools</Th>
                      <Th right>GPU</Th>
                      <Th right>Failed</Th>
                      <Th right>Last</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {abuse.top.map((r, i) => {
                      const perDay = (r.runs ?? 0) / Math.max(1, r.active_days ?? 1);
                      const hot = perDay >= 10;
                      const hash = r.ip_hash ?? "";
                      return (
                        <Tr key={hash || `unknown-${i}`}>
                          <Td>
                            <span className="inline-flex items-center gap-2">
                              <span className="w-4 text-right font-mono text-[11px] text-text-subtle">{i + 1}</span>
                              <span className="font-mono text-[12px] text-text-muted" title={hash || "Saved without an IP hash"}>
                                {hash ? hash.slice(0, 10) : "unrecorded"}
                              </span>
                              {hot && <Badge tone="bad">{Math.round(perDay)}/day</Badge>}
                            </span>
                          </Td>
                          <Td right className="font-medium text-text-primary">{num(r.runs)}</Td>
                          <Td right>{num(r.active_days)}</Td>
                          <Td className="text-text-muted">
                            <span className="block max-w-[180px] truncate" title={r.tools ?? ""}>
                              {String(r.tools ?? "").split(",").filter(Boolean).map((t) => toolLabel(t)).join(", ")}
                            </span>
                          </Td>
                          <Td right>{money(r.est_cost_usd, 2)}</Td>
                          <Td right className={r.failed ? "text-red-400" : ""}>{num(r.failed)}</Td>
                          <Td right className="text-text-subtle">{relTime(r.last_at)}</Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </table>
              </DataScroll>
            )}
          </div>
        </Card>
      </div>

      <Card className="flex shrink-0 flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
          <div>
            <p className="text-sm font-semibold">Monthly net</p>
            <p className="mt-0.5 text-[11px] text-text-subtle">
              Revenue minus metered GPU cost minus fixed cost ({money(monthly?.fixed_cost_usd, 2)} a month, set in Config). GPU is the metering floor, not the RunPod invoice.
            </p>
          </div>
          {monthly && (
            <div className="flex gap-4 text-[12px]">
              <span className="text-text-subtle">12 months</span>
              <span className="text-amber-400">{money(monthly.totals.revenue_usd, 2)} in</span>
              <span className="text-text-muted">{money(monthly.totals.gpu_cost_usd + monthly.totals.fixed_cost_usd, 2)} out</span>
              <span className={cn("font-semibold", monthly.totals.net_usd >= 0 ? "text-teal-400" : "text-red-400")}>
                {money(monthly.totals.net_usd, 2)} net
              </span>
            </div>
          )}
        </div>
        <div className="p-3">
          {!monthly?.rows.length ? (
            <Empty title="Nothing recorded yet" />
          ) : (
            <DataScroll className="max-h-80">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <Th>Month</Th>
                    <Th right>Revenue</Th>
                    <Th right>Orders</Th>
                    <Th right>Credits sold</Th>
                    <Th right>Jobs</Th>
                    <Th right>Paid / free</Th>
                    <Th right>GPU</Th>
                    <Th right>Free GPU</Th>
                    <Th right>Fixed</Th>
                    <Th right>Net</Th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.rows.map((r) => (
                    <Tr key={r.month}>
                      <Td className="font-medium text-text-primary">{monthLabel(r.month)}</Td>
                      <Td right className="text-amber-400">{money(r.revenue_usd, 2)}</Td>
                      <Td right>{num(r.orders)}</Td>
                      <Td right>{num(r.credits_sold)}</Td>
                      <Td right>{num(r.jobs)}</Td>
                      <Td right className="text-text-muted">{num(r.paid_jobs)} / {num(r.free_jobs)}</Td>
                      <Td right>{money(r.gpu_cost_usd, 2)}</Td>
                      <Td right className="text-text-muted">{money(r.free_gpu_cost_usd, 2)}</Td>
                      <Td right className="text-text-muted">{money(r.fixed_cost_usd, 2)}</Td>
                      <Td right className={cn("font-semibold", r.net_usd >= 0 ? "text-teal-400" : "text-red-400")}>
                        {money(r.net_usd, 2)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            </DataScroll>
          )}
        </div>
      </Card>
    </div>
  );
}