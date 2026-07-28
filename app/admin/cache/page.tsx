"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, Trash2, Loader2, HardDrive, FileStack, Gauge } from "lucide-react";

interface CacheStats {
  enabled: boolean;
  backend: string;
  entry_count: number;
  total_bytes: number;
  total_gb: number;
  max_bytes: number;
  max_gb: number;
  percent_full: number;
}

function healthTone(percent: number): { bar: string; text: string; label: string } {
  if (percent >= 90) return { bar: "bg-red-500", text: "text-red-500", label: "Nearly full" };
  if (percent >= 70) return { bar: "bg-amber-500", text: "text-amber-400", label: "Filling up" };
  return { bar: "bg-teal-400", text: "text-teal-400", label: "Healthy" };
}

export default function AdminCachePage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [lastCleared, setLastCleared] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cache", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      setStats(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  async function handleClear() {
    if (!confirm("Clear the entire download cache? This deletes every cached file on disk. This can't be undone.")) return;
    setClearing(true);
    setLastCleared(null);
    try {
      const res = await fetch("/api/admin/cache", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      setLastCleared(`Removed ${data.files_removed ?? 0} files.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClearing(false);
    }
  }

  const percent = stats?.percent_full ?? 0;
  const health = healthTone(percent);
  const freeGb = stats ? Math.max(0, stats.max_gb - stats.total_gb) : 0;

  return (
    <div className="mx-auto max-w-3xl w-full px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Download Cache</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
        <p className="text-xs sm:text-sm text-text-muted">
          Local-disk cache of previously downloaded audio — repeat requests skip re-downloading.
        </p>
      </div>

      {loading ? (
        <div className="rounded-lg border border-graphite-800 bg-graphite-900 flex items-center gap-2 text-text-subtle text-sm py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-graphite-800 bg-graphite-900 py-10">
          <p className="text-sm text-red-500 text-center px-4">Failed to load: {error}</p>
        </div>
      ) : stats ? (
        <>
          {/* Stat strip - three key numbers at a glance */}
          <div className="grid grid-cols-3 divide-x divide-graphite-800 rounded-lg border border-graphite-800 bg-graphite-900">
            <StatBlock icon={FileStack} label="Entries" value={stats.entry_count.toLocaleString()} />
            <StatBlock icon={HardDrive} label="Used" value={`${stats.total_gb} GB`} />
            <StatBlock icon={Gauge} label="Free" value={`${freeGb.toFixed(2)} GB`} />
          </div>

          {/* Usage card */}
          <div className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold">Storage usage</span>
              </div>
              <span className={`text-xs font-medium ${health.text}`}>{health.label}</span>
            </div>

            <div>
              <div className="flex justify-between items-baseline text-xs text-text-subtle mb-1.5">
                <span className="tabular-nums">{stats.total_gb} GB of {stats.max_gb} GB</span>
                <span className={`tabular-nums font-medium ${health.text}`}>{percent}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-graphite-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${health.bar} transition-all duration-500`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-text-subtle">
              Backend: <span className="text-text-muted">{stats.backend}</span> · Least-recently-used entries are
              evicted automatically once the cache reaches its size cap.
            </p>
          </div>

          {/* Danger zone */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text-primary">Clear entire cache</p>
              <p className="text-xs text-text-muted mt-0.5">
                Deletes all {stats.entry_count.toLocaleString()} cached files and their metadata. The next request
                for each track re-downloads from YouTube.
              </p>
            </div>
            <button
              onClick={handleClear}
              disabled={clearing || stats.entry_count === 0}
              className="flex items-center justify-center gap-1.5 rounded-md border border-red-500/40 text-red-500 px-3.5 py-2 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {clearing ? "Clearing…" : "Clear cache"}
            </button>
          </div>
          {lastCleared && (
            <p className="text-xs text-teal-400 -mt-2 px-1">{lastCleared}</p>
          )}
        </>
      ) : null}
    </div>
  );
}

function StatBlock({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="px-3 sm:px-5 py-3.5 min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-text-subtle" />
        <p className="text-[11px] uppercase tracking-wider text-text-subtle truncate">{label}</p>
      </div>
      <p className="text-lg sm:text-xl font-semibold tabular-nums text-text-primary truncate">{value}</p>
    </div>
  );
}