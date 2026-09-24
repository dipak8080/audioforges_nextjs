"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { OrderRow } from "./orders-types";
import { ago, minutesBetween, num, whenLocal } from "./orders-format";
import { ACCESS_META, Note, accessKey } from "./OrdersPrimitives";
import { JourneyTrail } from "./JourneyTrail";

export function OrderDetail({ o, onOpenCustomer }: { o: OrderRow; onOpenCustomer?: (email: string) => void }) {
  const toSignIn = minutesBetween(o.created_at, o.first_session_after);

  const facts: { k: string; v: React.ReactNode; tone?: "bad" | "good" }[] = [
    { k: "Paid", v: whenLocal(o.created_at) },
    {
      k: o.provider === "dodo" ? "Dodo payment" : "Order id",
      v: <span className="font-mono text-[12px]">{o.provider_order_id}</span>,
    },
    {
      k: "Browser linked at purchase",
      v: o.subject_id ? "Yes" : "No",
      tone: o.subject_id ? "good" : undefined,
    },
    {
      k: "First sign-in after paying",
      v: o.first_session_after
        ? `${whenLocal(o.first_session_after)}${toSignIn !== null ? `, ${toSignIn} min later` : ""}`
        : "None",
      tone: o.first_session_after ? "good" : o.access === "not_yet" ? "bad" : undefined,
    },
    { k: "Sessions since", v: num(o.sessions_after) },
    { k: "Sign-in links since", v: `${num(o.links_used_after)} used of ${num(o.links_after)} sent` },
    {
      k: "Receipt email",
      v: o.receipt_error ? "Failed" : o.receipt_sent_at ? "Sent" : "Before tracking",
      tone: o.receipt_error ? "bad" : o.receipt_sent_at ? "good" : undefined,
    },
    { k: "Spent since", v: `${num(o.spent_since)} of ${num(o.credits)} credits` },
    { k: "Balance now", v: `${num(o.balance)} credits` },
    { k: "Last login", v: o.last_login_at ? ago(o.last_login_at) : "Never" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <JourneyTrail o={o} />
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-text-muted">{ACCESS_META[accessKey(o)].hint}</p>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.k} className="min-w-0">
              <dt className="text-[11px] text-text-subtle">{f.k}</dt>
              <dd
                className={cn(
                  "mt-0.5 truncate text-[13px] tabular-nums",
                  f.tone === "bad" ? "text-red-300" : f.tone === "good" ? "text-teal-300" : "text-text-primary"
                )}
              >
                {f.v}
              </dd>
            </div>
          ))}
        </dl>

        {onOpenCustomer && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => onOpenCustomer(o.email)}
          >
            Open in Customer
          </Button>
        )}
      </div>

      <div className="space-y-3 self-start">
        {o.receipt_error ? (
          <Note tone="alarm">
            The receipt never sent. If the claim also missed, this buyer has no automatic way in.
            <span className="mt-1 block break-all font-mono text-[11px] text-red-300/80">{o.receipt_error}</span>
          </Note>
        ) : o.access === "not_yet" ? (
          <Note tone="quiet">
            The receipt carried a sign-in link. If the claim missed, that email is their only route in.
            Look them up in Customer and grant by hand if they write in.
          </Note>
        ) : null}
      </div>
    </div>
  );
}