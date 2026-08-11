import type { Metadata } from "next";
import Link from "next/link";
import { ChannelsForm } from "@/components/converter/ChannelsForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free Mono to Stereo & Stereo to Mono Converter";
const PAGE_DESCRIPTION =
  "Convert audio between mono and stereo channels online, free. Downmix stereo to mono or duplicate mono to stereo. No sign-up, no watermark.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/mono-stereo-converter` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/mono-stereo-converter`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below is checked against the actual
// ChannelsForm/backend behavior. No accuracy, performance, or file-size
// reduction claims, since encoding settings and format affect size.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Mono/Stereo Converter",
  url: `${SITE_URL}/mono-stereo-converter`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert stereo to mono",
    "Convert mono to stereo",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Mono/Stereo Converter", item: `${SITE_URL}/mono-stereo-converter` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains.

const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF"];

/** Same style as the convert/stems pages — clean mono badges, no check icons.
 *  Check icons are reserved for comparison-table cells, not format lists. */
function FormatBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      {SUPPORTED_FORMATS.map((format) => (
        <span
          key={format}
          className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
        >
          {format}
        </span>
      ))}
    </div>
  );
}

const faqs = [
  {
    question: "How do I convert mono to stereo?",
    answer:
      "Upload your mono file, choose stereo as the target, and download the result. The tool duplicates the single mono signal onto both the left and right channels.",
  },
  {
    question: "How do I convert stereo to mono?",
    answer:
      "Upload your stereo file, choose mono as the target, and download the result. The tool combines the left and right channels into a single centered channel.",
  },
  {
    question: "Does mono to stereo create real stereo?",
    answer:
      "No. It duplicates the identical mono signal onto both channels rather than inventing new left/right content. It satisfies a two-channel requirement, but there's no actual stereo width or separation, since there was nothing to separate in the mono source.",
  },
  {
    question: "Is mono better for voice recordings?",
    answer:
      "Often, yes — a single voice usually doesn't benefit from stereo width, and many phone systems, IVR platforms, and podcast hosts expect or prefer single-channel audio for spoken content.",
  },
  {
    question: "Is stereo better for music?",
    answer:
      "Music that was recorded or mixed with genuine left/right separation — instruments panned to different sides, stereo effects — benefits from staying in stereo, since converting it to mono collapses that separation into one channel.",
  },
  {
    question: "Does converting stereo to mono lose left/right information?",
    answer:
      "Yes — combining two channels into one is a real change. Any separation between the left and right channels in the original is gone in the mono result; the audio isn't damaged, but it's a genuinely different listening experience from the stereo original.",
  },
  {
    question: "Does this conversion affect audio quality?",
    answer:
      "It changes channel count, not fidelity — but stereo-to-mono is not a lossless no-op, since it genuinely discards the left/right separation that existed. Mono-to-stereo doesn't lose anything, since it's only duplicating what's already there.",
  },
  {
    question: "Will converting to mono make my file smaller?",
    answer:
      "Often, since there's less channel data to store, but the exact difference depends on the output format and encoding settings rather than being a fixed, guaranteed reduction.",
  },
  {
    question: "What audio formats are supported?",
    answer: "MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF.",
  },
  {
    question: "What is the maximum upload size?",
    answer: "80MB per upload.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark on the output.",
  },
];

export default function ChannelsPage() {
  const relatedTools = getRelatedTools("mono-stereo-converter", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Mono to Stereo &amp; Stereo to Mono Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Convert audio between mono and stereo channels — free, no
            sign-up, no watermark. Going stereo to mono combines both
            channels into one; going mono to stereo duplicates the single
            channel across two.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <ChannelsForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Both directions", desc: "Mono to stereo, or stereo to mono." },
            { title: "Any format", desc: "MP3, WAV, FLAC, M4A, AAC, OGG, AIFF." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is mono audio?</h2>
          <p className="text-text-muted leading-relaxed">
            Mono (monaural) audio is a single audio channel. The same signal
            plays from every speaker or earbud — there&apos;s no left/right
            distinction, because there&apos;s only one channel to begin with.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is stereo audio?</h2>
          <p className="text-text-muted leading-relaxed">
            Stereo audio uses two independent channels, left and right, which
            can carry different content. That difference between the two
            channels is what creates a sense of width and positioning — an
            instrument panned left, another panned right, or a wide stereo
            effect spread across the field.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Mono vs. stereo: what&apos;s the difference?</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold">Mono</th>
                  <th className="px-4 py-3 font-semibold">Stereo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Channels</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">2 (left + right)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Left/right information</td>
                  <td className="px-4 py-3">None — same signal everywhere</td>
                  <td className="px-4 py-3">Can differ between channels</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Stereo width</td>
                  <td className="px-4 py-3">None</td>
                  <td className="px-4 py-3">Present when the two channels genuinely differ</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Common uses</td>
                  <td className="px-4 py-3">Voice, phone systems, podcasts</td>
                  <td className="px-4 py-3">Music, sound design, most media</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Reason to convert here</td>
                  <td className="px-4 py-3">A target expects/prefers single-channel audio</td>
                  <td className="px-4 py-3">A target requires two channels present</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Mono to stereo: what happens?</h2>
          <p className="text-text-muted leading-relaxed">
            The single mono channel is duplicated onto both the left and
            right channels. The result is technically two-channel audio, but
            it plays back exactly as centered as the mono original — nothing
            new is separated between the channels, because there was only one
            signal to begin with.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Stereo to mono: what happens?</h2>
          <p className="text-text-muted leading-relaxed">
            The left and right channels are combined into a single centered
            channel. Whatever separation existed between them — instruments
            panned to one side, a wide stereo effect — collapses into one
            signal. This is a genuine change to how the audio sounds, not just
            a format formality.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">When should you convert stereo to mono?</h2>
          <p className="text-text-muted leading-relaxed">
            When a target platform expects single-channel audio — phone
            systems, IVR prompts, and some podcast hosts commonly do — or when
            the content itself, like a single spoken voice, was never relying
            on stereo separation in the first place.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">When should you convert mono to stereo?</h2>
          <p className="text-text-muted leading-relaxed">
            When an upload target rejects or mishandles mono files and simply
            requires two channels to be present, regardless of whether they
            carry different content. This satisfies that requirement without
            changing how the audio actually sounds.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Does mono to stereo create real stereo?</h2>
          <p className="text-text-muted leading-relaxed">
            No. Real stereo width comes from having two channels that
            genuinely carry different content — different mic positions,
            panned instruments, a stereo effect. Duplicating a mono signal
            across two channels satisfies a channel-count requirement, but it
            doesn&apos;t create anything to separate, so no width is added.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of why this distinction matters and
            what each direction is actually doing under the hood?{" "}
            <Link href="/guides/mono-vs-stereo-what-changes" className="text-amber-400 hover:underline">
              Read Mono vs. Stereo: What Actually Changes When You Convert
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Does converting stereo to mono affect audio quality?</h2>
          <p className="text-text-muted leading-relaxed">
            Converting stereo to mono changes the channel configuration and
            can remove left/right separation that was present in the
            original. The result isn&apos;t necessarily lower-quality audio,
            but it can sound different, because stereo information is being
            combined into one channel. Whether that matters depends on the
            source: a mono voice recording loses nothing meaningful, while a
            stereo music mix with real left/right content will sound
            different once collapsed to one channel.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to convert between mono and stereo</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Choose mono or stereo as the target.</li>
            <li>Download the converted file.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported formats</h2>
          <FormatBadges />
          <p className="text-text-muted leading-relaxed">
            Upload any of the formats above, up to 80MB per file.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Podcasts &amp; voice content:</strong>{" "}
              converting spoken-word recordings to mono for hosts and
              pipelines that expect single-channel audio.
            </p>
            <p>
              <strong className="text-text-primary">IVR &amp; telephone systems:</strong>{" "}
              phone-based audio commonly requires mono input, regardless of
              how the source was originally recorded.
            </p>
            <p>
              <strong className="text-text-primary">Voice-over work:</strong>{" "}
              preparing narration for whichever channel format a project
              or delivery spec requires.
            </p>
            <p>
              <strong className="text-text-primary">Video editing:</strong>{" "}
              matching a voice track&apos;s channel format to the rest of a
              project&apos;s audio before syncing it to picture.
            </p>
            <p>
              <strong className="text-text-primary">Music production:</strong>{" "}
              checking how a mix collapses to mono to catch phase or balance
              issues that only show up once stereo separation is removed.
            </p>
            <p>
              <strong className="text-text-primary">Upload compatibility:</strong>{" "}
              satisfying a platform&apos;s channel-count requirement when it
              rejects or mishandles the format you started with.
            </p>
          </div>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}