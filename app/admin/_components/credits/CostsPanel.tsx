"use client";

import { useMemo } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Empty } from "./CreditsUi";
import { SpendBoard, ToolTable } from "../SpendCharts";
import { buildSpendModel, rangeDates, toolLabel, type CostRow, type RangeKey } from "../spend";

export function CostsPanel({
  rows,
  range,
  tool,
  onDrillFailed,
  onPickTool,
}: {
  rows: CostRow[];
  range: RangeKey;
  tool: string;
  onDrillFailed: () => void;
  onPickTool: (tool: string) => void;
}) {
  const model = useMemo(() => {
    const { from, to } = rangeDates(range);
    return buildSpendModel(rows, from, to);
  }, [rows, range]);

  if (rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Empty icon={Zap} title="No GPU jobs in this range" body="Pick a longer range or clear the tool filter." />
      </div>
    );
  }

  return (
    <div className="af-scroll -mr-2 min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pr-2">
      <SpendBoard
        model={model}
        range={range}
        onDrillFailed={onDrillFailed}
        onPickTool={onPickTool}
        toolFilterLabel={tool ? toolLabel(tool) : undefined}
      />
      <section className="rounded-2xl border border-graphite-800 bg-graphite-900/70">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Every tool, side by side</h3>
            <p className="mt-0.5 text-[12px] text-text-subtle">Click a tool to focus the page on it.</p>
          </div>
        </div>
        <div className="px-2 pb-2 sm:px-3">
          <ToolTable model={model} onPick={onPickTool} />
        </div>
      </section>
    </div>
  );
}

export function Cell({ label, value, tone }: { label: string; value: string; tone?: "bad" | "accent" }) {
  return (
    <div>
      <p className="text-[11px] text-text-subtle">{label}</p>
      <p
        className={cn(
          "font-mono text-[13px] tabular-nums",
          tone === "bad" ? "text-red-400" : tone === "accent" ? "text-amber-400" : "text-text-primary"
        )}
      >
        {value}
      </p>
    </div>
  );
}