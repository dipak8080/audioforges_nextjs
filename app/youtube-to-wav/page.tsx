import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free YouTube to WAV & MP3 Converter",
  description:
    "Convert YouTube videos to WAV or 320kbps MP3 online free. No sign-up, no watermark, supports YouTube Shorts. Paste a link, download in seconds.",
  keywords: [
    "youtube to wav",
    "youtube to wav converter",
    "free youtube to wav converter",
    "youtube to wav downloader",
    "youtube to mp3",
    "yt to wav",
    "youtube wav converter",
    "convert youtube to wav free",
    "youtube audio downloader",
  ],
  alternates: {
    canonical: `${SITE_URL}/youtube-to-wav`,
  },
  openGraph: {
    title: "Free YouTube to WAV & MP3 Converter",
    description:
      "Free YouTube to WAV converter — no sign-up, no watermark, no limits. Paste a link and download high-quality audio in seconds.",
    url: `${SITE_URL}/youtube-to-wav`,
    siteName: "AudioForges",
    type: "website",
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
    title: "Free YouTube to WAV & MP3 Converter",
    description:
      "Free YouTube to WAV converter — no sign-up, no watermark, no limits. Paste a link and download high-quality audio in seconds.",
    images: ["/images/og-default.png"],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is this really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — every conversion is free, with no sign-up, no watermark, and no daily limit on how many links you can convert.",
      },
    },
    {
      "@type": "Question",
      name: "What's the difference between WAV and MP3 here?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "WAV is lossless 44.1kHz audio — larger files, no compression artifacts. Use it for DJing, sampling, or editing. MP3 is 320kbps CBR — smaller files, transparent enough for casual listening.",
      },
    },
    {
      "@type": "Question",
      name: "Does this work with YouTube Shorts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Standard youtube.com/watch links, short youtu.be links, and /shorts URLs are all supported.",
      },
    },
    {
      "@type": "Question",
      name: "How long does conversion take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most videos convert to WAV or MP3 in 20–40 seconds, with no queue or wait time.",
      },
    },
    {
      "@type": "Question",
      name: "Does it work on mobile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — the converter works in any mobile browser, no app install required.",
      },
    },
    {
      "@type": "Question",
      name: "Is downloading YouTube audio legal?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It depends on whether you own the content, it's Creative Commons or public domain, or you have permission from the rights holder. You are responsible for how you use the tool.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube to WAV Converter",
  url: `${SITE_URL}/youtube-to-wav`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Convert YouTube videos to WAV",
    "Convert YouTube videos to MP3",
    "No sign-up required",
    "No watermark",
    "Supports YouTube Shorts",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "YouTube to WAV",
      item: `${SITE_URL}/youtube-to-wav`,
    },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Convert YouTube to WAV or MP3",
  step: [
    { "@type": "HowToStep", name: "Copy the link", text: "Copy a YouTube video, Shorts, or youtu.be URL." },
    { "@type": "HowToStep", name: "Paste it", text: "Paste the link into the converter." },
    { "@type": "HowToStep", name: "Choose a format", text: "Select WAV for lossless audio or MP3 for a smaller file." },
    { "@type": "HowToStep", name: "Convert and download", text: "Click Convert and download your audio file, usually within 20-40 seconds." },
  ],
};

export default function YouTubeToWavPage() {
  const relatedTools = getRelatedTools("youtube-to-wav", 5);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free YouTube to WAV Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Convert YouTube to WAV or MP3 free — no sign-up, no watermark, no
            limits. Paste a link and download high-quality audio in seconds.
          </p>
        </header>

        <YouTubeConverterForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Fast",
              desc: "Most conversions finish in 20–40 seconds, no queue.",
            },
            {
              title: "High quality",
              desc: "Lossless WAV or 320kbps MP3 — your choice, every time.",
            },
            {
              title: "No sign-up",
              desc: "No account, no email, no watermark on your files.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2"
            >
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            How to convert YouTube to WAV
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Copy a YouTube video, Shorts, or youtu.be URL.</li>
            <li>Paste it into the converter above.</li>
            <li>Choose WAV for lossless audio or MP3 for a smaller file.</li>
            <li>Click Convert and download — usually ready in 20–40 seconds.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            About the YouTube to WAV / MP3 converter
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              AudioForges&apos; YouTube converter is completely free and extracts
              the audio track from a video URL, delivering it as a clean{" "}
              <strong className="text-text-primary">WAV</strong> (44.1kHz,
              uncompressed) or <strong className="text-text-primary">MP3</strong>{" "}
              (320kbps CBR) file. It supports standard youtube.com/watch, short
              youtu.be, and /shorts links.
            </p>
            <p>
              <strong className="text-text-primary">Common legitimate uses:</strong>{" "}
              downloading your own uploaded videos, extracting audio from
              Creative-Commons or public-domain content, saving royalty-free
              tracks, backing up podcasts you have permission to save, and
              grabbing reference audio for a track you own.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            WAV vs MP3: which should you choose?
          </h2>
          <p className="text-text-muted leading-relaxed">
            WAV stores the original PCM audio with no compression, which is
            why it&apos;s preferred for editing, sampling, and mastering —
            there&apos;s nothing for further processing to expose. MP3 trades
            some of that data for a much smaller file, which is the right
            call when you&apos;re just listening or sharing rather than
            processing further.
          </p>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Feature</th>
                  <th className="px-4 py-3 font-semibold">WAV</th>
                  <th className="px-4 py-3 font-semibold">MP3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">File size</td>
                  <td className="px-4 py-3">Large (~10MB/min)</td>
                  <td className="px-4 py-3">Small (~1MB/min at 320kbps)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Quality</td>
                  <td className="px-4 py-3">Lossless</td>
                  <td className="px-4 py-3">Compressed, transparent at 320kbps</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Editing / sampling</td>
                  <td className="px-4 py-3">Ideal — no artifacts to expose</td>
                  <td className="px-4 py-3">Fine for reference, riskier for heavy processing</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">DJ software</td>
                  <td className="px-4 py-3">Preferred</td>
                  <td className="px-4 py-3">Workable</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Casual listening / sharing</td>
                  <td className="px-4 py-3">Overkill on size</td>
                  <td className="px-4 py-3">Ideal</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Want the full technical breakdown of why this matters for
            sampling and production specifically?{" "}
            <Link href="/guides/wav-vs-mp3-for-sampling" className="text-amber-400 hover:underline">
              Read WAV vs MP3 for Sampling: What Actually Changes
            </Link>.
          </p>
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

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            This tool is intended for downloading content you own the rights
            to, that is royalty-free or Creative Commons licensed, or that is
            in the public domain. You are solely responsible for ensuring you
            have the right to download and use any content. AudioForges does
            not host, store, or distribute copyrighted material.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Frequently asked questions
          </h2>
          <div className="space-y-5 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Is this really free?
              </h3>
              <p>
                Yes — every conversion is free, with no sign-up, no watermark,
                and no daily limit on how many links you can convert.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                What&apos;s the difference between WAV and MP3 here?
              </h3>
              <p>
                WAV is lossless 44.1kHz audio — larger files, no compression
                artifacts. Use it for DJing, sampling, or editing. MP3 is
                320kbps CBR — smaller files, transparent enough for casual
                listening.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Does this work with YouTube Shorts?
              </h3>
              <p>
                Yes. Standard youtube.com/watch links, short youtu.be links,
                and /shorts URLs are all supported.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                How long does conversion take?
              </h3>
              <p>
                Most videos convert to WAV or MP3 in 20–40 seconds, with no
                queue or wait time.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Does it work on mobile?
              </h3>
              <p>
                Yes — the converter works in any mobile browser, no app
                install required.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Is downloading YouTube audio legal?
              </h3>
              <p>
                It depends on whether you own the content, it&apos;s Creative
                Commons or public domain, or you have permission from the
                rights holder. You are responsible for how you use the tool.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}