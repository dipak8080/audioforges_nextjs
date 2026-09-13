import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { getLiveTools, type Tool } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page does not exist. Browse the free audio tools and guides instead.",
  robots: { index: false, follow: true },
};

const SUGGESTED_SLUGS = [
  "youtube-to-wav",
  "vocal-remover",
  "key-finder",
  "audio-to-midi",
  "convert",
  "audio-to-text",
];

export default function NotFound() {
  const live = getLiveTools();
  const picked = SUGGESTED_SLUGS.map((slug) => live.find((t) => t.slug === slug)).filter(
    (t): t is Tool => Boolean(t)
  );
  const suggestions = [
    ...picked,
    ...live.filter((t) => !picked.some((p) => p.slug === t.slug)),
  ].slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-20 sm:py-28">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-graphite-700 bg-graphite-850 text-amber-500">
          <SearchX className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-text-primary sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-lg text-text-muted">
          This page does not exist, or it moved. Every tool on the site is free and needs no
          sign-up, so pick one below or browse the full list.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/tools" className={buttonStyles({ size: "lg" })}>
            All tools
          </Link>
          <Link href="/guides" className={buttonStyles({ variant: "outline", size: "lg" })}>
            Guides
          </Link>
        </div>
      </div>

      <div className="mt-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
          Popular tools
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((tool) => (
            <li key={tool.slug}>
              <Link
                href={`/${tool.slug}`}
                className="block h-full rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
              >
                <span className="text-sm font-medium text-text-primary">{tool.name}</span>
                <span className="mt-1 block text-sm text-text-muted">
                  {tool.shortDescription}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}