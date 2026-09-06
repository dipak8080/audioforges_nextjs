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

const guide = getGuideBySlug("sample-rate-and-bit-depth-explained")!;

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
  // Organization, not Person — AudioForges is a brand, not an individual.
  author: { "@type": "Organization", name: "AudioForges" },
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function SampleRateGuidePage() {
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
            It&apos;s a natural assumption: 96kHz is a bigger number than
            44.1kHz, so converting a file up to 96kHz should make it sound better.
            It doesn&apos;t. Sample rate and bit depth are both about how audio is
            measured and stored, not how good the underlying recording is —
            converting between them changes the format, not the quality that was
            captured in the first place.
          </p>

          <h2 id="sample-rate">What sample rate actually measures</h2>
          <p>
            Sample rate is how many times per second an audio signal is measured
            when it&apos;s digitized. 44.1kHz — 44,100 samples per second — is the
            CD standard and still extremely common for music. 48kHz is the
            standard for video and broadcast audio. 96kHz shows up in some
            high-resolution audio and production workflows. None of these numbers
            describe how good a recording is; they describe how frequently it was
            sampled when it was captured.
          </p>

          <h2 id="upsampling">Why converting up doesn&apos;t add quality</h2>
          <p>
            Converting a 44.1kHz file up to 96kHz doesn&apos;t recover detail that
            was never captured — it represents the same underlying information
            with more samples, effectively filling in the gaps mathematically
            rather than pulling in new information from the original recording. If
            a recording was made at 44.1kHz, that rate set the ceiling on what was
            captured; changing the file&apos;s stored rate afterward doesn&apos;t
            move that ceiling.
          </p>

          <h2 id="bit-depth">What bit depth actually controls</h2>
          <p>
            Bit depth is a separate setting that controls how finely each
            individual sample&apos;s amplitude is measured — think of it as
            resolution in the vertical direction, where sample rate is resolution
            in the horizontal (time) direction. 16-bit is the CD standard; 24-bit
            and 32-bit are common in production for the extra headroom they give
            during mixing and processing. This only applies to uncompressed
            formats like WAV and AIFF — compressed formats like MP3 or AAC
            don&apos;t expose a user-facing bit depth to convert, since they
            don&apos;t store audio as raw PCM samples in the first place.
          </p>

          <h2 id="when-to-convert">When you actually need to change either</h2>
          <p>
            The real reasons to convert sample rate or bit depth are almost always
            compatibility, not quality. A video editing project running at 48kHz
            needs its audio at 48kHz to sync properly, regardless of what rate the
            audio was originally recorded at. A sample library, DAW project, or
            plugin sometimes expects a specific rate or depth as a hard
            requirement. A batch of recordings made at inconsistent rates needs to
            be standardized before they can be combined cleanly. In every one of
            these cases, you&apos;re matching a requirement, not improving the
            audio.
          </p>

          <h2 id="downsampling">
            Downsampling is the direction that actually loses something
          </h2>
          <p>
            Converting to a higher rate doesn&apos;t add information, but
            converting to a lower one is a genuine change: taking a 96kHz
            recording down to 44.1kHz does discard some of what was captured,
            since fewer samples per second means less of the original signal is
            represented afterward. This matters far less than it sounds for most
            practical purposes — 44.1kHz already captures everything within normal
            human hearing range — but it&apos;s worth knowing that this direction,
            unlike upsampling, is not a lossless round trip.
          </p>
          <p>
            Our <Link href="/sample-rate-converter">Sample Rate Converter</Link>{" "}
            handles both directions, with an optional bit depth change for WAV and
            AIFF files — upload a file, pick a target, and download the result, no
            account or software install needed. For the one common case that
            needs a very low rate — hold music and IVR prompts for phone systems —
            see{" "}
            <Link href="/guides/convert-audio-for-phone-systems-3cx-asterisk-ivr">
              Convert Audio to 8 kHz Mono WAV for Phone Systems
            </Link>
            .
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/sample-rate-converter" className={buttonStyles({ size: "lg" })}>
            Try the Sample Rate Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}