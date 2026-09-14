import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/auth/session";

// Protects every /admin route except the login page and login API route
// themselves (which must stay reachable so someone can actually log in).
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];

// EEA + UK + Switzerland. Stamped as a cookie so ConsentBanner can decide
// synchronously instead of waiting on a fetch.
const CONSENT_REQUIRED = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]);

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|images/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|json|wav|mp3|mp4|woff|woff2|rnnn|pb)$).*)",
  ],
};

function stampGeo(req: NextRequest, res: NextResponse) {
  const raw = (
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("cf-ipcountry") ||
    ""
  ).toUpperCase();

  const known = /^[A-Z]{2}$/.test(raw) && raw !== "XX" && raw !== "T1";

  // Unknown country fails closed: consent required rather than silently
  // opting an unidentified visitor in.
  const requiresConsent = !known || CONSENT_REQUIRED.has(raw);

  res.cookies.set("af-geo", requiresConsent ? "1" : "0", {
    path: "/",
    maxAge: 86400,
    sameSite: "lax",
    httpOnly: false,
    secure: true,
  });

  return res;
}

// Renamed from `middleware` to `proxy` per the Next.js 16 convention.
// Admin logic is unchanged from the previous middleware.ts; the geo stamp
// for the consent banner is the only addition.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdmin = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!isAdmin) {
    return stampGeo(req, NextResponse.next());
  }

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