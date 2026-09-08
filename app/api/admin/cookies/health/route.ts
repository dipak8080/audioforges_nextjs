import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;

/**
 * Live per-account download traffic (success/failure counters kept by the
 * runtime, reset on every container restart). Sourced from /admin/status
 * rather than /admin/cookies/status because only the runtime knows how the
 * files are performing in real traffic - a cookies file can look perfect
 * (future expiry, all auth cookies present) while YouTube challenges every
 * request it makes. Returns just the cookies block, not the whole status
 * payload.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

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
    return NextResponse.json({
      uptime_seconds: data?.uptime_seconds ?? null,
      accounts: data?.cookies?.accounts ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}