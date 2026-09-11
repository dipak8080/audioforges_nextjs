"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Coins, Cookie, Database, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { RefreshControl } from "./_components/RefreshControl";
import { SpendBoard, Toggle } from "./_components/SpendCharts";
import { buildSpendModel, rangeDates, type CostRow, type RangeKey } from "./_components/spend";

interface CreditsOverview {
  accounts?: number;
  credits_outstanding?: number;
  holds_open?: number;
  webhooks_unprocessed?: number;
}

interface CacheStats {
  enabled: boolean;
  backend: string;
  entry_count: number;
  total_gb: number;
  max_gb: number;
  percent_full: number;
}

interface CookieSlot {
  exists: boolean;
  path: string;
  size_bytes?: number;
  last_modified?: number;
}

type DashRange = Extract<RangeKey, "7d" | "30d" | "90d">;

const json = async <T,>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
};

export default function AdminDashboardPage() {
  const [range, setRange] = useState<DashRange>("30d");
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [cookies, setCookies] = useState<Record<string, CookieSlot> | null>(null);
  const [credits, setCredits] = useState<CreditsOverview | null>(null);
  const [rows, setRows] = useState<CostRow[] | null>(null);
  const [costsFailed, setCostsFailed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setBusy(true);
    setTick((t) => t + 1);
  }, []);

  const changeRange = useCallback((next: DashRange) => {
    setBusy(true);
    setRange(next);
  }, []);

  useEffect(() => {
    let live = true;
    const { from, to } = rangeDates(range);
    Promise.all([
      json<CacheStats>("/api/admin/cache"),
      json<Record<string, CookieSlot>>("/api/admin/cookies"),
      json<CreditsOverview>("/api/admin/credits?view=overview"),
      json<{ daily?: CostRow[] }>(`/api/admin/credits?view=costs&date_from=${from}&date_to=${to}`),
    ]).then(([c, k, cr, costs]) => {
      if (!live) return;
      setCache(c);
      setCookies(k);
      setCredits(cr);
      setRows(costs?.daily ?? null);
      setCostsFailed(costs === null);
      setBusy(false);
      setLastUpdated(Date.now());
    });
    return () => {
      live = false;
    };
  }, [range, tick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key.toLowerCase() === "r") refresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh]);

  const model = useMemo(() => {
    if (!rows) return null;
    const { from, to } = rangeDates(range);
    return buildSpendModel(rows, from, to);
  }, [rows, range]);

  const cookieSlots = cookies ? Object.values(cookies) : [];
  const cookiesPresent = cookieSlots.filter((s) => s.exists).length;
  const cookieTotal = cookieSlots.length || 3;
  const unmatched = credits?.webhooks_unprocessed ?? 0;
  const holds = credits?.holds_open ?? 0;

  return (
    <div className="scrollbar-thin min-h-0 w-full flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
            <p className="mt-0.5 text-[13px] text-text-muted">GPU spend, tool usage and backend health.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle<DashRange>
              label="Date range"
              value={range}
              onChange={changeRange}
              options={[
                { key: "7d", label: "7 days" },
                { key: "30d", label: "30 days" },
                { key: "90d", label: "90 days" },
              ]}
            />
            <RefreshControl busy={busy} lastUpdated={lastUpdated} onRefresh={refresh} />
          </div>
        </div>

        {(unmatched > 0 || holds > 0) && (
          <Link
            href="/admin/credits"
            className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-[13px] text-red-200 outline-none transition-colors hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-400/70"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <span className="min-w-0 flex-1">
              {unmatched > 0 &&
                `${unmatched} Ko-fi payment${unmatched === 1 ? "" : "s"} did not reach an account. `}
              {holds > 0 && `${holds} job${holds === 1 ? " is" : "s are"} still holding a credit.`}
            </span>
            <span className="shrink-0 text-red-300">Open credits</span>
          </Link>
        )}

        <div className="mt-5">
          {!model && busy ? (
            <div className="space-y-4">
              <div className="h-[420px] animate-pulse rounded-2xl border border-graphite-800 bg-graphite-900/60" />
              <div className="h-[260px] animate-pulse rounded-2xl border border-graphite-800 bg-graphite-900/60" />
            </div>
          ) : costsFailed && !model ? (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-5 text-[13px] text-red-200">
              Spend data did not load. Check that BACKEND_CREDITS_ADMIN_TOKEN is set, then refresh.
            </div>
          ) : model && model.tools.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-graphite-800 bg-graphite-900/40 px-6 py-14 text-center">
              <p className="text-sm font-medium text-text-muted">No GPU jobs in this range</p>
              <p className="mt-1 text-[13px] text-text-subtle">Pick a longer range to see spend and usage.</p>
            </div>
          ) : model ? (
            <div className={cn("transition-opacity", busy && "opacity-60")}>
              <SpendBoard model={model} range={range} variant="compact" />
              <div className="mt-2 flex justify-end">
                <Link
                  href="/admin/credits?view=costs"
                  className="inline-flex items-center gap-1 rounded text-[13px] text-amber-400 outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  Full spend breakdown
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-text-primary">Backend</h2>
          <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-800 sm:grid-cols-2 lg:grid-cols-4">
            <HealthTile
              href="/admin/credits"
              icon={Coins}
              title="Credits"
              value={credits ? `${(credits.credits_outstanding ?? 0).toLocaleString()} unspent` : "–"}
              detail={credits ? `${credits.accounts ?? 0} accounts` : "Stats did not load"}
              tone={unmatched > 0 ? "bad" : "ok"}
            />
            <HealthTile
              href="/admin/cache"
              icon={Database}
              title="Cache"
              value={cache ? `${cache.entry_count.toLocaleString()} entries` : "–"}
              detail={cache ? `${cache.total_gb} of ${cache.max_gb} GB used` : "Stats did not load"}
              meter={cache ? cache.percent_full : undefined}
              tone={!cache ? "bad" : cache.percent_full >= 90 ? "warn" : "ok"}
            />
            <HealthTile
              href="/admin/cookies"
              icon={Cookie}
              title="YouTube cookies"
              value={cookies ? `${cookiesPresent} of ${cookieTotal} slots` : "–"}
              detail={
                !cookies
                  ? "Stats did not load"
                  : cookiesPresent === cookieTotal
                    ? "All slots filled"
                    : `${cookieTotal - cookiesPresent} empty`
              }
              tone={!cookies ? "bad" : cookiesPresent === 0 ? "bad" : cookiesPresent < cookieTotal ? "warn" : "ok"}
            />
            <HealthTile
              href="/admin/logs"
              icon={ScrollText}
              title="Logs"
              value="Live requests"
              detail="HTTP and system logs"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function HealthTile({
  href,
  icon: Icon,
  title,
  value,
  detail,
  meter,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  detail: string;
  meter?: number;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 bg-graphite-900 p-4 outline-none transition-colors hover:bg-graphite-850 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/70"
    >
      <span className="flex items-center gap-2 text-[12px] text-text-subtle">
        <Icon className="h-3.5 w-3.5" />
        {title}
        {tone && (
          <span
            aria-label={tone === "ok" ? "Healthy" : tone === "warn" ? "Needs a look" : "Problem"}
            className={cn(
              "ml-auto h-2 w-2 rounded-full",
              tone === "ok" && "bg-teal-400",
              tone === "warn" && "bg-amber-400",
              tone === "bad" && "bg-red-400"
            )}
          />
        )}
      </span>
      <span className="text-[15px] font-semibold tabular-nums text-text-primary group-hover:text-amber-300">{value}</span>
      <span className="text-[12px] text-text-muted">{detail}</span>
      {meter !== undefined && (
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-graphite-800">
          <span
            className={cn("block h-full rounded-full", meter >= 90 ? "bg-red-400" : "bg-amber-500/80")}
            style={{ width: `${Math.min(100, Math.max(meter, 1))}%` }}
          />
        </span>
      )}
    </Link>
  );
}