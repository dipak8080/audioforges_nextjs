import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("how-tap-tempo-detection-works")!;

const OG_IMAGE = ogForGuide(guide);

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: [OG_IMAGE.url],
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
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function TapTempoGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb
          items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]}
          className="mb-8"
        />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            Tap along to a beat for a while and you might expect a tap tempo tool
            to get more and more accurate the longer you keep going — more data,
            better average. That&apos;s not quite how it works. A well-built tap
            tempo detector deliberately forgets your earliest taps rather than
            folding them all into one giant average, and understanding why
            explains both why it&apos;s responsive and why a brief pause
            doesn&apos;t ruin your result.
          </p>

          <h2 id="rolling-window">Why only your most recent taps count</h2>
          <p>
            Rather than averaging every tap from the moment you started, the tool
            keeps a rolling window of only the most recent eight taps and drops
            anything older. That&apos;s a deliberate choice: if every tap ever
            made counted equally, someone gradually speeding up or slowing down
            over a long tapping session would get an estimate dragged toward their
            old, no-longer-current pace by taps from a minute ago. A rolling
            window keeps the estimate responsive to your current tempo instead of
            anchored to wherever you started.
          </p>

          <h2 id="pause-resets">Why a short pause starts a fresh count</h2>
          <p>
            If you stop tapping for more than about two seconds, the next tap
            starts an entirely new session rather than being treated as a
            continuation of the old one. Without that rule, a three-second gap
            between taps would be read as a single beat lasting three seconds — an
            enormous, corrupting outlier that would throw the average tempo
            estimate wildly low. Starting fresh after a pause means an accidental
            gap costs you a few taps to re-establish the rhythm, rather than
            costing you a broken result.
          </p>

          <h2 id="calculation">How the BPM number is actually calculated</h2>
          <p>
            The calculation itself is straightforward: measure the time between
            each consecutive pair of taps, average those intervals across the
            current window, then convert that average interval into beats per
            minute. There&apos;s no beat-tracking algorithm inferring a tempo from
            audio here — it&apos;s a direct measurement of how much time elapsed
            between your own taps, which is exactly why tapping consistently
            matters more than tapping a lot.
          </p>

          <h2 id="stable-reading">Getting a stable reading</h2>
          <p>
            Since the window holds up to eight taps, tapping at least that many
            gives the average room to settle rather than being dominated by your
            first couple of taps, which are usually the least steady. A single
            rushed or delayed tap won&apos;t wreck the result on its own, since
            it&apos;s just one interval among several being averaged — but a
            consistent, steady rhythm throughout still gives the most reliable
            number.
          </p>
          <p>
            Our <Link href="/bpm-tapper">BPM Tapper</Link> runs this exact process
            — tap along to a beat, watch the BPM update live, and send the result
            straight to the <Link href="/metronome">Metronome</Link> once
            you&apos;ve got it.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/bpm-tapper" className={buttonStyles({ size: "lg" })}>
            Try the BPM Tapper
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}