import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

/** Renders the visible trail AND its BreadcrumbList JSON-LD from one array,
 *  so the two can't drift — same pattern as FAQSection. Pages using this
 *  must not also hand-write a BreadcrumbList. */
export interface Crumb {
  name: string;
  /** Root-relative, leading slash. Omit on the last crumb. */
  href?: string;
}

export function Breadcrumb({
  items,
  className,
}: {
  /** Without Home — that's prepended. */
  items: Crumb[];
  className?: string;
}) {
  const trail: Crumb[] = [{ name: "Home", href: "/" }, ...items];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      ...(crumb.href ? { item: `${SITE_URL}${crumb.href === "/" ? "" : crumb.href}` } : {}),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className={className}>
        <ol className="flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
          {trail.map((crumb, i) => {
            const isLast = i === trail.length - 1;
            return (
              <li key={crumb.name} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 text-graphite-600" aria-hidden="true" />
                )}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    prefetch={false}
                    className="transition-colors hover:text-amber-400"
                  >
                    {crumb.name}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-text-muted">
                    {crumb.name}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}