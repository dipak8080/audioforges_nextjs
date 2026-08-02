import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { guides } from "@/lib/guides";
import { GuidesExplorer } from "@/components/guides/GuidesExplorer";

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

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Guides
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Practical, from-the-studio guides on mixing, sampling, and production
            workflow — search or browse by category.
          </p>
        </header>

        <GuidesExplorer guides={guides} />
      </main>
    </>
  );
}