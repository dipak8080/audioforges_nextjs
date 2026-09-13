import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie, SESSION_COOKIE_MAX_AGE_SECONDS } from "@/lib/auth/session";
import {
  checkLockout,
  clearFailures,
  clientKey,
  passwordMatches,
  recordFailure,
  throttleDelay,
} from "@/lib/auth/loginRateLimit";

export const runtime = "nodejs";

const MAX_PASSWORD_LENGTH = 256;
const TOO_MANY = "Too many attempts. Try again later.";

export async function POST(req: NextRequest) {
  const key = clientKey(req);

  const lock = checkLockout(key);
  if (lock.locked) {
    return NextResponse.json(
      { error: TOO_MANY },
      { status: 429, headers: { "Retry-After": String(lock.retryAfter) } }
    );
  }

  const body = await req.json().catch(() => null);
  const password = body?.password;

  if (typeof password !== "string" || !password || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const expected = process.env.ADMIN_PANEL_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured: ADMIN_PANEL_PASSWORD is not set." },
      { status: 500 }
    );
  }

  await throttleDelay();

  if (!passwordMatches(password, expected)) {
    const result = recordFailure(key);
    if (result.locked) {
      return NextResponse.json(
        { error: TOO_MANY },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
      );
    }
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  clearFailures(key);

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
