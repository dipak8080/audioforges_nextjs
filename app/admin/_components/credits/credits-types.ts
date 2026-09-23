import { Clock, Coins, Inbox, Lock, Search, ShoppingBag, SlidersHorizontal, TrendingUp, Wallet, Zap } from "lucide-react";

export type View = "lookup" | "overview" | "orders" | "costs" | "jobs" | "gate" | "webhooks" | "insights" | "settings";

export interface Overview {
  paywall?: {
    enabled?: boolean;
    provider?: string;
    metered_routes?: string[];
    free_monthly_ops?: number;
    free_monthly_ops_per_ip?: number;
  };
  accounts?: number;
  credits_outstanding?: number;
  holds_open?: number;
  jobs_refunded?: number;
  webhooks_unprocessed?: number;
  usage?: { jobs?: number; gpu_seconds?: number; est_cost_usd?: number };
}

export interface JobRow {
  job_id: string;
  tool: string;
  status: string;
  input_seconds: number | null;
  gpu_seconds: number | null;
  est_cost_usd: number | null;
  charge_type: string | null;
  error: string | null;
  failure_side?: "client" | "server" | null;
  created_at: string;
  ended_at: string | null;
  charge_status: string | null;
  refund_reason: string | null;
  email: string | null;
}

export interface Filters {
  tools?: string[];
  statuses?: string[];
  charge_types?: string[];
}

export type Rec = Record<string, unknown>;

export const VIEWS: { id: View; label: string; hint: string; icon: typeof Coins }[] = [
  { id: "lookup", label: "Customer", hint: "Find a customer and grant credits", icon: Search },
  { id: "overview", label: "Overview", hint: "Unspent credits and paywall settings", icon: Wallet },
  { id: "orders", label: "Orders", hint: "Every purchase and whether the buyer got in", icon: ShoppingBag },
  { id: "costs", label: "Spend", hint: "What the GPU costs and which tools drive it", icon: Zap },
  { id: "jobs", label: "Jobs", hint: "Every GPU job with its cost and charge", icon: Clock },
  { id: "gate", label: "Gate", hint: "Who hit the paywall and what they did next", icon: Lock },
  { id: "webhooks", label: "Payments", hint: "PayPal and Ko-fi payment deliveries", icon: Inbox },
  { id: "insights", label: "Insights", hint: "Where sales come from, who eats the free tier, monthly net", icon: TrendingUp },
  { id: "settings", label: "Config", hint: "Runtime limits and flags, no redeploy", icon: SlidersHorizontal },
];

export const PAGE_SIZE = 50;
export const AUTO_MS = 30_000;
export const KOFI_PACKS = [10, 30, 100];

export type JobsPreset = { status?: string; chargeType?: string; range?: string; email?: string };