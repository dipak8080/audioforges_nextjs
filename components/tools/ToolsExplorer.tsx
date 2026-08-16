"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { CATEGORY_ORDER, CATEGORY_LABELS, type Tool, type ToolCategory } from "@/lib/data/tools";

interface ToolsExplorerProps {
  tools: Tool[];
}

/**
 * PREFETCH DISABLED ON THE TOOL GRID (2026-08-16).
 *
 * This renders every tool at once - no pagination, by design, since the
 * whole point of the page is to see what exists. That means one visit
 * puts ~25 links on screen, and Next.js prefetches each as it enters the
 * viewport: 25 routes x 4 App Router segments = ~100 edge requests for a
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
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.shortDescription.toLowerCase().includes(q)
    );
  }, [tools, query]);

  const byCategory = useMemo(() => {
    const map = new Map<ToolCategory, Tool[]>();
    for (const category of CATEGORY_ORDER) {
      const inCategory = filtered.filter((t) => t.category === category);
      if (inCategory.length > 0) map.set(category, inCategory);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-12">
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="w-full rounded-lg border border-graphite-700 bg-graphite-850 py-2.5 pl-10 pr-9 text-sm text-text-primary placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text-primary transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-text-muted">No tools match &quot;{query}&quot;.</p>
      )}

      {CATEGORY_ORDER.map((category) => {
        const items = byCategory.get(category);
        if (!items || items.length === 0) return null;

        return (
          <section key={category} className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">{CATEGORY_LABELS[category]}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((tool) =>
                tool.status === "live" ? (
                  <Link
                    key={tool.slug}
                    href={`/${tool.slug}`}
                    prefetch={false}
                    className="group block rounded-xl border border-graphite-800 bg-graphite-900 p-5 hover:border-amber-500/40 transition-colors"
                  >
                    <h3 className="font-semibold text-text-primary group-hover:text-amber-400 transition-colors">
                      {tool.name} →
                    </h3>
                    <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                  </Link>
                ) : (
                  <div
                    key={tool.slug}
                    className="rounded-xl border border-graphite-800 bg-graphite-900/50 p-5 opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5">
                        Coming soon
                      </span>
                    </div>
                    <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                  </div>
                )
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}