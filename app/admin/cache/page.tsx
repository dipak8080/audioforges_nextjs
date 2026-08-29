"use client";

/**
 * app/admin/cache/page.tsx — redesigned to match the credits console.
 *
 * Same shell as the other admin screens: the page fills the viewport, the
 * header and KPI rail hold still, and one region scrolls. Same primitives, same
 * palette, same toast behaviour — so moving between Cache, Credits and Logs
 * doesn't feel like moving between three different products.
 *
 * The information hierarchy is unchanged on purpose, because it was right:
 * disk before cache (a full disk breaks deploys, downloads and logging; a full
 * cache just evicts itself), and the single most urgent condition stated once,
 * at the top, in plain words.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Save,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ConfirmDialog } from "../_components/ConfirmDialog";

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

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

type Health = { bar: string; text: string; label: string };

// The cache's own allowance fills up fast in normal use — it's designed to — so
// it gets a stricter threshold than the disk.
function cacheHealthTone(percent: number): Health {
  if (percent >= 95) return { bar: "bg-red-500", text: "text-red-400", label: "Full" };
  if (percent >= 75) return { bar: "bg-amber-500", text: "text-amber-400", label: "Filling up" };
  return { bar: "bg-teal-400", text: "text-teal-400", label: "Healthy" };
}

// A whole disk normally sits at 40–70% just from the OS and Docker, so this
// threshold is looser — otherwise a perfectly ordinary VPS shows amber for
// simply existing.
function diskHealthTone(percent: number): Health {
  if (percent >= 90) return { bar: "bg-red-500", text: "text-red-400", label: "Critical" };
  if (percent >= 80) return { bar: "bg-amber-500", text: "text-amber-400", label: "High" };
  return { bar: "bg-teal-400", text: "text-teal-400", label: "Healthy" };
}

/* ------------------------------------------------------------------ */
/* styles — shared vocabulary with the credits console                 */
/* ------------------------------------------------------------------ */

const STYLES = `
.af-scroll { scrollbar-width: thin; scrollbar-color: rgb(120 113 108 / .45) transparent; }
.af-scroll::-webkit-scrollbar { width: 11px; height: 11px; }
.af-scroll::-webkit-scrollbar-track { background: transparent; }
.af-scroll::-webkit-scrollbar-thumb {
  background: rgb(120 113 108 / .38); border-radius: 99px;
  border: 3px solid transparent; background-clip: content-box;
}
.af-scroll::-webkit-scrollbar-thumb:hover { background: rgb(245 158 11 / .55); background-clip: content-box; }
.af-railless { scrollbar-width: none; -ms-overflow-style: none; }
.af-railless::-webkit-scrollbar { display: none; }
@keyframes af-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.af-rise { animation: af-rise .24s cubic-bezier(.22,.9,.32,1) both; }
@keyframes af-toast { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
.af-toast { animation: af-toast .2s cubic-bezier(.22,.9,.32,1) both; }
@keyframes af-shimmer { 100% { transform: translateX(100%); } }
.af-skel { position: relative; overflow: hidden; }
.af-skel::after {
  content: ""; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / .05), transparent);
  animation: af-shimmer 1.4s infinite;
}
@media (prefers-reduced-motion: reduce) { .af-rise, .af-toast, .af-skel::after { animation: none !important; } }
`;

/* ------------------------------------------------------------------ */
/* shell + toasts                                                      */
/* ------------------------------------------------------------------ */

/** The page fills from wherever it starts to the bottom of the window.
 *  Measured rather than hardcoded, because the admin chrome above this page can
 *  change height and a wrong constant is what strands content below the fold. */
function useShellHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setHeight(Math.max(360, Math.round(window.innerHeight - el.getBoundingClientRect().top)));
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  return [ref, height] as const;
}

type Toast = { id: number; tone: "ok" | "warn" | "bad"; text: string };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "af-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed shadow-2xl shadow-black/40 backdrop-blur",
            t.tone === "ok" && "border-teal-500/30 bg-teal-500/10 text-teal-300",
            t.tone === "warn" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
            t.tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-300"
          )}
        >
          {t.tone === "ok" ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
          <span className="flex-1">{t.text}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
            className="rounded p-0.5 opacity-60 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-current"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-graphite-800 bg-graphite-900/70", className)}>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-subtle">{children}</p>;
}

function Button({
  children,
  onClick,
  type = "button",
  variant = "ghost",
  size = "md",
  disabled,
  busy,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium outline-none transition-all",
        "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950",
        "disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-9 px-3 text-[13px]" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-amber-500 font-semibold text-graphite-950 shadow-lg shadow-amber-500/10 hover:bg-amber-400 active:scale-[0.98]",
        variant === "ghost" &&
          "border border-graphite-700 bg-graphite-850/80 text-text-muted hover:border-graphite-600 hover:text-text-primary active:scale-[0.98]",
        variant === "danger" &&
          "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 active:scale-[0.98]",
        className
      )}
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function Pill({ label, value, tone = "plain" }: { label: string; value: string; tone?: "plain" | "accent" | "alarm" }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-baseline gap-2 rounded-lg border px-2.5 py-1.5",
        tone === "alarm" ? "border-red-500/30 bg-red-500/[0.07]" : "border-graphite-800 bg-graphite-900/60"
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-subtle">{label}</span>
      <span
        className={cn(
          "font-mono text-[13px] font-semibold tabular-nums",
          tone === "alarm" ? "text-red-400" : tone === "accent" ? "text-amber-400" : "text-text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Both bars on this page. One component so a percentage can never be drawn two
 *  different ways depending on which card it lands in. */
function Meter({ percent, health, thick }: { percent: number; health: Health; thick?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-full bg-graphite-850", thick ? "h-2.5" : "h-2")}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", health.bar)}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <p className="mt-1 font-mono text-lg font-semibold leading-none tabular-nums text-text-primary">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-text-subtle">{sub}</p>}
    </div>
  );
}

/** Pre-action warnings stay inline next to the control that would cause them.
 *  Results of an action go to a toast. Mixing the two is how a warning ends up
 *  reading like a failure report. */
function Notice({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs leading-relaxed",
        tone === "red"
          ? "border-red-500/25 bg-red-500/[0.06] text-red-300"
          : "border-amber-500/25 bg-amber-500/[0.06] text-amber-300"
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** The single most urgent condition, stated once at the top. */
function AlertBanner({
  tone,
  title,
  children,
}: {
  tone: "red" | "amber";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "af-rise flex items-start gap-3 rounded-2xl border p-3.5",
        tone === "red" ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10"
      )}
    >
      <AlertTriangle
        className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "red" ? "text-red-400" : "text-amber-400")}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", tone === "red" ? "text-red-300" : "text-amber-300")}>{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{children}</p>
      </div>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("af-skel rounded-lg bg-graphite-850/70", className)} />;
}

function CacheSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[190px] rounded-2xl" />
        <Skeleton className="h-[190px] rounded-2xl" />
      </div>
      <Skeleton className="h-[210px] rounded-2xl" />
      <Skeleton className="h-[88px] rounded-2xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminCachePage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);

  const [clearing, setClearing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [gbInput, setGbInput] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  const { toasts, push, dismiss } = useToasts();
  const [shellRef, shellHeight] = useShellHeight();

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
    void load();
  }, [load]);

  // Only the "updated Ns ago" line depends on the clock, so the tick is cheap.
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
    try {
      const res = await fetch("/api/admin/cache", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      const n = data.files_removed ?? 0;
      push(
        "ok",
        n === 0
          ? "Nothing to remove — the cache was already empty."
          : `Removed ${n.toLocaleString()} cached ${n === 1 ? "file" : "files"}.`
      );
      await load();
    } catch (e) {
      push("bad", (e as Error).message);
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  }

  async function handleSaveLimit() {
    const gb = parseFloat(gbInput);
    if (!gb || gb <= 0) {
      push("bad", "Enter a valid number of GB.");
      return;
    }
    setSavingLimit(true);
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
      push("ok", `Cache can now use up to ${fmtSize(gb)}.`);
    } catch (e) {
      push("bad", (e as Error).message);
    } finally {
      setSavingLimit(false);
    }
  }

  /* ---- derived ---- */
  const percent = Math.min(100, stats?.percent_full ?? 0);
  const cacheHealth = cacheHealthTone(percent);
  const diskHealth = diskHealthTone(stats?.disk_percent_used ?? 0);

  const requestedGb = parseFloat(gbInput);
  const hasValidRequest = Boolean(stats) && !isNaN(requestedGb) && requestedGb > 0;
  const isDirty = Boolean(hasValidRequest && stats && requestedGb !== stats.max_gb);

  const maxPossibleGb = stats ? Math.max(0.5, stats.total_gb + stats.disk_free_gb) : 0.5;
  const wouldExceedDisk = Boolean(hasValidRequest && requestedGb > maxPossibleGb);
  const wouldEvict = Boolean(hasValidRequest && stats && requestedGb < stats.total_gb);
  const sliderMax = stats ? Math.max(0.5, Math.floor(maxPossibleGb * 10) / 10) : 10;

  // Space the cache isn't accounting for. If this is large while the cache
  // itself is small, something else is eating the disk (Docker images, logs,
  // old builds) and clearing the cache alone won't fix a full disk.
  const unaccountedGb = stats ? Math.max(0, stats.disk_used_gb - stats.total_gb) : 0;

  // One banner, not three. Disk outranks cache: a full disk breaks deploys,
  // downloads and logging, while a full cache just evicts itself.
  const diskPct = stats?.disk_percent_used ?? 0;
  const diskCritical = diskPct >= 90;
  const diskHigh = !diskCritical && diskPct >= 80;
  const cacheCritical = !diskCritical && !diskHigh && percent >= 95;

  return (
    <div
      ref={shellRef}
      style={shellHeight ? { height: shellHeight } : undefined}
      className="flex w-full flex-col overflow-hidden bg-graphite-950 text-text-primary"
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      {/* ===== fixed chrome ===== */}
      <header className="shrink-0 border-b border-graphite-800 px-4 pb-3 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
              <Database className="h-4 w-4 text-amber-400" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Download cache</h1>
              <p className="truncate text-[11px] text-text-subtle">
                Audio kept on disk so repeat requests skip re-downloading
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {lastLoadedAt && !loading && (
                <span className="hidden text-[11px] tabular-nums text-text-subtle sm:inline">
                  Updated {relativeAge(Date.now() - lastLoadedAt)}
                </span>
              )}
              <Button size="sm" busy={refreshing} onClick={handleRefresh}>
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden />
                Refresh
              </Button>
            </div>
          </div>

          {stats && (
            <div className="af-railless -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Pill label="Cached files" value={stats.entry_count.toLocaleString()} />
              <Pill label="Cache used" value={fmtSize(stats.total_gb)} tone="accent" />
              <Pill label="Allowance" value={fmtSize(stats.max_gb)} />
              <Pill
                label="Disk free"
                value={fmtSize(stats.disk_free_gb)}
                tone={diskCritical ? "alarm" : "plain"}
              />
              <Pill label="Backend" value={stats.backend} />
            </div>
          )}
        </div>
      </header>

      {/* ===== the one scrolling region ===== */}
      <main className="af-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-5xl space-y-4">
          {loading ? (
            <CacheSkeleton />
          ) : error ? (
            <Card className="flex items-start gap-3 border-red-500/25 bg-red-500/[0.06] p-5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Couldn&apos;t load cache stats</p>
                <p className="mt-1 break-words text-xs text-text-muted">{error}</p>
                <div className="mt-3">
                  <Button size="sm" variant="danger" onClick={handleRefresh}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Try again
                  </Button>
                </div>
              </div>
            </Card>
          ) : stats ? (
            <>
              {diskCritical && (
                <AlertBanner tone="red" title="Disk almost full">
                  Only <strong className="text-text-primary">{fmtSize(stats.disk_free_gb)}</strong> is left on the
                  whole server. New downloads, deploys and logging can start failing. Clear the cache below or free
                  up space now.
                </AlertBanner>
              )}
              {diskHigh && (
                <AlertBanner tone="amber" title="Disk usage is high">
                  <strong className="text-text-primary">{fmtSize(stats.disk_free_gb)}</strong> free out of{" "}
                  {fmtSize(stats.disk_total_gb)}. Worth clearing the cache or checking what else is using space
                  soon.
                </AlertBanner>
              )}
              {cacheCritical && (
                <AlertBanner tone="amber" title="Cache is full">
                  The cache has hit its {fmtSize(stats.max_gb)} allowance. Oldest files are being deleted
                  automatically to make room — raise the allowance below if that&apos;s happening too often.
                </AlertBanner>
              )}

              {/* ===== disk + cache, side by side ===== */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                    <span className="text-sm font-semibold">Your VPS disk</span>
                    <span className={cn("ml-auto text-xs font-medium", diskHealth.text)}>{diskHealth.label}</span>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between text-xs">
                      <span className="tabular-nums text-text-subtle">
                        {fmtSize(stats.disk_used_gb)} of {fmtSize(stats.disk_total_gb)}
                      </span>
                      <span className={cn("font-mono font-semibold tabular-nums", diskHealth.text)}>
                        {stats.disk_percent_used}%
                      </span>
                    </div>
                    <Meter percent={stats.disk_percent_used} health={diskHealth} />
                  </div>

                  <p className="text-xs text-text-subtle">
                    {fmtSize(stats.disk_free_gb)} free — shared by the operating system, Docker and this cache.
                  </p>

                  {unaccountedGb > 1 && stats.total_gb < unaccountedGb && (
                    <p className="border-t border-graphite-800 pt-2.5 text-[11px] leading-relaxed text-text-subtle">
                      Only {fmtSize(stats.total_gb)} of the {fmtSize(stats.disk_used_gb)} in use is this cache — the
                      other {fmtSize(unaccountedGb)} is the OS, Docker images or other files. Clearing the cache
                      below won&apos;t free that space.
                    </p>
                  )}
                </Card>

                <Card className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                    <span className="text-sm font-semibold">Cache storage</span>
                    <span className={cn("ml-auto text-xs font-medium", cacheHealth.text)}>{cacheHealth.label}</span>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between text-xs">
                      <span className="tabular-nums text-text-subtle">
                        {fmtSize(stats.total_gb)} used of {fmtSize(stats.max_gb)} allowed
                      </span>
                      <span className={cn("font-mono font-semibold tabular-nums", cacheHealth.text)}>{percent}%</span>
                    </div>
                    <Meter percent={percent} health={cacheHealth} thick />
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-graphite-800 pt-3">
                    <Figure label="Cached files" value={stats.entry_count.toLocaleString()} />
                    <Figure label="Room left" value={fmtSize(Math.max(0, stats.max_gb - stats.total_gb))} />
                  </div>

                  <p className="text-[11px] leading-relaxed text-text-subtle">
                    When cached files fill this space, the oldest are deleted automatically to make room. This never
                    touches disk outside its own allowance.
                  </p>
                </Card>
              </div>

              {/* ===== allowance ===== */}
              <Card className="p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">Change cache allowance</p>
                  {isDirty && <span className="shrink-0 text-[11px] text-amber-400">Unsaved</span>}
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  How much of the disk the cache may use. Applies right away, no restart needed.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveLimit();
                  }}
                  className="mt-4 flex flex-col gap-3"
                >
                  <div>
                    <input
                      type="range"
                      min={0.5}
                      max={sliderMax}
                      step={0.5}
                      value={hasValidRequest ? Math.min(requestedGb, sliderMax) : 0.5}
                      onChange={(e) => setGbInput(e.target.value)}
                      className="w-full cursor-pointer accent-amber-500"
                      aria-label="Cache allowance in GB"
                    />
                    <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
                      <span>0.5 GB</span>
                      <span>{fmtSize(sliderMax)} max possible</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <div className="relative flex-1 sm:max-w-[150px]">
                      <input
                        type="number"
                        min={0.5}
                        max={sliderMax}
                        step="0.5"
                        value={gbInput}
                        onChange={(e) => setGbInput(e.target.value)}
                        aria-label="Cache allowance, gigabytes"
                        className={cn(
                          "h-10 w-full rounded-lg border border-graphite-700 bg-graphite-850/80 px-3 pr-10 text-sm tabular-nums text-text-primary outline-none transition-colors",
                          "hover:border-graphite-600 focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
                        )}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-text-subtle">
                        GB
                      </span>
                    </div>
                    <Button type="submit" variant="primary" busy={savingLimit} disabled={!isDirty || wouldExceedDisk}>
                      {!savingLimit && <Save className="h-3.5 w-3.5" aria-hidden />}
                      {savingLimit ? "Saving…" : isDirty ? "Save allowance" : "Saved"}
                    </Button>
                    {isDirty && !savingLimit && (
                      <button
                        type="button"
                        onClick={() => setGbInput(String(stats.max_gb))}
                        className="rounded px-1 text-xs text-text-subtle outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70 sm:self-center"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {wouldEvict && (
                    <Notice tone="amber">
                      This is lower than what&apos;s already cached ({fmtSize(stats.total_gb)}) — saving deletes the
                      oldest files immediately to fit the smaller allowance.
                    </Notice>
                  )}
                  {wouldExceedDisk && (
                    <Notice tone="red">
                      Only {fmtSize(maxPossibleGb)} is actually available for the cache on this disk. Setting it
                      higher isn&apos;t possible right now — free up disk space first.
                    </Notice>
                  )}
                </form>
              </Card>

              {/* ===== danger zone ===== */}
              <Card className="flex flex-col gap-3 border-red-500/20 bg-red-500/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">Clear cache</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                    {stats.entry_count > 0
                      ? `Deletes all ${stats.entry_count.toLocaleString()} cached files right now. Each re-downloads next time it's requested.`
                      : "Nothing is cached right now — this button is here for a manual sanity check."}
                  </p>
                </div>
                <Button
                  variant="danger"
                  busy={clearing}
                  disabled={stats.entry_count === 0}
                  onClick={() => setConfirmingClear(true)}
                >
                  {!clearing && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                  {clearing ? "Clearing…" : "Clear cache"}
                </Button>
              </Card>

              {confirmingClear && (
                <ConfirmDialog
                  title="Clear the entire cache?"
                  body={
                    stats.entry_count > 0
                      ? `This deletes all ${stats.entry_count.toLocaleString()} cached files right now. Each re-downloads the next time it's requested. This can't be undone.`
                      : "The cache is already empty — this just confirms nothing is left tracked."
                  }
                  confirmLabel="Clear cache"
                  loading={clearing}
                  onConfirm={handleClear}
                  onCancel={() => setConfirmingClear(false)}
                />
              )}
            </>
          ) : null}
        </div>
      </main>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}