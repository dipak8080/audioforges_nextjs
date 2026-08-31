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

const guide = getGuideBySlug("how-key-and-bpm-detection-works")!;

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

export default function KeyBpmDetectionGuidePage() {
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
            Run the same song through two different key-and-BPM detectors and
            it&apos;s not unusual to get two different answers — a BPM reading
            that&apos;s exactly half or double what you&apos;d tap out by hand, or
            a key a few steps away from what another tool reported. This
            isn&apos;t random noise. Both of those patterns have real,
            explainable causes rooted in how automatic detection actually works.
          </p>

          <h2 id="partial-analysis">Why only part of the track gets analyzed</h2>
          <p>
            Analyzing a full track in detail takes real processing time, and for
            the vast majority of songs, the key and tempo established in the first
            few minutes hold for the rest of the track anyway — so detection here
            analyzes up to the first 180 seconds of audio rather than the entire
            file. This keeps results fast without meaningfully changing accuracy
            for typical song structures. The exception is a track with a genuine
            structural shift later on — a key change in a bridge or outro, or a
            tempo ramp deep into an extended mix — which won&apos;t be reflected
            in a result based on the earlier portion of the track.
          </p>

          <h2 id="octave-error">Why BPM sometimes reads as half or double</h2>
          <p>
            Tempo detection algorithms work by finding the strongest repeating
            rhythmic pulse in a track, and that pulse is genuinely ambiguous in a
            lot of music — a track built around a strong backbeat can have its
            detector lock onto either the underlying beat or a subdivision of it,
            producing a BPM reading exactly half or double the tempo a human would
            tap along to. This is a well-known challenge in tempo detection
            generally, not a bug specific to any one tool. Detection here nudges
            results toward the range most music actually falls into — roughly 70
            to 180 BPM — specifically to correct for this kind of octave error.
            That sanity check helps in the common case, but a track genuinely
            outside that typical range can occasionally get nudged toward an
            incorrect reading as a side effect.
          </p>

          <h2 id="confidence">Why confidence can be lower on some tracks</h2>
          <p>
            Detection doesn&apos;t rely on a single pass and present whatever
            comes out as certain — key and tempo are each checked in more than one
            way, and when those checks disagree with each other, the confidence
            attached to the result is reduced rather than silently picking one
            answer and hiding the disagreement. A lower confidence score is the
            tool telling you honestly that the source material gave it a genuinely
            harder read — often a track with an ambiguous or shifting tempo,
            unusual harmonic content, or heavy processing that obscures the
            underlying pulse or pitch center.
          </p>

          <h2 id="camelot">
            What this means if you&apos;re using Camelot notation
          </h2>
          <p>
            Getting a different key or BPM reading from another tool for the same
            track isn&apos;t necessarily a sign either tool is wrong — different
            detectors use different methods, and both of the patterns above
            (octave ambiguity, structural changes later in a track) can cause two
            reasonable analyses to land on different answers. For harmonic mixing
            specifically, treat a detected key and its Camelot code as a strong
            starting point rather than an infallible one, and use your ears to
            confirm a transition sounds right before committing to it in a set.
          </p>
          <p>
            Our <Link href="/key-finder">Key &amp; BPM Finder</Link> and{" "}
            <Link href="/youtube-key-finder">YouTube Key &amp; BPM Finder</Link>{" "}
            both run this same analysis — upload a file or paste a link, and get
            back the detected key, BPM, and Camelot code, no account or software
            install needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/youtube-key-finder" className={buttonStyles({ size: "lg" })}>
            Try the YouTube Key &amp; BPM Finder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}