import { NextRequest, NextResponse } from "next/server";

// Reusing the existing public backend URL var - the URL itself isn't
// sensitive (it's already visible in every tool page's client-side
// fetch calls). Only BACKEND_ADMIN_KEY needs to stay server-only.
const BACKEND_URL = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const BACKEND_ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;


function assertBackendConfigured() {
  if (!BACKEND_URL || !BACKEND_ADMIN_KEY) {
    throw new Error(
      "Backend not configured: NEXT_PUBLIC_RAILWAY_API_BASE or BACKEND_ADMIN_KEY is missing."
    );
  }
}

/** GET /api/admin/logs?type=http|system&limit=200
 * Fetches a JSON snapshot of logs from the backend. Middleware has
 * already verified the caller has a valid admin session by the time
 * this handler runs. */
export async function GET(req: NextRequest) {
  try {
    assertBackendConfigured();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "system" ? "system" : "http";
  const limit = searchParams.get("limit") ?? "200";

  try {
    const res = await fetch(
      `${BACKEND_URL}/admin/logs/${type}/data?key=${encodeURIComponent(BACKEND_ADMIN_KEY!)}&limit=${encodeURIComponent(limit)}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      // Deliberately never forward the backend's raw status code as-is.
      // A 401 here means "BACKEND_ADMIN_KEY doesn't match ADMIN_STATUS_KEY
      // on the backend" - a config problem, NOT "your admin panel session
      // expired." Forwarding it as 401 made the dashboard's own 401-means-
      // relogin logic misfire and bounce back to /admin/login even though
      // the actual session was fine. Use 502 for any backend rejection so
      // the two failure modes can never be confused again.
      const detail = res.status === 401
        ? "Backend rejected the admin key. Check that BACKEND_ADMIN_KEY (Next.js) exactly matches ADMIN_STATUS_KEY (backend)."
        : `Backend returned ${res.status}`;
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to reach backend: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}

/** DELETE /api/admin/logs?olderThanDays=7  (omit olderThanDays to delete everything)
 * Proxies to the backend's log cleanup endpoint. */
export async function DELETE(req: NextRequest) {
  try {
    assertBackendConfigured();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const olderThanDays = searchParams.get("olderThanDays");

  const backendUrl = new URL(`${BACKEND_URL}/admin/logs`);
  backendUrl.searchParams.set("key", BACKEND_ADMIN_KEY!);
  if (olderThanDays) {
    backendUrl.searchParams.set("older_than_days", olderThanDays);
  }

  try {
    const res = await fetch(backendUrl.toString(), { method: "DELETE" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to reach backend: ${(e as Error).message}` },
      { status: 502 }
    );
  }
}