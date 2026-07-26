"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDown,
  AudioWaveform,
  ChevronUp,
  Loader2,
  LogOut,
  Pause,
  Play,
  RefreshCw,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";

const POLL_INTERVAL_MS = 3000;

// Paging: start with a small window, load older entries on demand.
// MAX_FETCH_LIMIT matches the backend's own cap (Query(200, le=2000)) -
// asking for more than 2000 would return a 422 validation error.
const INITIAL_FETCH_LIMIT = 200;
const LOAD_MORE_STEP = 200;
const MAX_FETCH_LIMIT = 2000;

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

// Two shared formatter instances instead of one-per-call:
// Intl.DateTimeFormat construction is by far the most expensive part of
// date formatting, and toLocaleTimeString() constructs a fresh one every
// single call. Reusing instances + caching results per timestamp string
// (timestamps are immutable) means each log row is formatted exactly once
// for its entire lifetime instead of on every poll re-render.
const NP_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const NP_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  month: "short",
  day: "2-digit",
});

const fmtCache = new Map<string, [string, string]>();

function npFormatted(isoString: string): [string, string] {
  let hit = fmtCache.get(isoString);
  if (!hit) {
    // Bounded cache: old entries are useless once their rows scroll out of
    // the loadable window, so just reset rather than grow forever.
    if (fmtCache.size > 6000) fmtCache.clear();
    const d = parseTs(isoString);
    hit = [NP_TIME_FMT.format(d), NP_DATE_FMT.format(d)];
    fmtCache.set(isoString, hit);
  }
  return hit;
}

function npTime(isoString: string): string {
  return npFormatted(isoString)[0];
}

function npDate(isoString: string): string {
  return npFormatted(isoString)[1];
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

/** Render only the layout that's actually visible. The previous approach
 *  kept BOTH the desktop table and the mobile card list mounted at all
 *  times (hidden via CSS), which meant React built and reconciled up to
 *  2x every row on every update - pure waste, since only one can ever be
 *  seen. Defaults to desktop on first paint, corrects immediately after
 *  mount, and tracks live resizes. */
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export default function AdminLogsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("http");
  const isMobile = useIsMobile();

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // How many rows we're currently asking the backend for, per tab. Grows
  // by LOAD_MORE_STEP each time the user loads older entries.
  const [httpLimit, setHttpLimit] = useState(INITIAL_FETCH_LIMIT);
  const [sysLimit, setSysLimit] = useState(INITIAL_FETCH_LIMIT);
  // Total rows that exist in the DB (from the API response), used to know
  // whether there's anything older left to load.
  const [httpTotal, setHttpTotal] = useState(0);
  const [sysTotal, setSysTotal] = useState(0);
  const [httpLoadingMore, setHttpLoadingMore] = useState(false);
  const [sysLoadingMore, setSysLoadingMore] = useState(false);

  // When older entries get prepended at the top, the scroll position would
  // otherwise jump. We capture pre-load scroll metrics here and restore the
  // user's view right after the new rows render.
  const httpScrollAdjustRef = useRef<{
    desk: [number, number] | null;
    mob: [number, number] | null;
  } | null>(null);
  const sysScrollAdjustRef = useRef<[number, number] | null>(null);

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
    // Button visibility tracks scroll position directly: the moment you
    // scroll up, the way back down appears - it doesn't wait for new data
    // to arrive. (Setting the same boolean repeatedly during a scroll is
    // free: React bails out of re-renders when state is unchanged.)
    setShowJumpHttp(!nearBottom);
  }

  function handleSysScroll() {
    const el = sysRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    sysPinnedRef.current = nearBottom;
    setShowJumpSys(!nearBottom);
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

  const httpInFlightRef = useRef(false);
  const sysInFlightRef = useRef(false);
  const httpSigRef = useRef("");
  const sysSigRef = useRef("");

  const fetchHttpWithLimit = useCallback(async (limit: number, force = false) => {
    if (!force && httpInFlightRef.current) return;
    httpInFlightRef.current = true;
    try {
      const res = await fetch(`/api/admin/logs?type=http&limit=${limit}`, { cache: "no-store" });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      // Most polls return exactly what we already have. Setting state with a
      // new (but identical-content) array forces React to re-render every
      // row for zero visual change - the single biggest source of lag on
      // this page. A cheap signature comparison lets identical polls become
      // complete no-ops instead.
      const sig = `${data.total}:${data.success}:${data.logs.length}:${data.logs[0]?.id ?? 0}`;
      if (sig === httpSigRef.current) return;
      httpSigRef.current = sig;

      setTotals({ total: data.total, success: data.success, failed: data.failed });
      setHttpTotal(data.total);
      // Backend returns newest-first (ORDER BY id DESC); reverse so the
      // oldest entry is at the top and the newest lands at the bottom,
      // like a terminal tail - the most recent activity is always the
      // last thing you see when scrolled down.
      setHttpLogs([...data.logs].reverse());
      setHttpError(null);
    } catch (e) {
      httpSigRef.current = ""; // force a real update on next successful poll
      setHttpError((e as Error).message);
    } finally {
      setHttpLoading(false);
      httpInFlightRef.current = false;
    }
  }, [router]);

  const fetchHttp = useCallback(
    () => fetchHttpWithLimit(httpLimit),
    [fetchHttpWithLimit, httpLimit]
  );

  const fetchSystemWithLimit = useCallback(async (limit: number, force = false) => {
    if (!force && sysInFlightRef.current) return;
    sysInFlightRef.current = true;
    try {
      const res = await fetch(`/api/admin/logs?type=system&limit=${limit}`, { cache: "no-store" });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      const lastId = data.logs.length > 0 ? data.logs[data.logs.length - 1].id : 0;
      const sig = `${data.total}:${data.logs.length}:${lastId}`;
      if (sig === sysSigRef.current) return;
      sysSigRef.current = sig;

      setSysTotal(data.total);
      setSystemLogs(data.logs); // already oldest -> newest from backend; newest lands at the bottom
      setSystemError(null);
    } catch (e) {
      sysSigRef.current = "";
      setSystemError((e as Error).message);
    } finally {
      setSystemLoading(false);
      sysInFlightRef.current = false;
    }
  }, [router]);

  const fetchSystem = useCallback(
    () => fetchSystemWithLimit(sysLimit),
    [fetchSystemWithLimit, sysLimit]
  );

  useEffect(() => { fetchHttp(); fetchSystem(); }, [fetchHttp, fetchSystem]);

  // Follows new data only while "pinned to bottom." The moment you
  // scroll up (handleHttpScroll/handleSysScroll above), pinned flips to
  // false and this stops forcing your scroll position - new data just
  // shows a small "Jump to latest" button instead of yanking you back
  // down mid-read. Scrolling back to the bottom yourself, or clicking
  // that button, re-pins it. First load pins to bottom by default so you
  // land on the newest activity immediately, same as Railway.
  useEffect(() => {
    // If older rows were just prepended by "load more", restore the user's
    // previous view rather than following new data or nagging about it.
    const adjust = httpScrollAdjustRef.current;
    if (adjust) {
      if (scrollRef.current && adjust.desk) {
        scrollRef.current.scrollTop =
          scrollRef.current.scrollHeight - adjust.desk[0] + adjust.desk[1];
      }
      if (mobileScrollRef.current && adjust.mob) {
        mobileScrollRef.current.scrollTop =
          mobileScrollRef.current.scrollHeight - adjust.mob[0] + adjust.mob[1];
      }
      httpScrollAdjustRef.current = null;
      return;
    }

    if (httpPinnedRef.current) {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
    }
    // No else branch needed: the jump button's visibility is driven purely
    // by scroll position in handleHttpScroll, not by data arrival.
  }, [httpLogs]);

  useEffect(() => {
    const el = sysRef.current;
    if (!el) return;

    const adjust = sysScrollAdjustRef.current;
    if (adjust) {
      el.scrollTop = el.scrollHeight - adjust[0] + adjust[1];
      sysScrollAdjustRef.current = null;
      return;
    }

    if (sysPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [systemLogs]);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      // Don't poll while the browser tab is hidden - resumes automatically
      // on the next tick after it regains focus.
      if (document.hidden) return;
      // Only poll the panel that's actually on screen - polling the hidden
      // one every 3s doubles network and parse work for data nobody is
      // looking at. Switching tabs triggers an immediate fetch (below), so
      // the other panel is never stale when you come back to it.
      if (tab === "http") fetchHttp();
      else fetchSystem();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPaused, tab, fetchHttp, fetchSystem]);

  // Immediate refresh whenever the user switches panels, so the newly
  // visible tab shows current data right away instead of waiting for the
  // next poll tick.
  useEffect(() => {
    if (tab === "http") fetchHttp();
    else fetchSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const passesDate = (log: HttpLogEntry): boolean => {
    if (dateFilter === "all") return true;
    try {
      const k = npYMD(log.timestamp);
      return dateFilter === "today" ? k === todayKey() : k === yesterdayKey();
    } catch { return false; }
  };

  // Memoized: without this, the whole array gets re-filtered on EVERY
  // render, including ones triggered by unrelated state like the refresh
  // spinner or dropdown toggles.
  const filtered = useMemo(
    () =>
      httpLogs.filter((log) => {
        if (methodFilter && log.method !== methodFilter) return false;
        if (pathFilter && !log.path.toLowerCase().includes(pathFilter.toLowerCase())) return false;
        if (hideNoise && isNoise(log.path)) return false;
        if (!passesDate(log)) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [httpLogs, methodFilter, pathFilter, hideNoise, dateFilter]
  );

  const httpHasMore = httpLogs.length < httpTotal && httpLimit < MAX_FETCH_LIMIT;
  const httpAtCap = httpLogs.length < httpTotal && httpLimit >= MAX_FETCH_LIMIT;
  const sysHasMore = systemLogs.length < sysTotal && sysLimit < MAX_FETCH_LIMIT;
  const sysAtCap = systemLogs.length < sysTotal && sysLimit >= MAX_FETCH_LIMIT;

  async function loadMoreHttp() {
    if (httpLoadingMore) return;
    const nextLimit = Math.min(httpLimit + LOAD_MORE_STEP, MAX_FETCH_LIMIT);
    if (nextLimit === httpLimit) return;

    // Capture where the user is looking before older rows get prepended,
    // so the view can be restored instead of jumping.
    httpScrollAdjustRef.current = {
      desk: scrollRef.current
        ? [scrollRef.current.scrollHeight, scrollRef.current.scrollTop]
        : null,
      mob: mobileScrollRef.current
        ? [mobileScrollRef.current.scrollHeight, mobileScrollRef.current.scrollTop]
        : null,
    };

    setHttpLoadingMore(true);
    setHttpLimit(nextLimit);
    // force: true - bypasses the in-flight guard so a poll already running
    // can't silently swallow this request and leave the button spinning.
    await fetchHttpWithLimit(nextLimit, true);
    setHttpLoadingMore(false);
  }

  async function loadMoreSystem() {
    if (sysLoadingMore) return;
    const nextLimit = Math.min(sysLimit + LOAD_MORE_STEP, MAX_FETCH_LIMIT);
    if (nextLimit === sysLimit) return;

    sysScrollAdjustRef.current = sysRef.current
      ? [sysRef.current.scrollHeight, sysRef.current.scrollTop]
      : null;

    setSysLoadingMore(true);
    setSysLimit(nextLimit);
    await fetchSystemWithLimit(nextLimit, true);
    setSysLoadingMore(false);
  }

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

  async function handleManualRefresh() {
    setIsRefreshing(true);
    const minSpinTime = new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await Promise.all([fetchHttp(), fetchSystem(), minSpinTime]);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <main className="h-dvh flex flex-col overflow-hidden bg-graphite-950 text-text-primary">
      {/* ===== Top bar ===== */}
      <header className="shrink-0 border-b border-graphite-800 bg-graphite-950">
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

      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 flex flex-col gap-4 sm:gap-5">
        {/* ===== Page heading + tabs ===== */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Request Logs</h1>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5 hidden sm:block">Live traffic and system events from the backend.</p>
          </div>
          <div className="flex rounded-lg border border-graphite-800 bg-graphite-900 p-0.5 self-start sm:self-auto">
            <TabButton active={tab === "http"} onClick={() => setTab("http")} icon={Activity} label="HTTP" />
            <TabButton active={tab === "system"} onClick={() => setTab("system")} icon={Terminal} label="System" />
          </div>
        </div>

        {tab === "http" ? (
          <>
            {/* ===== Stat strip ===== */}
            <div className="shrink-0 grid grid-cols-3 divide-x divide-graphite-800 rounded-lg border border-graphite-800 bg-graphite-900">
              <Stat label="Total" value={totals.total} />
              <Stat label="Success" value={totals.success} valueClass="text-teal-400" />
              <Stat label="Failed" value={totals.failed} valueClass={totals.failed > 0 ? "text-red-500" : ""} />
            </div>

            {/* ===== Unified table card ===== */}
            {/* NOTE: no overflow-hidden here - it would clip the Delete
                dropdown menu, which needs to escape the card bounds on
                small screens. */}
            <section className="rounded-lg border border-graphite-800 bg-graphite-900 flex-1 min-h-0 flex flex-col">
              {/* Toolbar row */}
              <div className="shrink-0 flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b border-graphite-800">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-subtle pointer-events-none" />
                  <input
                    type="text"
                    value={pathFilter}
                    onChange={(e) => setPathFilter(e.target.value)}
                    placeholder="Filter by path…"
                    className="w-full rounded-md border border-graphite-700 bg-graphite-850 py-1.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-amber-500/60"
                  />
                  {pathFilter && (
                    <button
                      onClick={() => setPathFilter("")}
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-subtle hover:text-text-primary hover:bg-graphite-800 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
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
                  <IconAction
                    onClick={handleManualRefresh}
                    icon={RefreshCw}
                    label={isRefreshing ? "Refreshing…" : "Refresh"}
                    spinning={isRefreshing}
                    disabled={isRefreshing}
                  />
                  <div className="relative">
                    <IconAction
                      onClick={() => setManageOpen((o) => !o)}
                      icon={Trash2}
                      label="Delete"
                      highlight={manageOpen}
                    />
                    {manageOpen && (
                      <>
                        {/* invisible backdrop: tap anywhere outside to close */}
                        <button
                          aria-hidden
                          tabIndex={-1}
                          onClick={() => setManageOpen(false)}
                          className="fixed inset-0 z-20 cursor-default"
                        />
                        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-48 rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl overflow-hidden z-30">
                          <MenuItem onClick={() => { setManageOpen(false); handleDelete(1); }}>Older than 1 day</MenuItem>
                          <MenuItem onClick={() => { setManageOpen(false); handleDelete(7); }}>Older than 7 days</MenuItem>
                          <MenuItem danger onClick={() => { setManageOpen(false); handleDelete(null); }}>Delete all logs</MenuItem>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Desktop table */}
              {!isMobile && (
              <div className="relative flex-1 min-h-0">
              <div ref={scrollRef} onScroll={(e) => handleHttpScroll(e.currentTarget)} className="h-full overflow-y-auto scrollbar-thin">
                <LoadMoreBar
                  hasMore={httpHasMore}
                  atCap={httpAtCap}
                  loading={httpLoadingMore}
                  onClick={loadMoreHttp}
                  loadedCount={httpLogs.length}
                  total={httpTotal}
                />
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
                      <HttpTableRow key={log.id} log={log} />
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
                  Jump to latest
                </button>
              )}
              </div>
              )}

              {/* Mobile rows */}
              {isMobile && (
              <div className="relative flex-1 min-h-0">
              <div ref={mobileScrollRef} onScroll={(e) => handleHttpScroll(e.currentTarget)} className="h-full overflow-y-auto scrollbar-thin">
                <LoadMoreBar
                  hasMore={httpHasMore}
                  atCap={httpAtCap}
                  loading={httpLoadingMore}
                  onClick={loadMoreHttp}
                  loadedCount={httpLogs.length}
                  total={httpTotal}
                />
                <div className="divide-y divide-graphite-800/70">
                {filtered.map((log) => (
                  <HttpCardRow key={log.id} log={log} />
                ))}
                </div>
                <ListState loading={httpLoading} error={httpError} empty={filtered.length === 0} emptyLabel="No requests match the current filters." />
              </div>
              {showJumpHttp && (
                <button
                  onClick={jumpToBottomHttp}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-amber-500 text-graphite-950 px-3.5 py-1.5 text-xs font-medium shadow-lg hover:bg-amber-400 transition-colors"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Jump to latest
                </button>
              )}
              </div>
              )}

              {/* Footer */}
              <div className="shrink-0 px-4 py-2.5 border-t border-graphite-800 text-xs text-text-subtle tabular-nums">
                Showing {filtered.length.toLocaleString()} of {httpLogs.length.toLocaleString()} loaded
                {httpTotal > httpLogs.length && <> · {httpTotal.toLocaleString()} total</>}
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-graphite-800 bg-graphite-900 overflow-hidden flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-graphite-800">
              <span className="text-sm text-text-muted">
                Application log buffer
                {sysTotal > 0 && (
                  <span className="text-text-subtle tabular-nums">
                    {" "}({systemLogs.length.toLocaleString()} of {sysTotal.toLocaleString()})
                  </span>
                )}
              </span>
              <button
                onClick={() => handleDelete(null)}
                className="flex items-center gap-1.5 text-xs text-text-subtle hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
            <div className="relative flex-1 min-h-0">
            <div ref={sysRef} onScroll={handleSysScroll} className="h-full overflow-y-auto scrollbar-thin font-mono text-xs">
              <LoadMoreBar
                hasMore={sysHasMore}
                atCap={sysAtCap}
                loading={sysLoadingMore}
                onClick={loadMoreSystem}
                loadedCount={systemLogs.length}
                total={sysTotal}
              />
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
                Jump to latest
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
    <div className="px-3 sm:px-5 py-3.5 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-text-subtle truncate whitespace-nowrap">{label}</p>
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
  onClick, icon: Icon, label, highlight = false, spinning = false, disabled = false,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  highlight?: boolean;
  spinning?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        highlight
          ? "border-amber-500/50 text-amber-400"
          : "border-graphite-700 text-text-muted hover:text-text-primary hover:bg-graphite-850"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
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

/** Sits at the TOP of a log list, since older entries load upward
 *  (newest is always pinned at the bottom, terminal-tail style).
 *  Renders nothing at all when there's nothing older left to load. */
const HttpTableRow = memo(
  function HttpTableRow({ log }: { log: HttpLogEntry }) {
    return (
      <tr className="hover:bg-graphite-850/60 transition-colors">
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
    );
  },
  // Log rows are immutable once written - same id means identical content,
  // so a fresh fetch producing new (but equal) objects still skips the
  // re-render for every row that was already on screen.
  (prev, next) => prev.log.id === next.log.id
);

const HttpCardRow = memo(
  function HttpCardRow({ log }: { log: HttpLogEntry }) {
    return (
      <div className="px-4 py-2.5">
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
    );
  },
  (prev, next) => prev.log.id === next.log.id
);

function LoadMoreBar({
  hasMore, atCap, loading, onClick, loadedCount, total,
}: {
  hasMore: boolean;
  atCap: boolean;
  loading: boolean;
  onClick: () => void;
  loadedCount: number;
  total: number;
}) {
  if (atCap) {
    return (
      <div className="px-4 py-2.5 border-b border-graphite-800/70 text-center">
        <p className="text-[11px] text-text-subtle leading-relaxed">
          Showing the most recent {loadedCount.toLocaleString()} of{" "}
          {total.toLocaleString()} entries — that&apos;s the maximum loadable at once.
        </p>
      </div>
    );
  }

  if (!hasMore) return null;

  return (
    <div className="px-4 py-2.5 border-b border-graphite-800/70 flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-graphite-700 bg-graphite-850 px-3.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-amber-500/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ChevronUp className="h-3 w-3" />
        )}
        {loading ? "Loading…" : "Load older entries"}
      </button>
      <p className="text-[11px] text-text-subtle tabular-nums">
        {loadedCount.toLocaleString()} of {total.toLocaleString()} loaded
      </p>
    </div>
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