"use client";

import { useState } from "react";
import { Clock, Coins, CreditCard, Inbox, Users, Zap } from "lucide-react";
import type { Overview } from "./credits-types";
import { api, msg } from "./credits-net";
import type { Toast } from "./CreditsUi";
import { money, num } from "./credits-format";
import { Card, SectionLabel, Stat, Button, Badge, SkeletonPanel } from "./CreditsUi";

export function OverviewPanel({
  data,
  onToast,
  onChanged,
}: {
  data: Overview | null;
  onToast: (tone: Toast["tone"], text: string) => void;
  onChanged: () => void;
}) {
  const [sweeping, setSweeping] = useState(false);
  const pw = data?.paywall ?? {};

  async function sweep() {
    setSweeping(true);
    try {
      await api("/api/admin/credits?action=sweep", { method: "POST" });
      onToast("ok", "Sweep run. Orphaned holds released.");
      onChanged();
    } catch (err) {
      onToast("bad", msg(err, "Sweep failed."));
    } finally {
      setSweeping(false);
    }
  }

  if (!data) return <SkeletonPanel />;

  return (
    <div className="af-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Outstanding credits are money already taken for work not yet done —
            the closest thing this business has to a balance-sheet liability. */}
        <Stat
          label="Outstanding"
          value={num(data.credits_outstanding)}
          sub="Sold, not yet delivered"
          tone="accent"
          icon={Coins}
        />
        <Stat label="Accounts" value={num(data.accounts)} sub="Emails with a ledger" icon={Users} />
        {/* A hold is a credit taken for a job with no terminal state yet. The
            sweeper releases orphans on a 90-minute cycle; a non-zero count that
            does not clear is the signal to force it. */}
        <Stat
          label="Holds open"
          value={num(data.holds_open)}
          sub="Jobs with no terminal state"
          tone={data.holds_open ? "alarm" : "plain"}
          icon={Clock}
        />
        <Stat
          label="Webhooks unmatched"
          value={num(data.webhooks_unprocessed)}
          sub="Payments that reached no account"
          tone={data.webhooks_unprocessed ? "alarm" : "plain"}
          icon={Inbox}
        />
        <Stat label="Jobs (all time)" value={num(data.usage?.jobs)} icon={Zap} />
        <Stat label="GPU seconds" value={num(data.usage?.gpu_seconds, 1)} />
        <Stat label="Est. GPU spend" value={money(data.usage?.est_cost_usd, 2)} tone="accent" />
        <Stat label="Jobs refunded" value={num(data.jobs_refunded)} icon={CreditCard} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <SectionLabel>Paywall</SectionLabel>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Badge tone={pw.enabled ? "good" : "muted"}>{pw.enabled ? "Enabled" : "Disabled"}</Badge>
            {pw.provider && <Badge tone="plain">{pw.provider}</Badge>}
            <span className="text-text-muted">
              {num(pw.free_monthly_ops)} free/month per account · {num(pw.free_monthly_ops_per_ip)} per IP
            </span>
          </p>
          {pw.metered_routes && pw.metered_routes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pw.metered_routes.map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-2 py-0.5 font-mono text-[10px] text-amber-400"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col justify-between gap-3 p-4">
          <div>
            <SectionLabel>Hold sweep</SectionLabel>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">
              Releases credits held by jobs that never reported a terminal state. Runs on its own
              every 90 minutes. Use this when someone is waiting.
            </p>
          </div>
          <div>
            <Button variant={data.holds_open ? "primary" : "ghost"} busy={sweeping} onClick={() => void sweep()}>
              Release orphaned holds
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}