import type { Metadata } from "next";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";

const SITE_URL = "https://audioforges.com";

export const metadata: Metadata = {
  title: "YouTube to WAV Converter & Downloader (Free) | AudioForges",
  description:
    "Convert YouTube videos to WAV or MP3 free, no sign-up. Paste a link and download high-quality audio in seconds — works with any video or Shorts.",
  keywords: [
    "youtube to wav",
    "youtube to wav converter",
    "youtube to wav downloader",
    "youtube to mp3",
    "yt to wav",
    "youtube wav converter",
    "convert youtube to wav",
    "youtube audio downloader",
  ],
  alternates: {
    canonical: `${SITE_URL}/youtube-to-wav`,
  },
  openGraph: {
    title: "YouTube to WAV Converter & Downloader (Free) | AudioForges",
    description:
      "Convert YouTube videos to WAV or MP3 free, no sign-up. Paste a link and download high-quality audio in seconds.",
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
        text: "Yes — AudioForges is completely free with no sign-up, no watermark, and no download limits.",
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
      name: "Is downloading YouTube audio legal?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It depends on whether you own the content, it's Creative Commons or public domain, or you have permission from the rights holder. You are responsible for how you use the tool.",
      },
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

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            YouTube to WAV &amp; MP3 Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Convert YouTube to high-quality WAV or MP3 for remixing, sampling, or
            practice. Fast, free, and no sign-up required.
          </p>
        </header>

        <YouTubeConverterForm />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            About the YouTube to WAV / MP3 converter
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              AudioForges&apos; YouTube converter extracts the audio track from a video
              URL and delivers it as a clean <strong className="text-text-primary">WAV</strong>{" "}
              (44.1kHz, uncompressed) or <strong className="text-text-primary">MP3</strong>{" "}
              (320kbps CBR) file. It supports standard youtube.com/watch, short
              youtu.be, and /shorts links.
            </p>
            <p>
              <strong className="text-text-primary">When to use WAV:</strong> DJ
              software, audio editing (Ableton, Logic, FL Studio, Audacity), sampling,
              or video editing where quality matters — WAV is lossless, so there are no
              compression artifacts to worry about during further processing.
            </p>
            <p>
              <strong className="text-text-primary">When to use MP3:</strong> mobile
              listening, sharing via chat, or storing large libraries where file size
              matters. At 320kbps, MP3 is transparent enough for most casual use.
            </p>
            <p>
              <strong className="text-text-primary">Common legitimate uses:</strong>{" "}
              downloading your own uploaded videos, extracting audio from
              Creative-Commons or public-domain content, saving royalty-free tracks,
              backing up podcasts you have permission to save, and grabbing reference
              audio for a track you own.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            This tool is intended for downloading content you own the rights to, that
            is royalty-free or Creative Commons licensed, or that is in the public
            domain. You are solely responsible for ensuring you have the right to
            download and use any content. AudioForges does not host, store, or
            distribute copyrighted material.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Frequently asked questions</h2>
          <div className="space-y-5 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — AudioForges is completely free with no sign-up, no watermark, and no download limits.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                What&apos;s the difference between WAV and MP3 here?
              </h3>
              <p>
                WAV is lossless 44.1kHz audio — larger files, no compression artifacts.
                Use it for DJing, sampling, or editing. MP3 is 320kbps CBR — smaller
                files, transparent enough for casual listening.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Does this work with YouTube Shorts?</h3>
              <p>Yes. Standard youtube.com/watch links, short youtu.be links, and /shorts URLs are all supported.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is downloading YouTube audio legal?</h3>
              <p>
                It depends on whether you own the content, it&apos;s Creative Commons or
                public domain, or you have permission from the rights holder. You are
                responsible for how you use the tool.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}