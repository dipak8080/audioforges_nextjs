"use client";

import { Fragment, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { JobRow, Rec } from "./credits-types";
import { money, fullTime, relTime, statusTone, isRejected, jobStatus } from "./credits-format";
import { Cell } from "./CostsPanel";
import { duration, toolLabel } from "../spend";
import { Card, Badge, Empty, DataScroll, Th, Td, Tr, Table, FieldGrid } from "./CreditsUi";

export function JobsPanel({ rows, onEmail }: { rows: JobRow[]; onEmail: (email: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Empty icon={Clock} title="No jobs match these filters" body="Clear a filter chip above, or widen the range." />
      </div>
    );
  }

  const isFailed = (r: JobRow) =>
    !isRejected(r) && (r.status === "failed" || r.status === "timeout" || r.status === "cancelled");
  const errorBox = (r: JobRow) =>
    isRejected(r)
      ? "border-graphite-700 bg-graphite-900/60 text-text-muted"
      : "border-red-500/20 bg-red-500/[0.06] text-red-200";

  return (
    <DataScroll>
      {/* mobile */}
      <div className="space-y-2 p-2 md:hidden">
        {rows.map((r) => (
          <Card key={r.job_id} className={cn("p-3", isFailed(r) && "border-red-500/25")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] text-text-primary" title={r.tool}>{toolLabel(r.tool)}</p>
                <p className="mt-0.5 text-[11px] text-text-subtle" title={fullTime(r.created_at)}>
                  {relTime(r.created_at)}
                </p>
                <p className={cn("mt-0.5 truncate text-[11px]", r.email ? "text-amber-300" : "text-text-subtle")}>
                  {r.email ?? "anonymous"}
                </p>
              </div>
              <Badge tone={statusTone(jobStatus(r))}>{jobStatus(r)}</Badge>
            </div>
            {r.error && (
              <p className={cn("mt-2 rounded-lg border p-2 text-[11px] leading-relaxed", errorBox(r))}>
                {r.error}
              </p>
            )}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Cell label="Charge" value={r.charge_type ?? "–"} tone={r.charge_type === "credit" ? "accent" : undefined} />
              <Cell label="GPU time" value={duration(r.gpu_seconds)} />
              <Cell label="Cost" value={money(r.est_cost_usd)} tone="accent" />
            </div>
          </Card>
        ))}
      </div>

      {/* desktop */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Tool</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Charge</Th>
              <Th right>GPU time</Th>
              <Th right>Cost</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expanded = open === r.job_id;
              return (
                <Fragment key={r.job_id}>
                  <Tr
                    onClick={() => setOpen(expanded ? null : r.job_id)}
                    className={cn(isFailed(r) && "bg-red-500/[0.04]")}
                  >
                    <Td className="whitespace-nowrap text-text-subtle">
                      <span title={fullTime(r.created_at)}>{relTime(r.created_at)}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-[13px]">
                      <span title={r.tool}>{toolLabel(r.tool)}</span>
                    </Td>
                    <Td className="max-w-[13rem]">
                      {r.email ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEmail(r.email as string);
                          }}
                          title={`Filter to ${r.email}`}
                          className="block max-w-full truncate font-mono text-[11px] text-amber-300 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        >
                          {r.email}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-text-subtle">anon</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(jobStatus(r))}>{jobStatus(r)}</Badge>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "font-mono text-[11px]",
                          r.charge_type === "credit" ? "text-amber-400" : "text-text-subtle"
                        )}
                      >
                        {r.charge_type ?? "–"}
                      </span>
                      {r.charge_status && r.charge_status !== "settled" && (
                        <span className="ml-1.5 font-mono text-[10px] text-text-subtle">{r.charge_status}</span>
                      )}
                    </Td>
                    <Td right className="text-text-muted">{duration(r.gpu_seconds)}</Td>
                    <Td right className="text-amber-400">{money(r.est_cost_usd)}</Td>
                    <Td className="text-right">
                      <ChevronDown
                        className={cn(
                          "inline h-3.5 w-3.5 text-text-subtle transition-transform",
                          expanded && "rotate-180"
                        )}
                        aria-hidden
                      />
                    </Td>
                  </Tr>
                  {expanded && (
                    <tr className="border-b border-graphite-800/60">
                      <td colSpan={8} className="bg-graphite-950/40 px-4 py-4">
                        {r.error && (
                          <p className={cn("mb-3 rounded-lg border p-2.5 text-[12px] leading-relaxed", errorBox(r))}>
                            {r.error}
                          </p>
                        )}
                        {r.refund_reason && (
                          <p className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-2.5 text-[12px] leading-relaxed text-amber-200">
                            Refunded: {r.refund_reason}
                          </p>
                        )}
                        <FieldGrid data={r as unknown as Rec} omit={["error", "refund_reason"]} columns={3} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataScroll>
  );
}