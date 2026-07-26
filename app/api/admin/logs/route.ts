import { NextRequest, NextResponse } from "next/server";

// NOTE: This file is a reconstruction based on a prior session summary of
// its behavior, not a verified diff of your actual current file - Claude
// does not have the literal source of this route from this conversation.
// Please diff this against your real app/api/admin/logs/route.ts before
// deploying; only the afterId-related lines are the actual new addition,
// everything else should already match what you have.

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "http" | "system"
  const limit = searchParams.get("limit") ?? "200";
  // New: delta-fetch support for the poll loop. When present, this is
  // forwarded straight through to the backend's after_id param, which
  // returns only rows newer than what the dashboard already has instead
  // of the whole window - see get_http_logs()/get_system_logs() in
  // log_stream.py.
  const afterId = searchParams.get("afterId");

  if (type !== "http" && type !== "system") {
    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  }

  const backendUrl = new URL(`${BACKEND_BASE}/admin/logs/${type}/data`);
  backendUrl.searchParams.set("key", ADMIN_KEY || "");
  backendUrl.searchParams.set("limit", limit);
  if (afterId) {
    backendUrl.searchParams.set("after_id", afterId);
  }

  try {
    const res = await fetch(backendUrl.toString(), { cache: "no-store" });

    if (res.status === 401) {
      // Never forward the backend's 401 as-is - that falsely triggers the
      // dashboard's session-expiry redirect loop, since 401 from THIS
      // route means "your admin session cookie expired," not "the backend
      // key is wrong." Surface backend auth failures as a 502 with an
      // explanatory message instead.
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

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const olderThanDays = searchParams.get("olderThanDays");

  const backendUrl = new URL(`${BACKEND_BASE}/admin/logs`);
  backendUrl.searchParams.set("key", ADMIN_KEY || "");
  if (olderThanDays) {
    backendUrl.searchParams.set("older_than_days", olderThanDays);
  }

  try {
    const res = await fetch(backendUrl.toString(), { method: "DELETE", cache: "no-store" });

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