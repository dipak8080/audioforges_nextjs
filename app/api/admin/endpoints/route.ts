import { NextRequest, NextResponse } from "next/server";

// Proxies GET /admin/endpoints on the backend - the real, introspected
// list of every tool endpoint the API serves, used to build the admin
// dashboard's path-search typeahead. See routes.py's admin_endpoints()
// for why this is read from FastAPI's own route table rather than a
// second hand-maintained list: it cannot go stale by construction.

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;

export async function GET(_request: NextRequest) {
  const backendUrl = new URL(`${BACKEND_BASE}/admin/endpoints`);
  backendUrl.searchParams.set("key", ADMIN_KEY || "");

  try {
    const res = await fetch(backendUrl.toString(), {
      cache: "no-store",
      // This list changes only on deploy, not per-request - a short
      // revalidate window would be reasonable, but no-store keeps this
      // route's behavior identical to the other admin/logs proxies
      // rather than introducing a second caching policy to reason about.
    });

    if (res.status === 401) {
      return NextResponse.json(
        { error: "Backend rejected the admin key (misconfigured BACKEND_ADMIN_KEY?)" },
        { status: 502 }
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Backend returned ${res.status}: ${text || res.statusText}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to reach backend: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}