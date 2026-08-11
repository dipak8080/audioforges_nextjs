import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("wav-vs-mp3-for-sampling")!;

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

export default function WavVsMp3GuidePage() {
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
            &quot;Always use WAV&quot; is the advice you&apos;ll see repeated
            everywhere, and it&apos;s not wrong — but it skips the actual reason,
            which means people apply it in situations where it doesn&apos;t matter
            and ignore it in situations where it really does.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What&apos;s technically different
            </h2>
            <p>
              WAV stores audio uncompressed — every sample, bit for bit. MP3 throws
              away data the format&apos;s psychoacoustic model predicts you won&apos;t
              notice, which is how it shrinks a file to roughly a tenth the size. At
              320kbps, that prediction is good enough that most listeners can&apos;t
              reliably tell the difference in a blind A/B test on a finished track.
            </p>
            <p>
              The problem isn&apos;t how MP3 sounds on first listen — it&apos;s what
              happens when you process it further.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Where compression artifacts actually show up
            </h2>
            <p>
              MP3&apos;s data loss is concentrated in specific places: high-frequency
              detail, transient sharpness, and stereo image precision. On a finished,
              mastered track played straight through, that loss is usually inaudible.
              But sampling isn&apos;t playing a track straight through — it&apos;s
              pitching, stretching, EQ&apos;ing, and layering small slices of it,
              which is exactly the kind of processing that exposes what&apos;s
              missing.
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-text-primary">Pitching a sample down</strong>{" "}
                stretches artifacts that were inaudible at original pitch into a range
                you can actually hear.
              </li>
              <li>
                <strong className="text-text-primary">Heavy EQ or saturation</strong>{" "}
                on a chopped sample amplifies whatever noise floor and frequency
                gaps the compression left behind.
              </li>
              <li>
                <strong className="text-text-primary">Layering multiple MP3 sources</strong>{" "}
                stacks artifacts that were each individually inaudible into something
                that reads as mud or harshness.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A practical way to decide
            </h2>
            <p>
              Ask what happens to the file after you get it, not what it&apos;s for
              in general:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                Chopping, pitching, or layering it into a beat →{" "}
                <strong className="text-text-primary">WAV</strong>. You&apos;re about
                to stress-test exactly the parts of the signal MP3 discards.
              </li>
              <li>
                Listening for reference, checking an arrangement, or studying a
                mix →{" "}
                <strong className="text-text-primary">MP3 is fine</strong>. You&apos;re
                not processing it further, just listening.
              </li>
              <li>
                Not sure yet what you&apos;ll do with it →{" "}
                <strong className="text-text-primary">grab WAV</strong>. Converting
                WAV down to MP3 later costs you nothing; going the other direction
                can&apos;t recover data that&apos;s already gone.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The file-size tradeoff is smaller than it seems
            </h2>
            <p>
              A three-minute WAV runs roughly 30MB versus 3MB for the same track as
              320kbps MP3. That difference mattered when storage was expensive and
              slow; on current hardware, a full sample library in WAV is rarely the
              bottleneck it used to be. Unless you&apos;re archiving thousands of
              reference tracks, the storage math isn&apos;t a strong reason to default
              to MP3 anymore.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/youtube-to-wav"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the YouTube to WAV Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}