import { NextRequest, NextResponse } from "next/server";

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;

export async function GET() {
  const url = new URL(`${BACKEND_BASE}/admin/cookies/status`);
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
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const incoming = await request.formData();
  const slot = incoming.get("slot");
  const file = incoming.get("file");

  if (!slot || !file) {
    return NextResponse.json({ error: "Missing slot or file" }, { status: 400 });
  }

  const url = new URL(`${BACKEND_BASE}/admin/upload-cookies`);
  url.searchParams.set("key", ADMIN_KEY || "");
  url.searchParams.set("slot", String(slot));

  const outgoing = new FormData();
  outgoing.append("file", file);

  try {
    const res = await fetch(url.toString(), { method: "POST", body: outgoing });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { error: "Backend rejected the admin key (misconfigured BACKEND_ADMIN_KEY?)" },
        { status: 502 }
      );
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json({ error: data?.detail || `Backend returned ${res.status}` }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}