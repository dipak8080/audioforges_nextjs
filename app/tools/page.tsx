// → app/tools/page.tsx

import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { TOOLS } from "@/lib/data/tools";
import { ToolsExplorer } from "@/components/tools/ToolsExplorer";

const liveTools = TOOLS.filter((t) => t.status === "live");

const PAGE_TITLE = "All Free Audio Tools | AudioForges";

// "AI-powered" removed: it describes how a few tools are built, not what
// any of them do for the person reading the result, and it's the exact
// marketing register the rest of the site avoids. Naming the actual jobs
// also matches more of what people search for.
const PAGE_DESCRIPTION = `All ${liveTools.length} free audio tools on AudioForges: conversion, key and BPM detection, vocal removal, stem splitting, cleanup, pitch and tempo, transcription. No sign-up, no watermark.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tools` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/tools`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "AudioForges Tools",
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/tools`,
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Tools", item: `${SITE_URL}/tools` },
  ],
};

/**
 * The CollectionPage above says a collection exists; this says what is in
 * it. Every live tool, with its name, description and URL - the single
 * best structured-data addition available on this page, and it's free
 * because the data is already in TOOLS.
 *
 * LIVE TOOLS ONLY. Coming-soon entries have no page behind them, and
 * listing URLs that 404 in structured data is worse than omitting them.
 */
const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Free audio tools",
  numberOfItems: liveTools.length,
  itemListElement: liveTools.map((tool, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: tool.name,
    description: tool.shortDescription,
    url: `${SITE_URL}/${tool.slug}`,
  })),
};

export default function ToolsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      {/* max-w-6xl matches the nav, footer and homepage. At max-w-5xl this
          page sat 64px inside the header above it, and the explorer's
          xl:grid-cols-3 never had the room to trigger. */}
      <main id="main" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            {liveTools.length} tools · no sign-up
          </p>
          {/* Sentence case, matching the homepage h1. Title Case was the
              only heading on the site styled that way. */}
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            All free audio tools
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Search by name or by what you want to do, or filter by category. Every tool takes an
            uploaded file — no account, no watermark.
          </p>
        </header>

        <div className="mt-12">
          <ToolsExplorer tools={TOOLS} />
        </div>
      </main>
    </>
  );
}