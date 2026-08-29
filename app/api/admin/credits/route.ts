import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/**
 * Proxy for the backend's credits admin surface.
 *
 * TWO SECRETS, NOT ONE. The existing admin routes send `BACKEND_ADMIN_KEY`.
 * The credits endpoints want a DIFFERENT token in a DIFFERENT header:
 * `X-Admin-Token: $CREDITS_ADMIN_TOKEN`. Reusing the wrong one fails silently
 * — see below.
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
  for (const key of ["days", "limit", "email", "unprocessed_only"]) {
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