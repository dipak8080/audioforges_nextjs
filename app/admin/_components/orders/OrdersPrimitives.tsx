"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { OrderRow } from "./orders-types";

export function Surface({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-graphite-800 bg-graphite-900/60", className)}>
      {children}
    </section>
  );
}

export function Note({ tone, children }: { tone: "alarm" | "quiet"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px] leading-snug",
        tone === "alarm"
          ? "border-red-500/25 bg-red-500/[0.05] text-red-200"
          : "border-graphite-800 bg-graphite-900/60 text-text-muted"
      )}
    >
      <AlertTriangle
        className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "alarm" ? "text-red-400" : "text-text-subtle")}
        aria-hidden
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function CopyEmail({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title="Copy email"
      aria-label={`Copy ${value}`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1200);
        });
      }}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
    >
      {done ? <Check className="h-3 w-3 text-teal-400" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
    </button>
  );
}

export type AccessKey = "in_tab" | "signed_in" | "waiting" | "stale";

export function accessKey(o: OrderRow): AccessKey {
  if (o.access === "in_tab") return "in_tab";
  if (o.access === "signed_in") return "signed_in";
  return o.stale ? "stale" : "waiting";
}

export const ACCESS_META: Record<AccessKey, { label: string; dot: string; pill: string; hint: string }> = {
  in_tab: {
    label: "In tab",
    dot: "bg-teal-400",
    pill: "border-teal-500/25 bg-teal-500/10 text-teal-300",
    hint: "Claim matched. Credits appeared silently in the tab they bought from.",
  },
  signed_in: {
    label: "By email",
    dot: "bg-amber-400",
    pill: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    hint: "Claim missed, but they signed in afterwards via the receipt link or the recovery form.",
  },
  waiting: {
    label: "Waiting",
    dot: "bg-graphite-600",
    pill: "border-graphite-700 bg-graphite-850/60 text-text-muted",
    hint: "Paid, and nothing shows them reaching their credits. Check their inbox situation.",
  },
  stale: {
    label: "Not yet",
    dot: "bg-red-500",
    pill: "border-red-500/25 bg-red-500/10 text-red-300",
    hint: "Paid, and nothing shows them reaching their credits. Check their inbox situation.",
  },
};

export function StatusPill({ o }: { o: OrderRow }) {
  const m = ACCESS_META[accessKey(o)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        m.pill
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}