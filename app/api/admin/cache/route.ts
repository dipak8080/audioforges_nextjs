import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;

export async function GET() {
  const url = new URL(`${BACKEND_BASE}/admin/status`);
  url.searchParams.set("key", ADMIN_KEY || "");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Backend rejected the admin key (misconfigured BACKEND_ADMIN_KEY?)" },
        { status: 502 }
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `Backend returned ${res.status}: ${text || res.statusText}` }, { status: 502 });
    }

    const data = await res.json();
    // /admin/status returns a full snapshot; the dashboard only needs the
    // cache slice of it, so unwrap it here rather than making the client
    // dig through an unrelated payload shape.
    return NextResponse.json(data.cache ?? {});
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}

export async function POST() {
  const url = new URL(`${BACKEND_BASE}/admin/clear-cache`);
  url.searchParams.set("key", ADMIN_KEY || "");

  try {
    const res = await fetch(url.toString(), { method: "POST", cache: "no-store" });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Backend rejected the admin key (misconfigured BACKEND_ADMIN_KEY?)" },
        { status: 502 }
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `Backend returned ${res.status}: ${text || res.statusText}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const gb = body?.gb;

  if (typeof gb !== "number" || gb <= 0) {
    return NextResponse.json({ error: "Invalid gb value" }, { status: 400 });
  }

  const url = new URL(`${BACKEND_BASE}/admin/cache/limit`);
  url.searchParams.set("key", ADMIN_KEY || "");
  url.searchParams.set("gb", String(gb));

  try {
    const res = await fetch(url.toString(), { method: "POST", cache: "no-store" });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Backend rejected the admin key (misconfigured BACKEND_ADMIN_KEY?)" },
        { status: 502 }
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `Backend returned ${res.status}: ${text || res.statusText}` }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}