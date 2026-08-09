import { NextRequest, NextResponse } from "next/server";

// NOTE: reconstructed from the version you pasted. Diff before deploying -
// the ONLY new addition is the beforeId passthrough block.

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "http" | "system"
  const limit = searchParams.get("limit") ?? "200";
  // Delta-fetch support for the poll loop. Forwarded straight through to
  // the backend's after_id param, which returns only rows newer than what
  // the dashboard already has instead of the whole window.
  const afterId = searchParams.get("afterId");
  // Cursor pagination for "load older". Forwarded to the backend's
  // before_id param, which returns one fixed-size page of rows OLDER than
  // the cursor. This is what replaced the old approach of re-requesting an
  // ever-larger `limit` - `limit` is capped at 2000 server-side, so paging
  // by growing it could never reach row 2001 no matter how many clicks.
  const beforeId = searchParams.get("beforeId");
  // Correlation lookup: every system_logs line produced by one specific
  // HTTP request, regardless of how far back it is. Forwarded straight
  // through - the backend ignores limit/afterId/beforeId entirely when
  // this is present, since there's no sane page size for "however many
  // lines this one request happened to produce".
  const requestId = searchParams.get("requestId");
  // Tool-family filter, applied server-side. Client-side filtering only
  // ever saw the rows already loaded in the browser, so selecting a tool
  // whose requests were older than the loaded window showed an empty
  // list even though the picker correctly reported a non-zero total.
  const family = searchParams.get("family");

  // Every remaining filter, forwarded straight through. All filtering is
  // server-side now - doing it in the browser could only ever search the
  // rows already loaded, so any result older than the loaded window was
  // invisible while the stat counters above still counted it.
  const PASSTHROUGH = ["method", "q", "status_class", "hide_noise", "since", "until", "level"];

  if (type !== "http" && type !== "system") {
    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  }

  const backendUrl = new URL(`${BACKEND_BASE}/admin/logs/${type}/data`);
  backendUrl.searchParams.set("key", ADMIN_KEY || "");
  backendUrl.searchParams.set("limit", limit);
  if (afterId) {
    backendUrl.searchParams.set("after_id", afterId);
  }
  if (beforeId) {
    backendUrl.searchParams.set("before_id", beforeId);
  }
  if (requestId) {
    backendUrl.searchParams.set("request_id", requestId);
  }
  if (family) {
    backendUrl.searchParams.set("family", family);
  }
  for (const p of PASSTHROUGH) {
    const v = searchParams.get(p);
    if (v) backendUrl.searchParams.set(p, v);
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