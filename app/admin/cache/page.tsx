"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database,
  RefreshCw,
  Trash2,
  Loader2,
  HardDrive,
  Save,
  Server,
  AlertTriangle,
  AlertOctagon,
  Check,
} from "lucide-react";
import { ConfirmDialog } from "../_components/ConfirmDialog";

interface CacheStats {
  enabled: boolean;
  backend: string;
  entry_count: number;
  total_bytes: number;
  total_gb: number;
  max_bytes: number;
  max_gb: number;
  percent_full: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_free_gb: number;
  disk_percent_used: number;
}

function fmtSize(gb: number): string {
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 1 : 2)} GB`;
  const mb = gb * 1024;
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return "empty";
}

function relativeAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

// Cache's own allowance fills up fast in normal use (it's designed to),
// so it gets a stricter threshold.
function cacheHealthTone(percent: number): { bar: string; text: string; label: string } {
  if (percent >= 95) return { bar: "bg-red-500", text: "text-red-500", label: "Full" };
  if (percent >= 75) return { bar: "bg-amber-500", text: "text-amber-400", label: "Filling up" };
  return { bar: "bg-teal-400", text: "text-teal-400", label: "Healthy" };
}

// The whole disk normally sits at 40-70% just from the OS and Docker, so
// this uses a more relaxed threshold - otherwise a perfectly ordinary VPS
// would show amber/red for existing.
function diskHealthTone(percent: number): { bar: string; text: string; label: string } {
  if (percent >= 90) return { bar: "bg-red-500", text: "text-red-500", label: "Critical" };
  if (percent >= 80) return { bar: "bg-amber-500", text: "text-amber-400", label: "High" };
  return { bar: "bg-teal-400", text: "text-teal-400", label: "Healthy" };
}

export default function AdminCachePage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const [clearing, setClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [lastCleared, setLastCleared] = useState<string | null>(null);

  const [gbInput, setGbInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitResult, setLimitResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/cache", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      setStats(data);
      setGbInput(String(data.max_gb));
      setLastLoadedAt(Date.now());
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

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 10000);
    return () => clearInterval(id);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
  }

  async function handleClear() {
    setClearing(true);
    setLastCleared(null);
    try {
      const res = await fetch("/api/admin/cache", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      const n = data.files_removed ?? 0;
      setLastCleared(
        n === 0
          ? "Nothing to remove — the cache was already empty."
          : `Removed ${n.toLocaleString()} cached ${n === 1 ? "file" : "files"}.`
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  }

  async function handleSaveLimit(e: React.FormEvent) {
    e.preventDefault();
    const gb = parseFloat(gbInput);
    if (!gb || gb <= 0) {
      setLimitResult({ ok: false, message: "Enter a valid number of GB." });
      return;
    }
    setSavingLimit(true);
    setLimitResult(null);
    try {
      const res = await fetch("/api/admin/cache", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gb }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      setStats(data);
      setLastLoadedAt(Date.now());
      setLimitResult({ ok: true, message: `Cache can now use up to ${fmtSize(gb)}.` });
    } catch (e) {
      setLimitResult({ ok: false, message: (e as Error).message });
    } finally {
      setSavingLimit(false);
    }
  }

  // ---- Derived values ----
  const percent = Math.min(100, stats?.percent_full ?? 0);
  const cacheHealth = cacheHealthTone(percent);
  const diskHealth = diskHealthTone(stats?.disk_percent_used ?? 0);

  const requestedGb = parseFloat(gbInput);
  const hasValidRequest = stats && !isNaN(requestedGb) && requestedGb > 0;
  const isDirty = hasValidRequest && requestedGb !== stats!.max_gb;

  const maxPossibleGb = stats ? Math.max(0.5, stats.total_gb + stats.disk_free_gb) : 0.5;
  const wouldExceedDisk = Boolean(hasValidRequest && requestedGb > maxPossibleGb);
  const wouldEvict = Boolean(hasValidRequest && stats && requestedGb < stats.total_gb);
  const sliderMax = stats ? Math.max(0.5, Math.floor(maxPossibleGb * 10) / 10) : 10;

  // Space the cache isn't accounting for - if this is large while the
  // cache itself is small, something other than the cache is eating the
  // disk (Docker images, logs, old builds) and the user needs to know
  // that clearing the cache alone won't fix a full disk.
  const unaccountedGb = stats ? Math.max(0, stats.disk_used_gb - stats.total_gb) : 0;

  // Single most urgent thing to surface at the top of the page - disk
  // takes priority over cache since a full disk breaks everything
  // (deploys, downloads, logging), while a full cache just evicts itself.
  const diskCritical = (stats?.disk_percent_used ?? 0) >= 90;
  const diskHigh = !diskCritical && (stats?.disk_percent_used ?? 0) >= 80;
  const cacheCritical = !diskCritical && !diskHigh && percent >= 95;

  return (
    <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 overflow-y-auto scrollbar-thin flex flex-col gap-4 sm:gap-5">
      {/* ===== Header ===== */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Download Cache</h1>
          <div className="flex items-center gap-2 shrink-0">
            {lastLoadedAt && !loading && (
              <span className="hidden sm:inline text-[11px] text-text-subtle tabular-nums">
                Updated {relativeAge(Date.now() - lastLoadedAt)}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-text-muted">
          Previously downloaded audio kept on disk so repeat requests skip re-downloading.
        </p>
      </div>

      {loading ? (
        <CacheSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-5 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">Couldn&apos;t load cache stats</p>
            <p className="text-xs text-text-muted mt-1 break-words">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      ) : stats ? (
        <>
          {/* ===== Top-of-page urgent banner - impossible to miss ===== */}
          {diskCritical && (
            <AlertBanner tone="red" title="Disk almost full">
              Only <strong>{fmtSize(stats.disk_free_gb)}</strong> is left on the whole server. New downloads,
              deploys, and logging can start failing. Clear the cache below or free up space now.
            </AlertBanner>
          )}
          {diskHigh && (
            <AlertBanner tone="amber" title="Disk usage is high">
              <strong>{fmtSize(stats.disk_free_gb)}</strong> free out of {fmtSize(stats.disk_total_gb)}. Worth
              clearing the cache or checking what else is using space soon.
            </AlertBanner>
          )}
          {cacheCritical && (
            <AlertBanner tone="amber" title="Cache is full">
              The cache has hit its {fmtSize(stats.max_gb)} allowance. Oldest files are being deleted automatically
              to make room — increase the allowance below if that's happening too often.
            </AlertBanner>
          )}

          {/* ===== 1 & 2. Disk + cache storage side by side on wide screens ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <section className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-text-muted shrink-0" />
                <span className="text-sm font-semibold">Your VPS disk</span>
                <span className={`text-xs font-medium ml-auto ${diskHealth.text}`}>{diskHealth.label}</span>
              </div>
              <div>
                <div className="flex justify-between items-baseline text-xs mb-1.5">
                  <span className="text-text-subtle tabular-nums">
                    {fmtSize(stats.disk_used_gb)} of {fmtSize(stats.disk_total_gb)}
                  </span>
                  <span className={`tabular-nums font-semibold ${diskHealth.text}`}>{stats.disk_percent_used}%</span>
                </div>
                <div className="h-2 rounded-full bg-graphite-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${diskHealth.bar} transition-all duration-500`}
                    style={{ width: `${Math.min(100, stats.disk_percent_used)}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-text-subtle">
                {fmtSize(stats.disk_free_gb)} free — shared by the operating system, Docker, and this cache.
              </p>
              {unaccountedGb > 1 && stats.total_gb < unaccountedGb && (
                <p className="text-[11px] text-text-subtle border-t border-graphite-800 pt-2 leading-relaxed">
                  Only {fmtSize(stats.total_gb)} of the {fmtSize(stats.disk_used_gb)} in use is this cache — the
                  other {fmtSize(unaccountedGb)} is the OS, Docker images, or other files. Clearing the cache
                  below won&apos;t free that space.
                </p>
              )}
            </section>

            <section className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Database className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-sm font-semibold truncate">Cache storage</span>
                </div>
                <span className={`text-xs font-medium shrink-0 ${cacheHealth.text}`}>{cacheHealth.label}</span>
              </div>

              <div>
                <div className="flex justify-between items-baseline text-xs mb-1.5">
                  <span className="text-text-subtle tabular-nums">
                    {fmtSize(stats.total_gb)} used of {fmtSize(stats.max_gb)} allowed
                  </span>
                  <span className={`tabular-nums font-semibold ${cacheHealth.text}`}>{percent}%</span>
                </div>
                <div className="h-3 rounded-full bg-graphite-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cacheHealth.bar} transition-all duration-500`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-graphite-800">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-subtle">Cached files</p>
                  <p className="text-base font-semibold tabular-nums mt-0.5">{stats.entry_count.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-text-subtle">Room left</p>
                  <p className="text-base font-semibold tabular-nums mt-0.5">
                    {fmtSize(Math.max(0, stats.max_gb - stats.total_gb))}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-text-subtle leading-relaxed">
                When cached files fill this space, the oldest unplayed ones are deleted automatically to make room —
                this never affects the disk outside its own allowance above.
              </p>
            </section>
          </div>

          {/* ===== 3. Change the allowance ===== */}
          <section className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <p className="text-sm font-medium">Change cache allowance</p>
              {isDirty && <span className="text-[11px] text-amber-400 shrink-0">Unsaved</span>}
            </div>
            <p className="text-xs text-text-muted mb-3.5">
              Drag to pick how much of your disk the cache is allowed to use. Applies right away, no restart needed.
            </p>

            <form onSubmit={handleSaveLimit} className="flex flex-col gap-3">
              <div>
                <input
                  type="range"
                  min={0.5}
                  max={sliderMax}
                  step={0.5}
                  value={hasValidRequest ? Math.min(requestedGb, sliderMax) : 0.5}
                  onChange={(e) => setGbInput(e.target.value)}
                  className="w-full accent-amber-500 cursor-pointer"
                  aria-label="Cache allowance in GB"
                />
                <div className="flex justify-between text-[11px] text-text-subtle mt-1">
                  <span>0.5 GB</span>
                  <span>{fmtSize(sliderMax)} max possible</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1 sm:max-w-[150px]">
                  <input
                    type="number"
                    min={0.5}
                    max={sliderMax}
                    step="0.5"
                    value={gbInput}
                    onChange={(e) => setGbInput(e.target.value)}
                    className="w-full rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-2 pr-10 text-sm text-text-primary tabular-nums focus:outline-none focus:border-amber-500/60"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-subtle pointer-events-none">
                    GB
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={savingLimit || !isDirty || wouldExceedDisk}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-amber-500 text-graphite-950 px-4 py-2 text-xs font-semibold hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingLimit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {savingLimit ? "Saving…" : isDirty ? "Save" : "Saved"}
                </button>
                {isDirty && !savingLimit && (
                  <button
                    type="button"
                    onClick={() => setGbInput(String(stats.max_gb))}
                    className="text-xs text-text-subtle hover:text-text-primary transition-colors sm:self-center px-1"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {wouldEvict && (
                <Notice tone="amber">
                  This is lower than what&apos;s already cached ({fmtSize(stats.total_gb)}) — saving will delete
                  the oldest files immediately to fit the new, smaller allowance.
                </Notice>
              )}
              {wouldExceedDisk && (
                <Notice tone="red">
                  Only {fmtSize(maxPossibleGb)} is actually available for the cache on this disk. Setting it any
                  higher isn&apos;t possible right now — free up disk space first.
                </Notice>
              )}
              {limitResult && (
                <p className={`text-xs flex items-center gap-1.5 ${limitResult.ok ? "text-teal-400" : "text-red-500"}`}>
                  {limitResult.ok && <Check className="h-3.5 w-3.5" />}
                  {limitResult.message}
                </p>
              )}
            </form>
          </section>

          {/* ===== 4. Danger zone ===== */}
          <section className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">Clear cache</p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                {stats.entry_count > 0
                  ? `Deletes all ${stats.entry_count.toLocaleString()} cached files right now. Each will re-download next time it's requested.`
                  : "Nothing is cached right now — this button is just here for a manual sanity check."}
              </p>
            </div>

            <button
              onClick={() => setConfirmingClear(true)}
              disabled={clearing || stats.entry_count === 0}
              className="flex items-center justify-center gap-1.5 rounded-md border border-red-500/40 text-red-500 px-3.5 py-2 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {clearing ? "Clearing…" : "Clear cache"}
            </button>
          </section>

          {confirmingClear && (
            <ConfirmDialog
              title="Clear the entire cache?"
              body={
                stats.entry_count > 0
                  ? `This deletes all ${stats.entry_count.toLocaleString()} cached files right now. Each will re-download the next time it's requested. This can't be undone.`
                  : "The cache is already empty — this just runs a sanity check to confirm nothing is left tracked."
              }
              confirmLabel="Clear cache"
              loading={clearing}
              onConfirm={handleClear}
              onCancel={() => setConfirmingClear(false)}
            />
          )}

          {lastCleared && (
            <p className="text-xs text-teal-400 flex items-center gap-1.5 -mt-1 px-1">
              <Check className="h-3.5 w-3.5 shrink-0" />
              {lastCleared}
            </p>
          )}

          <p className="text-[11px] text-text-subtle text-center px-2">Storage backend: {stats.backend}</p>
        </>
      ) : null}
    </div>
  );
}

/* ===== Small building blocks ===== */

function AlertBanner({
  tone, title, children,
}: {
  tone: "red" | "amber";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-500/40 bg-red-500/10"
      : "border-amber-500/40 bg-amber-500/10";
  const iconClass = tone === "red" ? "text-red-500" : "text-amber-400";
  const titleClass = tone === "red" ? "text-red-500" : "text-amber-400";

  return (
    <div className={`rounded-lg border p-3.5 flex items-start gap-3 ${toneClass}`}>
      <AlertOctagon className={`h-4 w-4 shrink-0 mt-0.5 ${iconClass}`} />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${titleClass}`}>{title}</p>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  const toneClass =
    tone === "red"
      ? "border-red-500/25 bg-red-500/5 text-red-500"
      : "border-amber-500/25 bg-amber-500/5 text-amber-400";
  return (
    <div className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs leading-relaxed ${toneClass}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function CacheSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-graphite-800 bg-graphite-900 p-4 sm:p-5 flex flex-col gap-3">
          <div className="h-4 w-32 rounded bg-graphite-800" />
          <div className="h-3 w-full rounded-full bg-graphite-800" />
          <div className="h-3 w-2/3 rounded bg-graphite-800" />
        </div>
      ))}
    </div>
  );
}