import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("how-youtube-tools-fetch-then-process")!;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${guide.slug}`,
    siteName: "AudioForges",
    type: "article",
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
    title: guide.title,
    description: guide.description,
    images: ["/images/og-default.png"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: guide.title,
  description: guide.description,
  datePublished: guide.publishedDate,
  dateModified: guide.updatedDate,
  author: { "@type": "Organization", name: "AudioForges" },
  publisher: { "@type": "Organization", name: "AudioForges" },
  image: `${SITE_URL}/images/og-default.png`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
};

export default function YouTubeToolsArchitectureGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/guides" className="text-sm text-amber-400 hover:underline">
            ← All guides
          </Link>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-text-primary">
            {guide.title}
          </h1>
        </header>

        <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />

        <div className="space-y-6 text-text-muted leading-relaxed">
          <p>
            The YouTube Key &amp; BPM Finder, YouTube Vocal Remover, and
            YouTube Stem Splitter all look like simpler versions of their
            file-based counterparts — paste a link instead of uploading a
            file. Under the hood, they're doing more work, not less: each one
            chains a YouTube fetch together with whatever processing the tool
            actually does, and understanding that chain explains why these
            tools behave a little differently than uploading a file directly.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why these tools take longer than uploading a file
            </h2>
            <p>
              A file-based tool starts processing the moment you upload
              something. A YouTube-linked tool has an extra step first: the
              audio has to be fetched from YouTube before any analysis or
              separation can even begin. That fetch step adds real time on
              top of whatever the actual processing takes — which is why the
              YouTube Key &amp; BPM Finder runs 20–60 seconds instead of a
              near-instant file analysis, and why the YouTube Vocal Remover
              takes minutes rather than however long file-based separation
              alone would take.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why rate limits are stricter here
            </h2>
            <p>
              Chaining a YouTube fetch with CPU-intensive analysis or AI
              separation costs meaningfully more server resources than either
              step would alone — a single request can occupy both the
              download process and the processing queue in sequence. Because
              of that, these chained tools use a stricter, separate rate
              limit from their file-based equivalents rather than sharing the
              same allowance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why some videos can't be processed
            </h2>
            <p>
              Fetching audio depends entirely on whether the video is
              actually accessible to the downloader in the first place.
              Private videos, age-restricted content, and region-locked
              videos can all fail at that first step, before analysis or
              separation ever gets a chance to run — this isn&apos;t a
              limitation of the analysis or separation itself, it&apos;s a
              limitation of what the fetch step can reach.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What "no download step" actually saves you
            </h2>
            <p>
              Without one of these tools, getting a YouTube video&apos;s audio
              into a file-based tool means downloading it with a separate
              converter, saving the result, then uploading that file
              somewhere else — three separate steps across two different
              tools. Chaining the fetch into the same tool as the processing
              collapses that into pasting one link, at the cost of the
              combined wait time both steps take together.
            </p>
            <p>
              These tools all work the same underlying way — try the{" "}
              <Link href="/youtube-key-finder" className="text-amber-400 hover:underline">
                YouTube Key &amp; BPM Finder
              </Link>
              , the{" "}
              <Link href="/youtube-vocal-remover" className="text-amber-400 hover:underline">
                YouTube Vocal Remover
              </Link>
              , or the{" "}
              <Link href="/youtube-stem-splitter" className="text-amber-400 hover:underline">
                YouTube Stem Splitter
              </Link>{" "}
              directly, no account or software install needed for any of
              them.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/youtube-vocal-remover"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the YouTube Vocal Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}