import { cn } from "@/lib/utils/cn";

export function ToolPageShell({
  breadcrumb,
  title,
  lede,
  tool,
  children,
  className,
}: {
  /** <Breadcrumb /> emits its own JSON-LD — don't also hand-write a
   *  BreadcrumbList on the page. */
  breadcrumb?: React.ReactNode;
  title: string;
  lede?: React.ReactNode;
  tool?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    /* id="main" is the target of the navbar's skip link — without it the
       skip link is a dead anchor on every tool page. */
    <main id="main" className={cn("mx-auto max-w-3xl px-4 py-10 sm:py-14", className)}>
      {breadcrumb && <div className="mb-8">{breadcrumb}</div>}

      <header>
        {/* Sized by title length rather than per page. Past ~30 characters
            the 6xl wraps to three lines and pushes the tool below the fold,
            which matters most on the pages people arrive at with a file
            ready to drop. Same rule the OG card uses. */}
        <h1
          className={cn(
            "measure-wide font-bold text-text-primary",
            title.length > 30
              ? "text-4xl leading-[1.04] tracking-[-0.025em] sm:text-5xl"
              : "text-5xl leading-[1.02] tracking-[-0.03em] sm:text-6xl"
          )}
        >
          {title}
        </h1>
        {/* measure-wide to match the h1 — at 68ch, ledes a few characters
            apart wrapped differently between sibling pages. */}
        {lede && (
          <p className="measure-wide mt-5 text-lg leading-relaxed text-text-muted sm:text-xl">
            {lede}
          </p>
        )}
      </header>

      {tool && <div className="mt-10">{tool}</div>}

      <div className="mt-20 space-y-16">{children}</div>
    </main>
  );
}