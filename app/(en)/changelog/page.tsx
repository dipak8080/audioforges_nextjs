import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CHANGELOG, CHANGELOG_INDEXABLE } from "@/lib/data/changelog";

export const metadata: Metadata = {
  title: "What's new",
  description: "Every AudioForges update, newest first.",
  alternates: { canonical: `${SITE_URL}/changelog` },
  robots: CHANGELOG_INDEXABLE ? undefined : { index: false, follow: true },
};

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function ChangelogPage() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Breadcrumb items={[{ name: "What's new" }]} className="mb-8" />
      <h1 className="display text-4xl text-text-primary sm:text-5xl">What&apos;s new</h1>
      <p className="mt-3 text-text-muted">Built and shipped by one producer in Kathmandu. Newest first.</p>
      <ol className="mt-10 space-y-8 border-l border-graphite-800 pl-6">
        {CHANGELOG.map((e) => (
          <li key={`${e.date}-${e.title}`} className="relative">
            <span className="absolute -left-[29px] top-1.5 h-2 w-2 rounded-full bg-amber-500" />
            <time dateTime={e.date} className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-subtle">
              {fmt.format(new Date(e.date))}
            </time>
            <h2 className="mt-1 text-xl text-text-primary">{e.title}</h2>
            <p className="mt-1 text-text-muted">{e.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}