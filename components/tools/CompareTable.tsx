import { cn } from "@/lib/utils/cn";

export type CellState = "yes" | "no" | "partial" | "unknown";

export interface CompareCell {
  /** Drives the mark. Omit for a plain text cell. */
  state?: CellState;
  text: string;
  /** Small secondary line, e.g. "on the free tier". */
  sub?: string;
  mono?: boolean;
}

export interface CompareRow {
  label: string;
  cells: CompareCell[];
}

function Mark({ state }: { state: CellState }) {
  const base = "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full";
  if (state === "yes")
    return (
      <span className={cn(base, "bg-amber-500 text-graphite-950")} aria-label="Yes">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M2.5 6.5l2.3 2.3L9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  if (state === "partial")
    return (
      <span className={cn(base, "border border-amber-500/70")} aria-label="Partially">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
      </span>
    );
  if (state === "no")
    return (
      <span className={cn(base, "border border-graphite-600 text-graphite-500")} aria-label="No">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" strokeLinecap="round" />
        </svg>
      </span>
    );
  return (
    <span className={cn(base, "border border-dashed border-graphite-600")} aria-label="Not stated">
      <span className="h-px w-1.5 bg-graphite-500" />
    </span>
  );
}

function Value({ cell, bright }: { cell: CompareCell; bright: boolean }) {
  return (
    <span className={cn("flex items-start gap-2.5 leading-snug", bright ? "text-text-primary" : "text-text-muted")}>
      {cell.state && (
        <span className="mt-[2px]">
          <Mark state={cell.state} />
        </span>
      )}
      <span className={cn(cell.mono && "font-mono tabular-nums")}>
        {cell.text}
        {cell.sub && <span className="block font-sans text-[11px] text-text-subtle">{cell.sub}</span>}
      </span>
    </span>
  );
}

/**
 * Two renderings of one dataset. Below sm the grid becomes one card per
 * column, because a three-column table at 380px is a horizontal scrollbar,
 * which is the thing it replaced.
 */
export function CompareTable({
  columns,
  rows,
  highlight = 0,
  footnote,
  gridClass,
}: {
  columns: string[];
  rows: CompareRow[];
  /** Index of the column being weighed. Gets the amber rail and brighter text. */
  highlight?: number;
  footnote?: string;
  /** Override the sm+ grid template, e.g. a narrow number column beside a wide text one. */
  gridClass?: string;
}) {
  const colClass =
    gridClass ??
    (columns.length === 1
      ? "sm:grid-cols-[minmax(9rem,1fr)_2fr]"
      : columns.length === 2
        ? "sm:grid-cols-[minmax(7rem,1.2fr)_1fr_1fr]"
        : "sm:grid-cols-[minmax(7rem,1.1fr)_1fr_1fr_1fr]");

  return (
    <div>
      {/* Table, sm and up */}
      <div
        role="table"
        className={cn(
          "hidden overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 text-sm sm:grid",
          colClass
        )}
      >
        <div role="row" className="contents">
          <div role="columnheader" className="border-b border-graphite-800 px-4 py-3" />
          {columns.map((c, i) => (
            <div
              key={c}
              role="columnheader"
              className={cn(
                "border-b border-graphite-800 px-4 py-3 font-semibold",
                i === highlight
                  ? "border-t-2 border-t-amber-500 bg-amber-500/[0.06] text-text-primary"
                  : "text-text-muted"
              )}
            >
              {c}
            </div>
          ))}
        </div>

        {rows.map((r, ri) => (
          <div role="row" className="contents" key={r.label}>
            <div
              role="rowheader"
              className={cn(
                "px-4 py-3.5 text-text-subtle",
                ri < rows.length - 1 && "border-b border-graphite-800"
              )}
            >
              {r.label}
            </div>
            {r.cells.map((cell, ci) => (
              <div
                role="cell"
                key={ci}
                className={cn(
                  "px-4 py-3.5",
                  ri < rows.length - 1 && "border-b border-graphite-800",
                  ci === highlight && "bg-amber-500/[0.06]"
                )}
              >
                <Value cell={cell} bright={ci === highlight} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Cards, below sm. One per column, so nothing scrolls sideways. */}
      <div className="space-y-3 sm:hidden">
        {columns.map((c, ci) => (
          <div
            key={c}
            className={cn(
              "overflow-hidden rounded-xl border bg-graphite-900",
              ci === highlight ? "border-amber-500/40" : "border-graphite-800"
            )}
          >
            <p
              className={cn(
                "border-b px-4 py-2.5 text-sm font-semibold",
                ci === highlight
                  ? "border-graphite-800 bg-amber-500/[0.06] text-text-primary"
                  : "border-graphite-800 text-text-muted"
              )}
            >
              {c}
            </p>
            <dl className="divide-y divide-graphite-800 text-sm">
              {rows.map((r) => (
                <div key={r.label} className="px-4 py-3">
                  <dt className="text-xs text-text-subtle">{r.label}</dt>
                  <dd className="mt-1">
                    <Value cell={r.cells[ci]} bright={ci === highlight} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {footnote && <p className="mt-3 text-xs text-text-subtle">{footnote}</p>}
    </div>
  );
}