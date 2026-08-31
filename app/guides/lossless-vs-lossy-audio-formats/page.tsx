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

const guide = getGuideBySlug("lossless-vs-lossy-audio-formats")!;

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

export default function LosslessVsLossyGuidePage() {
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
            &quot;Lossless&quot; and &quot;lossy&quot; get thrown around a lot in
            production and DJ circles, usually as shorthand for &quot;good&quot;
            and &quot;bad.&quot; That&apos;s not quite right, and it leads to a
            specific mistake: people convert an MP3 to WAV expecting the file to
            suddenly sound better. It won&apos;t. Understanding why is the
            difference between using format conversion as a real tool versus just
            moving the same quality problem into a bigger file.
          </p>

          <h2 id="definitions">What lossless and lossy actually mean</h2>
          <p>
            A <strong>lossless</strong> format (WAV, FLAC, AIFF) stores audio
            without discarding any information — decompress a FLAC and you get
            back the exact same waveform that went in. A <strong>lossy</strong>{" "}
            format (MP3, AAC, OGG) throws away information the encoder judges to
            be inaudible or low-priority, in exchange for a much smaller file.
            That discarding step is permanent — once it happens, that information
            is gone from the file forever.
          </p>
          <p>
            This is the part that trips people up: a lossy encode isn&apos;t
            reversible. There&apos;s no version of &quot;decompress harder&quot;
            that gets the original data back.
          </p>

          <h2 id="mp3-to-wav">
            Why converting MP3 &rarr; WAV doesn&apos;t improve quality
          </h2>
          <p>
            Converting a lossy file to a lossless format repackages the audio into
            an uncompressed container — it does not restore whatever the original
            lossy encoder discarded. An MP3 converted to WAV will be exactly as
            good (or as compromised) as the MP3 was, just now taking up roughly
            10x the disk space. This is normal, expected behavior, not a bug in a
            converter — no tool can recover data that was never kept in the first
            place.
          </p>
          <p>
            Where this matters practically: if you&apos;re converting a
            low-bitrate MP3 to WAV hoping it&apos;ll sound better in your DAW, it
            won&apos;t. If you&apos;re converting it because your software only
            accepts WAV files, that&apos;s a completely valid reason — you&apos;re
            just not gaining audio quality in the process, only compatibility.
          </p>

          <h2 id="when-it-matters">When the difference actually matters</h2>
          <p>
            For casual listening on phone speakers or earbuds, a 320kbps MP3 is
            audibly transparent to the vast majority of listeners — the lossy
            encoding is genuinely inaudible in that context. The difference starts
            to matter in specific production situations:
          </p>
          <dl>
            <dt>Sampling and layering</dt>
            <dd>
              Stacking multiple lossy-encoded elements can compound artifacts that
              were individually inaudible.
            </dd>

            <dt>Heavy processing</dt>
            <dd>
              Aggressive EQ, pitch-shifting, or time-stretching a lossy file can
              expose compression artifacts that stayed hidden in the original.
            </dd>

            <dt>Mastering and final export</dt>
            <dd>
              Starting from lossless stems avoids introducing an extra,
              unnecessary generation of lossy compression before the final bounce.
            </dd>
          </dl>

          <h2 id="rule-of-thumb">A practical rule of thumb</h2>
          <p>
            Keep your original source as high-quality as you can get it, and only
            introduce lossy compression at the very last step — for a final
            distributable file, not an intermediate one you&apos;ll keep editing.
            If you&apos;re starting from an already-lossy source (a downloaded
            MP3, an old low-bitrate rip), convert it to whatever format your
            workflow needs for compatibility, but don&apos;t expect a quality
            upgrade — and don&apos;t re-compress it through multiple lossy formats
            along the way, since each lossy-to-lossy pass can compound artifacts.
          </p>
          <p>
            Need to convert between formats for compatibility with your DAW,
            sampler, or DJ software? Our{" "}
            <Link href="/convert">Audio Converter</Link> handles all seven common
            formats — free, no sign-up.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/convert" className={buttonStyles({ size: "lg" })}>
            Try the Audio Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}