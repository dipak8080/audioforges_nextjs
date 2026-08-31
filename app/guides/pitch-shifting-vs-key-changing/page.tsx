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

const guide = getGuideBySlug("pitch-shifting-vs-key-changing")!;

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

export default function PitchShiftingGuidePage() {
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
            The old way to change a track&apos;s pitch was to just play it faster
            or slower — speed it up and the pitch rises, slow it down and the
            pitch drops. That works, but it comes with a cost most people
            don&apos;t want: the tempo changes right along with it. Real pitch
            shifting solves a different problem — moving the pitch on its own,
            with the tempo left exactly where it was.
          </p>

          <h2 id="not-speed">Why speeding up a track isn&apos;t pitch shifting</h2>
          <p>
            Playing a file faster or slower resamples it — every part of the
            audio, pitch and tempo alike, scales together by the same factor. A
            track played at 1.06x speed sounds a semitone higher, but it also
            finishes several seconds earlier. That&apos;s a real limitation
            anytime you need the original timing to stay intact — testing a sample
            against a beat, practicing along with a backing track, or transposing
            a vocal without shifting where the downbeats land.
          </p>

          <h2 id="how-it-works">How true pitch shifting keeps tempo intact</h2>
          <p>
            A dedicated pitch-shifting engine separates the two variables instead
            of scaling them together — it moves the pitch of the audio while
            independently preserving the original duration and timing. The
            tradeoff is computational cost: this kind of processing takes
            meaningfully more work than a simple speed change, which is why
            pitch-shifting tools are often rate-limited compared to lighter
            operations like format conversion.
          </p>

          <h2 id="semitones">Thinking in semitones</h2>
          <p>
            Pitch shift amounts are measured in semitones — the smallest step in
            Western music, with 12 semitones making a full octave. A shift of +7
            semitones moves a track up a perfect fifth; +12 moves it up a full
            octave. Small shifts (a semitone or two) are useful for subtle
            retuning; larger shifts toward a full octave start to sound noticeably
            different in timbre, since formants (the resonances that give a voice
            or instrument its characteristic tone) shift along with the pitch.
          </p>

          <h2 id="use-cases">Common reasons to shift pitch</h2>
          <dl>
            <dt>Finding a comfortable vocal range</dt>
            <dd>
              Transpose a track up or down to sit better in your own singing range
              for practice, without the backing track speeding up or slowing down
              underneath you.
            </dd>

            <dt>Testing a sample in a different key</dt>
            <dd>
              Hear how a sample fits a session&apos;s key before committing it to
              the arrangement.
            </dd>

            <dt>Building a remix variation</dt>
            <dd>
              A pitched-up or pitched-down version of a source track, with tempo
              held constant so it still lines up with the rest of the arrangement.
            </dd>
          </dl>

          <h2 id="reverse">If you need the opposite: tempo without pitch</h2>
          <p>
            Sometimes the problem runs the other way — you want a track faster or
            slower without the key moving. That&apos;s a separate operation built
            on the same underlying approach, just applied to speed instead of
            pitch. Our <Link href="/pitch">Pitch Shifter</Link> handles up to a
            full octave in either direction with tempo held constant; the{" "}
            <Link href="/tempo">Tempo Changer</Link> does the reverse — speed
            adjusted independently of key.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/pitch" className={buttonStyles({ size: "lg" })}>
            Try the Pitch Shifter
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/tempo"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Try the Tempo Changer
          </Link>
        </div>
      </main>
    </>
  );
}