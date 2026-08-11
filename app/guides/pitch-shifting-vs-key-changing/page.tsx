import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("pitch-shifting-vs-key-changing")!;

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
};

export default function PitchShiftingGuidePage() {
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
            The old way to change a track&apos;s pitch was to just play it faster
            or slower — speed it up and the pitch rises, slow it down and the
            pitch drops. That works, but it comes with a cost most people don&apos;t
            want: the tempo changes right along with it. Real pitch shifting
            solves a different problem — moving the pitch on its own, with the
            tempo left exactly where it was.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why speeding up a track isn&apos;t pitch shifting
            </h2>
            <p>
              Playing a file faster or slower resamples it — every part of the
              audio, pitch and tempo alike, scales together by the same factor.
              A track played at 1.06x speed sounds a semitone higher, but it also
              finishes several seconds earlier. That&apos;s a real limitation
              anytime you need the original timing to stay intact — testing a
              sample against a beat, practicing along with a backing track, or
              transposing a vocal without shifting where the downbeats land.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How true pitch shifting keeps tempo intact
            </h2>
            <p>
              A dedicated pitch-shifting engine separates the two variables
              instead of scaling them together — it moves the pitch of the audio
              while independently preserving the original duration and timing.
              The tradeoff is computational cost: this kind of processing takes
              meaningfully more work than a simple speed change, which is why
              pitch-shifting tools are often rate-limited compared to lighter
              operations like format conversion.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Thinking in semitones
            </h2>
            <p>
              Pitch shift amounts are measured in semitones — the smallest step
              in Western music, with 12 semitones making a full octave. A shift
              of +7 semitones moves a track up a perfect fifth; +12 moves it up a
              full octave. Small shifts (a semitone or two) are useful for subtle
              retuning; larger shifts toward a full octave start to sound
              noticeably different in timbre, since formants (the resonances
              that give a voice or instrument its characteristic tone) shift
              along with the pitch.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Common reasons to shift pitch
            </h2>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-text-primary">Finding a comfortable vocal range</strong>{" "}
                — transpose a track up or down to sit better in your own
                singing range for practice, without the backing track speeding
                up or slowing down underneath you.
              </li>
              <li>
                <strong className="text-text-primary">Testing a sample in a different key</strong>{" "}
                — hear how a sample fits a session&apos;s key before committing
                it to the arrangement.
              </li>
              <li>
                <strong className="text-text-primary">Building a remix variation</strong>{" "}
                — a pitched-up or pitched-down version of a source track, with
                tempo held constant so it still lines up with the rest of the
                arrangement.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              If you need the opposite: tempo without pitch
            </h2>
            <p>
              Sometimes the problem runs the other way — you want a track faster
              or slower without the key moving. That&apos;s a separate operation
              built on the same underlying approach, just applied to speed
              instead of pitch. Our{" "}
              <Link href="/pitch" className="text-amber-400 hover:underline">
                Pitch Shifter
              </Link>{" "}
              handles up to a full octave in either direction with tempo held
              constant; the{" "}
              <Link href="/tempo" className="text-amber-400 hover:underline">
                Tempo Changer
              </Link>{" "}
              does the reverse — speed adjusted independently of key.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/pitch"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Pitch Shifter
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/tempo"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Tempo Changer
          </Link>
        </div>
      </main>
    </>
  );
}