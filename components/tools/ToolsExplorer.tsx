"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CATEGORY_ORDER, CATEGORY_LABELS, type Tool, type ToolCategory } from "@/lib/data/tools";

interface ToolsExplorerProps {
  tools: Tool[];
}

type Filter = ToolCategory | "all";

/**
 * PREFETCH DISABLED ON THE TOOL GRID (2026-08-16).
 *
 * This renders every tool at once - no pagination, by design, since the
 * whole point of the page is to see what exists. That means one visit
 * puts ~31 links on screen, and Next.js prefetches each as it enters the
 * viewport: 31 routes x 4 App Router segments = ~124 edge requests for a
 * visitor who will open exactly one tool.
 *
 * The search box makes it worse rather than better. Filtering re-renders
 * a different subset into view, so scrolling and searching can prefetch
 * the same catalogue repeatedly within one session.
 *
 * Nothing about navigation changes - a clicked tool loads on click. On a
 * browse page that is the correct trade: the visitor is still deciding,
 * so there is no "next page" worth guessing at.
 */
export function ToolsExplorer({ tools }: ToolsExplorerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  // "/" focuses the search field, the way it does in most developer tools.
  // Ignored while the caret is already in a field so it never eats a keystroke.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const matchesQuery = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.shortDescription.toLowerCase().includes(q)
    );
  }, [tools, trimmed]);

  // Counts follow the query, so a chip reading "Convert 0" tells you the
  // search is the reason a category is empty - not that it has nothing in it.
  const counts = useMemo(() => {
    const map = new Map<Filter, number>([["all", matchesQuery.length]]);
    for (const category of CATEGORY_ORDER) {
      map.set(category, matchesQuery.filter((t) => t.category === category).length);
    }
    return map;
  }, [matchesQuery]);

  const visible = useMemo(
    () => (filter === "all" ? matchesQuery : matchesQuery.filter((t) => t.category === filter)),
    [matchesQuery, filter]
  );

  function clearAll() {
    setQuery("");
    setFilter("all");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const first = visible.find((t) => t.status === "live");
    if (e.key !== "Enter" || !first) return;
    e.preventDefault();
    router.push(`/${first.slug}`);
  }

  // Searching flattens the grid. Category headings over one or two results
  // each turn the page into a stack of near-empty sections; a single ranked
  // grid answers "what did I match" in one look.
  const showCategorySections = !isSearching && filter === "all";

  return (
    <div className="space-y-8">
      <div role="search" className="space-y-4">
        <div className="relative mx-auto max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tools"
            aria-label="Search tools"
            className="w-full rounded-lg border border-graphite-700 bg-graphite-850 py-2.5 pl-10 pr-16 text-sm text-text-primary transition-colors placeholder:text-text-subtle focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          {query ? (
            <button
              type="button"
              onClick={clearAll}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-text-subtle transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-graphite-700 bg-graphite-900 px-1.5 py-0.5 font-mono text-[10px] text-text-subtle sm:block">
              /
            </kbd>
          )}
        </div>

        {/* Chips scroll sideways on narrow screens rather than wrapping into
            four ragged rows above the fold. */}
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-auto flex w-max max-w-full items-center gap-2 pb-1">
            <FilterChip
              label="All"
              count={counts.get("all") ?? 0}
              isActive={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {CATEGORY_ORDER.map((category) => (
              <FilterChip
                key={category}
                label={CATEGORY_LABELS[category]}
                count={counts.get(category) ?? 0}
                isActive={filter === category}
                onClick={() => setFilter(category)}
              />
            ))}
          </div>
        </div>

        <p aria-live="polite" className="text-center text-xs text-text-subtle">
          {visible.length === tools.length
            ? `${tools.length} tools`
            : `${visible.length} of ${tools.length} tools`}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-800 px-6 py-16 text-center">
          <p className="text-text-primary">Nothing matches that search.</p>
          <p className="mt-1 text-sm text-text-muted">
            Try a file format, or what you want to do — “wav”, “vocal”, “bpm”.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="mt-5 rounded-lg border border-graphite-700 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-amber-500/50 hover:text-amber-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
          >
            Show all tools
          </button>
        </div>
      ) : showCategorySections ? (
        <div className="space-y-12">
          {CATEGORY_ORDER.map((category) => {
            const items = visible.filter((t) => t.category === category);
            if (items.length === 0) return null;
            return (
              <section key={category} className="space-y-4">
                <div className="flex items-center gap-3">
                  {/* Same amber tick that marks categories in the nav panel. */}
                  <span className="h-5 w-[3px] shrink-0 rounded-full bg-amber-500" />
                  <h2 className="text-xl font-bold text-text-primary sm:text-2xl">
                    {CATEGORY_LABELS[category]}
                  </h2>
                  <span className="font-mono text-xs text-text-subtle">{items.length}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} query={trimmed} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} query={trimmed} showCategory />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const isEmpty = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60",
        isActive
          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
          : "border-graphite-800 text-text-muted hover:border-graphite-700 hover:text-text-primary",
        isEmpty && !isActive && "opacity-40"
      )}
    >
      {label}
      <span className={cn("font-mono text-[11px]", isActive ? "text-amber-400/70" : "text-text-subtle")}>
        {count}
      </span>
    </button>
  );
}

function ToolCard({
  tool,
  query,
  showCategory = false,
}: {
  tool: Tool;
  query: string;
  showCategory?: boolean;
}) {
  const eyebrow = showCategory ? (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
      {CATEGORY_LABELS[tool.category]}
    </p>
  ) : null;

  if (tool.status !== "live") {
    return (
      <div className="rounded-xl border border-dashed border-graphite-800 bg-graphite-900/40 p-5">
        {eyebrow}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-text-muted">
            <Highlight text={tool.name} query={query} />
          </h3>
          <span className="shrink-0 rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-sm text-text-subtle">
          <Highlight text={tool.shortDescription} query={query} />
        </p>
      </div>
    );
  }

  return (
    <Link
      href={`/${tool.slug}`}
      // See the note at the top of this file.
      prefetch={false}
      className={cn(
        "group relative block overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-5",
        "transition-colors duration-200 hover:border-amber-500/40 hover:bg-graphite-850",
        "focus:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30"
      )}
    >
      {/* The amber tick from the category headings, scaled to the card edge
          on hover - one motif doing the work of a hover state. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-amber-500 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
      />
      {eyebrow}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-text-primary transition-colors group-hover:text-amber-400">
          <Highlight text={tool.name} query={query} />
        </h3>
        <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-0.5 text-amber-500/70 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
      </div>
      <p className="mt-1 text-sm text-text-muted">
        <Highlight text={tool.shortDescription} query={query} />
      </p>
    </Link>
  );
}

/** Marks the matched substring so it's obvious why a result came back. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="rounded-[2px] bg-amber-500/20 text-amber-300">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}