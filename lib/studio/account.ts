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
async function call<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(`${RAILWAY_API_BASE}${path}`, { ...init, credentials: "include" }, 15_000);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export interface StudioPassState {
  available: boolean;
  priceUsd: number;
  songsPerMonth: number;
  active: boolean;
  status: string | null;
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
  canManage: boolean;
  passSongs: number;
  nextExpiry: string | null;
}

export function readPass(raw: unknown): StudioPassState | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    available: p.available === true,
    priceUsd: typeof p.price_usd === "number" ? p.price_usd : 7.99,
    songsPerMonth: typeof p.credits_per_month === "number" ? p.credits_per_month : 40,
    active: p.active === true,
    status: typeof p.status === "string" ? p.status : null,
    renewsAt: typeof p.renews_at === "string" ? p.renews_at : null,
    cancelAtPeriodEnd: p.cancel_at_period_end === true,
    canManage: p.can_manage === true,
    passSongs: typeof p.pass_credits === "number" ? p.pass_credits : 0,
    nextExpiry: typeof p.next_expiry === "string" ? p.next_expiry : null,
  };
}

export async function setPassCancelled(cancel: boolean): Promise<StudioPassState | null> {
  const d = await call<{ studio_pass?: unknown }>(`/credits/dodo/pass/${cancel ? "cancel" : "resume"}`, { method: "POST" });
  return d ? readPass(d.studio_pass) : null;
}

export async function passPortalUrl(): Promise<string | null> {
  const d = await call<{ url?: string }>("/credits/dodo/pass/portal", { method: "POST" });
  return d?.url ?? null;
}

export interface LibraryItem {
  jobId: string;
  title: string;
  kind: string;
  stems: string[];
  camelot: string | null;
  bpm: number | null;
  sizeMb: number;
  createdAt: string;
  expiresAt: string;
}

export async function fetchLibrary(): Promise<LibraryItem[] | null> {
  const d = await call<{ items?: Record<string, unknown>[] }>("/library");
  if (!d || !Array.isArray(d.items)) return null;
  return d.items.map((i) => {
    const a = (i.analysis ?? {}) as Record<string, unknown>;
    return {
      jobId: String(i.job_id),
      title: typeof i.title === "string" && i.title ? i.title : "Untitled",
      kind: String(i.kind ?? ""),
      stems: Array.isArray(i.stems) ? (i.stems as string[]) : [],
      camelot: typeof a.camelot === "string" && a.camelot !== "Unknown" ? a.camelot : null,
      bpm: typeof a.bpm === "number" ? Math.round(a.bpm) : null,
      sizeMb: typeof i.size_mb === "number" ? i.size_mb : 0,
      createdAt: String(i.created_at ?? ""),
      expiresAt: String(i.expires_at ?? ""),
    };
  });
}

export function libraryStemUrl(jobId: string, stem: string, download = false): string {
  return `${RAILWAY_API_BASE}/library/${encodeURIComponent(jobId)}/stem/${encodeURIComponent(stem)}${download ? "?download=true" : ""}`;
}

export async function libraryStemPlayUrl(jobId: string, stem: string): Promise<string | null> {
  const d = await call<{ url?: string }>(`/library/${encodeURIComponent(jobId)}/stem/${encodeURIComponent(stem)}?json=true`);
  return d?.url ?? null;
}

export async function deleteLibraryItem(jobId: string): Promise<boolean> {
  const d = await call<{ ok?: boolean }>(`/library/${encodeURIComponent(jobId)}`, { method: "DELETE" });
  return d?.ok === true;
}

export interface EmailPrefs {
  email: string | null;
  updates: boolean;
  notices: boolean;
}

export async function fetchEmailPrefs(): Promise<EmailPrefs | null> {
  const d = await call<{ email?: string; updates?: boolean; account_notices?: boolean }>("/credits/email-preferences");
  return d ? { email: d.email ?? null, updates: !!d.updates, notices: !!d.account_notices } : null;
}

export async function saveEmailPrefs(prefs: { updates?: boolean; notices?: boolean }): Promise<boolean> {
  const d = await call<unknown>("/credits/email-preferences", jsonPost({ updates: prefs.updates, account_notices: prefs.notices }));
  return d !== null;
}

export interface ReferralInfo {
  enabled: boolean;
  link: string;
  rewardSongs: number;
  rewarded: number;
  pending: number;
  earned: number;
}

export async function fetchReferral(): Promise<ReferralInfo | null> {
  const d = await call<Record<string, unknown>>("/credits/referral");
  if (!d) return null;
  return {
    enabled: d.enabled === true,
    link: typeof d.link === "string" ? d.link : "",
    rewardSongs: typeof d.reward_credits === "number" ? d.reward_credits : 5,
    rewarded: typeof d.friends_rewarded === "number" ? d.friends_rewarded : 0,
    pending: typeof d.friends_pending === "number" ? d.friends_pending : 0,
    earned: typeof d.credits_earned === "number" ? d.credits_earned : 0,
  };
}

export async function claimReferral(code: string): Promise<string | null> {
  const d = await call<{ result?: string }>("/credits/referral/claim", jsonPost({ code }));
  return d?.result ?? null;
}

export async function signOut(): Promise<boolean> {
  const d = await call<{ ok?: boolean }>("/auth/logout", { method: "POST" });
  return d?.ok === true;
}
export interface HistoryItem {
  id: number;
  delta: number;
  kind: string;
  createdAt: string;
  note: string | null;
  orderId: string | null;
}

export async function fetchHistory(cursor: string | null, limit = 50): Promise<{ items: HistoryItem[]; next: string | null } | null> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (cursor) q.set("cursor", cursor);
  const d = await call<{ items?: Record<string, unknown>[]; next_cursor?: string | null }>(`/credits/history?${q.toString()}`);
  if (!d || !Array.isArray(d.items)) return null;
  return {
    items: d.items.map((i) => ({
      id: Number(i.id),
      delta: Number(i.delta),
      kind: String(i.kind ?? ""),
      createdAt: String(i.created_at ?? ""),
      note: typeof i.note === "string" ? i.note : null,
      orderId: typeof i.order_id === "string" ? i.order_id : null,
    })),
    next: typeof d.next_cursor === "string" ? d.next_cursor : null,
  };
}

export interface Order {
  orderId: string;
  pack: string;
  songs: number;
  amountUsd: number;
  currency: string;
  status: string;
  createdAt: string;
  invoiceAvailable: boolean;
}

export async function fetchOrders(): Promise<Order[] | null> {
  const d = await call<{ orders?: Record<string, unknown>[] }>("/credits/orders");
  if (!d || !Array.isArray(d.orders)) return null;
  return d.orders.map((o) => ({
    orderId: String(o.order_id),
    pack: String(o.pack ?? ""),
    songs: Number(o.credits ?? 0),
    amountUsd: Number(o.amount_usd ?? 0),
    currency: String(o.currency ?? "USD"),
    status: String(o.status ?? ""),
    createdAt: String(o.created_at ?? ""),
    invoiceAvailable: o.invoice_available === true,
  }));
}

export async function downloadInvoice(orderId: string): Promise<"ok" | "rate_limited" | "failed"> {
  try {
    const res = await fetchWithTimeout(
      `${RAILWAY_API_BASE}/credits/orders/${encodeURIComponent(orderId)}/invoice`,
      { method: "GET", credentials: "include" },
      45_000
    );
    if (res.status === 429) return "rate_limited";
    if (!res.ok) return "failed";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `AudioForges-invoice-${orderId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "ok";
  } catch {
    return "failed";
  }
}