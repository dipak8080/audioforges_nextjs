"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Sticks the title and the Refresh control to the top of the scrolling page.
 * The old fixed-height shell did this by locking the page to the viewport,
 * which stranded content below the fold on phones. Position sticky gets the
 * same reachable chrome while the page still scrolls normally.
 *
 * `condensed` appears only once the full summary has scrolled out of view, so
 * the bar always says what state things are in without repeating it twice.
 */
export function StickyHeader({
  title,
  subtitle,
  condensed,
  scrolled,
  actions,
}: {
  title: string;
  subtitle?: string;
  condensed?: React.ReactNode;
  scrolled: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 bg-graphite-950/95 backdrop-blur transition-colors",
        scrolled && "border-b border-graphite-800"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl items-center gap-x-3 gap-y-2 px-4 transition-[padding] sm:gap-x-4 sm:px-6",
          scrolled ? "py-2 sm:py-2.5" : "flex-wrap py-4 sm:py-5"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-baseline gap-x-3 gap-y-1",
            scrolled ? "flex-nowrap overflow-hidden" : "flex-wrap"
          )}
        >
          <h1
            className={cn(
              "shrink-0 font-semibold tracking-tight transition-[font-size]",
              scrolled ? "text-[15px] sm:text-lg" : "text-xl sm:text-2xl"
            )}
          >
            {title}
          </h1>
          {scrolled && condensed ? (
            <span className="truncate text-[13px] text-text-muted">{condensed}</span>
          ) : (
            subtitle && !scrolled && <p className="text-[13px] text-text-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="ml-auto flex shrink-0 items-center">{actions}</div>}
      </div>
    </div>
  );
}

/** Boolean scroll state without a re-render on every scroll frame. */
export function onScrollToggle(setScrolled: (v: boolean) => void, threshold = 24) {
  return (e: React.UIEvent<HTMLDivElement>) => {
    setScrolled(e.currentTarget.scrollTop > threshold);
  };
}