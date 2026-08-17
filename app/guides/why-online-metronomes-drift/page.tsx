import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("why-online-metronomes-drift")!;

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

export default function MetronomeDriftGuidePage() {
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
            Leave a lot of online metronomes running for a couple of minutes
            and the click gradually stops lining up with where it should
            be — a fraction of a second early or late at first, more
            noticeable the longer it runs. This isn&apos;t random bad luck.
            It&apos;s a well-understood consequence of how browsers handle
            timing, and it's fixable with a specific, deliberate technique
            rather than a better version of the same approach.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why a plain JavaScript timer isn't good enough
            </h2>
            <p>
              The obvious way to build a metronome is a repeating timer that
              fires once per beat and plays a sound each time. The problem is
              that a JavaScript timer is never guaranteed to fire at exactly
              the interval you asked for — browser throttling, other activity
              in the same tab, and brief pauses for garbage collection all
              introduce small delays. Any individual delay is tiny and
              inaudible on its own, but they accumulate. A metronome that's a
              few milliseconds late on every single beat is noticeably out of
              time within a minute or two, even though nothing about the code
              is technically broken.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The look-ahead scheduling technique
            </h2>
            <p>
              The fix separates two things that a naive approach conflates:
              deciding when to schedule the next beats, and actually playing
              them. A lightweight timer still runs frequently in the
              background — every 25 milliseconds — but instead of playing a
              click the moment it fires, it looks ahead about a tenth of a
              second and schedules any beats that fall within that window
              directly against the audio hardware&apos;s own clock, which is
              sample-accurate in a way a JavaScript timer never is. That
              audio clock, not the background timer, is what actually
              determines the exact moment each click plays. The background
              timer only decides when to schedule the next batch of beats —
              a small imprecision there doesn't translate into audible drift,
              because playback itself is locked to hardware timing rather
              than to the timer that triggered the scheduling.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why the visual beat indicator stays in sync too
            </h2>
            <p>
              A metronome that flashes a light on each beat has a second
              place drift can creep in: if the visual indicator runs off its
              own separate timer, it can fall out of sync with the audio even
              if the audio itself is perfectly scheduled. The fix is to drive
              the visual indicator off the exact same scheduled beat times
              used for the audio, checked against the audio clock rather than
              a separate visual timer — so what you see stays locked to what
              you actually hear instead of slowly drifting apart from it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why the downbeat sounds different
            </h2>
            <p>
              The first beat of each measure is generated at a higher pitch
              and slightly louder volume than the other beats, the same way
              a physical metronome or a drummer distinguishes beat one from
              the rest of the bar. Rather than loading a separate audio file
              for the accent, each click is a short synthesized tone with a
              fast decay — the accented beat just uses a higher frequency and
              more gain than the regular beats, generated the same way every
              time.
            </p>
            <p>
              Our{" "}
              <Link href="/metronome" className="text-amber-400 hover:underline">
                Online Metronome
              </Link>{" "}
              uses this exact scheduling approach — set a tempo from 30 to
              300 BPM, pick your time signature, and it holds steady for as
              long as you leave it running, no account or software install
              needed.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/metronome"
            className={buttonStyles({ size: "lg" })}
          >
            Try the Online Metronome
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}