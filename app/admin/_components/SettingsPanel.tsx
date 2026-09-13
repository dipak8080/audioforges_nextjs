"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, Loader2, RotateCcw, Save, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Runtime config, read from and written to the backend settings table.
 *
 * EVERYTHING HERE COMES OFF THE WIRE. Keys, types, groups and bounds are all
 * fields on the payload, never a TS mirror of the backend's KNOWN_KEYS. Adding
 * a knob on the backend surfaces it here with no frontend change, which is the
 * whole reason those fields are published.
 */

type SettingType = "bool" | "int" | "float" | "str";

interface SettingRow {
  key: string;
  group: string;
  type: SettingType;
  /** Effective value, or null when the key falls through to the code default. */
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
    // The backend names the exact reason a value was refused. Show it rather
    // than a generic failure: "below the 60 minimum" is actionable and
    // "couldn't save" is not.
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

/** Client-side check only. The backend trial-boots the whole Settings object
 *  and is the real judge; this exists to catch a typo before a round trip. */
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

function Badge({ source }: { source: SettingRow["source"] }) {
  const tone =
    source === "db"
      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
      : source === "env"
        ? "border-graphite-700 bg-graphite-800 text-text-muted"
        : "border-graphite-800 bg-graphite-900 text-text-subtle";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase", tone)}>
      {source}
    </span>
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
  const [auditOpen, setAuditOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState<SettingRow | null>(null);

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
      onToast("bad", err instanceof Error ? err.message : "Couldn't load the audit trail.");
    }
  }, [onToast]);

  // Memoised so the derived lists below have a stable dependency; a fresh
  // array literal per render recomputes all of them on every keystroke.
  const rows = useMemo(() => data?.settings ?? [], [data]);
  const locked = useMemo(() => new Set(data?.locked ?? []), [data]);

  const groups = useMemo(() => {
    const map = new Map<string, SettingRow[]>();
    for (const row of rows) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

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
      <div className="flex flex-1 items-center justify-center text-text-subtle">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-4 text-sm text-text-primary">
        {error}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-24">
      {enforced && (
        <section className="rounded-2xl border border-graphite-800 bg-graphite-900/70 p-4">
          <p className="text-[12px] font-medium text-text-subtle">Separation limits in force</p>
          <p className="mt-1.5 text-sm text-text-primary">
            {enforced.hourly_max} per {enforced.hourly_window}s and {enforced.daily_max} per{" "}
            {enforced.daily_window}s, shared across the four standard separation routes.
          </p>
          <p className="mt-1.5 text-[11px] leading-snug text-text-subtle">
            This is what the limiter applies after its read-time clamp. A stored row outside the
            published bounds is shown below but is not what gets enforced.
          </p>
        </section>
      )}

      {groups.map(([group, list]) => (
        <section key={group} className="rounded-2xl border border-graphite-800 bg-graphite-900/70">
          <p className="border-b border-graphite-800 px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide text-text-subtle">
            {group}
          </p>
          <div className="divide-y divide-graphite-800">
            {list.map((row) => {
              const current = draft[row.key] ?? row.value ?? "";
              const dirty = current !== (row.value ?? "");
              const problem = localError(row, current);
              const bounds = boundsLabel(row);
              const isLocked = locked.has(row.key);
              return (
                <div key={row.key} className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-[12px] text-text-primary">{row.key}</code>
                      <Badge source={row.source} />
                      {isLocked && (
                        <span className="rounded border border-graphite-700 bg-graphite-800 px-1.5 py-0.5 text-[10px] uppercase text-text-subtle">
                          locked
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-text-subtle">
                      {row.type}
                      {bounds ? ` · ${bounds}` : ""}
                      {row.env_value !== null ? ` · env ${row.env_value}` : " · no env value"}
                    </p>
                    {problem && <p className="mt-1 text-[11px] text-red-400">{problem}</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {row.type === "bool" ? (
                      <select
                        value={current}
                        disabled={isLocked}
                        onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                        className="h-8 rounded-lg border border-graphite-700 bg-graphite-950 px-2 text-[12px] text-text-primary disabled:opacity-40"
                      >
                        <option value="">default</option>
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        value={current}
                        disabled={isLocked}
                        inputMode={row.type === "str" ? "text" : "decimal"}
                        placeholder={row.env_value ?? "default"}
                        onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                        className={cn(
                          "h-8 w-36 rounded-lg border bg-graphite-950 px-2 text-[12px] text-text-primary disabled:opacity-40",
                          problem ? "border-red-500/60" : dirty ? "border-amber-500/60" : "border-graphite-700"
                        )}
                      />
                    )}
                    {row.overridden && (
                      <button
                        type="button"
                        onClick={() => setConfirmClear(row)}
                        disabled={clearing === row.key}
                        title="Clear this override"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-graphite-700 text-text-subtle hover:text-text-primary disabled:opacity-40"
                      >
                        {clearing === row.key ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-graphite-800 bg-graphite-900/70">
        <button
          type="button"
          onClick={() => {
            setAuditOpen((v) => !v);
            if (!audit) void loadAudit();
          }}
          className="flex w-full items-center gap-2 px-4 py-3 text-[12px] font-medium text-text-muted hover:text-text-primary"
        >
          <History className="h-3.5 w-3.5" aria-hidden />
          Change history
        </button>
        {auditOpen && (
          <div className="divide-y divide-graphite-800 border-t border-graphite-800">
            {(audit ?? []).map((entry) => (
              <div key={entry.id} className="px-4 py-2.5 text-[11px] text-text-muted">
                <code className="text-text-primary">{entry.key}</code>{" "}
                {entry.old_value ?? "default"} to {entry.new_value ?? "default"} · {entry.action} ·{" "}
                {entry.actor} · {entry.created_at}
                {entry.note ? ` · ${entry.note}` : ""}
              </div>
            ))}
            {audit !== null && audit.length === 0 && (
              <p className="px-4 py-3 text-[11px] text-text-subtle">Nothing recorded yet.</p>
            )}
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <div className="sticky bottom-0 rounded-2xl border border-amber-500/40 bg-graphite-950/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[12px] text-text-primary">
              {pending.length} change{pending.length === 1 ? "" : "s"} staged
            </p>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Why (optional, kept in the audit trail)"
              className="h-8 min-w-0 flex-1 rounded-lg border border-graphite-700 bg-graphite-950 px-2 text-[12px] text-text-primary"
            />
            <button
              type="button"
              onClick={() => setDraft({})}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-graphite-700 px-3 text-[12px] text-text-muted hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || invalid.length > 0}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-[12px] font-medium text-graphite-950 disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="h-3.5 w-3.5" aria-hidden />
              )}
              Save
            </button>
          </div>
          {invalid.length > 0 && (
            <p className="mt-2 text-[11px] text-red-400">
              Fix the highlighted values before saving. Nothing is written unless every key passes.
            </p>
          )}
        </div>
      )}

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite-950/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-graphite-800 bg-graphite-900 p-5">
            <p className="font-medium text-text-primary">Clear {confirmClear.key}?</p>
            {/*
              The revert target, spelled out. A key whose env value differs from
              the override is the case that bites: clearing it does not go back
              to "the sensible number", it goes back to whatever env says, which
              may be the value someone deliberately moved away from.
            */}
            <p className="mt-2 text-sm text-text-muted">
              {confirmClear.env_value !== null
                ? `It will revert to the environment value, ${confirmClear.env_value}.`
                : "It will revert to the code default."}
            </p>
            {confirmClear.env_value !== null && confirmClear.env_value !== confirmClear.value && (
              <div className="mt-3 flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <p className="text-[12px] leading-snug text-text-primary">
                  That is not the value in force now ({confirmClear.value}). If the override was
                  the intended number, update the environment variable before clearing this.
                </p>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(null)}
                className="h-8 rounded-lg border border-graphite-700 px-3 text-[12px] text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void clearKey(confirmClear)}
                className="h-8 rounded-lg bg-amber-500 px-3 text-[12px] font-medium text-graphite-950"
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