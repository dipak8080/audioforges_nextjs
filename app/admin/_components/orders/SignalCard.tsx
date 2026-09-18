"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { num } from "./orders-format";
import { Surface } from "./OrdersPrimitives";

const PREVIEW_ROWS = 6;

interface Props<T> {
  title: string;
  count: number | undefined;
  blurb: string;
  rows: T[];
  render: (row: T) => React.ReactNode;
  keyOf: (row: T) => string;
  loading: boolean;
}

export function SignalCard<T>({ title, count, blurb, rows, render, keyOf, loading }: Props<T>) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, PREVIEW_ROWS);
  const more = rows.length - PREVIEW_ROWS;

  return (
    <Surface className="flex min-h-[16rem] flex-col p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-[14px] font-medium text-text-primary">{title}</h3>
        <span className="text-xl font-semibold tabular-nums text-text-primary">{num(count)}</span>
      </div>
      <p className="mt-1 max-w-prose text-[12px] leading-snug text-text-subtle">{blurb}</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-[13px] text-text-subtle">{loading ? "Loading." : "None in this window."}</p>
      ) : (
        <ul className={cn("mt-4 flex-1 divide-y divide-graphite-800/70", all && "af-scroll max-h-64 overflow-y-auto pr-1")}>
          {shown.map((r) => (
            <li key={keyOf(r)} className="py-2 text-[13px]">
              {render(r)}
            </li>
          ))}
        </ul>
      )}

      {more > 0 && (
        <Button type="button" variant="ghost" size="sm" className="mt-3 self-start" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </Button>
      )}
    </Surface>
  );
}