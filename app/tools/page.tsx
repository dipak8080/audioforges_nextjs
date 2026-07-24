import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { TOOLS } from "@/lib/data/tools";
import { ToolsExplorer } from "@/components/tools/ToolsExplorer";

export const metadata: Metadata = {
  title: "All Tools",
  description:
    "Every free audio tool on AudioForges: conversion, pitch and tempo, cleanup, and AI-powered tools for producers and DJs. No sign-up, no watermark.",
  alternates: { canonical: `${SITE_URL}/tools` },
  openGraph: {
    title: `All Tools | ${SITE_NAME}`,
    description: "Every free audio tool on AudioForges in one place.",
    url: `${SITE_URL}/tools`,
    siteName: SITE_NAME,
    type: "website",
  },
};

const collectionJsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "AudioForges Tools",
  url: `${SITE_URL}/tools`,
};

export default function ToolsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            All Tools
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Every free audio tool on AudioForges, in one place. No sign-up, no
            watermark — search or browse by category.
          </p>
        </header>

        <ToolsExplorer tools={TOOLS} />
      </main>
    </>
  );
}