import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("how-tap-tempo-detection-works")!;

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

export default function TapTempoGuidePage() {
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
            Tap along to a beat for a while and you might expect a tap tempo
            tool to get more and more accurate the longer you keep going — more
            data, better average. That's not quite how it works. A well-built
            tap tempo detector deliberately forgets your earliest taps rather
            than folding them all into one giant average, and understanding
            why explains both why it's responsive and why a brief pause
            doesn't ruin your result.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why only your most recent taps count
            </h2>
            <p>
              Rather than averaging every tap from the moment you started,
              the tool keeps a rolling window of only the most recent eight
              taps and drops anything older. That's a deliberate choice: if
              every tap ever made counted equally, someone gradually speeding
              up or slowing down over a long tapping session would get an
              estimate dragged toward their old, no-longer-current pace by
              taps from a minute ago. A rolling window keeps the estimate
              responsive to your current tempo instead of anchored to
              wherever you started.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why a short pause starts a fresh count
            </h2>
            <p>
              If you stop tapping for more than about two seconds, the next
              tap starts an entirely new session rather than being treated as
              a continuation of the old one. Without that rule, a three-second
              gap between taps would be read as a single beat lasting three
              seconds — an enormous, corrupting outlier that would throw the
              average tempo estimate wildly low. Starting fresh after a pause
              means an accidental gap costs you a few taps to re-establish
              the rhythm, rather than costing you a broken result.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How the BPM number is actually calculated
            </h2>
            <p>
              The calculation itself is straightforward: measure the time
              between each consecutive pair of taps, average those
              intervals across the current window, then convert that average
              interval into beats per minute. There&apos;s no beat-tracking
              algorithm inferring a tempo from audio here — it's a direct
              measurement of how much time elapsed between your own taps,
              which is exactly why tapping consistently matters more than
              tapping a lot.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Getting a stable reading
            </h2>
            <p>
              Since the window holds up to eight taps, tapping at least that
              many gives the average room to settle rather than being
              dominated by your first couple of taps, which are usually the
              least steady. A single rushed or delayed tap won&apos;t wreck
              the result on its own, since it's just one interval among
              several being averaged — but a consistent, steady rhythm
              throughout still gives the most reliable number.
            </p>
            <p>
              Our{" "}
              <Link href="/bpm-tapper" className="text-amber-400 hover:underline">
                BPM Tapper
              </Link>{" "}
              runs this exact process — tap along to a beat, watch the BPM
              update live, and send the result straight to the{" "}
              <Link href="/metronome" className="text-amber-400 hover:underline">
                Metronome
              </Link>{" "}
              once you've got it.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/bpm-tapper"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the BPM Tapper
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}