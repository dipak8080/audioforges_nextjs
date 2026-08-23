// → app/guides/page.tsx

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { guides } from "@/lib/guides";
import { GuidesExplorer } from "@/components/guides/GuidesExplorer";

// The root layout sets `title.template = "%s | AudioForges"`, which applies
// to `metadata.title` ONLY — Next.js does not apply it to openGraph.title,
// because the root's openGraph.title is a plain string rather than a
// template object. So:
//   PAGE_TITLE   — no brand suffix; the template adds it → "… | AudioForges"
//   SOCIAL_TITLE — brand included by hand, since nothing appends it here
// Previously both used one constant that already carried the suffix, so the
// rendered <title> came out "Guides for Producers & DJs | AudioForges |
// AudioForges". Flagged by Ahrefs as "Page and SERP titles do not match".
const PAGE_TITLE = "Guides for Producers & DJs";
const SOCIAL_TITLE = `${PAGE_TITLE} | AudioForges`;
const PAGE_DESCRIPTION =
  "Practical guides on harmonic mixing, sampling, set prep, and production workflow, written from real studio and DJ experience.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/guides` },
  openGraph: {
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/guides`,
    siteName: "AudioForges",
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "AudioForges Guides",
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/guides`,
};

/**
 * Newest first, and carrying description + date rather than just a URL and
 * a title. Same shape as the ItemList on /tools, so both index pages
 * describe their contents the same way.
 */
const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "AudioForges guides",
  numberOfItems: guides.length,
  itemListElement: [...guides]
    .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
    .map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/guides/${guide.slug}`,
      name: guide.title,
      description: guide.description,
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

export default function GuidesIndexPage() {
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

      {/* max-w-6xl matches the nav, footer, homepage and /tools. At
          max-w-3xl this page was half the width of the header above it,
          and the guide list had no room to be anything but one long
          column. */}
      <main id="main" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            {guides.length} guides · free to read
          </p>
          {/* Sentence case, matching the h1 on the homepage and /tools. */}
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Guides for producers &amp; DJs
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Practical, from-the-studio writing on harmonic mixing, sampling, set prep and cleanup.
            Search by topic or filter by category.
          </p>
        </header>

        <div className="mt-12">
          <GuidesExplorer guides={guides} />
        </div>
      </main>
    </>
  );
}