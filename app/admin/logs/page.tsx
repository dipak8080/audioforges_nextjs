"use client";

// app/admin/logs/page.tsx
// Correlation opens in a drawer over both feeds. Both feeds stay mounted with
// saved scroll offsets. HTTP feed is virtualized on fixed-height rows.
// Silent errors = returned <400 but logged an ERROR (backend fix #24).

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
  Filter,
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
const RENDER_CAP = 5000;

// Fixed row heights are the contract that makes virtualization exact.
const ROW_H_DESKTOP = 34;
const ROW_H_MOBILE = 62;
const OVERSCAN = 10;
const SENTINEL_H = 40;

const AUTO_LOAD_PX = 500;
const NEAR_BOTTOM_PX = 96;

const MIN_POLL_MS = 2500;
const MAX_POLL_MS = 10000;
const COUNTS_POLL_MS = 30000;

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;
const OTHER_TRAFFIC_KEY = "__other__";

const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-graphite-900";

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
  error_logged?: number | null;
  error_count?: number | null;
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

interface Totals {
  total: number;
  success: number;
  client: number;
  server: number;
  silent: number;
}

type SystemGroup = { key: string; entries: SystemLogEntry[] };
type EndpointOption = { path: string; label: string; count: number };

interface Correlation {
  id: string;
  scope: "job" | "request";
  summary: HttpLogEntry | null;
}

/* ===================================================================
   Identity helpers
   =================================================================== */

function realId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  return trimmed && trimmed !== "-" ? trimmed : null;
}

const _ACTION_SEGMENTS = new Set(["status", "preview", "download", "result"]);
const _ID_SEGMENT = /^[0-9a-f]{6,}(-[0-9a-f]{4,}){0,4}$/i;
const _FASTAPI_PARAM_SEGMENT = /^\{[^}]+\}$/;

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

// Mirrors _humanize_endpoint/admin_endpoints() in routes.py exactly.
const toolFamily = memoize1((path: string) => {
  const parts: string[] = [];
  for (const [i, seg] of path.split("/").filter(Boolean).entries()) {
    const isParam = _ID_SEGMENT.test(seg) || _FASTAPI_PARAM_SEGMENT.test(seg);
    if (i > 0 && (_ACTION_SEGMENTS.has(seg) || isParam)) break;
    if (isParam) break;
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

const _MSG_JOB_ID = /\bjob[=\s]+([0-9a-f]{6,}(?:-[0-9a-f]{4,}){0,4})\b/i;
const jobIdFromMessage = memoize1((message: string): string | null => {
  const m = _MSG_JOB_ID.exec(message);
  return m ? m[1] : null;
});

/* ===================================================================
   Noise
   =================================================================== */

let NOISE_PATTERNS: string[] = [
  "/robots.txt", "/favicon.ico", "/.env", "/wp-", "/.git",
  "/SDK/", "/phpmyadmin", "/.well-known", "/xmlrpc.php",
];

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

function prependUnique<T extends { id: number }>(older: T[], current: T[]): T[] {
  if (older.length === 0) return current;
  const seen = new Set(current.map((r) => r.id));
  const fresh = older.filter((r) => !seen.has(r.id));
  return fresh.length === 0 ? current : [...fresh, ...current];
}

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
    typeof window !== "undefined" ? window.matchMedia("(max-width: 639px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

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

function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

function useTicker(active: boolean, intervalMs: number) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}

function useVirtualWindow(count: number, rowH: number) {
  const [win, setWin] = useState({ start: 0, end: 60 });
  const measure = useCallback(
    (el: HTMLElement | null) => {
      if (!el || el.clientHeight === 0) return;
      const top = Math.max(0, el.scrollTop - SENTINEL_H);
      const start = Math.max(0, Math.floor(top / rowH) - OVERSCAN);
      const end = Math.min(count, Math.ceil((top + el.clientHeight) / rowH) + OVERSCAN);
      setWin((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    },
    [count, rowH]
  );
  return [win, measure] as const;
}

let _idSeq = 0;
function useStableId(prefix: string): string {
  const ref = useRef<string | null>(null);
  if (!ref.current) ref.current = `${prefix}-${++_idSeq}`;
  return ref.current;
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
  const [totals, setTotals] = useState<Totals>({ total: 0, success: 0, client: 0, server: 0, silent: 0 });
  const [httpLoading, setHttpLoading] = useState(true);
  const [httpError, setHttpError] = useState<string | null>(null);

  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);

  // HTTP filters
  const [methodFilter, setMethodFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [statusClassFilter, setStatusClassFilter] = useState<StatusClass>("all");
  const [hideNoise, setHideNoise] = useState(true);
  const [erroredOnly, setErroredOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [toolFilter, setToolFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier>("");
  const [toolOptions, setToolOptions] = useState<ToolCount[]>([]);

  // System filters
  const [levelFilter, setLevelFilter] = useState("");
  const [systemSearch, setSystemSearch] = useState("");
  const [sysToolFilter, setSysToolFilter] = useState("");
  const [sysTierFilter, setSysTierFilter] = useState<Tier>("");

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sysFiltersOpen, setSysFiltersOpen] = useState(false);

  const httpSearchRef = useRef<HTMLInputElement>(null);
  const sysSearchRef = useRef<HTMLInputElement>(null);

  // Correlation drawer
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
  const [httpFilteredTotal, setHttpFilteredTotal] = useState(0);
  const [sysTotal, setSysTotal] = useState(0);
  const [sysFilteredTotal, setSysFilteredTotal] = useState(0);
  const [httpLoadingOlder, setHttpLoadingOlder] = useState(false);
  const [sysLoadingOlder, setSysLoadingOlder] = useState(false);
  const [httpHasOlder, setHttpHasOlder] = useState(true);
  const [sysHasOlder, setSysHasOlder] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const httpHasOlderRef = useRef(true);
  const sysHasOlderRef = useRef(true);
  const httpOldestRef = useRef(0);
  const sysOldestRef = useRef(0);

  const httpRef = useRef<HTMLDivElement>(null);
  const sysRef = useRef<HTMLDivElement>(null);

  const httpScrollTopRef = useRef(0);
  const sysScrollTopRef = useRef(0);

  const httpPrependRef = useRef(0);
  const sysScrollAdjustRef = useRef<[number, number] | null>(null);

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

  const httpLastIdRef = useRef(0);
  const sysLastIdRef = useRef(0);
  const httpDeltaInFlightRef = useRef(false);
  const sysDeltaInFlightRef = useRef(false);

  const httpSeededRef = useRef(false);
  const sysSeededRef = useRef(false);

  // Replaces an already-aborted controller so StrictMode's remount recovers.
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

  useEffect(() => {
    if (!isMobile) {
      setFiltersOpen(false);
      setSysFiltersOpen(false);
    }
  }, [isMobile]);

  const currentDelayRef = useRef(MIN_POLL_MS);
  const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";
  const markUpdated = useCallback(() => setLastUpdatedAt(Date.now()), []);

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

  // All filters go to the backend; read through refs so fetchers stay memoized.
  const filterRef = useRef({
    endpointFilter: "", methodFilter: "", debouncedPath: "",
    statusClassFilter: "all" as StatusClass,
    dateFilter: "all" as DateFilter, hideNoise: true,
    toolFilter: "", tierFilter: "" as Tier, erroredOnly: false,
  });
  filterRef.current = {
    endpointFilter, methodFilter, debouncedPath, statusClassFilter,
    dateFilter, hideNoise, toolFilter, tierFilter, erroredOnly,
  };

  const sysFilterRef = useRef({
    levelFilter: "", debouncedSystemSearch: "",
    sysToolFilter: "", sysTierFilter: "" as Tier,
  });
  sysFilterRef.current = { levelFilter, debouncedSystemSearch, sysToolFilter, sysTierFilter };

  const filterParams = useCallback(() => {
    const f = filterRef.current;
    const p = new URLSearchParams();
    if (f.endpointFilter && f.endpointFilter !== OTHER_TRAFFIC_KEY) p.set("family", f.endpointFilter);
    if (f.methodFilter) p.set("method", f.methodFilter);
    if (f.debouncedPath.trim()) p.set("q", f.debouncedPath.trim());
    if (f.statusClassFilter !== "all") p.set("status_class", f.statusClassFilter);
    if (f.hideNoise) p.set("hide_noise", "true");
    if (f.erroredOnly) p.set("errored", "true");
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

  /* ---------------- Correlation ---------------- */

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

      const newestMatching = data.logs.length > 0 ? data.logs[0].id : 0;
      httpLastIdRef.current = Math.max(newestMatching, data.max_id ?? 0);
      httpSeededRef.current = true;

      const sig = [
        data.total, data.filtered_total, data.success, data.client,
        data.server, data.silent, data.logs.length, data.logs[0]?.id ?? 0,
      ].join(":");
      if (sig === httpSigRef.current) return;
      httpSigRef.current = sig;

      setTotals({ total: data.total, success: data.success, client: data.client, server: data.server, silent: data.silent ?? 0 });
      setHttpTotal(data.total);
      if (typeof data.filtered_total === "number") setHttpFilteredTotal(data.filtered_total);
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
      setSystemLogs(data.logs);
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

      if (data.truncated) {
        httpSigRef.current = "";
        void fetchHttp(true);
        return true;
      }

      setTotals({ total: data.total, success: data.success, client: data.client, server: data.server, silent: data.silent ?? 0 });
      setHttpTotal(data.total);
      if (typeof data.filtered_total === "number") setHttpFilteredTotal(data.filtered_total);
      setHttpError(null);
      markUpdated();
      if (!data.logs || data.logs.length === 0) return false;

      setHttpLogs((prev) => {
        const merged = [...prev, ...data.logs];
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
      // picker keeps what it has
    }
  }, []);

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
    setShowJumpHttp(!nearBottom);
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

  /* ---------------- Scroll anchoring ---------------- */

  useLayoutEffect(() => {
    const el = httpRef.current;
    if (!el || tab !== "http") return;

    const prepended = httpPrependRef.current;
    if (prepended > 0) {
      el.scrollTop += prepended * rowH;
      httpPrependRef.current = 0;
    } else if (httpPinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    httpScrollTopRef.current = el.scrollTop;
    measureHttp(el);
  }, [filtered, tab, rowH, measureHttp]);

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
    httpPinnedRef.current = true;
    setShowJumpHttp(false);
    void fetchHttp(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointFilter, methodFilter, debouncedPath, statusClassFilter, dateFilter, hideNoise, toolFilter, tierFilter, erroredOnly]);

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

  const endpointOptions = useMemo<EndpointOption[]>(() => {
    const byPath = new Map<string, EndpointOption>();
    for (const ep of knownEndpoints) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setErroredOnly(false);
    setPathFilter("");
    setToolFilter("");
    setTierFilter("");
  }, []);

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
    if (erroredOnly) {
      chips.push({ key: "errored", label: "Errored only", clear: () => setErroredOnly(false) });
    }
    if (dateFilter !== "all") {
      chips.push({ key: "date", label: dateFilter === "today" ? "Today" : "Yesterday", clear: () => setDateFilter("all") });
    }
    if (pathFilter) chips.push({ key: "q", label: `“${pathFilter}”`, clear: () => setPathFilter("") });
    if (!hideNoise) chips.push({ key: "noise", label: "Noise shown", clear: () => setHideNoise(true) });
    return chips;
  }, [activeToolLabel, methodFilter, tierFilter, statusClassFilter, erroredOnly, dateFilter, pathFilter, hideNoise]);

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

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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

  /* ---------------- Filter controls (shared by row + sheet) ---------------- */

  const methodOptions = [
    { value: "", label: "Any method" },
    { value: "GET", label: "GET" },
    { value: "POST", label: "POST" },
    { value: "DELETE", label: "DELETE" },
  ];
  const tierOptions = [
    { value: "" as Tier, label: "Any" },
    { value: "standard" as Tier, label: "Standard" },
    { value: "hq" as Tier, label: "HQ" },
  ];
  const dateOptions = [
    { value: "all" as DateFilter, label: "Any date" },
    { value: "today" as DateFilter, label: "Today" },
    { value: "yesterday" as DateFilter, label: "Yesterday" },
  ];
  const levelOptions = [
    { value: "", label: "Any level" },
    { value: "ERROR", label: "ERROR" },
    { value: "CRITICAL", label: "CRITICAL" },
    { value: "WARNING", label: "WARNING" },
    { value: "INFO", label: "INFO" },
  ];
  const sysToolOptions = [{ value: "", label: "All tools" }, ...toolOptions.map((t) => ({ value: t.tool, label: t.label }))];

  const statusGroup = (fill: boolean) => (
    <div
      role="group"
      aria-label="Status class"
      className={cn("flex rounded-lg border border-graphite-700 bg-graphite-850 p-0.5", fill && "w-full")}
    >
      <StatusChip fill={fill} active={statusClassFilter === "all"} onClick={() => setStatusClassFilter("all")} label="All" />
      <StatusChip fill={fill} active={statusClassFilter === "4xx"} onClick={() => setStatusClassFilter("4xx")} label="4xx" tone="text-amber-400" />
      <StatusChip fill={fill} active={statusClassFilter === "5xx"} onClick={() => setStatusClassFilter("5xx")} label="5xx" tone="text-red-400" />
    </div>
  );

  const toggles = (
    <>
      <ToggleChip checked={hideNoise} onChange={setHideNoise} label="Hide noise" />
      <ToggleChip checked={erroredOnly} onChange={setErroredOnly} label="Only errored" tone="red" />
    </>
  );

  const httpFilterRow = (
    <div className="hidden flex-wrap items-center gap-2 sm:flex">
      <Select value={methodFilter} onChange={setMethodFilter} placeholder="Any method" options={methodOptions} />
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
      <Select value={tierFilter} onChange={setTierFilter} label="Tier" placeholder="Any" options={tierOptions} />
      <Select value={dateFilter} onChange={setDateFilter} placeholder="Any date" options={dateOptions} />
      {statusGroup(false)}
      {toggles}
    </div>
  );

  const httpFilterSheet = (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Select value={methodFilter} onChange={setMethodFilter} placeholder="Any method" options={methodOptions} widthClass="w-full" />
        <Select value={dateFilter} onChange={setDateFilter} placeholder="Any date" options={dateOptions} widthClass="w-full" />
        <Select value={tierFilter} onChange={setTierFilter} label="Tier" placeholder="Any" options={tierOptions} widthClass="w-full" />
        {statusGroup(true)}
      </div>
      <div className="flex flex-wrap gap-2">{toggles}</div>
      <div>
        <p className="mb-1.5 text-xs text-text-muted">Tool</p>
        <ToolPicker
          inline
          toolOptions={toolOptions}
          endpointOptions={endpointOptions}
          toolFilter={toolFilter}
          endpointFilter={endpointFilter}
          activeLabel={activeToolLabel}
          onPickTool={(t) => { setToolFilter(t); setEndpointFilter(""); }}
          onPickFamily={(p) => { setEndpointFilter(p); setToolFilter(""); }}
          onClear={() => { setToolFilter(""); setEndpointFilter(""); }}
        />
      </div>
    </>
  );

  const sysFilterRow = (
    <div className="hidden flex-wrap items-center gap-2 sm:flex">
      <Select value={levelFilter} onChange={setLevelFilter} placeholder="Any level" options={levelOptions} />
      <Select value={sysToolFilter} onChange={setSysToolFilter} placeholder="All tools" options={sysToolOptions} />
      <Select value={sysTierFilter} onChange={setSysTierFilter} label="Tier" placeholder="Any" options={tierOptions} />
    </div>
  );

  const sysFilterSheet = (
    <div className="grid grid-cols-2 gap-2">
      <Select value={levelFilter} onChange={setLevelFilter} placeholder="Any level" options={levelOptions} widthClass="w-full" />
      <Select value={sysTierFilter} onChange={setSysTierFilter} label="Tier" placeholder="Any" options={tierOptions} widthClass="w-full" />
      <div className="col-span-2">
        <Select value={sysToolFilter} onChange={setSysToolFilter} placeholder="All tools" options={sysToolOptions} widthClass="w-full" />
      </div>
    </div>
  );

  /* =================================================================
     Render
     ================================================================= */

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 px-3 py-3 sm:gap-3.5 sm:px-6 sm:py-5">
      <header className="flex shrink-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Request logs</h1>
          <LiveStatus isPaused={isPaused} lastUpdatedAt={lastUpdatedAt} />
        </div>
        <div
          role="tablist"
          aria-label="Log source"
          className="flex shrink-0 rounded-lg border border-graphite-800 bg-graphite-900 p-0.5"
        >
          <TabButton active={tab === "http"} onClick={() => setTab("http")} icon={Activity} label="HTTP" />
          <TabButton active={tab === "system"} onClick={() => setTab("system")} icon={Terminal} label="System" />
        </div>
      </header>

      <div
        className={cn(
          "grid shrink-0 grid-cols-5 gap-px overflow-hidden rounded-xl border border-graphite-800 bg-graphite-800",
          tab !== "http" && "hidden"
        )}
      >
        <Stat label="Total" short="Total" value={totals.total} />
        <Stat label="Success" short="OK" value={totals.success} valueClass="text-teal-400" />
        <Stat
          label="Client errors"
          short="4xx"
          value={totals.client}
          valueClass="text-amber-400"
          hint="4xx — rejected requests: rate limits, bad uploads, bots probing routes. Normal, not a bug."
        />
        <Stat
          label="Server errors"
          short="5xx"
          value={totals.server}
          valueClass={totals.server > 0 ? "text-red-400" : ""}
          hint="5xx — the backend broke. Check the System tab if this is above zero."
        />
        <Stat
          label="Silent errors"
          short="Silent"
          value={totals.silent}
          valueClass={totals.silent > 0 ? "text-red-400" : ""}
          hint="Returned <400 but logged an error. Tap to show every request that logged an error."
          onClick={() => setErroredOnly((v) => !v)}
          active={erroredOnly}
        />
      </div>

      {/* ===== HTTP panel (always mounted) ===== */}
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
              placeholder={isMobile ? "Search logs…" : "Search path, IP, status, tool…"}
              combobox={{
                open: suggestOpen && pathSuggestions.length > 0,
                setOpen: setSuggestOpen,
                highlightIndex,
                setHighlightIndex,
                suggestions: pathSuggestions,
                onPick: (path) => {
                  setEndpointFilter(path);
                  setPathFilter("");
                  setSuggestOpen(false);
                  setHighlightIndex(-1);
                },
              }}
            />
            <FilterButton count={activeFilters.length} onClick={() => setFiltersOpen(true)} />
            <div className="hidden h-5 w-px bg-graphite-800 sm:block" />
            {actionBar}
          </div>

          {httpFilterRow}

          {activeFilters.length > 0 && <FilterChips chips={activeFilters} onClearAll={resetFilters} />}
        </div>

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

        <div className="relative min-h-[280px] flex-1 sm:min-h-0">
          <div
            ref={httpRef}
            onScroll={handleHttpScroll}
            className="af-scroll absolute inset-0 overflow-y-auto overscroll-contain"
          >
            <TopSentinel
              loading={httpLoadingOlder}
              hasOlder={httpHasOlder}
              count={filtered.length}
              total={httpFilteredTotal}
            />

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
          matching={otherBucketActive ? null : httpFilteredTotal}
          total={httpTotal}
        />
      </section>

      {/* ===== System panel (always mounted) ===== */}
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900",
          tab !== "system" && "hidden"
        )}
      >
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-graphite-800 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <SearchBox
              inputRef={sysSearchRef}
              value={systemSearch}
              onChange={setSystemSearch}
              onClear={() => setSystemSearch("")}
              placeholder={isMobile ? "Search log…" : "Search message, logger, request id, tool…"}
            />
            <FilterButton count={sysActiveFilters.length} onClick={() => setSysFiltersOpen(true)} />
            <div className="hidden h-5 w-px bg-graphite-800 sm:block" />
            {actionBar}
          </div>

          {sysFilterRow}

          {sysActiveFilters.length > 0 && <FilterChips chips={sysActiveFilters} onClearAll={resetSysFilters} />}
        </div>

        <div className="relative min-h-[280px] flex-1 sm:min-h-0">
          <div
            ref={sysRef}
            onScroll={handleSysScroll}
            className="af-scroll absolute inset-0 overflow-y-auto overscroll-contain font-mono text-xs"
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

        <Footer loaded={systemLogs.length} matching={sysFilteredTotal} total={sysTotal} />
      </section>

      {isMobile && (
        <>
          <FilterSheet
            open={filtersOpen}
            title="Filter requests"
            activeCount={activeFilters.length}
            onClose={() => setFiltersOpen(false)}
            onReset={resetFilters}
          >
            {httpFilterSheet}
          </FilterSheet>
          <FilterSheet
            open={sysFiltersOpen}
            title="Filter system log"
            activeCount={sysActiveFilters.length}
            onClose={() => setSysFiltersOpen(false)}
            onReset={resetSysFilters}
          >
            {sysFilterSheet}
          </FilterSheet>
        </>
      )}

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
@keyframes af-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
.af-rise { animation: af-rise .22s cubic-bezier(.22,.9,.32,1) both; }
@media (prefers-reduced-motion: reduce) { .af-slide, .af-rise { animation: none; } }
`,
        }}
      />
    </div>
  );
}

/* ===================================================================
   Header pieces
   =================================================================== */

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
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-3.5",
        FOCUS_RING,
        active ? "bg-graphite-800 text-text-primary" : "text-text-muted hover:text-text-primary"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && "text-amber-500")} />
      {label}
    </button>
  );
}

/** Stat box. Compact on phones (short label), full on desktop. With onClick it
 *  becomes a filter toggle: filter icon in the label row, red ring when on. */
function Stat({
  label, short, value, valueClass = "", hint, onClick, active = false,
}: {
  label: string;
  short: string;
  value: number;
  valueClass?: string;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const inner = (
    <>
      <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-text-subtle sm:text-[10px] sm:tracking-[0.16em]">
        <span className="truncate">
          <span className="sm:hidden">{short}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        {onClick && (
          <Filter
            className={cn("h-2.5 w-2.5 shrink-0 transition-colors", active ? "text-red-400" : "text-text-subtle/60")}
          />
        )}
        {onClick && active && (
          <span className="ml-auto hidden rounded bg-red-500/15 px-1 text-[8px] font-semibold tracking-normal text-red-400 sm:inline">
            on
          </span>
        )}
      </p>
      <p className={cn("mt-0.5 truncate text-sm font-semibold tabular-nums sm:mt-1 sm:text-2xl", valueClass || "text-text-primary")}>
        {value.toLocaleString()}
      </p>
    </>
  );

  const base = "min-w-0 px-1.5 py-2 sm:px-5 sm:py-3.5";

  if (onClick) {
    return (
      <button
        onClick={onClick}
        title={hint}
        aria-pressed={active}
        className={cn(
          base,
          "text-left transition-colors",
          FOCUS_RING,
          active ? "bg-red-500/[0.07] ring-1 ring-inset ring-red-500/50" : "bg-graphite-900 hover:bg-graphite-850"
        )}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={cn(base, "bg-graphite-900")} title={hint}>
      {inner}
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
        "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:h-auto sm:py-1.5",
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

/** Mobile-only trigger for the filter sheet. */
function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={count > 0 ? `Filters, ${count} active` : "Filters"}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors sm:hidden",
        FOCUS_RING,
        count > 0 ? "border-amber-500/50 text-amber-400" : "border-graphite-700 text-text-muted"
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      {count > 0 ? (
        <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold tabular-nums text-graphite-950">{count}</span>
      ) : (
        <span>Filters</span>
      )}
    </button>
  );
}

/** Bottom sheet for filters on phones. Selects inside still open as popovers;
 *  the tool picker renders inline so nothing needs to escape the sheet. */
function FilterSheet({
  open, title, activeCount, onClose, onReset, children,
}: {
  open: boolean;
  title: string;
  activeCount: number;
  onClose: () => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  useEscape(open, onClose);
  useLockBodyScroll(open);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end">
      <button aria-hidden tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]" />
      <div className="af-rise relative flex max-h-[88vh] w-full flex-col rounded-t-2xl border-t border-graphite-700 bg-graphite-900 shadow-2xl">
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-graphite-700" />
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2.5 pt-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            {title}
            {activeCount > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-px text-[11px] font-medium text-amber-400">
                {activeCount} active
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={onReset}
                className={cn("rounded-lg px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text-primary", FOCUS_RING)}
              >
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className={cn(
                "rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-graphite-950 transition-colors hover:bg-amber-400",
                FOCUS_RING
              )}
            >
              Done
            </button>
          </div>
        </div>
        <div className="af-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Switch-style chip that replaces the native checkbox. */
function ToggleChip({
  checked, onChange, label, tone = "amber",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tone?: "amber" | "red";
}) {
  const on = tone === "red" ? "bg-red-500" : "bg-amber-500";
  const text = tone === "red" ? "border-red-500/40 text-red-400" : "border-amber-500/40 text-amber-400";
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border px-2.5 text-sm transition-colors sm:h-auto sm:py-1.5",
        FOCUS_RING,
        checked ? cn("bg-graphite-850", text) : "border-graphite-700 text-text-muted hover:border-graphite-600 hover:text-text-primary"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors",
          checked ? cn(on, "justify-end") : "justify-start bg-graphite-700"
        )}
      >
        <span className="h-3 w-3 rounded-full bg-white shadow-sm" />
      </span>
      {label}
    </button>
  );
}

type Suggestion = { path: string; label: string; count: number };

function SearchBox({
  inputRef, value, onChange, onClear, placeholder, combobox,
}: {
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
  const listId = useStableId("search-suggestions");
  const c = combobox;

  return (
    <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" />
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => c?.setOpen(true)}
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
          "h-9 w-full rounded-lg border border-graphite-700 bg-graphite-850 pl-9 pr-9 text-sm text-text-primary transition-colors placeholder:text-text-subtle hover:border-graphite-600 focus:border-amber-500/60 sm:h-auto sm:py-1.5",
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

function Select<T extends string>({
  value, options, onChange, placeholder, label, widthClass = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  placeholder: string;
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
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-graphite-850 px-2.5 text-left text-sm transition-colors sm:h-auto sm:py-1.5",
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
                  "flex w-full items-center justify-between gap-2 whitespace-nowrap px-3 py-2 text-left text-sm transition-colors sm:py-1.5",
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

/** Merged tool picker: tagged tools first, path families below. `inline`
 *  renders the search + list as a static block (used inside the mobile sheet). */
function ToolPicker({
  toolOptions, endpointOptions, toolFilter, endpointFilter, activeLabel, onPickTool, onPickFamily, onClear, inline = false,
}: {
  toolOptions: ToolCount[];
  endpointOptions: EndpointOption[];
  toolFilter: string;
  endpointFilter: string;
  activeLabel: string | null;
  onPickTool: (tool: string) => void;
  onPickFamily: (path: string) => void;
  onClear: () => void;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useStableId("toolpicker");

  useEscape(open && !inline, () => setOpen(false));

  useEffect(() => {
    if (open && !inline) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, inline]);

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

  type Row =
    | { kind: "all" }
    | { kind: "tool"; tool: ToolCount }
    | { kind: "family"; family: EndpointOption };

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
    if (!inline) setOpen(false);
  }

  const panel = (
    <>
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
            "h-9 w-full rounded-md border border-graphite-700 bg-graphite-900 px-2.5 text-sm text-text-primary placeholder:text-text-subtle sm:h-auto sm:py-1.5",
            FOCUS_RING
          )}
        />
      </div>

      <div id={listId} role="listbox" className={cn("af-scroll overflow-y-auto py-1", inline ? "max-h-60" : "max-h-72")}>
        {rows.length === 0 && <p className="px-3 py-3 text-center text-xs text-text-subtle">No tools match.</p>}
        {rows.map((row, i) => {
          const isActive = i === active;
          const common = cn(
            "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors sm:py-1.5",
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
    </>
  );

  if (inline) {
    return <div className="overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850">{panel}</div>;
  }

  return (
    <div className="relative w-[240px] shrink-0">
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
          <div className="absolute left-0 top-full z-30 mt-1 min-w-[300px] overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl">
            {panel}
          </div>
        </>
      )}
    </div>
  );
}

function PickerSection({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 border-t border-graphite-800 px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle first:mt-0 first:border-t-0">
      {children}
    </p>
  );
}

function StatusChip({
  active, onClick, label, tone = "", fill = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: string;
  fill?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:py-1",
        FOCUS_RING,
        fill && "flex-1",
        active ? cn("bg-graphite-700", tone || "text-text-primary") : cn("text-text-subtle hover:text-text-primary", tone)
      )}
    >
      {label}
    </button>
  );
}

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
  matching: number | null;
  total: number;
}) {
  return (
    <div className="shrink-0 border-t border-graphite-800 px-3 py-2 text-[11px] tabular-nums text-text-subtle sm:px-4 sm:py-2.5 sm:text-xs">
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

function CorrelationDrawer({
  correlation, logs, loading, error, onClose,
}: {
  correlation: Correlation;
  logs: SystemLogEntry[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
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
      <div className="af-slide relative flex h-full w-full flex-col border-l border-graphite-700 bg-graphite-900 shadow-2xl sm:w-[560px]">
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
              "flex shrink-0 items-center gap-1 rounded-lg border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted transition-colors hover:bg-graphite-850 hover:text-text-primary sm:py-1",
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
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        aria-hidden
        tabIndex={-1}
        onClick={loading ? undefined : onCancel}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
      />
      <div ref={panelRef} className="af-rise relative flex w-full max-w-sm flex-col gap-3 rounded-xl border border-graphite-700 bg-graphite-900 p-4 shadow-2xl sm:p-5">
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

function ErrorBadge({ log }: { log: HttpLogEntry }) {
  if (!log.error_logged) return null;
  const n = log.error_count || 1;
  return (
    <span
      title={`${n} error${n === 1 ? "" : "s"} logged during this request — click the row to see them`}
      className="shrink-0 rounded border border-red-500/40 bg-red-500/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-red-400"
    >
      failed
    </span>
  );
}

function httpRowTarget(log: HttpLogEntry): "job" | "request" | null {
  if (jobIdFromPath(log.path)) return "job";
  if (realId(log.request_id)) return "request";
  return null;
}

const HttpTableRow = memo(
  function HttpTableRow({ log, onOpen }: { log: HttpLogEntry; onOpen: (log: HttpLogEntry) => void }) {
    const target = httpRowTarget(log);
    const clickable = target !== null;
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
            ? `${log.method} ${log.path} returned ${log.status_code}${log.error_logged ? ", logged an error" : ""}. View ${target === "job" ? "this job's logs" : "this request's logs"}.`
            : undefined
        }
        title={clickable ? "View related system logs" : "No request id recorded for this row"}
        style={{ height: ROW_H_DESKTOP, gridTemplateColumns: HTTP_COLS }}
        className={cn(
          "group grid items-center gap-x-3 border-b border-graphite-800/50 px-4 text-[12.5px] transition-colors",
          FOCUS_RING,
          log.error_logged && "bg-red-500/[0.06]",
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
          <ErrorBadge log={log} />
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
          "flex flex-col justify-center gap-1 border-b border-graphite-800/50 px-3",
          FOCUS_RING,
          log.error_logged && "bg-red-500/[0.06]",
          clickable ? "cursor-pointer active:bg-graphite-850/70" : "opacity-60"
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot(log.status_code))} />
          <span className={cn("shrink-0 font-mono text-[11px] font-semibold", methodTone(log.method))}>{log.method}</span>
          <span className="flex-1 truncate font-mono text-[11.5px] text-text-primary" title={log.path}>
            {log.path}
          </span>
          <ErrorBadge log={log} />
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

const SystemRow = memo(
  function SystemRow({
    entry, newGroup, onOpenEntry,
  }: {
    entry: SystemLogEntry;
    newGroup: boolean;
    onOpenEntry?: (entry: SystemLogEntry) => void;
  }) {
    const tone = levelTone(entry.level);
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
          "border-l-2 px-3 py-2 transition-colors hover:bg-graphite-850/60 sm:px-4",
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
              "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-[11px] transition-colors hover:bg-graphite-850/60 sm:px-4 sm:py-1.5",
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