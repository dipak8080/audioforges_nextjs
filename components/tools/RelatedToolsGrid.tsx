import Link from "next/link";
import type { Tool } from "@/lib/data/tools";

export function RelatedToolsGrid({
  tools,
  title = "More free tools",
}: {
  tools: Tool[];
  title?: string;
}) {
  if (tools.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight text-text-primary">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/${tool.slug}`}
            /* Keep prefetch off: App Router prefetches every visible link,
               and five per page across 30 pages is what caused the Vercel
               Edge Request spike. */
            prefetch={false}
            className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
          >
            {/* h3, not h2 — these sit under the section heading above. */}
            <h3 className="font-semibold text-text-primary">{tool.name}</h3>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              {tool.shortDescription}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}