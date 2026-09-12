"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Lock, TrendingUp, UserCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toolLabel } from "./spend";

type EventKey = "preview_blocked" | "submit_402";

interface EventTotals {
  event: string;
  events: number;
  subjects: number;
  ips: number;
}

interface ToolRow {
  tool: string;
  event: string;
  events: number;
  subjects: number;
}

interface DailyRow {
  day: string;
  tool: string;
  event: string;
  events: number;
  subjects: number;
  ips: number;
  signed_in_events: number;
}

interface GateData {
  days: number;
  by_event: Partial<Record<EventKey, EventTotals>>;
  by_tool: ToolRow[];
  blocked_subjects: number;
  blocked_accounts: number;
  buyers_in_window: number;
  conversion_pct_ceiling?: number;
}

const WINDOWS = [
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
] as const;

const EVENT_LABEL: Record<string, string> = {
  preview_blocked: "Gate seen",
  submit_402: "Blocked on submit",
};

function num(value: number | null | undefined, dp = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

async function read<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

/* ------------------------------------------------------------------ */
/* primitives — local on purpose                                       */
/*                                                                     */
/* page.tsx keeps Card/Stat private to the route file. Importing them  */
/* would mean exporting from a Next page module; these are small       */
/* enough that a local copy is the cheaper trade than coupling a route */
/* file to a component file.                                           */
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
  tone?: "plain" | "accent" | "good";
  icon?: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-graphite-800 bg-graphite-900/70 px-3.5 py-3 transition-colors hover:border-graphite-700">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-text-subtle" aria-hidden />}
        <SectionLabel>{label}</SectionLabel>
      </div>
      <p
        className={cn(
          "mt-1.5 text-xl font-semibold leading-none tabular-nums",
          tone === "accent" ? "text-amber-400" : tone === "good" ? "text-teal-400" : "text-text-primary"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-text-subtle">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function GatePanel({ tick }: { tick: number }) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<GateData | null>(null);
  const [daily, setDaily] = useState<DailyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summary, trend] = await Promise.all([
        read<GateData>(`/api/admin/credits?view=gate&days=${days}`),
        read<{ daily: DailyRow[] }>(`/api/admin/credits?view=gate_daily&days=${days}`),
      ]);
      setData(summary);
      setDaily(trend.daily ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the gate data.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const seen = data?.by_event?.preview_blocked;
  const hit = data?.by_event?.submit_402;

  const tools = useMemo(() => {
    if (!data?.by_tool) return [];
    const merged = new Map<string, { tool: string; seen: number; hit: number }>();
    for (const row of data.by_tool) {
      const entry = merged.get(row.tool) ?? { tool: row.tool, seen: 0, hit: 0 };
      if (row.event === "preview_blocked") entry.seen = row.subjects;
      if (row.event === "submit_402") entry.hit = row.subjects;
      merged.set(row.tool, entry);
    }
    return [...merged.values()].sort((a, b) => b.seen + b.hit - (a.seen + a.hit));
  }, [data]);

  const trend = useMemo(() => {
    if (!daily) return [];
    const byDay = new Map<string, { day: string; seen: number; hit: number }>();
    for (const row of daily) {
      const entry = byDay.get(row.day) ?? { day: row.day, seen: 0, hit: 0 };
      if (row.event === "preview_blocked") entry.seen += row.subjects;
      if (row.event === "submit_402") entry.hit += row.subjects;
      byDay.set(row.day, entry);
    }
    return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [daily]);

  const peak = Math.max(1, ...trend.map((row) => row.seen + row.hit));

  return (
    <div className="af-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-text-subtle" aria-hidden />
          <SectionLabel>People stopped by the paywall</SectionLabel>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-graphite-800 bg-graphite-900/70 p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setDays(w.key)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[12px] font-medium tabular-nums transition-colors",
                days === w.key
                  ? "bg-graphite-800 text-text-primary"
                  : "text-text-subtle hover:text-text-primary"
              )}
            >
              {w.label}
            </button>
          ))}
          {loading && <Loader2 className="mx-1 h-3 w-3 animate-spin text-text-subtle" aria-hidden />}
        </div>
      </div>

      {error && (
        <Card className="flex items-start gap-2 border-red-500/30 bg-red-500/[0.06] p-3.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
          <p className="text-[13px] leading-snug text-red-300">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Saw the gate"
          value={num(seen?.subjects)}
          sub={`${num(seen?.events)} events, ${num(seen?.ips)} IPs`}
          tone="accent"
          icon={Users}
        />
        <Stat
          label="Blocked on submit"
          value={num(hit?.subjects)}
          sub="Pushed through and were refused"
          icon={Lock}
        />
        <Stat
          label="Signed in and blocked"
          value={num(data?.blocked_accounts)}
          sub="Has an account, still couldn't run"
          icon={UserCheck}
        />
        <Stat
          label="Bought in window"
          value={num(data?.buyers_in_window)}
          sub={
            data?.conversion_pct_ceiling !== undefined
              ? `${data.conversion_pct_ceiling}% of blocked, at most`
              : "No blocked visitors yet"
          }
          tone="good"
          icon={TrendingUp}
        />
      </div>

      <Card className="p-3.5">
        <p className="text-[11px] leading-snug text-text-subtle">
          Counted by distinct visitor, not by event: the preview call fires on every file drop, so raw
          counts overstate people. The buy rate is a ceiling rather than a measurement, because orders
          carry no subject id and a buyer who was never blocked still lands in it. Read the trend.
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <SectionLabel>By tool</SectionLabel>
          {tools.length === 0 ? (
            <p className="mt-3 text-[13px] text-text-subtle">
              {loading ? "Loading." : "Nobody has hit the gate in this window."}
            </p>
          ) : (
            <div className="af-scroll mt-3 max-h-[22rem] overflow-y-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-graphite-800">
                    <th className="px-2 py-2 text-[12px] font-medium text-text-subtle">Tool</th>
                    <th className="px-2 py-2 text-right text-[12px] font-medium text-text-subtle">Saw</th>
                    <th className="px-2 py-2 text-right text-[12px] font-medium text-text-subtle">Blocked</th>
                  </tr>
                </thead>
                <tbody>
                  {tools.map((row) => (
                    <tr key={row.tool} className="border-b border-graphite-800/60 last:border-0">
                      <td className="px-2 py-2.5 align-top">{toolLabel(row.tool)}</td>
                      <td className="px-2 py-2.5 text-right align-top tabular-nums text-amber-400">
                        {num(row.seen)}
                      </td>
                      <td className="px-2 py-2.5 text-right align-top tabular-nums">{num(row.hit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionLabel>Day by day</SectionLabel>
          {trend.length === 0 ? (
            <p className="mt-3 text-[13px] text-text-subtle">
              {loading ? "Loading." : "No gate events recorded yet."}
            </p>
          ) : (
            <ul className="af-scroll mt-3 max-h-[22rem] space-y-1.5 overflow-y-auto">
              {trend.map((row) => {
                const total = row.seen + row.hit;
                return (
                  <li key={row.day} className="flex items-center gap-2.5">
                    <span className="w-[4.5rem] shrink-0 text-[12px] tabular-nums text-text-subtle">
                      {row.day.slice(5)}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-graphite-800">
                      <span
                        className="block h-full rounded-full bg-amber-400/70"
                        style={{ width: `${Math.round((total / peak) * 100)}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[12px] tabular-nums">{num(total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}