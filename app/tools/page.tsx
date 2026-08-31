import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { TOOLS } from "@/lib/data/tools";
import { ToolsExplorer } from "@/components/tools/ToolsExplorer";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ogImage } from "@/lib/og";

const liveTools = TOOLS.filter((t) => t.status === "live");

// No "| AudioForges" — the root layout's title template appends it, and
// hardcoding it produced "... | AudioForges | AudioForges" in the SERP.
const PAGE_TITLE = "All Free Audio Tools";

// Kept under ~155 characters so Google doesn't truncate mid-sentence. The
// previous version ran to 172 and lost "No sign-up, no watermark" — the
// part most likely to earn the click.
const PAGE_DESCRIPTION = `All ${liveTools.length} free audio tools: conversion, key and BPM detection, vocal removal, stem splitting, cleanup, pitch and tempo. No sign-up, no watermark.`;

const OG_IMAGE = ogImage(
  "All free audio tools",
  "Conversion, key and BPM, stems, cleanup, pitch and tempo — in the browser.",
  `${liveTools.length} tools · No sign-up`
);

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "AudioForges Tools",
  description: PAGE_DESCRIPTION,
  url: `${SITE_URL}/tools`,
};

/**
 * CollectionPage says a collection exists; this says what's in it. Every
 * live tool with name, description and URL.
 *
 * LIVE TOOLS ONLY — coming-soon entries have no page behind them, and
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

// BreadcrumbList comes from <Breadcrumb /> — don't hand-write one here.

export default function ToolsPage() {
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

      {/* max-w-6xl matches the nav, footer and homepage, and gives the
          explorer's xl:grid-cols-3 the room to trigger. */}
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <Breadcrumb items={[{ name: "Tools" }]} className="mb-8" />

        <header>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            {liveTools.length} tools · no sign-up
          </p>
          <h1 className="measure-wide mt-5 text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-text-primary sm:text-6xl">
            All free audio tools
          </h1>
          <p className="measure-wide mt-5 text-lg leading-relaxed text-text-muted sm:text-xl">
            Search by name or by what you want to do, or filter by category. Every tool takes an
            uploaded file — no account, no watermark.
          </p>
        </header>

        {/* mt-8, not mt-12: with the header left-aligned, a larger gap made
            the search box read as the start of a new section rather than as
            part of this page. */}
        <div className="mt-8">
          <ToolsExplorer tools={TOOLS} />
        </div>
      </main>
    </>
  );
}