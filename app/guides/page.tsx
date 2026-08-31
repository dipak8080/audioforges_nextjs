import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { guides } from "@/lib/guides";
import { GuidesExplorer } from "@/components/guides/GuidesExplorer";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ogImage } from "@/lib/og";

// The root layout sets `title.template = "%s | AudioForges"`, which applies
// to `metadata.title` ONLY — Next does not apply it to openGraph.title,
// because the root's openGraph.title is a plain string rather than a
// template object. So:
//   PAGE_TITLE   — no brand suffix; the template adds it
//   SOCIAL_TITLE — brand included by hand, since nothing appends it here
// Using one constant for both rendered "… | AudioForges | AudioForges".
const PAGE_TITLE = "Guides for Producers & DJs";
const SOCIAL_TITLE = `${PAGE_TITLE} | AudioForges`;
const PAGE_DESCRIPTION =
  "Practical guides on harmonic mixing, sampling, set prep, and production workflow, written from real studio and DJ experience.";

const OG_IMAGE = ogImage(
  "Guides for producers & DJs",
  "Harmonic mixing, sampling, set prep and cleanup — written from the studio.",
  `${guides.length} guides · Free to read`
);

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "AudioForges Guides",
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/guides`,
};

/** Newest first, carrying description and date rather than just a URL and
 *  title. Same shape as the ItemList on /tools, so both index pages
 *  describe their contents the same way. */
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

// BreadcrumbList comes from <Breadcrumb /> — don't hand-write one here.

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

      {/* max-w-6xl matches the nav, footer, homepage and /tools. */}
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <Breadcrumb items={[{ name: "Guides" }]} className="mb-8" />

        <header>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            {guides.length} guides · free to read
          </p>
          <h1 className="measure-wide mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-text-primary sm:text-6xl">
            Guides for producers &amp; DJs
          </h1>
          <p className="measure-wide mt-5 text-lg leading-relaxed text-text-muted sm:text-xl">
            Practical, from-the-studio writing on harmonic mixing, sampling, set prep and cleanup.
            Search by topic or filter by category.
          </p>
        </header>

        <div className="mt-8">
          <GuidesExplorer guides={guides} />
        </div>
      </main>
    </>
  );
}