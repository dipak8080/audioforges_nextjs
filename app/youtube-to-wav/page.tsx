import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Free YouTube to WAV & MP3 Converter",
  description:
    "Free YouTube to WAV converter — no sign-up, no watermark, no limits. Paste a link, get lossless WAV or 320kbps MP3 in seconds. Works with any video or Shorts.",
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

export default function YouTubeToWavPage() {
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
              <strong className="text-text-primary">When to use WAV:</strong> DJ
              software, audio editing (Ableton, Logic, FL Studio, Audacity),
              sampling, or video editing where quality matters — WAV is
              lossless, so there are no compression artifacts to worry about
              during further processing.
            </p>
            <p>
              <strong className="text-text-primary">When to use MP3:</strong>{" "}
              mobile listening, sharing via chat, or storing large libraries
              where file size matters. At 320kbps, MP3 is transparent enough
              for most casual use.
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
          <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/key-finder"
              className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
            >
              <h3 className="font-semibold text-text-primary">
                Song Key &amp; BPM Finder
              </h3>
              <p className="text-sm text-text-muted mt-1">
                Already converted your track? Check its key and tempo before
                you drop it into a session.
              </p>
            </Link>
            <Link
              href="/vocal-remover"
              className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
            >
              <h3 className="font-semibold text-text-primary">
                Vocal Remover
              </h3>
              <p className="text-sm text-text-muted mt-1">
                Strip vocals from your converted WAV to get a clean
                instrumental.
              </p>
            </Link>
          </div>
        </section>

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