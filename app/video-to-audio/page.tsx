import type { Metadata } from "next";
import Link from "next/link";
import { VideoToAudioForm } from "@/components/converter/VideoToAudioForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free Video to Audio Converter — MP4 to MP3, M4A & More";
const PAGE_DESCRIPTION =
  "Extract audio from MP4, MOV, MKV, and other video files online, free. Convert to MP3, WAV, FLAC, M4A, and more. No sign-up, no watermark.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/video-to-audio` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/video-to-audio`,
    siteName: SITE_NAME,
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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below is checked against the actual
// VideoToAudioForm/backend behavior. No guaranteed-timing claims, since
// exact extraction speed depends on the source file and can't be promised.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Video to Audio Converter",
  url: `${SITE_URL}/video-to-audio`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Extract audio from MP4, MOV, MKV, AVI, WebM, and more",
    "Output as MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF",
    "Direct audio extraction for compatible M4A/AAC sources",
    "No sign-up required",
    "No watermark",
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
      name: "Video to Audio Converter",
      item: `${SITE_URL}/video-to-audio`,
    },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.

const faqs = [
  {
    question: "What video formats can I upload?",
    answer:
      "MP4, MOV, MKV, AVI, WebM, FLV, WMV, M4V, 3GP, MPEG, and MPG.",
  },
  {
    question: "Why is M4A/AAC output faster than MP3 or WAV?",
    answer:
      "When the video's audio is already encoded as AAC, extracting it to a compatible M4A or AAC output can copy the existing audio stream without re-encoding. MP3, WAV, FLAC, OGG, and AIFF output generally requires decoding and processing the audio into the new format, which takes additional time.",
  },
  {
    question: "Does choosing WAV or FLAC give me better quality than M4A?",
    answer:
      "No — if the source video's audio is AAC, it's already lossy. Converting that audio to a lossless container such as WAV or FLAC can't recover detail that was already discarded. It only produces a larger file. Lossless output is most useful when the original audio was itself lossless.",
  },
  {
    question: "What's the maximum video file size and length?",
    answer: "Up to 200MB per upload, and up to 60 minutes of video.",
  },
  {
    question: "Will this work on a screen recording or phone video?",
    answer:
      "Yes — as long as the video is in a supported format and contains an audio track. A silent recording with no audio can't produce an extracted audio file.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark on the output.",
  },
  {
    question: "Can I transcribe the extracted audio afterward?",
    answer:
      "Yes — once you have the audio file, upload it to Speech to Text for a transcript with timestamps.",
    answerNode: (
      <>
        Yes — once you have the audio file, upload it to{" "}
        <Link href="/speech-to-text" className="text-amber-400 hover:underline">
          Speech to Text
        </Link>{" "}
        for a transcript with timestamps.
      </>
    ),
  },
];

export default function VideoToAudioPage() {
  const relatedTools = getRelatedTools("video-to-audio", 5);

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

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Video to Audio Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Extract audio from MP4, MOV, MKV, and other video files, free, no
            sign-up, no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <VideoToAudioForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Any video format", desc: "MP4, MOV, MKV, AVI, WebM, and more." },
            { title: "7 audio formats", desc: "MP3, WAV, FLAC, M4A, AAC, OGG, AIFF." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to extract audio from a video</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP4, MOV, MKV, AVI, WebM, or other supported video file.</li>
            <li>Choose an output format. M4A or AAC can be the fastest option when the source already contains compatible AAC audio.</li>
            <li>Download the extracted audio file.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why M4A/AAC can be the fast option</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Many video files already contain audio encoded as AAC. When the
              source audio is compatible, extracting it to M4A or AAC can
              copy the existing audio stream into an audio-only file without
              re-encoding it. That avoids an unnecessary quality conversion
              and can make the extraction substantially faster.
            </p>
            <p>
              Other output formats such as MP3, WAV, FLAC, OGG, and AIFF
              generally require the audio to be decoded and processed into
              the new format, which takes additional processing time.
            </p>
            <p>
              Want the fuller breakdown of what a stream copy actually is,
              and when lossless output genuinely helps versus when it's just
              a bigger file?{" "}
              <Link href="/guides/why-m4a-extraction-is-instant" className="text-amber-400 hover:underline">
                Read Why Extracting Audio to M4A Is Instant (and WAV Isn&apos;t)
              </Link>.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">WAV and FLAC don&apos;t add quality back</h2>
          <p className="text-text-muted leading-relaxed">
            A common assumption is that WAV or FLAC output is automatically
            higher quality. If the video&apos;s original audio was AAC, it has
            already gone through lossy compression. Wrapping or converting
            that audio into a lossless format afterward can&apos;t recover
            detail that was already discarded. It simply produces a larger
            file containing the processed audio. Lossless output is most
            useful when the source audio was itself lossless.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Pulling the soundtrack from a screen recording, extracting a
              podcast or interview&apos;s audio from a video recording,
              getting an audio file from a phone video for editing, and
              preparing audio from a video file for transcription.
            </p>
            <p>
              Need a specific section of the extracted audio rather than the
              whole thing? Trim it down afterward with the{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>
              .
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