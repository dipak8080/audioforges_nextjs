"use client";

/**
 * app/admin/credits/page.tsx
 *
 * Credits ops console — full rewrite.
 *
 * Structural fixes over the previous version:
 *  - The page no longer fights its parent for height. It scrolls with the
 *    document; only data tables own a scroll region, and those regions have a
 *    visible, styled scrollbar plus a sticky header row.
 *  - Every view has four real states: skeleton, error+retry, empty, data.
 *  - Tables collapse to cards below md instead of overflowing off-screen.
 *  - All fetches are abortable and every action reports through one toast stack.
 *  - Live KPI strip stays pinned so holds/unmatched webhooks are never buried.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coins,
  Copy,
  CreditCard,
  Download,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------------ */
/* types                                                               */
/* ------------------------------------------------------------------ */

type View = "lookup" | "overview" | "costs" | "jobs" | "webhooks";

interface Overview {
  paywall?: {
    enabled?: boolean;
    provider?: string;
    metered_routes?: string[];
    free_monthly_ops?: number;
    free_monthly_ops_per_ip?: number;
  };
  accounts?: number;
  credits_outstanding?: number;
  holds_open?: number;
  jobs_refunded?: number;
  webhooks_unprocessed?: number;
  usage?: { jobs?: number; gpu_seconds?: number; est_cost_usd?: number };
}

interface CostRow {
  day: string;
  tool: string;
  jobs: number;
  completed: number;
  failed: number;
  input_minutes: number;
  gpu_seconds: number;
  est_cost_usd: number;
  paid_jobs: number;
  free_jobs: number;
}

interface JobRow {
  job_id: string;
  tool: string;
  status: string;
  input_seconds: number | null;
  gpu_seconds: number | null;
  est_cost_usd: number | null;
  charge_type: string | null;
  error: string | null;
  created_at: string;
  ended_at: string | null;
  charge_status: string | null;
  refund_reason: string | null;
}

interface Filters {
  tools?: string[];
  statuses?: string[];
  charge_types?: string[];
}

const VIEWS: { id: View; label: string; hint: string; icon: typeof Coins }[] = [
  { id: "lookup", label: "Customer", hint: "Paid and got nothing", icon: Search },
  { id: "overview", label: "Overview", hint: "Liability and paywall state", icon: Wallet },
  { id: "costs", label: "Spend", hint: "Day by tool", icon: Zap },
  { id: "jobs", label: "Jobs", hint: "Cost joined to billing", icon: Clock },
  { id: "webhooks", label: "Webhooks", hint: "Payments with no account", icon: Inbox },
];

const PAGE_SIZE = 50;
const KOFI_PACKS = [10, 30, 100];

/* ------------------------------------------------------------------ */
/* transport + formatting                                              */
/* ------------------------------------------------------------------ */

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON is surfaced raw */
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body as T;
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
const msg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const money = (n: number | null | undefined, dp = 4) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : `$${n.toFixed(dp)}`;

const num = (n: number | null | undefined, dp = 0) =>
  n === null || n === undefined || Number.isNaN(n)
    ? "—"
    : n.toLocaleString(undefined, { maximumFractionDigits: dp });

const fullTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
};

const relTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* one-off styles: scrollbars, entrances, shimmer                      */
/* ------------------------------------------------------------------ */

const STYLES = `
.af-scroll { scrollbar-width: thin; scrollbar-color: rgb(120 113 108 / 0.45) transparent; }
.af-scroll::-webkit-scrollbar { width: 11px; height: 11px; }
.af-scroll::-webkit-scrollbar-track { background: transparent; }
.af-scroll::-webkit-scrollbar-thumb {
  background: rgb(120 113 108 / 0.38);
  border-radius: 99px;
  border: 3px solid transparent;
  background-clip: content-box;
}
.af-scroll::-webkit-scrollbar-thumb:hover { background: rgb(245 158 11 / 0.55); background-clip: content-box; }
.af-scroll::-webkit-scrollbar-corner { background: transparent; }

.af-railless { scrollbar-width: none; -ms-overflow-style: none; }
.af-railless::-webkit-scrollbar { display: none; }

@keyframes af-rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.af-rise { animation: af-rise .26s cubic-bezier(.22,.9,.32,1) both; }

@keyframes af-toast { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
.af-toast { animation: af-toast .2s cubic-bezier(.22,.9,.32,1) both; }

@keyframes af-shimmer { 100% { transform: translateX(100%); } }
.af-skel { position: relative; overflow: hidden; }
.af-skel::after {
  content: ""; position: absolute; inset: 0; transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.05), transparent);
  animation: af-shimmer 1.4s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .af-rise, .af-toast, .af-skel::after { animation: none !important; }
}
`;

/* ------------------------------------------------------------------ */
/* toasts                                                              */
/* ------------------------------------------------------------------ */

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
    <section
      className={cn(
        "rounded-2xl border border-graphite-800 bg-graphite-900/70 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-subtle">{children}</p>
  );
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
  tone?: "plain" | "accent" | "alarm" | "good";
  icon?: typeof Coins;
}) {
  return (
    <div
      className={cn(
        "af-rise rounded-2xl border px-4 py-3.5 transition-colors",
        tone === "alarm"
          ? "border-red-500/30 bg-red-500/[0.06]"
          : "border-graphite-800 bg-graphite-900/70 hover:border-graphite-700"
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-text-subtle" aria-hidden />}
        <SectionLabel>{label}</SectionLabel>
      </div>
      <p
        className={cn(
          "mt-1.5 font-mono text-[1.375rem] font-semibold leading-none tabular-nums",
          tone === "alarm"
            ? "text-red-400"
            : tone === "accent"
              ? "text-amber-400"
              : tone === "good"
                ? "text-teal-400"
                : "text-text-primary"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-text-subtle">{sub}</p>}
    </div>
  );
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

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative inline-flex h-9 items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-lg border border-graphite-700 bg-graphite-850/80 pl-3 pr-8 text-[13px] text-text-muted outline-none transition-colors",
          "hover:border-graphite-600 hover:text-text-primary",
          "focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
        )}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-text-subtle"
        aria-hidden
      />
    </label>
  );
}

const inputClass = cn(
  "w-full rounded-lg border border-graphite-700 bg-graphite-850/80 text-sm text-text-primary outline-none transition-colors",
  "placeholder:text-text-subtle",
  "hover:border-graphite-600",
  "focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
);

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [hit, setHit] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setHit(true);
        window.setTimeout(() => setHit(false), 1200);
      }}
      className="rounded p-1 text-text-subtle opacity-0 outline-none transition-opacity hover:text-amber-400 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400/70 group-hover:opacity-100"
    >
      {hit ? (
        <Check className="h-3 w-3 text-teal-400" aria-hidden />
      ) : (
        <Copy className="h-3 w-3" aria-hidden />
      )}
    </button>
  );
}

function Badge({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "good" | "bad" | "accent" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide",
        tone === "good" && "border-teal-500/30 bg-teal-500/10 text-teal-300",
        tone === "bad" && "border-red-500/30 bg-red-500/10 text-red-300",
        tone === "accent" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
        tone === "muted" && "border-graphite-700 bg-graphite-850 text-text-subtle",
        tone === "plain" && "border-graphite-700 bg-graphite-850 text-text-muted"
      )}
    >
      {children}
    </span>
  );
}

const statusTone = (s: string): "good" | "bad" | "accent" | "muted" =>
  s === "completed" ? "good" : s === "failed" ? "bad" : s === "running" ? "accent" : "muted";

function Empty({ title, body, icon: Icon = Inbox }: { title: string; body?: string; icon?: typeof Coins }) {
  return (
    <div className="af-rise flex flex-col items-center rounded-2xl border border-dashed border-graphite-800 bg-graphite-900/40 px-6 py-14 text-center">
      <Icon className="h-6 w-6 text-text-subtle" aria-hidden />
      <p className="mt-3 text-sm font-medium text-text-muted">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-subtle">{body}</p>}
    </div>
  );
}

function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="af-rise flex flex-wrap items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/[0.07] p-3.5 text-xs leading-relaxed text-red-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
      <span className="min-w-0 flex-1 break-words">{message}</span>
      {onRetry && (
        <Button size="sm" variant="danger" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("af-skel rounded-lg bg-graphite-850/70", className)} />;
}

function SkeletonPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[86px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

/**
 * The table is NOT its own scroll box. A capped, inner-scrolling table means
 * the last rows sit below the fold with no page scrollbar to reach them — the
 * bug this replaced. Rows flow into the document instead, and the header row
 * sticks to the bottom of the page chrome via --af-head.
 *
 * `scrollX` is for tables with server-shaped columns (ledger, webhooks) whose
 * width can't be predicted; it trades the sticky header for horizontal scroll.
 */
function TableShell({ scrollX, children }: { scrollX?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "af-rise af-scroll rounded-2xl border border-graphite-800 bg-graphite-900/50",
        scrollX ? "overflow-x-auto" : "overflow-x-auto lg:overflow-visible"
      )}
    >
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

function Th({
  children,
  right,
  sortKey,
  sort,
  onSort,
  className,
}: {
  children: React.ReactNode;
  right?: boolean;
  sortKey?: string;
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (key: string) => void;
  className?: string;
}) {
  const active = sortKey && sort?.key === sortKey;
  const content = (
    <span className={cn("inline-flex items-center gap-1", right && "flex-row-reverse")}>
      {children}
      {active &&
        (sort?.dir === "asc" ? (
          <ChevronUp className="h-3 w-3 text-amber-400" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3 text-amber-400" aria-hidden />
        ))}
    </span>
  );
  return (
    <th
      scope="col"
      style={{ top: "var(--af-head, 0px)" }}
      className={cn(
        "sticky z-10 whitespace-nowrap border-b border-graphite-800 bg-graphite-900 px-3 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
        active ? "text-amber-400" : "text-text-subtle",
        right && "text-right",
        className
      )}
    >
      {sortKey && onSort ? (
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className="rounded outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  );
}

function Td({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={cn("px-3 py-2.5 align-top", right && "text-right tabular-nums", className)}>
      {children}
    </td>
  );
}

function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="group border-b border-graphite-800/60 transition-colors last:border-0 hover:bg-graphite-850/40">
      {children}
    </tr>
  );
}

/** Signature element: the spend trail. Ops reads shape before it reads numbers. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 260;
  const h = 44;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map<[number, number]>((v, i) => [
    (i / (values.length - 1)) * w,
    h - 4 - ((v - min) / span) * (h - 10),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-11 w-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="af-spend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(245 158 11)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(245 158 11)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#af-spend)" />
      <path
        d={line}
        fill="none"
        stroke="rgb(245 158 11)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill="rgb(245 158 11)" />
    </svg>
  );
}

/** Collapsed escape hatch for response shapes not yet pinned down. */
function Raw({ label, data }: { label: string; data: unknown }) {
  return (
    <details className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900/60">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle outline-none transition-colors hover:text-text-muted focus-visible:ring-2 focus-visible:ring-amber-400/70">
        {label}
      </summary>
      <pre className="af-scroll max-h-96 overflow-auto border-t border-graphite-800 p-4 text-xs leading-relaxed text-text-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/* shared data hooks                                                   */
/* ------------------------------------------------------------------ */

/** Tool/status/charge options come from the server. Never a constant here. */
function useJobFilters() {
  const [filters, setFilters] = useState<Filters>({});
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const d = await api<Filters>("/api/admin/credits?view=filters", { signal: c.signal });
        setFilters(d);
      } catch {
        /* dropdowns fall back to "any" — views still work unfiltered */
      }
    })();
    return () => c.abort();
  }, []);
  return filters;
}

function useOverview(tick: number) {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        setData(await api<Overview>("/api/admin/credits?view=overview", { signal: c.signal }));
      } catch {
        /* the KPI rail degrades to dashes rather than blocking the page */
      }
    })();
    return () => c.abort();
  }, [tick]);
  return data;
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminCreditsPage() {
  const [view, setView] = useState<View>("lookup");
  const [tick, setTick] = useState(0);
  const [auto, setAuto] = useState(false);
  const [headH, setHeadH] = useState(0);
  const headRef = useRef<HTMLElement>(null);
  const { toasts, push, dismiss } = useToasts();
  const overview = useOverview(tick);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, [auto, refresh]);

  // Table headers stick to the bottom edge of this bar, whatever height it
  // wraps to. Hardcoding an offset breaks the moment the KPI rail wraps.
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const measure = () => setHeadH(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keyboard: 1–5 switch views, r refreshes. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= VIEWS.length) setView(VIEWS[n - 1].id);
      if (e.key.toLowerCase() === "r") refresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh]);

  const active = VIEWS.find((v) => v.id === view) ?? VIEWS[0];

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-graphite-950 text-text-primary"
      style={{ "--af-head": `${headH}px` } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <header
        ref={headRef}
        className="sticky top-0 z-30 border-b border-graphite-800 bg-graphite-950/85 backdrop-blur-xl"
      >
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
              <Coins className="h-4 w-4 text-amber-400" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Credits</h1>
              <p className="truncate text-[11px] text-text-subtle">{active.hint}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuto((a) => !a)}
                title="Refresh every 30 seconds"
                className={cn(
                  "hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] outline-none transition-colors sm:inline-flex",
                  "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                  auto
                    ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
                    : "border-graphite-700 bg-graphite-850/80 text-text-muted hover:text-text-primary"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    auto ? "bg-teal-400" : "bg-graphite-600"
                  )}
                />
                Live
              </button>
              <Button size="sm" onClick={refresh} title="Refresh (r)">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Refresh
              </Button>
            </div>
          </div>

          {/* KPI rail — pinned so open holds and unmatched payments are never
              something you have to navigate to in order to see. */}
          <div className="af-railless -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0">
            <Pill label="Outstanding" value={num(overview?.credits_outstanding)} tone="accent" />
            <Pill label="Accounts" value={num(overview?.accounts)} />
            <Pill
              label="Holds open"
              value={num(overview?.holds_open)}
              tone={overview?.holds_open ? "alarm" : "plain"}
            />
            <Pill
              label="Unmatched"
              value={num(overview?.webhooks_unprocessed)}
              tone={overview?.webhooks_unprocessed ? "alarm" : "plain"}
            />
            <Pill label="GPU spend" value={money(overview?.usage?.est_cost_usd, 2)} />
          </div>

          <nav className="af-railless -mx-4 mt-3 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Credits views">
            {VIEWS.map((v) => {
              const on = v.id === view;
              const Icon = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2.5 text-[13px] font-medium outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                    on ? "text-amber-400" : "text-text-muted hover:text-text-primary"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {v.label}
                  <span
                    className={cn(
                      "absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors",
                      on ? "bg-amber-400" : "bg-transparent"
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 sm:pt-6">
        {view === "lookup" ? (
          <LookupPanel onToast={push} onChanged={refresh} />
        ) : view === "overview" ? (
          <OverviewPanel data={overview} tick={tick} onToast={push} onChanged={refresh} />
        ) : (
          <ReadPanel key={view} view={view} tick={tick} />
        )}
      </main>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}

function Pill({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "accent" | "alarm";
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-baseline gap-2 rounded-lg border px-2.5 py-1.5",
        tone === "alarm"
          ? "border-red-500/30 bg-red-500/[0.07]"
          : "border-graphite-800 bg-graphite-900/60"
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-subtle">
        {label}
      </span>
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

/* ------------------------------------------------------------------ */
/* lookup                                                              */
/* ------------------------------------------------------------------ */

function LookupPanel({
  onToast,
  onChanged,
}: {
  onToast: (tone: Toast["tone"], text: string) => void;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setSubject("");
    setError(null);
  }, []);

  // Emptying the field clears the record with it. A stats block left behind
  // from the last search is the one thing on this page that can make you grant
  // credits to the wrong person.
  const onEmailChange = (v: string) => {
    setEmail(v);
    if (!v.trim()) reset();
  };

  const lookup = useCallback(async (address: string) => {
    const trimmed = address.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<Record<string, unknown>>(
        `/api/admin/credits?view=lookup&email=${encodeURIComponent(trimmed)}`
      );
      setResult(data);
      setSubject(trimmed);
      setRecent((r) => [trimmed, ...r.filter((x) => x !== trimmed)].slice(0, 5));
    } catch (err) {
      setError(msg(err, "Lookup failed."));
      setResult(null);
      setSubject("");
    } finally {
      setLoading(false);
    }
  }, []);

  const target = (email.trim() || subject).toLowerCase();
  const stale = Boolean(subject) && Boolean(email.trim()) && email.trim().toLowerCase() !== subject;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(email);
          }}
          className="flex flex-wrap gap-2"
        >
          <div className="relative min-w-0 flex-1 basis-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="Email they paid with"
              autoComplete="off"
              spellCheck={false}
              aria-label="Customer email"
              className={cn(inputClass, "h-11 pl-10 pr-9")}
            />
            {email && (
              <button
                type="button"
                onClick={() => {
                  setEmail("");
                  reset();
                  inputRef.current?.focus();
                }}
                aria-label="Clear email"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-subtle outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <Button type="submit" variant="primary" busy={loading} disabled={!email.trim()}>
            Look up
          </Button>
        </form>

        {recent.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
              Recent
            </span>
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setEmail(r);
                  void lookup(r);
                }}
                className="max-w-[15rem] truncate rounded-md border border-graphite-800 bg-graphite-850/60 px-2 py-0.5 text-[11px] text-text-muted outline-none transition-colors hover:border-amber-500/40 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && <ErrorNote message={error} onRetry={() => void lookup(email)} />}

      {/* Account on the left, the grant panel on the right — and on mobile the
          grant panel sits directly under the balances, above the ledger, so it
          is never something you have to scroll a long table to find. */}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-3">
          {loading && !result ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[86px] rounded-2xl" />
              ))}
            </div>
          ) : result ? (
            <AccountStats
              data={result}
              email={subject}
              stale={stale}
              onClear={() => {
                setEmail("");
                reset();
              }}
            />
          ) : (
            !error && (
              <Empty
                icon={Users}
                title="Search an account to begin"
                body="Enter the email from the Ko-fi order. You can grant credits on the right without searching first — an unknown email creates the account."
              />
            )
          )}
        </div>

        <AdjustForm
          email={target}
          onToast={onToast}
          onApplied={() => {
            void lookup(target);
            onChanged();
          }}
        />
      </div>

      {result && <LedgerSection data={result} />}
    </div>
  );
}

function AccountStats({
  data,
  email,
  stale,
  onClear,
}: {
  data: Record<string, unknown>;
  email: string;
  stale: boolean;
  onClear: () => void;
}) {
  const pickNum = (k: string) => (typeof data[k] === "number" ? (data[k] as number) : undefined);
  const known = [
    { label: "Balance", value: pickNum("balance"), tone: "accent" as const, icon: Coins },
    { label: "Free left", value: pickNum("free_remaining"), tone: "plain" as const, icon: Zap },
    { label: "Held", value: pickNum("held_credits"), tone: "plain" as const, icon: Clock },
  ].filter((s) => s.value !== undefined);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SectionLabel>Showing</SectionLabel>
        <span className="group inline-flex min-w-0 items-center gap-1 font-mono text-xs text-text-muted">
          <span className="truncate">{email}</span>
          <CopyButton value={email} label="Copy email" />
        </span>
        {stale && (
          <Badge tone="accent">Search box changed — press Look up to refresh</Badge>
        )}
        <button
          type="button"
          onClick={onClear}
          className="rounded text-[11px] text-text-subtle underline-offset-2 outline-none hover:text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          Clear
        </button>
      </div>

      {known.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {known.map((s) => (
            <Stat key={s.label} label={s.label} value={num(s.value)} tone={s.tone} icon={s.icon} />
          ))}
        </div>
      ) : (
        <Empty
          icon={Users}
          title="No balance on this record"
          body="The lookup returned no numeric balance for this email. Open the full record below to see what came back."
        />
      )}
    </div>
  );
}

function LedgerSection({ data }: { data: Record<string, unknown> }) {
  const ledger = Array.isArray(data.ledger) ? (data.ledger as Record<string, unknown>[]) : null;
  return (
    <div className="space-y-3">
      {ledger && ledger.length > 0 && <LedgerTable rows={ledger} />}
      <Raw label="Full record" data={data} />
    </div>
  );
}

function LedgerTable({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => seen.add(k)));
    const preferred = ["created_at", "delta", "balance_after", "reason", "note", "source"];
    const ordered = preferred.filter((p) => seen.has(p));
    const rest = [...seen].filter((k) => !ordered.includes(k));
    return [...ordered, ...rest].slice(0, 7);
  }, [rows]);

  const render = (col: string, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (col === "created_at") return relTime(String(v));
    if (col === "delta" && typeof v === "number")
      return (
        <span className={v > 0 ? "text-teal-400" : "text-red-400"}>
          {v > 0 ? "+" : ""}
          {v}
        </span>
      );
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  };

  return (
    <div className="space-y-2">
      <SectionLabel>Ledger — {rows.length} entries</SectionLabel>
      <TableShell scrollX>
        <thead>
          <tr>
            {cols.map((c) => (
              <Th key={c} right={c === "delta" || c === "balance_after"}>
                {c.replace(/_/g, " ")}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Tr key={i}>
              {cols.map((c) => (
                <Td
                  key={c}
                  right={c === "delta" || c === "balance_after"}
                  className={cn(
                    c === "created_at" && "whitespace-nowrap text-text-subtle",
                    (c === "note" || c === "reason") && "max-w-xs truncate text-text-muted"
                  )}
                >
                  {render(c, r[c])}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

/**
 * Always mounted, never behind a search. Granting credits to an email the
 * webhook never matched is the whole reason this screen exists, and that email
 * has no account to look up yet.
 */
function AdjustForm({
  email,
  onApplied,
  onToast,
}: {
  email: string;
  onApplied: () => void;
  onToast: (tone: Toast["tone"], text: string) => void;
}) {
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const parsed = Number(delta);
  const validDelta = Number.isInteger(parsed) && parsed !== 0 && Math.abs(parsed) <= 1000;
  const validNote = note.trim().length >= 3 && note.trim().length <= 200;
  const target = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  const ready = validEmail && validDelta && validNote && !busy;

  useEffect(() => setConfirming(false), [delta, note, email]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ applied?: boolean; balance?: number }>(
        "/api/admin/credits?action=adjust",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: target, delta: parsed, note: note.trim() }),
        }
      );

      // `applied: false` is a safe replay — the idempotency key already existed
      // and nothing was written twice. Reporting both as "done" would let
      // someone click three times and believe they granted 30.
      if (res.applied === false) {
        onToast(
          "warn",
          `Already applied earlier. Nothing written twice. Balance is ${res.balance ?? "?"}.`
        );
      } else {
        onToast(
          "ok",
          `Applied ${parsed > 0 ? "+" : ""}${parsed} to ${target}. Balance is now ${res.balance ?? "?"}.`
        );
      }
      setDelta("");
      setNote("");
      setConfirming(false);
      onApplied();
    } catch (err) {
      const m = msg(err, "Adjustment failed.");
      setError(m);
      onToast("bad", m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-amber-500/25 bg-amber-500/[0.05] p-4">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Grant or remove credits</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Writes an append-only ledger row. A negative delta adds a −N entry rather than undoing
            a grant. An unknown email creates the account — the normal case for a payment the
            webhook never matched.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-graphite-800 bg-graphite-950/50 px-3 py-2">
        <SectionLabel>Applying to</SectionLabel>
        <p
          className={cn(
            "mt-0.5 truncate font-mono text-[12px]",
            validEmail ? "text-amber-300" : "text-text-subtle"
          )}
        >
          {target || "Type an email in the search box above"}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
          Ko-fi packs
        </span>
        {KOFI_PACKS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setDelta(String(p))}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70",
              delta === String(p)
                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                : "border-amber-500/30 bg-amber-500/[0.06] text-amber-300 hover:bg-amber-500/15"
            )}
          >
            +{p}
          </button>
        ))}
      </div>

      <div className="mt-2.5 space-y-2">
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="Delta — e.g. 30"
          aria-label="Credit delta"
          className={cn(inputClass, "h-11 px-3 tabular-nums")}
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Note — e.g. Ko-fi order #1234, webhook never fired"
          aria-label="Adjustment note"
          className={cn(inputClass, "h-11 px-3")}
        />
        {confirming ? (
          <div className="flex gap-2">
            <Button variant="danger" busy={busy} onClick={() => void submit()} className="flex-1">
              Confirm {parsed}
            </Button>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        ) : (
          <Button
            variant="primary"
            disabled={!ready}
            busy={busy}
            className="w-full"
            onClick={() => {
              if (parsed < 0) setConfirming(true);
              else void submit();
            }}
          >
            {parsed > 0 ? `Grant ${parsed} credits` : "Apply"}
          </Button>
        )}
      </div>

      {/* The note is required and deliberately has no default. Six months from
          now an unexplained +30 is indistinguishable from a bug, and the only
          person who can tell is whoever made it today. */}
      <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-text-subtle">
        {!validEmail && <p>Enter the customer email above to enable this.</p>}
        <p className={cn(delta && !validDelta && "text-red-400")}>
          Non-zero integer, −1000 to 1000.
        </p>
        <p className={cn(note && !validNote && "text-red-400")}>
          Note 3–200 characters ({note.trim().length}).
        </p>
        {confirming && <p className="text-red-400">Negative adjustment — confirm to write it.</p>}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewPanel({
  data,
  tick,
  onToast,
  onChanged,
}: {
  data: Overview | null;
  tick: number;
  onToast: (tone: Toast["tone"], text: string) => void;
  onChanged: () => void;
}) {
  const [sweeping, setSweeping] = useState(false);
  const pw = data?.paywall ?? {};

  async function sweep() {
    setSweeping(true);
    try {
      await api("/api/admin/credits?action=sweep", { method: "POST" });
      onToast("ok", "Sweep run. Orphaned holds released.");
      onChanged();
    } catch (err) {
      onToast("bad", msg(err, "Sweep failed."));
    } finally {
      setSweeping(false);
    }
  }

  if (!data) return <SkeletonPanel key={tick} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Outstanding credits are money already taken for work not yet done —
            the closest thing this business has to a balance-sheet liability. */}
        <Stat
          label="Outstanding"
          value={num(data.credits_outstanding)}
          sub="Credits sold, work not yet delivered"
          tone="accent"
          icon={Coins}
        />
        <Stat label="Accounts" value={num(data.accounts)} sub="Emails with a ledger" icon={Users} />
        {/* A hold is a credit taken for a job with no terminal state yet. The
            sweeper releases orphans on a 90-minute cycle; a non-zero count
            that does not clear is the signal to force it. */}
        <Stat
          label="Holds open"
          value={num(data.holds_open)}
          sub="Jobs with no terminal state"
          tone={data.holds_open ? "alarm" : "plain"}
          icon={Clock}
        />
        <Stat
          label="Webhooks unmatched"
          value={num(data.webhooks_unprocessed)}
          sub="Payments that reached no account"
          tone={data.webhooks_unprocessed ? "alarm" : "plain"}
          icon={Inbox}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Jobs (all time)" value={num(data.usage?.jobs)} icon={Zap} />
        <Stat label="GPU seconds" value={num(data.usage?.gpu_seconds, 1)} />
        <Stat label="Est. GPU spend" value={money(data.usage?.est_cost_usd, 2)} tone="accent" />
        <Stat label="Jobs refunded" value={num(data.jobs_refunded)} icon={CreditCard} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <SectionLabel>Paywall</SectionLabel>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Badge tone={pw.enabled ? "good" : "muted"}>{pw.enabled ? "Enabled" : "Disabled"}</Badge>
            {pw.provider && <Badge tone="plain">{pw.provider}</Badge>}
            <span className="text-text-muted">
              {num(pw.free_monthly_ops)} free/month per account · {num(pw.free_monthly_ops_per_ip)}{" "}
              per IP
            </span>
          </p>
          {pw.metered_routes && pw.metered_routes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pw.metered_routes.map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-2 py-0.5 font-mono text-[10px] text-amber-400"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col justify-between gap-3 p-4">
          <div>
            <SectionLabel>Hold sweep</SectionLabel>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              Releases credits held by jobs that never reported a terminal state. Runs on its own
              every 90 minutes — this button is for when someone is waiting.
            </p>
          </div>
          <div>
            <Button variant={data.holds_open ? "primary" : "ghost"} busy={sweeping} onClick={() => void sweep()}>
              Release orphaned holds
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* costs / jobs / webhooks                                             */
/* ------------------------------------------------------------------ */

function ReadPanel({ view, tick }: { view: View; tick: number }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState("30");
  const [tool, setTool] = useState("");
  const [status, setStatus] = useState("");
  const [chargeType, setChargeType] = useState("");
  const [email, setEmail] = useState("");
  const [emailApplied, setEmailApplied] = useState("");
  const [offset, setOffset] = useState(0);
  const filters = useJobFilters();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ view });
        if (view === "webhooks") params.set("unprocessed_only", "true");
        if (view === "costs") {
          params.set("days", days);
          if (tool) params.set("tool", tool);
        }
        if (view === "jobs") {
          params.set("limit", String(PAGE_SIZE));
          params.set("offset", String(offset));
          params.set("days", days);
          if (tool) params.set("tool", tool);
          if (status) params.set("status", status);
          if (chargeType) params.set("charge_type", chargeType);
          if (emailApplied) params.set("email", emailApplied);
        }
        const next = await api(`/api/admin/credits?${params.toString()}`, { signal });
        setData(next);
      } catch (err) {
        if (isAbort(err) || signal?.aborted) return;
        setError(msg(err, "Request failed."));
        setData(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [view, days, tool, status, chargeType, emailApplied, offset]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, tick]);

  // Narrowing a filter must reset the page. Dropping 90 days to 1 while on
  // page 3 would request offset=100 against maybe five rows: an empty table
  // under a pager reading "Showing 101–101 of 5", which reads as a broken
  // endpoint rather than a filter that moved.
  const setFilter = (fn: (v: string) => void) => (v: string) => {
    fn(v);
    setOffset(0);
  };

  const activeChips = [
    tool && { label: `Tool: ${tool}`, clear: () => setFilter(setTool)("") },
    status && { label: `Status: ${status}`, clear: () => setFilter(setStatus)("") },
    chargeType && { label: `Charge: ${chargeType}`, clear: () => setFilter(setChargeType)("") },
    emailApplied && {
      label: emailApplied,
      clear: () => {
        setEmail("");
        setEmailApplied("");
        setOffset(0);
      },
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const jobRows = ((data as { jobs?: JobRow[] } | null)?.jobs ?? []) as JobRow[];
  const costRows = ((data as { daily?: CostRow[] } | null)?.daily ?? []) as CostRow[];

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select label="Window" value={days} onChange={setFilter(setDays)}>
            {["1", "7", "30", "90", "365"].map((d) => (
              <option key={d} value={d}>
                Last {d} {d === "1" ? "day" : "days"}
              </option>
            ))}
          </Select>

          <Select label="Tool" value={tool} onChange={setFilter(setTool)}>
            <option value="">Any tool</option>
            {(filters.tools ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          {view === "jobs" && (
            <>
              <Select label="Status" value={status} onChange={setFilter(setStatus)}>
                <option value="">Any status</option>
                {(filters.statuses ?? []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Select label="Charge" value={chargeType} onChange={setFilter(setChargeType)}>
                <option value="">Any charge</option>
                {(filters.charge_types ?? []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>

              {/* The support query. /users/lookup returns a customer's charges
                  but not their GPU cost or failure reason, so "they say it
                  failed twice, what happened?" took two endpoints and a join. */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setOffset(0);
                  setEmailApplied(email.trim().toLowerCase());
                }}
                className="flex min-w-0 flex-1 gap-2"
              >
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
                    aria-hidden
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Filter by email"
                    aria-label="Filter jobs by email"
                    className={cn(inputClass, "h-9 pl-8 pr-3 text-[13px]")}
                  />
                </div>
              </form>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {view === "costs" && costRows.length > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  downloadCsv(`credits-spend-${days}d.csv`, costRows as unknown as Record<string, unknown>[])
                }
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </Button>
            )}
            {view === "jobs" && jobRows.length > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  downloadCsv(`credits-jobs-${days}d.csv`, jobRows as unknown as Record<string, unknown>[])
                }
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </Button>
            )}
            <Button size="sm" busy={loading} onClick={() => void load()}>
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
              Reload
            </Button>
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-graphite-800 pt-2.5">
            {activeChips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.clear}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-2 py-0.5 text-[11px] text-amber-300 outline-none transition-colors hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                {c.label}
                <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && <ErrorNote message={error} onRetry={() => void load()} />}
      {loading && !data && <SkeletonPanel />}

      {data !== null && view === "costs" && <CostsPanel rows={costRows} />}

      {data !== null && view === "jobs" && (
        <>
          <JobsPanel rows={jobRows} />
          <Pager
            offset={offset}
            count={jobRows.length}
            total={(data as { total?: number }).total}
            onOffset={setOffset}
          />
        </>
      )}

      {data !== null && view === "webhooks" && (
        <WebhooksPanel rows={((data as { webhooks?: unknown[] }).webhooks ?? []) as unknown[]} />
      )}
    </div>
  );
}

type CostSortKey = "day" | "tool" | "jobs" | "failed" | "paid_jobs" | "gpu_seconds" | "est_cost_usd";

function CostsPanel({ rows }: { rows: CostRow[] }) {
  const [sort, setSort] = useState<{ key: CostSortKey; dir: "asc" | "desc" }>({
    key: "day",
    dir: "desc",
  });

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          jobs: a.jobs + (r.jobs ?? 0),
          failed: a.failed + (r.failed ?? 0),
          cost: a.cost + (r.est_cost_usd ?? 0),
          paid: a.paid + (r.paid_jobs ?? 0),
        }),
        { jobs: 0, failed: 0, cost: 0, paid: 0 }
      ),
    [rows]
  );

  const trail = useMemo(() => {
    const byDay = new Map<string, number>();
    rows.forEach((r) => byDay.set(r.day, (byDay.get(r.day) ?? 0) + (r.est_cost_usd ?? 0)));
    return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [rows]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }, [rows, sort]);

  const onSort = (key: string) =>
    setSort((s) =>
      s.key === key
        ? { key: s.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: key as CostSortKey, dir: "desc" }
    );

  if (rows.length === 0)
    return (
      <Empty
        icon={Zap}
        title="No jobs in this window"
        body="Widen the window or clear the tool filter."
      />
    );

  const failRate = totals.jobs > 0 ? totals.failed / totals.jobs : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Jobs" value={num(totals.jobs)} />
        <Stat
          label="Failed"
          value={`${num(totals.failed)}${totals.jobs ? ` · ${Math.round(failRate * 100)}%` : ""}`}
          tone={failRate >= 0.1 ? "alarm" : "plain"}
        />
        <Stat label="Paid jobs" value={num(totals.paid)} sub="Charged a credit" />
        <Stat label="Est. spend" value={money(totals.cost, 2)} tone="accent" />
      </div>

      {trail.length > 1 && (
        <Card className="px-4 pb-2 pt-3">
          <div className="flex items-baseline justify-between">
            <SectionLabel>Daily spend</SectionLabel>
            <span className="font-mono text-[11px] text-text-subtle">
              peak {money(Math.max(...trail), 2)}
            </span>
          </div>
          <Sparkline values={trail} />
        </Card>
      )}

      {/* mobile */}
      <div className="space-y-2 md:hidden">
        {sorted.map((r, i) => {
          const bad = r.jobs > 0 && r.failed / r.jobs >= 0.25;
          return (
            <Card key={`${r.day}-${r.tool}-${i}`} className="af-rise p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-text-primary">{r.tool}</span>
                <span className="font-mono text-[11px] text-text-subtle">{r.day}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <Cell label="Jobs" value={num(r.jobs)} />
                <Cell
                  label="Failed"
                  value={`${num(r.failed)}${bad ? ` (${Math.round((r.failed / r.jobs) * 100)}%)` : ""}`}
                  tone={bad ? "bad" : undefined}
                />
                <Cell label="Cost" value={money(r.est_cost_usd)} tone="accent" />
                <Cell label="Paid" value={num(r.paid_jobs)} />
                <Cell label="Free" value={num(r.free_jobs)} />
                <Cell label="GPU s" value={num(r.gpu_seconds, 1)} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* desktop */}
      <div className="hidden md:block">
        <TableShell>
          <thead>
            <tr>
              <Th sortKey="day" sort={sort} onSort={onSort}>Day</Th>
              <Th sortKey="tool" sort={sort} onSort={onSort}>Tool</Th>
              <Th right sortKey="jobs" sort={sort} onSort={onSort}>Jobs</Th>
              <Th right sortKey="failed" sort={sort} onSort={onSort}>Failed</Th>
              <Th right sortKey="paid_jobs" sort={sort} onSort={onSort}>Paid</Th>
              <Th right>Free</Th>
              <Th right>Min</Th>
              <Th right sortKey="gpu_seconds" sort={sort} onSort={onSort}>GPU s</Th>
              <Th right sortKey="est_cost_usd" sort={sort} onSort={onSort}>Cost</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              // A failure rate this page must not let you scroll past.
              const rate = r.jobs > 0 ? r.failed / r.jobs : 0;
              const bad = rate >= 0.25;
              return (
                <Tr key={`${r.day}-${r.tool}-${i}`}>
                  <Td className="whitespace-nowrap text-text-muted">{r.day}</Td>
                  <Td className="font-mono text-[11px]">{r.tool}</Td>
                  <Td right>{num(r.jobs)}</Td>
                  <Td right className={bad ? "font-semibold text-red-400" : "text-text-muted"}>
                    {num(r.failed)}
                    {bad && (
                      <span className="ml-1 text-[11px] font-normal">
                        {Math.round(rate * 100)}%
                      </span>
                    )}
                  </Td>
                  <Td right>{num(r.paid_jobs)}</Td>
                  <Td right className="text-text-subtle">{num(r.free_jobs)}</Td>
                  <Td right className="text-text-subtle">{num(r.input_minutes, 1)}</Td>
                  <Td right className="text-text-subtle">{num(r.gpu_seconds, 1)}</Td>
                  <Td right className="text-amber-400">{money(r.est_cost_usd)}</Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad" | "accent";
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-subtle">{label}</p>
      <p
        className={cn(
          "font-mono text-[13px] tabular-nums",
          tone === "bad" ? "text-red-400" : tone === "accent" ? "text-amber-400" : "text-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function JobsPanel({ rows }: { rows: JobRow[] }) {
  if (rows.length === 0)
    return (
      <Empty
        icon={Clock}
        title="No jobs match these filters"
        body="Clear a filter chip above, or widen the window."
      />
    );

  return (
    <>
      {/* mobile */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <Card key={r.job_id} className="af-rise p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-[12px] text-text-primary">{r.tool}</p>
                <p className="mt-0.5 text-[11px] text-text-subtle" title={fullTime(r.created_at)}>
                  {relTime(r.created_at)}
                </p>
              </div>
              <Badge tone={statusTone(r.status)}>{r.status}</Badge>
            </div>
            {r.error && (
              <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] p-2 text-[11px] leading-relaxed text-red-200">
                {r.error}
              </p>
            )}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Cell label="Charge" value={r.charge_type ?? "—"} tone={r.charge_type === "credit" ? "accent" : undefined} />
              <Cell label="GPU s" value={num(r.gpu_seconds, 1)} />
              <Cell label="Cost" value={money(r.est_cost_usd)} tone="accent" />
            </div>
          </Card>
        ))}
      </div>

      {/* desktop */}
      <div className="hidden md:block">
        <TableShell>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Tool</Th>
              <Th>Status</Th>
              <Th>Charge</Th>
              <Th right>Input s</Th>
              <Th right>GPU s</Th>
              <Th right>Cost</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.job_id}>
                <Td className="whitespace-nowrap text-text-subtle">
                  <span title={fullTime(r.created_at)}>{relTime(r.created_at)}</span>
                </Td>
                <Td className="font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1">
                    {r.tool}
                    <CopyButton value={r.job_id} label="Copy job id" />
                  </span>
                </Td>
                <Td>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {/* The server writes these for a human. Truncated on the row,
                      full text on hover — why a job failed is the whole point. */}
                  {r.error && (
                    <span
                      title={r.error}
                      className="mt-1 block max-w-md truncate text-[11px] text-text-subtle"
                    >
                      {r.error}
                    </span>
                  )}
                </Td>
                <Td>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      r.charge_type === "credit" ? "text-amber-400" : "text-text-subtle"
                    )}
                  >
                    {r.charge_type ?? "—"}
                  </span>
                  {r.charge_status && r.charge_status !== "settled" && (
                    <span className="ml-1.5 font-mono text-[10px] text-text-subtle">
                      {r.charge_status}
                    </span>
                  )}
                  {r.refund_reason && (
                    <span
                      title={r.refund_reason}
                      className="mt-0.5 block max-w-[14rem] truncate text-[10px] text-text-subtle"
                    >
                      refund: {r.refund_reason}
                    </span>
                  )}
                </Td>
                <Td right className="text-text-subtle">{num(r.input_seconds, 1)}</Td>
                <Td right className="text-text-subtle">{num(r.gpu_seconds, 1)}</Td>
                <Td right className="text-amber-400">{money(r.est_cost_usd)}</Td>
              </Tr>
            ))}
          </tbody>
        </TableShell>
      </div>
    </>
  );
}

function WebhooksPanel({ rows }: { rows: unknown[] }) {
  if (rows.length === 0) {
    return (
      <Empty
        icon={ShieldCheck}
        title="Every payment reached an account"
        body="Nothing to chase. Unmatched Ko-fi payments show here with the email they were paid with."
      />
    );
  }

  const objs = rows.filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null);
  if (objs.length !== rows.length) return <Raw label="Unmatched webhooks" data={rows} />;

  const cols = (() => {
    const seen = new Set<string>();
    objs.forEach((r) => Object.keys(r).forEach((k) => seen.add(k)));
    const preferred = ["created_at", "email", "amount", "tier_name", "message_id", "processed"];
    const ordered = preferred.filter((p) => seen.has(p));
    return [...ordered, ...[...seen].filter((k) => !ordered.includes(k))].slice(0, 7);
  })();

  return (
    <div className="space-y-3">
      <ErrorNote
        message={`${objs.length} payment${objs.length === 1 ? "" : "s"} never matched an account. Copy the email, then grant the credits by hand from the Customer tab.`}
      />
      <TableShell scrollX>
        <thead>
          <tr>
            {cols.map((c) => (
              <Th key={c}>{c.replace(/_/g, " ")}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {objs.map((r, i) => (
            <Tr key={i}>
              {cols.map((c) => {
                const v = r[c];
                const text =
                  v === null || v === undefined || v === ""
                    ? "—"
                    : typeof v === "object"
                      ? JSON.stringify(v)
                      : String(v);
                return (
                  <Td
                    key={c}
                    className={cn(
                      "max-w-xs truncate",
                      c === "email" ? "font-mono text-[11px] text-amber-300" : "text-text-muted"
                    )}
                  >
                    <span className="inline-flex items-center gap-1" title={text}>
                      {c === "created_at" ? relTime(String(v)) : text}
                      {c === "email" && text !== "—" && <CopyButton value={text} label="Copy email" />}
                    </span>
                  </Td>
                );
              })}
            </Tr>
          ))}
        </tbody>
      </TableShell>
      <Raw label="Raw payloads" data={rows} />
    </div>
  );
}

/**
 * "Showing 1–50 of 1,842" rather than leaving the operator to guess whether
 * they are seeing everything. The backend counts against the same WHERE clause
 * as the rows, so the two can never disagree.
 */
function Pager({
  offset,
  count,
  total,
  onOffset,
}: {
  offset: number;
  count: number;
  total?: number;
  onOffset: (next: number) => void;
}) {
  const knownTotal = typeof total === "number" ? total : undefined;
  const hasMore = knownTotal !== undefined ? offset + count < knownTotal : count === PAGE_SIZE;
  if (offset === 0 && !hasMore) return null;

  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="tabular-nums text-text-subtle">
        {offset + 1}–{offset + count}
        {knownTotal !== undefined ? ` of ${knownTotal.toLocaleString()}` : ""}
      </span>
      <span className="flex gap-2">
        <Button
          size="sm"
          disabled={offset === 0}
          onClick={() => {
            onOffset(Math.max(0, offset - PAGE_SIZE));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </Button>
        <Button
          size="sm"
          disabled={!hasMore}
          onClick={() => {
            onOffset(offset + PAGE_SIZE);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </span>
    </div>
  );
}