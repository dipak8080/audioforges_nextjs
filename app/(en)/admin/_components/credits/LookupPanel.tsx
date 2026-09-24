"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Coins, Search, ShieldCheck, Users, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PACK_CREDITS } from "./credits-types";
import type { Rec } from "./credits-types";
import { api, msg } from "./credits-net";
import type { Toast } from "./CreditsUi";
import { num, prettyLabel } from "./credits-format";
import { Card, SectionLabel, Stat, Button, inputClass, CopyButton, Badge, Empty, ErrorNote, Skeleton, DataScroll, Th, Td, Tr, Table, FieldValue, FieldGrid } from "./CreditsUi";

/* ------------------------------------------------------------------ */
/* lookup                                                              */
/* ------------------------------------------------------------------ */

export const KNOWN_ACCOUNT_KEYS = ["balance", "free_remaining", "held_credits", "ledger"];

export function LookupPanel({
  onToast,
  onChanged,
  preset = null,
}: {
  onToast: (tone: Toast["tone"], text: string) => void;
  onChanged: () => void;
  preset?: string | null;
}) {
  const [email, setEmail] = useState(preset ?? "");
  const [subject, setSubject] = useState("");
  const [result, setResult] = useState<Rec | null>(null);
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
      const data = await api<Rec>(`/api/admin/credits?view=lookup&email=${encodeURIComponent(trimmed)}`);
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

  useEffect(() => {
    if (preset) void lookup(preset);
  }, [preset, lookup]);

  const target = (email.trim() || subject).toLowerCase();
  const stale = Boolean(subject) && Boolean(email.trim()) && email.trim().toLowerCase() !== subject;

  const pickNum = (k: string) =>
    result && typeof result[k] === "number" ? (result[k] as number) : undefined;
  const stats = [
    { label: "Balance", value: pickNum("balance"), tone: "accent" as const, icon: Coins },
    { label: "Free left", value: pickNum("free_remaining"), tone: "plain" as const, icon: Zap },
    { label: "Held", value: pickNum("held_credits"), tone: "plain" as const, icon: Clock },
  ].filter((s) => s.value !== undefined);

  const ledger = result && Array.isArray(result.ledger) ? (result.ledger as Rec[]) : null;

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
      {/* left: search + balances fixed, ledger scrolls */}
      <div className="flex min-h-0 flex-col gap-3">
        <Card className="shrink-0 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void lookup(email);
            }}
            className="flex flex-wrap gap-2"
          >
            <div className="relative min-w-0 flex-1 basis-56">
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
                className={cn(inputClass, "h-10 pl-10 pr-9")}
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
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-text-subtle">Recent</span>
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

        {result && (
          <div className="shrink-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <SectionLabel>Showing</SectionLabel>
              <span className="group inline-flex min-w-0 items-center gap-1 font-mono text-xs text-text-muted">
                <span className="truncate">{subject}</span>
                <CopyButton value={subject} label="Copy email" />
              </span>
              {stale && <Badge tone="accent">Search box changed. Press Look up</Badge>}
              <button
                type="button"
                onClick={() => {
                  setEmail("");
                  reset();
                }}
                className="rounded text-[11px] text-text-subtle underline-offset-2 outline-none hover:text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                Clear
              </button>
            </div>
            {stats.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {stats.map((s) => (
                  <Stat key={s.label} label={s.label} value={num(s.value)} tone={s.tone} icon={s.icon} />
                ))}
              </div>
            )}
          </div>
        )}

        {loading && !result ? (
          <DataScroll className="p-3">
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          </DataScroll>
        ) : !result ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {!error && (
              <Empty
                icon={Users}
                title="Search an account to begin"
                body="Enter the email from the order. You can grant credits on the right without searching first. An unknown email creates the account."
              />
            )}
          </div>
        ) : (
          <DataScroll>
            {ledger && ledger.length > 0 ? (
              <LedgerTable rows={ledger} />
            ) : (
              <p className="px-4 py-8 text-center text-xs text-text-subtle">
                No ledger entries on this account yet.
              </p>
            )}

            <div className="border-t border-graphite-800 p-4">
              <SectionLabel>Account record</SectionLabel>
              <div className="mt-3">
                <FieldGrid data={result} omit={KNOWN_ACCOUNT_KEYS} />
              </div>
            </div>
          </DataScroll>
        )}
      </div>

      {/* right: grant panel, always visible, never scrolled past */}
      <AdjustForm
        email={target}
        onToast={onToast}
        onApplied={() => {
          void lookup(target);
          onChanged();
        }}
      />
    </div>
  );
}

export function LedgerTable({ rows }: { rows: Rec[] }) {
  const cols = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => seen.add(k)));
    const preferred = ["created_at", "delta", "balance_after", "reason", "note", "source"];
    const ordered = preferred.filter((p) => seen.has(p));
    return [...ordered, ...[...seen].filter((k) => !ordered.includes(k))].slice(0, 7);
  }, [rows]);

  return (
    <Table>
      <thead>
        <tr>
          {cols.map((c) => (
            <Th key={c} right={c === "delta" || c === "balance_after"}>
              {prettyLabel(c)}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <Tr key={i}>
            {cols.map((c) => {
              const v = r[c];
              if (c === "delta" && typeof v === "number") {
                return (
                  <Td key={c} right className={v > 0 ? "font-medium text-teal-400" : "font-medium text-red-400"}>
                    {v > 0 ? "+" : ""}
                    {v}
                  </Td>
                );
              }
              return (
                <Td
                  key={c}
                  right={c === "balance_after"}
                  className={cn("max-w-[18rem] truncate", c === "created_at" && "whitespace-nowrap")}
                >
                  <FieldValue name={c} value={v} />
                </Td>
              );
            })}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/**
 * Always mounted, never behind a search. Granting credits to an email the
 * webhook never matched is the whole reason this screen exists, and that email
 * has no account to look up yet.
 */
export function AdjustForm({
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
      const res = await api<{ applied?: boolean; balance?: number }>("/api/admin/credits?action=adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: target, delta: parsed, note: note.trim() }),
      });

      // `applied: false` is a safe replay — the idempotency key already existed
      // and nothing was written twice. Reporting both as "done" would let
      // someone click three times and believe they granted 30.
      if (res.applied === false) {
        onToast("warn", `Already applied earlier. Nothing written twice. Balance is ${res.balance ?? "?"}.`);
      } else {
        onToast("ok", `Applied ${parsed > 0 ? "+" : ""}${parsed} to ${target}. Balance is now ${res.balance ?? "?"}.`);
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
    <Card className="af-scroll flex min-h-0 flex-col overflow-y-auto border-amber-500/25 bg-amber-500/[0.05] p-4">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Grant or remove credits</h2>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Writes an append-only ledger row. A negative delta adds a −N entry rather than undoing a
            grant. An unknown email creates the account.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-graphite-800 bg-graphite-950/50 px-3 py-2">
        <SectionLabel>Applying to</SectionLabel>
        <p className={cn("mt-0.5 truncate font-mono text-[12px]", validEmail ? "text-amber-300" : "text-text-subtle")}>
          {target || "Type an email in the search box"}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] text-text-subtle">Credit packs</span>
        {PACK_CREDITS.map((p) => (
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
          placeholder="Credits, e.g. 30"
          aria-label="Credit delta"
          className={cn(inputClass, "h-10 px-3 tabular-nums")}
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Note, e.g. order id or reason"
          aria-label="Adjustment note"
          className={cn(inputClass, "h-10 px-3")}
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
        {!validEmail && <p>Enter the customer email to enable this.</p>}
        <p className={cn(delta && !validDelta && "text-red-400")}>Non-zero integer, −1000 to 1000.</p>
        <p className={cn(note && !validNote && "text-red-400")}>Note 3–200 characters ({note.trim().length}).</p>
        {confirming && <p className="text-red-400">Removing credits. Confirm to write it.</p>}
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