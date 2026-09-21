import { Children } from "react";
import { cn } from "@/lib/utils/cn";

export function ToolPageShell({
  breadcrumb,
  title,
  lede,
  tool,
  meta,
  wide = false,
  children,
  className,
}: {
  /** <Breadcrumb /> emits its own JSON-LD — don't also hand-write a
   *  BreadcrumbList on the page. */
  breadcrumb?: React.ReactNode;
  title: string;
  lede?: React.ReactNode;
  tool?: React.ReactNode;
  /** Two or three short facts, shown as the amber line above the h1. Same treatment as /audio-to-text. */
  meta?: string[];
  /** Homepage width for the header and tool. Copy below stays in a reading column. */
  wide?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    /* id="main" is the target of the navbar's skip link — without it the
       skip link is a dead anchor on every tool page. */
    <main
      id="main"
      className={cn(
        "mx-auto px-4",
        wide ? "max-w-6xl py-6 sm:py-8" : "max-w-3xl py-10 sm:py-14",
        className,
      )}
    >
      {breadcrumb && <div className={wide ? "mb-5" : "mb-8"}>{breadcrumb}</div>}

      <header>
        {meta && meta.length > 0 && (
          <p
            className={cn(
              wide ? "mb-3" : "mb-4",
              "font-mono text-xs uppercase tracking-[0.16em] text-amber-500",
            )}
          >
            {meta.join(" · ")}
          </p>
        )}
        {/* Sized by title length rather than per page. Past ~30 characters
            the 6xl wraps to three lines and pushes the tool below the fold,
            which matters most on the pages people arrive at with a file
            ready to drop. Same rule the OG card uses. */}
        <h1
          className={cn(
            "display measure-wide text-text-primary",
            wide
              ? "text-5xl sm:text-6xl"
              : title.length > 30
                ? "text-5xl sm:text-6xl"
                : "text-6xl sm:text-7xl",
          )}
        >
          {title}
        </h1>
        {/* measure-wide to match the h1 — at 68ch, ledes a few characters
            apart wrapped differently between sibling pages. */}
        {lede && (
          <p
            className={cn(
              "measure-wide leading-relaxed text-text-muted",
              wide ? "mt-4 text-base sm:text-lg" : "mt-5 text-lg sm:text-xl",
            )}
          >
            {lede}
          </p>
        )}
      </header>

      {tool && <div className={wide ? "mt-7" : "mt-10"}>{tool}</div>}

      {wide ? (
        <div className="shell-wide mt-16 lg:mt-20">
          {Children.toArray(children).map((child, i) => (
            <div
              key={i}
              className="reveal border-t border-graphite-800 py-14 lg:py-20"
            >
              {child}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-20 space-y-16">{children}</div>
      )}
    </main>
  );
}