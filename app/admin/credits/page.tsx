"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Coins,
  Loader2,
  RefreshCw,
  Search,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * CREDITS OPS.
 *
 * The reason this page exists is a promise already printed on every Ko-fi
 * listing: "Balance not updated after a couple of minutes? Message me, I'll fix
 * it by hand." Until now, "by hand" meant SSH and SQL against a live ledger.
 * The Lookup + Adjust panel below is that promise, made keyboard-shaped.
 *
 * WHAT IS AND ISN'T TYPED HERE
 *
 * The contract for POST /admin/credits/adjust is known exactly, so it gets a
 * real form with real validation. The response shapes for overview, costs,
 * jobs, lookup and webhooks are NOT documented yet, so they render through a
 * resilient viewer instead of a table built on guessed field names — a table
 * keyed on fields that don't exist renders blank and looks like "no data",
 * which is the worst possible failure for an ops screen. Swap each one for a
 * real table as its shape is confirmed.
 *
 * AUTH: the route handler behind this calls requireAdmin() and answers 404 to
 * anyone without a valid admin_session. A 404 here means either you are logged
 * out, or BACKEND_CREDITS_ADMIN_TOKEN is wrong/unset — the backend returns 404
 * rather than 403 for a bad token by design, so those two are indistinguishable
 * from the browser. Check the env var before hunting a routing bug.
 */

type View = "overview" | "lookup" | "webhooks" | "costs" | "jobs";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "lookup", label: "Find a customer", hint: "The 'I paid and got nothing' screen" },
  { id: "webhooks", label: "Webhooks", hint: "Payments that never matched an account" },
  { id: "overview", label: "Overview", hint: "Paywall state, liability, unit economics" },
  { id: "costs", label: "Costs", hint: "Day × tool: jobs, GPU seconds, dollars" },
  { id: "jobs", label: "Recent jobs", hint: "Cost joined to billing outcome" },
];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, { cache: "no-store", ...init });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON — surfaced raw */
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

export default function AdminCreditsPage() {
  const [view, setView] = useState<View>("lookup");

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2.5">
        <Coins className="h-5 w-5 text-amber-400" aria-hidden />
        <h1 className="text-lg font-semibold text-text-primary">Credits</h1>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Credits views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            title={v.hint}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-amber-400/70",
              view === v.id
                ? "border-amber-500/60 bg-amber-500/[0.07] text-amber-400"
                : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
            )}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {view === "lookup" ? (
        <LookupPanel />
      ) : (
        <ReadPanel
          key={view}
          view={view}
          extra={view === "webhooks" ? { unprocessed_only: "true" } : undefined}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lookup + adjust — the one that matters                              */
/* ------------------------------------------------------------------ */

function LookupPanel() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (address: string) => {
    const trimmed = address.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api(`/api/admin/credits?view=lookup&email=${encodeURIComponent(trimmed)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(email);
        }}
        className="flex flex-wrap gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
            aria-hidden
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email they paid with"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-lg border border-graphite-700 bg-graphite-850 pl-10 pr-3 text-sm text-text-primary outline-none placeholder:text-text-subtle focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-graphite-950 outline-none transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
        </button>
      </form>

      {error && <ErrorNote message={error} />}
      {result !== null && <JsonView data={result} label="Account" />}

      <AdjustForm
        email={email}
        onApplied={() => {
          void lookup(email);
        }}
      />
    </div>
  );
}

function AdjustForm({ email, onApplied }: { email: string; onApplied: () => void }) {
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const parsed = Number(delta);
  const validDelta = Number.isInteger(parsed) && parsed !== 0 && Math.abs(parsed) <= 1000;
  const validNote = note.trim().length >= 3 && note.trim().length <= 200;
  const ready = Boolean(email.trim()) && validDelta && validNote && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = (await api("/api/admin/credits?action=adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), delta: parsed, note: note.trim() }),
      })) as { applied?: boolean; balance?: number };

      // `applied: false` is a SAFE REPLAY, not a failure — the idempotency key
      // already existed and nothing was written twice. Saying "done" for both
      // would let someone click three times and believe they granted 30.
      setDone(
        res.applied === false
          ? `Already applied earlier — nothing written twice. Balance is ${res.balance ?? "?"}.`
          : `Applied. Balance is now ${res.balance ?? "?"}.`
      );
      setDelta("");
      setNote("");
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Adjust balance</h2>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          Writes a new ledger row against{" "}
          <span className="text-text-primary">{email.trim() || "the email above"}</span>. The
          ledger is append-only, so a negative delta adds a −N entry rather than undoing a
          grant — both stay visible in the lookup. Creates the account if the email is
          unknown, which is the normal case for a payment the webhook never matched.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="delta, e.g. 10"
          className="h-11 w-36 rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-sm tabular-nums text-text-primary outline-none placeholder:text-text-subtle focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="note — why? e.g. Ko-fi order #1234, webhook never fired"
          className="h-11 min-w-0 flex-1 rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-sm text-text-primary outline-none placeholder:text-text-subtle focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/20"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready}
          className="h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-graphite-950 outline-none transition-colors hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </button>
      </div>

      {/*
        The note is REQUIRED and deliberately has no default. Six months from
        now an unexplained +30 is indistinguishable from a bug, and the only
        person who can tell is whoever made it today. Pre-filling this with
        "manual adjustment" would defeat the entire reason the field exists.
      */}
      <p className="text-[11px] leading-relaxed text-text-subtle">
        Note is required, 3–200 characters. Delta is a non-zero integer between −1000 and
        1000. Write what a stranger would need to understand this entry a year from now.
      </p>

      {error && <ErrorNote message={error} />}
      {done && (
        <p className="flex items-start gap-2 text-xs text-teal-400" role="status">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {done}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Read views                                                          */
/* ------------------------------------------------------------------ */

function ReadPanel({ view, extra }: { view: View; extra?: Record<string, string> }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState("30");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view, ...(extra ?? {}) });
      if (view === "costs") params.set("days", days);
      if (view === "jobs") params.set("limit", "100");
      const next = await api(`/api/admin/credits?${params.toString()}`);
      if (signal?.aborted) return;
      setData(next);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Request failed.");
      setData(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
    // `extra` is a literal from the parent and stable per view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, days]);

  /*
    The fetch is kicked off from an effect, but every setState it performs
    happens AFTER an await — never synchronously in the effect body, which is
    what react-hooks/set-state-in-effect actually rejects. The abort signal is
    what makes that safe: switching view mid-request would otherwise let a
    stale response overwrite the new one.
  */
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {view === "costs" && (
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="h-9 rounded-lg border border-graphite-700 bg-graphite-850 px-2 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-amber-500/20"
          >
            {["7", "30", "90"].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-850 px-3 text-sm text-text-muted outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </button>
        {view === "webhooks" && (
          <span className="flex items-center gap-1.5 text-xs text-text-subtle">
            <Webhook className="h-3.5 w-3.5" aria-hidden />
            Unprocessed only — these are payments that never reached an account.
          </span>
        )}
      </div>

      {error && <ErrorNote message={error} />}
      {loading && !data && (
        <p className="flex items-center gap-2 text-sm text-text-subtle">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </p>
      )}
      {data !== null && <JsonView data={data} label={view} />}
    </div>
  );
}

/**
 * Renders whatever the endpoint returned, without assuming a shape.
 *
 * Deliberately not a table. These five responses aren't documented yet, and a
 * table keyed on guessed field names renders blank rows — which on an ops
 * screen reads as "no data" and sends someone chasing a backend problem that
 * doesn't exist. Raw and correct beats pretty and wrong. Replace per view as
 * each shape is confirmed.
 */
function JsonView({ data, label }: { data: unknown; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
      <div className="border-b border-graphite-800 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
          {label}
        </span>
      </div>
      <pre className="max-h-[32rem] overflow-auto p-4 text-xs leading-relaxed text-text-muted">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-3 text-xs leading-relaxed text-text-primary"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
      {message}
    </p>
  );
}