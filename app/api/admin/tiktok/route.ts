import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

const BACKEND_BASE = process.env.NEXT_PUBLIC_RAILWAY_API_BASE;
const ADMIN_KEY = process.env.BACKEND_ADMIN_KEY;

async function relay(res: Response) {
  if (res.status === 401 || res.status === 403) {
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
  return NextResponse.json(await res.json());
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(`${BACKEND_BASE}/admin/tiktok/maintenance`);
  url.searchParams.set("key", ADMIN_KEY || "");

  try {
    return await relay(await fetch(url.toString(), { cache: "no-store" }));
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { on?: boolean; message?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body: treat as missing fields below */
  }
  if (typeof body.on !== "boolean") {
    return NextResponse.json({ error: "`on` must be true or false" }, { status: 400 });
  }

  const url = new URL(`${BACKEND_BASE}/admin/tiktok/maintenance`);
  url.searchParams.set("key", ADMIN_KEY || "");
  url.searchParams.set("on", body.on ? "true" : "false");
  if (typeof body.message === "string" && body.message.trim()) {
    url.searchParams.set("message", body.message.trim().slice(0, 300));
  }

  try {
    return await relay(await fetch(url.toString(), { method: "POST", cache: "no-store" }));
  } catch (err) {
    return NextResponse.json({ error: `Failed to reach backend: ${(err as Error).message}` }, { status: 502 });
  }
}