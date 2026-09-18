"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PAGE_SIZE } from "./credits-types";
import type { View, JobRow, Rec, JobsPreset } from "./credits-types";
import { api, isAbort, msg } from "./credits-net";
import { downloadCsv } from "./credits-format";
import { RANGES, rangeDates, toolLabel, type CostRow, type RangeKey } from "../spend";
import { useJobFilters } from "./credits-hooks";
import { Card, Button, Select, inputClass, ErrorNote, SkeletonPanel, Segmented, Pager } from "./CreditsUi";
import { CostsPanel } from "./CostsPanel";
import { JobsPanel } from "./JobsPanel";
import { WebhooksPanel } from "./WebhooksPanel";

export function ReadPanel({
  view,
  tick,
  preset,
  onGoToJobs,
}: {
  view: View;
  tick: number;
  preset: JobsPreset | null;
  onGoToJobs: (preset: JobsPreset) => void;
}) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>((preset?.range as RangeKey) ?? "30d");
  const [tool, setTool] = useState("");
  const [status, setStatus] = useState(preset?.status ?? "");
  const [chargeType, setChargeType] = useState(preset?.chargeType ?? "");
  const [accountsOnly, setAccountsOnly] = useState(false);
  const [email, setEmail] = useState(preset?.email ?? "");
  const [emailApplied, setEmailApplied] = useState(preset?.email ?? "");
  const [offset, setOffset] = useState(0);
  const [hooksProblemsOnly, setHooksProblemsOnly] = useState(false);
  const filters = useJobFilters();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ view });
        if (view === "webhooks" && hooksProblemsOnly) params.set("unprocessed_only", "true");
        if (view === "costs" || view === "jobs") {
          const { from, to } = rangeDates(range);
          params.set("date_from", from);
          params.set("date_to", to);
          if (tool) params.set("tool", tool);
        }
        if (view === "jobs") {
          params.set("limit", String(PAGE_SIZE));
          params.set("offset", String(offset));
          if (status) params.set("status", status);
          if (chargeType) params.set("charge_type", chargeType);
          if (emailApplied) params.set("email", emailApplied);
          if (accountsOnly) params.set("has_account", "true");
        }
        const next = await api(`/api/admin/credits?${params.toString()}`, { signal });
        setData(next);
      } catch (err) {
        if (isAbort(err) || signal?.aborted) return;
        setError(msg(err, "Request failed."));
        setData(null);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [view, range, tool, status, chargeType, emailApplied, offset, accountsOnly, hooksProblemsOnly]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, tick]);

  // Narrowing a filter must reset the page: offset 100 against five rows reads
  // as a broken endpoint rather than a filter that moved.
  const setFilter = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setOffset(0);
  };

  const activeChips = [
    tool && { label: `Tool: ${toolLabel(tool)}`, clear: () => setFilter(setTool)("") },
    chargeType && { label: `Charge: ${chargeType}`, clear: () => setFilter(setChargeType)("") },
    accountsOnly && { label: "Accounts only", clear: () => setFilter(setAccountsOnly)(false) },
    emailApplied && {
      label: emailApplied,
      clear: () => {
        setEmail("");
        setEmailApplied("");
        setOffset(0);
      },
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const jobRows = ((data as { jobs?: JobRow[] } | null)?.jobs ?? []) as JobRow[];
  const costRows = ((data as { daily?: CostRow[] } | null)?.daily ?? []) as CostRow[];
  const hookRows = ((data as { webhooks?: unknown[] } | null)?.webhooks ?? []) as unknown[];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Card className="shrink-0 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {view === "webhooks" ? (
            <Button
              size="sm"
              variant={hooksProblemsOnly ? "primary" : "ghost"}
              onClick={() => setHooksProblemsOnly((v) => !v)}
            >
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Problems only
            </Button>
          ) : (
            <Segmented
              label="Date range"
              value={range}
              onChange={(v) => setFilter(setRange)(v as RangeKey)}
              options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
            />
          )}

          {view !== "webhooks" && (
            <Select label="Tool" value={tool} onChange={setFilter(setTool)}>
              <option value="">Any tool</option>
              {(filters.tools ?? []).map((t) => (
                <option key={t} value={t}>
                  {toolLabel(t)}
                </option>
              ))}
            </Select>
          )}

          {view === "jobs" && (
            <>
              <Segmented
                label="Status"
                value={status}
                onChange={setFilter(setStatus)}
                options={[
                  { key: "", label: "All" },
                  { key: "completed", label: "Completed" },
                  { key: "failed_all", label: "Failed" },
                  { key: "rejected", label: "Rejected" },
                ]}
              />
              <Select label="Charge" value={chargeType} onChange={setFilter(setChargeType)}>
                <option value="">Any charge</option>
                {(filters.charge_types ?? []).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant={accountsOnly ? "primary" : "ghost"}
                title="Only jobs from logged-in accounts"
                onClick={() => setFilter(setAccountsOnly)(!accountsOnly)}
              >
                <Users className="h-3.5 w-3.5" aria-hidden />
                Accounts only
              </Button>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setOffset(0);
                  setEmailApplied(email.trim().toLowerCase());
                }}
                className="flex min-w-[15rem] flex-1 basis-60"
              >
                <div className="relative min-w-0 flex-1 sm:max-w-sm">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle"
                    aria-hidden
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Filter by email"
                    aria-label="Filter jobs by email"
                    className={cn(inputClass, "h-9 pl-8 pr-3 text-[13px]")}
                  />
                </div>
              </form>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {view === "costs" && costRows.length > 0 && (
              <Button size="sm" onClick={() => downloadCsv(`credits-spend-${range}.csv`, costRows as unknown as Rec[])}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </Button>
            )}
            {view === "jobs" && jobRows.length > 0 && (
              <Button size="sm" onClick={() => downloadCsv(`credits-jobs-${range}.csv`, jobRows as unknown as Rec[])}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </Button>
            )}
          </div>
        </div>

        {activeChips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-graphite-800 pt-2.5">
            {activeChips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.clear}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/[0.07] px-2 py-0.5 text-[11px] text-amber-300 outline-none transition-colors hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                {c.label}
                <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </Card>

      {error && <ErrorNote message={error} onRetry={() => void load()} />}
      {loading && !data && <SkeletonPanel />}

      {data !== null && view === "costs" && (
        <CostsPanel
          rows={costRows}
          range={range}
          tool={tool}
          onPickTool={setFilter(setTool)}
          onDrillFailed={() => onGoToJobs({ status: "failed_all", range })}
        />
      )}
      {data !== null && view === "jobs" && (
        <>
          <JobsPanel
            rows={jobRows}
            onEmail={(addr) => {
              setEmail(addr);
              setEmailApplied(addr);
              setOffset(0);
            }}
          />
          <Pager
            offset={offset}
            count={jobRows.length}
            total={(data as { total?: number }).total}
            onOffset={setOffset}
          />
        </>
      )}
      {data !== null && view === "webhooks" && <WebhooksPanel rows={hookRows} problemsOnly={hooksProblemsOnly} />}
    </div>
  );
}