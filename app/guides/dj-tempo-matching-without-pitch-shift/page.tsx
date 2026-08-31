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

const guide = getGuideBySlug("dj-tempo-matching-without-pitch-shift")!;

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

export default function TempoMatchingGuidePage() {
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
            Matching two tracks&apos; tempos used to mean living with a side
            effect: speed up one track on a turntable or in a basic player and its
            pitch rises with it, slow it down and the pitch drops. For small
            nudges that&apos;s barely noticeable, but push it further and a track
            starts sounding like it&apos;s in the wrong key entirely — which is a
            real problem if you&apos;re also trying to keep two tracks
            harmonically compatible while you blend them.
          </p>

          <h2 id="why-linked">Why tempo and pitch are usually linked</h2>
          <p>
            A basic speed change works by resampling — playing back more or fewer
            samples per second than the file was recorded at. That single
            adjustment moves tempo and pitch together, because both are just a
            function of playback rate. There&apos;s no way to separate them with a
            simple speed control; you get one dial that changes two things whether
            you want that or not.
          </p>

          <h2 id="decoupled">What changes when tempo and pitch are decoupled</h2>
          <p>
            A time-stretching engine solves this by processing the audio
            differently — it can add or remove tiny slices of audio to change
            duration while reconstructing the waveform to keep the original pitch.
            The result: a track played at 128% speed keeps its original key, and a
            track slowed to 85% still sounds like it&apos;s in the same key, just
            unfolding more slowly. This is what makes it possible to match two
            tracks&apos; BPMs for a mashup or a DJ transition without also having
            to deal with a key clash.
          </p>

          <h2 id="how-far">How far you can push a tempo change</h2>
          <p>
            Small tempo nudges — a few BPM in either direction — are close to
            undetectable to most listeners and are the normal range for matching
            two tracks in a set. Larger changes start to introduce their own
            artifacts: time-stretching too aggressively can make transients (drum
            hits, plucks, anything percussive) sound smeared or slightly
            artificial, since the engine is reconstructing more of the waveform to
            hit the new duration. As a practical guide, changes within roughly
            ±10% of the original tempo tend to hold up well; pushing toward the
            extremes of a tool&apos;s range (half speed or double speed) is more
            of a creative effect than a transparent tempo match.
          </p>

          <h2 id="uses">Practical uses beyond DJing</h2>
          {/* Was a <ul> of bold lead-ins — term/explanation pairs, so the dl
              renders them properly. */}
          <dl>
            <dt>Matching two tracks for a mashup</dt>
            <dd>
              Bring one track&apos;s BPM in line with another&apos;s without
              shifting either one&apos;s key.
            </dd>

            <dt>Slowing down a passage to learn it</dt>
            <dd>
              Drop the speed on a fast section to pick out notes or a drum
              pattern, without the pitch dropping into a range that&apos;s harder
              to reference against the original.
            </dd>

            <dt>Speeding up spoken content</dt>
            <dd>
              Get through a lecture or podcast faster without the voice shifting
              into a distractingly higher register.
            </dd>
          </dl>

          <h2 id="reverse">If you need the reverse</h2>
          <p>
            Sometimes the problem is the other way around — you want a different
            key at the same tempo, not a different tempo at the same key. Our{" "}
            <Link href="/tempo">Tempo Changer</Link> covers half-speed to
            double-speed with pitch held constant; the{" "}
            <Link href="/pitch">Pitch Shifter</Link> runs the same underlying
            approach in the other direction — shifting key while tempo stays
            fixed.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/tempo" className={buttonStyles({ size: "lg" })}>
            Try the Tempo Changer
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pitch"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Try the Pitch Shifter
          </Link>
        </div>
      </main>
    </>
  );
}