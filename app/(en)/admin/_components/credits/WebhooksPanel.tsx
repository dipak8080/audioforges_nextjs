"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Rec } from "./credits-types";
import { prettyLabel } from "./credits-format";
import { Badge, Empty, ErrorNote, DataScroll, Th, Td, Tr, Table, FieldValue, FieldGrid } from "./CreditsUi";

export function WebhooksPanel({ rows, problemsOnly }: { rows: unknown[]; problemsOnly: boolean }) {
  const [open, setOpen] = useState<number | null>(null);

  const objs = useMemo(
    () => rows.filter((r): r is Rec => typeof r === "object" && r !== null),
    [rows]
  );

  const hookStatus = (r: Rec): "processed" | "failed" | "pending" =>
    r.processed_at ? "processed" : r.error ? "failed" : "pending";

  const problems = useMemo(() => objs.filter((r) => hookStatus(r) !== "processed"), [objs]);

  const cols = useMemo(() => {
    const seen = new Set<string>();
    objs.forEach((r) => Object.keys(r).forEach((k) => seen.add(k)));
    const preferred = ["received_at", "provider", "event_name", "processed_at", "event_id", "error"];
    const ordered = preferred.filter((p) => seen.has(p));
    return [...ordered, ...[...seen].filter((k) => !ordered.includes(k))].slice(0, 6);
  }, [objs]);

  if (objs.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Empty
          icon={ShieldCheck}
          title={problemsOnly ? "Every payment reached an account" : "No webhook deliveries yet"}
          body={
            problemsOnly
              ? "Nothing to chase. Deliveries that failed to credit an account show here with their error."
              : "Payment webhook deliveries appear here as they arrive, newest first."
          }
        />
      </div>
    );
  }

  return (
    <>
      {problems.length > 0 && (
        <div className="shrink-0">
          <ErrorNote
            message={`${problems.length} deliver${problems.length === 1 ? "y" : "ies"} never credited an account. Open the row for the error, then grant the credits by hand from the Customer tab.`}
          />
        </div>
      )}
      <DataScroll>
        <Table>
          <thead>
            <tr>
              <Th>Status</Th>
              {cols.map((c) => (
                <Th key={c}>{prettyLabel(c)}</Th>
              ))}
              <Th />
            </tr>
          </thead>
          <tbody>
            {objs.map((r, i) => {
              const s = hookStatus(r);
              return (
                <Fragment key={i}>
                  <Tr onClick={() => setOpen(open === i ? null : i)}>
                    <Td>
                      <Badge tone={s === "processed" ? "good" : s === "failed" ? "bad" : "accent"}>{s}</Badge>
                    </Td>
                    {cols.map((c) => (
                      <Td key={c} className={cn("max-w-[16rem] truncate", c === "email" && "text-amber-300")}>
                        <FieldValue name={c} value={r[c]} />
                      </Td>
                    ))}
                    <Td className="text-right">
                      <ChevronDown
                        className={cn("inline h-3.5 w-3.5 text-text-subtle transition-transform", open === i && "rotate-180")}
                        aria-hidden
                      />
                    </Td>
                  </Tr>
                  {open === i && (
                    <tr className="border-b border-graphite-800/60">
                      <td colSpan={cols.length + 2} className="bg-graphite-950/40 px-4 py-4">
                        <FieldGrid data={r} columns={3} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      </DataScroll>
    </>
  );
}