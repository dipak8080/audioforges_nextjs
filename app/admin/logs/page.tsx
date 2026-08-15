"use client";

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

/* ===================================================================
   Constants
   All module-scope: values that never change per-render have no
   business being redeclared inside the component, where they silently
   become new identities in effect dependency arrays.
   =================================================================== */

// Paging is CURSOR-based, not growing-limit. Each "older" fetch asks for
// exactly PAGE_SIZE rows before the oldest row held, so every page costs
// the same and there is no ceiling (the old growing-`limit` model died
// at the server's le=2000 cap).
const PAGE_SIZE = 250;

// Hard ceiling on rows kept in the DOM. Only ever trimmed from the top
// (oldest) and only while pinned to the live tail — trimming history the
// reader just loaded would be hostile.
const RENDER_CAP = 6000;

// Start fetching the next older page this far from the top, so the page
// lands before the reader reaches the edge.
const AUTO_LOAD_PX = 600;

// Wider than the error in scrollHeight itself. SystemRow uses
// contentVisibility:auto with an estimated intrinsic size, so real
// heights land as rows are measured and a pinned view can drift on its
// own. At 48px that drift silently unpinned the feed and it looked
// frozen with no user action.
const NEAR_BOTTOM_PX = 120;

const MIN_POLL_MS = 3000;
// Backoff is per-visible-tab and only resets when THAT tab sees rows, so
// the sparse System feed reliably drifted to the ceiling while idle.
// 10s halves the worst-case wait where it's actually noticeable.
const MAX_POLL_MS = 10000;
// Aggregate tool counts move slowly and cost a GROUP BY; poll them far
// slower than the log rows.
const COUNTS_POLL_MS = 30000;

// Nepal is UTC+5:45, no DST. A Nepal calendar day starts 18:15 UTC the
// day before. Computed here rather than in SQL because the dashboard
// already owns Nepal-time rendering, and the same offset in two places
// is how they drift apart.
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

// Sentinel for the "unrecognized traffic" bucket. Deliberately not a
// shape any real route could produce.
const OTHER_TRAFFIC_KEY = "__other__";

// Every focusable control uses this. A dashboard you can't drive from
// the keyboard is not a professional tool.
const FOCUS_RING =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 focus-visible:ring-offset-1 focus-visible:ring-offset-graphite-900";

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
  // Added alongside the tool/tier columns in request_logs. Optional
  // because rows written before the migration won't have them.
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

// GET /api/admin/endpoints — one entry per TOOL, from FastAPI's own
// route table, so tools with zero traffic still appear.
interface ToolEndpoint {
  path: string;
  label: string;
  methods: string[];
  // Real all-time total from the database, not a count of loaded rows.
  total_requests?: number;
}

// The `tools` array from the same response: only tags that have actually
// appeared in the data (tags are contextvar values, not a route table).
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
 * Three buckets, not two. "Failed" used to mean anything non-2xx, which
 * counted entirely normal traffic — a bot probing a dead route (404), a
 * rate limit (429), a full queue (503-by-design) — as the server being
 * broken. It wasn't.
 */
interface Totals {
  total: number;
  success: number;
  client: number;
  server: number;
}

type SystemGroup = { key: string; entries: SystemLogEntry[] };

/* ===================================================================
   Identifiers
   =================================================================== */

/** The backend writes "-" for "no id here". Treating that as a real id
 *  is how a row ends up looking clickable and then correlating on "-",
 *  which matches every unattributed line in the table. One helper so
 *  every caller agrees on what "absent" means. */
function realId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  return trimmed && trimmed !== "-" ? trimmed : null;
}

const _ACTION_SEGMENTS = new Set(["status", "preview", "download", "result"]);
const _ID_SEGMENT = /^[0-9a-f]{6,}(-[0-9a-f]{4,}){0,4}$/i;
const _FASTAPI_PARAM_SEGMENT = /^\{[^}]+\}$/;

/** Bounded memo. Paths and messages repeat enormously (a single job's 40
 *  status polls share one path string), and these run per row per
 *  render, so caching turns tens of thousands of splits per minute into
 *  one per distinct input. */
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
 * Walks left to right and stops at the first action word or id, which is
 * what keeps namespaced tools intact. The i > 0 guard matters: "download"
 * is both a real tool and an action segment, and without it the busiest
 * endpoint on the API resolves to an empty family. These two
 * implementations must agree or the picker and the filter disagree about
 * what a row belongs to.
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

/** Job id out of a request path. Same _ID_SEGMENT as the family logic,
 *  so the two can never disagree about what counts as an id. */
const jobIdFromPath = memoize1((path: string): string | null => {
  for (const seg of path.split("/")) {
    if (seg && _ID_SEGMENT.test(seg)) return seg;
  }
  return null;
});

// Logs write ids in prose, not as path segments. Both production shapes:
//   "[YOUTUBE_STEMS_HQ] job=0aee65ad... queued"
//   "[SEPARATION] Starting Demucs for job 0aee65ad..."
// This is the SECONDARY correlation path — request_id exists on every
// row, so it's preferred; this only covers rows where request_id is "-"
// but the message still names a job.
const _MSG_JOB_ID = /\bjob[=\s]+([0-9a-f]{6,}(?:-[0-9a-f]{4,}){0,4})\b/i;
const jobIdFromMessage = memoize1((message: string): string | null => {
  const m = _MSG_JOB_ID.exec(message);
  return m ? m[1] : null;
});

/* ===================================================================
   Noise
   =================================================================== */

// Bootstrap fallback only — covers the ~2s before the real list arrives
// from /api/admin/endpoints. Replaced in place rather than held in React
// state so isNoise() stays a plain function callable from memos all over
// this file. config.NOISE_PATH_MARKERS is the authority.
let NOISE_PATTERNS: string[] = [
  "/robots.txt", "/favicon.ico", "/.env", "/wp-", "/.git",
  "/SDK/", "/phpmyadmin", "/.well-known", "/xmlrpc.php",
];

// Case-insensitive: SQLite's LIKE is case-insensitive for ASCII, JS's
// .includes() is not — which is exactly how /language/en-GB/en-GB.xml
// slipped past a /language/en-gb pattern that matched fine server-side.
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

// Constructing Intl.DateTimeFormat is the expensive part of date
// formatting, and toLocaleTimeString() constructs a fresh one per call.
// Shared instances plus a per-timestamp cache means each row formats
// exactly once for its lifetime instead of on every poll.
const NP_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
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

function fmtMs(ms: number): string {
  return ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : ms.toFixed(0) + " ms";
}

function fmtAgo(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function statusDot(code: number): string {
  if (code >= 500) return "bg-red-500";
  if (code >= 400) return "bg-amber-500";
  if (code >= 300) return "bg-sky-400";
  return "bg-teal-400";
}

function statusText(code: number): string {
  if (code >= 500) return "text-red-400";
  if (code >= 400) return "text-amber-400";
  if (code >= 300) return "text-sky-400";
  return "text-teal-400";
}

function methodTone(method: string): string {
  switch (method) {
    case "POST": return "text-amber-400";
    case "DELETE": return "text-red-400";
    case "PUT":
    case "PATCH": return "text-sky-400";
    default: return "text-text-muted";
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

/** Merge a page of OLDER rows onto the front, dropping anything already
 *  held. Duplicates happen whenever a page boundary lands next to a
 *  delta poll, and a duplicated React key silently breaks rendering. */
function prependUnique<T extends { id: number }>(older: T[], current: T[]): T[] {
  if (older.length === 0) return current;
  const seen = new Set(current.map((r) => r.id));
  const fresh = older.filter((r) => !seen.has(r.id));
  return fresh.length === 0 ? current : [...fresh, ...current];
}

/**
 * Click vs. select.
 *
 * Every log row has an onClick and also contains text people want to
 * copy — an IP, a path, a request id. A browser fires click on mouseup
 * regardless of whether that mouseup ended a drag selection, so
 * highlighting an IP and releasing over the row ALSO opened the
 * correlated view and reset the selection. There was no way to copy
 * anything out of a row. A plain click never has a selection at
 * click-time, so ordinary row-opening is unaffected.
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

/** Render only the layout that's visible. Keeping both the desktop table
 *  and the mobile card list mounted means React reconciles up to 2x
 *  every row on every update, for a layout only one of which can be
 *  seen. Lazy initial read avoids a desktop-then-mobile flash. */
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

/** Escape-to-dismiss, in one place. Every overlay on this page uses it,
 *  so the keyboard behaviour can't drift between them. */
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

/** Re-renders on an interval, but only while `active`. Scoped to the one
 *  tiny component that shows relative time, so a 10s tick never
 *  reconciles 6000 log rows. */
function useTicker(active: boolean, intervalMs: number) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => force((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
}

/* ===================================================================
   Page
   =================================================================== */

export default function AdminLogsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("http");
  const isMobile = useIsMobile();

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
  // Tool/tier is a SEPARATE axis from endpointFilter (path family). It's
  // what actually answers "only HQ jobs", which path can't: HQ and
  // standard share polling routes after the initial submit.
  const [toolFilter, setToolFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier>("");
  const [toolOptions, setToolOptions] = useState<ToolCount[]>([]);

  // ---- System filters (independent axis; switching tabs must not
  // silently re-scope the list you left behind) ----
  const [levelFilter, setLevelFilter] = useState("");
  const [systemSearch, setSystemSearch] = useState("");
  const [sysToolFilter, setSysToolFilter] = useState("");
  const [sysTierFilter, setSysTierFilter] = useState<Tier>("");

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const httpSearchRef = useRef<HTMLInputElement>(null);
  const sysSearchRef = useRef<HTMLInputElement>(null);

  // ---- Correlation ----
  const [correlatedRequestId, setCorrelatedRequestId] = useState<string | null>(null);
  const [correlatedScope, setCorrelatedScope] = useState<"job" | "request">("request");
  const [correlatedSummary, setCorrelatedSummary] = useState<HttpLogEntry | null>(null);
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
  // Rows matching the CURRENT filters across the whole table. Distinct
  // from httpTotal (all rows) and httpLogs.length (rows in memory).
  // Reporting "loaded" as the match count is what made filtered views
  // look empty when the matches were simply older than the window.
  const [httpFilteredTotal, setHttpFilteredTotal] = useState(0);
  const [sysTotal, setSysTotal] = useState(0);
  const [sysFilteredTotal, setSysFilteredTotal] = useState(0);
  const [httpLoadingOlder, setHttpLoadingOlder] = useState(false);
  const [sysLoadingOlder, setSysLoadingOlder] = useState(false);
  const [httpHasOlder, setHttpHasOlder] = useState(true);
  const [sysHasOlder, setSysHasOlder] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Mirrors for use inside callbacks, which would otherwise close over
  // stale state. Refs are read at call time, not render time.
  const httpHasOlderRef = useRef(true);
  const sysHasOlderRef = useRef(true);
  const httpOldestRef = useRef(0);
  const sysOldestRef = useRef(0);

  // Scroll metrics captured before older rows are prepended.
  const httpScrollAdjustRef = useRef<{
    desk: [number, number] | null;
    mob: [number, number] | null;
  } | null>(null);
  const sysScrollAdjustRef = useRef<[number, number] | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sysRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // "Pinned to bottom" — auto-scroll follows new data. The instant the
  // reader scrolls up this flips false and new data stops yanking the
  // view; it re-pins when they scroll back or press Jump to latest.
  // Refs, not state, so scroll handlers don't re-render per tick.
  const httpPinnedRef = useRef(true);
  const sysPinnedRef = useRef(true);
  // One-shot: "next time the live system panel exists, put it at the
  // bottom." Set when leaving the correlated view, which remounts that
  // panel at scrollTop 0. A flag rather than a scroll call because the
  // node doesn't exist yet when clearCorrelated runs.
  const sysNeedsBottomRef = useRef(false);
  const [showJumpHttp, setShowJumpHttp] = useState(false);
  const [showJumpSys, setShowJumpSys] = useState(false);

  const httpInFlightRef = useRef(false);
  const sysInFlightRef = useRef(false);
  const httpOlderInFlightRef = useRef(false);
  const sysOlderInFlightRef = useRef(false);
  const httpSigRef = useRef("");
  const sysSigRef = useRef("");

  // Highest id held per tab. Delta polls send this as afterId so the
  // backend returns only genuinely new rows.
  const httpLastIdRef = useRef(0);
  const sysLastIdRef = useRef(0);
  const httpDeltaInFlightRef = useRef(false);
  const sysDeltaInFlightRef = useRef(false);

  // "Has a full fetch landed, so the cursor means something?" Replaces
  // using `lastId === 0`, which conflated never-fetched with
  // fetched-but-empty and fetched-but-filter-matched-nothing. Only the
  // first should block a delta poll.
  const httpSeededRef = useRef(false);
  const sysSeededRef = useRef(false);

  /**
   * One controller for all in-flight requests, aborted on unmount.
   *
   * Created through a getter that REPLACES an already-aborted controller.
   * The previous `if (abortRef.current === null)` version broke the page
   * under StrictMode: dev mounts, tears down, remounts — cleanup aborted
   * the only controller, and because the ref was non-null it was never
   * replaced, so every subsequent fetch bailed on an aborted signal. The
   * list sat empty and only a full reload recovered. An already-fired
   * controller is not a usable controller.
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

  // Debounced inputs. Declared above the refs that read them: a const
  // referenced before its declaration line is a temporal-dead-zone
  // ReferenceError, not a hoisted undefined. Debouncing matters more now
  // that filtering is server-side — each keystroke is a real query.
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
   * ALL filters go to the backend. They used to be applied in the browser
   * over whatever rows happened to be loaded, so every one of them
   * under-reported once the real result set outgrew the window — a tool
   * with 6 old requests showed "No requests match" while the stat boxes
   * above counted the whole table. Two answers to one question.
   *
   * Read through a ref because the fetch callbacks are memoized on
   * [router]; recreating them per filter change would retrigger every
   * effect keyed on their identity.
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
    // OTHER_TRAFFIC_KEY is a client-side grouping ("not any known tool"),
    // so there's no single family the server can filter on. That one case
    // stays client-side by necessity.
    if (f.endpointFilter && f.endpointFilter !== OTHER_TRAFFIC_KEY) {
      p.set("family", f.endpointFilter);
    }
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
    // system_logs carries the identical tags (set once per request,
    // inherited by every line that request and its background job emit),
    // so "only HQ separation" is answerable here too.
    if (f.sysToolFilter) p.set("tool", f.sysToolFilter);
    if (f.sysTierFilter) p.set("tier", f.sysTierFilter);
    const s = p.toString();
    return s ? `&${s}` : "";
  }, []);

  /* ---------------- Correlation ---------------- */

  // Guards against a slow earlier response overwriting a newer one when
  // rows are clicked in quick succession.
  const correlationTokenRef = useRef(0);

  const runCorrelation = useCallback(
    async (opts: {
      param: string;
      id: string;
      scope: "job" | "request";
      summary: HttpLogEntry | null;
    }) => {
      const token = ++correlationTokenRef.current;
      setCorrelatedSummary(opts.summary);
      setCorrelatedRequestId(opts.id);
      setCorrelatedScope(opts.scope);
      setCorrelatedLogs([]);
      setCorrelatedError(null);
      setCorrelatedLoading(true);
      setTab("system");
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
   * HTTP row -> logs. Prefers JOB scope whenever the path carries a job
   * id, because that's the question being asked.
   *
   * A job's ~40 status-poll GETs each have their own request_id but log
   * nothing (the handler is a dict lookup; logging every poll would flood
   * system_logs for zero debugging value). Correlating a poll by
   * request_id returns an empty list: technically correct, reads as
   * broken. The job id is shared across the whole lifecycle, so it
   * surfaces the real story no matter which row was clicked.
   */
  const loadCorrelated = useCallback(
    async (log: HttpLogEntry) => {
      const jobId = jobIdFromPath(log.path);
      const reqId = realId(log.request_id);
      if (jobId) {
        await runCorrelation({
          param: `job_id=${encodeURIComponent(jobId)}`,
          id: jobId, scope: "job", summary: log,
        });
      } else if (reqId) {
        await runCorrelation({
          param: `requestId=${encodeURIComponent(reqId)}`,
          id: reqId, scope: "request", summary: log,
        });
      }
    },
    [runCorrelation]
  );

  /**
   * System row -> logs, the reverse direction. Previously a row was only
   * clickable when the MESSAGE TEXT spelled out "job=<id>", so a plain
   * ERROR line or a startup failure was a dead end even though it
   * belonged to a real, correlatable request. request_id is on every line
   * and is set by middleware regardless of message content, so it's the
   * reliable fallback; job id stays the preference because a job's full
   * lifecycle is usually more useful than one request's slice of it.
   */
  const loadCorrelatedFromSystemRow = useCallback(
    async (entry: SystemLogEntry) => {
      const jobId = jobIdFromMessage(entry.message);
      const reqId = realId(entry.request_id);
      if (jobId) {
        await runCorrelation({
          param: `job_id=${encodeURIComponent(jobId)}`,
          id: jobId, scope: "job", summary: null,
        });
      } else if (reqId) {
        await runCorrelation({
          param: `requestId=${encodeURIComponent(reqId)}`,
          id: reqId, scope: "request", summary: null,
        });
      }
    },
    [runCorrelation]
  );

  // fetchSystem is declared below (it depends on state not set up yet
  // here), so clearCorrelated reaches it through a ref. Side benefit:
  // clearCorrelated stays referentially stable, so the Escape listener
  // doesn't re-bind whenever fetchSystem's identity changes.
  const fetchSystemRef = useRef<((force?: boolean) => void) | null>(null);

  const clearCorrelated = useCallback(() => {
    correlationTokenRef.current++; // invalidate any in-flight response
    setCorrelatedRequestId(null);
    setCorrelatedScope("request");
    setCorrelatedSummary(null);
    setCorrelatedLogs([]);
    setCorrelatedError(null);
    // Closing swaps in a BRAND NEW live scroll container at scrollTop 0.
    // The pin effect keys on the log array's identity, which hasn't
    // changed (polling was paused while this view was open), so without
    // forcing it you land at the top of the list instead of the newest
    // line. Closing a detail view always returns you to the tail.
    sysPinnedRef.current = true;
    sysNeedsBottomRef.current = true;
    setShowJumpSys(false);
    fetchSystemRef.current?.(true);
  }, []);

  useEscape(!!correlatedRequestId, clearCorrelated);

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

      // Seed the delta cursor HERE — before the signature guard, and
      // regardless of whether this query matched anything.
      //
      // Two bugs converged on this line. The cursor used to be set only
      // inside `if (rows.length > 0)`, so a filter matching zero rows left
      // it at 0 and delta polling was permanently dead for that filter —
      // rows arriving later that DID match never appeared. Separately, the
      // signature guard returns early on an unchanged response, which
      // skipped seeding entirely. Seeding first makes that guard purely
      // about rendering, which is all it was meant to be.
      const newestMatching = data.logs.length > 0 ? data.logs[0].id : 0;
      httpLastIdRef.current = Math.max(newestMatching, data.max_id ?? 0);
      httpSeededRef.current = true;

      // Most polls return what we already have. A cheap signature makes
      // identical responses complete no-ops instead of re-rendering every
      // row for zero visual change. filtered_total is included so a filter
      // change returning the same row count still registers.
      const sig = [
        data.total, data.filtered_total, data.success, data.client,
        data.server, data.logs.length, data.logs[0]?.id ?? 0,
      ].join(":");
      if (sig === httpSigRef.current) return;
      httpSigRef.current = sig;

      setTotals({
        total: data.total, success: data.success,
        client: data.client, server: data.server,
      });
      setHttpTotal(data.total);
      if (typeof data.filtered_total === "number") setHttpFilteredTotal(data.filtered_total);
      // Backend returns newest-first; reverse so the newest lands at the
      // bottom, like a terminal tail.
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
    // Without unpinning, the next poll would slam the view back down and
    // undo the load.
    httpPinnedRef.current = false;
    setShowJumpHttp(true);

    httpScrollAdjustRef.current = {
      desk: scrollRef.current
        ? [scrollRef.current.scrollHeight, scrollRef.current.scrollTop] : null,
      mob: mobileScrollRef.current
        ? [mobileScrollRef.current.scrollHeight, mobileScrollRef.current.scrollTop] : null,
    };

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
        setHttpLogs((prev) => prependUnique(older, prev));
      } else {
        httpScrollAdjustRef.current = null;
      }
      setHttpError(null);
    } catch (e) {
      httpScrollAdjustRef.current = null;
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

      // Same reasoning as fetchHttp. This tab is where it bit hardest —
      // its filters (level=ERROR, a tool tag, a search term) routinely
      // match nothing at the moment they're applied, which is exactly
      // when you're sitting there waiting for the next matching line.
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

  // Wire the ref in an effect rather than during render — assigning to a
  // ref mid-render is a side effect React doesn't guarantee runs once.
  // clearCorrelated can only fire from a user event, which is always
  // after the first commit.
  useEffect(() => {
    fetchSystemRef.current = fetchSystem;
  }, [fetchSystem]);

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

      // The backend caps this branch (_DELTA_MAX). Hitting the cap means
      // we're too far behind to catch up incrementally, and splicing a
      // truncated middle would leave a silent hole in the log. Re-seed
      // from a normal page instead.
      if (data.truncated) {
        httpSigRef.current = "";
        fetchHttp(true);
        return true;
      }

      setTotals({
        total: data.total, success: data.success,
        client: data.client, server: data.server,
      });
      setHttpTotal(data.total);
      if (typeof data.filtered_total === "number") setHttpFilteredTotal(data.filtered_total);
      setHttpError(null);
      markUpdated();
      if (!data.logs || data.logs.length === 0) return false;

      setHttpLogs((prev) => {
        const merged = [...prev, ...data.logs];
        // Trim ONLY while following the tail. Trimming while the reader is
        // back in history would delete the pages they just waited for.
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
        fetchSystem(true);
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

  /* ---------------- Scrolling ---------------- */

  const handleHttpScroll = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    httpPinnedRef.current = nearBottom;
    setShowJumpHttp(!nearBottom); // React bails when unchanged
    if (el.scrollTop < AUTO_LOAD_PX) loadOlderHttp();
  }, [loadOlderHttp]);

  const handleSysScroll = useCallback(() => {
    const el = sysRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    sysPinnedRef.current = nearBottom;
    setShowJumpSys(!nearBottom);
    if (el.scrollTop < AUTO_LOAD_PX) loadOlderSystem();
  }, [loadOlderSystem]);

  const jumpToBottomHttp = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
    }
    httpPinnedRef.current = true;
    setShowJumpHttp(false);
  }, []);

  const jumpToBottomSys = useCallback(() => {
    const el = sysRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    sysPinnedRef.current = true;
    setShowJumpSys(false);
  }, []);

  /* ---------------- Endpoints / tools ---------------- */

  const [knownEndpoints, setKnownEndpoints] = useState<ToolEndpoint[]>([]);
  // NOISE_PATTERNS is a module-level array, not React state, so memos
  // that call isNoise() need a signal that the definition changed. This
  // counter is it — otherwise they run against stale data until some
  // unrelated state change happens to force a recompute.
  const [noiseListVersion, setNoiseListVersion] = useState(0);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/endpoints", {
        cache: "no-store", signal: signal(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as EndpointsApiResponse;
      // Backend already collapses to one entry per tool and sorts by
      // label — no client-side dedupe, which is the point of doing it
      // where the route table lives.
      if (Array.isArray(data?.endpoints)) setKnownEndpoints(data.endpoints);
      if (Array.isArray(data?.tools)) setToolOptions(data.tools);
      // Replaces the bootstrap fallback with the backend's canonical list,
      // the same one the SQL client-errors exclusion uses — so "Hide
      // noise" and that stat can no longer silently disagree.
      if (Array.isArray(data?.noise_patterns) && data.noise_patterns.length > 0) {
        NOISE_PATTERNS = data.noise_patterns;
        setNoiseListVersion((v) => v + 1);
      }
    } catch {
      // Fire-and-forget: a failure just means the picker keeps the values
      // it has. Never worth erroring the dashboard over.
    }
  }, []);

  /**
   * Runs once per MOUNT. There used to be a bootedRef guard to make it
   * once-per-page-load, but a ref survives StrictMode's remount while the
   * aborted fetches from the first mount do not — so the guard turned
   * "the first mount's requests got cancelled" into "and no request is
   * ever issued again". The in-flight refs already collapse genuine
   * duplicates into no-ops.
   */
  useEffect(() => {
    fetchHttp();
    fetchSystem();
    fetchEndpoints();
  }, [fetchHttp, fetchSystem, fetchEndpoints]);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      fetchEndpoints();
    }, COUNTS_POLL_MS);
    return () => clearInterval(id);
  }, [isPaused, fetchEndpoints]);

  /* ---------------- Scroll anchoring ---------------- */

  // useLayoutEffect, not useEffect: the scroll write has to land in the
  // same frame the rows commit, or the browser paints the un-adjusted
  // position first and you see a jump.
  useLayoutEffect(() => {
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
      if (mobileScrollRef.current) {
        mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
      }
    }
  }, [httpLogs]);

  // Level and search are applied in SQL, so what came back already
  // matches. Kept as a named binding because the anchoring effect and the
  // grouping memo key on this identity.
  const filteredSystemLogs = systemLogs;

  /**
   * Groups CONSECUTIVE lines sharing a request_id into one visual unit.
   * A single download logs 20+ lines (retries, cookie rotation, progress
   * ticks, cache save, complete); showing every one at full height
   * recreates the "too much scrolling to find anything" problem the
   * click-through was built to solve. Show the two lines that matter —
   * what started, what it ended as — and fold the rest.
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
      if (prevEntry && id && id === realId(prevEntry.request_id)) {
        prev.entries.push(entry);
      } else {
        groups.push({ key: `g${entry.id}`, entries: [entry] });
      }
    }
    return groups;
  }, [filteredSystemLogs]);

  // Keyed by the group's own key, not request_id: an id can recur across
  // separate groups (retrying the same video later) and those should
  // expand independently.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Trimmed groups leave their keys behind forever otherwise — a slow
  // leak on a dashboard designed to be left open all day.
  useEffect(() => {
    setExpandedGroups((prev) => {
      if (prev.size < 200) return prev;
      const live = new Set(systemGroups.map((g) => g.key));
      const next = new Set([...prev].filter((k) => live.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [systemGroups]);

  useLayoutEffect(() => {
    const el = sysRef.current;
    if (!el) return;
    const adjust = sysScrollAdjustRef.current;
    if (adjust) {
      el.scrollTop = el.scrollHeight - adjust[0] + adjust[1];
      sysScrollAdjustRef.current = null;
      return;
    }
    if (sysPinnedRef.current) el.scrollTop = el.scrollHeight;
    // Depends on the rendered list: a filter changes content height
    // without systemLogs changing, and anchoring on the unfiltered array
    // would strand the view mid-list.
  }, [filteredSystemLogs]);

  // Consumes the one-shot flag from clearCorrelated(). A layout effect
  // runs after the new node is in the DOM but before paint, so the jump
  // is never visible as a flash at the top.
  useLayoutEffect(() => {
    if (correlatedRequestId || !sysNeedsBottomRef.current) return;
    const el = sysRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    sysNeedsBottomRef.current = false;
  }, [correlatedRequestId, filteredSystemLogs]);

  // Switching tabs unmounts the other panel, so its container is a new
  // element at scrollTop 0 when it returns. The System panel never got
  // pinned on first view for exactly this reason: its container didn't
  // exist when the boot fetch landed.
  useLayoutEffect(() => {
    if (tab === "http") {
      if (httpPinnedRef.current) {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        if (mobileScrollRef.current) {
          mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
        }
      }
      setShowJumpHttp(!httpPinnedRef.current);
    } else {
      const el = sysRef.current;
      if (el && sysPinnedRef.current) el.scrollTop = el.scrollHeight;
      setShowJumpSys(!sysPinnedRef.current);
    }
  }, [tab, isMobile]);

  // Full (not delta) refresh on tab switch: the cursors need seeding
  // before delta polling can do anything useful for a tab that may not
  // have been fetched in a while. Paused means no automatic fetch, full
  // stop — this used to fetch unconditionally, which looked exactly like
  // pause silently turning itself off.
  useEffect(() => {
    if (isPaused) return;
    if (tab === "http") fetchHttp();
    else fetchSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isPaused]);

  /* ---------------- Filter changes ---------------- */

  // Filtering is server-side, so the loaded window is scoped to whatever
  // query produced it: changing a filter has to re-query, not re-filter
  // rows fetched under different criteria. Cursors reset because the old
  // ids belong to the previous result set.
  const filterBootRef = useRef(true);
  useEffect(() => {
    if (filterBootRef.current) { filterBootRef.current = false; return; }
    if (tab !== "http") return;
    httpSigRef.current = "";
    httpLastIdRef.current = 0;
    httpSeededRef.current = false;
    httpOldestRef.current = 0;
    httpHasOlderRef.current = true;
    setHttpHasOlder(true);
    httpPinnedRef.current = true; // a fresh query starts at its newest end
    setShowJumpHttp(false);
    fetchHttp(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpointFilter, methodFilter, debouncedPath, statusClassFilter, dateFilter, hideNoise, toolFilter, tierFilter]);

  const sysFilterBootRef = useRef(true);
  useEffect(() => {
    if (sysFilterBootRef.current) { sysFilterBootRef.current = false; return; }
    if (tab !== "system") return;
    sysSigRef.current = "";
    sysLastIdRef.current = 0;
    sysSeededRef.current = false;
    sysOldestRef.current = 0;
    sysHasOlderRef.current = true;
    setSysHasOlder(true);
    sysPinnedRef.current = true;
    setShowJumpSys(false);
    fetchSystem(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelFilter, debouncedSystemSearch, sysToolFilter, sysTierFilter]);

  /* ---------------- Self-adjusting poll ---------------- */

  // Starts fast; every empty tick stretches the delay (capped), so a quiet
  // dashboard left open gradually polls less. Any tick that finds data —
  // or any manual interaction — snaps back. Recursive setTimeout because
  // the delay itself changes between ticks.
  useEffect(() => {
    if (isPaused) return;
    // The correlated view is a fixed historical result set — nothing it
    // shows can change, so polling burns requests for offscreen data.
    if (correlatedRequestId) return;
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
  }, [isPaused, tab, correlatedRequestId, fetchHttpDelta, fetchSystemDelta]);

  // Snap back to fast polling on refocus rather than making the user wait
  // out accumulated backoff. Respects pause for the same reason the poll
  // loop does — the two must never disagree about whether polling is
  // allowed.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden || isPaused) return;
      currentDelayRef.current = MIN_POLL_MS;
      if (tab === "http") fetchHttpDelta();
      else fetchSystemDelta();
      fetchEndpoints();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [tab, isPaused, fetchHttpDelta, fetchSystemDelta, fetchEndpoints]);

  /* ---------------- Keyboard shortcuts ---------------- */

  // "/" to search, "p" to pause, "r" to refresh — the three things you
  // reach for constantly while watching a feed. Ignored while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        (tab === "http" ? httpSearchRef : sysSearchRef).current?.focus();
      } else if (e.key === "p") {
        setIsPaused((p) => !p);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tab]);

  /* ---------------- Derived: tools, suggestions, chips ---------------- */

  /**
   * Which paths are REAL, backend-registered tools — the only ones
   * allowed their own picker entry. This is what actually solves the
   * scanner-noise problem: one day of traffic produced ~300 distinct junk
   * paths, and a hand-maintained pattern list can never keep pace with
   * new campaigns. Unrecognized traffic just has nowhere to go but
   * "Other", automatically, forever.
   */
  const knownPathSet = useMemo(
    () => new Set(knownEndpoints.map((e) => e.path)),
    [knownEndpoints]
  );

  const endpointOptions = useMemo(() => {
    const byPath = new Map<string, { path: string; label: string; count: number; loaded: number }>();
    for (const ep of knownEndpoints) {
      byPath.set(ep.path, {
        path: ep.path,
        label: ep.label,
        // Real all-time total. This used to start at 0 and increment per
        // LOADED row, so the number shrank as the window trimmed — a tool
        // showing 967 quietly became 233 after scrolling, which reads as
        // "requests disappeared".
        count: ep.total_requests ?? 0,
        loaded: 0,
      });
    }

    let otherCount = 0;
    let otherLoaded = 0;
    for (const log of httpLogs) {
      if (!log.path) continue;
      if (hideNoise && isNoise(log.path)) continue;
      const existing = byPath.get(toolFamily(log.path));
      if (existing) {
        existing.loaded += 1;
      } else {
        // NOT a registered tool. This used to humanize the raw path into a
        // plausible name, which is how "/___proxy_subdomain_whm/login/"
        // became a dropdown entry reading "Proxy Subdomain Whm Login",
        // indistinguishable from a real tool.
        otherCount += 1;
        otherLoaded += 1;
      }
    }

    const all = [...byPath.values()];
    if (otherCount > 0) {
      all.push({
        path: OTHER_TRAFFIC_KEY,
        label: "Other (unrecognized traffic)",
        count: otherCount,
        loaded: otherLoaded,
      });
    }

    // Busy tools first, then quiet ones alphabetically — still findable,
    // just not competing with live activity for the top.
    const active = all.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
    const idle = all.filter((e) => e.count === 0).sort((a, b) => a.label.localeCompare(b.label));
    return [...active, ...idle];
  }, [httpLogs, hideNoise, knownEndpoints, noiseListVersion]);

  // Matches on BOTH label and path, so "convert" and "/convert" both
  // work. Empty input shows the busiest tools rather than nothing —
  // that's the "I know what it does but forgot the name" case, which is
  // the whole reason this exists. Capped at 8 so it never covers the
  // table.
  const pathSuggestions = useMemo(() => {
    const needle = pathFilter.trim().toLowerCase();
    if (!needle) return endpointOptions.slice(0, 8);
    return endpointOptions
      .filter((e) =>
        e.label.toLowerCase().includes(needle) || e.path.toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [endpointOptions, pathFilter]);

  // Only one of the two can be set at a time (picking from either section
  // clears the other), so this is precedence, not combination.
  const activeToolLabel = useMemo(() => {
    if (toolFilter) return toolOptions.find((t) => t.tool === toolFilter)?.label ?? toolFilter;
    if (endpointFilter) {
      return endpointOptions.find((e) => e.path === endpointFilter)?.label ?? endpointFilter;
    }
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

  // Deviations from DEFAULT, not merely non-empty values: hideNoise
  // defaults on, so having it on isn't a filter you applied — turning it
  // off is. Doubles as the removable-chip list.
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (activeToolLabel) {
      chips.push({
        key: "tool",
        label: activeToolLabel,
        clear: () => { setToolFilter(""); setEndpointFilter(""); },
      });
    }
    if (methodFilter) {
      chips.push({ key: "method", label: methodFilter, clear: () => setMethodFilter("") });
    }
    if (tierFilter) {
      chips.push({
        key: "tier",
        label: tierFilter === "hq" ? "HQ only" : "Standard only",
        clear: () => setTierFilter(""),
      });
    }
    if (statusClassFilter !== "all") {
      chips.push({
        key: "status",
        label: `${statusClassFilter} only`,
        clear: () => setStatusClassFilter("all"),
      });
    }
    if (dateFilter !== "all") {
      chips.push({
        key: "date",
        label: dateFilter === "today" ? "Today" : "Yesterday",
        clear: () => setDateFilter("all"),
      });
    }
    if (pathFilter) {
      chips.push({ key: "q", label: `“${pathFilter}”`, clear: () => setPathFilter("") });
    }
    if (!hideNoise) {
      chips.push({ key: "noise", label: "Noise shown", clear: () => setHideNoise(true) });
    }
    return chips;
  }, [
    activeToolLabel, methodFilter, tierFilter, statusClassFilter,
    dateFilter, pathFilter, hideNoise,
  ]);

  const sysActiveFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (levelFilter) {
      chips.push({ key: "level", label: levelFilter, clear: () => setLevelFilter("") });
    }
    if (sysToolFilter) {
      chips.push({
        key: "tool",
        label: toolOptions.find((t) => t.tool === sysToolFilter)?.label ?? sysToolFilter,
        clear: () => setSysToolFilter(""),
      });
    }
    if (sysTierFilter) {
      chips.push({
        key: "tier",
        label: sysTierFilter === "hq" ? "HQ only" : "Standard only",
        clear: () => setSysTierFilter(""),
      });
    }
    if (systemSearch) {
      chips.push({ key: "q", label: `“${systemSearch}”`, clear: () => setSystemSearch("") });
    }
    return chips;
  }, [levelFilter, sysToolFilter, sysTierFilter, systemSearch, toolOptions]);

  const resetSysFilters = useCallback(() => {
    setLevelFilter("");
    setSysToolFilter("");
    setSysTierFilter("");
    setSystemSearch("");
  }, []);

  /**
   * Everything the server returned already matches the active filters, so
   * re-filtering here would be redundant at best and could silently drop
   * rows if the two implementations ever disagreed.
   *
   * The ONE exception is the "Other" bucket: it means "not any known
   * tool", which is defined by the client's knowledge of the tool list,
   * so the server has no single family to filter on.
   */
  const otherBucketActive = endpointFilter === OTHER_TRAFFIC_KEY;
  const filtered = useMemo(() => {
    if (!otherBucketActive) return httpLogs;
    return httpLogs.filter((log) => !knownPathSet.has(toolFamily(log.path)));
  }, [httpLogs, otherBucketActive, knownPathSet]);

  /* ---------------- Destructive actions ---------------- */

  function requestDelete(olderThanDays: number | null) {
    setToast(null);
    setPendingDelete(olderThanDays);
  }

  async function confirmDelete() {
    if (pendingDelete === "none") return;
    const olderThanDays = pendingDelete;
    setDeleteRunning(true);
    try {
      const url = olderThanDays
        ? `/api/admin/logs?olderThanDays=${olderThanDays}`
        : `/api/admin/logs`;
      const res = await fetch(url, { method: "DELETE", signal: signal() });
      if (res.status === 401) { router.push("/admin/login"); return; }
      const data = await res.json().catch(() => null);
      // Was missing: a 500 returning HTML parsed to null and still
      // reported success.
      if (!res.ok) throw new Error(data?.error || `Server returned ${res.status}`);
      const n = data?.deleted_http_logs ?? 0;
      setToast({
        tone: "ok",
        text:
          `Removed ${n.toLocaleString()} HTTP log ${n === 1 ? "entry" : "entries"}` +
          (data?.system_buffer_cleared ? " and cleared the system log buffer." : "."),
      });
      // Everything held is now stale or gone — reset the cursors and
      // re-seed rather than paging off a dead id.
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
      fetchHttp(true);
      fetchSystem(true);
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
    // Minimum spin so the button reads as having done something even when
    // the response is instant.
    const minSpin = new Promise((r) => setTimeout(r, 400));
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

  /* =================================================================
     Render
     ================================================================= */

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 flex flex-col gap-4">
      {/* ===== Heading ===== */}
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Request logs</h1>
          <LiveStatus isPaused={isPaused} lastUpdatedAt={lastUpdatedAt} />
        </div>
        <div
          role="tablist"
          aria-label="Log source"
          className="flex rounded-lg border border-graphite-800 bg-graphite-900 p-0.5 self-start sm:self-auto"
        >
          <TabButton
            active={tab === "http"}
            onClick={() => setTab("http")}
            icon={Activity}
            label="HTTP"
          />
          <TabButton
            active={tab === "system"}
            onClick={() => setTab("system")}
            icon={Terminal}
            label="System"
          />
        </div>
      </header>

      {tab === "http" ? (
        <>
          {/* ===== Stats =====
              4xx is amber as a mild "worth a glance" — it's normal traffic
              (bots, rate limits, rejected uploads). 5xx turns red only
              above zero, and is the one worth investigating. */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg border border-graphite-800 bg-graphite-800 overflow-hidden">
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

          {/* NOTE: no overflow-hidden on this card — it would clip the
              Delete menu, which needs to escape the card bounds. */}
          <section className="rounded-lg border border-graphite-800 bg-graphite-900 flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 flex flex-col gap-2.5 px-3 sm:px-4 py-3 border-b border-graphite-800">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <SearchBox
                  inputRef={httpSearchRef}
                  value={pathFilter}
                  onChange={(v) => {
                    setPathFilter(v);
                    setSuggestOpen(true);
                    setHighlightIndex(-1);
                  }}
                  onClear={() => { setPathFilter(""); setHighlightIndex(-1); }}
                  // Global search now, not path-only: the backend's `q`
                  // spans path, IP, method, request id, tool tag and a bare
                  // 3-digit status. "Filter by path…" was an accurate label
                  // for a box that could answer one question, and typing an
                  // IP into it returned nothing with no hint why.
                  placeholder="Search path, IP, status, tool…"
                  combobox={{
                    open: suggestOpen && pathSuggestions.length > 0,
                    setOpen: setSuggestOpen,
                    highlightIndex,
                    setHighlightIndex,
                    suggestions: pathSuggestions,
                    onPick: (path) => {
                      // Sets the EXACT tool filter, not a fuzzy substring —
                      // picking "Convert" from a list of tools should mean
                      // that tool, not "anything containing convert".
                      setEndpointFilter(path);
                      setPathFilter("");
                      setSuggestOpen(false);
                      setHighlightIndex(-1);
                    },
                  }}
                />

                {/* Mobile: collapse eight controls behind one button. The
                    badge shows how many are active, so a filtered view is
                    never silently hidden behind a closed panel. */}
                <button
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-expanded={filtersOpen}
                  className={`sm:hidden shrink-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${FOCUS_RING} ${
                    filtersOpen || activeFilters.length > 0
                      ? "border-amber-500/50 text-amber-400"
                      : "border-graphite-700 text-text-muted"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {activeFilters.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-amber-500 text-graphite-950 px-1.5 text-[10px] font-semibold tabular-nums">
                      {activeFilters.length}
                    </span>
                  )}
                </button>

                {/* Always visible on every screen size. These control the
                    feed itself, not what's shown in it, so hiding them
                    behind "Filters" would be a trap. */}
                <div className="hidden sm:block h-5 w-px bg-graphite-800" />
                {actionBar}
              </div>

              <div className={`${filtersOpen ? "flex" : "hidden"} sm:flex flex-wrap items-center gap-2`}>
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

                {/* ONE tool picker, two sections — not two dropdowns. They
                    previously sat side by side both reading "All tools",
                    which is genuinely ambiguous: nothing said one meant
                    "the tool the backend tagged this as" and the other
                    meant "the URL shape it hit". Tagged tools first
                    (they're the accurate ones), path families below for the
                    cases tags can't cover: legacy rows, scanner traffic. */}
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
                <div
                  role="group"
                  aria-label="Status class"
                  className="flex rounded-md border border-graphite-700 bg-graphite-850 p-0.5"
                >
                  <StatusChip active={statusClassFilter === "all"} onClick={() => setStatusClassFilter("all")} label="All" />
                  <StatusChip active={statusClassFilter === "4xx"} onClick={() => setStatusClassFilter("4xx")} label="4xx" tone="text-amber-400" />
                  <StatusChip active={statusClassFilter === "5xx"} onClick={() => setStatusClassFilter("5xx")} label="5xx" tone="text-red-400" />
                </div>
                <label className="flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-text-muted select-none cursor-pointer whitespace-nowrap hover:text-text-primary transition-colors">
                  <input
                    type="checkbox"
                    checked={hideNoise}
                    onChange={(e) => setHideNoise(e.target.checked)}
                    className={`accent-amber-500 ${FOCUS_RING}`}
                  />
                  Hide noise
                </label>
              </div>

              {/* Every applied filter, visible and individually removable.
                  A single "Clear" button tells you something is filtered
                  but not what — which is how you end up staring at an empty
                  table wondering why. */}
              {activeFilters.length > 0 && (
                <FilterChips chips={activeFilters} onClearAll={resetFilters} />
              )}
            </div>

            {/* Desktop table */}
            {!isMobile && (
              <div className="relative flex-1 min-h-0">
                <div
                  ref={scrollRef}
                  onScroll={(e) => handleHttpScroll(e.currentTarget)}
                  className="h-full overflow-y-auto scrollbar-thin"
                >
                  <TopSentinel
                    loading={httpLoadingOlder}
                    hasOlder={httpHasOlder}
                    count={httpLogs.length}
                    total={httpFilteredTotal}
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
                      {httpLoading && httpLogs.length === 0
                        ? Array.from({ length: 12 }).map((_, i) => <SkeletonTableRow key={i} />)
                        : filtered.map((log) => (
                            <HttpTableRow key={log.id} log={log} onOpenLogs={loadCorrelated} />
                          ))}
                    </tbody>
                  </table>
                  <ListState
                    loading={httpLoading && httpLogs.length === 0}
                    error={httpError}
                    empty={filtered.length === 0}
                    emptyTitle={httpLogs.length === 0 && activeFilters.length === 0
                      ? "Nothing logged yet"
                      : "No matching requests"}
                    emptyBody={activeFilters.length > 0
                      ? "Nothing in the whole table matches these filters."
                      : "Requests will appear here as they arrive."}
                    onClearFilters={activeFilters.length > 0 ? resetFilters : undefined}
                    onRetry={httpError ? () => fetchHttp(true) : undefined}
                  />
                </div>
                {showJumpHttp && <JumpButton onClick={jumpToBottomHttp} />}
              </div>
            )}

            {/* Mobile rows */}
            {isMobile && (
              <div className="relative flex-1 min-h-0">
                <div
                  ref={mobileScrollRef}
                  onScroll={(e) => handleHttpScroll(e.currentTarget)}
                  className="h-full overflow-y-auto scrollbar-thin"
                >
                  <TopSentinel
                    loading={httpLoadingOlder}
                    hasOlder={httpHasOlder}
                    count={httpLogs.length}
                    total={httpFilteredTotal}
                  />
                  <div className="divide-y divide-graphite-800/70">
                    {filtered.map((log) => (
                      <HttpCardRow key={log.id} log={log} onOpenLogs={loadCorrelated} />
                    ))}
                  </div>
                  <ListState
                    loading={httpLoading && httpLogs.length === 0}
                    error={httpError}
                    empty={filtered.length === 0}
                    emptyTitle={httpLogs.length === 0 && activeFilters.length === 0
                      ? "Nothing logged yet"
                      : "No matching requests"}
                    emptyBody={activeFilters.length > 0
                      ? "Nothing in the whole table matches these filters."
                      : "Requests will appear here as they arrive."}
                    onClearFilters={activeFilters.length > 0 ? resetFilters : undefined}
                    onRetry={httpError ? () => fetchHttp(true) : undefined}
                  />
                </div>
                {showJumpHttp && <JumpButton onClick={jumpToBottomHttp} />}
              </div>
            )}

            <Footer
              loaded={filtered.length}
              // The "Other" bucket is filtered client-side, so the server's
              // filtered_total counts rows this view is deliberately
              // hiding. Reporting it here would be the same
              // two-answers-to-one-question bug in a new place.
              matching={otherBucketActive ? null : httpFilteredTotal}
              total={httpTotal}
            />
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-graphite-800 bg-graphite-900 overflow-hidden flex-1 min-h-0 flex flex-col">
          <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-3 border-b border-graphite-800">
            <p className="text-sm text-text-muted">
              System log
              {sysTotal > 0 && (
                <span className="text-text-subtle tabular-nums">
                  {" · "}{systemLogs.length.toLocaleString()} of{" "}
                  {sysFilteredTotal.toLocaleString()} matching
                </span>
              )}
            </p>
            <div className="flex items-center gap-1.5 sm:gap-2">{actionBar}</div>
          </div>

          {/* Filters are hidden while viewing a correlated request: that's
              already a fixed result set, and a second filter on top would
              be ambiguous about which one produced what's on screen. */}
          {!correlatedRequestId && (
            <div className="shrink-0 flex flex-col gap-2.5 px-3 sm:px-4 py-2.5 border-b border-graphite-800">
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
                  options={[
                    { value: "", label: "All tools" },
                    ...toolOptions.map((t) => ({ value: t.tool, label: t.label })),
                  ]}
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
              {sysActiveFilters.length > 0 && (
                <FilterChips chips={sysActiveFilters} onClearAll={resetSysFilters} />
              )}
            </div>
          )}

          {correlatedRequestId ? (
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 flex items-start justify-between gap-3 px-3 sm:px-4 py-2.5 border-b border-amber-500/30 bg-amber-500/[0.06]">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-amber-400">
                    {correlatedScope === "job"
                      ? "Every log line for this job"
                      : "Log lines for one request"}
                  </p>
                  {correlatedSummary && (
                    <p className="text-[11px] text-text-subtle font-mono truncate mt-0.5">
                      {correlatedSummary.method} {correlatedSummary.path} →{" "}
                      {correlatedSummary.status_code}
                      {" · "}
                      {npDate(correlatedSummary.timestamp)} {npTime(correlatedSummary.timestamp)}
                      {!correlatedLoading && (
                        <>
                          {" · "}{correlatedLogs.length} line
                          {correlatedLogs.length === 1 ? "" : "s"}
                        </>
                      )}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-text-subtle font-mono truncate">
                      {correlatedScope === "job" ? "job" : "request"} {correlatedRequestId}
                    </span>
                    <CopyButton text={correlatedRequestId} label="Copy id" />
                  </div>
                </div>
                <button
                  onClick={clearCorrelated}
                  className={`shrink-0 flex items-center gap-1 rounded-md border border-graphite-700 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 transition-colors ${FOCUS_RING}`}
                >
                  <X className="h-3 w-3" />
                  <span className="hidden sm:inline">Back to live log</span>
                  <span className="sr-only sm:hidden">Back to live log</span>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin font-mono text-xs">
                {correlatedLoading && (
                  <p className="flex items-center justify-center gap-2 text-center text-sm text-text-subtle py-12">
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                    Loading…
                  </p>
                )}
                {correlatedError && (
                  <p className="text-center text-sm text-red-400 py-12 px-4" role="alert">
                    Couldn&apos;t load: {correlatedError}
                  </p>
                )}
                {!correlatedLoading && !correlatedError && correlatedLogs.length === 0 && (
                  <p className="text-center text-sm text-text-subtle py-12 px-4">
                    No system log lines were recorded for this{" "}
                    {correlatedScope === "job" ? "job" : "request"}.
                  </p>
                )}
                {correlatedLogs.map((entry) => (
                  // newGroup is always false: every line here belongs to
                  // the same request/job by construction, so there are no
                  // boundaries to mark. onOpenEntry is omitted because this
                  // view already shows exactly one job — making its lines
                  // clickable would reload the identical view.
                  <SystemRow key={entry.id} entry={entry} newGroup={false} />
                ))}
              </div>
            </div>
          ) : (
            <div className="relative flex-1 min-h-0">
              <div
                ref={sysRef}
                onScroll={handleSysScroll}
                className="h-full overflow-y-auto scrollbar-thin font-mono text-xs"
              >
                <TopSentinel
                  loading={sysLoadingOlder}
                  hasOlder={sysHasOlder}
                  count={systemLogs.length}
                  total={sysFilteredTotal}
                />
                {systemGroups.map((group, index) => (
                  <SystemGroupBlock
                    key={group.key}
                    group={group}
                    isFirst={index === 0}
                    expanded={expandedGroups.has(group.key)}
                    onToggle={() => toggleGroup(group.key)}
                    onOpenEntry={loadCorrelatedFromSystemRow}
                  />
                ))}
                <ListState
                  loading={systemLoading && systemLogs.length === 0}
                  error={systemError}
                  empty={filteredSystemLogs.length === 0}
                  emptyTitle={
                    systemLogs.length === 0 && sysActiveFilters.length === 0
                      ? "Nothing logged yet"
                      : "No matching lines"
                  }
                  emptyBody={
                    sysActiveFilters.length > 0
                      ? "Nothing in the whole buffer matches these filters."
                      : "Application events will appear here as they happen."
                  }
                  onClearFilters={sysActiveFilters.length > 0 ? resetSysFilters : undefined}
                  onRetry={systemError ? () => fetchSystem(true) : undefined}
                />
              </div>
              {showJumpSys && <JumpButton onClick={jumpToBottomSys} />}
            </div>
          )}
        </section>
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
    </div>
  );
}

/* ===================================================================
   Header pieces
   =================================================================== */

/** Live/paused plus how fresh the data is. A feed that shows no rows for
 *  a minute is indistinguishable from a broken one without this. */
function LiveStatus({
  isPaused, lastUpdatedAt,
}: {
  isPaused: boolean;
  lastUpdatedAt: number | null;
}) {
  useTicker(!isPaused && lastUpdatedAt !== null, 5000);
  return (
    <p className="flex items-center gap-1.5 text-xs text-text-subtle mt-0.5">
      <span className="relative flex h-1.5 w-1.5">
        {!isPaused && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-60 animate-ping motion-reduce:hidden" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            isPaused ? "bg-amber-500" : "bg-teal-400"
          }`}
        />
      </span>
      {isPaused ? "Paused" : "Live"}
      {lastUpdatedAt && (
        <span className="text-text-subtle/80">· updated {fmtAgo(Date.now() - lastUpdatedAt)}</span>
      )}
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
      className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${FOCUS_RING} ${
        active ? "bg-graphite-800 text-text-primary" : "text-text-muted hover:text-text-primary"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${active ? "text-amber-500" : ""}`} />
      {label}
    </button>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-text-subtle ${className}`}>
      {children}
    </th>
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
    <div className="bg-graphite-900 px-3 sm:px-5 py-3.5 min-w-0" title={hint}>
      <p className="text-[11px] uppercase tracking-wider text-text-subtle truncate">{label}</p>
      <p className={`mt-0.5 text-xl sm:text-2xl font-semibold tabular-nums ${valueClass || "text-text-primary"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ===================================================================
   Controls
   =================================================================== */

function ActionBar({
  isPaused, onTogglePause, onRefresh, isRefreshing,
  manageOpen, setManageOpen, onDelete,
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
        <IconAction
          onClick={() => setManageOpen(!manageOpen)}
          icon={Trash2}
          label="Delete"
          highlight={manageOpen}
          expanded={manageOpen}
        />
        {manageOpen && (
          <>
            <button
              aria-hidden
              tabIndex={-1}
              onClick={() => setManageOpen(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div
              role="menu"
              className="absolute top-full right-0 mt-2 w-48 rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl overflow-hidden z-30"
            >
              <MenuItem onClick={() => { setManageOpen(false); onDelete(1); }}>
                Older than 1 day
              </MenuItem>
              <MenuItem onClick={() => { setManageOpen(false); onDelete(7); }}>
                Older than 7 days
              </MenuItem>
              <MenuItem danger onClick={() => { setManageOpen(false); onDelete(null); }}>
                Delete all logs
              </MenuItem>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function IconAction({
  onClick, icon: Icon, label, hint, highlight = false,
  spinning = false, disabled = false, expanded,
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
      className={`shrink-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS_RING} ${
        highlight
          ? "border-amber-500/50 text-amber-400"
          : "border-graphite-700 text-text-muted hover:text-text-primary hover:bg-graphite-850"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${spinning ? "animate-spin motion-reduce:animate-none" : ""}`} />
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
      role="menuitem"
      onClick={onClick}
      className={`w-full text-left px-3.5 py-2 text-xs transition-colors ${FOCUS_RING} ${
        danger
          ? "text-red-400 hover:bg-red-500/10"
          : "text-text-muted hover:text-text-primary hover:bg-graphite-800"
      }`}
    >
      {children}
    </button>
  );
}

type Suggestion = { path: string; label: string; count: number };

/** Search input, optionally with typeahead. Both tabs use it, so the
 *  clear button, the focus ring and the "/" shortcut behave identically
 *  in both places. */
function SearchBox({
  inputRef, value, onChange, onClear, placeholder, combobox,
}: {
  // React 19 types useRef<T>(null) as RefObject<T | null>. RefObject is
  // readonly, so widening here stays assignable under React 18's types too.
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
    <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-subtle pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => c?.setOpen(true)}
        // Delayed so a mousedown on a suggestion still lands — blur fires
        // first otherwise and the list is gone before the click resolves.
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
            // Only hijack Enter when something is highlighted; otherwise
            // the typed text stands.
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
        aria-activedescendant={
          c && c.open && c.highlightIndex >= 0 ? `${listId}-${c.highlightIndex}` : undefined
        }
        className={`w-full rounded-md border border-graphite-700 bg-graphite-850 py-1.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-subtle transition-colors hover:border-graphite-600 focus:border-amber-500/60 ${FOCUS_RING}`}
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-subtle hover:text-text-primary hover:bg-graphite-800 transition-colors ${FOCUS_RING}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {c?.open && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl overflow-hidden z-40"
        >
          {!value.trim() && (
            <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-text-subtle">
              Busiest tools
            </p>
          )}
          {c.suggestions.map((sug, i) => (
            <button
              key={sug.path}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === c.highlightIndex}
              // mousedown, not click: fires before the input's blur, so
              // the selection isn't lost to the dropdown unmounting first.
              onMouseDown={(e) => { e.preventDefault(); c.onPick(sug.path); }}
              onMouseEnter={() => c.setHighlightIndex(i)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                i === c.highlightIndex ? "bg-graphite-800" : "hover:bg-graphite-800"
              }`}
            >
              <span className="min-w-0">
                <span className="block text-xs text-text-primary truncate">{sug.label}</span>
                <span className="block font-mono text-[10px] text-text-subtle truncate">
                  {sug.path}
                </span>
              </span>
              {sug.count > 0 && (
                <span className="shrink-0 text-[11px] text-text-subtle tabular-nums">
                  {sug.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One dropdown for the whole dashboard, replacing native <select>.
 *
 * The reason is visible rather than academic: a native select's OPEN list
 * is drawn by the OS, so no CSS this app owns reaches it — its radius,
 * focus ring, scrollbar and hover states are the platform's, not the
 * design system's. Next to the custom tool picker the two read as
 * different components at different levels of finish.
 *
 * Focus stays on the trigger and moves via aria-activedescendant, which
 * keeps Escape/Tab behaviour predictable and avoids focus-trap bugs.
 */
function Select<T extends string>({
  value, options, onChange, placeholder, label, widthClass = "",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  placeholder: string;
  /** Static prefix shown before the value, e.g. "Tier". Keeps the control
   *  self-describing without a separate element competing for space. */
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
    <div className={`relative shrink-0 ${widthClass}`}>
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
        className={`w-full flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm text-left transition-colors bg-graphite-850 ${FOCUS_RING} ${
          open
            ? "border-amber-500/60 text-text-primary"
            : isSet
            ? "border-graphite-600 text-text-primary hover:border-graphite-500"
            : "border-graphite-700 text-text-muted hover:border-graphite-600"
        }`}
      >
        <span className="truncate">
          {label && <span className="text-text-subtle">{label}: </span>}
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-text-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div
            id={listId}
            role="listbox"
            className="absolute top-full left-0 min-w-full mt-1 max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl z-30 py-1"
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseEnter={() => setActive(i)}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                  i === active ? "bg-graphite-800 text-text-primary" : "text-text-muted"
                }`}
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

/** Stable per-instance id for wiring aria-controls/activedescendant.
 *  Named useStableId rather than useId so it can't shadow React's own
 *  export the day someone adds useId to this file's import list. */
let _idSeq = 0;
function useStableId(prefix: string): string {
  // useRef<T>() with no argument is an error under React 19's types.
  const ref = useRef<string | null>(null);
  if (!ref.current) ref.current = `${prefix}-${++_idSeq}`;
  return ref.current;
}

/** The merged tool picker: tagged tools first, path families below.
 *  Filterable, because with ~25 tools plus families the list is long
 *  enough that scanning beats scrolling. */
function ToolPicker({
  toolOptions, endpointOptions, toolFilter, endpointFilter,
  activeLabel, onPickTool, onPickFamily, onClear,
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
      // rAF so focus lands after the popover paints.
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
        ? endpointOptions.filter(
            (e) =>
              e.label.toLowerCase().includes(needle) || e.path.toLowerCase().includes(needle)
          )
        : endpointOptions,
    [endpointOptions, needle]
  );

  // Flat nav list so arrow keys cross the section boundary the way the
  // eye does.
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
    <div className="relative flex-1 sm:flex-none min-w-0 sm:w-[240px]">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={activeLabel ?? "Filter by tool, or by URL path family"}
        className={`w-full flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm text-left transition-colors bg-graphite-850 ${FOCUS_RING} ${
          open
            ? "border-amber-500/60 text-text-primary"
            : activeLabel
            ? "border-graphite-600 text-text-primary hover:border-graphite-500"
            : "border-graphite-700 text-text-muted hover:border-graphite-600"
        }`}
      >
        <span className="truncate">{activeLabel ?? "All tools"}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-text-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-20 cursor-default"
          />
          <div className="absolute top-full left-0 right-0 sm:right-auto sm:min-w-[300px] mt-1 rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl z-30 overflow-hidden">
            <div className="p-2 border-b border-graphite-800">
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
                className={`w-full rounded-md border border-graphite-700 bg-graphite-900 px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-subtle ${FOCUS_RING}`}
              />
            </div>

            <div id={listId} role="listbox" className="max-h-72 overflow-y-auto scrollbar-thin py-1">
              {rows.length === 0 && (
                <p className="px-3 py-3 text-xs text-text-subtle text-center">No tools match.</p>
              )}
              {rows.map((row, i) => {
                const isActive = i === active;
                const common = `w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left transition-colors ${
                  isActive ? "bg-graphite-800" : ""
                }`;

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
                      className={`${common} text-sm ${selected ? "text-text-primary" : "text-text-muted"}`}
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
                      {first && <SectionLabel>Tools</SectionLabel>}
                      <button
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={selected}
                        title={`${t.total.toLocaleString()} requests${
                          t.hq_count > 0 ? ` · ${t.hq_count.toLocaleString()} HQ` : ""
                        }`}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => commit(row)}
                        className={common}
                      >
                        <span className="text-sm text-text-primary truncate">{t.label}</span>
                        <span className="shrink-0 flex items-center gap-1.5">
                          {t.hq_count > 0 && (
                            <span className="rounded px-1 py-px text-[9px] font-semibold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              HQ
                            </span>
                          )}
                          <span className="text-[11px] text-text-subtle tabular-nums">
                            {t.total.toLocaleString()}
                          </span>
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
                    {first && <SectionLabel>By URL path</SectionLabel>}
                    <button
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      title={
                        isOther
                          ? `${e.count.toLocaleString()} requests to paths that aren't a registered tool — mostly scanner traffic`
                          : `${e.label}\n${e.path}\n${
                              e.count > 0
                                ? `${e.count.toLocaleString()} requests all-time`
                                : "No traffic yet"
                            }`
                      }
                      onMouseEnter={() => setActive(i)}
                      onClick={() => commit(row)}
                      className={common}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block text-sm truncate ${
                            isOther ? "text-text-muted italic" : "text-text-primary"
                          }`}
                        >
                          {e.label}
                        </span>
                        {!isOther && (
                          <span className="block font-mono text-[10px] text-text-subtle truncate">
                            {e.path}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {e.count > 0 && (
                          <span className="text-[11px] text-text-subtle tabular-nums">
                            {e.count.toLocaleString()}
                          </span>
                        )}
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

/** Non-interactive. Exists so "Tools" and "By URL path" read as two
 *  different kinds of thing rather than one undifferentiated list —
 *  which is what made two separate dropdowns feel necessary. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-text-subtle border-t border-graphite-800 mt-1 first:border-t-0 first:mt-0">
      {children}
    </p>
  );
}

function StatusChip({
  active, onClick, label, tone = "",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${FOCUS_RING} ${
        active ? `bg-graphite-700 ${tone || "text-text-primary"}` : `text-text-subtle hover:text-text-primary ${tone}`
      }`}
    >
      {label}
    </button>
  );
}

/** What's actually filtering the view, each removable on its own. A lone
 *  "Clear" button tells you something is applied but not what — which is
 *  how you end up staring at an empty table wondering why. */
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
          className="inline-flex items-center gap-1 rounded-full border border-graphite-700 bg-graphite-850 pl-2.5 pr-1 py-0.5 text-[11px] text-text-muted max-w-[220px]"
        >
          <span className="truncate">{chip.label}</span>
          <button
            onClick={chip.clear}
            aria-label={`Remove filter ${chip.label}`}
            className={`rounded-full p-0.5 text-text-subtle hover:text-text-primary hover:bg-graphite-800 transition-colors ${FOCUS_RING}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <button
          onClick={onClearAll}
          className={`rounded-md px-2 py-0.5 text-[11px] text-text-subtle hover:text-text-primary transition-colors ${FOCUS_RING}`}
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
      className={`shrink-0 rounded p-0.5 text-text-subtle hover:text-text-primary hover:bg-graphite-800 transition-colors ${FOCUS_RING}`}
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
      className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-amber-500 text-graphite-950 px-3.5 py-1.5 text-xs font-medium shadow-lg hover:bg-amber-400 transition-colors ${FOCUS_RING}`}
    >
      <ArrowDown className="h-3.5 w-3.5" />
      Jump to latest
    </button>
  );
}

/** Sits at the top of a log list. Older entries load automatically when
 *  the reader scrolls near it, so this reports status rather than being a
 *  button — the way a terminal scrollback does.
 *
 *  Fixed height on purpose: the three states used to be different heights,
 *  and swapping between them mid-load shifted scrollHeight by a few
 *  pixels, which is exactly the value the anchoring math depends on. */
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
    <div className="h-11 flex items-center justify-center border-b border-graphite-800/70 text-[11px] text-text-subtle tabular-nums px-4">
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
          Loading older entries…
        </span>
      ) : !hasOlder ? (
        <span>
          Beginning of the log · {count.toLocaleString()} entr{count === 1 ? "y" : "ies"} loaded
        </span>
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
  /** null when the active filter is client-side and the server's match
   *  count would describe a different set of rows than what's shown. */
  matching: number | null;
  total: number;
}) {
  return (
    <div className="shrink-0 px-4 py-2.5 border-t border-graphite-800 text-xs text-text-subtle tabular-nums">
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

function SkeletonTableRow() {
  return (
    <tr aria-hidden>
      {[130, 60, 320, 50, 70, 110].map((w, i) => (
        <td key={i} className="px-4 py-2.5">
          <span
            className="block h-3 rounded bg-graphite-800 animate-pulse motion-reduce:animate-none"
            style={{ maxWidth: w }}
          />
        </td>
      ))}
    </tr>
  );
}

/** Loading, error and empty in one place, so the two tabs can't drift
 *  apart on what a dead-end looks like. Empty states offer the way out
 *  rather than just naming the problem. */
function ListState({
  loading, error, empty, emptyTitle, emptyBody, onClearFilters, onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle: string;
  emptyBody: string;
  onClearFilters?: () => void;
  onRetry?: () => void;
}) {
  if (loading) return null; // skeletons cover this
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 px-4" role="alert">
        <p className="text-sm text-red-400 text-center">Couldn&apos;t load logs: {error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className={`rounded-md border border-graphite-700 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 transition-colors ${FOCUS_RING}`}
          >
            Try again
          </button>
        )}
      </div>
    );
  }
  if (!empty) return null;
  return (
    <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
      <p className="text-sm text-text-muted font-sans">{emptyTitle}</p>
      <p className="text-xs text-text-subtle font-sans max-w-xs">{emptyBody}</p>
      {onClearFilters && (
        <button
          onClick={onClearFilters}
          className={`mt-1 rounded-md border border-graphite-700 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 transition-colors font-sans ${FOCUS_RING}`}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

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

  // Focus the panel, and keep Tab inside it. A destructive confirm that
  // lets focus wander back to the page behind it is how you end up
  // pressing Enter on the wrong thing.
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={loading ? undefined : onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] cursor-default"
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-sm rounded-lg border border-graphite-700 bg-graphite-900 shadow-2xl p-4 sm:p-5 flex flex-col gap-3"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="min-w-0">
            <p id="confirm-title" className="text-sm font-semibold text-text-primary">{title}</p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">{body}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className={`rounded-md border border-graphite-700 px-3.5 py-2 sm:py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 transition-colors disabled:opacity-50 ${FOCUS_RING}`}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center justify-center gap-1.5 rounded-md bg-red-500 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-graphite-950 hover:bg-red-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${FOCUS_RING}`}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Auto-dismisses on success; failures stay until acknowledged, since
 *  those are the ones you need to act on. */
function Toast({
  toast, onDismiss,
}: {
  toast: { text: string; tone: "ok" | "bad" };
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (toast.tone !== "ok") return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm sm:w-auto rounded-lg border px-4 py-2.5 text-sm shadow-xl flex items-center gap-3 ${
        toast.tone === "ok"
          ? "border-graphite-700 bg-graphite-850 text-text-primary"
          : "border-red-500/40 bg-graphite-850 text-red-400"
      }`}
    >
      <span className="flex-1 min-w-0">{toast.text}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`shrink-0 text-text-subtle hover:text-text-primary transition-colors ${FOCUS_RING}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ===================================================================
   Rows
   =================================================================== */

/** Which tool/tier actually produced a row. Worth the pixels because the
 *  PATH frequently can't tell you: a /youtube/stems/status/<id> poll looks
 *  identical whether its job was standard or HQ (they share that route by
 *  design). HQ is coloured; standard is deliberately not badged — tagging
 *  every ordinary row is noise on the 95% case, and "no badge means
 *  standard" is learnable in one glance. */
function ToolBadge({ tool, tier }: { tool?: string | null; tier?: string | null }) {
  const name = realId(tool);
  if (!name) return null;
  const isHq = tier === "hq";
  return (
    <span
      title={`Tool: ${name}${isHq ? " · Studio Quality (HQ)" : " · Standard"}`}
      className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${
        isHq
          ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          : "bg-graphite-800 text-text-subtle border border-graphite-700"
      }`}
    >
      {isHq ? "HQ" : name}
    </span>
  );
}

/** Shared by both HTTP row layouts: a row is worth clicking if either
 *  correlation route exists — a job id in the path (the whole job's
 *  story) or a real request id (that one request). */
function httpRowTarget(log: HttpLogEntry): "job" | "request" | null {
  if (jobIdFromPath(log.path)) return "job";
  if (realId(log.request_id)) return "request";
  return null;
}

// Log rows are immutable once written — same id means identical content,
// so a fresh fetch producing new-but-equal objects still skips the
// re-render for every row already on screen.
const HttpTableRow = memo(
  function HttpTableRow({
    log, onOpenLogs,
  }: {
    log: HttpLogEntry;
    onOpenLogs: (log: HttpLogEntry) => void;
  }) {
    const target = httpRowTarget(log);
    const clickable = target !== null;
    // See isTextSelected(): a drag-select ending over this row still
    // fires a click on mouseup. Bailing when a selection exists lets that
    // click be a no-op instead of yanking the user into the correlated
    // view and losing what they highlighted.
    const open = () => { if (!isTextSelected()) onOpenLogs(log); };

    return (
      <tr
        onClick={clickable ? open : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenLogs(log);
                }
              }
            : undefined
        }
        tabIndex={clickable ? 0 : undefined}
        role={clickable ? "button" : undefined}
        aria-label={
          clickable
            ? `${log.method} ${log.path} returned ${log.status_code}. View ${
                target === "job" ? "this job's logs" : "this request's logs"
              }.`
            : undefined
        }
        className={`group transition-colors ${FOCUS_RING} ${
          clickable ? "hover:bg-graphite-850/60 cursor-pointer" : "opacity-70"
        }`}
        title={clickable ? "View related system logs" : "No request id recorded for this row"}
      >
        <td className="px-4 py-2 whitespace-nowrap tabular-nums">
          <span className="text-text-primary">{npTime(log.timestamp)}</span>
          <span className="text-text-subtle ml-1.5 text-xs">{npDate(log.timestamp)}</span>
        </td>
        <td className={`px-4 py-2 text-xs font-semibold ${methodTone(log.method)}`}>{log.method}</td>
        <td className="px-4 py-2 font-mono text-xs text-text-primary max-w-0" title={log.path}>
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">{log.path}</span>
            <ToolBadge tool={log.tool} tier={log.tier} />
          </span>
        </td>
        <td className="px-4 py-2">
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(log.status_code)}`} />
            <span className={`text-xs font-medium ${statusText(log.status_code)}`}>
              {log.status_code}
            </span>
          </span>
        </td>
        <td className="px-4 py-2 text-right tabular-nums text-xs text-text-muted whitespace-nowrap">
          {fmtMs(log.duration_ms)}
        </td>
        <td className="px-4 py-2 font-mono text-xs text-text-subtle">
          <div className="flex items-center justify-between gap-2">
            <span>{log.client_ip}</span>
            {clickable && (
              <ScrollText className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-amber-400 transition-opacity" />
            )}
          </div>
        </td>
      </tr>
    );
  },
  (prev, next) => prev.log.id === next.log.id
);

const HttpCardRow = memo(
  function HttpCardRow({
    log, onOpenLogs,
  }: {
    log: HttpLogEntry;
    onOpenLogs: (log: HttpLogEntry) => void;
  }) {
    const clickable = httpRowTarget(log) !== null;
    return (
      <div
        onClick={clickable ? () => { if (!isTextSelected()) onOpenLogs(log); } : undefined}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenLogs(log);
                }
              }
            : undefined
        }
        className={`px-4 py-2.5 ${FOCUS_RING} ${
          clickable ? "active:bg-graphite-850/60 cursor-pointer" : "opacity-70"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(log.status_code)}`} />
          <span className={`text-xs font-semibold shrink-0 ${methodTone(log.method)}`}>
            {log.method}
          </span>
          <span className="font-mono text-xs text-text-primary truncate flex-1" title={log.path}>
            {log.path}
          </span>
          <ToolBadge tool={log.tool} tier={log.tier} />
          <span className={`text-xs font-medium tabular-nums shrink-0 ${statusText(log.status_code)}`}>
            {log.status_code}
          </span>
          {clickable && <ScrollText className="h-3.5 w-3.5 shrink-0 text-text-subtle" />}
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

/** contentVisibility:auto skips layout, paint and style for entries
 *  scrolled out of view. System messages wrap to arbitrary heights so
 *  they're the expensive ones; containIntrinsicSize gives the scrollbar
 *  an estimate so skipping them doesn't make scroll height jump. */
const SystemRow = memo(
  function SystemRow({
    entry, newGroup, onOpenEntry,
  }: {
    entry: SystemLogEntry;
    newGroup: boolean;
    onOpenEntry?: (entry: SystemLogEntry) => void;
  }) {
    const tone = levelTone(entry.level);
    // Checks BOTH correlation targets. Previously only the message-text
    // job id counted, which meant an ERROR line with no "job=<id>" in its
    // text — a plain exception, a startup failure — was a dead end even
    // though it belonged to a real, correlatable request. Which target
    // gets used is decided by the caller; this only needs to know whether
    // a click would do anything.
    const hasJobId = jobIdFromMessage(entry.message) !== null;
    const hasRequestId = realId(entry.request_id) !== null;
    const clickable = !!onOpenEntry && (hasJobId || hasRequestId);

    return (
      <div
        onClick={clickable ? () => { if (!isTextSelected()) onOpenEntry!(entry); } : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenEntry!(entry);
                }
              }
            : undefined
        }
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        title={clickable ? (hasJobId ? "View this job's full log" : "View this request's logs") : undefined}
        style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
        className={`border-l-2 ${tone.border} px-4 py-2 hover:bg-graphite-850/60 transition-colors ${FOCUS_RING} ${
          clickable ? "cursor-pointer" : ""
        } ${newGroup ? "border-t border-t-graphite-700 mt-1 pt-2.5" : ""}`}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={`font-semibold ${tone.text}`}>{entry.level}</span>
          <span className="text-text-subtle tabular-nums">
            {npDate(entry.timestamp)} {npTime(entry.timestamp)}
          </span>
          <span className="text-text-subtle">{entry.logger}</span>
          <ToolBadge tool={entry.tool} tier={entry.tier} />
        </div>
        <p className="text-text-primary mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
          {entry.message}
        </p>
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
 * EVERY group folds, including the live one.
 *
 * A previous pass exempted the newest group on the theory that a ticking
 * "N more lines" counter reads as a stuck feed. The result was worse: an
 * in-flight download emits 40+ progress lines into the last group, so the
 * exemption dumped all of them at full height and the grouping that makes
 * this feed readable stopped applying to the one request you're actually
 * watching. The tail is recomputed every render, so it IS the newest line
 * and updates live on its own. What made the feed feel frozen was the poll
 * backoff, fixed separately.
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
      <div className={!isFirst ? "border-t border-t-graphite-700 mt-1 pt-2.5" : ""}>
        <SystemRow entry={head} newGroup={false} onOpenEntry={onOpenEntry} />
        {middle.length > 0 && (
          <button
            onClick={onToggle}
            aria-expanded={expanded}
            className={`w-full flex items-center gap-2 px-4 py-1.5 border-l-2 ${tone.border} text-[11px] ${tone.text} hover:bg-graphite-850/60 transition-colors ${FOCUS_RING}`}
          >
            <ChevronDown
              className={`h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide" : "Show"} {middle.length} more line
            {middle.length === 1 ? "" : "s"} from this request
          </button>
        )}
        {expanded &&
          middle.map((entry) => (
            <SystemRow key={entry.id} entry={entry} newGroup={false} onOpenEntry={onOpenEntry} />
          ))}
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