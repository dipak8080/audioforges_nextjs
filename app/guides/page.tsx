import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { guides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Guides for Producers & DJs | AudioForges",
  description:
    "Practical guides on harmonic mixing, sampling, set prep, and production workflow — written from real studio and DJ experience.",
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: {
    title: "Guides for Producers & DJs | AudioForges",
    description:
      "Practical guides on harmonic mixing, sampling, set prep, and production workflow.",
    url: `${SITE_URL}/guides`,
    siteName: "AudioForges",
    type: "website",
  },
};

export default function GuidesIndexPage() {
  const sortedGuides = [...guides].sort(
    (a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime()
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-10">
      <header className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
          Guides
        </h1>
        <p className="text-lg text-text-muted max-w-xl mx-auto">
          Practical, from-the-studio guides on mixing, sampling, and production
          workflow — no filler, just what actually helps.
        </p>
      </header>

      <section className="space-y-4">
        {sortedGuides.map((guide) => (
          <Link
            key={guide.slug}
            href={`/guides/${guide.slug}`}
            className="group block rounded-xl border border-graphite-800 bg-graphite-900 p-5 hover:border-amber-500/40 transition-colors"
          >
            <h2 className="font-semibold text-text-primary group-hover:text-amber-400 transition-colors flex items-center gap-2">
              {guide.title}
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h2>
            <p className="text-sm text-text-muted mt-1">{guide.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}