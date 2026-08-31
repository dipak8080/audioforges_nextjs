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
    <main className={cn("mx-auto max-w-3xl px-4 py-10 sm:py-14", className)}>
      {breadcrumb && <div className="mb-8">{breadcrumb}</div>}

      <header>
        <h1 className="measure-wide text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-text-primary sm:text-6xl">
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