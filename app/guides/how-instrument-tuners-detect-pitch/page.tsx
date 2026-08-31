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

const guide = getGuideBySlug("how-instrument-tuners-detect-pitch")!;

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

export default function TunerPitchDetectionGuidePage() {
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
            It&apos;s tempting to assume a tuner just listens for &quot;the
            loudest frequency&quot; and reports that back as the note being
            played. A good tuner does something more deliberate than that — and
            the specific technique it uses is exactly why it can tell 440Hz and
            442Hz apart instead of blurring them into the same reading.
          </p>

          <h2 id="not-loudest">Why tuners don&apos;t just look for the loudest frequency</h2>
          <p>
            One obvious approach is to break the incoming audio down into
            frequency bands and report whichever one has the most energy. The
            problem is resolution: at the buffer sizes practical for real-time
            detection, that frequency-domain approach simply isn&apos;t precise
            enough to distinguish two pitches that are close together — the
            difference between being perfectly in tune and being noticeably sharp
            can be a couple of Hz, well below what that method can reliably
            separate.
          </p>

          <h2 id="autocorrelation">
            Autocorrelation: reading the waveform&apos;s repeating pattern
          </h2>
          <p>
            Instead, an accurate tuner analyzes the actual shape of the sound wave
            over time and measures how closely it matches itself when shifted
            forward by different amounts — a technique called autocorrelation. A
            pitched sound repeats at a regular interval; autocorrelation finds
            that interval directly by testing how well the wave lines up with a
            delayed copy of itself, and the delay that produces the strongest
            match reveals the note&apos;s true fundamental frequency. This
            operates on the raw waveform rather than a frequency breakdown, which
            is what gives it the finer precision a simple loudest-frequency
            approach can&apos;t match.
          </p>

          <h2 id="noise-gate">Why background noise doesn&apos;t trigger a false reading</h2>
          <p>
            Before any pitch is calculated at all, the incoming signal has to
            clear a minimum loudness threshold. Room hum, a quiet background, or
            the moment just before you start playing all sit below that threshold
            and are treated as silence rather than analyzed for a pitch — without
            this check, a tuner would flicker to random, meaningless notes any
            time the room wasn&apos;t perfectly quiet, even with no instrument
            being played at all.
          </p>

          <h2 id="raw-signal">
            Why a tuner turns off echo cancellation and noise suppression
          </h2>
          <p>
            Most apps that use your microphone — voice chat, video calls, voice
            recorders — leave your browser&apos;s built-in echo cancellation,
            noise suppression, and automatic gain control turned on, since those
            features genuinely help spoken audio sound clearer. A tuner
            deliberately turns all three off instead. That processing is built and
            tuned for voice, and it can subtly reshape the waveform in ways that
            interfere with exactly the kind of precise, repeating pattern
            autocorrelation needs to read accurately. Getting the rawest possible
            signal from the microphone matters more here than it does for a phone
            call.
          </p>

          <h2 id="cents">How cents and note names get calculated</h2>
          <p>
            Once a fundamental frequency is found, it&apos;s converted to the
            nearest musical note using the standard equal-temperament reference of
            A4 = 440Hz, the same reference virtually all modern tuning is built
            around. The difference between the detected frequency and the nearest
            in-tune note is expressed in cents — hundredths of a semitone — which
            is why a tuner can show you &quot;how far off&quot; you are rather
            than just which note is closest.
          </p>
          <p>
            Our <Link href="/tuner">Online Tuner</Link> runs this exact
            autocorrelation-based detection live from your microphone — no account
            or software install needed, and nothing you play is ever recorded or
            uploaded.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/tuner" className={buttonStyles({ size: "lg" })}>
            Try the Online Tuner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}