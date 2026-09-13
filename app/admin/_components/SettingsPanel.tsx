"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  History,
  Loader2,
  Lock,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type SettingType = "bool" | "int" | "float" | "str";

interface SettingRow {
  key: string;
  group: string;
  type: SettingType;
  value: string | null;
  source: "db" | "env" | "default";
  env_value: string | null;
  overridden: boolean;
  min?: number | null;
  max?: number | null;
}

interface EnforcedSeparation {
  bucket: string;
  hourly_max: number;
  hourly_window: number;
  daily_max: number;
  daily_window: number;
}

interface SettingsPayload {
  settings: SettingRow[];
  locked: string[];
  slot?: unknown;
  enforced?: { separation: EnforcedSeparation | null };
}

interface AuditRow {
  id: number;
  key: string;
  old_value: string | null;
  new_value: string | null;
  action: string;
  actor: string;
  note: string;
  created_at: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { error?: string; message?: string; detail?: { message?: string } };
    throw new Error(
      b.detail?.message ?? b.message ?? b.error ?? `Request failed (${res.status})`
    );
  }
  return body as T;
}

function boundsLabel(row: SettingRow): string | null {
  const lo = row.min ?? null;
  const hi = row.max ?? null;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null) return `${lo} to ${hi}`;
  return lo !== null ? `min ${lo}` : `max ${hi}`;
}

// Client-side only. The backend trial-boots the whole Settings object and is the real judge.
function localError(row: SettingRow, raw: string): string | null {
  if (raw === "") return null;
  if (row.type === "bool") {
    return raw === "true" || raw === "false" ? null : "Must be true or false.";
  }
  if (row.type === "int" || row.type === "float") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return "Must be a number.";
    if (row.type === "int" && !Number.isInteger(n)) return "Must be a whole number.";
    if (row.min !== null && row.min !== undefined && n < row.min) return `Below the ${row.min} minimum.`;
    if (row.max !== null && row.max !== undefined && n > row.max) return `Above the ${row.max} maximum.`;
  }
  return null;
}

function windowLabel(seconds: number): string {
  if (seconds === 3600) return "an hour";
  if (seconds === 86400) return "a day";
  if (seconds === 60) return "a minute";
  if (seconds % 3600 === 0) return `${seconds / 3600} hours`;
  if (seconds % 60 === 0) return `${seconds / 60} minutes`;
  return `${seconds} seconds`;
}

function groupTitle(raw: string): string {
  const words = raw.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function shortTime(raw: string): string {
  const t = Date.parse(raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`);
  if (!Number.isFinite(t)) return raw;
  return new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EnforcedBand({ data }: { data: EnforcedSeparation }) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-none tracking-tight text-amber-300 tabular-nums">
          {data.hourly_max}
        </span>
        <span className="text-[12px] text-text-muted">separations {windowLabel(data.hourly_window)}</span>
      </div>
      <div className="h-6 w-px bg-amber-500/20" aria-hidden />
      <div className="flex items-baseline gap-2">
        <span className="text-[22px] font-semibold leading-none tracking-tight text-amber-300 tabular-nums">
          {data.daily_max}
        </span>
        <span className="text-[12px] text-text-muted">{windowLabel(data.daily_window)}</span>
      </div>
      <p className="min-w-0 flex-1 text-[11px] leading-snug text-text-subtle">
        In force right now across the four standard separation routes, after the limiter clamps on
        read. A stored value outside the published bounds still shows below, but it is not what runs.
      </p>
    </div>
  );
}

function Marker({ dirty, override }: { dirty: boolean; override: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-y-1 left-0 w-[2px] rounded-full transition-colors",
        dirty ? "bg-amber-400" : override ? "bg-amber-500/35" : "bg-transparent"
      )}
    />
  );
}

export function SettingsPanel({
  tick,
  onToast,
}: {
  tick: number;
  onToast: (tone: "ok" | "warn" | "bad", text: string) => void;
}) {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState<SettingRow | null>(null);
  const [query, setQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await call<SettingsPayload>("/api/admin/credits?view=settings");
      setData(payload);
      setDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const loadAudit = useCallback(async () => {
    try {
      const res = await call<{ entries: AuditRow[] }>(
        "/api/admin/credits?view=settings_audit&limit=50"
      );
      setAudit(res.entries ?? []);
    } catch (err) {
      onToast("bad", err instanceof Error ? err.message : "Couldn't load the change history.");
    }
  }, [onToast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (historyOpen) setHistoryOpen(false);
        else if (document.activeElement === searchRef.current) searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen]);

  const rows = useMemo(() => data?.settings ?? [], [data]);
  const locked = useMemo(() => new Set(data?.locked ?? []), [data]);

  const pending = useMemo(
    () =>
      Object.entries(draft).filter(([key, raw]) => {
        const row = rows.find((r) => r.key === key);
        return row ? raw !== (row.value ?? "") : false;
      }),
    [draft, rows]
  );

  const invalid = useMemo(
    () =>
      pending.filter(([key, raw]) => {
        const row = rows.find((r) => r.key === key);
        return row ? localError(row, raw) !== null : false;
      }),
    [pending, rows]
  );

  const dirtyKeys = useMemo(() => new Set(pending.map(([key]) => key)), [pending]);
  const overrideCount = useMemo(() => rows.filter((r) => r.overridden).length, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/[\s_-]+/g, "");
    return rows.filter((row) => {
      if (changedOnly && !row.overridden && !dirtyKeys.has(row.key)) return false;
      if (!q) return true;
      const hay = `${row.key}${row.group}`.toLowerCase().replace(/[\s_-]+/g, "");
      return hay.includes(q);
    });
  }, [rows, query, changedOnly, dirtyKeys]);

  const groups = useMemo(() => {
    const map = new Map<string, SettingRow[]>();
    for (const row of visible) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const allGroups = useMemo(() => {
    const map = new Map<string, { total: number; overridden: number }>();
    for (const row of rows) {
      const cur = map.get(row.group) ?? { total: 0, overridden: 0 };
      cur.total += 1;
      if (row.overridden) cur.overridden += 1;
      map.set(row.group, cur);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  function jumpTo(group: string) {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-group="${group}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save() {
    if (!pending.length || invalid.length) return;
    setSaving(true);
    try {
      const values: Record<string, string | null> = {};
      for (const [key, raw] of pending) values[key] = raw === "" ? null : raw;
      await call("/api/admin/credits?action=settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values, note }),
      });
      onToast("ok", `Saved ${pending.length} setting${pending.length === 1 ? "" : "s"}.`);
      setNote("");
      setAudit(null);
      await load();
    } catch (err) {
      onToast("bad", err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(row: SettingRow) {
    setClearing(row.key);
    setConfirmClear(null);
    try {
      await call(`/api/admin/credits?key=${encodeURIComponent(row.key)}`, { method: "DELETE" });
      onToast("ok", `Cleared ${row.key}.`);
      setAudit(null);
      await load();
    } catch (err) {
      onToast("bad", err instanceof Error ? err.message : "Couldn't clear that key.");
    } finally {
      setClearing(null);
    }
  }

  const enforced = data?.enforced?.separation ?? null;

  if (loading && !data) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-text-subtle">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-text-primary">
        <p className="font-medium">Settings didn&apos;t load.</p>
        <p className="mt-1 text-[12px] text-text-muted">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 h-8 rounded-lg border border-graphite-700 px-3 text-[12px] text-text-muted transition-colors hover:text-text-primary"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {enforced && <EnforcedBand data={enforced} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
            aria-hidden
          />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a key"
            aria-label="Find a setting key"
            className="h-9 w-full rounded-lg border border-graphite-800 bg-graphite-900/60 pl-9 pr-9 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-subtle focus:border-graphite-600"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-subtle transition-colors hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-graphite-700 px-1.5 py-0.5 text-[10px] text-text-subtle">
              /
            </kbd>
          )}
        </div>

        <button
          type="button"
          onClick={() => setChangedOnly((v) => !v)}
          aria-pressed={changedOnly}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] transition-colors",
            changedOnly
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-graphite-800 bg-graphite-900/60 text-text-muted hover:text-text-primary"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Changed only
          <span className="tabular-nums text-text-subtle">{overrideCount}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setHistoryOpen(true);
            if (!audit) void loadAudit();
          }}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-graphite-800 bg-graphite-900/60 px-3 text-[12px] text-text-muted transition-colors hover:text-text-primary"
        >
          <History className="h-3.5 w-3.5" aria-hidden />
          History
        </button>

        <p className="ml-auto hidden text-[11px] text-text-subtle sm:block">
          {visible.length} of {rows.length} keys
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-6">
        <aside className="hidden w-44 shrink-0 lg:block">
          <nav className="flex flex-col gap-0.5" aria-label="Setting groups">
            {allGroups.map(([group, stat]) => (
              <button
                key={group}
                type="button"
                onClick={() => jumpTo(group)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-text-muted outline-none transition-colors hover:bg-graphite-900 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                <span className="min-w-0 flex-1 truncate">{groupTitle(group)}</span>
                {stat.overridden > 0 && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
                )}
                <span className="shrink-0 tabular-nums text-[11px] text-text-subtle">{stat.total}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div
          ref={scrollRef}
          className="af-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pr-1"
        >
          {groups.length === 0 && (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-[12px] text-text-subtle">
              <p>Nothing matches that filter.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setChangedOnly(false);
                }}
                className="h-8 rounded-lg border border-graphite-700 px-3 text-text-muted transition-colors hover:text-text-primary"
              >
                Show every key
              </button>
            </div>
          )}

          {groups.map(([group, list]) => (
            <section key={group} data-group={group} className="scroll-mt-2">
              <h3 className="sticky top-0 z-10 -mx-1 mb-1 bg-graphite-950/90 px-1 py-2 text-[12px] font-medium text-text-primary backdrop-blur">
                {groupTitle(group)}
                <span className="ml-2 text-[11px] font-normal tabular-nums text-text-subtle">
                  {list.length}
                </span>
              </h3>

              <div className="mb-5 grid gap-x-8 xl:grid-cols-2">
                {list.map((row) => {
                  const current = draft[row.key] ?? row.value ?? "";
                  const dirty = current !== (row.value ?? "");
                  const problem = localError(row, current);
                  const bounds = boundsLabel(row);
                  const isLocked = locked.has(row.key);
                  return (
                    <div
                      key={row.key}
                      className={cn(
                        "relative flex items-center gap-4 border-b border-graphite-800/70 py-2.5 pl-3 pr-1 transition-colors",
                        dirty ? "bg-amber-500/[0.04]" : "hover:bg-graphite-900/40"
                      )}
                    >
                      <Marker dirty={dirty} override={row.overridden} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <code className="truncate font-mono text-[12.5px] text-text-primary">
                            {row.key}
                          </code>
                          {isLocked && (
                            <Lock
                              className="h-3 w-3 shrink-0 text-text-subtle"
                              aria-label="Locked, edit on the server"
                            />
                          )}
                          {row.source === "db" && !dirty && (
                            <span className="shrink-0 text-[10.5px] text-amber-400/90">override</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-text-subtle">
                          <span>{row.type}</span>
                          {bounds && <span>{bounds}</span>}
                          {row.env_value !== null && (
                            <span className="font-mono">env {row.env_value}</span>
                          )}
                        </div>
                        {problem && <p className="mt-1 text-[11px] text-red-400">{problem}</p>}
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {row.type === "bool" ? (
                          <select
                            value={current}
                            disabled={isLocked}
                            aria-label={row.key}
                            onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                            className={cn(
                              "h-8 w-28 rounded-lg border bg-graphite-950 px-2 text-[12px] text-text-primary outline-none transition-colors focus:border-graphite-600 disabled:opacity-40",
                              dirty ? "border-amber-500/60" : "border-graphite-800"
                            )}
                          >
                            <option value="">default</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            value={current}
                            disabled={isLocked}
                            aria-label={row.key}
                            inputMode={row.type === "str" ? "text" : "decimal"}
                            placeholder={row.env_value ?? "default"}
                            onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                            className={cn(
                              "h-8 w-28 rounded-lg border bg-graphite-950 px-2.5 font-mono text-[12px] text-text-primary outline-none transition-colors placeholder:font-sans placeholder:text-text-subtle focus:border-graphite-600 disabled:opacity-40",
                              problem
                                ? "border-red-500/60"
                                : dirty
                                  ? "border-amber-500/60"
                                  : "border-graphite-800"
                            )}
                          />
                        )}

                        {dirty ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => {
                                const next = { ...d };
                                delete next[row.key];
                                return next;
                              })
                            }
                            title="Undo this change"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite-800 text-text-subtle transition-colors hover:text-text-primary"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : row.overridden ? (
                          <button
                            type="button"
                            onClick={() => setConfirmClear(row)}
                            disabled={clearing === row.key}
                            title="Clear this override"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite-800 text-text-subtle transition-colors hover:text-text-primary disabled:opacity-40"
                          >
                            {clearing === row.key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        ) : (
                          <span className="h-8 w-8" aria-hidden />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {pending.length > 0 && (
        <div className="shrink-0 rounded-xl border border-amber-500/35 bg-graphite-900/95 p-2.5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 items-center gap-2 rounded-lg bg-amber-500/10 px-3 text-[12px] font-medium text-amber-300">
              <span className="tabular-nums">{pending.length}</span>
              change{pending.length === 1 ? "" : "s"} staged
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Why (optional, kept in the history)"
              className="h-8 min-w-0 flex-1 basis-56 rounded-lg border border-graphite-800 bg-graphite-950 px-2.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-subtle focus:border-graphite-600"
            />
            <button
              type="button"
              onClick={() => setDraft({})}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-graphite-700 px-3 text-[12px] text-text-muted transition-colors hover:text-text-primary"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || invalid.length > 0}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-4 text-[12px] font-semibold text-graphite-950 transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
              {saving ? "Saving" : "Save changes"}
            </button>
          </div>
          {invalid.length > 0 && (
            <p className="mt-2 pl-1 text-[11px] text-red-400">
              Fix the highlighted values first. Nothing is written unless every key passes.
            </p>
          )}
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setHistoryOpen(false)}
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
          />
          <div className="af-scroll relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-graphite-800 bg-graphite-900 shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-graphite-800 bg-graphite-900/95 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-sm font-medium text-text-primary">Change history</p>
                <p className="text-[11px] text-text-subtle">Last 50 edits to runtime config</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close history"
                className="rounded-lg p-1.5 text-text-subtle transition-colors hover:text-text-primary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {audit === null ? (
              <div className="flex flex-1 items-center justify-center text-text-subtle">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </div>
            ) : audit.length === 0 ? (
              <p className="px-4 py-6 text-[12px] text-text-subtle">
                Nothing recorded yet. Edits made here show up in this list.
              </p>
            ) : (
              <ul className="divide-y divide-graphite-800">
                {audit.map((entry) => (
                  <li key={entry.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <code className="min-w-0 truncate font-mono text-[12px] text-text-primary">
                        {entry.key}
                      </code>
                      <span className="shrink-0 text-[10.5px] text-text-subtle">
                        {shortTime(entry.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11.5px]">
                      <span className="text-text-subtle line-through">
                        {entry.old_value ?? "default"}
                      </span>
                      <span className="text-text-subtle">to</span>
                      <span className="text-amber-300">{entry.new_value ?? "default"}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-text-subtle">
                      {entry.action} by {entry.actor}
                    </p>
                    {entry.note && (
                      <p className="mt-1.5 border-l border-graphite-700 pl-2 text-[11px] leading-snug text-text-muted">
                        {entry.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setConfirmClear(null)}
            className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
          />
          <div className="relative w-full max-w-md rounded-xl border border-graphite-700 bg-graphite-900 p-5 shadow-2xl">
            <p className="font-medium text-text-primary">Clear {confirmClear.key}?</p>
            <p className="mt-2 text-[13px] text-text-muted">
              {confirmClear.env_value !== null
                ? `It reverts to the environment value, ${confirmClear.env_value}.`
                : "It reverts to the code default."}
            </p>
            {confirmClear.env_value !== null && confirmClear.env_value !== confirmClear.value && (
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <p className="text-[12px] leading-snug text-text-primary">
                  That is not the value in force now ({confirmClear.value}). If the override was the
                  intended number, update the environment variable before clearing this.
                </p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(null)}
                className="h-8 rounded-lg border border-graphite-700 px-3 text-[12px] text-text-muted transition-colors hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void clearKey(confirmClear)}
                className="h-8 rounded-lg bg-amber-500 px-3 text-[12px] font-semibold text-graphite-950 transition-opacity hover:opacity-90"
              >
                Clear it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}