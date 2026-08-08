"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ChevronDown,
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

// ---------------------------------------------------------------------
// Paging model: CURSOR, not growing-limit.
//
// The old model asked for an ever-larger `limit` on each "load more"
// click. That could never work past 2000 rows, because `limit` is capped
// at 2000 server-side (Query(200, le=2000)) - so with 14,482 entries in
// the DB, entry 2001 was permanently unreachable no matter how many
// times the button was pressed. It also got quadratically slower: every
// click re-downloaded and re-rendered everything already on screen.
//
// Now each "load older" fetches exactly PAGE_SIZE rows older than the
// oldest row currently held (before_id cursor) and PREPENDS them. Every
// page costs the same regardless of how far back you have scrolled, and
// there is no ceiling.
// ---------------------------------------------------------------------
const PAGE_SIZE = 250;

// Hard ceiling on rows kept in the DOM. Only ever trimmed from the TOP
// (oldest) and only while pinned to the live tail - never while the user
// is reading history, since trimming what they just loaded would be
// actively hostile.
const RENDER_CAP = 6000;

// Start fetching the next older page once the user scrolls within this
// many pixels of the top. Roughly one screenful, so the page lands
// before they hit the edge, the way Railway/Discord do it - no button
// press, no visible stall.
const AUTO_LOAD_PX = 600;

interface HttpLogEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  client_ip: string;
  request_id: string | null;
}

interface SystemLogEntry {
  id: number;
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  request_id: string;
}

// Shape of GET /api/admin/endpoints - proxies routes.py's admin_endpoints(),
// which introspects FastAPI's own route table and collapses it to one
// entry per TOOL (not per route). Typed explicitly rather than left to
// inference: res.json() resolves to `unknown` under this project's
// tsconfig, so anything downstream needs a real type to anchor on.
interface ToolEndpoint {
  path: string;    // canonical family, e.g. "/youtube/analyze"
  label: string;   // human label, e.g. "YouTube Analyze"
  methods: string[];
  // Real all-time total from the database, NOT a count of loaded rows.
  // The picker used to count rows in the browser's in-memory window,
  // which meant its numbers shrank as older rows were trimmed - a tool
  // showing 967 would quietly become 233 after scrolling, looking like
  // requests had disappeared. This number doesn't move.
  total_requests?: number;
}

interface EndpointsApiResponse {
  endpoints?: ToolEndpoint[];
  noise_patterns?: string[];
}

// Collapses any request path down to the TOOL it belongs to, mirroring
// _humanize_endpoint/admin_endpoints() in routes.py exactly.
//
//   /convert                      -> /convert
//   /convert/status/a1b2c3d4      -> /convert
//   /convert/download/a1b2c3d4    -> /convert
//   /youtube/analyze/result/9f8e  -> /youtube/analyze
//
// Why collapse: every tool registers ~4 routes (submit + status +
// preview + download). Filtering by the raw shape means ~100 dropdown
// entries for ~25 tools, and nobody wants to filter logs by "preview"
// specifically - they want everything /convert did. Method is already
// its own filter, so families don't fork by method either.
//
// Walks LEFT to right and stops at the first action word or id, which is
// what keeps namespaced tools intact: /youtube/analyze/result/{id}
// yields /youtube/analyze, not /youtube.
const _ACTION_SEGMENTS = new Set(["status", "preview", "download", "result"]);
const _ID_SEGMENT = /^[0-9a-f]{6,}(-[0-9a-f]{4,}){0,4}$/i;
const _FASTAPI_PARAM_SEGMENT = /^\{[^}]+\}$/;

// Memoised, for the same reason the date formatters above are: this runs
// once per row in the filter pass AND once per row when rebuilding the
// endpoint list - which happens on every poll. Paths repeat enormously
// (thousands of /convert/status/<id> polls), so a cache turns tens of
// thousands of string splits per minute into one per distinct path.
const familyCache = new Map<string, string>();

// Sentinel for the "Other / unrecognized traffic" bucket - deliberately
// not a real path shape (no leading slash a real route would ever have)
// so it can never collide with an actual family.
const OTHER_TRAFFIC_KEY = "__other__";

function toolFamily(path: string): string {
  let hit = familyCache.get(path);
  if (hit === undefined) {
    if (familyCache.size > 20000) familyCache.clear();
    const parts: string[] = [];
    const segs = path.split("/").filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const isParam = _ID_SEGMENT.test(seg) || _FASTAPI_PARAM_SEGMENT.test(seg);
      // Mirrors the i > 0 guard in routes.py's admin_endpoints(): an
      // action word only ends a family when something precedes it.
      // "/download" is a real tool AND "download" is an action segment
      // for /<tool>/download/{job_id}; without this guard the busiest
      // endpoint on the API resolves to an empty family and falls into
      // the "Other" bucket. These two implementations must agree or the
      // picker and the filter disagree about what a row belongs to.
      if (i > 0 && (_ACTION_SEGMENTS.has(seg) || isParam)) break;
      if (isParam) break; // a bare id as the FIRST segment is never a tool
      parts.push(seg);
    }
    hit = parts.length ? "/" + parts.join("/") : path;
    familyCache.set(path, hit);
  }
  return hit;
}


// Bootstrap fallback only - covers the ~2 seconds before the real list
// arrives from GET /api/admin/endpoints (see the noisePatterns fetch in
// the component below). Replaced in place, not read from React state,
// so isNoise() - called from plain memoized functions all over this
// file - never needs the list threaded through as an argument. The
// authoritative source is config.NOISE_PATH_MARKERS on the backend; this
// mirrors it just closely enough that filtering isn't visibly wrong for
// the brief window before the fetch resolves.
let NOISE_PATTERNS: string[] = [
  "/robots.txt", "/favicon.ico", "/.env", "/wp-", "/.git",
  "/SDK/", "/phpmyadmin", "/.well-known", "/xmlrpc.php",
];

// Case-insensitive: SQLite's LIKE (used server-side for the same list)
// is case-insensitive for ASCII by default, but JS's .includes() is
// not - which is exactly how /language/en-GB/en-GB.xml silently slipped
// past a /language/en-gb pattern that matched fine on the backend.
// Lowercasing both sides kills this whole class of bug, not just this
// one path.
const isNoise = (path: string) => {
  const lower = path.toLowerCase();
  return NOISE_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
};

function parseTs(isoString: string): Date {
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(isoString);
  return new Date(hasZone ? isoString : isoString + "Z");
}

// Shared formatter instances instead of one-per-call: Intl.DateTimeFormat
// construction is by far the most expensive part of date formatting, and
// toLocaleTimeString() constructs a fresh one every single call. Reusing
// instances + caching results per timestamp string (timestamps are
// immutable) means each row is formatted exactly once for its entire
// lifetime instead of on every poll re-render.
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
const NP_YMD_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kathmandu",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fmtCache = new Map<string, [string, string]>();
const ymdCache = new Map<string, string>();

function npFormatted(isoString: string): [string, string] {
  let hit = fmtCache.get(isoString);
  if (!hit) {
    // Bounded cache: old entries are useless once their rows scroll out
    // of the window, so just reset rather than grow forever.
    if (fmtCache.size > 20000) fmtCache.clear();
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

// Also cached. The date filter calls this once per row per filter pass;
// uncached it was constructing a fresh Intl.DateTimeFormat thousands of
// times for a single keystroke in the path box.
function npYMD(isoString: string): string {
  let hit = ymdCache.get(isoString);
  if (hit === undefined) {
    if (ymdCache.size > 20000) ymdCache.clear();
    hit = NP_YMD_FMT.format(parseTs(isoString));
    ymdCache.set(isoString, hit);
  }
  return hit;
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

/** Merge a page of OLDER rows onto the front, dropping anything already
 *  held. Duplicates are possible whenever a page boundary lands next to
 *  a delta poll, and a duplicated React key silently breaks rendering. */
function prependUnique<T extends { id: number }>(older: T[], current: T[]): T[] {
  if (older.length === 0) return current;
  const seen = new Set(current.map((r) => r.id));
  const fresh = older.filter((r) => !seen.has(r.id));
  return fresh.length === 0 ? current : [...fresh, ...current];
}

type DateFilter = "all" | "today" | "yesterday";
type Tab = "http" | "system";

/**
 * Three buckets, not two. "Failed" used to mean "anything that wasn't a
 * 2xx/3xx," which counted completely normal traffic - a bot probing a
 * route that doesn't exist (404), a visitor who hit a rate limit (429),
 * a job rejected because the queue was full (503-by-design) - as if the
 * server were broken. It wasn't; it was doing exactly what it should.
 */
interface Totals {
  total: number;
  success: number;
  client: number;
  server: number;
}

/** Render only the layout that's actually visible. Keeping BOTH the
 *  desktop table and the mobile card list mounted (hidden via CSS) means
 *  React builds and reconciles up to 2x every row on every update - pure
 *  waste, since only one can ever be seen. */
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
  const [totals, setTotals] = useState<Totals>({ total: 0, success: 0, client: 0, server: 0 });
  const [httpLoading, setHttpLoading] = useState(true);
  const [httpError, setHttpError] = useState<string | null>(null);

  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [systemLoading, setSystemLoading] = useState(true);
  const [systemError, setSystemError] = useState<string | null>(null);

  const [methodFilter, setMethodFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [endpointFilter, setEndpointFilter] = useState("");
  const [statusClassFilter, setStatusClassFilter] = useState<"all" | "4xx" | "5xx">("all");
  const [hideNoise, setHideNoise] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Typeahead on the path box. highlightIndex is -1 when nothing is
  // keyboard-selected, so Enter falls through to "just use what I typed"
  // rather than silently substituting a suggestion the user never looked at.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  // On mobile the filter controls collapse behind a single button - eight
  // controls wrapping across a phone screen is unusable, and search plus
  // the live/paused state are the only things worth permanent space.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Custom popover for the tool filter, replacing a native <select>. A
  // native select's OPEN dropdown is rendered by the OS, not the page -
  // no CSS reaches it, which is why its scrollbar looked "raw" and long
  // labels had no way to show a tooltip on truncation. This gets both
  // for free, same as every other popover already in this file.
  const [toolPickerOpen, setToolPickerOpen] = useState(false);

  // System-tab-only filters. Separate from the HTTP filters above since
  // the two tabs filter genuinely different data.
  const [levelFilter, setLevelFilter] = useState("");
  const [systemSearch, setSystemSearch] = useState("");

  // Click-through correlation: viewing every system log line tied to one
  // specific HTTP request, fetched on demand rather than hunting through
  // the live system feed by eye. null when not active - the system tab
  // renders its normal live/paginated view in that case.
  const [correlatedRequestId, setCorrelatedRequestId] = useState<string | null>(null);
  const [correlatedSummary, setCorrelatedSummary] = useState<HttpLogEntry | null>(null);
  const [correlatedLogs, setCorrelatedLogs] = useState<SystemLogEntry[]>([]);
  const [correlatedLoading, setCorrelatedLoading] = useState(false);
  const [correlatedError, setCorrelatedError] = useState<string | null>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<number | null | "none">("none");
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteResult, setDeleteResult] = useState<string | null>(null);

  const [httpTotal, setHttpTotal] = useState(0);
  const [sysTotal, setSysTotal] = useState(0);
  const [httpLoadingOlder, setHttpLoadingOlder] = useState(false);
  const [sysLoadingOlder, setSysLoadingOlder] = useState(false);
  // "Is there anything older left?" Derived from whether the last page
  // came back full, which needs no extra round trip and stays correct
  // even as new rows arrive at the live end.
  const [httpHasOlder, setHttpHasOlder] = useState(true);
  const [sysHasOlder, setSysHasOlder] = useState(true);

  // Mirrors of the above for use inside callbacks, which would otherwise
  // close over stale state. Refs are read at call time, not render time.
  const httpHasOlderRef = useRef(true);
  const sysHasOlderRef = useRef(true);
  const httpOldestRef = useRef<number>(0);
  const sysOldestRef = useRef<number>(0);

  // Pre-load scroll metrics, captured before older rows are prepended so
  // the view can be restored to exactly where the reader was.
  const httpScrollAdjustRef = useRef<{
    desk: [number, number] | null;
    mob: [number, number] | null;
  } | null>(null);
  const sysScrollAdjustRef = useRef<[number, number] | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sysRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  // "Pinned to bottom" - true means auto-scroll should keep following new
  // data (the Railway/Discord pattern). The instant the user scrolls up
  // even a little, this flips to false and new data stops yanking the
  // view around; it only re-pins once they scroll back down themselves,
  // or click "Jump to latest". Refs (not state) so scroll handlers don't
  // re-render on every scroll tick.
  const httpPinnedRef = useRef(true);
  const sysPinnedRef = useRef(true);
  // One-shot: "the next time the live system panel exists, put it at the
  // bottom." Set when leaving the correlated view, which remounts that
  // panel from scratch at scrollTop 0. A flag rather than a direct scroll
  // call because at the moment clearCorrelated() runs, the node doesn't
  // exist yet - it mounts in the render this state change triggers.
  const sysNeedsBottomRef = useRef(false);
  const [showJumpHttp, setShowJumpHttp] = useState(false);
  const [showJumpSys, setShowJumpSys] = useState(false);

  const NEAR_BOTTOM_PX = 48;

  const httpInFlightRef = useRef(false);
  const sysInFlightRef = useRef(false);
  const httpOlderInFlightRef = useRef(false);
  const sysOlderInFlightRef = useRef(false);
  const httpSigRef = useRef("");
  const sysSigRef = useRef("");

  // Highest log id currently held, per tab. Delta polls send this as
  // afterId so the backend returns ONLY genuinely new rows instead of
  // the whole window.
  const httpLastIdRef = useRef(0);
  const sysLastIdRef = useRef(0);
  const httpDeltaInFlightRef = useRef(false);
  const sysDeltaInFlightRef = useRef(false);

  // Every in-flight request shares this controller and is aborted on
  // unmount, so navigating away mid-fetch doesn't leave promises
  // resolving into a dead component - and the response body isn't fully
  // downloaded and parsed for nothing.
  const abortRef = useRef<AbortController | null>(null);
  if (abortRef.current === null) abortRef.current = new AbortController();
  useEffect(() => {
    const ctrl = abortRef.current;
    return () => ctrl?.abort();
  }, []);
  const signal = () => abortRef.current?.signal;

  const MIN_POLL_MS = 3000;
  const MAX_POLL_MS = 20000;
  const currentDelayRef = useRef(MIN_POLL_MS);

  const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";

  // ---------------- Click-through correlation ----------------
  // Jumps from one HTTP row straight to every system log line that
  // request produced - including lines from a background task the
  // request spawned, since the backend tags those the same way. This is
  // the actual fix for "I see a 500, now I have to hunt for why": no
  // timestamp-squinting, no manual search, one click.
  // Guards against a slow earlier response overwriting a newer one when
  // rows are clicked in quick succession - without this, clicking row A
  // then row B could leave B's banner above A's log lines.
  const correlationTokenRef = useRef(0);

  const loadCorrelated = useCallback(async (log: HttpLogEntry) => {
    if (!log.request_id) return; // older rows from before this existed
    const token = ++correlationTokenRef.current;
    setCorrelatedSummary(log);
    setCorrelatedRequestId(log.request_id);
    setCorrelatedLogs([]);
    setCorrelatedError(null);
    setCorrelatedLoading(true);
    setTab("system");
    try {
      const res = await fetch(
        `/api/admin/logs?type=system&requestId=${encodeURIComponent(log.request_id)}`,
        { cache: "no-store", signal: signal() }
      );
      if (token !== correlationTokenRef.current) return; // superseded by a newer click
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
  }, [router]);

  // fetchSystem is declared further down (it depends on state that isn't
  // set up yet at this point), so clearCorrelated reaches it through a
  // ref rather than closing over the binding directly - referencing a
  // `const` before its declaration line is a temporal-dead-zone
  // ReferenceError, not a hoisted undefined. Side benefit: this keeps
  // clearCorrelated referentially stable, so the Escape-key listener
  // below doesn't tear down and re-bind every time fetchSystem's
  // identity changes.
  const fetchSystemRef = useRef<((force?: boolean) => void) | null>(null);

  const clearCorrelated = useCallback(() => {
    correlationTokenRef.current++; // invalidate any in-flight response
    setCorrelatedRequestId(null);
    setCorrelatedSummary(null);
    setCorrelatedLogs([]);
    setCorrelatedError(null);
    // Closing this view swaps the correlated block out and mounts a
    // BRAND NEW live-log scroll container, which starts at scrollTop 0.
    // The normal pin-to-bottom effect keys on the log array's identity,
    // and that hasn't changed - polling was paused while this view was
    // open - so without forcing it here you land at the top of the list
    // instead of on the newest line, which is not what "back to live"
    // should ever mean. Re-pin unconditionally (closing a detail view
    // always returns you to the tail, same as Railway), flag a one-shot
    // scroll for the moment the node exists, and kick an immediate
    // refresh rather than waiting out the poll delay for fresh data.
    sysPinnedRef.current = true;
    sysNeedsBottomRef.current = true;
    setShowJumpSys(false);
    fetchSystemRef.current?.(true);
  }, []);

  // Escape exits the correlated view, matching the confirm dialog's
  // existing Escape handling so the muscle memory is consistent.
  useEffect(() => {
    if (!correlatedRequestId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") clearCorrelated();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [correlatedRequestId, clearCorrelated]);

  // Same for the tool picker popover - keyboard dismissal is consistent
  // everywhere in this file, not just on the one dialog that had it first.
  useEffect(() => {
    if (!toolPickerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolPickerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toolPickerOpen]);

  // ---------------- HTTP: initial / refresh ----------------
  const fetchHttp = useCallback(async (force = false) => {
    if (!force && httpInFlightRef.current) return;
    httpInFlightRef.current = true;
    try {
      const res = await fetch(`/api/admin/logs?type=http&limit=${PAGE_SIZE}`, {
        cache: "no-store",
        signal: signal(),
      });
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      // Most polls return exactly what we already have. Setting state with
      // a new (but identical-content) array forces React to re-render
      // every row for zero visual change. A cheap signature comparison
      // lets identical responses become complete no-ops instead.
      const sig = `${data.total}:${data.success}:${data.client}:${data.server}:${data.logs.length}:${data.logs[0]?.id ?? 0}`;
      if (sig === httpSigRef.current) return;
      httpSigRef.current = sig;

      setTotals({ total: data.total, success: data.success, client: data.client, server: data.server });
      setHttpTotal(data.total);
      // Backend returns newest-first (ORDER BY id DESC); reverse so the
      // oldest entry is at the top and the newest lands at the bottom,
      // like a terminal tail.
      const reversed = [...data.logs].reverse();
      setHttpLogs(reversed);
      if (reversed.length > 0) {
        httpLastIdRef.current = reversed[reversed.length - 1].id;
        httpOldestRef.current = reversed[0].id;
      }
      // A full page back means there is almost certainly more behind it.
      const more = data.logs.length >= PAGE_SIZE;
      httpHasOlderRef.current = more;
      setHttpHasOlder(more);
      setHttpError(null);
    } catch (e) {
      if (isAbort(e)) return;
      httpSigRef.current = "";
      setHttpError((e as Error).message);
    } finally {
      setHttpLoading(false);
      httpInFlightRef.current = false;
    }
  }, [router]);

  // ---------------- HTTP: older page (cursor) ----------------
  const loadOlderHttp = useCallback(async () => {
    if (httpOlderInFlightRef.current) return;
    if (!httpHasOlderRef.current) return;
    const cursor = httpOldestRef.current;
    if (!cursor) return;

    httpOlderInFlightRef.current = true;
    setHttpLoadingOlder(true);

    // Reading history is an explicit "stop following the tail" gesture.
    // Without unpinning, the next poll tick would slam the view back to
    // the bottom and undo the load.
    httpPinnedRef.current = false;
    setShowJumpHttp(true);

    // Capture where the reader is looking before rows are prepended.
    httpScrollAdjustRef.current = {
      desk: scrollRef.current ? [scrollRef.current.scrollHeight, scrollRef.current.scrollTop] : null,
      mob: mobileScrollRef.current ? [mobileScrollRef.current.scrollHeight, mobileScrollRef.current.scrollTop] : null,
    };

    try {
      const res = await fetch(
        `/api/admin/logs?type=http&limit=${PAGE_SIZE}&beforeId=${cursor}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      const older: HttpLogEntry[] = [...data.logs].reverse(); // newest-first -> oldest-first

      const more = data.logs.length >= PAGE_SIZE;
      httpHasOlderRef.current = more;
      setHttpHasOlder(more);

      if (older.length > 0) {
        httpOldestRef.current = older[0].id;
        setHttpLogs((prev) => prependUnique(older, prev));
      } else {
        // Nothing came back - clear the capture so the restore effect
        // doesn't fire against an unchanged list.
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
  }, [router]);

  // ---------------- SYSTEM: initial / refresh ----------------
  const fetchSystem = useCallback(async (force = false) => {
    if (!force && sysInFlightRef.current) return;
    sysInFlightRef.current = true;
    try {
      const res = await fetch(`/api/admin/logs?type=system&limit=${PAGE_SIZE}`, {
        cache: "no-store",
        signal: signal(),
      });
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
      setSystemLogs(data.logs); // already oldest -> newest from the backend
      if (data.logs.length > 0) {
        sysLastIdRef.current = lastId;
        sysOldestRef.current = data.logs[0].id;
      }
      const more = data.logs.length >= PAGE_SIZE;
      sysHasOlderRef.current = more;
      setSysHasOlder(more);
      setSystemError(null);
    } catch (e) {
      if (isAbort(e)) return;
      sysSigRef.current = "";
      setSystemError((e as Error).message);
    } finally {
      setSystemLoading(false);
      sysInFlightRef.current = false;
    }
  }, [router]);

  // Wire the ref declared above (see the comment there for why
  // clearCorrelated can't reference fetchSystem directly). Assigned
  // during render rather than in an effect so it's already populated if
  // clearCorrelated fires before any effect has run.
  fetchSystemRef.current = fetchSystem;

  // ---------------- SYSTEM: older page (cursor) ----------------
  const loadOlderSystem = useCallback(async () => {
    if (sysOlderInFlightRef.current) return;
    if (!sysHasOlderRef.current) return;
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
        `/api/admin/logs?type=system&limit=${PAGE_SIZE}&beforeId=${cursor}`,
        { cache: "no-store", signal: signal() }
      );
      if (res.status === 401) { router.push("/admin/login"); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server returned ${res.status}`);
      }
      const data = await res.json();
      const older: SystemLogEntry[] = data.logs; // already oldest -> newest

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
  }, [router]);

  // ---------------- Delta polling: appends only ----------------
  const fetchHttpDelta = useCallback(async (): Promise<boolean> => {
    if (httpDeltaInFlightRef.current || httpLastIdRef.current === 0) return false;
    httpDeltaInFlightRef.current = true;
    try {
      const res = await fetch(`/api/admin/logs?type=http&afterId=${httpLastIdRef.current}`, {
        cache: "no-store",
        signal: signal(),
      });
      if (res.status === 401) { router.push("/admin/login"); return false; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setHttpError(body?.error || `Server returned ${res.status}`);
        return false;
      }
      const data = await res.json();
      setTotals({ total: data.total, success: data.success, client: data.client, server: data.server });
      setHttpTotal(data.total);
      setHttpError(null);
      if (!data.logs || data.logs.length === 0) return false;

      setHttpLogs((prev) => {
        const merged = [...prev, ...data.logs];
        // Trim ONLY while following the live tail. Trimming while the
        // reader is scrolled back through history would silently delete
        // the pages they just waited to load.
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
  }, [router]);

  const fetchSystemDelta = useCallback(async (): Promise<boolean> => {
    if (sysDeltaInFlightRef.current || sysLastIdRef.current === 0) return false;
    sysDeltaInFlightRef.current = true;
    try {
      const res = await fetch(`/api/admin/logs?type=system&afterId=${sysLastIdRef.current}`, {
        cache: "no-store",
        signal: signal(),
      });
      if (res.status === 401) { router.push("/admin/login"); return false; }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setSystemError(body?.error || `Server returned ${res.status}`);
        return false;
      }
      const data = await res.json();
      setSysTotal(data.total);
      setSystemError(null);
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
  }, [router]);

  // ---------------- Scroll handling ----------------
  // Desktop table and mobile card list are separate elements, so each
  // needs its own listener rather than sharing one ref.
  const handleHttpScroll = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    httpPinnedRef.current = nearBottom;
    // Setting the same boolean repeatedly during a scroll is free -
    // React bails out of re-renders when state is unchanged.
    setShowJumpHttp(!nearBottom);
    // Infinite scroll upward: no button press needed.
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

  // Real endpoint list, read from the backend's own FastAPI route table
  // (see routes.py's admin_endpoints()) rather than derived from traffic
  // or hand-maintained here. A tool that's never been called still shows
  // up as a search suggestion, which is the entire point - "I forgot the
  // name of the endpoint" doesn't wait for someone to have used it first.
  const [knownEndpoints, setKnownEndpoints] = useState<ToolEndpoint[]>([]);

  // Bumped whenever NOISE_PATTERNS (a plain module-level array, not React
  // state - see its declaration up top) is replaced by the endpoints
  // fetch below. isNoise() is called from many memoized functions across
  // this file, so it can't sensibly take the list as a threaded-through
  // argument; this counter is what tells those memos "the noise
  // definition just changed, recompute" instead of them silently running
  // against stale data until some unrelated state change happens to
  // force a re-render.
  const [noiseListVersion, setNoiseListVersion] = useState(0);

  // ---------------- Boot ----------------
  // ONCE. This used to depend on the fetch callbacks, whose identities
  // changed every time the paging limit changed - so every "load more"
  // click silently fired a second, unforced full refetch of BOTH tabs.
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    fetchHttp();
    fetchSystem();

    // Fire-and-forget: a failure here just means suggestions fall back
    // to traffic-derived endpoints only, which is exactly what the page
    // did before this existed - never worth blocking or erroring the
    // whole dashboard over.
    (async () => {
      try {
        const res = await fetch("/api/admin/endpoints", { cache: "no-store", signal: signal() });
        if (!res.ok) return;
        const data = (await res.json()) as EndpointsApiResponse;
        // Backend already collapses to one entry per tool and sorts by
        // label - no client-side dedupe or normalization needed, which is
        // the point of doing it server-side where the route table lives.
        if (Array.isArray(data?.endpoints)) setKnownEndpoints(data.endpoints);
        // Replaces the bootstrap fallback in place with the backend's
        // canonical list (config.NOISE_PATH_MARKERS) - the same list the
        // SQL Client Errors exclusion uses, so "Hide noise" and that stat
        // can no longer silently disagree the way the old hardcoded copy
        // eventually did.
        if (Array.isArray(data?.noise_patterns) && data.noise_patterns.length > 0) {
          NOISE_PATTERNS = data.noise_patterns;
          setNoiseListVersion((v) => v + 1);
        }
      } catch {
        // Silent - see comment above.
      }
    })();
  }, [fetchHttp, fetchSystem]);

  // ---------------- Scroll anchoring ----------------
  // useLayoutEffect, not useEffect: the scroll write has to land in the
  // same frame the new rows are committed, or the browser paints the
  // un-adjusted position first and you see a visible jump.
  useLayoutEffect(() => {
    const adjust = httpScrollAdjustRef.current;
    if (adjust) {
      if (scrollRef.current && adjust.desk) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight - adjust.desk[0] + adjust.desk[1];
      }
      if (mobileScrollRef.current && adjust.mob) {
        mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight - adjust.mob[0] + adjust.mob[1];
      }
      httpScrollAdjustRef.current = null;
      return;
    }
    if (httpPinnedRef.current) {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
    }
  }, [httpLogs]);

  // System-tab filtering. Declared HERE, above the scroll-anchoring
  // effect below, because that effect depends on it - a `const` used
  // before its declaration line is a temporal-dead-zone ReferenceError
  // at mount, not a hoisted undefined.
  const [debouncedSystemSearch, setDebouncedSystemSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSystemSearch(systemSearch), 120);
    return () => clearTimeout(t);
  }, [systemSearch]);

  const filteredSystemLogs = useMemo(() => {
    const needle = debouncedSystemSearch.toLowerCase();
    // Same fast path as the HTTP filter: unfiltered means reuse the same
    // array identity so React can skip reconciling the whole list.
    if (!levelFilter && !needle) return systemLogs;
    return systemLogs.filter((entry) => {
      if (levelFilter && entry.level !== levelFilter) return false;
      if (needle) {
        const hay = `${entry.logger} ${entry.message}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [systemLogs, levelFilter, debouncedSystemSearch]);

  // Groups CONSECUTIVE lines sharing a request_id into one visual unit.
  // A single download can log 20+ lines (attempt retries, cookie
  // rotation, download progress ticks every ~10%, cache save, complete) -
  // showing every one of those at full height by default is exactly the
  // "too much scrolling to find anything" problem the click-through
  // feature was built to solve, just recreated inside the live feed
  // itself. The fix isn't hiding the noise, it's showing the two lines
  // that actually matter (what started, what it ended as) and folding
  // everything between them behind one "N more lines" toggle.
  //
  // Lines with no request_id ("-") never merge into a group, even when
  // adjacent - sharing "-" doesn't mean two lines are related, it means
  // neither carries one, so grouping them would visually imply a
  // connection that isn't real.
  type SystemGroup = { key: string; entries: SystemLogEntry[] };
  const systemGroups = useMemo<SystemGroup[]>(() => {
    const groups: SystemGroup[] = [];
    for (const entry of filteredSystemLogs) {
      const prev = groups[groups.length - 1];
      const prevEntry = prev?.entries[prev.entries.length - 1];
      if (
        prevEntry &&
        entry.request_id &&
        entry.request_id !== "-" &&
        entry.request_id === prevEntry.request_id
      ) {
        prev.entries.push(entry);
      } else {
        groups.push({ key: `g${entry.id}`, entries: [entry] });
      }
    }
    return groups;
  }, [filteredSystemLogs]);

  // Which groups have their collapsed middle expanded. Keyed by the
  // group's own key (its first entry's id), not the request_id - a
  // request_id can recur across separate groups (retrying the same
  // video later), and those should expand independently.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useLayoutEffect(() => {
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
    // Depends on the FILTERED list because that's what's actually
    // rendered: applying a level or search filter changes the content
    // height without systemLogs itself changing, and anchoring on the
    // unfiltered array would leave the view stranded mid-list.
  }, [filteredSystemLogs]);

  // Consumes the one-shot flag set by clearCorrelated(). Keyed on
  // correlatedRequestId because that's precisely what triggers the live
  // panel's remount - a layout effect here runs after the new node is in
  // the DOM but before paint, so the jump to the bottom is never visible
  // as a flash at the top first.
  useLayoutEffect(() => {
    if (correlatedRequestId) return;      // correlated view is open, not the live one
    if (!sysNeedsBottomRef.current) return;
    const el = sysRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    sysNeedsBottomRef.current = false;
  }, [correlatedRequestId, filteredSystemLogs]);

  // Switching tabs UNMOUNTS the other panel, so its scroll container is
  // a brand-new element (scrollTop 0) when it comes back. The System
  // panel never got pinned at all on first view for exactly this reason:
  // its container didn't exist when the boot fetch landed, so the effect
  // above bailed on a null ref, and switching tabs didn't change
  // systemLogs so nothing re-ran. Re-pin on show instead.
  useLayoutEffect(() => {
    if (tab === "http") {
      if (httpPinnedRef.current) {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        if (mobileScrollRef.current) mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
      }
      setShowJumpHttp(!httpPinnedRef.current);
    } else {
      const el = sysRef.current;
      if (el && sysPinnedRef.current) el.scrollTop = el.scrollHeight;
      setShowJumpSys(!sysPinnedRef.current);
    }
  }, [tab, isMobile]);

  // Immediate full refresh whenever the user switches panels, so the
  // newly visible tab shows current data right away. Full (not delta)
  // because the lastId/oldest cursors need to be correctly seeded before
  // delta polling can do anything useful for a tab that may not have
  // been fetched in a while.
  useEffect(() => {
    // Same invariant as everywhere else now: paused means no automatic
    // fetch, full stop, until Resume or manual Refresh is pressed. This
    // used to fetch unconditionally on every tab switch, which is the
    // same class of bug as the visibility-change one above - just
    // triggered by switching HTTP/System instead of switching browser
    // tabs. Manual Refresh (handleManualRefresh) still works while
    // paused, since that's an explicit action, not automatic polling.
    if (isPaused) return;
    if (tab === "http") fetchHttp();
    else fetchSystem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isPaused]);

  // ---------------- Self-adjusting poll ----------------
  // Starts at MIN_POLL_MS; every tick that comes back with nothing new
  // stretches the delay out (capped at MAX_POLL_MS), so a quiet dashboard
  // left open gradually polls less instead of hammering the backend
  // forever. Any tick that DOES find data - or any manual interaction -
  // snaps back to fast. Recursive setTimeout, not setInterval, because
  // the delay itself changes between ticks.
  useEffect(() => {
    if (isPaused) return;
    // The correlated view is a fixed, historical result set - nothing it
    // displays can change, so polling while it's open burns requests and
    // re-renders for data that isn't on screen.
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
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isPaused, tab, correlatedRequestId, fetchHttpDelta, fetchSystemDelta]);

  // The moment the browser tab regains focus, snap back to fast polling
  // and fetch immediately - don't make the user wait out whatever backoff
  // accumulated while they were away. Matches SWR/React Query's
  // revalidate-on-focus behavior.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) return;
      // Was missing this check - meant returning to the tab fetched
      // fresh data unconditionally, ignoring pause. The Pause button
      // still correctly said "Resume" and isPaused was still true, but
      // new lines appeared anyway the instant you switched back, which
      // looks exactly like pause silently turning itself off. Now this
      // matches the main poll loop below, which already respects
      // isPaused - the two should never disagree about whether polling
      // is allowed to happen.
      if (isPaused) return;
      currentDelayRef.current = MIN_POLL_MS;
      if (tab === "http") fetchHttpDelta();
      else fetchSystemDelta();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [tab, isPaused, fetchHttpDelta, fetchSystemDelta]);

  // ---------------- Filtering ----------------
  // Debounced so typing in the path box doesn't re-filter thousands of
  // rows on every single keystroke. The input itself stays fully
  // responsive because its value is separate state.
  const [debouncedPath, setDebouncedPath] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPath(pathFilter), 120);
    return () => clearTimeout(t);
  }, [pathFilter]);

  // The tool list powering both the endpoint picker and the search
  // suggestions. Built from the backend's real route table
  // (knownEndpoints - see admin_endpoints() in routes.py) so every tool
  // appears even with zero traffic, then merged with live counts from
  // what's loaded.
  //
  // Traffic NOT matching a known family - bot scanners, path-traversal
  // probes, anything not a registered route - is never given its own
  // entry or a generated label. It's counted into one "Other" bucket
  // instead (see below). This is what actually keeps the picker clean:
  // a single day of real traffic produced ~300 distinct junk paths, and
  // synthesizing a plausible-looking name for each of them (the old
  // behavior) is how scanner noise ends up indistinguishable from a real
  // tool in the dropdown.
  //
  // Respects hideNoise: bot scanners probe hundreds of junk paths
  // (/wp-admin, /.env, /phpmyadmin...) and without this the real tools
  // would be buried. Only applies to traffic-derived entries - the
  // backend's own route table has nothing to filter.
  // Which paths are REAL, backend-registered tools - the only ones
  // allowed their own picker entry. Everything else collapses into one
  // "Other" bucket below, which is what actually solves the scanner-noise
  // problem: a single day of traffic produced ~300 distinct junk paths
  // (.env variants, aws/gcp credential probes, ssh keys, WHM/Joomla
  // scanners...), and a hand-maintained pattern list can never keep pace
  // with new campaigns. This doesn't need to - unrecognized traffic just
  // has nowhere to go but "Other", automatically, forever.
  const knownPathSet = useMemo(
    () => new Set(knownEndpoints.map((e) => e.path)),
    [knownEndpoints]
  );

  const endpointOptions = useMemo(() => {
    const byPath = new Map<
      string,
      { path: string; label: string; count: number; loaded: number }
    >();
    for (const ep of knownEndpoints) {
      byPath.set(ep.path, {
        path: ep.path,
        label: ep.label,
        // Real all-time total from the database. Previously this started
        // at 0 and was incremented per LOADED row, so the number shrank
        // as the in-memory window trimmed older entries - a tool showing
        // 967 quietly became 233 after scrolling, which read as
        // "requests disappeared".
        count: ep.total_requests ?? 0,
        loaded: 0,
      });
    }

    let otherCount = 0;
    let otherLoaded = 0;
    for (const log of httpLogs) {
      if (!log.path) continue; // stale malformed rows (e.g. an empty path) - nothing to label
      if (hideNoise && isNoise(log.path)) continue;
      const family = toolFamily(log.path);
      const existing = byPath.get(family);
      if (existing) {
        // Tracked separately from `count` rather than replacing it: this
        // is "how many are in memory right now", useful when a filter is
        // active, but it must never overwrite the stable total.
        existing.loaded += 1;
      } else {
        // NOT a registered tool. Previously this humanized the raw path
        // into a plausible-looking name - which is how
        // "/___proxy_subdomain_whm/login/" became a dropdown entry
        // reading "Proxy Subdomain Whm Login", indistinguishable from a
        // real tool. Bucketed instead. No DB total exists for this
        // bucket (it's a client-side grouping), so loaded rows are the
        // only number available here.
        otherCount += 1;
        otherLoaded += 1;
      }
    }

    const all = [...byPath.values()];
    if (otherCount > 0) {
      all.push({
        path: OTHER_TRAFFIC_KEY,
        label: `Other (unrecognized traffic)`,
        count: otherCount,
        loaded: otherLoaded,
      });
    }

    // Busy tools first (what you're most likely looking for), then the
    // quiet ones alphabetically - still present and findable, just not
    // competing with live activity for the top of the list. "Other" is
    // sorted by its own count like everything else, so it naturally
    // lands wherever its volume actually puts it.
    const active = all.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
    const idle = all.filter((e) => e.count === 0).sort((a, b) => a.label.localeCompare(b.label));
    return [...active, ...idle];
  }, [httpLogs, hideNoise, knownEndpoints, noiseListVersion]);

  // Typeahead suggestions. Matches on BOTH the human label and the path,
  // so "convert" and "/convert" both work, and searching "youtube" finds
  // all three YouTube tools. Empty input shows the busiest tools rather
  // than nothing - that's the "I know what it does but forgot the name"
  // case, which is the whole reason this exists.
  //
  // No cap needed on the picker itself any more: collapsing routes to
  // tool families took it from ~100 entries to ~25, which is entirely
  // scannable. Suggestions stay capped at 8 purely so the dropdown never
  // covers the table.
  const pathSuggestions = useMemo(() => {
    const needle = pathFilter.trim().toLowerCase();
    if (!needle) return endpointOptions.slice(0, 8);
    return endpointOptions
      .filter(
        (e) =>
          e.label.toLowerCase().includes(needle) ||
          e.path.toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [endpointOptions, pathFilter]);

  // Drives the mobile "Filters" badge and the clear-all button. Counts
  // deviations from the DEFAULT state, not merely non-empty values -
  // hideNoise defaults to on, so having it on isn't "a filter you
  // applied", but turning it off is.
  const activeFilterCount =
    (methodFilter ? 1 : 0) +
    (endpointFilter ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0) +
    (statusClassFilter !== "all" ? 1 : 0) +
    (hideNoise ? 0 : 1) +
    (pathFilter ? 1 : 0);

  const resetFilters = useCallback(() => {
    setMethodFilter("");
    setEndpointFilter("");
    setDateFilter("all");
    setStatusClassFilter("all");
    setHideNoise(true);
    setPathFilter("");
  }, []);

  const filtered = useMemo(() => {
    const needle = debouncedPath.toLowerCase();
    // Fast path: nothing is filtering, so skip the per-row work entirely
    // and reuse the same array identity, which lets React skip the whole
    // list reconciliation too.
    if (
      !methodFilter && !endpointFilter && !needle && !hideNoise &&
      dateFilter === "all" && statusClassFilter === "all"
    ) return httpLogs;

    const wantKey =
      dateFilter === "today" ? todayKey() : dateFilter === "yesterday" ? yesterdayKey() : null;

    return httpLogs.filter((log) => {
      if (methodFilter && log.method !== methodFilter) return false;
      if (endpointFilter) {
        const family = toolFamily(log.path);
        if (endpointFilter === OTHER_TRAFFIC_KEY) {
          if (knownPathSet.has(family)) return false; // it IS a known tool, so it's not "Other"
        } else if (family !== endpointFilter) {
          return false;
        }
      }
      if (needle && !log.path.toLowerCase().includes(needle)) return false;
      if (hideNoise && isNoise(log.path)) return false;
      if (statusClassFilter === "4xx" && !(log.status_code >= 400 && log.status_code < 500)) return false;
      if (statusClassFilter === "5xx" && log.status_code < 500) return false;
      if (wantKey) {
        try {
          if (npYMD(log.timestamp) !== wantKey) return false;
        } catch { return false; }
      }
      return true;
    });
  }, [httpLogs, methodFilter, endpointFilter, debouncedPath, hideNoise, dateFilter, statusClassFilter, noiseListVersion, knownPathSet]);

  function requestDelete(olderThanDays: number | null) {
    setDeleteResult(null);
    setPendingDelete(olderThanDays);
  }

  async function confirmDelete() {
    if (pendingDelete === "none") return;
    const olderThanDays = pendingDelete;
    setDeleteRunning(true);
    try {
      const url = olderThanDays ? `/api/admin/logs?olderThanDays=${olderThanDays}` : `/api/admin/logs`;
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      const n = data.deleted_http_logs ?? 0;
      setDeleteResult(
        `Removed ${n.toLocaleString()} HTTP log ${n === 1 ? "entry" : "entries"}` +
          (data.system_buffer_cleared ? " and cleared the system log buffer." : ".")
      );
      // Everything held is now potentially stale or gone - reset the
      // cursors and re-seed from scratch rather than paging off a dead id.
      httpSigRef.current = "";
      sysSigRef.current = "";
      httpLastIdRef.current = 0;
      sysLastIdRef.current = 0;
      httpOldestRef.current = 0;
      sysOldestRef.current = 0;
      httpPinnedRef.current = true;
      sysPinnedRef.current = true;
      currentDelayRef.current = MIN_POLL_MS;
      fetchHttp(true);
      fetchSystem(true);
    } catch (e) {
      setDeleteResult(`Failed: ${(e as Error).message}`);
    } finally {
      setDeleteRunning(false);
      setPendingDelete("none");
    }
  }

  async function handleManualRefresh() {
    setIsRefreshing(true);
    currentDelayRef.current = MIN_POLL_MS;
    const minSpinTime = new Promise((resolve) => setTimeout(resolve, 500));
    try {
      await Promise.all([fetchHttp(true), fetchSystem(true), minSpinTime]);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 py-4 sm:py-5 flex-1 min-h-0 flex flex-col gap-4 sm:gap-5">
      {/* ===== Page heading + tabs ===== */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Request Logs</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5 hidden sm:block">
            Live traffic and system events from the backend.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="flex items-center gap-1.5 text-xs text-text-subtle">
            <span className={`h-1.5 w-1.5 rounded-full ${isPaused ? "bg-amber-500" : "bg-teal-400"}`} />
            {isPaused ? "Paused" : "Live"}
          </span>
          <div className="flex rounded-lg border border-graphite-800 bg-graphite-900 p-0.5">
            <TabButton active={tab === "http"} onClick={() => setTab("http")} icon={Activity} label="HTTP" />
            <TabButton active={tab === "system"} onClick={() => setTab("system")} icon={Terminal} label="System" />
          </div>
        </div>
      </div>

      {tab === "http" ? (
        <>
          {/* ===== Stat strip =====
              Client errors (4xx) are amber as a mild "worth a glance" -
              they are NORMAL traffic (bots, rate limits, rejected
              uploads). Server errors (5xx) turn red only above zero,
              and are the one worth actually investigating. */}
          <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-graphite-800 rounded-lg border border-graphite-800 bg-graphite-900">
            <Stat label="Total" value={totals.total} />
            <Stat label="Success" value={totals.success} valueClass="text-teal-400" />
            <Stat
              label="Client Errors"
              value={totals.client}
              valueClass="text-amber-400"
              hint="4xx — rejected requests: rate limits, bad uploads, bots probing routes. Normal, not a bug."
            />
            <Stat
              label="Server Errors"
              value={totals.server}
              valueClass={totals.server > 0 ? "text-red-500" : ""}
              hint="5xx — the backend actually broke. Check the System tab if this is above zero."
            />
          </div>

          {/* ===== Unified table card ===== */}
          {/* NOTE: no overflow-hidden here - it would clip the Delete
              dropdown menu, which needs to escape the card bounds on
              small screens. */}
          <section className="rounded-lg border border-graphite-800 bg-graphite-900 flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 flex flex-col gap-2.5 px-3 sm:px-4 py-3 border-b border-graphite-800">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-subtle pointer-events-none" />
                <input
                  type="text"
                  value={pathFilter}
                  onChange={(e) => {
                    setPathFilter(e.target.value);
                    setSuggestOpen(true);
                    setHighlightIndex(-1);
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  // Delayed so a mousedown on a suggestion still lands -
                  // blur fires first otherwise and the list is gone
                  // before the click resolves.
                  onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
                  onKeyDown={(e) => {
                    if (!suggestOpen || pathSuggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightIndex((i) => (i + 1) % pathSuggestions.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightIndex((i) => (i <= 0 ? pathSuggestions.length - 1 : i - 1));
                    } else if (e.key === "Enter") {
                      // Only hijack Enter when something is actually
                      // highlighted; otherwise the typed text stands.
                      if (highlightIndex >= 0) {
                        e.preventDefault();
                        setEndpointFilter(pathSuggestions[highlightIndex].path);
                        setPathFilter("");
                      }
                      setSuggestOpen(false);
                      setHighlightIndex(-1);
                    } else if (e.key === "Escape") {
                      setSuggestOpen(false);
                      setHighlightIndex(-1);
                    }
                  }}
                  placeholder="Filter by path…"
                  role="combobox"
                  aria-expanded={suggestOpen && pathSuggestions.length > 0}
                  aria-autocomplete="list"
                  className="w-full rounded-md border border-graphite-700 bg-graphite-850 py-1.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-amber-500/60"
                />
                {pathFilter && (
                  <button
                    onClick={() => { setPathFilter(""); setHighlightIndex(-1); }}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-subtle hover:text-text-primary hover:bg-graphite-800 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}

                {suggestOpen && pathSuggestions.length > 0 && (
                  <div
                    role="listbox"
                    className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl overflow-hidden z-40"
                  >
                    {!pathFilter.trim() && (
                      <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-text-subtle">
                        Busiest tools
                      </p>
                    )}
                    {pathSuggestions.map((sug, i) => (
                      <button
                        key={sug.path}
                        role="option"
                        aria-selected={i === highlightIndex}
                        // mousedown, not click: fires before the input's
                        // blur, so the selection isn't lost to the
                        // dropdown unmounting first.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          // Sets the EXACT tool filter rather than a
                          // fuzzy path substring - picking "Convert"
                          // from a list of tools should mean that tool,
                          // not "anything containing the text convert".
                          setEndpointFilter(sug.path);
                          setPathFilter("");
                          setSuggestOpen(false);
                          setHighlightIndex(-1);
                        }}
                        onMouseEnter={() => setHighlightIndex(i)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                          i === highlightIndex ? "bg-graphite-800" : "hover:bg-graphite-800"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-xs text-text-primary truncate">{sug.label}</span>
                          <span className="block font-mono text-[10px] text-text-subtle truncate">{sug.path}</span>
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

                {/* Mobile-only: collapse eight controls behind one
                    button. The badge shows how many are active, so a
                    filtered view never silently hides rows behind a
                    closed panel. Hidden on desktop, where there's room
                    to show everything inline. */}
                <button
                  onClick={() => setFiltersOpen((o) => !o)}
                  className={`sm:hidden shrink-0 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    filtersOpen || activeFilterCount > 0
                      ? "border-amber-500/50 text-amber-400"
                      : "border-graphite-700 text-text-muted"
                  }`}
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-amber-500 text-graphite-950 px-1.5 text-[10px] font-semibold tabular-nums">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Actions - always visible, on every screen size,
                    regardless of whether the filter panel is open or
                    collapsed. These control the live feed itself, not
                    what's shown in it, so hiding them behind "Filters"
                    would be a trap, not a simplification. */}
                <div className="hidden sm:block h-5 w-px bg-graphite-800" />
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
                      <div className="absolute top-full right-0 mt-2 w-48 rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl overflow-hidden z-30">
                        <MenuItem onClick={() => { setManageOpen(false); requestDelete(1); }}>Older than 1 day</MenuItem>
                        <MenuItem onClick={() => { setManageOpen(false); requestDelete(7); }}>Older than 7 days</MenuItem>
                        <MenuItem danger onClick={() => { setManageOpen(false); requestDelete(null); }}>Delete all logs</MenuItem>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={`${filtersOpen ? "flex" : "hidden"} sm:flex flex-wrap items-center gap-2`}>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-amber-500/60"
                >
                  <option value="">All methods</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <div className="relative flex-1 sm:flex-none min-w-0 sm:w-[220px]">
                  <button
                    onClick={() => setToolPickerOpen((o) => !o)}
                    title={
                      endpointFilter
                        ? endpointOptions.find((e) => e.path === endpointFilter)?.label ?? endpointFilter
                        : "Tools this API serves, read from the backend's own route table"
                    }
                    aria-expanded={toolPickerOpen}
                    aria-haspopup="listbox"
                    className={`w-full flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm text-left transition-colors ${
                      toolPickerOpen
                        ? "border-amber-500/60 text-text-primary"
                        : "border-graphite-700 text-text-primary hover:border-graphite-600"
                    } bg-graphite-850`}
                  >
                    <span className="truncate">
                      {endpointFilter
                        ? endpointOptions.find((e) => e.path === endpointFilter)?.label ?? endpointFilter
                        : "All tools"}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-text-subtle transition-transform ${toolPickerOpen ? "rotate-180" : ""}`} />
                  </button>

                  {toolPickerOpen && (
                    <>
                      {/* Invisible backdrop: tap anywhere outside to close,
                          same pattern as the Delete menu below. */}
                      <button
                        aria-hidden
                        tabIndex={-1}
                        onClick={() => setToolPickerOpen(false)}
                        className="fixed inset-0 z-20 cursor-default"
                      />
                      <div
                        role="listbox"
                        // max-h + overflow-y-auto + scrollbar-thin: a REAL,
                        // styled scrollbar - impossible on a native <select>,
                        // whose open dropdown is OS-rendered and reachable
                        // by no CSS this app owns.
                        className="absolute top-full left-0 right-0 sm:right-auto mt-1 max-h-72 overflow-y-auto scrollbar-thin rounded-lg border border-graphite-700 bg-graphite-850 shadow-xl z-30"
                      >
                        <button
                          role="option"
                          aria-selected={!endpointFilter}
                          onClick={() => { setEndpointFilter(""); setToolPickerOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            !endpointFilter ? "bg-graphite-800 text-text-primary" : "text-text-muted hover:bg-graphite-800 hover:text-text-primary"
                          }`}
                        >
                          All tools
                        </button>
                        <div className="h-px bg-graphite-800" />
                        {endpointOptions.map((e) => {
                          const isOther = e.path === OTHER_TRAFFIC_KEY;
                          return (
                          <button
                            key={e.path}
                            role="option"
                            aria-selected={endpointFilter === e.path}
                            // Real tooltip on hover - the whole reason this
                            // replaced the native select. Shows the full
                            // label AND path, useful the moment a label
                            // gets long enough to truncate. "Other" gets
                            // an explanatory tooltip instead of its
                            // internal sentinel value, which would be a
                            // meaningless string to show anyone.
                            title={
                              isOther
                                ? `${e.count.toLocaleString()} requests to paths that aren't a registered tool - mostly scanner/bot traffic`
                                : `${e.label}\n${e.path}\n${
                                    e.count > 0
                                      ? `${e.count.toLocaleString()} requests all-time`
                                      : "No traffic yet"
                                  }${
                                    e.loaded > 0 && e.loaded !== e.count
                                      ? ` (${e.loaded.toLocaleString()} currently loaded)`
                                      : ""
                                  }`
                            }
                            onClick={() => { setEndpointFilter(e.path); setToolPickerOpen(false); }}
                            className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                              endpointFilter === e.path ? "bg-graphite-800" : "hover:bg-graphite-800"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className={`block text-sm truncate ${isOther ? "text-text-muted italic" : "text-text-primary"}`}>
                                {e.label}
                              </span>
                              {!isOther && (
                                <span className="block font-mono text-[10px] text-text-subtle truncate">{e.path}</span>
                              )}
                            </span>
                            {e.count > 0 && (
                              <span className="shrink-0 text-[11px] text-text-subtle tabular-nums">
                                {e.count.toLocaleString()}
                              </span>
                            )}
                          </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                  className="rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-amber-500/60"
                >
                  <option value="all">Any date</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                </select>
                <div className="flex rounded-md border border-graphite-700 bg-graphite-850 p-0.5">
                  <StatusChip active={statusClassFilter === "all"} onClick={() => setStatusClassFilter("all")} label="All" />
                  <StatusChip active={statusClassFilter === "4xx"} onClick={() => setStatusClassFilter("4xx")} label="4xx" tone="text-amber-400" />
                  <StatusChip active={statusClassFilter === "5xx"} onClick={() => setStatusClassFilter("5xx")} label="5xx" tone="text-red-500" />
                </div>
                <label className="flex items-center gap-1.5 text-sm text-text-muted select-none cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={hideNoise}
                    onChange={(e) => setHideNoise(e.target.checked)}
                    className="accent-amber-500"
                  />
                  Hide noise
                </label>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-text-subtle hover:text-text-primary transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Desktop table */}
            {!isMobile && (
              <div className="relative flex-1 min-h-0">
                <div
                  ref={scrollRef}
                  onScroll={(e) => handleHttpScroll(e.currentTarget)}
                  className="h-full overflow-y-auto scrollbar-thin"
                >
                  <TopSentinel loading={httpLoadingOlder} hasOlder={httpHasOlder} count={httpLogs.length} total={httpTotal} />
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
                        <HttpTableRow key={log.id} log={log} onOpenLogs={loadCorrelated} />
                      ))}
                    </tbody>
                  </table>
                  <ListState
                    loading={httpLoading}
                    error={httpError}
                    empty={filtered.length === 0}
                    emptyLabel={
                      httpLogs.length === 0
                        ? "No requests logged yet."
                        : "No requests match the current filters."
                    }
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
                  <TopSentinel loading={httpLoadingOlder} hasOlder={httpHasOlder} count={httpLogs.length} total={httpTotal} />
                  <div className="divide-y divide-graphite-800/70">
                    {filtered.map((log) => (
                      <HttpCardRow key={log.id} log={log} onOpenLogs={loadCorrelated} />
                    ))}
                  </div>
                  <ListState
                    loading={httpLoading}
                    error={httpError}
                    empty={filtered.length === 0}
                    emptyLabel={
                      httpLogs.length === 0
                        ? "No requests logged yet."
                        : "No requests match the current filters."
                    }
                  />
                </div>
                {showJumpHttp && <JumpButton onClick={jumpToBottomHttp} />}
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
          <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-b border-graphite-800">
            <span className="text-sm text-text-muted">
              Application log buffer
              {sysTotal > 0 && (
                <span className="text-text-subtle tabular-nums">
                  {" "}({systemLogs.length.toLocaleString()} of {sysTotal.toLocaleString()})
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => requestDelete(null)}
                className="flex items-center gap-1.5 rounded-md border border-graphite-700 px-2.5 py-1.5 text-xs text-text-muted hover:text-red-500 hover:border-red-500/40 transition-colors"
                title="Clears both HTTP and system logs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear all logs</span>
              </button>
            </div>
          </div>

          {/* Search + level filter - disabled while viewing a correlated
              request, since that's already a fixed, filtered result set
              and applying a second filter on top of it would just be
              confusing about which filter produced what's on screen. */}
          {!correlatedRequestId && (
            <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-graphite-800">
              <div className="relative flex-1 min-w-[140px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-subtle pointer-events-none" />
                <input
                  type="text"
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  placeholder="Search logger or message…"
                  className="w-full rounded-md border border-graphite-700 bg-graphite-850 py-1.5 pl-9 pr-9 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus:border-amber-500/60"
                />
                {systemSearch && (
                  <button
                    onClick={() => setSystemSearch("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-subtle hover:text-text-primary hover:bg-graphite-800 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="shrink-0 rounded-md border border-graphite-700 bg-graphite-850 px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-amber-500/60"
              >
                <option value="">All levels</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
              </select>
            </div>
          )}

          {correlatedRequestId ? (
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-2.5 border-b border-amber-500/30 bg-amber-500/[0.06]">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-amber-400">
                    Showing logs for one request
                  </p>
                  {correlatedSummary && (
                    <p className="text-[11px] text-text-subtle font-mono truncate mt-0.5">
                      {correlatedSummary.method} {correlatedSummary.path} → {correlatedSummary.status_code}
                      {" · "}{npDate(correlatedSummary.timestamp)} {npTime(correlatedSummary.timestamp)}
                      {" · "}{correlatedLogs.length} line{correlatedLogs.length === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
                <button
                  onClick={clearCorrelated}
                  title="Back to live log"
                  className="shrink-0 flex items-center gap-1 rounded-md border border-graphite-700 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 transition-colors"
                >
                  <X className="h-3 w-3" />
                  <span className="hidden sm:inline">Back to live log</span>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin font-mono text-xs">
                {correlatedLoading && (
                  <p className="text-center text-sm text-text-subtle py-12 flex items-center justify-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </p>
                )}
                {correlatedError && (
                  <p className="text-center text-sm text-red-500 py-12 px-4">Failed to load: {correlatedError}</p>
                )}
                {!correlatedLoading && !correlatedError && correlatedLogs.length === 0 && (
                  <p className="text-center text-sm text-text-subtle py-12">
                    No system log lines were recorded for this request.
                  </p>
                )}
                {correlatedLogs.map((entry) => (
                  <SystemRow
                    key={entry.id}
                    entry={entry}
                    // Always false here: every line in this view belongs
                    // to the same request by construction, so there are
                    // no request boundaries to mark. Passing true would
                    // draw a divider between every single line.
                    newGroup={false}
                  />
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
                <TopSentinel loading={sysLoadingOlder} hasOlder={sysHasOlder} count={systemLogs.length} total={sysTotal} />
                {systemGroups.map((group, index) => (
                  <SystemGroupBlock
                    key={group.key}
                    group={group}
                    isFirst={index === 0}
                    expanded={expandedGroups.has(group.key)}
                    onToggle={() => toggleGroup(group.key)}
                  />
                ))}
                <ListState
                  loading={systemLoading}
                  error={systemError}
                  empty={filteredSystemLogs.length === 0}
                  emptyLabel={
                    systemLogs.length === 0
                      ? "No system logs yet."
                      : "No system logs match the current filters."
                  }
                />
              </div>
              {showJumpSys && <JumpButton onClick={jumpToBottomSys} />}
            </div>
          )}
        </section>
      )}

      {pendingDelete !== "none" && (
        <ConfirmDialog
          title={pendingDelete === null ? "Delete all logs?" : `Delete logs older than ${pendingDelete} day${pendingDelete === 1 ? "" : "s"}?`}
          body={
            pendingDelete === null
              ? "This permanently removes every HTTP log and clears the system log buffer. This can't be undone."
              : `This permanently removes HTTP log entries older than ${pendingDelete} day${pendingDelete === 1 ? "" : "s"}. This can't be undone.`
          }
          confirmLabel={pendingDelete === null ? "Delete all logs" : "Delete"}
          loading={deleteRunning}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete("none")}
        />
      )}

      {deleteResult && (
        <div className="fixed bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm sm:w-auto rounded-lg border border-graphite-700 bg-graphite-850 px-4 py-2.5 text-sm text-text-primary shadow-xl flex items-center gap-3">
          <span className="flex-1 min-w-0">{deleteResult}</span>
          <button
            onClick={() => setDeleteResult(null)}
            aria-label="Dismiss"
            className="shrink-0 text-text-subtle hover:text-text-primary transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ===== Small building blocks ===== */

function JumpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-amber-500 text-graphite-950 px-3.5 py-1.5 text-xs font-medium shadow-lg hover:bg-amber-400 transition-colors"
    >
      <ArrowDown className="h-3.5 w-3.5" />
      Jump to latest
    </button>
  );
}

/** Sits at the very top of a log list. Older entries load automatically
 *  when the reader scrolls near it, so this is a status indicator rather
 *  than a button - it reports what's happening and where the history
 *  ends, the way a terminal scrollback does. */
function TopSentinel({
  loading, hasOlder, count, total,
}: {
  loading: boolean;
  hasOlder: boolean;
  count: number;
  total: number;
}) {
  if (loading) {
    return (
      <div className="px-4 py-3 border-b border-graphite-800/70 flex items-center justify-center gap-2 text-[11px] text-text-subtle">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading older entries…
      </div>
    );
  }
  if (!hasOlder) {
    return (
      <div className="px-4 py-3 border-b border-graphite-800/70 text-center text-[11px] text-text-subtle">
        Beginning of the log — {count.toLocaleString()} entr{count === 1 ? "y" : "ies"} loaded.
      </div>
    );
  }
  return (
    <div className="px-4 py-3 border-b border-graphite-800/70 text-center text-[11px] text-text-subtle tabular-nums">
      Scroll up for older entries
      {total > count && <> · {count.toLocaleString()} of {total.toLocaleString()} loaded</>}
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
  // Escape closes the dialog, same as clicking Cancel - matches native
  // confirm() behavior so muscle memory still works.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [loading, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-hidden
        tabIndex={-1}
        onClick={loading ? undefined : onCancel}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] cursor-default"
      />
      <div className="relative w-full max-w-sm rounded-lg border border-graphite-700 bg-graphite-900 shadow-2xl p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">{title}</p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">{body}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-graphite-700 px-3.5 py-2 sm:py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-graphite-850 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 rounded-md bg-red-500 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-graphite-950 hover:bg-red-500/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
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
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? `bg-graphite-700 ${tone || "text-text-primary"}`
          : `text-text-subtle hover:text-text-primary ${tone}`
      }`}
    >
      {label}
    </button>
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

function Stat({
  label, value, valueClass = "", hint,
}: {
  label: string;
  value: number;
  valueClass?: string;
  /** Optional tooltip via native title attr - explains what the bucket
   *  means without needing permanent on-screen copy for every box. */
  hint?: string;
}) {
  return (
    <div className="px-3 sm:px-5 py-3.5 min-w-0" title={hint}>
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

// Log rows are immutable once written - same id means identical content,
// so a fresh fetch producing new (but equal) objects still skips the
// re-render for every row already on screen.
const HttpTableRow = memo(
  function HttpTableRow({ log, onOpenLogs }: { log: HttpLogEntry; onOpenLogs: (log: HttpLogEntry) => void }) {
    const clickable = !!log.request_id;
    return (
      <tr
        onClick={clickable ? () => onOpenLogs(log) : undefined}
        className={`group transition-colors ${clickable ? "hover:bg-graphite-850/60 cursor-pointer" : "opacity-70"}`}
        title={clickable ? "View this request's system logs" : "No request id recorded for this row"}
      >
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
        <td className="px-4 py-2 font-mono text-xs text-text-subtle">
          <div className="flex items-center justify-between gap-2">
            <span>{log.client_ip}</span>
            {clickable && (
              <ScrollText className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 text-amber-400 transition-opacity" />
            )}
          </div>
        </td>
      </tr>
    );
  },
  (prev, next) => prev.log.id === next.log.id
);

const HttpCardRow = memo(
  function HttpCardRow({ log, onOpenLogs }: { log: HttpLogEntry; onOpenLogs: (log: HttpLogEntry) => void }) {
    const clickable = !!log.request_id;
    return (
      <div
        onClick={clickable ? () => onOpenLogs(log) : undefined}
        className={`px-4 py-2.5 ${clickable ? "active:bg-graphite-850/60 cursor-pointer" : "opacity-70"}`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(log.status_code)}`} />
          <span className={`text-xs font-semibold shrink-0 ${methodTone(log.method)}`}>{log.method}</span>
          <span className="font-mono text-xs text-text-primary truncate flex-1" title={log.path}>{log.path}</span>
          <span className={`text-xs font-medium tabular-nums shrink-0 ${statusText(log.status_code)}`}>{log.status_code}</span>
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

/** contentVisibility: "auto" tells the browser to skip layout, paint and
 *  style for entries scrolled out of view. System log messages wrap to
 *  arbitrary heights so they're the expensive ones to render;
 *  containIntrinsicSize gives the scrollbar a size estimate so skipping
 *  them doesn't make the scroll height jump around. */
const SystemRow = memo(
  function SystemRow({ entry, newGroup }: { entry: SystemLogEntry; newGroup: boolean }) {
    const tone = levelTone(entry.level);
    return (
      <div
        style={{ contentVisibility: "auto", containIntrinsicSize: "0 56px" }}
        className={`border-l-2 ${tone.border} px-4 py-2 hover:bg-graphite-850/60 transition-colors ${
          newGroup ? "border-t border-t-graphite-700 mt-1 pt-2.5" : ""
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
  },
  (prev, next) => prev.entry.id === next.entry.id && prev.newGroup === next.newGroup
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
    group, isFirst, expanded, onToggle,
  }: {
    group: { key: string; entries: SystemLogEntry[] };
    isFirst: boolean;
    expanded: boolean;
    onToggle: () => void;
  }) {
    const { entries } = group;

    // A single line (no request_id, or a request that only logged
    // once) needs no head/tail split - render it exactly as before.
    if (entries.length === 1) {
      return <SystemRow entry={entries[0]} newGroup={!isFirst} />;
    }

    const head = entries[0];
    const tail = entries[entries.length - 1];
    const middle = entries.slice(1, -1);
    const tone = levelTone(worstLevel(middle));

    return (
      <div className={!isFirst ? "border-t border-t-graphite-700 mt-1 pt-2.5" : ""}>
        <SystemRow entry={head} newGroup={false} />
        {middle.length > 0 && (
          <button
            onClick={onToggle}
            className={`w-full flex items-center gap-2 pl-4 pr-4 py-1.5 border-l-2 ${tone.border} text-[11px] ${tone.text} hover:bg-graphite-850/60 transition-colors`}
          >
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Hide" : "Show"} {middle.length} more line{middle.length === 1 ? "" : "s"}
            {" "}for this request
          </button>
        )}
        {expanded && middle.map((entry) => (
          <SystemRow key={entry.id} entry={entry} newGroup={false} />
        ))}
        <SystemRow entry={tail} newGroup={false} />
      </div>
    );
  },
  (prev, next) =>
    prev.group.key === next.group.key &&
    prev.group.entries.length === next.group.entries.length &&
    prev.isFirst === next.isFirst &&
    prev.expanded === next.expanded
);

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