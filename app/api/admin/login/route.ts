import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, SESSION_COOKIE_MAX_AGE_SECONDS } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = body?.password;

  if (typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const expected = process.env.ADMIN_PANEL_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured: ADMIN_PANEL_PASSWORD is not set." },
      { status: 500 }
    );
  }

  if (password !== expected) {
    // Deliberately generic message - don't confirm/deny anything more
    // specific than "wrong password" (e.g. don't say "wrong password,
    // try again" vs. "account locked" - keep the failure surface minimal).
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const sessionValue = await createSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("admin_session", sessionValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}