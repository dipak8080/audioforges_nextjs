"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  count,
  dayLabel,
  duration,
  pct,
  rangePhrase,
  usd,
  OTHER_KEY,
  type DayPoint,
  type RangeKey,
  type SpendModel,
  type ToolAgg,
} from "./spend";

export type Metric = "cost" | "jobs";
export type ChartMode = "total" | "tools";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { top: ticks, step: 1 };
  const raw = max / ticks;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return { top: step * Math.ceil(max / step), step };
}

function monotonePath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const s = 3 / Math.sqrt(h);
      t[i] = s * a * m[i];
      t[i + 1] = s * b * m[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

const fmtAxis = (v: number, metric: Metric) =>
  metric === "jobs" ? Math.round(v).toLocaleString() : v === 0 ? "$0" : v < 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(v < 10 ? 1 : 0)}`;

const fmtValue = (v: number, metric: Metric) => (metric === "jobs" ? count(v) : usd(v));

export function TrendChart({
  model,
  metric,
  mode,
  height = 240,
}: {
  model: SpendModel;
  metric: Metric;
  mode: ChartMode;
  height?: number;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const gradId = useId().replace(/:/g, "");

  const { days, series } = model;
  const n = days.length;
  const value = (d: DayPoint) => (metric === "jobs" ? d.jobs : d.cost);

  const pad = { top: 14, right: 10, bottom: 26, left: metric === "jobs" ? 38 : 46 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;

  const max = Math.max(0, ...days.map(value));
  const { top, step } = niceScale(max);
  const y = (v: number) => pad.top + innerH - (v / top) * innerH;

  const bars = mode === "tools" || n <= 2;
  const slot = n > 0 ? innerW / (bars ? n : Math.max(n - 1, 1)) : 0;
  const xOf = (i: number) => pad.left + (bars ? slot * (i + 0.5) : slot * i);

  const avg = n > 0 ? days.reduce((a, d) => a + value(d), 0) / n : 0;

  const linePts = useMemo<[number, number][]>(
    () => days.map((d, i) => [xOf(i), y(value(d))]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [days, width, metric, top, bars]
  );
  const line = bars ? "" : monotonePath(linePts);
  const area =
    bars || linePts.length === 0
      ? ""
      : `${line}L${linePts[linePts.length - 1][0]},${pad.top + innerH}L${linePts[0][0]},${pad.top + innerH}Z`;

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 74))));
  const xLabels = days
    .map((d, i) => ({ i, d }))
    .filter(({ i }) => i % labelEvery === 0 || i === n - 1)
    .filter(({ i }, k, arr) => i !== n - 1 || k === 0 || n - 1 - arr[k - 1].i >= labelEvery * 0.6);

  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  const pick = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left - pad.left;
    const i = bars ? Math.floor(x / slot) : Math.round(x / slot);
    setIdx(Math.min(n - 1, Math.max(0, i)));
  };

  const hovered = idx !== null ? days[idx] : null;
  const barW = Math.max(2, Math.min(28, slot * 0.64));
  const tipW = Math.min(248, Math.max(0, width - 8));
  const anchor = idx !== null ? xOf(idx) : 0;
  const tipX = Math.min(
    Math.max(4, anchor + 12 + tipW > width ? anchor - 12 - tipW : anchor + 12),
    Math.max(4, width - tipW - 4)
  );

  const summary = `${metric === "jobs" ? "Jobs" : "Spend"} per day from ${dayLabel(days[0]?.day ?? "")} to ${dayLabel(
    days[n - 1]?.day ?? ""
  )}. Peak ${fmtValue(max, metric)}, average ${fmtValue(avg, metric)}.`;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={summary}
          tabIndex={0}
          className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setIdx(null)}
          onFocus={() => setIdx((i) => i ?? n - 1)}
          onBlur={() => setIdx(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, (i ?? n) - 1));
            else if (e.key === "ArrowRight") setIdx((i) => Math.min(n - 1, (i ?? -1) + 1));
            else if (e.key === "Home") setIdx(0);
            else if (e.key === "End") setIdx(n - 1);
            else if (e.key === "Escape") setIdx(null);
            else return;
            e.preventDefault();
          }}
        >
          <defs>
            <linearGradient id={`fill-${gradId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e8a23d" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#e8a23d" stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(t)}
                y2={y(t)}
                stroke="#232326"
                strokeDasharray={t === 0 ? undefined : "2 4"}
              />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="#8f8a80">
                {fmtAxis(t, metric)}
              </text>
            </g>
          ))}

          {xLabels.map(({ i, d }) => (
            <text
              key={d.day}
              x={xOf(i)}
              y={height - 8}
              textAnchor={i === 0 && !bars ? "start" : i === n - 1 && !bars ? "end" : "middle"}
              fontSize="11"
              fill="#8f8a80"
            >
              {dayLabel(d.day)}
            </text>
          ))}

          {bars ? (
            days.map((d, i) => {
              const dim = idx !== null && idx !== i;
              if (mode === "total" || series.length === 0) {
                const v = value(d);
                const h = Math.max(v > 0 ? 2 : 0, pad.top + innerH - y(v));
                return (
                  <rect
                    key={d.day}
                    x={xOf(i) - barW / 2}
                    y={pad.top + innerH - h}
                    width={barW}
                    height={h}
                    rx={Math.min(3, barW / 3)}
                    fill="#e8a23d"
                    opacity={dim ? 0.35 : 0.9}
                  />
                );
              }
              let acc = 0;
              return (
                <g key={d.day} opacity={dim ? 0.35 : 1}>
                  {series.map((s) => {
                    const v = metric === "jobs" ? d.byTool[s.key]?.jobs ?? 0 : d.byTool[s.key]?.cost ?? 0;
                    if (v <= 0) return null;
                    const y0 = y(acc);
                    acc += v;
                    const y1 = y(acc);
                    const h = Math.max(1.5, y0 - y1 - 1);
                    return (
                      <rect
                        key={s.key}
                        x={xOf(i) - barW / 2}
                        y={y0 - h}
                        width={barW}
                        height={h}
                        rx={Math.min(2, barW / 4)}
                        fill={s.color}
                      />
                    );
                  })}
                </g>
              );
            })
          ) : (
            <>
              <path d={area} fill={`url(#fill-${gradId})`} />
              <path d={line} fill="none" stroke="#e8a23d" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}

          {avg > 0 && (
            <g>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(avg)}
                y2={y(avg)}
                stroke="#f2f1ee"
                strokeOpacity="0.35"
                strokeDasharray="4 4"
              />
              <text
                x={width - pad.right}
                y={y(avg) - 6}
                textAnchor="end"
                fontSize="11"
                fill="#cdc9c1"
                style={{ paintOrder: "stroke", stroke: "#17171a", strokeWidth: 4 }}
              >
                avg {fmtValue(avg, metric)}/day
              </text>
            </g>
          )}

          {idx !== null && (
            <g pointerEvents="none">
              <line
                x1={xOf(idx)}
                x2={xOf(idx)}
                y1={pad.top - 4}
                y2={pad.top + innerH}
                stroke="#f0b862"
                strokeOpacity="0.7"
              />
              <path
                d={`M${xOf(idx) - 5},${pad.top - 10}h10l-5,6z`}
                fill="#f0b862"
              />
              {!bars && hovered && (
                <circle cx={xOf(idx)} cy={y(value(hovered))} r="4.5" fill="#17171a" stroke="#f0b862" strokeWidth="2" />
              )}
            </g>
          )}

          <rect x={pad.left} y={0} width={innerW} height={height} fill="transparent" />
        </svg>
      )}

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-graphite-700 bg-graphite-950/95 p-3 text-[12px] shadow-2xl shadow-black/50 backdrop-blur"
          style={{ left: tipX, width: tipW }}
        >
          <p className="text-text-subtle">{dayLabel(hovered.day, "long")}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">
            {fmtValue(value(hovered), metric)}
          </p>
          <p className="text-text-muted">
            {metric === "jobs" ? usd(hovered.cost) : `${count(hovered.jobs)} jobs`}
            {hovered.failed > 0 && <span className="text-red-400">, {count(hovered.failed)} failed</span>}
          </p>
          {series.length > 0 && hovered.jobs > 0 && (
            <ul className="mt-2 space-y-1 border-t border-graphite-800 pt-2">
              {series
                .map((s) => ({ ...s, v: metric === "jobs" ? hovered.byTool[s.key]?.jobs ?? 0 : hovered.byTool[s.key]?.cost ?? 0 }))
                .filter((s) => s.v > 0)
                .sort((a, b) => (a.key === OTHER_KEY ? 1 : b.key === OTHER_KEY ? -1 : b.v - a.v))
                .map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-text-muted">{s.label}</span>
                    <span className="tabular-nums text-text-primary">{fmtValue(s.v, metric)}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Toggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex h-8 items-center rounded-lg bg-graphite-850 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={cn(
            "h-7 rounded-md px-2.5 text-[12px] font-medium outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70",
            o.key === value ? "bg-graphite-700 text-text-primary" : "text-text-subtle hover:text-text-primary"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RankList({
  title,
  caption,
  tools,
  metric,
  onPick,
  limit = 6,
}: {
  title: string;
  caption: string;
  tools: ToolAgg[];
  metric: Metric;
  onPick?: (tool: string) => void;
  limit?: number;
}) {
  const sorted = [...tools].sort((a, b) => (metric === "jobs" ? b.jobs - a.jobs : b.cost - a.cost));
  const total = sorted.reduce((a, t) => a + (metric === "jobs" ? t.jobs : t.cost), 0);
  const top = sorted[0] ? (metric === "jobs" ? sorted[0].jobs : sorted[0].cost) : 0;
  const shown = sorted.slice(0, limit);
  const rest = sorted.length - shown.length;

  return (
    <div className="min-w-0 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-0.5 text-[12px] text-text-subtle">{caption}</p>
      <ol className="mt-4 space-y-3">
        {shown.map((t, i) => {
          const v = metric === "jobs" ? t.jobs : t.cost;
          const failRate = t.jobs > 0 ? t.failed / t.jobs : 0;
          const body = (
            <>
              <span className="flex items-baseline gap-2">
                <span className="w-4 shrink-0 text-[12px] tabular-nums text-text-subtle">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{t.label}</span>
                {metric === "jobs" && failRate >= 0.2 && t.jobs >= 10 && (
                  <span className="shrink-0 text-[11px] text-red-400">{Math.round(failRate * 100)}% failed</span>
                )}
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-text-primary">
                  {fmtValue(v, metric)}
                </span>
                <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-text-subtle">
                  {pct(v, total)}%
                </span>
              </span>
              <span className="ml-6 mt-1.5 block h-1.5 overflow-hidden rounded-full bg-graphite-800">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${top > 0 ? Math.max((v / top) * 100, 1.5) : 0}%`, background: t.color }}
                />
              </span>
            </>
          );
          return (
            <li key={t.tool}>
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(t.tool)}
                  title={`Show only ${t.label}`}
                  className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-graphite-850 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  {body}
                </button>
              ) : (
                <div>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
      {rest > 0 && <p className="ml-6 mt-3 text-[12px] text-text-subtle">and {rest} more below</p>}
    </div>
  );
}

type SortKey = "label" | "jobs" | "success" | "paid" | "gpu_seconds" | "perJob" | "cost";

export function ToolTable({ model, onPick }: { model: SpendModel; onPick?: (tool: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "cost", dir: -1 });
  const rows = useMemo(() => {
    const val = (t: ToolAgg): number | string => {
      switch (sort.key) {
        case "label":
          return t.label;
        case "success":
          return t.jobs > 0 ? (t.jobs - t.failed) / t.jobs : 0;
        case "perJob":
          return t.completed > 0 ? t.cost / t.completed : t.jobs > 0 ? t.cost / t.jobs : 0;
        default:
          return t[sort.key];
      }
    };
    return [...model.tools].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [model.tools, sort]);

  const head = (key: SortKey, label: string, right = true) => {
    const on = sort.key === key;
    return (
      <th scope="col" className={cn("px-3 py-2.5 font-medium", right && "text-right")}>
        <button
          type="button"
          onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "label" ? 1 : -1 }))}
          className={cn(
            "inline-flex items-center gap-1 rounded outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70",
            right && "flex-row-reverse",
            on ? "text-text-primary" : "text-text-subtle"
          )}
        >
          {label}
          {on && (sort.dir === 1 ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />)}
        </button>
      </th>
    );
  };

  const totalCost = model.totals.cost;

  return (
    <div>
      <div className="space-y-2 md:hidden">
        {rows.map((t) => {
          const success = t.jobs > 0 ? 1 - t.failed / t.jobs : 1;
          return (
            <div key={t.tool} className="rounded-xl border border-graphite-800 bg-graphite-900/60 p-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">{t.label}</span>
                <span className="text-[13px] font-medium tabular-nums text-amber-400">{usd(t.cost)}</span>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                <div>
                  <dt className="text-text-subtle">Jobs</dt>
                  <dd className="tabular-nums text-text-primary">{count(t.jobs)}</dd>
                </div>
                <div>
                  <dt className="text-text-subtle">Success</dt>
                  <dd className={cn("tabular-nums", success < 0.8 ? "text-red-400" : "text-text-primary")}>
                    {Math.round(success * 100)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-text-subtle">Per job</dt>
                  <dd className="tabular-nums text-text-primary">
                    {usd(t.completed > 0 ? t.cost / t.completed : t.jobs > 0 ? t.cost / t.jobs : 0, 4)}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="text-[12px]">
            <tr className="border-b border-graphite-800">
              {head("label", "Tool", false)}
              {head("jobs", "Jobs")}
              {head("success", "Success rate")}
              {head("paid", "Paid with credits")}
              {head("gpu_seconds", "GPU time")}
              {head("perJob", "Cost per job")}
              {head("cost", "Spend")}
              <th scope="col" className="px-3 py-2.5 text-right font-medium text-text-subtle">
                Share of spend
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const success = t.jobs > 0 ? 1 - t.failed / t.jobs : 1;
              const share = totalCost > 0 ? t.cost / totalCost : 0;
              const perJob = t.completed > 0 ? t.cost / t.completed : t.jobs > 0 ? t.cost / t.jobs : 0;
              return (
                <tr key={t.tool} className="border-b border-graphite-800/60 last:border-0 hover:bg-graphite-850/40">
                  <td className="px-3 py-3">
                    {onPick ? (
                      <button
                        type="button"
                        onClick={() => onPick(t.tool)}
                        title={`Show only ${t.label}`}
                        className="inline-flex items-center gap-2 rounded text-left outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.color }} />
                        <span className="text-text-primary">{t.label}</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.color }} />
                        {t.label}
                      </span>
                    )}
                    <span className="ml-[18px] block font-mono text-[11px] text-text-subtle">{t.tool}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{count(t.jobs)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <span className={success < 0.8 ? "font-medium text-red-400" : "text-text-primary"}>
                      {Math.round(success * 100)}%
                    </span>
                    {t.failed > 0 && (
                      <span className="ml-1.5 text-[12px] text-text-subtle">{count(t.failed)} failed</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-text-muted">{count(t.paid)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-text-muted">{duration(t.gpu_seconds)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-text-muted">{usd(perJob, 4)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-amber-400">{usd(t.cost)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-graphite-800">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.max(share * 100, 1.5)}%`, background: t.color }}
                        />
                      </span>
                      <span className="w-9 text-right text-[12px] tabular-nums text-text-subtle">
                        {Math.round(share * 100)}%
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function insight(model: SpendModel) {
  const byCost = [...model.tools].sort((a, b) => b.cost - a.cost)[0];
  const byJobs = [...model.tools].sort((a, b) => b.jobs - a.jobs)[0];
  const troubled = [...model.tools]
    .filter((t) => t.jobs >= 20 && t.failed / t.jobs >= 0.2)
    .sort((a, b) => b.failed - a.failed)[0];
  return { byCost, byJobs, troubled };
}

export function SpendBoard({
  model,
  range,
  variant = "full",
  onDrillFailed,
  onPickTool,
  toolFilterLabel,
}: {
  model: SpendModel;
  range: RangeKey;
  variant?: "full" | "compact";
  onDrillFailed?: () => void;
  onPickTool?: (tool: string) => void;
  toolFilterLabel?: string;
}) {
  const [metric, setMetric] = useState<Metric>("cost");
  const [mode, setMode] = useState<ChartMode>("total");
  const { totals, tools } = model;
  const { byCost, byJobs, troubled } = insight(model);
  const perDay = totals.cost / model.activeDays;
  const perJob = totals.completed > 0 ? totals.cost / totals.completed : 0;
  const singleDay = model.days.length <= 1;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900/70">
        <div className="p-4 sm:p-6">
          <h2 className="text-balance text-[15px] leading-snug text-text-muted sm:text-base">
            <span className="mr-2 align-baseline text-[34px] font-semibold tracking-tight tabular-nums text-amber-400 sm:text-[40px]">
              {usd(totals.cost)}
            </span>
            spent on GPU {rangePhrase(range)}
            {toolFilterLabel ? ` by ${toolFilterLabel}` : ""}
          </h2>

          {tools.length > 0 && (
            <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-text-body">
              {!singleDay && <>About {usd(perDay)} a day. </>}
              {!toolFilterLabel && byCost && byJobs && (
                byCost.tool === byJobs.tool ? (
                  <>
                    {byCost.label} is both the most used and the most expensive tool, at {pct(byCost.cost, totals.cost)}% of spend.
                  </>
                ) : (
                  <>
                    {byCost.label} costs the most ({pct(byCost.cost, totals.cost)}% of spend). {byJobs.label} gets used the most (
                    {count(byJobs.jobs)} jobs).
                  </>
                )
              )}
            </p>
          )}

          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-[12px] text-text-subtle">Jobs</dt>
              <dd className="text-lg font-semibold tabular-nums text-text-primary">{count(totals.jobs)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-text-subtle">Failed</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {onDrillFailed && totals.failed > 0 ? (
                  <button
                    type="button"
                    onClick={onDrillFailed}
                    title="Open these failed jobs in the Jobs tab"
                    className={cn(
                      "rounded underline decoration-dotted underline-offset-4 outline-none hover:decoration-solid focus-visible:ring-2 focus-visible:ring-amber-400/70",
                      pct(totals.failed, totals.jobs) >= 10 ? "text-red-400" : "text-text-primary"
                    )}
                  >
                    {count(totals.failed)}
                    <span className="ml-1 text-[13px] font-normal text-text-subtle">
                      {pct(totals.failed, totals.jobs)}%
                    </span>
                  </button>
                ) : (
                  <span className={pct(totals.failed, totals.jobs) >= 10 ? "text-red-400" : "text-text-primary"}>
                    {count(totals.failed)}
                    <span className="ml-1 text-[13px] font-normal text-text-subtle">
                      {pct(totals.failed, totals.jobs)}%
                    </span>
                  </span>
                )}
              </dd>
            </div>
            {totals.rejected > 0 && (
              <div title="The input could not be processed: too long, no notes or speech, removed video. Not a server failure.">
                <dt className="text-[12px] text-text-subtle">Rejected</dt>
                <dd className="text-lg font-semibold tabular-nums text-text-muted">
                  {count(totals.rejected)}
                  <span className="ml-1 text-[13px] font-normal text-text-subtle">
                    {pct(totals.rejected, totals.jobs)}%
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[12px] text-text-subtle">Paid with credits</dt>
              <dd className="text-lg font-semibold tabular-nums text-text-primary">{count(totals.paid)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-text-subtle">Cost per finished job</dt>
              <dd className="text-lg font-semibold tabular-nums text-text-primary">{usd(perJob, 4)}</dd>
            </div>
            <div>
              <dt className="text-[12px] text-text-subtle">GPU time</dt>
              <dd className="text-lg font-semibold tabular-nums text-text-primary">{duration(totals.gpu_seconds)}</dd>
            </div>
          </dl>

          {troubled && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3.5 py-2.5 text-[13px] text-red-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <span className="min-w-0 flex-1">
                {troubled.label} failed on {count(troubled.failed)} of {count(troubled.jobs)} jobs (
                {pct(troubled.failed, troubled.jobs)}%).
              </span>
              {onDrillFailed && (
                <button
                  type="button"
                  onClick={onDrillFailed}
                  className="rounded-md border border-red-500/30 px-2.5 py-1 text-[12px] text-red-200 outline-none transition-colors hover:bg-red-500/15 focus-visible:ring-2 focus-visible:ring-red-400/70"
                >
                  See failed jobs
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-graphite-800 px-2 pb-3 pt-3 sm:px-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
            <Toggle
              label="Chart metric"
              value={metric}
              onChange={setMetric}
              options={[
                { key: "cost", label: "Spend" },
                { key: "jobs", label: "Jobs" },
              ]}
            />
            <Toggle
              label="Chart split"
              value={mode}
              onChange={setMode}
              options={[
                { key: "total", label: "Total" },
                { key: "tools", label: "By tool" },
              ]}
            />
            {mode === "tools" && (
              <ul className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
                {model.series.map((s) => (
                  <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-text-muted">
                    <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                    {s.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {singleDay ? (
            <p className="px-2 py-10 text-center text-[13px] text-text-subtle">
              One day has no trend to draw. Pick 7 days or more to see the daily curve.
            </p>
          ) : (
            <TrendChart model={model} metric={metric} mode={mode} height={variant === "compact" ? 220 : 260} />
          )}
        </div>
      </section>

      {!toolFilterLabel && tools.length > 1 && (
        <section className="grid overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900/70 md:grid-cols-2 md:divide-x md:divide-graphite-800 max-md:divide-y max-md:divide-graphite-800">
          <RankList
            title="Where the money goes"
            caption="Tools ranked by GPU spend"
            tools={tools}
            metric="cost"
            onPick={onPickTool}
            limit={variant === "compact" ? 5 : 6}
          />
          <RankList
            title="What people use most"
            caption="Tools ranked by jobs run"
            tools={tools}
            metric="jobs"
            onPick={onPickTool}
            limit={variant === "compact" ? 5 : 6}
          />
        </section>
      )}

      <p className="px-1 text-[12px] leading-relaxed text-text-subtle">
        Covers tools that run on the GPU. Free ffmpeg tools are not metered. Spend counts GPU run time only, so the
        RunPod invoice runs higher because of cold starts.
      </p>
    </div>
  );
}