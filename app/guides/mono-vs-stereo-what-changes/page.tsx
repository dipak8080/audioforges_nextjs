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

const guide = getGuideBySlug("mono-vs-stereo-what-changes")!;

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

export default function MonoStereoGuidePage() {
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
            It&apos;s easy to assume stereo is just &quot;better&quot; than mono,
            so converting a file to stereo must be an upgrade. It isn&apos;t —
            mono and stereo describe channel count, not quality, and converting
            between them doesn&apos;t add or remove any fidelity. What it actually
            does depends on which direction you&apos;re going, and it&apos;s worth
            understanding before you assume the result is what you expected.
          </p>

          <h2 id="definitions">What mono and stereo actually are</h2>
          <p>
            Mono audio is a single channel — the same signal plays from every
            speaker. Stereo audio is two independent channels, left and right,
            which can carry different content to create a sense of width and
            position in the sound field. A stereo recording of a band, for
            example, might have the guitar sitting slightly left and the keys
            slightly right, because those are genuinely two different signals. A
            mono recording of the same performance has no such separation to begin
            with — there&apos;s only one signal, period.
          </p>

          <h2 id="stereo-to-mono">What happens converting stereo to mono</h2>
          <p>
            Converting stereo to mono combines the left and right channels into
            one. Whatever separation existed between them — instruments panned to
            one side, a wide stereo effect, anything placed off-center — collapses
            into a single centered signal. The result isn&apos;t damaged audio,
            but it is a genuinely different listening experience from the
            original: anything that relied on stereo separation to be heard
            clearly can end up sitting on top of everything else in the mix once
            there&apos;s only one channel left.
          </p>

          <h2 id="mono-to-stereo">What happens converting mono to stereo</h2>
          <p>
            This direction surprises people more often. Converting mono to stereo
            duplicates the identical signal onto both the left and right channels
            — it doesn&apos;t invent new stereo information that wasn&apos;t
            there. There&apos;s nothing to separate in a single-channel source, so
            the result is technically two-channel audio, but it sounds exactly as
            centered and &quot;flat&quot; as the mono original. If a platform
            requires stereo input, this satisfies that requirement; if you were
            hoping for actual stereo width, this conversion alone won&apos;t
            produce it, because true stereo width comes from having two genuinely
            different channels of content, not from doubling one channel.
          </p>

          <h2 id="why-convert">Why you&apos;d actually want either direction</h2>
          <p>
            Converting to mono comes up most with voice content: phone systems,
            IVR prompts, and some podcast platforms expect or prefer
            single-channel audio, and a mono file is also smaller than its stereo
            equivalent for the same content. Converting to stereo comes up when an
            upload target rejects or mishandles mono files outright and simply
            needs two channels present, regardless of whether they carry different
            information — a formatting requirement rather than a creative choice.
          </p>

          <h2 id="not-widening">This isn&apos;t the same as adding stereo width</h2>
          <p>
            It&apos;s worth being clear about what this conversion can and
            can&apos;t do. Techniques that actually create a sense of stereo width
            — panning different elements to different sides, stereo-widening
            effects, genuine multi-mic recording — work by putting different
            content in the left and right channels. Converting a mono file to
            stereo doesn&apos;t do any of that; it&apos;s a format change, not a
            creative effect. If what you&apos;re after is width that wasn&apos;t
            in the source, this tool isn&apos;t the way to get there — it&apos;s
            the way to satisfy a channel-count requirement without altering how
            the audio actually sounds.
          </p>
          <p>
            Our <Link href="/mono-stereo-converter">Mono/Stereo Converter</Link>{" "}
            runs this exact conversion in either direction — upload a file, pick
            the target, and download the result, no account or software install
            needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/mono-stereo-converter" className={buttonStyles({ size: "lg" })}>
            Try the Mono/Stereo Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}