"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
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
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
          <mark key={i} className="rounded-[2px] bg-amber-500/20 text-amber-300">
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
 * All guides render at once, grouped by category with no pagination.
 * Next.js prefetches each link as it scrolls into view, and each route
 * costs four App Router segments (_head, _tree, route, __PAGE__) - so
 * reading down this page fetches ~124 requests worth of guides that will
 * not be read.
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

  const queryWords = useMemo(
    () => query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [query]
  );
  const isSearching = queryWords.length > 0;

  // "/" focuses search, matching the convention on most content-heavy
  // sites — skipped while already typing in a field so it doesn't hijack
  // a literal "/" someone's typing elsewhere. Escape clears.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === searchInputRef.current) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Every word must appear somewhere in title or description, so "camelot
  // mixing" narrows rather than widening to everything matching either.
  const searchFiltered = useMemo(() => {
    if (!isSearching) return guides;
    return guides.filter((guide) => {
      const haystack = `${guide.title} ${guide.description}`.toLowerCase();
      return queryWords.every((word) => haystack.includes(word));
    });
  }, [guides, queryWords, isSearching]);

  // Counts follow the query, so a chip reading "Production 0" says the
  // search is why it's empty, not that the category has nothing in it.
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

  // Newest first, except while searching: a title match is a stronger
  // signal than a description-only match, so relevance outranks date.
  function sortGuides(items: Guide[]) {
    return [...items].sort((a, b) => {
      if (isSearching) {
        const aTitle = queryWords.some((w) => a.title.toLowerCase().includes(w)) ? 1 : 0;
        const bTitle = queryWords.some((w) => b.title.toLowerCase().includes(w)) ? 1 : 0;
        if (aTitle !== bTitle) return bTitle - aTitle;
      }
      return new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime();
    });
  }

  const grouped = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: sortGuides(finalFiltered.filter((g) => g.category === category)),
      })).filter((group) => group.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finalFiltered, queryWords, isSearching]
  );

  const flat = useMemo(
    () => sortGuides(finalFiltered),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finalFiltered, queryWords, isSearching]
  );

  const hasActiveFilter = isSearching || activeCategory !== "all";

  // Searching flattens the layout. Category headings over one or two
  // results each turn the page into a stack of near-empty sections; one
  // ranked grid answers "what did I match" in a single look.
  const showCategorySections = !hasActiveFilter;

  const clearFilters = () => {
    setQuery("");
    setActiveCategory("all");
    searchInputRef.current?.focus();
  };

  return (
    <div className="space-y-8">
      <div role="search" className="space-y-4">
        <div className="relative mx-auto max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides"
            aria-label="Search guides"
            className="w-full rounded-lg border border-graphite-700 bg-graphite-850 py-2.5 pl-10 pr-16 text-sm text-text-primary transition-colors placeholder:text-text-subtle focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          {query ? (
            <button
              type="button"
              onClick={clearFilters}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-text-subtle transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-graphite-700 bg-graphite-900 px-1.5 py-0.5 font-mono text-[10px] text-text-subtle sm:block">
              /
            </kbd>
          )}
        </div>

        {/* Chips scroll sideways on narrow screens rather than wrapping
            into ragged rows — these labels are long. */}
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-auto flex w-max max-w-full items-center gap-2 pb-1">
            <FilterChip
              label="All"
              count={categoryCounts.all}
              isActive={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            {CATEGORY_ORDER.map((category) => (
              <FilterChip
                key={category}
                label={CATEGORY_LABELS[category]}
                count={categoryCounts[category]}
                isActive={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              />
            ))}
          </div>
        </div>

        <p aria-live="polite" className="text-center text-xs text-text-subtle">
          {hasActiveFilter ? (
            <>
              {finalFiltered.length} of {guides.length} guides
              <span aria-hidden> · </span>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded text-amber-400 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
              >
                Clear
              </button>
            </>
          ) : (
            `${guides.length} guides`
          )}
        </p>
      </div>

      {finalFiltered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-800 px-6 py-16 text-center">
          <p className="text-text-primary">Nothing matches that search.</p>
          <p className="mt-1 text-sm text-text-muted">
            Try a single word — “camelot”, “sampling”, “noise”.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 rounded-lg border border-graphite-700 px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-amber-500/50 hover:text-amber-400 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
          >
            Show all guides
          </button>
        </div>
      ) : showCategorySections ? (
        <div className="space-y-12">
          {grouped.map(({ category, items }) => (
            <section key={category} className="space-y-4">
              <div className="flex items-center gap-3">
                {/* The amber tick used across the nav, /tools and the
                    footer — one motif for "this is a category". */}
                <span className="h-5 w-[3px] shrink-0 rounded-full bg-amber-500" />
                <h2 className="text-xl font-bold text-text-primary sm:text-2xl">
                  {CATEGORY_LABELS[category]}
                </h2>
                <span className="font-mono text-xs text-text-subtle">{items.length}</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {items.map((guide) => (
                  <GuideCard key={guide.slug} guide={guide} words={queryWords} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {flat.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} words={queryWords} showCategory />
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
  // Disabled at zero rather than dimmed-but-clickable: clicking a chip
  // that can only produce an empty state is a dead end, and the label
  // already says why it's zero.
  const isEmpty = count === 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isEmpty && !isActive}
      aria-pressed={isActive}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60",
        "disabled:cursor-not-allowed disabled:opacity-40",
        isActive
          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
          : "border-graphite-800 text-text-muted hover:border-graphite-700 hover:text-text-primary"
      )}
    >
      {label}
      <span
        className={cn("font-mono text-[11px]", isActive ? "text-amber-400/70" : "text-text-subtle")}
      >
        {count}
      </span>
    </button>
  );
}

function GuideCard({
  guide,
  words,
  showCategory = false,
}: {
  guide: Guide;
  words: string[];
  showCategory?: boolean;
}) {
  return (
    <Link
      href={`/guides/${guide.slug}`}
      // See the note at the top of this file.
      prefetch={false}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-5",
        "transition-colors duration-200 hover:border-amber-500/40 hover:bg-graphite-850",
        "focus:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30"
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-amber-500 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
      />

      {showCategory && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          {CATEGORY_LABELS[guide.category]}
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug text-text-primary transition-colors group-hover:text-amber-400">
          <Highlighted text={guide.title} words={words} />
        </h3>
        <ArrowUpRight className="h-4 w-4 shrink-0 translate-y-0.5 text-amber-500/70 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none" />
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
        <Highlighted text={guide.description} words={words} />
      </p>

      {/* mt-auto pins the date to the bottom so it lines up across cards
          of different title lengths in the same row. */}
      <time dateTime={guide.publishedDate} className="mt-auto pt-3 text-xs text-text-subtle">
        {formatDate(guide.publishedDate)}
      </time>
    </Link>
  );
}