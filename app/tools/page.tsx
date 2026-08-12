import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { TOOLS } from "@/lib/data/tools";
import { ToolsExplorer } from "@/components/tools/ToolsExplorer";

const PAGE_TITLE = "All Free Audio Tools | AudioForges";
const PAGE_DESCRIPTION =
  "Every free audio tool on AudioForges: conversion, pitch and tempo, cleanup, and AI-powered tools for producers and DJs. No sign-up, no watermark.";

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

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            All Free Audio Tools
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Every free audio tool on AudioForges, in one place. No sign-up, no
            watermark. Search or browse by category.
          </p>
        </header>

        <ToolsExplorer tools={TOOLS} />
      </main>
    </>
  );
}