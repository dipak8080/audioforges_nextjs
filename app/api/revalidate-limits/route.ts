import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { LIMITS_CACHE_TAG } from "@/lib/api/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Drops the cached GET /limits response so a settings retune shows up now
 * instead of on the next ISR window.
 *
 * Call it right after PUT /admin/credits/settings:
 *   curl -X POST https://audioforges.com/api/revalidate-limits \
 *        -H "x-revalidate-token: $LIMITS_REVALIDATE_TOKEN"
 *
 * Unset token means disabled, not open. An endpoint that can be hit to force
 * ~30 pages to regenerate is a cheap way to run up the ISR bill from outside.
 */
export async function POST(request: Request) {
  const expected = process.env.LIMITS_REVALIDATE_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (request.headers.get("x-revalidate-token") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Next 16 requires an explicit profile. `{ expire: 0 }` means the next
  // request refetches rather than serving one more stale hit.
  revalidateTag(LIMITS_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ revalidated: LIMITS_CACHE_TAG });
}