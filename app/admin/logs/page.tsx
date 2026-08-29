"use client";

/**
 * app/admin/logs/page.tsx — full rewrite.
 *
 * Three things drove the redesign:
 *
 *  1. CORRELATION IS NO LONGER A TAB TAKEOVER. Clicking a request used to
 *     switch you to the System tab, replace its contents, and then — on the way
 *     back — remount the HTTP list at scrollTop 0, throwing away your position
 *     in the feed. It now opens in a drawer over the page. Neither feed moves,
 *     nothing remounts, and closing it returns you to exactly where you were.
 *
 *  2. BOTH FEEDS STAY MOUNTED. Switching tabs hides a panel instead of
 *     destroying it, and each panel's scroll offset is saved and restored. A
 *     tab switch is now free and lossless.
 *
 *  3. THE HTTP FEED IS VIRTUALIZED. Rows are a fixed height, so only the ~40
 *     on screen are in the DOM regardless of how many are loaded. That is what
 *     fixes the lag: 6000 table rows was the whole problem. Fixed heights also
 *     make scroll anchoring exact — prepending N rows is scrollTop += N * rowH,
 *     not a scrollHeight difference measured across a reflow.
 */

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  Copy,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ScrollText,
  Search,
  SlidersHorizontal,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ===================================================================
   Constants
   =================================================================== */

const PAGE_SIZE = 200;

// Rows in memory. Lower than before because the window is virtualized —
// keeping more costs memory without buying visible history.
const RENDER_CAP = 5000;

// Fixed row heights are the contract that makes virtualization exact. If
// you change these, change the row components to match.
const ROW_H_DESKTOP = 34;
const ROW_H_MOBILE = 62;
const OVERSCAN = 10;

// Height of the sentinel strip pinned above the rows inside the scroller.
const SENTINEL_H = 40;

const AUTO_LOAD_PX = 500;
const NEAR_BOTTOM_PX = 96;

const MIN_POLL_MS = 2500;
const MAX_POLL_MS = 10000;
const COUNTS_POLL_MS = 30000;

// Nepal is UTC+5:45, no DST. A Nepal calendar day starts 18:15 UTC the day
// before. Computed here rather than in SQL because the dashboard already owns
// Nepal-time rendering, and the same offset in two places is how they drift.
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

// Sentinel for the "unrecognized traffic" bucket. Deliberately not a shape any
// real route could produce.
const OTHER_TRAFFIC_KEY = "__other__";

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-graphite-900";

// One grid template for the header and every row, so columns line up without a
// <table> — which is what lets rows be absolutely positioned.
const HTTP_COLS = "104px 52px minmax(0,1fr) 58px 74px 124px 18px";

/* ===================================================================
   Types
   =================================================================== */

interface HttpLogEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  client_ip: string;
  request_id: string | null;
  tool?: string | null;
  tier?: string | null;
}

interface SystemLogEntry {
  id: number;
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  request_id: string;
  tool?: string | null;
  tier?: string | null;
}

interface ToolEndpoint {
  path: string;
  label: string;
  methods: string[];
  total_requests?: number;
}

interface ToolCount {
  tool: string;
  label: string;
  standard_count: number;
  hq_count: number;
  total: number;
}

interface EndpointsApiResponse {
  endpoints?: ToolEndpoint[];
  tools?: ToolCount[];
  noise_patterns?: string[];
}

type DateFilter = "all" | "today" | "yesterday";
type Tier = "" | "standard" | "hq";
type StatusClass = "all" | "4xx" | "5xx";
type Tab = "http" | "system";

/**
 * Three buckets, not two. "Failed" used to mean anything non-2xx, which counted
 * entirely normal traffic — a bot probing a dead route (404), a rate limit
 * (429), a full queue (503-by-design) — as the server being broken.
 */
interface Totals {
  total: number;
  success: number;
  client: number;
  server: number;
}

type SystemGroup = { key: string; entries: SystemLogEntry[] };

interface Correlation {
  id: string;
  scope: "job" | "request";
  summary: HttpLogEntry | null;
}

/* ===================================================================
   Identity helpers
   =================================================================== */

/** The backend writes "-" for "no id here". Treating that as a real id is how a
 *  row ends up looking clickable and then correlating on "-", which matches
 *  every unattributed line in the table. */
function realId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  return trimmed && trimmed !== "-" ? trimmed : null;
}

const _ACTION_SEGMENTS = new Set(["status", "preview", "download", "result"]);
const _ID_SEGMENT = /^[0-9a-f]{6,}(-[0-9a-f]{4,}){0,4}$/i;
const _FASTAPI_PARAM_SEGMENT = /^\{[^}]+\}$/;

/** Bounded memo. Paths repeat enormously — a single job's 40 status polls share
 *  one path string — and these run per row per render. */
function memoize1<T>(fn: (key: string) => T, limit = 20000) {
  const cache = new Map<string, T>();
  return (key: string): T => {
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    if (cache.size > limit) cache.clear();
    const value = fn(key);
    cache.set(key, value);
    return value;
  };
}

/**
 * Collapses a request path to the TOOL it belongs to, mirroring
 * _humanize_endpoint/admin_endpoints() in routes.py exactly.
 *
 *   /convert/status/a1b2c3d4     -> /convert
 *   /youtube/analyze/result/9f8e -> /youtube/analyze
 *
 * The i > 0 guard matters: "download" is both a real tool and an action
 * segment, and without it the busiest endpoint on the API resolves to an empty
 * family. These two implementations must agree or the picker and the filter
 * disagree about what a row belongs to.
 */
const toolFamily = memoize1((path: string) => {
  const parts: string[] = [];
  for (const [i, seg] of path.split("/").filter(Boolean).entries()) {
    const isParam = _ID_SEGMENT.test(seg) || _FASTAPI_PARAM_SEGMENT.test(seg);
    if (i > 0 && (_ACTION_SEGMENTS.has(seg) || isParam)) break;
    if (isParam) break; // a bare id as the FIRST segment is never a tool
    parts.push(seg);
  }
  return parts.length ? "/" + parts.join("/") : path;
});

const jobIdFromPath = memoize1((path: string): string | null => {
  for (const seg of path.split("/")) {
    if (seg && _ID_SEGMENT.test(seg)) return seg;
  }
  return null;
});

// Logs write ids in prose, not as path segments:
//   "[YOUTUBE_STEMS_HQ] job=0aee65ad... queued"
//   "[SEPARATION] Starting Demucs for job 0aee65ad..."
// Secondary path only — request_id exists on every row and is preferred.
const _MSG_JOB_ID = /\bjob[=\s]+([0-9a-f]{6,}(?:-[0-9a-f]{4,}){0,4})\b/i;
const jobIdFromMessage = memoize1((message: string): string | null => {
  const m = _MSG_JOB_ID.exec(message);
  return m ? m[1] : null;
});

/* ===================================================================
   Noise
   =================================================================== */

// Bootstrap fallback only — covers the ~2s before the real list arrives from
// /api/admin/endpoints. config.NOISE_PATH_MARKERS is the authority.
let NOISE_PATTERNS: string[] = [
  "/robots.txt", "/favicon.ico", "/.env", "/wp-", "/.git",
  "/SDK/", "/phpmyadmin", "/.well-known", "/xmlrpc.php",
];

// Case-insensitive: SQLite's LIKE is case-insensitive for ASCII, JS's
// .includes() is not — which is how /language/en-GB/en-GB.xml slipped past a
// /language/en-gb pattern that matched fine server-side.
function isNoise(path: string): boolean {
  const lower = path.toLowerCase();
  return NOISE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/* ===================================================================
   Formatting
   =================================================================== */

function parseTs(isoString: string): Date {
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(isoString);
  return new Date(hasZone ? isoString : isoString + "Z");
}

// Constructing Intl.DateTimeFormat is the expensive part, and
// toLocaleTimeString() constructs a fresh one per call. Shared instances plus a
// per-timestamp cache means each row formats exactly once for its lifetime.
const NP_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  hour: "numeric", minute: "2-digit", second: "2-digit", hour12: false,
});
const NP_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu", month: "short", day: "2-digit",
});

const npFormatted = memoize1((iso: string): [string, string] => {
  const d = parseTs(iso);
  return [NP_TIME_FMT.format(d), NP_DATE_FMT.format(d)];
});

const npTime = (iso: string) => npFormatted(iso)[0];
const npDate = (iso: string) => npFormatted(iso)[1];

function nepalDayBounds(daysAgo: number): { since: string; until: string } {
  const nowNepal = new Date(Date.now() + NEPAL_OFFSET_MS);
  const startUtcMs =
    Date.UTC(
      nowNepal.getUTCFullYear(),
      nowNepal.getUTCMonth(),
      nowNepal.getUTCDate() - daysAgo
    ) - NEPAL_OFFSET_MS;
  return {
    since: new Date(startUtcMs).toISOString().replace("Z", ""),
    until: new Date(startUtcMs + 86400000).toISOString().replace("Z", ""),
  };
}

const fmtMs = (ms: number) => (ms >= 1000 ? (ms / 1000).toFixed(2) + "s" : ms.toFixed(0) + "ms");

function fmtAgo(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const statusDot = (c: number) =>
  c >= 500 ? "bg-red-500" : c >= 400 ? "bg-amber-500" : c >= 300 ? "bg-sky-400" : "bg-teal-400";

const statusText = (c: number) =>
  c >= 500 ? "text-red-400" : c >= 400 ? "text-amber-400" : c >= 300 ? "text-sky-400" : "text-teal-400";

function methodTone(method: string): string {
  switch (method) {
    case "POST": return "text-amber-400";
    case "DELETE": return "text-red-400";
    case "PUT":
    case "PATCH": return "text-sky-400";
    default: return "text-text-subtle";
  }
}

function levelTone(level: string): { text: string; border: string } {
  switch (level) {
    case "ERROR":
    case "CRITICAL":
      return { text: "text-red-400", border: "border-red-500/50" };
    case "WARNING":
      return { text: "text-amber-400", border: "border-amber-500/50" };
    default:
      return { text: "text-text-subtle", border: "border-graphite-700" };
  }
}

/** Merge a page of OLDER rows onto the front, dropping anything already held.
 *  Duplicates happen whenever a page boundary lands next to a delta poll, and a
 *  duplicated React key silently breaks rendering. */
function prependUnique<T extends { id: number }>(older: T[], current: T[]): T[] {
  if (older.length === 0) return current;
  const seen = new Set(current.map((r) => r.id));
  const fresh = older.filter((r) => !seen.has(r.id));
  return fresh.length === 0 ? current : [...fresh, ...current];
}

/**
 * Click vs. select. A browser fires click on mouseup regardless of whether that
 * mouseup ended a drag selection, so highlighting an IP and releasing over the
 * row also opened the correlated view and reset the selection. A plain click
 * never has a selection at click-time, so row-opening is unaffected.
 */
function isTextSelected(): boolean {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  return !!sel && sel.toString().length > 0;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ===================================================================
   Hooks
   =================================================================== */

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/** Escape-to-dismiss, in one place, so keyboard behaviour can't drift between
 *  the overlays on this page. */
function useEscape(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        handler.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
}

/** Re-renders on an interval, but only while `active`. Scoped to the one tiny
 *  component that shows relative time, so a 5s tick never touches the feed. */
function useTicker(active: boolean, intervalMs: number) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}

/**
 * Fixed-height windowing. Returns the slice of indices worth rendering and a
 * measure function to call from the scroll handler.
 *
 * Deliberately not a library: rows here are a known constant height, which
 * turns the whole problem into two divisions and makes prepend-anchoring exact.
 */
function useVirtualWindow(count: number, rowH: number) {
  const [win, setWin] = useState({ start: 0, end: 60 });
  const measure = useCallback(
    (el: HTMLElement | null) => {
      if (!el || el.clientHeight === 0) return; // hidden panel: nothing to measure
      const top = Math.max(0, el.scrollTop - SENTINEL_H);
      const start = Math.max(0, Math.floor(top / rowH) - OVERSCAN);
      const end = Math.min(count, Math.ceil((top + el.clientHeight) / rowH) + OVERSCAN);
      setWin((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    },
    [count, rowH]
  );
  return [win, measure] as const;
}

/* ===================================================================
   Page
   =================================================================== */

export default function AdminLogsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("http");
  const isMobile = useIsMobile();
  const rowH = isMobile ? ROW_H_MOBILE : ROW_H_DESKTOP;

  const [httpLogs, setHttpLogs] = useState<HttpLogEntry[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, success: 0, client: 0, server: 0 });
  const [httpLoading, setHttpLoading] = useState(true);
  const [httpError, setHttpError] = useState<string | null>(null);

  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);

  // ---- HTTP filters ----
  const [methodFilter, setMethodFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [statusClassFilter, setStatusClassFilter] = useState<StatusClass>("all");
  const [hideNoise, setHideNoise] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  // Tool/tier is a SEPARATE axis from endpointFilter (path family). It's what
  // answers "only HQ jobs", which path can't: HQ and standard share polling
  // routes after the initial submit.
  const [toolFilter, setToolFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier>("");
  const [toolOptions, setToolOptions] = useState<ToolCount[]>([]);

  // ---- System filters (independent axis) ----
  const [levelFilter, setLevelFilter] = useState("");
  const [systemSearch, setSystemSearch] = useState("");
  const [sysToolFilter, setSysToolFilter] = useState("");
  const [sysTierFilter, setSysTierFilter] = useState<Tier>("");

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const httpSearchRef = useRef<HTMLInputElement>(null);
  const sysSearchRef = useRef<HTMLInputElement>(null);

  // ---- Correlation drawer ----
  const [correlation, setCorrelation] = useState<Correlation | null>(null);
  const [correlatedLogs, setCorrelatedLogs] = useState<SystemLogEntry[]>([]);
  const [correlatedLoading, setCorrelatedLoading] = useState(false);
  const [correlatedError, setCorrelatedError] = useState<string | null>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null | "none">("none");
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);

  const [httpTotal, setHttpTotal] = useState(0);
  // Rows matching the CURRENT filters across the whole table. Distinct from
  // httpTotal (all rows) and httpLogs.length (rows in memory). Reporting
  // "loaded" as the match count is what made filtered views look empty when the
  // matches were simply older than the window.
  const [httpFilteredTotal, setHttpFilteredTotal] = useState(0);
  const [sysTotal, setSysTotal] = useState(0);
  const [sysFilteredTotal, setSysFilteredTotal] = useState(0);
  const [httpLoadingOlder, setHttpLoadingOlder] = useState(false);
  const [sysLoadingOlder, setSysLoadingOlder] = useState(false);
  const [httpHasOlder, setHttpHasOlder] = useState(true);
  const [sysHasOlder, setSysHasOlder] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Mirrors read inside callbacks, which would otherwise close over stale state.
  const httpHasOlderRef = useRef(true);
  const sysHasOlderRef = useRef(true);
  const httpOldestRef = useRef(0);
  const sysOldestRef = useRef(0);

  const httpRef = useRef<HTMLDivElement>(null);
  const sysRef = useRef<HTMLDivElement>(null);

  // Saved offsets, so hiding a panel on tab switch costs nothing. This is the
  // fix for "come back to HTTP and it's scrolled to the top".
  const httpScrollTopRef = useRef(0);
  const sysScrollTopRef = useRef(0);

  // Fixed row heights make this exact: N prepended rows moved the content down
  // by exactly N * rowH, no scrollHeight measurement involved.
  const httpPrependRef = useRef(0);
  const sysScrollAdjustRef = useRef<[number, number] | null>(null);

  // "Pinned to bottom" — auto-scroll follows new data. The instant the reader
  // scrolls up this flips false; it re-pins on scroll back or Jump to latest.
  const httpPinnedRef = useRef(true);
  const sysPinnedRef = useRef(true);
  const [showJumpHttp, setShowJumpHttp] = useState(false);
  const [showJumpSys, setShowJumpSys] = useState(false);

  const httpInFlightRef = useRef(false);
  const sysInFlightRef = useRef(false);
  const httpOlderInFlightRef = useRef(false);
  const sysOlderInFlightRef = useRef(false);
  const httpSigRef = useRef("");
  const sysSigRef = useRef("");

  // Highest id held per tab. Delta polls send this as afterId so the backend
  // returns only genuinely new rows.
  const httpLastIdRef = useRef(0);
  const sysLastIdRef = useRef(0);
  const httpDeltaInFlightRef = useRef(false);
  const sysDeltaInFlightRef = useRef(false);

  // "Has a full fetch landed, so the cursor means something?" Replaces using
  // `lastId === 0`, which conflated never-fetched with fetched-but-empty and
  // fetched-but-filter-matched-nothing. Only the first should block a delta.
  const httpSeededRef = useRef(false);
  const sysSeededRef = useRef(false);

  /**
   * One controller for all in-flight requests, aborted on unmount. Created
   * through a getter that REPLACES an already-aborted controller: under
   * StrictMode the dev remount otherwise left every fetch bailing on a dead
   * signal, and only a full reload recovered.
   */
  const abortRef = useRef<AbortController | null>(null);
  const getController = () => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    return abortRef.current;
  };
  const signal = () => getController().signal;

  useEffect(() => {
    getController();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const currentDelayRef = useRef(MIN_POLL_MS);
  const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";
  const markUpdated = useCallback(() => setLastUpdatedAt(Date.now()), []);

  // Debounced inputs, declared above the refs that read them: a const
  // referenced before its declaration line is a temporal-dead-zone error.
  const [debouncedPath, setDebouncedPath] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPath(pathFilter), 250);
    return () => clearTimeout(t);
  }, [pathFilter]);

  const [debouncedSystemSearch, setDebouncedSystemSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSystemSearch(systemSearch), 250);
    return () => clearTimeout(t);
  }, [systemSearch]);

  /**
   * ALL filters go to the backend. Applied in the browser they under-reported
   * the moment the real result set outgrew the window — a tool with 6 old
   * requests showed "No requests match" while the stat boxes counted the whole
   * table. Read through a ref so the fetch callbacks stay memoized on [router].
   */
  const filterRef = useRef({
    endpointFilter: "", methodFilter: "", debouncedPath: "",
    statusClassFilter: "all" as StatusClass,
    dateFilter: "all" as DateFilter, hideNoise: true,
    toolFilter: "", tierFilter: "" as Tier,
  });
  filterRef.current = {
    endpointFilter, methodFilter, debouncedPath, statusClassFilter,
    dateFilter, hideNoise, toolFilter, tierFilter,
  };

  const sysFilterRef = useRef({
    levelFilter: "", debouncedSystemSearch: "",
    sysToolFilter: "", sysTierFilter: "" as Tier,
  });
  sysFilterRef.current = { levelFilter, debouncedSystemSearch, sysToolFilter, sysTierFilter };

  const filterParams = useCallback(() => {
    const f = filterRef.current;
    const p = new URLSearchParams();
    // OTHER_TRAFFIC_KEY is a client-side grouping ("not any known tool"), so
    // there's no single family the server can filter on.
    if (f.endpointFilter && f.endpointFilter !== OTHER_TRAFFIC_KEY) p.set("family", f.endpointFilter);
    if (f.methodFilter) p.set("method", f.methodFilter);
    if (f.debouncedPath.trim()) p.set("q", f.debouncedPath.trim());
    if (f.statusClassFilter !== "all") p.set("status_class", f.statusClassFilter);
    if (f.hideNoise) p.set("hide_noise", "true");
    if (f.dateFilter !== "all") {
      const { since, until } = nepalDayBounds(f.dateFilter === "today" ? 0 : 1);
      p.set("since", since);
      p.set("until", until);
    }
    if (f.toolFilter) p.set("tool", f.toolFilter);
    if (f.tierFilter) p.set("tier", f.tierFilter);
    const s = p.toString();
    return s ? `&${s}` : "";
  }, []);

  const sysFilterParams = useCallback(() => {
    const f = sysFilterRef.current;
    const p = new URLSearchParams();
    if (f.levelFilter) p.set("level", f.levelFilter);
    if (f.debouncedSystemSearch.trim()) p.set("q", f.debouncedSystemSearch.trim());
    if (f.sysToolFilter) p.set("tool", f.sysToolFilter);
    if (f.sysTierFilter) p.set("tier", f.sysTierFilter);
    const s = p.toString();
    return s ? `&${s}` : "";
  }, []);

  /* ---------------- Correlation (drawer) ---------------- */

  // Guards against a slow earlier response overwriting a newer one when rows
  // are clicked in quick succession.
  const correlationTokenRef = useRef(0);

  const runCorrelation = useCallback(
    async (opts: { param: string; id: string; scope: "job" | "request"; summary: HttpLogEntry | null }) => {
      const token = ++correlationTokenRef.current;
      setCorrelation({ id: opts.id, scope: opts.scope, summary: opts.summary });
      setCorrelatedLogs([]);
      setCorrelatedError(null);
      setCorrelatedLoading(true);
      try {
        const res = await fetch(`/api/admin/logs?type=system&${opts.param}`, {
          cache: "no-store",
          signal: signal(),
        });
        if (token !== correlationTokenRef.current) return;
        if (res.status === 401) { router.push("/admin/login"); return; }
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Server returned ${res.status}`);
        }
        const data = await res.json();
        if (token !== correlationTokenRef.current) return;
        setCorrelatedLogs(data.logs ?? []);
      } catch (e) {
        if (isAbort(e) || token !== correlationTokenRef.current) return;
        setCorrelatedError((e as Error).message);
      } finally {
        if (token === correlationTokenRef.current) setCorrelatedLoading(false);
      }
    },
    [router]
  );

  /**
   * HTTP row -> logs. Prefers JOB scope whenever the path carries a job id.
   * A job's ~40 status-poll GETs each have their own request_id but log nothing
   * (the handler is a dict lookup), so correlating a poll by request_id returns
   * an empty list: technically correct, reads as broken. The job id is shared
   * across the whole lifecycle.
   */
  const openFromHttpRow = useCallback(
    (log: HttpLogEntry) => {
      const jobId = jobIdFromPath(log.path);
      const reqId = realId(log.request_id);
      if (jobId) {
        void runCorrelation({ param: `job_id=${encodeURIComponent(jobId)}`, id: jobId, scope: "job", summary: log });
      } else if (reqId) {
        void runCorrelation({ param: `requestId=${encodeURIComponent(reqId)}`, id: reqId, scope: "request", summary: log });
      }
    },
    [runCorrelation]
  );

  /** System row -> logs, the reverse direction. request_id is on every line and
   *  is set by middleware regardless of message content, so it's the reliable
   *  fallback; job id stays the preference. */
  const openFromSystemRow = useCallback(
    (entry: SystemLogEntry) => {
      const jobId = jobIdFromMessage(entry.message);
      const reqId = realId(entry.request_id);
      if (jobId) {
        void runCorrelation({ param: `job_id=${encodeURIComponent(jobId)}`, id: jobId, scope: "job", summary: null });
      } else if (reqId) {
        void runCorrelation({ param: `requestId=${encodeURIComponent(reqId)}`, id: reqId, scope: "request", summary: null });
      }
    },
    [runCorrelation]
  );

  // Closing is now genuinely nothing: no remount, no refetch, no scroll repair.
  // The feed underneath never moved.
  const closeCorrelation = useCallback(() => {
    correlationTokenRef.current++;
    setCorrelation(null);
    setCorrelatedLogs([]);
    setCorrelatedError(null);
    setCorrelatedLoading(false);
  }, []);

  useEscape(!!correlation, closeCorrelation);

  /* ---------------- HTTP: initial / refresh ---------------- */

  const fetchHttp = useCallback(async (force = false) => {
    if (!force && httpInFlightRef.current) return;
    httpInFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/admin/logs?type=http&limit=${PAGE_SIZE}${filterParams()}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();

      // Seed the delta cursor HERE — before the signature guard, and regardless
      // of whether this query matched anything. Seeding inside `if
      // (rows.length > 0)` left it at 0 for a filter that matched nothing, and
      // delta polling was then permanently dead for that filter.
      const newestMatching = data.logs.length > 0 ? data.logs[0].id : 0;
      httpLastIdRef.current = Math.max(newestMatching, data.max_id ?? 0);
      httpSeededRef.current = true;

      const sig = [
        data.total, data.filtered_total, data.success, data.client,
        data.server, data.logs.length, data.logs[0]?.id ?? 0,
      ].join(":");
      if (sig === httpSigRef.current) return;
      httpSigRef.current = sig;

      setTotals({ total: data.total, success: data.success, client: data.client, server: data.server });
      setHttpTotal(data.total);
      if (typeof data.filtered_total === "number") setHttpFilteredTotal(data.filtered_total);
      // Backend returns newest-first; reverse so the newest lands at the bottom,
      // like a terminal tail.
      const reversed = [...data.logs].reverse();
      setHttpLogs(reversed);
      if (reversed.length > 0) httpOldestRef.current = reversed[0].id;
      const more = data.logs.length >= PAGE_SIZE;
      httpHasOlderRef.current = more;
      setHttpHasOlder(more);
      setHttpError(null);
      markUpdated();
    } catch (e) {
      if (isAbort(e)) return;
      httpSigRef.current = "";
      setHttpError((e as Error).message);
    } finally {
      setHttpLoading(false);
      httpInFlightRef.current = false;
    }
  }, [router, filterParams, markUpdated]);

  /* ---------------- HTTP: older page ---------------- */

  const loadOlderHttp = useCallback(async () => {
    if (httpOlderInFlightRef.current || !httpHasOlderRef.current) return;
    const cursor = httpOldestRef.current;
    if (!cursor) return;

    httpOlderInFlightRef.current = true;
    setHttpLoadingOlder(true);
    // Reading history is an explicit "stop following the tail" gesture.
    httpPinnedRef.current = false;
    setShowJumpHttp(true);

    try {
      const res = await fetch(
        `/api/admin/logs?type=http&limit=${PAGE_SIZE}&beforeId=${cursor}${filterParams()}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      const older: HttpLogEntry[] = [...data.logs].reverse();

      const more = data.logs.length >= PAGE_SIZE;
      httpHasOlderRef.current = more;
      setHttpHasOlder(more);

      if (older.length > 0) {
        httpOldestRef.current = older[0].id;
        setHttpLogs((prev) => {
          const next = prependUnique(older, prev);
          httpPrependRef.current = next.length - prev.length;
          return next;
        });
      }
      setHttpError(null);
    } catch (e) {
      if (isAbort(e)) return;
      setHttpError((e as Error).message);
    } finally {
      setHttpLoadingOlder(false);
      httpOlderInFlightRef.current = false;
    }
  }, [router, filterParams]);

  /* ---------------- System: initial / refresh ---------------- */

  const fetchSystem = useCallback(async (force = false) => {
    if (!force && sysInFlightRef.current) return;
    sysInFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/admin/logs?type=system&limit=${PAGE_SIZE}${sysFilterParams()}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      const lastId = data.logs.length > 0 ? data.logs[data.logs.length - 1].id : 0;

      sysLastIdRef.current = Math.max(lastId, data.max_id ?? 0);
      sysSeededRef.current = true;

      const sig = [data.total, data.filtered_total, data.logs.length, lastId].join(":");
      if (sig === sysSigRef.current) return;
      sysSigRef.current = sig;

      setSysTotal(data.total);
      if (typeof data.filtered_total === "number") setSysFilteredTotal(data.filtered_total);
      setSystemLogs(data.logs); // already oldest -> newest
      if (data.logs.length > 0) sysOldestRef.current = data.logs[0].id;
      const more = data.logs.length >= PAGE_SIZE;
      sysHasOlderRef.current = more;
      setSysHasOlder(more);
      setSystemError(null);
      markUpdated();
    } catch (e) {
      if (isAbort(e)) return;
      sysSigRef.current = "";
      setSystemError((e as Error).message);
    } finally {
      setSystemLoading(false);
      sysInFlightRef.current = false;
    }
  }, [router, sysFilterParams, markUpdated]);

  /* ---------------- System: older page ---------------- */

  const loadOlderSystem = useCallback(async () => {
    if (sysOlderInFlightRef.current || !sysHasOlderRef.current) return;
    const cursor = sysOldestRef.current;
    if (!cursor) return;

    sysOlderInFlightRef.current = true;
    setSysLoadingOlder(true);
    sysPinnedRef.current = false;
    setShowJumpSys(true);

    sysScrollAdjustRef.current = sysRef.current
      ? [sysRef.current.scrollHeight, sysRef.current.scrollTop]
      : null;

    try {
      const res = await fetch(
        `/api/admin/logs?type=system&limit=${PAGE_SIZE}&beforeId=${cursor}${sysFilterParams()}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      const older: SystemLogEntry[] = data.logs;

      const more = data.logs.length >= PAGE_SIZE;
      sysHasOlderRef.current = more;
      setSysHasOlder(more);

      if (older.length > 0) {
        sysOldestRef.current = older[0].id;
        setSystemLogs((prev) => prependUnique(older, prev));
      } else {
        sysScrollAdjustRef.current = null;
      }
      setSystemError(null);
    } catch (e) {
      sysScrollAdjustRef.current = null;
      if (isAbort(e)) return;
      setSystemError((e as Error).message);
    } finally {
      setSysLoadingOlder(false);
      sysOlderInFlightRef.current = false;
    }
  }, [router, sysFilterParams]);

  /* ---------------- Delta polling ---------------- */

  const fetchHttpDelta = useCallback(async (): Promise<boolean> => {
    if (httpDeltaInFlightRef.current || !httpSeededRef.current) return false;
    httpDeltaInFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/admin/logs?type=http&afterId=${httpLastIdRef.current}${filterParams()}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return false; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setHttpError(body?.error || `Server returned ${res.status}`);
        return false;
      }
      const data = await res.json();

      // The backend caps this branch (_DELTA_MAX). Hitting the cap means we're
      // too far behind to catch up incrementally, and splicing a truncated
      // middle would leave a silent hole in the log.
      if (data.truncated) {
        httpSigRef.current = "";
        void fetchHttp(true);
        return true;
      }

      setTotals({ total: data.total, success: data.success, client: data.client, server: data.server });
      setHttpTotal(data.total);
      if (typeof data.filtered_total === "number") setHttpFilteredTotal(data.filtered_total);
      setHttpError(null);
      markUpdated();
      if (!data.logs || data.logs.length === 0) return false;

      setHttpLogs((prev) => {
        const merged = [...prev, ...data.logs];
        // Trim ONLY while following the tail. Trimming while the reader is back
        // in history would delete the pages they just waited for.
        if (httpPinnedRef.current && merged.length > RENDER_CAP) {
          const trimmed = merged.slice(merged.length - RENDER_CAP);
          httpOldestRef.current = trimmed[0].id;
          httpHasOlderRef.current = true;
          return trimmed;
        }
        return merged;
      });
      httpLastIdRef.current = data.logs[data.logs.length - 1].id;
      return true;
    } catch (e) {
      if (isAbort(e)) return false;
      setHttpError((e as Error).message);
      return false;
    } finally {
      httpDeltaInFlightRef.current = false;
    }
  }, [router, fetchHttp, filterParams, markUpdated]);

  const fetchSystemDelta = useCallback(async (): Promise<boolean> => {
    if (sysDeltaInFlightRef.current || !sysSeededRef.current) return false;
    sysDeltaInFlightRef.current = true;
    try {
      const res = await fetch(
        `/api/admin/logs?type=system&afterId=${sysLastIdRef.current}${sysFilterParams()}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return false; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSystemError(body?.error || `Server returned ${res.status}`);
        return false;
      }
      const data = await res.json();

      if (data.truncated) {
        sysSigRef.current = "";
        void fetchSystem(true);
        return true;
      }

      setSysTotal(data.total);
      if (typeof data.filtered_total === "number") setSysFilteredTotal(data.filtered_total);
      setSystemError(null);
      markUpdated();
      if (!data.logs || data.logs.length === 0) return false;

      setSystemLogs((prev) => {
        const merged = [...prev, ...data.logs];
        if (sysPinnedRef.current && merged.length > RENDER_CAP) {
          const trimmed = merged.slice(merged.length - RENDER_CAP);
          sysOldestRef.current = trimmed[0].id;
          sysHasOlderRef.current = true;
          return trimmed;
        }
        return merged;
      });
      sysLastIdRef.current = data.logs[data.logs.length - 1].id;
      return true;
    } catch (e) {
      if (isAbort(e)) return false;
      setSystemError((e as Error).message);
      return false;
    } finally {
      sysDeltaInFlightRef.current = false;
    }
  }, [router, fetchSystem, sysFilterParams, markUpdated]);

  /* ---------------- Endpoints / tools ---------------- */

  const [knownEndpoints, setKnownEndpoints] = useState<ToolEndpoint[]>([]);
  // NOISE_PATTERNS is a module-level array, not React state, so memos that call
  // isNoise() need a signal that the definition changed.
  const [noiseListVersion, setNoiseListVersion] = useState(0);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/endpoints", { cache: "no-store", signal: signal() });
      if (!res.ok) return;
      const data = (await res.json()) as EndpointsApiResponse;
      if (Array.isArray(data?.endpoints)) setKnownEndpoints(data.endpoints);
      if (Array.isArray(data?.tools)) setToolOptions(data.tools);
      if (Array.isArray(data?.noise_patterns) && data.noise_patterns.length > 0) {
        NOISE_PATTERNS = data.noise_patterns;
        setNoiseListVersion((v) => v + 1);
      }
    } catch {
      // Fire-and-forget: a failure just means the picker keeps what it has.
    }
  }, []);

  /** Runs once per MOUNT. A bootedRef guard would survive StrictMode's remount
   *  while the aborted fetches from the first mount would not — turning "the
   *  first mount's requests got cancelled" into "and no request is ever issued
   *  again". The in-flight refs already collapse genuine duplicates. */
  useEffect(() => {
    void fetchHttp();
    void fetchSystem();
    void fetchEndpoints();
  }, [fetchHttp, fetchSystem, fetchEndpoints]);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      void fetchEndpoints();
    }, COUNTS_POLL_MS);
    return () => clearInterval(id);
  }, [isPaused, fetchEndpoints]);

  /* ---------------- Derived rows ---------------- */

  const knownPathSet = useMemo(() => new Set(knownEndpoints.map((e) => e.path)), [knownEndpoints]);

  /** Everything the server returned already matches the active filters. The ONE
   *  exception is the "Other" bucket: it means "not any known tool", which is
   *  defined by the client's knowledge of the tool list. */
  const otherBucketActive = endpointFilter === OTHER_TRAFFIC_KEY;
  const filtered = useMemo(() => {
    if (!otherBucketActive) return httpLogs;
    return httpLogs.filter((log) => !knownPathSet.has(toolFamily(log.path)));
  }, [httpLogs, otherBucketActive, knownPathSet]);

  const [httpWin, measureHttp] = useVirtualWindow(filtered.length, rowH);

  /* ---------------- Scroll handling ---------------- */

  const handleHttpScroll = useCallback(() => {
    const el = httpRef.current;
    if (!el) return;
    httpScrollTopRef.current = el.scrollTop;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    httpPinnedRef.current = nearBottom;
    setShowJumpHttp(!nearBottom); // React bails when unchanged
    measureHttp(el);
    if (el.scrollTop < AUTO_LOAD_PX) void loadOlderHttp();
  }, [loadOlderHttp, measureHttp]);

  const handleSysScroll = useCallback(() => {
    const el = sysRef.current;
    if (!el) return;
    sysScrollTopRef.current = el.scrollTop;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    sysPinnedRef.current = nearBottom;
    setShowJumpSys(!nearBottom);
    if (el.scrollTop < AUTO_LOAD_PX) void loadOlderSystem();
  }, [loadOlderSystem]);

  const jumpToBottomHttp = useCallback(() => {
    const el = httpRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    httpScrollTopRef.current = el.scrollTop;
    httpPinnedRef.current = true;
    setShowJumpHttp(false);
    measureHttp(el);
  }, [measureHttp]);

  const jumpToBottomSys = useCallback(() => {
    const el = sysRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    sysScrollTopRef.current = el.scrollTop;
    sysPinnedRef.current = true;
    setShowJumpSys(false);
  }, []);

  /* ---------------- Scroll anchoring ----------------
     useLayoutEffect, not useEffect: the scroll write has to land in the same
     frame the rows commit, or the browser paints the un-adjusted position
     first and you see a jump. */

  useLayoutEffect(() => {
    const el = httpRef.current;
    if (!el || tab !== "http") return;

    const prepended = httpPrependRef.current;
    if (prepended > 0) {
      // Exact, because every row is the same height.
      el.scrollTop += prepended * rowH;
      httpPrependRef.current = 0;
    } else if (httpPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    httpScrollTopRef.current = el.scrollTop;
    measureHttp(el);
  }, [filtered, tab, rowH, measureHttp]);

  // Level and search are applied in SQL, so what came back already matches.
  const filteredSystemLogs = systemLogs;

  useLayoutEffect(() => {
    const el = sysRef.current;
    if (!el || tab !== "system") return;
    const adjust = sysScrollAdjustRef.current;
    if (adjust) {
      el.scrollTop = el.scrollHeight - adjust[0] + adjust[1];
      sysScrollAdjustRef.current = null;
    } else if (sysPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    sysScrollTopRef.current = el.scrollTop;
  }, [filteredSystemLogs, tab]);

  /**
   * Tab switch: restore the offset the panel had when it was hidden. Both
   * panels stay mounted, so this is a scroll write and nothing else — no
   * refetch, no remount, no lost position.
   */
  useLayoutEffect(() => {
    if (tab === "http") {
      const el = httpRef.current;
      if (!el) return;
      el.scrollTop = httpPinnedRef.current ? el.scrollHeight : httpScrollTopRef.current;
      setShowJumpHttp(!httpPinnedRef.current);
      measureHttp(el);
    } else {
      const el = sysRef.current;
      if (!el) return;
      el.scrollTop = sysPinnedRef.current ? el.scrollHeight : sysScrollTopRef.current;
      setShowJumpSys(!sysPinnedRef.current);
    }
  }, [tab, isMobile, measureHttp]);

  // Row height changes with the breakpoint, so the window has to be recomputed
  // against the new geometry or the list renders the wrong slice.
  useEffect(() => {
    measureHttp(httpRef.current);
  }, [rowH, measureHttp]);

  useEffect(() => {
    const el = httpRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureHttp(el));
    ro.observe(el);
    return () => ro.disconnect();
  }, [measureHttp]);

  /* ---------------- Filter changes ---------------- */

  // Filtering is server-side, so changing a filter has to re-query, not
  // re-filter rows fetched under different criteria. Cursors reset because the
  // old ids belong to the previous result set.
  const filterBootRef = useRef(true);
  useEffect(() => {
    if (filterBootRef.current) { filterBootRef.current = false; return; }
    httpSigRef.current = "";
    httpLastIdRef.current = 0;
    httpSeededRef.current = false;
    httpOldestRef.current = 0;
    httpHasOlderRef.current = true;
    httpPrependRef.current = 0;
    setHttpHasOlder(true);
    httpPinnedRef.current = true; // a fresh query starts at its newest end
    setShowJumpHttp(false);
    void fetchHttp(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointFilter, methodFilter, debouncedPath, statusClassFilter, dateFilter, hideNoise, toolFilter, tierFilter]);

  const sysFilterBootRef = useRef(true);
  useEffect(() => {
    if (sysFilterBootRef.current) { sysFilterBootRef.current = false; return; }
    sysSigRef.current = "";
    sysLastIdRef.current = 0;
    sysSeededRef.current = false;
    sysOldestRef.current = 0;
    sysHasOlderRef.current = true;
    setSysHasOlder(true);
    sysPinnedRef.current = true;
    setShowJumpSys(false);
    void fetchSystem(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, debouncedSystemSearch, sysToolFilter, sysTierFilter]);

  /* ---------------- Self-adjusting poll ---------------- */

  // Starts fast; every empty tick stretches the delay (capped), so a quiet
  // dashboard left open gradually polls less. Any tick that finds data — or any
  // manual interaction — snaps back.
  useEffect(() => {
    if (isPaused) return;
    currentDelayRef.current = MIN_POLL_MS;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function tick() {
      if (cancelled) return;
      if (!document.hidden) {
        const gotNewData = tab === "http" ? await fetchHttpDelta() : await fetchSystemDelta();
        currentDelayRef.current = gotNewData
          ? MIN_POLL_MS
          : Math.min(currentDelayRef.current * 1.5, MAX_POLL_MS);
      }
      if (!cancelled) timeoutId = setTimeout(tick, currentDelayRef.current);
    }

    timeoutId = setTimeout(tick, currentDelayRef.current);
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [isPaused, tab, fetchHttpDelta, fetchSystemDelta]);

  // Snap back to fast polling on refocus rather than making the user wait out
  // accumulated backoff. Respects pause for the same reason the loop does.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden || isPaused) return;
      currentDelayRef.current = MIN_POLL_MS;
      if (tab === "http") void fetchHttpDelta();
      else void fetchSystemDelta();
      void fetchEndpoints();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tab, isPaused, fetchHttpDelta, fetchSystemDelta, fetchEndpoints]);

  /* ---------------- Keyboard ---------------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        (tab === "http" ? httpSearchRef : sysSearchRef).current?.focus();
      } else if (e.key === "p") {
        setIsPaused((p) => !p);
      } else if (e.key === "1") {
        setTab("http");
      } else if (e.key === "2") {
        setTab("system");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tab]);

  /* ---------------- Derived: tools, suggestions, chips ---------------- */

  /**
   * Which paths are REAL, backend-registered tools — the only ones allowed
   * their own picker entry. One day of traffic produced ~300 distinct junk
   * paths; a hand-maintained pattern list can never keep pace. Unrecognized
   * traffic just has nowhere to go but "Other", automatically, forever.
   */
  const endpointOptions = useMemo(() => {
    const byPath = new Map<string, { path: string; label: string; count: number }>();
    for (const ep of knownEndpoints) {
      // Real all-time total. Counting LOADED rows made a tool showing 967
      // quietly become 233 after scrolling, which reads as "requests
      // disappeared".
      byPath.set(ep.path, { path: ep.path, label: ep.label, count: ep.total_requests ?? 0 });
    }

    let otherCount = 0;
    for (const log of httpLogs) {
      if (!log.path) continue;
      if (hideNoise && isNoise(log.path)) continue;
      if (!byPath.has(toolFamily(log.path))) otherCount += 1;
    }

    const all = [...byPath.values()];
    if (otherCount > 0) {
      all.push({ path: OTHER_TRAFFIC_KEY, label: "Other (unrecognized traffic)", count: otherCount });
    }

    const active = all.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
    const idle = all.filter((e) => e.count === 0).sort((a, b) => a.label.localeCompare(b.label));
    return [...active, ...idle];
  }, [httpLogs, hideNoise, knownEndpoints, noiseListVersion]);

  const pathSuggestions = useMemo(() => {
    const needle = pathFilter.trim().toLowerCase();
    if (!needle) return endpointOptions.slice(0, 8);
    return endpointOptions
      .filter((e) => e.label.toLowerCase().includes(needle) || e.path.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [endpointOptions, pathFilter]);

  const activeToolLabel = useMemo(() => {
    if (toolFilter) return toolOptions.find((t) => t.tool === toolFilter)?.label ?? toolFilter;
    if (endpointFilter) return endpointOptions.find((e) => e.path === endpointFilter)?.label ?? endpointFilter;
    return null;
  }, [toolFilter, endpointFilter, toolOptions, endpointOptions]);

  const resetFilters = useCallback(() => {
    setMethodFilter("");
    setEndpointFilter("");
    setDateFilter("all");
    setStatusClassFilter("all");
    setHideNoise(true);
    setPathFilter("");
    setToolFilter("");
    setTierFilter("");
  }, []);

  // Deviations from DEFAULT, not merely non-empty values: hideNoise defaults
  // on, so having it on isn't a filter you applied — turning it off is.
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (activeToolLabel) {
      chips.push({ key: "tool", label: activeToolLabel, clear: () => { setToolFilter(""); setEndpointFilter(""); } });
    }
    if (methodFilter) chips.push({ key: "method", label: methodFilter, clear: () => setMethodFilter("") });
    if (tierFilter) {
      chips.push({ key: "tier", label: tierFilter === "hq" ? "HQ only" : "Standard only", clear: () => setTierFilter("") });
    }
    if (statusClassFilter !== "all") {
      chips.push({ key: "status", label: `${statusClassFilter} only`, clear: () => setStatusClassFilter("all") });
    }
    if (dateFilter !== "all") {
      chips.push({ key: "date", label: dateFilter === "today" ? "Today" : "Yesterday", clear: () => setDateFilter("all") });
    }
    if (pathFilter) chips.push({ key: "q", label: `“${pathFilter}”`, clear: () => setPathFilter("") });
    if (!hideNoise) chips.push({ key: "noise", label: "Noise shown", clear: () => setHideNoise(true) });
    return chips;
  }, [activeToolLabel, methodFilter, tierFilter, statusClassFilter, dateFilter, pathFilter, hideNoise]);

  const sysActiveFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (levelFilter) chips.push({ key: "level", label: levelFilter, clear: () => setLevelFilter("") });
    if (sysToolFilter) {
      chips.push({
        key: "tool",
        label: toolOptions.find((t) => t.tool === sysToolFilter)?.label ?? sysToolFilter,
        clear: () => setSysToolFilter(""),
      });
    }
    if (sysTierFilter) {
      chips.push({ key: "tier", label: sysTierFilter === "hq" ? "HQ only" : "Standard only", clear: () => setSysTierFilter("") });
    }
    if (systemSearch) chips.push({ key: "q", label: `“${systemSearch}”`, clear: () => setSystemSearch("") });
    return chips;
  }, [levelFilter, sysToolFilter, sysTierFilter, systemSearch, toolOptions]);

  const resetSysFilters = useCallback(() => {
    setLevelFilter("");
    setSysToolFilter("");
    setSysTierFilter("");
    setSystemSearch("");
  }, []);

  /**
   * Groups CONSECUTIVE lines sharing a request_id into one visual unit. A
   * single download logs 20+ lines; showing every one at full height recreates
   * the "too much scrolling to find anything" problem. Show what started and
   * what it ended as, fold the rest.
   *
   * Lines with no request_id never merge even when adjacent: sharing "-"
   * doesn't mean two lines are related, it means neither carries one.
   */
  const systemGroups = useMemo<SystemGroup[]>(() => {
    const groups: SystemGroup[] = [];
    for (const entry of filteredSystemLogs) {
      const prev = groups[groups.length - 1];
      const prevEntry = prev?.entries[prev.entries.length - 1];
      const id = realId(entry.request_id);
      if (prevEntry && id && id === realId(prevEntry.request_id)) prev.entries.push(entry);
      else groups.push({ key: `g${entry.id}`, entries: [entry] });
    }
    return groups;
  }, [filteredSystemLogs]);

  // Keyed by the group's own key, not request_id: an id can recur across
  // separate groups (retrying the same video later) and those expand
  // independently.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Trimmed groups leave their keys behind forever otherwise — a slow leak on a
  // dashboard designed to be left open all day.
  useEffect(() => {
    setExpandedGroups((prev) => {
      if (prev.size < 200) return prev;
      const live = new Set(systemGroups.map((g) => g.key));
      const next = new Set([...prev].filter((k) => live.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [systemGroups]);

  /* ---------------- Destructive actions ---------------- */

  const requestDelete = useCallback((olderThanDays: number | null) => {
    setToast(null);
    setPendingDelete(olderThanDays);
  }, []);

  async function confirmDelete() {
    if (pendingDelete === "none") return;
    const olderThanDays = pendingDelete;
    setDeleteRunning(true);
    try {
      const url = olderThanDays ? `/api/admin/logs?olderThanDays=${olderThanDays}` : `/api/admin/logs`;
      const res = await fetch(url, { method: "DELETE", signal: signal() });
      if (res.status === 401) { router.push("/admin/login"); return; }
      const data = await res.json().catch(() => null);
      // A 500 returning HTML parses to null and used to report success.
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      const n = data?.deleted_http_logs ?? 0;
      setToast({
        tone: "ok",
        text:
          `Removed ${n.toLocaleString()} HTTP log ${n === 1 ? "entry" : "entries"}` +
          (data?.system_buffer_cleared ? " and cleared the system log buffer." : "."),
      });
      httpSigRef.current = "";
      sysSigRef.current = "";
      httpLastIdRef.current = 0;
      sysLastIdRef.current = 0;
      httpSeededRef.current = false;
      sysSeededRef.current = false;
      httpOldestRef.current = 0;
      sysOldestRef.current = 0;
      httpPinnedRef.current = true;
      sysPinnedRef.current = true;
      currentDelayRef.current = MIN_POLL_MS;
      void fetchHttp(true);
      void fetchSystem(true);
    } catch (e) {
      if (!isAbort(e)) setToast({ tone: "bad", text: `Couldn't delete: ${(e as Error).message}` });
    } finally {
      setDeleteRunning(false);
      setPendingDelete("none");
    }
  }

  async function handleManualRefresh() {
    setIsRefreshing(true);
    currentDelayRef.current = MIN_POLL_MS;
    // Minimum spin so the button reads as having done something even when the
    // response is instant.
    const minSpin = new Promise((r) => setTimeout(r, 350));
    try {
      await Promise.all([fetchHttp(true), fetchSystem(true), fetchEndpoints(), minSpin]);
    } finally {
      setIsRefreshing(false);
    }
  }

  const actionBar = (
    <ActionBar
      isPaused={isPaused}
      onTogglePause={() => setIsPaused((p) => !p)}
      onRefresh={handleManualRefresh}
      isRefreshing={isRefreshing}
      manageOpen={manageOpen}
      setManageOpen={setManageOpen}
      onDelete={requestDelete}
    />
  );

  const httpRows = filtered.slice(httpWin.start, httpWin.end);

  /* =================================================================
     Render
     ================================================================= */

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3.5 px-3 py-4 sm:px-6 sm:py-5">
      {/* ===== Heading ===== */}
      <header className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Request logs</h1>
          <LiveStatus isPaused={isPaused} lastUpdatedAt={lastUpdatedAt} />
        </div>
        <div
          role="tablist"
          aria-label="Log source"
          className="flex self-start rounded-lg border border-graphite-800 bg-graphite-900 p-0.5 sm:self-auto"
        >
          <TabButton active={tab === "http"} onClick={() => setTab("http")} icon={Activity} label="HTTP" />
          <TabButton active={tab === "system"} onClick={() => setTab("system")} icon={Terminal} label="System" />
        </div>
      </header>

      {/* ===== Stats — HTTP only =====
          4xx is amber as a mild "worth a glance": it's normal traffic (bots,
          rate limits, rejected uploads). 5xx turns red only above zero, and is
          the one worth investigating. */}
      <div
        className={cn(
          "grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl border border-graphite-800 bg-graphite-800 sm:grid-cols-4",
          tab !== "http" && "hidden"
        )}
      >
        <Stat label="Total" value={totals.total} />
        <Stat label="Success" value={totals.success} valueClass="text-teal-400" />
        <Stat
          label="Client errors"
          value={totals.client}
          valueClass="text-amber-400"
          hint="4xx — rejected requests: rate limits, bad uploads, bots probing routes. Normal, not a bug."
        />
        <Stat
          label="Server errors"
          value={totals.server}
          valueClass={totals.server > 0 ? "text-red-400" : ""}
          hint="5xx — the backend broke. Check the System tab if this is above zero."
        />
      </div>

      {/* ===== HTTP panel =====
          Kept MOUNTED when the System tab is showing. That is what preserves
          scroll position, the loaded window, and the poll cursors across a tab
          switch — and what stopped the feed jumping to the top after a detour
          through the correlated view.
          NOTE: no overflow-hidden — it would clip the Delete menu. */}
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col rounded-xl border border-graphite-800 bg-graphite-900",
          tab !== "http" && "hidden"
        )}
      >
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-graphite-800 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <SearchBox
              inputRef={httpSearchRef}
              value={pathFilter}
              onChange={(v) => { setPathFilter(v); setSuggestOpen(true); setHighlightIndex(-1); }}
              onClear={() => { setPathFilter(""); setHighlightIndex(-1); }}
              // Global search, not path-only: the backend's `q` spans path, IP,
              // method, request id, tool tag and a bare 3-digit status.
              placeholder="Search path, IP, status, tool…"
              combobox={{
                open: suggestOpen && pathSuggestions.length > 0,
                setOpen: setSuggestOpen,
                highlightIndex,
                setHighlightIndex,
                suggestions: pathSuggestions,
                onPick: (path) => {
                  // Sets the EXACT tool filter, not a fuzzy substring — picking
                  // "Convert" from a list of tools should mean that tool.
                  setEndpointFilter(path);
                  setPathFilter("");
                  setSuggestOpen(false);
                  setHighlightIndex(-1);
                },
              }}
            />

            {/* Mobile: collapse the filter row behind one button. The badge
                shows how many are active, so a filtered view is never silently
                hidden behind a closed panel. */}
            <button
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors sm:hidden",
                FOCUS_RING,
                filtersOpen || activeFilters.length > 0
                  ? "border-amber-500/50 text-amber-400"
                  : "border-graphite-700 text-text-muted"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilters.length > 0 && (
                <span className="ml-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold tabular-nums text-graphite-950">
                  {activeFilters.length}
                </span>
              )}
            </button>

            <div className="hidden h-5 w-px bg-graphite-800 sm:block" />
            {actionBar}
          </div>

          <div className={cn("flex-wrap items-center gap-2 sm:flex", filtersOpen ? "flex" : "hidden")}>
            <Select
              value={methodFilter}
              onChange={setMethodFilter}
              placeholder="Any method"
              options={[
                { value: "", label: "Any method" },
                { value: "GET", label: "GET" },
                { value: "POST", label: "POST" },
                { value: "DELETE", label: "DELETE" },
              ]}
            />

            {/* ONE tool picker, two sections — not two dropdowns both reading
                "All tools", which was genuinely ambiguous: nothing said one
                meant "the tool the backend tagged this as" and the other meant
                "the URL shape it hit". */}
            <ToolPicker
              toolOptions={toolOptions}
              endpointOptions={endpointOptions}
              toolFilter={toolFilter}
              endpointFilter={endpointFilter}
              activeLabel={activeToolLabel}
              onPickTool={(t) => { setToolFilter(t); setEndpointFilter(""); }}
              onPickFamily={(p) => { setEndpointFilter(p); setToolFilter(""); }}
              onClear={() => { setToolFilter(""); setEndpointFilter(""); }}
            />

            <Select
              value={tierFilter}
              onChange={setTierFilter}
              label="Tier"
              placeholder="Any"
              options={[
                { value: "" as Tier, label: "Any" },
                { value: "standard" as Tier, label: "Standard" },
                { value: "hq" as Tier, label: "HQ" },
              ]}
            />
            <Select
              value={dateFilter}
              onChange={setDateFilter}
              placeholder="Any date"
              options={[
                { value: "all" as DateFilter, label: "Any date" },
                { value: "today" as DateFilter, label: "Today" },
                { value: "yesterday" as DateFilter, label: "Yesterday" },
              ]}
            />
            <div role="group" aria-label="Status class" className="flex rounded-lg border border-graphite-700 bg-graphite-850 p-0.5">
              <StatusChip active={statusClassFilter === "all"} onClick={() => setStatusClassFilter("all")} label="All" />
              <StatusChip active={statusClassFilter === "4xx"} onClick={() => setStatusClassFilter("4xx")} label="4xx" tone="text-amber-400" />
              <StatusChip active={statusClassFilter === "5xx"} onClick={() => setStatusClassFilter("5xx")} label="5xx" tone="text-red-400" />
            </div>
            <label className="flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-md px-1 py-1 text-sm text-text-muted transition-colors hover:text-text-primary">
              <input
                type="checkbox"
                checked={hideNoise}
                onChange={(e) => setHideNoise(e.target.checked)}
                className={cn("accent-amber-500", FOCUS_RING)}
              />
              Hide noise
            </label>
          </div>

          {activeFilters.length > 0 && <FilterChips chips={activeFilters} onClearAll={resetFilters} />}
        </div>

        {/* Column header lives OUTSIDE the scroller. Rows are absolutely
            positioned inside a spacer, so a sticky <thead> has nothing to stick
            to — and this alignment is exact because both use HTTP_COLS. */}
        {!isMobile && (
          <div
            className="grid shrink-0 items-center gap-x-3 border-b border-graphite-800 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle"
            style={{ gridTemplateColumns: HTTP_COLS }}
          >
            <span>Time</span>
            <span>Method</span>
            <span>Path</span>
            <span>Status</span>
            <span className="text-right">Duration</span>
            <span>Client IP</span>
            <span />
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <div
            ref={httpRef}
            onScroll={handleHttpScroll}
            className="af-scroll h-full overflow-y-auto overscroll-contain"
          >
            <TopSentinel
              loading={httpLoadingOlder}
              hasOlder={httpHasOlder}
              count={filtered.length}
              total={httpFilteredTotal}
            />

            {/* The virtual window. Total height is exact (count * rowH), so the
                scrollbar is honest even though only ~40 rows exist. */}
            <div style={{ height: filtered.length * rowH }} className="relative">
              <div style={{ transform: `translateY(${httpWin.start * rowH}px)` }} className="absolute inset-x-0 top-0">
                {httpRows.map((log) =>
                  isMobile ? (
                    <HttpCardRow key={log.id} log={log} onOpen={openFromHttpRow} />
                  ) : (
                    <HttpTableRow key={log.id} log={log} onOpen={openFromHttpRow} />
                  )
                )}
              </div>
            </div>

            <ListState
              loading={httpLoading && httpLogs.length === 0}
              error={httpError}
              empty={filtered.length === 0}
              emptyTitle={httpLogs.length === 0 && activeFilters.length === 0 ? "Nothing logged yet" : "No matching requests"}
              emptyBody={
                activeFilters.length > 0
                  ? "Nothing in the whole table matches these filters."
                  : "Requests will appear here as they arrive."
              }
              onClearFilters={activeFilters.length > 0 ? resetFilters : undefined}
              onRetry={httpError ? () => void fetchHttp(true) : undefined}
              skeletonRows={httpLoading && httpLogs.length === 0 ? 10 : 0}
              rowH={rowH}
            />
          </div>
          {showJumpHttp && <JumpButton onClick={jumpToBottomHttp} />}
        </div>

        <Footer
          loaded={filtered.length}
          // The "Other" bucket is filtered client-side, so the server's
          // filtered_total counts rows this view is deliberately hiding.
          matching={otherBucketActive ? null : httpFilteredTotal}
          total={httpTotal}
        />
      </section>

      {/* ===== System panel — also always mounted ===== */}
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900",
          tab !== "system" && "hidden"
        )}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-graphite-800 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <p className="text-sm text-text-muted">
            System log
            {sysTotal > 0 && (
              <span className="tabular-nums text-text-subtle">
                {" · "}{systemLogs.length.toLocaleString()} of {sysFilteredTotal.toLocaleString()} matching
              </span>
            )}
          </p>
          <div className="flex items-center gap-1.5 sm:gap-2">{actionBar}</div>
        </div>

        <div className="flex shrink-0 flex-col gap-2.5 border-b border-graphite-800 px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              inputRef={sysSearchRef}
              value={systemSearch}
              onChange={setSystemSearch}
              onClear={() => setSystemSearch("")}
              placeholder="Search message, logger, request id, tool…"
            />
            <Select
              value={levelFilter}
              onChange={setLevelFilter}
              placeholder="Any level"
              options={[
                { value: "", label: "Any level" },
                { value: "ERROR", label: "ERROR" },
                { value: "CRITICAL", label: "CRITICAL" },
                { value: "WARNING", label: "WARNING" },
                { value: "INFO", label: "INFO" },
              ]}
            />
            <Select
              value={sysToolFilter}
              onChange={setSysToolFilter}
              placeholder="All tools"
              options={[{ value: "", label: "All tools" }, ...toolOptions.map((t) => ({ value: t.tool, label: t.label }))]}
            />
            <Select
              value={sysTierFilter}
              onChange={setSysTierFilter}
              label="Tier"
              placeholder="Any"
              options={[
                { value: "" as Tier, label: "Any" },
                { value: "standard" as Tier, label: "Standard" },
                { value: "hq" as Tier, label: "HQ" },
              ]}
            />
          </div>
          {sysActiveFilters.length > 0 && <FilterChips chips={sysActiveFilters} onClearAll={resetSysFilters} />}
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={sysRef}
            onScroll={handleSysScroll}
            className="af-scroll h-full overflow-y-auto overscroll-contain font-mono text-xs"
          >
            <TopSentinel loading={sysLoadingOlder} hasOlder={sysHasOlder} count={systemLogs.length} total={sysFilteredTotal} />
            {systemGroups.map((group, index) => (
              <SystemGroupBlock
                key={group.key}
                group={group}
                isFirst={index === 0}
                expanded={expandedGroups.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
                onOpenEntry={openFromSystemRow}
              />
            ))}
            <ListState
              loading={systemLoading && systemLogs.length === 0}
              error={systemError}
              empty={filteredSystemLogs.length === 0}
              emptyTitle={systemLogs.length === 0 && sysActiveFilters.length === 0 ? "Nothing logged yet" : "No matching lines"}
              emptyBody={
                sysActiveFilters.length > 0
                  ? "Nothing in the whole buffer matches these filters."
                  : "Application events will appear here as they happen."
              }
              onClearFilters={sysActiveFilters.length > 0 ? resetSysFilters : undefined}
              onRetry={systemError ? () => void fetchSystem(true) : undefined}
              skeletonRows={systemLoading && systemLogs.length === 0 ? 8 : 0}
              rowH={56}
            />
          </div>
          {showJumpSys && <JumpButton onClick={jumpToBottomSys} />}
        </div>
      </section>

      {correlation && (
        <CorrelationDrawer
          correlation={correlation}
          logs={correlatedLogs}
          loading={correlatedLoading}
          error={correlatedError}
          onClose={closeCorrelation}
        />
      )}

      {pendingDelete !== "none" && (
        <ConfirmDialog
          title={
            pendingDelete === null
              ? "Delete all logs?"
              : `Delete logs older than ${pendingDelete} day${pendingDelete === 1 ? "" : "s"}?`
          }
          body={
            pendingDelete === null
              ? "This removes every HTTP log entry and clears the system log buffer. It can't be undone."
              : `This removes HTTP log entries older than ${pendingDelete} day${pendingDelete === 1 ? "" : "s"}. It can't be undone.`
          }
          confirmLabel={pendingDelete === null ? "Delete all logs" : "Delete"}
          loading={deleteRunning}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete("none")}
        />
      )}

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      <style
        dangerouslySetInnerHTML={{
          __html: `
.af-scroll { scrollbar-width: thin; scrollbar-color: rgb(120 113 108 / .45) transparent; }
.af-scroll::-webkit-scrollbar { width: 11px; height: 11px; }
.af-scroll::-webkit-scrollbar-track { background: transparent; }
.af-scroll::-webkit-scrollbar-thumb {
  background: rgb(120 113 108 / .38); border-radius: 99px;
  border: 3px solid transparent; background-clip: content-box;
}
.af-scroll::-webkit-scrollbar-thumb:hover { background: rgb(245 158 11 / .5); background-clip: content-box; }
@keyframes af-slide { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
.af-slide { animation: af-slide .18s cubic-bezier(.22,.9,.32,1) both; }
@media (prefers-reduced-motion: reduce) { .af-slide { animation: none; } }
`,
        }}
      />
    </div>
  );
}

/* ===================================================================
   Header pieces
   =================================================================== */

/** Live/paused plus how fresh the data is. A feed that shows no rows for a
 *  minute is indistinguishable from a broken one without this. */
function LiveStatus({ isPaused, lastUpdatedAt }: { isPaused: boolean; lastUpdatedAt: number | null }) {
  useTicker(!isPaused && lastUpdatedAt !== null, 5000);
  return (
    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-subtle">
      <span className="relative flex h-1.5 w-1.5">
        {!isPaused && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60 motion-reduce:hidden" />
        )}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", isPaused ? "bg-amber-500" : "bg-teal-400")} />
      </span>
      {isPaused ? "Paused" : "Live"}
      {lastUpdatedAt && <span className="text-text-subtle/80">· updated {fmtAgo(Date.now() - lastUpdatedAt)}</span>}
    </p>
  );
}

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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
        FOCUS_RING,
        active ? "bg-graphite-800 text-text-primary" : "text-text-muted hover:text-text-primary"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && "text-amber-500")} />
      {label}
    </button>
  );
}

function Stat({
  label, value, valueClass = "", hint,
}: {
  label: string;
  value: number;
  valueClass?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 bg-graphite-900 px-3 py-3.5 sm:px-5" title={hint}>
      <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", valueClass || "text-text-primary")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ===================================================================
   Controls
   =================================================================== */

function ActionBar({
  isPaused, onTogglePause, onRefresh, isRefreshing, manageOpen, setManageOpen, onDelete,
}: {
  isPaused: boolean;
  onTogglePause: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  manageOpen: boolean;
  setManageOpen: (v: boolean) => void;
  onDelete: (days: number | null) => void;
}) {
  useEscape(manageOpen, () => setManageOpen(false));
  return (
    <>
      <IconAction
        onClick={onTogglePause}
        icon={isPaused ? Play : Pause}
        label={isPaused ? "Resume" : "Pause"}
        hint={isPaused ? "Resume live updates (P)" : "Pause live updates (P)"}
        highlight={isPaused}
      />
      <IconAction
        onClick={onRefresh}
        icon={RefreshCw}
        label={isRefreshing ? "Refreshing…" : "Refresh"}
        spinning={isRefreshing}
        disabled={isRefreshing}
      />
      <div className="relative">
        <IconAction onClick={() => setManageOpen(!manageOpen)} icon={Trash2} label="Delete" highlight={manageOpen} expanded={manageOpen} />
        {manageOpen && (
          <>
            <button aria-hidden tabIndex={-1} onClick={() => setManageOpen(false)} className="fixed inset-0 z-20 cursor-default" />
            <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-48 overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl">
              <MenuItem onClick={() => { setManageOpen(false); onDelete(1); }}>Older than 1 day</MenuItem>
              <MenuItem onClick={() => { setManageOpen(false); onDelete(7); }}>Older than 7 days</MenuItem>
              <MenuItem danger onClick={() => { setManageOpen(false); onDelete(null); }}>Delete all logs</MenuItem>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function IconAction({
  onClick, icon: Icon, label, hint, highlight = false, spinning = false, disabled = false, expanded,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  highlight?: boolean;
  spinning?: boolean;
  disabled?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint ?? label}
      aria-label={label}
      aria-expanded={expanded}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        FOCUS_RING,
        highlight
          ? "border-amber-500/50 text-amber-400"
          : "border-graphite-700 text-text-muted hover:bg-graphite-850 hover:text-text-primary"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin motion-reduce:animate-none")} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function MenuItem({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        "w-full px-3.5 py-2 text-left text-xs transition-colors",
        FOCUS_RING,
        danger ? "text-red-400 hover:bg-red-500/10" : "text-text-muted hover:bg-graphite-800 hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}

type Suggestion = { path: string; label: string; count: number };

function SearchBox({
  inputRef, value, onChange, onClear, placeholder, combobox,
}: {
  // React 19 types useRef<T>(null) as RefObject<T | null>; widening here stays
  // assignable under React 18's types too.
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  placeholder: string;
  combobox?: {
    open: boolean;
    setOpen: (v: boolean) => void;
    highlightIndex: number;
    setHighlightIndex: (fn: number | ((i: number) => number)) => void;
    suggestions: Suggestion[];
    onPick: (path: string) => void;
  };
}) {
  const listId = "search-suggestions";
  const c = combobox;

  return (
    <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" />
      <input
        // Cast keeps this compiling under both React 18 and 19 typings, which
        // disagree about whether useRef<T>(null) yields RefObject<T | null>.
        ref={inputRef as React.Ref<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => c?.setOpen(true)}
        // Delayed so a mousedown on a suggestion still lands — blur fires first
        // otherwise and the list is gone before the click resolves.
        onBlur={() => c && setTimeout(() => c.setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (c?.open) { c.setOpen(false); c.setHighlightIndex(-1); }
            else e.currentTarget.blur();
            return;
          }
          if (!c || !c.open || c.suggestions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            c.setHighlightIndex((i) => (i + 1) % c.suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            c.setHighlightIndex((i) => (i <= 0 ? c.suggestions.length - 1 : i - 1));
          } else if (e.key === "Enter") {
            // Only hijack Enter when something is highlighted; otherwise the
            // typed text stands.
            if (c.highlightIndex >= 0) {
              e.preventDefault();
              c.onPick(c.suggestions[c.highlightIndex].path);
            } else {
              c.setOpen(false);
              c.setHighlightIndex(-1);
            }
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        role={c ? "combobox" : undefined}
        aria-expanded={c ? c.open : undefined}
        aria-controls={c ? listId : undefined}
        aria-autocomplete={c ? "list" : undefined}
        aria-activedescendant={c && c.open && c.highlightIndex >= 0 ? `${listId}-${c.highlightIndex}` : undefined}
        className={cn(
          "w-full rounded-lg border border-graphite-700 bg-graphite-850 py-1.5 pl-9 pr-9 text-sm text-text-primary transition-colors placeholder:text-text-subtle hover:border-graphite-600 focus:border-amber-500/60",
          FOCUS_RING
        )}
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary",
            FOCUS_RING
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {c?.open && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl"
        >
          {!value.trim() && (
            <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">Busiest tools</p>
          )}
          {c.suggestions.map((sug, i) => (
            <button
              key={sug.path}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === c.highlightIndex}
              // mousedown, not click: fires before the input's blur, so the
              // selection isn't lost to the dropdown unmounting first.
              onMouseDown={(e) => { e.preventDefault(); c.onPick(sug.path); }}
              onMouseEnter={() => c.setHighlightIndex(i)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors",
                i === c.highlightIndex ? "bg-graphite-800" : "hover:bg-graphite-800"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate text-xs text-text-primary">{sug.label}</span>
                <span className="block truncate font-mono text-[10px] text-text-subtle">{sug.path}</span>
              </span>
              {sug.count > 0 && (
                <span className="shrink-0 text-[11px] tabular-nums text-text-subtle">{sug.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One dropdown for the whole dashboard, replacing native <select>. A native
 * select's OPEN list is drawn by the OS, so no CSS this app owns reaches it —
 * its radius, focus ring, scrollbar and hover states are the platform's, not
 * the design system's. Focus stays on the trigger and moves via
 * aria-activedescendant, which keeps Escape/Tab predictable.
 */
function Select<T extends string>({
  value, options, onChange, placeholder, label, widthClass = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  placeholder: string;
  /** Static prefix shown before the value, e.g. "Tier". */
  label?: string;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useStableId("select");

  useEscape(open, () => setOpen(false));

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  const selected = options.find((o) => o.value === value);
  const isSet = !!value;

  return (
    <div className={cn("relative shrink-0", widthClass)}>
      <button
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
            return;
          }
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(options[active].value);
            setOpen(false);
          } else if (e.key === "Tab") {
            setOpen(false);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-graphite-850 px-2.5 py-1.5 text-left text-sm transition-colors",
          FOCUS_RING,
          open
            ? "border-amber-500/60 text-text-primary"
            : isSet
              ? "border-graphite-600 text-text-primary hover:border-graphite-500"
              : "border-graphite-700 text-text-muted hover:border-graphite-600"
        )}
      >
        <span className="truncate">
          {label && <span className="text-text-subtle">{label}: </span>}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-text-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default" />
          <div
            id={listId}
            role="listbox"
            className="af-scroll absolute left-0 top-full z-30 mt-1 max-h-72 min-w-full overflow-y-auto rounded-lg border border-graphite-700 bg-graphite-850 py-1 shadow-xl"
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 whitespace-nowrap px-3 py-1.5 text-left text-sm transition-colors",
                  i === active ? "bg-graphite-800 text-text-primary" : "text-text-muted"
                )}
              >
                {o.label}
                {o.value === value && <Check className="h-3 w-3 shrink-0 text-amber-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Stable per-instance id for aria wiring. Named useStableId rather than useId
 *  so it can't shadow React's own export the day someone imports it here. */
let _idSeq = 0;
function useStableId(prefix: string): string {
  const ref = useRef<string | null>(null);
  if (!ref.current) ref.current = `${prefix}-${++_idSeq}`;
  return ref.current;
}

/** The merged tool picker: tagged tools first, path families below. Filterable,
 *  because with ~25 tools plus families the list is long enough that scanning
 *  beats scrolling. */
function ToolPicker({
  toolOptions, endpointOptions, toolFilter, endpointFilter, activeLabel, onPickTool, onPickFamily, onClear,
}: {
  toolOptions: ToolCount[];
  endpointOptions: { path: string; label: string; count: number }[];
  toolFilter: string;
  endpointFilter: string;
  activeLabel: string | null;
  onPickTool: (tool: string) => void;
  onPickFamily: (path: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useStableId("toolpicker");

  useEscape(open, () => setOpen(false));

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const needle = query.trim().toLowerCase();
  const tools = useMemo(
    () => (needle ? toolOptions.filter((t) => t.label.toLowerCase().includes(needle)) : toolOptions),
    [toolOptions, needle]
  );
  const families = useMemo(
    () =>
      needle
        ? endpointOptions.filter((e) => e.label.toLowerCase().includes(needle) || e.path.toLowerCase().includes(needle))
        : endpointOptions,
    [endpointOptions, needle]
  );

  // Flat nav list so arrow keys cross the section boundary the way the eye does.
  type Row =
    | { kind: "all" }
    | { kind: "tool"; tool: ToolCount }
    | { kind: "family"; family: { path: string; label: string; count: number } };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (!needle) out.push({ kind: "all" });
    tools.forEach((tool) => out.push({ kind: "tool", tool }));
    families.forEach((family) => out.push({ kind: "family", family }));
    return out;
  }, [tools, families, needle]);

  function commit(row: Row) {
    if (row.kind === "all") onClear();
    else if (row.kind === "tool") onPickTool(row.tool.tool);
    else onPickFamily(row.family.path);
    setOpen(false);
  }

  return (
    <div className="relative min-w-0 flex-1 sm:w-[240px] sm:flex-none">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={activeLabel ?? "Filter by tool, or by URL path family"}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border bg-graphite-850 px-2.5 py-1.5 text-left text-sm transition-colors",
          FOCUS_RING,
          open
            ? "border-amber-500/60 text-text-primary"
            : activeLabel
              ? "border-graphite-600 text-text-primary hover:border-graphite-500"
              : "border-graphite-700 text-text-muted hover:border-graphite-600"
        )}
      >
        <span className="truncate">{activeLabel ?? "All tools"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-text-subtle transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default" />
          <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl sm:right-auto sm:min-w-[300px]">
            <div className="border-b border-graphite-800 p-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((i) => (i + 1) % Math.max(rows.length, 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((i) => (i <= 0 ? rows.length - 1 : i - 1));
                  } else if (e.key === "Enter" && rows[active]) {
                    e.preventDefault();
                    commit(rows[active]);
                  }
                }}
                placeholder="Filter tools…"
                aria-label="Filter tools"
                aria-controls={listId}
                aria-activedescendant={`${listId}-${active}`}
                className={cn(
                  "w-full rounded-md border border-graphite-700 bg-graphite-900 px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-subtle",
                  FOCUS_RING
                )}
              />
            </div>

            <div id={listId} role="listbox" className="af-scroll max-h-72 overflow-y-auto py-1">
              {rows.length === 0 && <p className="px-3 py-3 text-center text-xs text-text-subtle">No tools match.</p>}
              {rows.map((row, i) => {
                const isActive = i === active;
                const common = cn(
                  "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors",
                  isActive && "bg-graphite-800"
                );

                if (row.kind === "all") {
                  const selected = !toolFilter && !endpointFilter;
                  return (
                    <button
                      key="all"
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => commit(row)}
                      className={cn(common, "text-sm", selected ? "text-text-primary" : "text-text-muted")}
                    >
                      All tools
                      {selected && <Check className="h-3 w-3 shrink-0 text-amber-500" />}
                    </button>
                  );
                }

                if (row.kind === "tool") {
                  const t = row.tool;
                  const selected = toolFilter === t.tool;
                  const first = rows[i - 1]?.kind !== "tool";
                  return (
                    <div key={`tool:${t.tool}`}>
                      {first && <PickerSection>Tools</PickerSection>}
                      <button
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={selected}
                        title={`${t.total.toLocaleString()} requests${t.hq_count > 0 ? ` · ${t.hq_count.toLocaleString()} HQ` : ""}`}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => commit(row)}
                        className={common}
                      >
                        <span className="truncate text-sm text-text-primary">{t.label}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {t.hq_count > 0 && (
                            <span className="rounded border border-amber-500/30 bg-amber-500/15 px-1 py-px text-[9px] font-semibold uppercase text-amber-400">
                              HQ
                            </span>
                          )}
                          <span className="text-[11px] tabular-nums text-text-subtle">{t.total.toLocaleString()}</span>
                          {selected && <Check className="h-3 w-3 text-amber-500" />}
                        </span>
                      </button>
                    </div>
                  );
                }

                const e = row.family;
                const selected = endpointFilter === e.path;
                const isOther = e.path === OTHER_TRAFFIC_KEY;
                const first = rows[i - 1]?.kind !== "family";
                return (
                  <div key={`fam:${e.path}`}>
                    {first && <PickerSection>By URL path</PickerSection>}
                    <button
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      title={
                        isOther
                          ? `${e.count.toLocaleString()} requests to paths that aren't a registered tool — mostly scanner traffic`
                          : `${e.label}\n${e.path}\n${e.count > 0 ? `${e.count.toLocaleString()} requests all-time` : "No traffic yet"}`
                      }
                      onMouseEnter={() => setActive(i)}
                      onClick={() => commit(row)}
                      className={common}
                    >
                      <span className="min-w-0">
                        <span className={cn("block truncate text-sm", isOther ? "italic text-text-muted" : "text-text-primary")}>
                          {e.label}
                        </span>
                        {!isOther && <span className="block truncate font-mono text-[10px] text-text-subtle">{e.path}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {e.count > 0 && <span className="text-[11px] tabular-nums text-text-subtle">{e.count.toLocaleString()}</span>}
                        {selected && <Check className="h-3 w-3 text-amber-500" />}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Non-interactive. Exists so "Tools" and "By URL path" read as two different
 *  kinds of thing rather than one undifferentiated list. */
function PickerSection({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 border-t border-graphite-800 px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle first:mt-0 first:border-t-0">
      {children}
    </p>
  );
}

function StatusChip({ active, onClick, label, tone = "" }: { active: boolean; onClick: () => void; label: string; tone?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-2.5 py-1 text-xs font-medium transition-colors",
        FOCUS_RING,
        active ? cn("bg-graphite-700", tone || "text-text-primary") : cn("text-text-subtle hover:text-text-primary", tone)
      )}
    >
      {label}
    </button>
  );
}

/** What's actually filtering the view, each removable on its own. A lone
 *  "Clear" button tells you something is applied but not what. */
function FilterChips({
  chips, onClearAll,
}: {
  chips: { key: string; label: string; clear: () => void }[];
  onClearAll: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-graphite-700 bg-graphite-850 py-0.5 pl-2.5 pr-1 text-[11px] text-text-muted"
        >
          <span className="truncate">{chip.label}</span>
          <button
            onClick={chip.clear}
            aria-label={`Remove filter ${chip.label}`}
            className={cn("rounded-full p-0.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary", FOCUS_RING)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          onClick={onClearAll}
          className={cn("rounded-md px-2 py-0.5 text-[11px] text-text-subtle transition-colors hover:text-text-primary", FOCUS_RING)}
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(text)) setCopied(true);
      }}
      aria-label={label}
      title={label}
      className={cn("shrink-0 rounded p-0.5 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary", FOCUS_RING)}
    >
      {copied ? <Check className="h-3 w-3 text-teal-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/* ===================================================================
   List chrome
   =================================================================== */

function JumpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-medium text-graphite-950 shadow-lg transition-colors hover:bg-amber-400",
        FOCUS_RING
      )}
    >
      <ArrowDown className="h-3.5 w-3.5" />
      Jump to latest
    </button>
  );
}

/** Sits at the top of a log list. Older entries load automatically when the
 *  reader scrolls near it, so this reports status rather than being a button.
 *  Fixed height on purpose: the virtual window's offset math treats it as a
 *  constant, and a height that changed mid-load would shift every row. */
function TopSentinel({
  loading, hasOlder, count, total,
}: {
  loading: boolean;
  hasOlder: boolean;
  count: number;
  total: number;
}) {
  if (count === 0) return null;
  return (
    <div
      style={{ height: SENTINEL_H }}
      className="flex items-center justify-center border-b border-graphite-800/70 px-4 text-[11px] tabular-nums text-text-subtle"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
          Loading older entries…
        </span>
      ) : !hasOlder ? (
        <span>Beginning of the log · {count.toLocaleString()} entr{count === 1 ? "y" : "ies"} loaded</span>
      ) : (
        <span>
          Scroll up for older entries
          {total > count && <> · {count.toLocaleString()} of {total.toLocaleString()} loaded</>}
        </span>
      )}
    </div>
  );
}

function Footer({
  loaded, matching, total,
}: {
  loaded: number;
  /** null when the active filter is client-side and the server's match count
   *  would describe a different set of rows than what's shown. */
  matching: number | null;
  total: number;
}) {
  return (
    <div className="shrink-0 border-t border-graphite-800 px-4 py-2.5 text-xs tabular-nums text-text-subtle">
      {matching === null ? (
        <>Showing {loaded.toLocaleString()} loaded · counted in this window only</>
      ) : (
        <>
          Showing {loaded.toLocaleString()} of {matching.toLocaleString()} matching
          {matching < total && <> · {total.toLocaleString()} total</>}
        </>
      )}
    </div>
  );
}

/** Loading, error and empty in one place, so the two feeds can't drift apart on
 *  what a dead-end looks like. Empty states offer the way out rather than just
 *  naming the problem. */
function ListState({
  loading, error, empty, emptyTitle, emptyBody, onClearFilters, onRetry, skeletonRows, rowH,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle: string;
  emptyBody: string;
  onClearFilters?: () => void;
  onRetry?: () => void;
  skeletonRows: number;
  rowH: number;
}) {
  if (loading) {
    return (
      <div aria-hidden className="divide-y divide-graphite-800/60">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <div key={i} style={{ height: rowH }} className="flex items-center px-4">
            <span
              className="block h-2.5 animate-pulse rounded bg-graphite-800 motion-reduce:animate-none"
              style={{ width: `${45 + ((i * 13) % 40)}%` }}
            />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12" role="alert">
        <p className="text-center text-sm text-red-400">Couldn&apos;t load logs: {error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className={cn(
              "rounded-lg border border-graphite-700 px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary",
              FOCUS_RING
            )}
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  if (!empty) return null;
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <p className="font-sans text-sm text-text-muted">{emptyTitle}</p>
      <p className="max-w-xs font-sans text-xs text-text-subtle">{emptyBody}</p>
      {onClearFilters && (
        <button
          onClick={onClearFilters}
          className={cn(
            "mt-1 rounded-lg border border-graphite-700 px-3 py-1.5 font-sans text-xs text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary",
            FOCUS_RING
          )}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

/* ===================================================================
   Correlation drawer
   =================================================================== */

/**
 * The replacement for the old tab takeover. It floats above both feeds, so
 * opening and closing it changes nothing underneath: no remount, no refetch, no
 * scroll repair, no lost position in the HTTP list.
 */
function CorrelationDrawer({
  correlation, logs, loading, error, onClose,
}: {
  correlation: Correlation;
  logs: SystemLogEntry[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const { summary, scope, id } = correlation;

  return (
    <div role="dialog" aria-modal="true" aria-label="Correlated logs" className="fixed inset-0 z-50 flex justify-end">
      <button aria-hidden tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/50 backdrop-blur-[2px]" />
      <div
        ref={panelRef}
        className="af-slide relative flex h-full w-full flex-col border-l border-graphite-700 bg-graphite-900 shadow-2xl sm:w-[560px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-graphite-800 bg-amber-500/[0.05] px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-amber-400">
              {scope === "job" ? "Every log line for this job" : "Log lines for one request"}
            </p>
            {summary && (
              <p className="mt-0.5 truncate font-mono text-[11px] text-text-subtle">
                {summary.method} {summary.path} → {summary.status_code}
                {" · "}
                {npDate(summary.timestamp)} {npTime(summary.timestamp)}
              </p>
            )}
            <div className="mt-0.5 flex items-center gap-1">
              <span className="truncate font-mono text-[10px] text-text-subtle">
                {scope === "job" ? "job" : "request"} {id}
              </span>
              <CopyButton text={id} label="Copy id" />
              {!loading && (
                <span className="ml-1 text-[10px] tabular-nums text-text-subtle">
                  {logs.length} line{logs.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-lg border border-graphite-700 px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary",
              FOCUS_RING
            )}
          >
            <X className="h-3 w-3" />
            Close
          </button>
        </div>

        <div className="af-scroll min-h-0 flex-1 overflow-y-auto font-mono text-xs">
          {loading && (
            <p className="flex items-center justify-center gap-2 py-12 text-center text-sm text-text-subtle">
              <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              Loading…
            </p>
          )}
          {error && (
            <p className="px-4 py-12 text-center text-sm text-red-400" role="alert">
              Couldn&apos;t load: {error}
            </p>
          )}
          {!loading && !error && logs.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-text-subtle">
              No system log lines were recorded for this {scope === "job" ? "job" : "request"}.
            </p>
          )}
          {/* newGroup is always false: every line here belongs to the same
              request or job by construction. onOpenEntry is omitted because
              this view already shows exactly one — making its lines clickable
              would reload the identical view. */}
          {logs.map((entry) => (
            <SystemRow key={entry.id} entry={entry} newGroup={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   Dialogs
   =================================================================== */

function ConfirmDialog({
  title, body, confirmLabel, loading, onConfirm, onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEscape(!loading, onCancel);

  // Focus the panel and keep Tab inside it. A destructive confirm that lets
  // focus wander back to the page behind it is how you end up pressing Enter on
  // the wrong thing.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        aria-hidden
        tabIndex={-1}
        onClick={loading ? undefined : onCancel}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
      />
      <div ref={panelRef} className="relative flex w-full max-w-sm flex-col gap-3 rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-2xl sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <p id="confirm-title" className="text-sm font-semibold text-text-primary">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{body}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className={cn(
              "rounded-lg border border-graphite-700 px-3.5 py-2 text-xs text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary disabled:opacity-50 sm:py-1.5",
              FOCUS_RING
            )}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3.5 py-2 text-xs font-semibold text-graphite-950 transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60 sm:py-1.5",
              FOCUS_RING
            )}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Auto-dismisses on success; failures stay until acknowledged, since those are
 *  the ones you need to act on. */
function Toast({ toast, onDismiss }: { toast: { text: string; tone: "ok" | "bad" }; onDismiss: () => void }) {
  useEffect(() => {
    if (toast.tone !== "ok") return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-2.5 text-sm shadow-xl sm:bottom-5 sm:w-auto",
        toast.tone === "ok"
          ? "border-graphite-700 bg-graphite-850 text-text-primary"
          : "border-red-500/40 bg-graphite-850 text-red-400"
      )}
    >
      <span className="min-w-0 flex-1">{toast.text}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className={cn("shrink-0 text-text-subtle transition-colors hover:text-text-primary", FOCUS_RING)}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ===================================================================
   Rows
   =================================================================== */

/** Which tool/tier actually produced a row. Worth the pixels because the PATH
 *  frequently can't tell you: a /youtube/stems/status/<id> poll looks identical
 *  whether its job was standard or HQ. HQ is coloured; standard is deliberately
 *  not badged — tagging every ordinary row is noise on the 95% case. */
function ToolBadge({ tool, tier }: { tool?: string | null; tier?: string | null }) {
  const name = realId(tool);
  if (!name) return null;
  const isHq = tier === "hq";
  return (
    <span
      title={`Tool: ${name}${isHq ? " · Studio Quality (HQ)" : " · Standard"}`}
      className={cn(
        "shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
        isHq
          ? "border border-amber-500/30 bg-amber-500/15 text-amber-400"
          : "border border-graphite-700 bg-graphite-800 text-text-subtle"
      )}
    >
      {isHq ? "HQ" : name}
    </span>
  );
}

/** A row is worth clicking if either correlation route exists — a job id in the
 *  path (the whole job's story) or a real request id (that one request). */
function httpRowTarget(log: HttpLogEntry): "job" | "request" | null {
  if (jobIdFromPath(log.path)) return "job";
  if (realId(log.request_id)) return "request";
  return null;
}

// Log rows are immutable once written — same id means identical content, so a
// fresh fetch producing new-but-equal objects skips the re-render entirely.
const HttpTableRow = memo(
  function HttpTableRow({ log, onOpen }: { log: HttpLogEntry; onOpen: (log: HttpLogEntry) => void }) {
    const target = httpRowTarget(log);
    const clickable = target !== null;
    // See isTextSelected(): a drag-select ending over this row still fires a
    // click on mouseup. Bailing when a selection exists lets that click be a
    // no-op instead of yanking the user into the drawer.
    const open = () => { if (!isTextSelected()) onOpen(log); };

    return (
      <div
        onClick={clickable ? open : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(log); }
              }
            : undefined
        }
        tabIndex={clickable ? 0 : undefined}
        role={clickable ? "button" : undefined}
        aria-label={
          clickable
            ? `${log.method} ${log.path} returned ${log.status_code}. View ${target === "job" ? "this job's logs" : "this request's logs"}.`
            : undefined
        }
        title={clickable ? "View related system logs" : "No request id recorded for this row"}
        style={{ height: ROW_H_DESKTOP, gridTemplateColumns: HTTP_COLS }}
        className={cn(
          "group grid items-center gap-x-3 border-b border-graphite-800/50 px-4 text-[12.5px] transition-colors",
          FOCUS_RING,
          clickable ? "cursor-pointer hover:bg-graphite-850/70" : "opacity-60"
        )}
      >
        <span className="whitespace-nowrap tabular-nums text-text-muted">
          <span className="text-text-primary">{npTime(log.timestamp)}</span>
          <span className="ml-1.5 text-[11px] text-text-subtle">{npDate(log.timestamp)}</span>
        </span>
        <span className={cn("font-mono text-[11px] font-semibold", methodTone(log.method))}>{log.method}</span>
        <span className="flex min-w-0 items-center gap-1.5" title={log.path}>
          <span className="truncate font-mono text-[11.5px] text-text-primary">{log.path}</span>
          <ToolBadge tool={log.tool} tier={log.tier} />
        </span>
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(log.status_code))} />
          <span className={cn("text-[11.5px] font-medium", statusText(log.status_code))}>{log.status_code}</span>
        </span>
        <span className="whitespace-nowrap text-right text-[11.5px] tabular-nums text-text-muted">{fmtMs(log.duration_ms)}</span>
        <span className="truncate font-mono text-[11px] text-text-subtle">{log.client_ip}</span>
        <span>
          {clickable && (
            <ScrollText className="h-3.5 w-3.5 shrink-0 text-amber-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          )}
        </span>
      </div>
    );
  },
  (prev, next) => prev.log.id === next.log.id
);

const HttpCardRow = memo(
  function HttpCardRow({ log, onOpen }: { log: HttpLogEntry; onOpen: (log: HttpLogEntry) => void }) {
    const clickable = httpRowTarget(log) !== null;
    return (
      <div
        onClick={clickable ? () => { if (!isTextSelected()) onOpen(log); } : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(log); }
              }
            : undefined
        }
        style={{ height: ROW_H_MOBILE }}
        className={cn(
          "flex flex-col justify-center gap-1 border-b border-graphite-800/50 px-4",
          FOCUS_RING,
          clickable ? "cursor-pointer active:bg-graphite-850/70" : "opacity-60"
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot(log.status_code))} />
          <span className={cn("shrink-0 font-mono text-[11px] font-semibold", methodTone(log.method))}>{log.method}</span>
          <span className="flex-1 truncate font-mono text-[11.5px] text-text-primary" title={log.path}>
            {log.path}
          </span>
          <ToolBadge tool={log.tool} tier={log.tier} />
          <span className={cn("shrink-0 text-[11.5px] font-medium tabular-nums", statusText(log.status_code))}>
            {log.status_code}
          </span>
          {clickable && <ScrollText className="h-3.5 w-3.5 shrink-0 text-text-subtle" />}
        </div>
        <div className="flex items-center justify-between pl-3.5 text-[11px] tabular-nums text-text-subtle">
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

/** contentVisibility:auto skips layout, paint and style for entries scrolled
 *  out of view. System messages wrap to arbitrary heights so they're the
 *  expensive ones; containIntrinsicSize gives the scrollbar an estimate so
 *  skipping them doesn't make scroll height jump. */
const SystemRow = memo(
  function SystemRow({
    entry, newGroup, onOpenEntry,
  }: {
    entry: SystemLogEntry;
    newGroup: boolean;
    onOpenEntry?: (entry: SystemLogEntry) => void;
  }) {
    const tone = levelTone(entry.level);
    // Checks BOTH correlation targets. Previously only the message-text job id
    // counted, which meant an ERROR line with no "job=<id>" in its text — a
    // plain exception, a startup failure — was a dead end even though it
    // belonged to a real, correlatable request.
    const hasJobId = jobIdFromMessage(entry.message) !== null;
    const hasRequestId = realId(entry.request_id) !== null;
    const clickable = !!onOpenEntry && (hasJobId || hasRequestId);

    return (
      <div
        onClick={clickable ? () => { if (!isTextSelected()) onOpenEntry?.(entry); } : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEntry?.(entry); }
              }
            : undefined
        }
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        title={clickable ? (hasJobId ? "View this job's full log" : "View this request's logs") : undefined}
        style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
        className={cn(
          "border-l-2 px-4 py-2 transition-colors hover:bg-graphite-850/60",
          tone.border,
          FOCUS_RING,
          clickable && "cursor-pointer",
          newGroup && "mt-1 border-t border-t-graphite-700 pt-2.5"
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn("font-semibold", tone.text)}>{entry.level}</span>
          <span className="tabular-nums text-text-subtle">
            {npDate(entry.timestamp)} {npTime(entry.timestamp)}
          </span>
          <span className="text-text-subtle">{entry.logger}</span>
          <ToolBadge tool={entry.tool} tier={entry.tier} />
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words leading-relaxed text-text-primary">{entry.message}</p>
      </div>
    );
  },
  (prev, next) =>
    prev.entry.id === next.entry.id &&
    prev.newGroup === next.newGroup &&
    prev.onOpenEntry === next.onOpenEntry
);

const _LEVEL_RANK: Record<string, number> = { INFO: 0, WARNING: 1, ERROR: 2, CRITICAL: 3 };

function worstLevel(entries: SystemLogEntry[]): string {
  let worst = entries[0]?.level ?? "INFO";
  for (const e of entries) {
    if ((_LEVEL_RANK[e.level] ?? 0) > (_LEVEL_RANK[worst] ?? 0)) worst = e.level;
  }
  return worst;
}

/**
 * EVERY group folds, including the live one. Exempting the newest group made an
 * in-flight download dump 40+ progress lines at full height, so the grouping
 * that makes this feed readable stopped applying to the one request you're
 * actually watching. The tail is recomputed every render, so it IS the newest
 * line and updates live on its own.
 */
const SystemGroupBlock = memo(
  function SystemGroupBlock({
    group, isFirst, expanded, onToggle, onOpenEntry,
  }: {
    group: SystemGroup;
    isFirst: boolean;
    expanded: boolean;
    onToggle: () => void;
    onOpenEntry?: (entry: SystemLogEntry) => void;
  }) {
    const { entries } = group;

    if (entries.length === 1) {
      return <SystemRow entry={entries[0]} newGroup={!isFirst} onOpenEntry={onOpenEntry} />;
    }

    const head = entries[0];
    const tail = entries[entries.length - 1];
    const middle = entries.slice(1, -1);
    const tone = levelTone(worstLevel(middle));

    return (
      <div className={cn(!isFirst && "mt-1 border-t border-t-graphite-700 pt-2.5")}>
        <SystemRow entry={head} newGroup={false} onOpenEntry={onOpenEntry} />
        {middle.length > 0 && (
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className={cn(
              "flex w-full items-center gap-2 border-l-2 px-4 py-1.5 text-[11px] transition-colors hover:bg-graphite-850/60",
              tone.border,
              tone.text,
              FOCUS_RING
            )}
          >
            <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", expanded && "rotate-180")} />
            {expanded ? "Hide" : "Show"} {middle.length} more line{middle.length === 1 ? "" : "s"} from this request
          </button>
        )}
        {expanded && middle.map((entry) => <SystemRow key={entry.id} entry={entry} newGroup={false} onOpenEntry={onOpenEntry} />)}
        <SystemRow entry={tail} newGroup={false} onOpenEntry={onOpenEntry} />
      </div>
    );
  },
  (prev, next) =>
    prev.group.key === next.group.key &&
    prev.group.entries.length === next.group.entries.length &&
    prev.isFirst === next.isFirst &&
    prev.expanded === next.expanded &&
    prev.onOpenEntry === next.onOpenEntry
);