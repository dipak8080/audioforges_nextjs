"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  FileArchive,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Section, ValidationNote } from "@/components/tools/JobFormKit";
import { toAnalysisResult } from "@/components/converter/AnalysisResultCard";
import { cn } from "@/lib/utils/cn";
import { validateAudioFile } from "@/lib/utils/validation";
import { getRetryAfterFallback } from "@/lib/data/rate-limits";
import { MAX_BATCH_FILES } from "@/lib/data/key-finder";
import { analyzeAudioFile, isAbortError, ApiError } from "@/lib/api/railway";
import type { AnalysisResult } from "@/lib/types/converter";

const BUSY_RETRY_SECONDS = 10;
const BUSY_MAX_TRIES = 3;
const ACCEPT = "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.aiff,.aif";
const ZIP_NAME = "audioforges-key-bpm.zip";
const CSV_NAME = "audioforges-key-bpm.csv";

type RowStatus = "waiting" | "analysing" | "done" | "failed";
export type BatchPhase = "ready" | "running" | "finished";
export interface BatchStatus {
  phase: BatchPhase;
  count: number;
}

interface Row {
  id: string;
  file: File;
  name: string;
  status: RowStatus;
  result: AnalysisResult | null;
  error: string | null;
  invalid: boolean;
  bpmOverride: number | null;
  startedAt: number | null;
  ms: number | null;
  duration: number | null | undefined;
}

type SortKey = "added" | "camelot" | "bpm" | "mix";

let seq = 0;

function fileKey(f: File) {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

function makeRow(file: File): Row {
  const v = validateAudioFile(file);
  seq += 1;
  return {
    id: `r${seq}`,
    file,
    name: file.name,
    status: v.isValid ? "waiting" : "failed",
    result: null,
    error: v.isValid ? null : v.error || "This file can't be read here",
    invalid: !v.isValid,
    bpmOverride: null,
    startedAt: null,
    ms: null,
    duration: v.isValid ? undefined : null,
  };
}

function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let settled = false;
    const done = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(value);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    const timer = setTimeout(() => done(null), 5000);
    el.src = url;
  });
}

/* Camelot maths */

const KEY_NAMES: Record<string, string> = {
  "1A": "A♭ minor", "1B": "B major", "2A": "E♭ minor", "2B": "F♯ major",
  "3A": "B♭ minor", "3B": "D♭ major", "4A": "F minor", "4B": "A♭ major",
  "5A": "C minor", "5B": "E♭ major", "6A": "G minor", "6B": "B♭ major",
  "7A": "D minor", "7B": "F major", "8A": "A minor", "8B": "C major",
  "9A": "E minor", "9B": "G major", "10A": "B minor", "10B": "D major",
  "11A": "F♯ minor", "11B": "A major", "12A": "D♭ minor", "12B": "E major",
};

function parseCamelot(code: string | undefined | null): { n: number; l: "A" | "B" } | null {
  const m = /^(\d{1,2})([AB])$/i.exec((code ?? "").trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 12) return null;
  return { n, l: m[2].toUpperCase() as "A" | "B" };
}

function normCode(code: string | undefined | null): string | null {
  const p = parseCamelot(code);
  return p ? `${p.n}${p.l}` : null;
}

function camelotRank(code: string | undefined): number {
  const p = parseCamelot(code);
  return p ? p.n * 2 + (p.l === "B" ? 1 : 0) : Number.POSITIVE_INFINITY;
}

type Relation = "same" | "relative" | "up" | "down";

function relation(from: string | undefined | null, to: string | undefined | null): Relation | null {
  const a = parseCamelot(from);
  const b = parseCamelot(to);
  if (!a || !b) return null;
  if (a.n === b.n) return a.l === b.l ? "same" : "relative";
  if (a.l !== b.l) return null;
  const step = (b.n - a.n + 12) % 12;
  if (step === 1) return "up";
  if (step === 11) return "down";
  return null;
}

function relationLabel(rel: Relation, to: string | undefined): string {
  if (rel === "same") return "Same key";
  if (rel === "relative") return parseCamelot(to)?.l === "B" ? "Relative major" : "Relative minor";
  return rel === "up" ? "One step up" : "One step down";
}

function bpmOf(row: Row): number {
  return row.bpmOverride ?? row.result?.bpm ?? 0;
}

function tempoGap(a: number, b: number): { delta: number; octave: boolean } {
  const options = [b, b * 2, b / 2].map((c) => ({ delta: Math.round(c - a), octave: c !== b }));
  options.sort((x, y) => Math.abs(x.delta) - Math.abs(y.delta));
  return options[0];
}

function mixOrder(list: Row[]): Row[] {
  const pool = [...list].sort((a, b) => bpmOf(a) - bpmOf(b));
  if (!pool.length) return [];
  const out = [pool.shift() as Row];
  while (pool.length) {
    const cur = out[out.length - 1];
    let best = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    pool.forEach((r, i) => {
      const rel = relation(cur.result?.camelot, r.result?.camelot);
      const keyCost = rel === "same" ? 0 : rel ? 1 : 6;
      const gap = Math.abs(tempoGap(bpmOf(cur), bpmOf(r)).delta) / Math.max(1, bpmOf(cur));
      const score = keyCost * 8 + gap * 100;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    out.push(pool.splice(best, 1)[0]);
  }
  return out;
}

function tempoAlternatives(bpm: number): number[] {
  if (!bpm) return [];
  const out: number[] = [];
  if (bpm / 2 >= 60) out.push(Math.round(bpm / 2));
  if (bpm * 2 <= 200) out.push(bpm * 2);
  return out;
}

/* Output */

const WINDOWS_BAD = /[\\/:*?"<>|]/g;
const EXISTING_PREFIX = /^\d{1,2}[AB] - \d{2,3} - /i;

function splitExt(name: string): [string, string] {
  const i = name.lastIndexOf(".");
  return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ""];
}

function buildRenames(rows: Row[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const row of rows) {
    if (row.status !== "done" || !row.result) continue;
    const code = normCode(row.result.camelot) ?? "Unknown";
    const base = row.name.replace(EXISTING_PREFIX, "");
    const clean = `${code} - ${Math.round(bpmOf(row))} - ${base}`
      .replace(WINDOWS_BAD, "")
      .replace(/[\u0000-\u001f]/g, "")
      .trim();
    const [stem, ext] = splitExt(clean);
    let candidate = clean;
    for (let n = 2; used.has(candidate.toLowerCase()); n += 1) candidate = `${stem} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    map.set(row.id, candidate);
  }
  return map;
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildCsv(rows: Row[], renames: Map<string, string>): string {
  const header = ["file", "key", "camelot", "bpm", "key_confidence", "bpm_confidence", "renamed_file"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    if (row.status !== "done" || !row.result) continue;
    lines.push(
      [
        row.name,
        row.result.key,
        row.result.camelot,
        Math.round(bpmOf(row)),
        row.result.confidence,
        row.result.bpmConfidence,
        renames.get(row.id) ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return "\uFEFF" + lines.join("\r\n");
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function formatWait(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r}s` : `${m} min`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function extOf(name: string): string {
  const ext = splitExt(name)[1].slice(1).toUpperCase();
  return ext.length > 0 && ext.length <= 5 ? ext : "AUDIO";
}

/* Pieces */

function Dash() {
  return (
    <span className="inline-block h-px w-3 bg-graphite-600 align-middle" aria-hidden>
      <span className="sr-only">None</span>
    </span>
  );
}

function ReadingBars() {
  return (
    <span className="kf-bars inline-flex h-3 items-end gap-[2px]" role="img" aria-label="Analysing">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="w-[2px] rounded-full bg-amber-400" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </span>
  );
}

function StepStrip({ rows, slots, onPick }: { rows: Row[]; slots: number; onPick?: (id: string) => void }) {
  const empty = Math.max(0, slots - rows.length);
  return (
    <div className="flex h-2 items-stretch gap-[3px]" aria-hidden>
      {rows.map((r) => {
        const tone =
          r.status === "done"
            ? "bg-amber-500"
            : r.status === "analysing"
              ? "kf-pulse bg-amber-400"
              : r.status === "failed"
                ? "bg-red-500/60"
                : "bg-graphite-700";
        const pickable = r.status === "done" && Boolean(onPick);
        return (
          <span
            key={r.id}
            title={r.name}
            onClick={() => pickable && onPick?.(r.id)}
            className={cn(
              "min-w-0 flex-1 rounded-[2px] transition-colors duration-300",
              tone,
              pickable && "cursor-pointer hover:bg-amber-300"
            )}
          />
        );
      })}
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e${i}`} className="min-w-0 flex-1 rounded-[2px] border border-dashed border-graphite-700/80" />
      ))}
    </div>
  );
}

const W = 188;
const C = W / 2;
const R_OUT = 90;
const R_MID = 66;
const R_IN = 42;

function polar(angle: number, r: number): [number, number] {
  const a = ((angle - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function arc(n: number, rIn: number, rOut: number) {
  const start = (n % 12) * 30 - 15 + 1.2;
  const end = start + 30 - 2.4;
  const [x1, y1] = polar(start, rOut);
  const [x2, y2] = polar(end, rOut);
  const [x3, y3] = polar(end, rIn);
  const [x4, y4] = polar(start, rIn);
  const f = (v: number) => v.toFixed(2);
  return `M${f(x1)} ${f(y1)}A${rOut} ${rOut} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${rIn} ${rIn} 0 0 0 ${f(x4)} ${f(y4)}Z`;
}

function CrateWheel({
  counts,
  focus,
  filter,
  analysed,
  onHover,
  onPick,
}: {
  counts: Map<string, number>;
  focus: string | null;
  filter: string | null;
  analysed: number;
  onHover: (code: string | null) => void;
  onPick: (code: string) => void;
}) {
  const max = Math.max(1, ...counts.values());
  const focusMix = focus
    ? [...counts.entries()].filter(([code]) => relation(focus, code)).reduce((sum, [, n]) => sum + n, 0)
    : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${W}`}
      className="h-auto w-full"
      role="group"
      aria-label="Keys in this crate on the Camelot wheel"
      onMouseLeave={() => onHover(null)}
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).flatMap((n) =>
        (["B", "A"] as const).map((l) => {
          const code = `${n}${l}`;
          const count = counts.get(code) ?? 0;
          const rel = focus ? relation(focus, code) : null;
          const isFocus = focus === code;
          const dimmed = Boolean(focus) && !rel;
          const [rIn, rOut] = l === "B" ? [R_MID, R_OUT] : [R_IN, R_MID];
          const [tx, ty] = polar((n % 12) * 30, (rIn + rOut) / 2);
          const fill = isFocus
            ? "var(--amber-500)"
            : rel
              ? "rgba(232,162,61,0.34)"
              : count
                ? `rgba(232,162,61,${((0.14 + 0.46 * (count / max)) * (dimmed ? 0.4 : 1)).toFixed(3)})`
                : "var(--graphite-850)";
          const text = isFocus ? "var(--graphite-950)" : count || rel ? "var(--amber-300)" : "var(--graphite-500)";
          const interactive = count > 0;
          return (
            <g
              key={code}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-pressed={interactive ? filter === code : undefined}
              aria-label={
                interactive ? `${code}, ${KEY_NAMES[code]}, ${count} track${count === 1 ? "" : "s"}` : undefined
              }
              className={cn(interactive && "cursor-pointer outline-none [&:focus-visible>path]:stroke-amber-300")}
              onMouseEnter={() => onHover(interactive ? code : null)}
              onFocus={() => interactive && onHover(code)}
              onBlur={() => onHover(null)}
              onClick={() => interactive && onPick(code)}
              onKeyDown={(e) => {
                if (interactive && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onPick(code);
                }
              }}
            >
              <title>{`${code} ${KEY_NAMES[code]}${count ? `, ${count} track${count === 1 ? "" : "s"}` : ""}`}</title>
              <path
                d={arc(n, rIn, rOut)}
                fill={fill}
                stroke={filter === code ? "var(--amber-300)" : "transparent"}
                strokeWidth="1.5"
                style={{ transition: "fill 450ms ease" }}
              />
              <text
                x={tx}
                y={ty + 3}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight={count || isFocus ? 600 : 400}
                fontFamily="var(--font-mono)"
                fill={text}
                pointerEvents="none"
              >
                {code}
              </text>
            </g>
          );
        })
      )}
      <circle cx={C} cy={C} r={R_IN - 4} fill="var(--graphite-950)" stroke="var(--graphite-800)" />
      <text
        x={C}
        y={C + 3}
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        fontFamily="var(--font-mono)"
        fill={focus ? "var(--amber-400)" : "var(--text-primary)"}
      >
        {focus ?? analysed}
      </text>
      <text x={C} y={C + 15} textAnchor="middle" fontSize="8" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
        {focus ? `${focusMix} ${focusMix === 1 ? "match" : "matches"}` : analysed === 1 ? "track" : "tracks"}
      </text>
    </svg>
  );
}

function Meter({ label, pct, warn }: { label: string; pct: number; warn: boolean }) {
  const tone = pct >= 80 ? "bg-teal-400" : pct >= 55 ? "bg-amber-500" : "bg-red-400";
  const word = pct >= 80 ? "Strong" : pct >= 55 ? "Fair" : "Weak";
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono tabular-nums text-text-primary">
          {word} {pct}%
        </span>
      </div>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-graphite-800"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      {warn && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-400/90">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          The two detectors disagreed. Check it by ear.
        </p>
      )}
    </div>
  );
}

function RowDetail({
  row,
  renamed,
  others,
  onBpm,
  onJump,
}: {
  row: Row;
  renamed: string | undefined;
  others: Row[];
  onBpm: (bpm: number | null) => void;
  onJump: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const result = row.result as AnalysisResult;
  const bpm = bpmOf(row);
  const choices = [result.bpm, ...tempoAlternatives(result.bpm)].sort((a, b) => a - b);

  const matches = others
    .filter((o) => o.id !== row.id && o.status === "done" && o.result)
    .map((o) => ({ o, rel: relation(result.camelot, o.result?.camelot) }))
    .filter((m): m is { o: Row; rel: Relation } => m.rel !== null)
    .map((m) => ({ ...m, gap: tempoGap(bpm, bpmOf(m.o)) }))
    .sort((a, b) => Math.abs(a.gap.delta) - Math.abs(b.gap.delta));

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${result.key} ${result.camelot} ${bpm} BPM`);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="kf-open grid gap-6 p-4 sm:grid-cols-2 sm:p-5">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end gap-x-7 gap-y-3">
          <div>
            <p className="text-xs text-text-subtle">Key</p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight text-text-primary">{result.key}</span>
              <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-sm font-semibold text-amber-400">
                {result.camelot}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-text-subtle">Tempo</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-text-primary">
              {bpm}
              <span className="ml-1 font-sans text-xs font-normal text-text-subtle">BPM</span>
            </p>
          </div>
        </div>

        {choices.length > 1 && (
          <div>
            <p className="text-xs text-text-muted">Detectors can land at half or double time. Pick the one you hear.</p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Tempo">
              {choices.map((c) => {
                const on = c === bpm;
                return (
                  <Button
                    key={c}
                    size="sm"
                    variant={on ? "secondary" : "ghost"}
                    aria-pressed={on}
                    onClick={() => onBpm(c === result.bpm ? null : c)}
                    className={cn("font-mono tabular-nums", on && "ring-1 ring-amber-500/50")}
                  >
                    {c}
                    {c === result.bpm && <span className="font-sans text-[11px] text-text-subtle">detected</span>}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Meter label="Key confidence" pct={result.confidence} warn={result.keyAgrees === false} />
          <Meter label="Tempo confidence" pct={result.bpmConfidence} warn={result.bpmAgrees === false} />
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <p className="text-xs text-text-muted">Mixes with, in this crate</p>
          {matches.length ? (
            <ul className="mt-2 divide-y divide-graphite-800 overflow-hidden rounded-lg border border-graphite-800">
              {matches.slice(0, 6).map(({ o, rel, gap }) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onJump(o.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-graphite-850 focus-visible:bg-graphite-850"
                  >
                    <span className="w-8 shrink-0 font-mono text-xs font-semibold text-amber-400">
                      {o.result?.camelot}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-text-primary">{o.name}</span>
                      <span className="block text-[11px] text-text-subtle">
                        {relationLabel(rel, o.result?.camelot)},{" "}
                        {gap.delta === 0
                          ? "same tempo"
                          : `${gap.delta > 0 ? "+" : ""}${gap.delta} BPM${gap.octave ? " at half or double time" : ""}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{bpmOf(o)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-text-subtle">
              Nothing else here shares a compatible key. Same number with the other letter, or one number either side,
              will blend.
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-text-muted">Saves in the ZIP as</p>
          <p className="mt-1.5 break-all rounded-lg border border-graphite-800 bg-graphite-950/60 px-3 py-2 font-mono text-xs text-text-body">
            {renamed}
          </p>
          <Button size="sm" variant="ghost" onClick={copy} className="-ml-2 mt-2">
            {copied ? <Check className="text-teal-400" /> : <Copy />}
            {copied ? "Copied" : "Copy key and BPM"}
          </Button>
          <span className="sr-only" role="status" aria-live="polite">
            {copied ? "Copied" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

const GRID =
  "grid grid-cols-[1.75rem_minmax(0,1fr)_3.5rem_3rem] gap-x-3 sm:grid-cols-[2rem_minmax(0,1fr)_7rem_4.5rem_3.5rem]";

const KF_STYLES = `
@keyframes kf-bar { 0%,100% { height: 25%; } 50% { height: 100%; } }
.kf-bars > span { height: 25%; animation: kf-bar .9s ease-in-out infinite; }
@keyframes kf-pulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
.kf-pulse { animation: kf-pulse 1.1s ease-in-out infinite; }
@keyframes kf-scan { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
.kf-scan { animation: kf-scan 1.6s cubic-bezier(.45,0,.55,1) infinite; }
@keyframes kf-open { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.kf-open { animation: kf-open .22s cubic-bezier(.22,.9,.32,1) both; }
@keyframes kf-land { from { background-color: rgba(232,162,61,.14); } to { background-color: transparent; } }
.kf-land { animation: kf-land 1.2s ease-out; }
@media (prefers-reduced-motion: reduce) {
  .kf-bars > span, .kf-pulse, .kf-scan, .kf-open, .kf-land { animation: none; }
  .kf-bars > span { height: 60%; }
}
`;

export function KeyFinderBatch({
  files,
  onReset,
  note,
  onStatusChange,
}: {
  files: File[];
  onReset: () => void;
  note?: string | null;
  onStatusChange?: (status: BatchStatus) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => files.map(makeRow));
  const [phase, setPhase] = useState<BatchPhase>("ready");
  const [cooldown, setCooldown] = useState(0);
  const [now, setNow] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [filterCode, setFilterCode] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [sortAsc, setSortAsc] = useState(true);
  const [zipPct, setZipPct] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(note ?? null);
  const [dragging, setDragging] = useState(false);

  const rowsRef = useRef(rows);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const wakeRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const commit = useCallback((update: (prev: Row[]) => Row[]) => {
    rowsRef.current = update(rowsRef.current);
    setRows(rowsRef.current);
  }, []);

  const patch = useCallback(
    (id: string, next: Partial<Row>) => commit((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r))),
    [commit]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      abortRef.current?.abort();
      wakeRef.current?.();
    };
  }, []);

  useEffect(() => {
    onStatusChange?.({ phase, count: rows.length });
  }, [phase, rows.length, onStatusChange]);

  const unprobed = rows
    .filter((r) => r.duration === undefined)
    .map((r) => r.id)
    .join(",");

  useEffect(() => {
    if (!unprobed) return;
    let alive = true;
    (async () => {
      for (const id of unprobed.split(",")) {
        const row = rowsRef.current.find((r) => r.id === id);
        if (!row) continue;
        const d = await probeDuration(row.file);
        if (!alive) return;
        patch(id, { duration: d });
      }
    })();
    return () => {
      alive = false;
    };
  }, [unprobed, patch]);

  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const sleep = useCallback(
    (seconds: number) =>
      new Promise<boolean>((resolve) => {
        let left = Math.max(1, Math.round(seconds));
        setCooldown(left);
        const finish = (ok: boolean) => {
          clearInterval(tick);
          wakeRef.current = null;
          setCooldown(0);
          resolve(ok);
        };
        const tick = setInterval(() => {
          left -= 1;
          setCooldown(Math.max(0, left));
          if (left <= 0) finish(true);
        }, 1000);
        wakeRef.current = () => finish(false);
      }),
    []
  );

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    cancelledRef.current = false;
    setNow(Date.now());
    setPhase("running");
    const stopped = () => cancelledRef.current || !mountedRef.current;

    try {
      for (;;) {
        if (stopped()) return;
        const row = rowsRef.current.find((r) => r.status === "waiting");
        if (!row) break;

        let busyTries = 0;
        for (;;) {
          if (stopped()) return;
          const controller = new AbortController();
          abortRef.current = controller;
          const t0 = Date.now();
          patch(row.id, { status: "analysing", startedAt: t0, error: null });
          try {
            const data = await analyzeAudioFile(row.file, { signal: controller.signal });
            if (stopped()) return;
            patch(row.id, { status: "done", result: toAnalysisResult(data), error: null, ms: Date.now() - t0 });
            break;
          } catch (err) {
            if (stopped() || isAbortError(err) || controller.signal.aborted) return;
            if (err instanceof ApiError && err.isRateLimit) {
              patch(row.id, { status: "waiting", startedAt: null });
              if (!(await sleep(err.retryAfterSeconds ?? getRetryAfterFallback("analyze")))) return;
              continue;
            }
            if (err instanceof ApiError && err.isServerBusy && busyTries < BUSY_MAX_TRIES - 1) {
              busyTries += 1;
              patch(row.id, { status: "waiting", startedAt: null });
              if (!(await sleep(BUSY_RETRY_SECONDS))) return;
              continue;
            }
            patch(row.id, {
              status: "failed",
              startedAt: null,
              error: err instanceof ApiError ? err.message : "Analysis failed",
            });
            break;
          } finally {
            abortRef.current = null;
          }
        }
      }
      if (mountedRef.current) setPhase("finished");
    } finally {
      runningRef.current = false;
    }
  }, [patch, sleep]);

  function cancel() {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    wakeRef.current?.();
    commit((prev) =>
      prev.map((r) =>
        r.status === "waiting" || r.status === "analysing"
          ? { ...r, status: "failed", error: "Cancelled", startedAt: null }
          : r
      )
    );
    setPhase("finished");
  }

  function retry() {
    if (runningRef.current) return;
    commit((prev) =>
      prev.map((r) => (r.status === "failed" && !r.invalid ? { ...r, status: "waiting", error: null } : r))
    );
    void runQueue();
  }

  function addFiles(list: File[]) {
    if (!list.length) return;
    const have = new Set(rowsRef.current.map((r) => fileKey(r.file)));
    const fresh = list.filter((f) => !have.has(fileKey(f)));
    const room = Math.max(0, MAX_BATCH_FILES - rowsRef.current.length);
    const kept = fresh.slice(0, room);
    const dupes = list.length - fresh.length;
    const over = fresh.length - kept.length;
    const parts: string[] = [];
    if (over) parts.push(`The crate holds ${MAX_BATCH_FILES} files, so ${over} ${over === 1 ? "was" : "were"} left out.`);
    if (dupes) parts.push(`${dupes} ${dupes === 1 ? "file was" : "files were"} already in the list.`);
    setNotice(parts.length ? parts.join(" ") : null);
    if (kept.length) commit((prev) => [...prev, ...kept.map(makeRow)]);
  }

  function removeRow(id: string) {
    const next = rowsRef.current.filter((r) => r.id !== id);
    if (!next.length) {
      onReset();
      return;
    }
    commit(() => next);
    setNotice(null);
  }

  function onDrag(e: DragEvent, kind: "enter" | "leave" | "over" | "drop") {
    if (phase !== "ready") return;
    e.preventDefault();
    if (kind === "enter") {
      dragDepth.current += 1;
      setDragging(true);
    } else if (kind === "leave") {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    } else if (kind === "drop") {
      dragDepth.current = 0;
      setDragging(false);
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  const renames = useMemo(() => buildRenames(rows), [rows]);

  function downloadCsv() {
    saveBlob(new Blob([buildCsv(rows, renames)], { type: "text/csv;charset=utf-8" }), CSV_NAME);
  }

  async function downloadZip() {
    if (zipPct !== null) return;
    setZipPct(0);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const row of rows) {
        const name = renames.get(row.id);
        if (row.status === "done" && name) zip.file(name, row.file, { binary: true });
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, (meta) =>
        setZipPct(Math.round(meta.percent))
      );
      saveBlob(blob, ZIP_NAME);
    } catch {
      setNotice("The ZIP could not be built in this browser. The CSV still has every result.");
    } finally {
      setZipPct(null);
    }
  }

  const valid = rows.filter((r) => !r.invalid);
  const done = useMemo(() => rows.filter((r) => r.status === "done" && r.result), [rows]);
  const failed = rows.filter((r) => r.status === "failed");
  const retryable = failed.filter((r) => !r.invalid);
  const current = rows.find((r) => r.status === "analysing") ?? null;
  const currentIndex = current ? rows.indexOf(current) : -1;
  const settled = done.length + failed.length;

  const timed = done.filter((r) => r.ms);
  const avgMs = timed.length ? timed.reduce((s, r) => s + (r.ms as number), 0) / timed.length : 0;
  const remaining = rows.filter((r) => r.status === "waiting").length + (current ? 1 : 0);
  const elapsed = current?.startedAt && now > current.startedAt ? (now - current.startedAt) / 1000 : 0;
  const eta = avgMs ? Math.max(0, (avgMs / 1000) * remaining - elapsed) : null;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of done) {
      const code = normCode(r.result?.camelot);
      if (code) m.set(code, (m.get(code) ?? 0) + 1);
    }
    return m;
  }, [done]);

  const openRow = rows.find((r) => r.id === openId && r.status === "done" && r.result) ?? null;
  const openCode = normCode(openRow?.result?.camelot);
  const focusCode = hoverCode ?? openCode ?? filterCode;

  const bpms = done.map(bpmOf).filter(Boolean);
  const bpmMin = bpms.length ? Math.min(...bpms) : 0;
  const bpmMax = bpms.length ? Math.max(...bpms) : 0;
  const topKey = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  const ordered = useMemo(() => {
    const base = rows.map((r, i) => ({ r, i }));
    if (sortKey === "added") return base;
    if (sortKey === "mix") {
      const chain = mixOrder(rows.filter((r) => r.status === "done" && r.result));
      const rest = base.filter(({ r }) => !(r.status === "done" && r.result));
      return [...chain.map((r) => ({ r, i: rows.indexOf(r) })), ...rest];
    }
    const value = (r: Row) => (sortKey === "camelot" ? camelotRank(r.result?.camelot) : r.result ? bpmOf(r) : NaN);
    return [...base].sort((a, b) => {
      const av = value(a.r);
      const bv = value(b.r);
      const aBad = !Number.isFinite(av);
      const bBad = !Number.isFinite(bv);
      if (aBad || bBad) return aBad && bBad ? a.i - b.i : aBad ? 1 : -1;
      return sortAsc ? av - bv : bv - av;
    });
  }, [rows, sortKey, sortAsc]);

  const visible = filterCode ? ordered.filter(({ r }) => r.result && relation(filterCode, r.result.camelot)) : ordered;

  function pickSort(key: SortKey) {
    if (key === sortKey && (key === "camelot" || key === "bpm")) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function toggleOpen(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
  }

  const started = phase !== "ready";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KF_STYLES }} />

      {!started ? (
        <Section>
          <div
            onDragEnter={(e) => onDrag(e, "enter")}
            onDragLeave={(e) => onDrag(e, "leave")}
            onDragOver={(e) => onDrag(e, "over")}
            onDrop={(e) => onDrag(e, "drop")}
            className={cn(
              "-m-2 space-y-4 rounded-2xl p-2 outline outline-1 outline-offset-4 outline-transparent transition-[outline-color,background-color] duration-200",
              dragging && "bg-amber-500/[0.04] outline-dashed outline-amber-500/60"
            )}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-text-primary">Forge Crate</h3>
                <p className="mt-0.5 text-sm text-text-muted">
                  {rows.length} {rows.length === 1 ? "track" : "tracks"} loaded. Nothing is uploaded until you press
                  Analyse.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={rows.length >= MAX_BATCH_FILES}
              >
                <Plus />
                Add files
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </div>

            <div className="space-y-1.5">
              <StepStrip rows={rows} slots={MAX_BATCH_FILES} />
              <p className="flex justify-between font-mono text-[11px] tabular-nums text-text-subtle">
                <span>
                  {rows.length} of {MAX_BATCH_FILES} slots
                </span>
                <span className="font-sans">{dragging ? "Release to add" : "Drop more files here"}</span>
              </p>
            </div>

            {notice && <ValidationNote message={notice} />}

            <ul className="divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950/40">
              {rows.map((row, i) => (
                <li key={row.id} className="jt-in flex items-center gap-3 py-2 pl-3 pr-1.5 sm:pl-4">
                  <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-text-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn("block truncate text-sm", row.invalid ? "text-text-muted" : "text-text-primary")}
                    >
                      {row.name}
                    </span>
                    {row.invalid && <span className="block text-xs text-red-400">{row.error}. It will be skipped.</span>}
                  </span>
                  <span className="hidden shrink-0 rounded border border-graphite-700 px-1.5 py-px font-mono text-[10px] text-text-muted sm:inline">
                    {extOf(row.name)}
                  </span>
                  <span className="hidden w-14 shrink-0 text-right font-mono text-xs tabular-nums text-text-subtle sm:inline">
                    {formatSize(row.file.size)}
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-text-muted">
                    {row.duration ? formatClock(row.duration) : <Dash />}
                  </span>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remove ${row.name}`} onClick={() => removeRow(row.id)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ) : (
        <Section className="space-y-5">
          <div className="grid items-center gap-5 sm:grid-cols-[176px_1fr] sm:gap-8">
            <div className="mx-auto w-full max-w-[176px]">
              <CrateWheel
                counts={counts}
                focus={focusCode}
                filter={filterCode}
                analysed={done.length}
                onHover={setHoverCode}
                onPick={(code) => {
                  setFilterCode((cur) => (cur === code ? null : code));
                  setOpenId(null);
                }}
              />
            </div>

            <div className="min-w-0 space-y-4">
              <div role="status" aria-live="polite">
                {phase === "running" ? (
                  <>
                    <p className="text-xs text-text-subtle">
                      {cooldown > 0 ? "The analyser asked for a short pause" : "Now analysing"}
                    </p>
                    <p className="mt-1 truncate text-lg font-semibold tracking-tight text-text-primary">
                      {cooldown > 0 ? `Continuing in ${formatWait(cooldown)}` : (current?.name ?? "Starting")}
                    </p>
                    <p className="mt-1 font-mono text-xs tabular-nums text-text-muted">
                      {Math.min((currentIndex >= 0 ? currentIndex : settled) + 1, rows.length)} of {rows.length}
                      {cooldown === 0 && current ? `, ${Math.floor(elapsed)}s on this track` : ""}
                      {eta !== null && eta > 1 ? `, about ${formatWait(eta)} left` : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-text-subtle">Forge Crate</p>
                    <p className="mt-1 text-lg font-semibold tracking-tight text-text-primary">
                      {done.length} of {rows.length} analysed
                    </p>
                    <p className="mt-1 font-mono text-xs tabular-nums text-text-muted">
                      {done.length > 0
                        ? `${bpmMin === bpmMax ? `${bpmMin} BPM` : `${bpmMin} to ${bpmMax} BPM`}, ${counts.size} ${counts.size === 1 ? "key" : "keys"}${topKey && topKey[1] > 1 ? `, most in ${topKey[0]}` : ""}`
                        : "No results yet"}
                    </p>
                  </>
                )}
              </div>

              <StepStrip rows={rows} slots={rows.length} onPick={(id) => setOpenId(id)} />

              {phase === "finished" && retryable.length > 0 ? (
                <Button variant="outline" size="sm" onClick={retry}>
                  <RefreshCw />
                  Retry {retryable.length} {retryable.length === 1 ? "file" : "files"}
                </Button>
              ) : done.length > 1 ? (
                <p className="text-xs text-text-subtle">Click a key on the wheel to show only the tracks that mix with it.</p>
              ) : null}
            </div>
          </div>

          {notice && <ValidationNote message={notice} />}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Sort tracks">
              {(
                [
                  ["added", "Added"],
                  ["camelot", "Key"],
                  ["bpm", "BPM"],
                  ["mix", "Mix order"],
                ] as const
              ).map(([key, label]) => {
                const on = sortKey === key;
                return (
                  <Button
                    key={key}
                    size="sm"
                    variant={on ? "secondary" : "ghost"}
                    aria-pressed={on}
                    onClick={() => pickSort(key)}
                  >
                    {label}
                    {on && (key === "camelot" || key === "bpm") && (sortAsc ? <ArrowUp /> : <ArrowDown />)}
                  </Button>
                );
              })}
            </div>
            {filterCode && (
              <Button size="sm" variant="ghost" onClick={() => setFilterCode(null)} aria-label="Clear key filter">
                <X />
                Mixes with {filterCode}
              </Button>
            )}
          </div>

          {sortKey === "mix" && (
            <p className="-mt-2 text-xs leading-relaxed text-text-subtle">
              Starts at the slowest track and chains compatible keys at the closest tempo. A starting point for a set,
              not a finished one.
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-graphite-800">
            <div
              aria-hidden
              className={cn(GRID, "bg-graphite-950/60 py-2 pl-3 pr-3 text-xs text-text-subtle sm:pl-4 sm:pr-4")}
            >
              <span />
              <span>Track</span>
              <span className="hidden sm:block">Key</span>
              <span>Camelot</span>
              <span className="text-right">BPM</span>
            </div>
            <ul className="divide-y divide-graphite-800">
              {visible.map(({ r: row, i }, pos) => {
                const clickable = row.status === "done";
                const isOpen = openId === row.id;
                const rel = openCode && !isOpen && row.result ? relation(openCode, row.result.camelot) : null;
                const dim = Boolean(openCode) && !isOpen && !rel;
                const low = row.result && (row.result.confidence < 55 || row.result.keyAgrees === false);
                return (
                  <li key={row.id}>
                    <div
                      onClick={() => clickable && toggleOpen(row.id)}
                      onMouseEnter={() => setHoverCode(normCode(row.result?.camelot))}
                      onMouseLeave={() => setHoverCode(null)}
                      className={cn(
                        GRID,
                        "relative items-baseline py-2.5 pl-3 pr-3 text-sm transition-[background-color,opacity] duration-200 sm:pl-4 sm:pr-4",
                        clickable && !isOpen && "kf-land",
                        clickable && "cursor-pointer hover:bg-graphite-850",
                        isOpen && "bg-amber-500/[0.07] hover:bg-amber-500/[0.1]",
                        dim && "opacity-40"
                      )}
                    >
                      <span
                        className={cn(
                          "font-mono text-[11px] tabular-nums text-text-subtle",
                          rel && "text-teal-400",
                          isOpen && "text-amber-400"
                        )}
                      >
                        {String((sortKey === "mix" ? pos : i) + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        {clickable ? (
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleOpen(row.id);
                            }}
                            className="block w-full truncate rounded text-left text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
                          >
                            {row.name}
                          </button>
                        ) : (
                          <span
                            className={cn("block truncate", row.status === "failed" ? "text-text-muted" : "text-text-body")}
                          >
                            {row.name}
                          </span>
                        )}
                        {row.error && <span className="mt-0.5 block text-xs text-red-400">{row.error}</span>}
                        {rel && (
                          <span className="mt-0.5 block text-[11px] text-teal-400">
                            {relationLabel(rel, row.result?.camelot)}
                          </span>
                        )}
                      </span>
                      <span className="hidden min-w-0 text-text-muted sm:block">
                        {row.result ? (
                          <span className="flex items-center gap-1.5">
                            <span className="truncate">{row.result.key}</span>
                            {low && (
                              <AlertTriangle
                                className="h-3 w-3 shrink-0 text-amber-400/80"
                                aria-label="Low confidence, check by ear"
                              />
                            )}
                          </span>
                        ) : row.status === "analysing" ? (
                          <ReadingBars />
                        ) : (
                          <Dash />
                        )}
                      </span>
                      <span className="font-mono font-semibold text-amber-400">
                        {row.result ? (
                          row.result.camelot
                        ) : row.status === "analysing" ? (
                          <span className="sm:hidden">
                            <ReadingBars />
                          </span>
                        ) : (
                          <Dash />
                        )}
                      </span>
                      <span className="text-right font-mono tabular-nums text-text-primary">
                        {row.result ? (
                          <>
                            {row.bpmOverride !== null && (
                              <span
                                className="mr-1 inline-block h-1 w-1 rounded-full bg-amber-400 align-middle"
                                title="Tempo set by you"
                              />
                            )}
                            {bpmOf(row)}
                          </>
                        ) : (
                          <Dash />
                        )}
                      </span>
                      {row.status === "analysing" && (
                        <span className="absolute inset-x-0 bottom-0 h-px overflow-hidden" aria-hidden>
                          <span className="kf-scan block h-full w-1/4 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                        </span>
                      )}
                    </div>
                    {isOpen && openRow && (
                      <div className="border-t border-graphite-800 bg-graphite-950/50">
                        <RowDetail
                          row={openRow}
                          renamed={renames.get(openRow.id)}
                          others={rows}
                          onBpm={(bpm) => patch(openRow.id, { bpmOverride: bpm })}
                          onJump={(id) => {
                            setFilterCode(null);
                            setOpenId(id);
                          }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-xs leading-relaxed text-text-subtle">
            The CSV is the data for your library, and the ZIP holds the same files, untouched, renamed with their key
            and BPM in front.
          </p>
        </Section>
      )}

      <div className="border-t border-graphite-800 bg-graphite-950/40 p-4 sm:px-8 sm:py-5">
        {!started ? (
          <div className="space-y-2">
            <Button size="lg" className="w-full" disabled={!valid.length} onClick={() => void runQueue()}>
              <Play />
              Analyse {valid.length} {valid.length === 1 ? "file" : "files"}
            </Button>
            <p className="text-center text-xs text-text-subtle">
              {valid.length
                ? "They run one at a time, so the first result lands in seconds."
                : "None of these files can be read. Remove them or add others."}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {phase === "running" ? (
              <Button variant="outline" onClick={cancel}>
                <X />
                Cancel
              </Button>
            ) : (
              <Button variant="ghost" onClick={onReset}>
                <RotateCcw />
                Start over
              </Button>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadCsv} disabled={!done.length}>
                <Download />
                Download CSV
              </Button>
              <Button
                variant={phase === "finished" && done.length ? "primary" : "outline"}
                onClick={downloadZip}
                disabled={!done.length || zipPct !== null}
                aria-busy={zipPct !== null || undefined}
                className="min-w-[13.5rem]"
              >
                {zipPct !== null ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <FileArchive />}
                {zipPct !== null ? `Packing ${zipPct}%` : "Download renamed files"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}