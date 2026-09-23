export type Access = "in_tab" | "signed_in" | "not_yet";

export interface OrderRow {
  id: string;
  email: string;
  pack: string;
  credits: number;
  amount_cents: number;
  currency: string;
  created_at: string;
  subject_id: string | null;
  account_id: string | null;
  provider: string;
  provider_order_id: string;
  receipt_sent_at: string | null;
  receipt_error: string | null;
  last_login_at: string | null;
  first_session_after: string | null;
  sessions_after: number;
  links_after: number;
  links_used_after: number;
  spent_since: number;
  balance: number;
  access: Access;
  stale: boolean;
}

export interface AbandonedRow {
  email: string;
  pack: string | null;
  created_at: string;
}

export interface NoOrderSignin {
  email: string;
  requested: number;
  used: number;
  last_at: string;
}

export interface OrdersData {
  days: number;
  orders: OrderRow[];
  counts: {
    in_tab: number;
    signed_in: number;
    not_yet: number;
    not_yet_stale: number;
    receipt_failed: number;
  };
  revenue_cents: number;
  signals: {
    abandoned_checkouts: number;
    abandoned_recent: AbandonedRow[];
    signins_without_order: NoOrderSignin[];
  };
}

export type SortKey = "when" | "paid" | "spent";
export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

export const WINDOWS = [
  { key: 30, label: "30d" },
  { key: 90, label: "90d" },
  { key: 365, label: "1y" },
] as const;

export function isProblem(o: OrderRow) {
  return o.access === "not_yet" || Boolean(o.receipt_error);
}

export async function readOrders(days: number): Promise<OrdersData> {
  const res = await fetch(`/api/admin/credits?view=orders&days=${days}&limit=200`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as OrdersData;
}