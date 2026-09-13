import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// EEA + UK + Switzerland: the region where consent is required before any
// analytics storage.
const CONSENT_REQUIRED = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH",
]);

export function GET(req: NextRequest) {
  const h = req.headers;
  const raw = (h.get("x-vercel-ip-country") || h.get("cf-ipcountry") || "").toUpperCase();
  const known = /^[A-Z]{2}$/.test(raw) && raw !== "XX" && raw !== "T1";

  // An unknown country means consent is required. Failing the other way
  // would silently opt every unidentified visitor in.
  return NextResponse.json(
    { country: known ? raw : null, requiresConsent: known ? CONSENT_REQUIRED.has(raw) : true },
    { headers: { "cache-control": "no-store" } }
  );
}