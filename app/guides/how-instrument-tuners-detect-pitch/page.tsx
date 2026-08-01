import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("how-instrument-tuners-detect-pitch")!;

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

export default function TunerPitchDetectionGuidePage() {
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
            It's tempting to assume a tuner just listens for "the loudest
            frequency" and reports that back as the note being played. A good
            tuner does something more deliberate than that — and the specific
            technique it uses is exactly why it can tell 440Hz and 442Hz
            apart instead of blurring them into the same reading.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why tuners don't just look for the loudest frequency
            </h2>
            <p>
              One obvious approach is to break the incoming audio down into
              frequency bands and report whichever one has the most energy.
              The problem is resolution: at the buffer sizes practical for
              real-time detection, that frequency-domain approach simply
              isn't precise enough to distinguish two pitches that are close
              together — the difference between being perfectly in tune and
              being noticeably sharp can be a couple of Hz, well below what
              that method can reliably separate.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Autocorrelation: reading the waveform's repeating pattern
            </h2>
            <p>
              Instead, an accurate tuner analyzes the actual shape of the
              sound wave over time and measures how closely it matches
              itself when shifted forward by different amounts — a technique
              called autocorrelation. A pitched sound repeats at a regular
              interval; autocorrelation finds that interval directly by
              testing how well the wave lines up with a delayed copy of
              itself, and the delay that produces the strongest match reveals
              the note's true fundamental frequency. This operates on the raw
              waveform rather than a frequency breakdown, which is what gives
              it the finer precision a simple loudest-frequency approach
              can't match.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why background noise doesn't trigger a false reading
            </h2>
            <p>
              Before any pitch is calculated at all, the incoming signal has
              to clear a minimum loudness threshold. Room hum, a quiet
              background, or the moment just before you start playing all sit
              below that threshold and are treated as silence rather than
              analyzed for a pitch — without this check, a tuner would
              flicker to random, meaningless notes any time the room
              wasn't perfectly quiet, even with no instrument being played at
              all.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why a tuner turns off echo cancellation and noise suppression
            </h2>
            <p>
              Most apps that use your microphone — voice chat, video calls,
              voice recorders — leave your browser's built-in echo
              cancellation, noise suppression, and automatic gain control
              turned on, since those features genuinely help spoken audio
              sound clearer. A tuner deliberately turns all three off
              instead. That processing is built and tuned for voice, and it
              can subtly reshape the waveform in ways that interfere with
              exactly the kind of precise, repeating pattern autocorrelation
              needs to read accurately. Getting the rawest possible signal
              from the microphone matters more here than it does for a phone
              call.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              How cents and note names get calculated
            </h2>
            <p>
              Once a fundamental frequency is found, it&apos;s converted to
              the nearest musical note using the standard equal-temperament
              reference of A4 = 440Hz, the same reference virtually all
              modern tuning is built around. The difference between the
              detected frequency and the nearest in-tune note is expressed in
              cents — hundredths of a semitone — which is why a tuner can
              show you "how far off" you are rather than just which note is
              closest.
            </p>
            <p>
              Our{" "}
              <Link href="/tuner" className="text-amber-400 hover:underline">
                Online Tuner
              </Link>{" "}
              runs this exact autocorrelation-based detection live from your
              microphone — no account or software install needed, and
              nothing you play is ever recorded or uploaded.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/tuner"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Online Tuner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}