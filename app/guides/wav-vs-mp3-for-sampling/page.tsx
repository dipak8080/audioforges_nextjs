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

const guide = getGuideBySlug("wav-vs-mp3-for-sampling")!;

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

export default function WavVsMp3GuidePage() {
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
            &quot;Always use WAV&quot; is the advice you&apos;ll see repeated
            everywhere, and it&apos;s not wrong — but it skips the actual reason,
            which means people apply it in situations where it doesn&apos;t matter
            and ignore it in situations where it really does.
          </p>

          <h2 id="technical-difference">What&apos;s technically different</h2>
          <p>
            WAV stores audio uncompressed — every sample, bit for bit. MP3 throws
            away data the format&apos;s psychoacoustic model predicts you
            won&apos;t notice, which is how it shrinks a file to roughly a tenth
            the size. At 320kbps, that prediction is good enough that most
            listeners can&apos;t reliably tell the difference in a blind A/B test
            on a finished track.
          </p>
          <p>
            The problem isn&apos;t how MP3 sounds on first listen — it&apos;s what
            happens when you process it further.
          </p>

          <h2 id="artifacts">Where compression artifacts actually show up</h2>
          <p>
            MP3&apos;s data loss is concentrated in specific places:
            high-frequency detail, transient sharpness, and stereo image
            precision. On a finished, mastered track played straight through,
            that loss is usually inaudible. But sampling isn&apos;t playing a
            track straight through — it&apos;s pitching, stretching, EQ&apos;ing,
            and layering small slices of it, which is exactly the kind of
            processing that exposes what&apos;s missing.
          </p>
          <dl>
            <dt>Pitching a sample down</dt>
            <dd>
              Stretches artifacts that were inaudible at original pitch into a
              range you can actually hear.
            </dd>

            <dt>Heavy EQ or saturation</dt>
            <dd>
              Amplifies whatever noise floor and frequency gaps the compression
              left behind on a chopped sample.
            </dd>

            <dt>Layering multiple MP3 sources</dt>
            <dd>
              Stacks artifacts that were each individually inaudible into
              something that reads as mud or harshness.
            </dd>
          </dl>

          <h2 id="how-to-decide">A practical way to decide</h2>
          <p>
            Ask what happens to the file after you get it, not what it&apos;s for
            in general:
          </p>
          <dl>
            <dt>Chopping, pitching, or layering it into a beat</dt>
            <dd>
              <strong>WAV.</strong> You&apos;re about to stress-test exactly the
              parts of the signal MP3 discards.
            </dd>

            <dt>Listening for reference, checking an arrangement, studying a mix</dt>
            <dd>
              <strong>MP3 is fine.</strong> You&apos;re not processing it further,
              just listening.
            </dd>

            <dt>Not sure yet what you&apos;ll do with it</dt>
            <dd>
              <strong>Grab WAV.</strong> Converting WAV down to MP3 later costs
              you nothing; going the other direction can&apos;t recover data
              that&apos;s already gone.
            </dd>
          </dl>

          <h2 id="file-size">The file-size tradeoff is smaller than it seems</h2>
          <p>
            A three-minute WAV runs roughly 30MB versus 3MB for the same track as
            320kbps MP3. That difference mattered when storage was expensive and
            slow; on current hardware, a full sample library in WAV is rarely the
            bottleneck it used to be. Unless you&apos;re archiving thousands of
            reference tracks, the storage math isn&apos;t a strong reason to
            default to MP3 anymore.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/youtube-to-wav" className={buttonStyles({ size: "lg" })}>
            Try the YouTube to WAV Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}