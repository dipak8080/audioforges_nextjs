    import { RAILWAY_API_BASE, fetchWithTimeout } from "@/lib/api/railway";

export function googleSignInUrl(next: string, updates: boolean): string {
  const q = new URLSearchParams({ next, updates: updates ? "true" : "false" });
  return `${RAILWAY_API_BASE}/auth/google/start?${q.toString()}`;
}

export async function sendMagicLink(email: string, updates: boolean): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${RAILWAY_API_BASE}/auth/magic-link`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, updates }),
      },
      15_000
    );
    return res.ok;
  } catch {
    return false;
  }
}