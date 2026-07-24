import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { guides, type Guide } from "@/lib/guides";

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
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Guides for Producers & DJs | AudioForges",
    description:
      "Practical guides on harmonic mixing, sampling, set prep, and production workflow.",
    images: ["/images/og-default.png"],
  },
};

const CATEGORY_LABELS: Record<Guide["category"], string> = {
  "dj-mixing": "DJing & Harmonic Mixing",
  production: "Production & Sampling",
  "podcast-cleanup": "Podcast & Audio Cleanup",
};

const CATEGORY_ORDER: Guide["category"][] = [
  "dj-mixing",
  "production",
  "podcast-cleanup",
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function GuidesIndexPage() {
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AudioForges Guides",
    url: `${SITE_URL}/guides`,
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: guides.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/guides/${guide.slug}`,
      name: guide.title,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Guides
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Practical, from-the-studio guides on mixing, sampling, and production
            workflow — no filler, just what actually helps.
          </p>
        </header>

        {CATEGORY_ORDER.map((category) => {
          const categoryGuides = guides
            .filter((g) => g.category === category)
            .sort(
              (a, b) =>
                new Date(b.publishedDate).getTime() -
                new Date(a.publishedDate).getTime()
            );

          if (categoryGuides.length === 0) return null;

          return (
            <section key={category} className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary border-b border-graphite-800 pb-2">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="space-y-3">
                {categoryGuides.map((guide) => (
                  <Link
                    key={guide.slug}
                    href={`/guides/${guide.slug}`}
                    className="group block rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-text-primary group-hover:text-amber-400 transition-colors">
                        {guide.title}
                      </h3>
                      <ArrowRight className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-sm text-text-muted mt-1">{guide.description}</p>
                    <p className="text-xs text-text-subtle mt-2">
                      {formatDate(guide.publishedDate)}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </>
  );
}