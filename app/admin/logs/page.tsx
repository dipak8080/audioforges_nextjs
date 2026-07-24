"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDown,
  AudioWaveform,
  Loader2,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const MAX_LOGS_IN_MEMORY = 1000;

interface HttpLogEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  client_ip: string;
}

interface SystemLogEntry {
  id: number;
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  request_id: string;
}

const NOISE_PATTERNS = [
  "/robots.txt", "/favicon.ico", "/.env", "/wp-", "/.git",
  "/SDK/", "/phpmyadmin", "/.well-known", "/xmlrpc.php",
];

const isNoise = (path: string) => NOISE_PATTERNS.some((p) => path.includes(p));

function parseTs(isoString: string): Date {
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(isoString);
  return new Date(hasZone ? isoString : isoString + "Z");
}

function npTime(isoString: string): string {
  return parseTs(isoString).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function npDate(isoString: string): string {
  return parseTs(isoString).toLocaleDateString("en-US", {
    timeZone: "Asia/Kathmandu",
    month: "short",
    day: "2-digit",
  });
}

function npYMD(isoString: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parseTs(isoString));
}

function todayKey(): string {
  return npYMD(new Date().toISOString());
}

function yesterdayKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return npYMD(d.toISOString());
}

function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(2) + " s";
  return ms.toFixed(0) + " ms";
}

function statusDot(code: number): string {
  if (code >= 500) return "bg-red-500";
  if (code >= 400) return "bg-amber-500";
  return "bg-teal-400";
}

function statusText(code: number): string {
  if (code >= 500) return "text-red-500";
  if (code >= 400) return "text-amber-400";
  return "text-teal-400";
}

function methodTone(method: string): string {
  switch (method) {
    case "POST": return "text-amber-400";
    case "DELETE": return "text-red-500";
    default: return "text-text-muted";
  }
}

function levelTone(level: string): { text: string; border: string } {
  switch (level) {
    case "ERROR":
    case "CRITICAL":
      return { text: "text-red-500", border: "border-red-500/50" };
    case "WARNING":
      return { text: "text-amber-400", border: "border-amber-500/50" };
    default:
      return { text: "text-text-subtle", border: "border-graphite-700" };
  }
}

type DateFilter = "all" | "today" | "yesterday";
type Tab = "http" | "system";

export default function AdminLogsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("http");

  const [httpLogs, setHttpLogs] = useState<HttpLogEntry[]>([]);
  const [totals, setTotals] = useState({ total: 0, success: 0, failed: 0 });
  const [httpLoading, setHttpLoading] = useState(true);
  const [httpError, setHttpError] = useState<string | null>(null);

  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);

  const [methodFilter, setMethodFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [hideNoise, setHideNoise] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [isPaused, setIsPaused] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sysRef = useRef<HTMLDivElement>(null);

  // "Pinned to bottom" - true means auto-scroll should keep following new
  // data (the Railway/Discord pattern). The instant the user scrolls up
  // even a little, this flips to false and new data stops yanking the
  // view around; it only re-pins once they scroll back down themselves,
  // or click the "Jump to latest" button. Refs (not state) so scroll
  // handlers don't cause extra re-renders on every scroll tick.
  const httpPinnedRef = useRef(true);
  const sysPinnedRef = useRef(true);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const [showJumpHttp, setShowJumpHttp] = useState(false);
  const [showJumpSys, setShowJumpSys] = useState(false);

  const NEAR_BOTTOM_PX = 48;

  // Desktop table and mobile card list are two separate DOM elements
  // (only one is ever visible at a time via CSS, but both exist in the
  // DOM), so each needs its own ref and its own scroll listener rather
  // than sharing scrollRef - otherwise the mobile view's scroll position
  // was never actually being read.
  function handleHttpScroll(el: HTMLDivElement | null) {
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    httpPinnedRef.current = nearBottom;
    if (nearBottom) setShowJumpHttp(false);
  }

  function handleSysScroll() {
    const el = sysRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    sysPinnedRef.current = nearBottom;
    if (nearBottom) setShowJumpSys(false);
  }

  function jumpToBottomHttp() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
    httpPinnedRef.current = true;
    setShowJumpHttp(false);
  }

  function jumpToBottomSys() {
    const el = sysRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    sysPinnedRef.current = true;
    setShowJumpSys(false);
  }

  const fetchHttp = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/logs?type=http&limit=${MAX_LOGS_IN_MEMORY}`, { cache: "no-store" });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setTotals({ total: data.total, success: data.success, failed: data.failed });
      // Backend returns newest-first (ORDER BY id DESC); reverse so the
      // oldest entry is at the top and the newest lands at the bottom,
      // like a terminal tail - the most recent activity is always the
      // last thing you see when scrolled down.
      setHttpLogs([...data.logs].reverse());
      setHttpError(null);
    } catch (e) {
      setHttpError((e as Error).message);
    } finally {
      setHttpLoading(false);
    }
  }, [router]);

  const fetchSystem = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/logs?type=system&limit=200`, { cache: "no-store" });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      setSystemLogs(data.logs); // already oldest -> newest from backend; newest lands at the bottom
      setSystemError(null);
    } catch (e) {
      setSystemError((e as Error).message);
    } finally {
      setSystemLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchHttp(); fetchSystem(); }, [fetchHttp, fetchSystem]);

  // Follows new data only while "pinned to bottom." The moment you
  // scroll up (handleHttpScroll/handleSysScroll above), pinned flips to
  // false and this stops forcing your scroll position - new data just
  // shows a small "Jump to latest" button instead of yanking you back
  // down mid-read. Scrolling back to the bottom yourself, or clicking
  // that button, re-pins it. First load pins to bottom by default so you
  // land on the newest activity immediately, same as Railway.
  useEffect(() => {
    if (httpPinnedRef.current) {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
    } else if (httpLogs.length > 0) {
      setShowJumpHttp(true);
    }
  }, [httpLogs]);

  useEffect(() => {
    const el = sysRef.current;
    if (!el) return;
    if (sysPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (systemLogs.length > 0) {
      setShowJumpSys(true);
    }
  }, [systemLogs]);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => { fetchHttp(); fetchSystem(); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPaused, fetchHttp, fetchSystem]);

  const passesDate = (log: HttpLogEntry): boolean => {
    if (dateFilter === "all") return true;
    try {
      const k = npYMD(log.timestamp);
      return dateFilter === "today" ? k === todayKey() : k === yesterdayKey();
    } catch { return false; }
  };

  const filtered = httpLogs.filter((log) => {
    if (methodFilter && log.method !== methodFilter) return false;
    if (pathFilter && !log.path.toLowerCase().includes(pathFilter.toLowerCase())) return false;
    if (hideNoise && isNoise(log.path)) return false;
    if (!passesDate(log)) return false;
    return true;
  });

  async function handleDelete(olderThanDays: number | null) {
    const label = olderThanDays ? `older than ${olderThanDays} day(s)` : "ALL";
    if (!confirm(`Delete logs ${label}? This can't be undone.`)) return;
    const url = olderThanDays ? `/api/admin/logs?olderThanDays=${olderThanDays}` : `/api/admin/logs`;
    const res = await fetch(url, { method: "DELETE" });
    const data = await res.json();
    alert(`Deleted ${data.deleted_http_logs} HTTP logs.` + (data.system_buffer_cleared ? " System buffer cleared." : ""));
    fetchHttp(); fetchSystem();
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.push("/admin/login");
    }
  }

  return (
    <main className="min-h-screen bg-graphite-950 text-text-primary">
      {/* ===== Top bar ===== */}
      <header className="border-b border-graphite-800 bg-graphite-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AudioWaveform className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-semibold tracking-tight">AudioForges</span>
            <span className="text-text-subtle text-sm hidden sm:inline">/</span>
            <span className="text-sm text-text-muted hidden sm:inline">Monitoring</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-text-subtle">
              <span className={`h-1.5 w-1.5 rounded-full ${isPaused ? "bg-amber-500" : "bg-teal-400"}`} />
              {isPaused ? "Paused" : "Live"}
            </span>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-graphite-700 hover:bg-graphite-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{isLoggingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* ===== Page heading + tabs ===== */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Request Logs</h1>
            <p className="text-sm text-text-muted mt-0.5">Live traffic and system events from the backend.</p>
          </div>
          <div className="flex rounded-lg border border-graphite-800 bg-graphite-900 p-0.5 self-start sm:self-auto">
            <TabButton active={tab === "http"} onClick={() => setTab("http")} icon={Activity} label="HTTP" />
            <TabButton active={tab === "system"} onClick={() => setTab("system")} icon={Terminal} label="System" />
          </div>
        </div>

        {tab === "http" ? (
          <>
            {/* ===== Stat strip ===== */}
            <div className="grid grid-cols-3 divide-x divide-graphite-800 rounded-lg border border-graphite-800 bg-graphite-900">
              <Stat label="Total requests" value={totals.total} />
              <Stat label="Succeeded" value={totals.success} valueClass="text-teal-400" />
              <Stat label="Failed" value={totals.failed} valueClass={totals.failed > 0 ? "text-red-500" : ""} />
            </div>

            {/* ===== Unified table card ===== */}
            <section className="rounded-lg border border-graphite-800 bg-graphite-900 overflow-hidden">
              {/* Toolbar row */}
              <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b border-graphite-800">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-subtle pointer-events-none" />
                  <input
                    type="text"
                    value={pathFilter}
                    onChange={(e) => setPathFilter(e.target.value)}
                    placeholder="Filter by path…"
                    className="w-full rounded-md border border-graphite-700 bg-graphite-850 py-1.5 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-amber-500/60"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    className="rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-amber-500/60"
                  >
                    <option value="">Method: all</option>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                    className="rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-amber-500/60"
                  >
                    <option value="all">Date: all</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-text-muted select-none cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={hideNoise}
                      onChange={(e) => setHideNoise(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Hide noise
                  </label>
                  <div className="h-5 w-px bg-graphite-800 hidden sm:block" />
                  <IconAction
                    onClick={() => setIsPaused((p) => !p)}
                    icon={isPaused ? Play : Pause}
                    label={isPaused ? "Resume" : "Pause"}
                    highlight={isPaused}
                  />
                  <IconAction onClick={() => { fetchHttp(); fetchSystem(); }} icon={RefreshCw} label="Refresh" />
                  <div className="relative">
                    <IconAction
                      onClick={() => setManageOpen((o) => !o)}
                      icon={Trash2}
                      label="Delete"
                      highlight={manageOpen}
                    />
                    {manageOpen && (
                      <div className="absolute top-full right-0 mt-2 w-48 rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl overflow-hidden z-20">
                        <MenuItem onClick={() => { setManageOpen(false); handleDelete(1); }}>Older than 1 day</MenuItem>
                        <MenuItem onClick={() => { setManageOpen(false); handleDelete(7); }}>Older than 7 days</MenuItem>
                        <MenuItem danger onClick={() => { setManageOpen(false); handleDelete(null); }}>Delete all logs</MenuItem>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop table */}
              <div className="hidden md:block relative">
              <div ref={scrollRef} onScroll={(e) => handleHttpScroll(e.currentTarget)} className="max-h-[540px] overflow-y-auto scrollbar-thin">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-graphite-900 border-b border-graphite-800">
                    <tr className="text-left">
                      <Th className="w-[130px]">Time</Th>
                      <Th className="w-[80px]">Method</Th>
                      <Th>Path</Th>
                      <Th className="w-[80px]">Status</Th>
                      <Th className="w-[90px] text-right">Duration</Th>
                      <Th className="w-[130px]">Client IP</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-graphite-800/70">
                    {filtered.map((log) => (
                      <tr key={log.id} className="hover:bg-graphite-850/60 transition-colors">
                        <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                          <span className="text-text-primary">{npTime(log.timestamp)}</span>
                          <span className="text-text-subtle ml-1.5 text-xs">{npDate(log.timestamp)}</span>
                        </td>
                        <td className={`px-4 py-2 text-xs font-semibold ${methodTone(log.method)}`}>
                          {log.method}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-text-primary max-w-0 truncate" title={log.path}>
                          {log.path}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 tabular-nums">
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(log.status_code)}`} />
                            <span className={`text-xs font-medium ${statusText(log.status_code)}`}>{log.status_code}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-xs text-text-muted whitespace-nowrap">
                          {fmtMs(log.duration_ms)}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-text-subtle">{log.client_ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ListState loading={httpLoading} error={httpError} empty={filtered.length === 0} emptyLabel="No requests match the current filters." />
              </div>
              {showJumpHttp && (
                <button
                  onClick={jumpToBottomHttp}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-amber-500 text-graphite-950 px-3.5 py-1.5 text-xs font-medium shadow-lg hover:bg-amber-400 transition-colors"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  New activity - jump to latest
                </button>
              )}
              </div>

              {/* Mobile rows */}
              <div className="md:hidden relative">
              <div ref={mobileScrollRef} onScroll={(e) => handleHttpScroll(e.currentTarget)} className="max-h-[540px] overflow-y-auto scrollbar-thin divide-y divide-graphite-800/70">
                {filtered.map((log) => (
                  <div key={log.id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(log.status_code)}`} />
                      <span className={`text-xs font-semibold shrink-0 ${methodTone(log.method)}`}>{log.method}</span>
                      <span className="font-mono text-xs text-text-primary truncate flex-1" title={log.path}>{log.path}</span>
                      <span className={`text-xs font-medium tabular-nums shrink-0 ${statusText(log.status_code)}`}>{log.status_code}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-text-subtle tabular-nums pl-3.5">
                      <span>{npDate(log.timestamp)} {npTime(log.timestamp)}</span>
                      <span className="flex items-center gap-2.5">
                        <span>{fmtMs(log.duration_ms)}</span>
                        <span className="font-mono">{log.client_ip}</span>
                      </span>
                    </div>
                  </div>
                ))}
                <ListState loading={httpLoading} error={httpError} empty={filtered.length === 0} emptyLabel="No requests match the current filters." />
              </div>
              {showJumpHttp && (
                <button
                  onClick={jumpToBottomHttp}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-amber-500 text-graphite-950 px-3.5 py-1.5 text-xs font-medium shadow-lg hover:bg-amber-400 transition-colors"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  New activity
                </button>
              )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-graphite-800 text-xs text-text-subtle tabular-nums">
                Showing {filtered.length} of {httpLogs.length} loaded
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-graphite-800 bg-graphite-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-graphite-800">
              <span className="text-sm text-text-muted">Application log buffer (latest 200)</span>
              <button
                onClick={() => handleDelete(null)}
                className="flex items-center gap-1.5 text-xs text-text-subtle hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
            <div className="relative">
            <div ref={sysRef} onScroll={handleSysScroll} className="max-h-[560px] overflow-y-auto scrollbar-thin font-mono text-xs">
              {systemLogs.map((entry, index) => {
                const tone = levelTone(entry.level);
                // Only draw a divider when this entry's request_id differs
                // from the previous entry's - groups all log lines that
                // came from the same request together, with a visible
                // break only where a new request's logs actually start,
                // instead of a line after every single log entry.
                const prevEntry = systemLogs[index - 1];
                const isNewRequestGroup = index === 0 || entry.request_id !== prevEntry?.request_id;
                return (
                  <div
                    key={entry.id}
                    className={`border-l-2 ${tone.border} px-4 py-2 hover:bg-graphite-850/60 transition-colors ${
                      isNewRequestGroup && index !== 0 ? "border-t border-t-graphite-700 mt-1 pt-2.5" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className={`font-semibold ${tone.text}`}>{entry.level}</span>
                      <span className="text-text-subtle tabular-nums">{npDate(entry.timestamp)} {npTime(entry.timestamp)}</span>
                      <span className="text-text-subtle">{entry.logger}</span>
                    </div>
                    <p className="text-text-primary mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                      {entry.message}
                    </p>
                  </div>
                );
              })}
              <ListState loading={systemLoading} error={systemError} empty={systemLogs.length === 0} emptyLabel="No system logs yet." />
            </div>
            {showJumpSys && (
              <button
                onClick={jumpToBottomSys}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-amber-500 text-graphite-950 px-3.5 py-1.5 text-xs font-medium shadow-lg hover:bg-amber-400 transition-colors"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                New activity - jump to latest
              </button>
            )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/* ===== Small building blocks ===== */

function TabButton({
  active, onClick, icon: Icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-graphite-800 text-text-primary" : "text-text-muted hover:text-text-primary"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "text-amber-500" : ""}`} />
      {label}
    </button>
  );
}

function Stat({ label, value, valueClass = "" }: { label: string; value: number; valueClass?: string }) {
  return (
    <div className="px-4 sm:px-5 py-3.5">
      <p className="text-[11px] uppercase tracking-wider text-text-subtle">{label}</p>
      <p className={`mt-0.5 text-xl sm:text-2xl font-semibold tabular-nums ${valueClass || "text-text-primary"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-text-subtle ${className}`}>
      {children}
    </th>
  );
}

function IconAction({
  onClick, icon: Icon, label, highlight = false,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
        highlight
          ? "border-amber-500/50 text-amber-400"
          : "border-graphite-700 text-text-muted hover:text-text-primary hover:bg-graphite-850"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function MenuItem({
  children, onClick, danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2 text-xs transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-text-muted hover:text-text-primary hover:bg-graphite-800"
      }`}
    >
      {children}
    </button>
  );
}

function ListState({
  loading, error, empty, emptyLabel,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyLabel: string;
}) {
  if (loading) return <p className="text-center text-sm text-text-subtle py-12">Loading…</p>;
  if (error) return <p className="text-center text-sm text-red-500 py-12 px-4">Failed to load: {error}</p>;
  if (empty) return <p className="text-center text-sm text-text-subtle py-12">{emptyLabel}</p>;
  return null;
}