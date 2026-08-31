import Link from "next/link";
import type { Tool } from "@/lib/data/tools";
import { SectionHeading } from "@/components/ui/SectionHeading";

/** Card treatment matches /tools and the homepage "Most used" grid — one
 *  card design across the site rather than three. */
export function RelatedToolsGrid({
  tools,
  eyebrow = "Next",
  title = "More free tools",
}: {
  tools: Tool[];
  eyebrow?: string;
  title?: string;
}) {
  if (tools.length === 0) return null;

  return (
    <section>
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/${tool.slug}`}
            /* Keep prefetch off: App Router prefetches every visible link,
               and five per page across 30 pages is what caused the Vercel
               Edge Request spike. */
            prefetch={false}
            className="group relative block overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-5 transition-colors duration-200 hover:border-amber-500/40 hover:bg-graphite-850 focus:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-amber-500 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
            />
            {/* h3, not h2 — these sit under the section heading above. */}
            <h3 className="font-semibold text-text-primary transition-colors group-hover:text-amber-400">
              {tool.name}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              {tool.shortDescription}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}