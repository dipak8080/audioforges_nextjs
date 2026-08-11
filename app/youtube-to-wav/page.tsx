import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free YouTube to WAV & MP3 Converter",
  description:
    "Convert YouTube videos to WAV or 320kbps MP3 online for free. No sign-up, no watermark, supports YouTube Shorts, and downloads high-quality audio in seconds.",
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
    "youtube to wav online",
    "youtube shorts to wav",
    "youtube video to wav",
    "download youtube audio",
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

// Same 11 questions and answers as before, word-for-word - only the
// structure changed. This single array now feeds BOTH the FAQPage schema
// and the visible accordion, via <FAQSection>, instead of duplicating the
// content by hand in two places.
const faqs = [
  {
    question: "Is this really free?",
    answer:
      "Yes — every conversion is free, with no sign-up, no watermark, and no daily limit on how many links you can convert.",
  },
  {
    question: "What's the difference between WAV and MP3 here?",
    answer:
      "WAV is lossless 44.1kHz audio — larger files, no compression artifacts. Use it for DJing, sampling, or editing. MP3 is 320kbps CBR — smaller files, transparent enough for casual listening.",
  },
  {
    question: "Does this work with YouTube Shorts?",
    answer:
      "Yes. Standard youtube.com/watch links, short youtu.be links, and /shorts URLs are all supported.",
  },
  {
    question: "How long does conversion take?",
    answer:
      "Most videos convert to WAV or MP3 in 20–40 seconds, with no queue or wait time.",
  },
  {
    question: "Does it work on mobile?",
    answer:
      "Yes — the converter works in any mobile browser on iPhone or Android, no app install required.",
  },
  {
    question: "Is downloading YouTube audio legal?",
    answer:
      "It depends on whether you own the content, it's Creative Commons or public domain, or you have permission from the rights holder. You are responsible for how you use the tool.",
  },
  {
    question: "Can I convert very long YouTube videos?",
    answer:
      "Very long videos may be rejected past a certain length to keep conversions fast and reliable for everyone. Most typical music videos, podcast clips, and Shorts convert without any issue.",
  },
  {
    question: "Does it support YouTube playlists?",
    answer:
      "Not currently — the converter processes one video URL at a time rather than an entire playlist.",
  },
  {
    question: "Why did my conversion fail?",
    answer:
      "The most common reasons are: the video is private, deleted, or removed for copyright; it's geo-restricted and unavailable from our server's location; or YouTube is temporarily requiring extra verification. Trying a different video, or trying again in a few minutes, usually resolves it.",
  },
  {
    question: "Can I use the downloaded audio commercially?",
    answer:
      "Only if you own the content, it's royalty-free or Creative Commons licensed for that use, or you have explicit permission from the rights holder. AudioForges doesn't grant any rights to the content you convert.",
  },
  {
    question: "Can I get FLAC or AIFF instead of WAV or MP3?",
    answer:
      "Not directly from YouTube, but you can convert the WAV output afterward using our free Audio Converter, which supports FLAC, AIFF, and several other formats.",
    answerNode: (
      <>
        Not directly from YouTube, but you can convert the WAV output
        afterward using our free{" "}
        <Link href="/convert" className="text-amber-400 hover:underline">
          Audio Converter
        </Link>
        , which supports FLAC, AIFF, and several other formats.
      </>
    ),
  },
];

export default function YouTubeToWavPage() {
  const relatedTools = getRelatedTools("youtube-to-wav", 5);

  return (
    <>
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
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            How to convert YouTube to WAV
          </h2>
          <p className="text-text-muted leading-relaxed">
            Converting a YouTube video to WAV or MP3 with AudioForges takes
            four steps and no software install. The converter extracts the
            audio track directly from the video URL you provide — you never
            need to download the video itself first, and nothing is saved on
            our servers longer than it takes to process your request.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Copy a YouTube video, Shorts, or youtu.be URL.</li>
            <li>Paste it into the converter above.</li>
            <li>Choose WAV for lossless audio or MP3 for a smaller file.</li>
            <li>Click Convert and download — usually ready in 20–40 seconds.</li>
          </ol>
          <p className="text-text-muted leading-relaxed">
            If you&apos;re not sure which format to pick: WAV is the better
            default whenever the audio is headed into a DAW, a DJ set, or any
            kind of editing — it hands off every bit of detail in the
            original recording with nothing discarded. MP3 is the better
            choice when you just want a smaller file for listening on a
            phone or sharing with someone else, since 320kbps is transparent
            enough that most listeners won&apos;t hear a difference from the
            source.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Why convert YouTube to WAV?
          </h2>
          <p className="text-text-muted leading-relaxed">
            WAV preserves audio without lossy compression, which is exactly
            what matters for sampling, DJ software, music production, audio
            editing, and archival purposes — any workflow where the audio
            gets processed further benefits from starting with every bit of
            the original recording intact. If you&apos;re only planning to
            listen back or share the file as-is, MP3&apos;s much smaller size
            is usually the more practical choice instead.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Who is this for?</h2>
          <p className="text-text-muted leading-relaxed">
            This converter gets used across a range of workflows — pulling a
            reference track before a session, backing up your own uploaded
            content, or getting a clean clip ready for editing:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-text-muted leading-relaxed">
            <li>Music producers pulling reference tracks or samples they have the rights to use</li>
            <li>DJs building a set from tracks they own or have permission to use</li>
            <li>Podcast editors extracting a clip from their own or licensed content</li>
            <li>Video editors grabbing a clean audio bed for a project</li>
            <li>Students and musicians studying a performance or arrangement</li>
          </ul>
          <p className="text-text-muted leading-relaxed">
            Not sure which reference tracks are actually worth pulling?{" "}
            <Link href="/guides/finding-reference-tracks" className="text-amber-400 hover:underline">
              Read How to Find Reference Tracks That Actually Help
            </Link>.
          </p>
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
              youtu.be, and /shorts links — one video at a time, rather than
              full playlists.
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
            </Link>. Need FLAC or AIFF instead? Convert the WAV output using our{" "}
            <Link href="/convert" className="text-amber-400 hover:underline">
              Audio Converter
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

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}