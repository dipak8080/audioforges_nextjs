import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("lossless-vs-lossy-audio-formats")!;

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
  author: { "@type": "Person", name: "AudioForges" },
};

export default function LosslessVsLossyGuidePage() {
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
            &quot;Lossless&quot; and &quot;lossy&quot; get thrown around a lot in
            production and DJ circles, usually as shorthand for &quot;good&quot; and
            &quot;bad.&quot; That&apos;s not quite right, and it leads to a specific
            mistake: people convert an MP3 to WAV expecting the file to suddenly
            sound better. It won&apos;t. Understanding why is the difference between
            using format conversion as a real tool versus just moving the same
            quality problem into a bigger file.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What lossless and lossy actually mean
            </h2>
            <p>
              A <strong className="text-text-primary">lossless</strong> format
              (WAV, FLAC, AIFF) stores audio without discarding any information —
              decompress a FLAC and you get back the exact same waveform that went
              in. A <strong className="text-text-primary">lossy</strong> format
              (MP3, AAC, OGG) throws away information the encoder judges to be
              inaudible or low-priority, in exchange for a much smaller file. That
              discarding step is permanent — once it happens, that information is
              gone from the file forever.
            </p>
            <p>
              This is the part that trips people up: a lossy encode isn&apos;t
              reversible. There&apos;s no version of &quot;decompress harder&quot;
              that gets the original data back.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why converting MP3 → WAV doesn&apos;t improve quality
            </h2>
            <p>
              Converting a lossy file to a lossless format repackages the audio
              into an uncompressed container — it does not restore whatever the
              original lossy encoder discarded. An MP3 converted to WAV will be
              exactly as good (or as compromised) as the MP3 was, just now taking
              up roughly 10x the disk space. This is normal, expected behavior, not
              a bug in a converter — no tool can recover data that was never kept
              in the first place.
            </p>
            <p>
              Where this matters practically: if you&apos;re converting a low-bitrate
              MP3 to WAV hoping it&apos;ll sound better in your DAW, it won&apos;t. If
              you&apos;re converting it because your software only accepts WAV files,
              that&apos;s a completely valid reason — you&apos;re just not gaining
              audio quality in the process, only compatibility.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              When the difference actually matters
            </h2>
            <p>
              For casual listening on phone speakers or earbuds, a 320kbps MP3 is
              audibly transparent to the vast majority of listeners — the lossy
              encoding is genuinely inaudible in that context. The difference
              starts to matter in specific production situations:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-text-primary">Sampling and layering</strong>{" "}
                — stacking multiple lossy-encoded elements can compound artifacts
                that were individually inaudible.
              </li>
              <li>
                <strong className="text-text-primary">Heavy processing</strong> —
                aggressive EQ, pitch-shifting, or time-stretching a lossy file can
                expose compression artifacts that stayed hidden in the original.
              </li>
              <li>
                <strong className="text-text-primary">Mastering and final export</strong>{" "}
                — starting from lossless stems avoids introducing an extra,
                unnecessary generation of lossy compression before the final bounce.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A practical rule of thumb
            </h2>
            <p>
              Keep your original source as high-quality as you can get it, and only
              introduce lossy compression at the very last step — for a final
              distributable file, not an intermediate one you&apos;ll keep editing.
              If you&apos;re starting from an already-lossy source (a downloaded MP3,
              an old low-bitrate rip), convert it to whatever format your workflow
              needs for compatibility, but don&apos;t expect a quality upgrade — and
              don&apos;t re-compress it through multiple lossy formats along the way,
              since each lossy-to-lossy pass can compound artifacts.
            </p>
            <p>
              Need to convert between formats for compatibility with your DAW,
              sampler, or DJ software? Our{" "}
              <Link href="/convert" className="text-amber-400 hover:underline">
                Audio Converter
              </Link>{" "}
              handles all seven common formats — free, no sign-up.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/convert"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Audio Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}