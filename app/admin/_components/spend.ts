export interface CostRow {
  day: string;
  tool: string;
  jobs: number;
  completed: number;
  failed: number;
  rejected?: number;
  input_minutes: number;
  gpu_seconds: number;
  est_cost_usd: number;
  paid_jobs: number;
  free_jobs: number;
}

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "90d";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
];

const utcDay = (offset: number) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

export function rangeDates(key: RangeKey): { from: string; to: string } {
  switch (key) {
    case "today":
      return { from: utcDay(0), to: utcDay(0) };
    case "yesterday":
      return { from: utcDay(1), to: utcDay(1) };
    case "7d":
      return { from: utcDay(6), to: utcDay(0) };
    case "90d":
      return { from: utcDay(89), to: utcDay(0) };
    default:
      return { from: utcDay(29), to: utcDay(0) };
  }
}

export function rangePhrase(key: RangeKey): string {
  switch (key) {
    case "today":
      return "today";
    case "yesterday":
      return "yesterday";
    case "7d":
      return "in the last 7 days";
    case "90d":
      return "in the last 90 days";
    default:
      return "in the last 30 days";
  }
}

const TOOL_LABELS: Record<string, string> = {
  separate: "Vocal remover",
  "separate-hq": "Vocal remover (Studio)",
  stems: "Stem splitter",
  "stems-hq": "Stem splitter (Studio)",
  "youtube/separate": "YouTube vocal remover",
  "youtube/separate-hq": "YouTube vocal remover (Studio)",
  "youtube/stems": "YouTube stem splitter",
  "youtube/stems-hq": "YouTube stem splitter (Studio)",
  transcribe: "Transcription",
  "audio-to-midi-hq": "Audio to MIDI (HQ)",
  "audio-to-midi-hq-mix": "Audio to MIDI (full mix)",
  "audio-to-sheet": "Sheet music",
};

export function toolLabel(tool: string): string {
  if (TOOL_LABELS[tool]) return TOOL_LABELS[tool];
  const plain = tool.replace(/[-_/]+/g, " ").trim();
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

export const SERIES_COLORS = [
  "#e8a23d",
  "#3fc8a8",
  "#8e94f2",
  "#5fb3e8",
  "#d98bb4",
  "#b5c75a",
  "#e0876a",
  "#6fd0c9",
  "#c7a4ef",
  "#d6c08f",
];
export const OTHER_COLOR = "#5a5a63";
export const OTHER_KEY = "__other";
const MAX_SERIES = 5;

export interface ToolAgg {
  tool: string;
  label: string;
  color: string;
  jobs: number;
  completed: number;
  failed: number;
  rejected: number;
  paid: number;
  gpu_seconds: number;
  cost: number;
}

export interface DayPoint {
  day: string;
  cost: number;
  jobs: number;
  failed: number;
  byTool: Record<string, { cost: number; jobs: number }>;
}

export interface SpendModel {
  tools: ToolAgg[];
  series: { key: string; label: string; color: string }[];
  days: DayPoint[];
  totals: { cost: number; jobs: number; failed: number; rejected: number; paid: number; gpu_seconds: number; completed: number };
  activeDays: number;
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return out;
  for (let t = start; t <= end && out.length < 400; t += 864e5) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function buildSpendModel(rows: CostRow[], from: string, to: string): SpendModel {
  const byTool = new Map<string, Omit<ToolAgg, "color" | "label">>();
  for (const r of rows) {
    const t = byTool.get(r.tool) ?? {
      tool: r.tool,
      jobs: 0,
      completed: 0,
      failed: 0,
      rejected: 0,
      paid: 0,
      gpu_seconds: 0,
      cost: 0,
    };
    t.jobs += r.jobs ?? 0;
    t.completed += r.completed ?? 0;
    t.failed += r.failed ?? 0;
    t.rejected += r.rejected ?? 0;
    t.paid += r.paid_jobs ?? 0;
    t.gpu_seconds += r.gpu_seconds ?? 0;
    t.cost += r.est_cost_usd ?? 0;
    byTool.set(r.tool, t);
  }

  const ranked = [...byTool.values()].sort((a, b) => b.cost - a.cost || b.jobs - a.jobs);
  const needsOther = ranked.length > MAX_SERIES;
  const namedCount = needsOther ? MAX_SERIES - 1 : ranked.length;

  const tools: ToolAgg[] = ranked.map((t, i) => ({
    ...t,
    label: toolLabel(t.tool),
    color: SERIES_COLORS[i] ?? OTHER_COLOR,
  }));

  const seriesKeyOf = new Map<string, string>();
  tools.forEach((t, i) => seriesKeyOf.set(t.tool, i < namedCount ? t.tool : OTHER_KEY));

  const series = tools.slice(0, namedCount).map((t) => ({ key: t.tool, label: t.label, color: t.color }));
  if (needsOther) series.push({ key: OTHER_KEY, label: "Other tools", color: OTHER_COLOR });

  const dayMap = new Map<string, DayPoint>();
  const allDays = eachDay(from, to);
  const blank = (day: string): DayPoint => ({ day, cost: 0, jobs: 0, failed: 0, byTool: {} });
  allDays.forEach((d) => dayMap.set(d, blank(d)));

  for (const r of rows) {
    const p = dayMap.get(r.day) ?? blank(r.day);
    const key = seriesKeyOf.get(r.tool) ?? OTHER_KEY;
    const slot = p.byTool[key] ?? { cost: 0, jobs: 0 };
    slot.cost += r.est_cost_usd ?? 0;
    slot.jobs += r.jobs ?? 0;
    p.byTool[key] = slot;
    p.cost += r.est_cost_usd ?? 0;
    p.jobs += r.jobs ?? 0;
    p.failed += r.failed ?? 0;
    dayMap.set(r.day, p);
  }

  const days = [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day));

  const totals = tools.reduce(
    (a, t) => ({
      cost: a.cost + t.cost,
      jobs: a.jobs + t.jobs,
      failed: a.failed + t.failed,
      rejected: a.rejected + t.rejected,
      paid: a.paid + t.paid,
      gpu_seconds: a.gpu_seconds + t.gpu_seconds,
      completed: a.completed + t.completed,
    }),
    { cost: 0, jobs: 0, failed: 0, rejected: 0, paid: 0, gpu_seconds: 0, completed: 0 }
  );

  return { tools, series, days, totals, activeDays: Math.max(allDays.length, 1) };
}

export const usd = (n: number | null | undefined, dp = 2) => {
  if (n === null || n === undefined || Number.isNaN(n)) return "–";
  if (n > 0 && n < 0.01 && dp <= 2) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(dp)}`;
};

export const count = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? "–" : Math.round(n).toLocaleString();

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "–";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function dayLabel(day: string, style: "short" | "long" = "short"): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(style === "long" ? { weekday: "short" } : {}),
  });
}