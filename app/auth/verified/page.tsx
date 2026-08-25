import type { Metadata } from "next";
import {
  AuthVerifiedContent,
  type VerifyStatus,
} from "@/components/credits/AuthVerifiedContent";

/**
 * Target of the backend's /auth/verify redirect.
 *
 * Server component purely so `searchParams` can be awaited (Next 16 makes
 * it a Promise) and the status is known on first paint — a client page
 * using useSearchParams would need a Suspense boundary and would flash an
 * empty state at someone trying to reach credits they paid for.
 *
 * noindex is not optional here: the URL carries a token-verification
 * result, and there is nothing on it Google should ever hold.
 */

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

const VALID: readonly VerifyStatus[] = ["ok", "expired", "used", "invalid"];

export default async function AuthVerifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  // Anything unrecognised — a truncated URL, a stale link format, a
  // status we add server-side later — falls back to `invalid`, which is
  // the one state that offers every recovery route. Never a blank page.
  const resolved: VerifyStatus = VALID.includes(status as VerifyStatus)
    ? (status as VerifyStatus)
    : "invalid";

  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-16 sm:py-24">
      <AuthVerifiedContent status={resolved} />
    </main>
  );
}