import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionCookie } from "@/lib/auth/session";

/**
 * THE GUARD THAT WAS MISSING.
 *
 * `verifySessionCookie` has existed in lib/auth/session.ts since the admin
 * panel was built and was called from NOWHERE. The login page set an
 * `admin_session` cookie, the admin PAGES checked it client-side, and the
 * `/api/admin/*` route handlers — the things that actually talk to the
 * backend — checked nothing at all.
 *
 * The practical effect: anyone who guessed the URL could
 * `curl https://www.audioforges.com/api/admin/logs` and read production logs
 * without a password, because the route handler holds BACKEND_ADMIN_KEY in
 * server env and attaches it unconditionally. Same for cache clearing and
 * cookie upload. A client-side redirect is a UI convenience, never a control:
 * the endpoint is the security boundary, and it was open.
 *
 * This matters most for credits. `POST /admin/credits/adjust` writes to the
 * ledger. Shipping that behind the same non-check would have let anyone grant
 * themselves unlimited credits with a single curl.
 *
 * Usage in every route handler, as the first line:
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 *
 * Returns a NextResponse to return early, or null when the caller is allowed.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = (await cookies()).get("admin_session")?.value;
  if (!session || !(await verifySessionCookie(session))) {
    // 404 rather than 401, matching the backend's own admin surface: a 403 or
    // 401 confirms the path exists and is worth attacking. An unauthenticated
    // caller should not be able to tell an admin route from a typo.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}