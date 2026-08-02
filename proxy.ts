import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/auth/session";

// Protects every /admin route except the login page and login API route
// themselves (which must stay reachable so someone can actually log in).
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];

// Renamed from `middleware` to `proxy` per the Next.js 16 convention —
// this file now runs on the Node.js runtime rather than Edge, which is
// also why it's safe to keep doing a real cookie-signature check here
// (the old Edge-runtime middleware model had a known bypass class,
// CVE-2025-29927, under load — part of why this rename happened).
// Logic is otherwise unchanged from the previous middleware.ts.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p));
  if (isPublicAdminPath) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("admin_session")?.value;
  const valid = sessionCookie ? await verifySessionCookie(sessionCookie) : false;

  if (!valid) {
    // API routes get a clean 401 JSON response; page routes get redirected
    // to the login page with a `from` param so we can bounce back after login.
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};