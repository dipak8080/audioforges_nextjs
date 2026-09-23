"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Coins, Copy, Inbox, Loader2, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PAGE_SIZE } from "./credits-types";
import type { Rec } from "./credits-types";
import { money, num, fullTime, relTime, looksLikeTime, isMoneyKey, isMonoKey, prettyLabel } from "./credits-format";

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

export const STYLES = `
.af-scroll { scrollbar-width: thin; scrollbar-color: rgb(120 113 108 / .45) transparent; }
.af-scroll::-webkit-scrollbar { width: 11px; height: 11px; }
.af-scroll::-webkit-scrollbar-track { background: transparent; }
.af-scroll::-webkit-scrollbar-thumb {
  background: rgb(120 113 108 / .38); border-radius: 99px;
  border: 3px solid transparent; background-clip: content-box;
}
.af-scroll::-webkit-scrollbar-thumb:hover { background: rgb(245 158 11 / .55); background-clip: content-box; }
.af-scroll::-webkit-scrollbar-corner { background: transparent; }
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
/* toasts                                                              */
/* ------------------------------------------------------------------ */

export type Toast = { id: number; tone: "ok" | "warn" | "bad"; text: string };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
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

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-graphite-800 bg-graphite-900/70", className)}>
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium text-text-subtle">{children}</p>
  );
}

export function Stat({
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
        "rounded-2xl border px-3.5 py-3 transition-colors",
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
          "mt-1.5 text-xl font-semibold leading-none tabular-nums",
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

export function Button({
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

export function Select({
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
          "focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20",
          // The native popup list is painted by the OS and ignores every class
          // above it, which is why the open dropdown rendered white against the
          // dark UI. [color-scheme:dark] tells the browser to draw native
          // controls dark (this is the fix that works across Chrome, Edge and
          // Firefox); the [&>option] rules dark-paint the individual rows for
          // the engines that honour them.
          "[color-scheme:dark] [&>option]:bg-graphite-900 [&>option]:text-text-primary"
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-text-subtle" aria-hidden />
    </label>
  );
}

export const inputClass = cn(
  "w-full rounded-lg border border-graphite-700 bg-graphite-850/80 text-sm text-text-primary outline-none transition-colors",
  "placeholder:text-text-subtle hover:border-graphite-600",
  "focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
);

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [hit, setHit] = useState(false);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value);
        setHit(true);
        window.setTimeout(() => setHit(false), 1200);
      }}
      className="rounded p-1 text-text-subtle opacity-0 outline-none transition-opacity hover:text-amber-400 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400/70 group-hover:opacity-100"
    >
      {hit ? <Check className="h-3 w-3 text-teal-400" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
    </button>
  );
}

export function Badge({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "good" | "bad" | "accent" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize",
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



export function Empty({ title, body, icon: Icon = Inbox }: { title: string; body?: string; icon?: typeof Coins }) {
  return (
    <div className="af-rise flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-800 bg-graphite-900/40 px-6 py-12 text-center">
      <Icon className="h-6 w-6 text-text-subtle" aria-hidden />
      <p className="mt-3 text-sm font-medium text-text-muted">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-subtle">{body}</p>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
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

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("af-skel rounded-lg bg-graphite-850/70", className)} />;
}

export function SkeletonPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[80px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

/** The one scroll region on the page. Everything else holds still. */
export function DataScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "af-scroll min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl border border-graphite-800 bg-graphite-900/40",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Th({
  children,
  right,
  sortKey,
  sort,
  onSort,
}: {
  children?: React.ReactNode;
  right?: boolean;
  sortKey?: string;
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (key: string) => void;
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
      className={cn(
        // Sticky against the DataScroll container — which now has a bounded
        // height, so this actually holds while the rows move under it.
        "sticky top-0 z-10 whitespace-nowrap border-b border-graphite-800 bg-graphite-900 px-3 py-2.5 text-[12px] font-medium",
        active ? "text-amber-400" : "text-text-subtle",
        right && "text-right"
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

export function Td({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={cn("px-3 py-2.5 align-top", right && "text-right tabular-nums", className)}>{children}</td>
  );
}

export function Tr({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "group border-b border-graphite-800/60 transition-colors last:border-0 hover:bg-graphite-850/40",
        onClick && "cursor-pointer",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full border-collapse text-left text-sm">{children}</table>;
}


/* ------------------------------------------------------------------ */
/* field rendering — what replaced the JSON dumps                      */
/* ------------------------------------------------------------------ */

/**
 * Renders any response object as labelled fields. Types are inferred from the
 * value and the key: booleans become badges, timestamps become relative times
 * with the exact value on hover, money keys get currency, ids and emails get a
 * copy button. Nested objects become their own sub-section; arrays of objects
 * become a small table. Unknown keys still appear — they just appear as fields,
 * which is the whole point.
 */
export function FieldValue({ name, value }: { name: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-text-subtle">–</span>;
  }
  if (typeof value === "boolean") {
    return <Badge tone={value ? "good" : "muted"}>{value ? "Yes" : "No"}</Badge>;
  }
  if (typeof value === "number") {
    return (
      <span className={cn("font-mono tabular-nums", isMoneyKey(name) ? "text-amber-400" : "text-text-primary")}>
        {isMoneyKey(name) ? money(value) : num(value, 2)}
      </span>
    );
  }
  if (typeof value === "string") {
    if (looksLikeTime(name, value)) {
      return (
        <span className="text-text-primary" title={fullTime(value)}>
          {relTime(value)}
        </span>
      );
    }
    const mono = isMonoKey(name) || value.includes("@");
    return (
      <span className={cn("group inline-flex min-w-0 items-center gap-1", mono && "font-mono text-[12px]")}>
        <span className="truncate text-text-primary" title={value}>
          {value}
        </span>
        {(mono || value.length > 24) && <CopyButton value={value} />}
      </span>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-subtle">None</span>;
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return (
        <span className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <Badge key={i} tone="plain">
              {String(v)}
            </Badge>
          ))}
        </span>
      );
    }
    return <MiniTable rows={value as Rec[]} />;
  }
  return <FieldGrid data={value as Rec} dense />;
}

export function FieldGrid({
  data,
  omit = [],
  dense,
  columns = 2,
}: {
  data: Rec;
  omit?: string[];
  dense?: boolean;
  columns?: 1 | 2 | 3;
}) {
  const entries = Object.entries(data).filter(([k]) => !omit.includes(k));
  if (entries.length === 0) return null;

  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3",
        columns === 3 ? "sm:grid-cols-3" : columns === 2 ? "sm:grid-cols-2" : "",
        dense && "rounded-lg border border-graphite-800 bg-graphite-950/40 p-3"
      )}
    >
      {entries.map(([k, v]) => {
        const wide = typeof v === "object" && v !== null;
        return (
          <div key={k} className={cn("min-w-0", wide && "sm:col-span-full")}>
            <dt className="text-[12px] text-text-subtle">
              {prettyLabel(k)}
            </dt>
            <dd className="mt-1 min-w-0 text-sm">
              <FieldValue name={k} value={v} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Arrays of objects inside a field. Column set is the union of the rows' keys,
 *  so a record with an extra field doesn't silently lose it. */
export function MiniTable({ rows }: { rows: Rec[] }) {
  const cols = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => seen.add(k)));
    return [...seen].slice(0, 6);
  }, [rows]);

  return (
    <div className="af-scroll overflow-x-auto rounded-lg border border-graphite-800">
      <Table>
        <thead>
          <tr>
            {cols.map((c) => (
              <Th key={c}>{prettyLabel(c)}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Tr key={i}>
              {cols.map((c) => (
                <Td key={c} className="max-w-[16rem] truncate">
                  <FieldValue name={c} value={r[c]} />
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* shared data hooks                                                   */
/* ------------------------------------------------------------------ */


export function Pill({
  label,
  value,
  title,
  tone = "plain",
}: {
  label: string;
  value: string;
  title?: string;
  tone?: "plain" | "accent" | "alarm";
}) {
  return (
    <div
      title={title}
      className={cn(
        "flex shrink-0 items-baseline gap-2 rounded-lg border px-2.5 py-1.5",
        tone === "alarm" ? "border-red-500/30 bg-red-500/[0.07]" : "border-graphite-800 bg-graphite-900/60"
      )}
    >
      <span className="whitespace-nowrap text-[12px] text-text-subtle">{label}</span>
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
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


export function Segmented({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { key: string; label: string }[];
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-9 shrink-0 items-center rounded-lg border border-graphite-700 bg-graphite-850/80 p-0.5"
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={cn(
              "h-8 rounded-md px-2.5 text-[12px] font-medium outline-none transition-colors",
              "focus-visible:ring-2 focus-visible:ring-amber-400/70",
              on ? "bg-amber-500/15 text-amber-300" : "text-text-muted hover:text-text-primary"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * "Showing 1–50 of 1,842" rather than leaving the operator to guess whether
 * they are seeing everything. The backend counts against the same WHERE clause
 * as the rows, so the two can never disagree.
 */
export function Pager({
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
    <div className="flex shrink-0 items-center justify-between gap-3 text-[13px]">
      <span className="tabular-nums text-text-subtle">
        {offset + 1}–{offset + count}
        {knownTotal !== undefined ? ` of ${knownTotal.toLocaleString()}` : ""}
      </span>
      <span className="flex gap-2">
        <Button size="sm" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </Button>
        <Button size="sm" disabled={!hasMore} onClick={() => onOffset(offset + PAGE_SIZE)}>
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </span>
    </div>
  );
}