import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { LIMITS_CACHE_TAG } from "@/lib/api/limits";

/**
 * Proxy for the backend's credits admin surface.
 *
 * TWO SECRETS, NOT ONE. The existing admin routes send `BACKEND_ADMIN_KEY`.
 * The credits endpoints want a DIFFERENT token in a DIFFERENT header:
 * `X-Admin-Token: $CREDITS_ADMIN_TOKEN`. Reusing the wrong one fails silently
 * — see below.
 *
 * WRITES CAN COME BACK 409 `not_active_slot`, AND THAT IS NOT A FAILURE TO
 * HIDE. Deploys are blue/green and both containers mount the same credits.db,
 * so the draining one refuses config writes and names the live slot in the
 * message. forward() passes it through untouched: collapsing it into a generic
 * error would throw away the only sentence that tells the operator what to do.
 *
 * A WRONG OR UNSET TOKEN RETURNS 404, NOT 403. That is deliberate on the
 * backend: a 403 confirms the path exists and is worth attacking, so an
 * unconfigured admin surface is invisible rather than merely locked. The
 * consequence for debugging is that "404" from any of these means either the
 * token is wrong, or CREDITS_ADMIN_TOKEN is unset on the backend, and there is
 * no way to tell those apart from out here. Check the env var first.
 */

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
/** Frontend-side name is ours to choose; the backend only ever sees the header. */
const CREDITS_TOKEN = process.env.BACKEND_CREDITS_ADMIN_TOKEN;

/** Read-only views. Anything not on this list is rejected rather than
 *  forwarded — an open path parameter into an admin API is a hole. */
const READ_VIEWS = {
  overview: "/admin/credits/overview",
  costs: "/admin/credits/costs",
  jobs: "/admin/credits/jobs",
  lookup: "/admin/credits/users/lookup",
  webhooks: "/admin/credits/webhooks",
  /** One row per paid order with whether the buyer reached their credits. */
  orders: "/admin/credits/orders",
  /**
   * The valid values for the jobs filters, served by the backend.
   *
   * Populate the dropdowns from THIS, never a TS constant. This codebase has
   * had four separate hand-maintained "which tools exist" lists drift out of
   * sync in a single week; a fifth living in a React component is not worth
   * adding.
   */
  filters: "/admin/credits/jobs/filters",
  /** Paywall funnel — migration 005. `gate` is the summary, `gate_daily` the trend. */
  gate: "/admin/credits/gate",
  gate_daily: "/admin/credits/gate/daily",
  /**
   * Runtime config. `settings` carries every tunable key with its effective
   * value, its source (db / env / default), the locked list, the deploy slot,
   * and `enforced.separation` — what the limiter is ACTUALLY applying after
   * its read-time clamp, which can differ from the row when a legacy or
   * out-of-range value is stored.
   *
   * Render the panel from this payload, never from a TS mirror of
   * KNOWN_KEYS. It carries `type` and `group` per key for exactly that.
   */
  /** Insights view: attribution, free-tier concentration, monthly net. */
  sources: "/admin/credits/sources",
  abuse: "/admin/credits/abuse",
  monthly: "/admin/credits/monthly",
  settings: "/admin/credits/settings",
  settings_audit: "/admin/credits/settings/audit",
} as const;

/** Writes. `adjust` is the ONLY one that touches the ledger. */
const WRITE_ACTIONS = {
  adjust: "/admin/credits/adjust",
  sweep: "/admin/credits/sweep",
} as const;

type ReadView = keyof typeof READ_VIEWS;
type WriteAction = keyof typeof WRITE_ACTIONS;

function misconfigured() {
  return NextResponse.json(
    {
      error:
        "Credits admin isn't configured. Set BACKEND_CREDITS_ADMIN_TOKEN to the backend's CREDITS_ADMIN_TOKEN.",
    },
    { status: 500 }
  );
}

/** The backend answers 404 for a bad token. Say so, because the alternative is
 *  someone hunting a routing bug that doesn't exist. */
async function forward(res: Response) {
  const body = await res.text();
  if (res.status === 404) {
    return NextResponse.json(
      {
        error:
          "Backend returned 404. For /admin/credits/* that usually means the admin token is wrong or CREDITS_ADMIN_TOKEN is unset on the backend — the surface returns 404 rather than 403 by design.",
        upstream: body.slice(0, 500),
      },
      { status: 404 }
    );
  }
  return new NextResponse(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!CREDITS_TOKEN) return misconfigured();

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") as ReadView | null;
  if (!view || !(view in READ_VIEWS)) {
    return NextResponse.json(
      { error: `Unknown view. Expected one of: ${Object.keys(READ_VIEWS).join(", ")}` },
      { status: 400 }
    );
  }

  const url = new URL(`${BACKEND_BASE}${READ_VIEWS[view]}`);
  // Allow-listed passthrough only. Forwarding the whole query string would let
  // a caller reach parameters this proxy has never seen.
  for (const key of [
    "days",
    "months",
    "limit",
    "offset",
    "email",
    "unprocessed_only",
    "date_from",
    "date_to",
    "has_account",
    // Jobs filters. `email` is the one that matters for support: /users/lookup
    // returns a customer's charges but not their GPU costs or failure reasons,
    // so "they say it failed twice, what happened?" used to take two endpoints
    // and a manual join.
    "tool",
    "status",
    "charge_type",
    // settings_audit only. FastAPI ignores query params a route doesn't
    // declare, so this is inert on the other views.
    "key",
  ]) {
    const value = searchParams.get(key);
    if (value !== null) url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url, {
      headers: { "X-Admin-Token": CREDITS_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return forward(res);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the backend." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!CREDITS_TOKEN) return misconfigured();

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") as WriteAction | null;
  if (!action || !(action in WRITE_ACTIONS)) {
    return NextResponse.json(
      { error: `Unknown action. Expected one of: ${Object.keys(WRITE_ACTIONS).join(", ")}` },
      { status: 400 }
    );
  }

  let body: unknown = {};
  if (action === "adjust") {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
    }

    /**
     * Validated HERE as well as on the backend, because the failure modes are
     * expensive and the backend's 422 is a Pydantic dump rather than something
     * an operator can act on.
     *
     * `note` is REQUIRED and is never defaulted. The ledger is append-only, so
     * six months from now an unexplained +30 is indistinguishable from a bug,
     * and the only person who can tell is whoever made it today. Defaulting
     * this to "manual adjustment" would defeat the entire reason it exists.
     */
    const b = body as { email?: unknown; delta?: unknown; note?: unknown };
    const email = typeof b.email === "string" ? b.email.trim() : "";
    const note = typeof b.note === "string" ? b.note.trim() : "";
    const delta = typeof b.delta === "number" ? b.delta : NaN;

    if (!email || email.length > 254 || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (!Number.isInteger(delta) || delta < -1000 || delta > 1000 || delta === 0) {
      return NextResponse.json(
        { error: "delta must be a non-zero integer between -1000 and 1000." },
        { status: 400 }
      );
    }
    if (note.length < 3 || note.length > 200) {
      return NextResponse.json(
        { error: "note is required, 3–200 characters. Say what this adjustment is for." },
        { status: 400 }
      );
    }
    // Lowercased server-side too, but normalising here keeps the echoed
    // response consistent with what the operator sees in the lookup panel.
    body = { email: email.toLowerCase(), delta, note };
  }

  try {
    const res = await fetch(`${BACKEND_BASE}${WRITE_ACTIONS[action]}`, {
      method: "POST",
      headers: {
        "X-Admin-Token": CREDITS_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    return forward(res);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the backend." }, { status: 502 });
  }
}

/**
 * Purge the cached GET /limits after a settings change.
 *
 * Called in-process rather than by POSTing /api/revalidate-limits: same app,
 * same tag, so the HTTP hop and its shared token buy nothing here. That route
 * still exists for changes made outside this panel — a curl straight at the
 * backend, or a settings row written by anything that isn't this proxy.
 *
 * Fired on ANY successful settings write, not just the separation keys.
 * /limits publishes durations, upload ceilings and per-tool numbers that also
 * resolve through settings, and working out which of fifty keys moved one of
 * them is a guess this does not need to make.
 */
function purgeLimitsCache() {
  try {
    revalidateTag(LIMITS_CACHE_TAG, { expire: 0 });
  } catch {
    // A failed purge means pages serve the old number until the ISR window
    // rolls. That is the pre-existing behaviour, not a reason to fail a write
    // the backend already committed.
  }
}

/**
 * PUT /api/admin/credits?action=settings — set or clear overrides.
 *
 * Body is the backend's shape: `{ values: {KEY: value|null}, note }`. A null
 * value clears that key back to env or code default.
 *
 * TYPES ARE NOT VALIDATED HERE. The backend runs a trial build of the whole
 * Settings object and rejects the batch if any key would fail a boot
 * invariant, which is a check this side cannot reproduce and must not
 * second-guess. Only the shape and the two batch limits are enforced early,
 * because those produce a clearer message than a Pydantic dump.
 */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!CREDITS_TOKEN) return misconfigured();

  const { searchParams } = new URL(request.url);
  if (searchParams.get("action") !== "settings") {
    return NextResponse.json(
      { error: "Unknown action. Expected: settings" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const b = body as { values?: unknown; note?: unknown };
  if (!b.values || typeof b.values !== "object" || Array.isArray(b.values)) {
    return NextResponse.json(
      { error: "values must be an object of KEY to value, or null to clear." },
      { status: 400 }
    );
  }

  const values = b.values as Record<string, unknown>;
  const keys = Object.keys(values);
  if (keys.length === 0) {
    return NextResponse.json({ error: "values is empty, nothing to change." }, { status: 400 });
  }
  if (keys.length > 50) {
    return NextResponse.json(
      { error: "At most 50 keys per change. Split the batch." },
      { status: 400 }
    );
  }
  const badKey = keys.find((k) => !k || k.length > 128);
  if (badKey !== undefined) {
    return NextResponse.json(
      { error: "Every setting key must be 1 to 128 characters." },
      { status: 400 }
    );
  }

  const note = typeof b.note === "string" ? b.note : "";
  if (note.length > 500) {
    return NextResponse.json({ error: "note is limited to 500 characters." }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_BASE}/admin/credits/settings`, {
      method: "PUT",
      headers: {
        "X-Admin-Token": CREDITS_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ values, note }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) purgeLimitsCache();
    return forward(res);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the backend." }, { status: 502 });
  }
}

/**
 * DELETE /api/admin/credits?key=SOME_KEY — revert one key to env or default.
 *
 * NO ALLOWLIST ON THE KEY, deliberately, and it is the one place in this file
 * where that is right. The backend applies its locked and credential guards to
 * WRITES only: a row written by an older container before a guard shipped is
 * already inert, and refusing to delete it is what once left production
 * needing a hand-edited SQLite file. A clear can only move behaviour back
 * towards env. Length is checked because the backend checks it.
 */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!CREDITS_TOKEN) return misconfigured();

  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  if (!key || key.length > 128) {
    return NextResponse.json(
      { error: "A key is required, 1 to 128 characters." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${BACKEND_BASE}/admin/credits/settings/${encodeURIComponent(key)}`,
      {
        method: "DELETE",
        headers: { "X-Admin-Token": CREDITS_TOKEN },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }
    );
    if (res.ok) purgeLimitsCache();
    return forward(res);
  } catch {
    return NextResponse.json({ error: "Couldn't reach the backend." }, { status: 502 });
  }
}