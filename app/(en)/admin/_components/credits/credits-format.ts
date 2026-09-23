import type { Rec } from "./credits-types";

export const money = (n: number | null | undefined, dp = 4) =>
  n === null || n === undefined || Number.isNaN(n) ? "–" : `$${n.toFixed(dp)}`;

export const num = (n: number | null | undefined, dp = 0) =>
  n === null || n === undefined || Number.isNaN(n)
    ? "–"
    : n.toLocaleString(undefined, { maximumFractionDigits: dp });

export const fullTime = (iso: string | null) => {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "–"
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
};

export const relTime = (iso: string | null) => {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const ISO_LIKE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/;
// A value is a timestamp if it parses like one. The key name is a hint, not a
// requirement — servers name these inconsistently.
export const looksLikeTime = (k: string, v: string) =>
  ISO_LIKE.test(v) || /(_at|_on|timestamp)$/i.test(k);
export const isMoneyKey = (k: string) => /(usd|cost|amount|price|total_paid)/i.test(k);
export const isMonoKey = (k: string) => /(id|email|hash|key|token|tool|status|reason|tier|ip)$/i.test(k);

export const prettyLabel = (k: string) =>
  k.replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function toCsv(rows: Rec[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadCsv(name: string, rows: Rec[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  // Revoked on a later tick: doing it synchronously after click() aborts
  // the download in Firefox and older Safari.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}

export const statusTone = (s: string): "good" | "bad" | "accent" | "muted" =>
  s === "completed" ? "good" : s === "failed" ? "bad" : s === "running" ? "accent" : "muted";

// A job the input decided (too long, no notes, removed video) reads as
// "rejected", not "failed": only our own failures get red.
export const isRejected = (r: { failure_side?: string | null }) => r.failure_side === "client";
export const jobStatus = (r: { status: string; failure_side?: string | null }) =>
  isRejected(r) ? "rejected" : r.status;