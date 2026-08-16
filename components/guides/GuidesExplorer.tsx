"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import type { Guide } from "@/lib/guides";
import { cn } from "@/lib/utils/cn";

const CATEGORY_LABELS: Record<Guide["category"], string> = {
  "dj-mixing": "DJing & Harmonic Mixing",
  production: "Production & Sampling",
  "podcast-cleanup": "Podcast & Audio Cleanup",
};

const CATEGORY_ORDER: Guide["category"][] = ["dj-mixing", "production", "podcast-cleanup"];

type CategoryFilter = "all" | Guide["category"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Match highlighting — shows exactly why a result matched, rather than */
/* returning guides with no visible connection to what was searched     */
/* ------------------------------------------------------------------ */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlighted({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "ig");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        words.some((w) => part.toLowerCase() === w.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-amber-500/25 text-amber-300">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

interface GuidesExplorerProps {
  guides: Guide[];
}

/**
 * PREFETCH DISABLED ON THE GUIDE LIST (2026-08-16).
 *
 * All 31 guides render at once, grouped by category with no pagination.
 * Next.js prefetches each link as it scrolls into view, and each route
 * costs four App Router segments (_head, _tree, route, __PAGE__) - so
 * reading down this page fetches roughly 124 requests worth of guides
 * that will not be read.
 *
 * Vercel's usage breakdown made this visible: /guides.segments/* carried
 * the highest counts on the whole site (216-252 per segment), above every
 * individual tool. That is not readership, it is the index page fetching
 * its own contents on every visit.
 *
 * A guide index is a decision surface, not a funnel - the visitor is
 * scanning titles, not queued to open a specific one - so there is no
 * next page worth guessing at. Clicking still works identically.
 */
export function GuidesExplorer({ guides }: GuidesExplorerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const queryWords = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);

  // "/" focuses search, matching the convention on most content-heavy
  // sites — skipped while already typing in a field so it doesn't hijack
  // a literal "/" character someone's typing elsewhere.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchFiltered = useMemo(() => {
    if (queryWords.length === 0) return guides;
    return guides.filter((guide) => {
      const haystack = `${guide.title} ${guide.description}`.toLowerCase();
      return queryWords.every((word) => haystack.includes(word));
    });
  }, [guides, queryWords]);

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: searchFiltered.length,
      "dj-mixing": 0,
      production: 0,
      "podcast-cleanup": 0,
    };
    for (const guide of searchFiltered) counts[guide.category]++;
    return counts;
  }, [searchFiltered]);

  const finalFiltered = useMemo(() => {
    if (activeCategory === "all") return searchFiltered;
    return searchFiltered.filter((g) => g.category === activeCategory);
  }, [searchFiltered, activeCategory]);

  const groupedByCategory = useMemo(() => {
    const categoriesToShow = activeCategory === "all" ? CATEGORY_ORDER : [activeCategory];

    return categoriesToShow
      .map((category) => {
        const items = finalFiltered.filter((g) => g.category === category);

        if (queryWords.length > 0) {
          // While actively searching, a title match is a stronger signal
          // than a description-only match — surface those first rather
          // than leaving relevance entirely to publish date.
          items.sort((a, b) => {
            const aTitleMatch = queryWords.some((w) => a.title.toLowerCase().includes(w)) ? 1 : 0;
            const bTitleMatch = queryWords.some((w) => b.title.toLowerCase().includes(w)) ? 1 : 0;
            if (aTitleMatch !== bTitleMatch) return bTitleMatch - aTitleMatch;
            return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
          });
        } else {
          items.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
        }

        return { category, items };
      })
      .filter((group) => group.items.length > 0);
  }, [finalFiltered, activeCategory, queryWords]);

  const hasActiveFilter = query.trim().length > 0 || activeCategory !== "all";

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("all");
    searchInputRef.current?.focus();
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="relative mx-auto max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides…"
            className="w-full rounded-lg border border-graphite-700 bg-graphite-900 py-2.5 pl-10 pr-16 text-sm text-text-primary placeholder:text-text-subtle focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle transition-colors hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-graphite-700 px-1.5 py-0.5 text-[10px] text-text-subtle">
              /
            </kbd>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
              activeCategory === "all"
                ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                : "border-graphite-700 bg-graphite-900 text-text-muted hover:border-graphite-600 hover:text-text-primary"
            )}
          >
            All ({categoryCounts.all})
          </button>
          {CATEGORY_ORDER.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              disabled={categoryCounts[category] === 0}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                activeCategory === category
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                  : "border-graphite-700 bg-graphite-900 text-text-muted hover:border-graphite-600 hover:text-text-primary"
              )}
            >
              {CATEGORY_LABELS[category]} ({categoryCounts[category]})
            </button>
          ))}
        </div>

        {hasActiveFilter && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-subtle">
            <span>
              {finalFiltered.length} guide{finalFiltered.length !== 1 ? "s" : ""} found
            </span>
            <span aria-hidden>·</span>
            <button type="button" onClick={clearFilters} className="text-amber-400 underline-offset-2 hover:underline">
              Clear
            </button>
          </div>
        )}
      </div>

      {groupedByCategory.length === 0 ? (
        <div className="space-y-3 text-center">
          <p className="text-text-muted">No guides match your search. Try a different term or category.</p>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-graphite-700 bg-graphite-900 px-4 py-2 text-sm text-text-primary transition-colors hover:border-amber-500/40"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groupedByCategory.map(({ category, items }) => (
            <section key={category} className="space-y-4">
              {activeCategory === "all" && (
                <h2 className="border-b border-graphite-800 pb-2 text-xl font-bold text-text-primary">
                  {CATEGORY_LABELS[category]}
                </h2>
              )}
              <div className="space-y-3">
                {items.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/guides/${guide.slug}`}
                    prefetch={false}
                    className="group block rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-text-primary transition-colors group-hover:text-amber-400">
                        <Highlighted text={guide.title} words={queryWords} />
                      </h3>
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      <Highlighted text={guide.description} words={queryWords} />
                    </p>
                    <p className="mt-2 text-xs text-text-subtle">{formatDate(guide.publishedDate)}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}