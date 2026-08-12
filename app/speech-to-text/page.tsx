import type { Metadata } from "next";
import Link from "next/link";
import { SpeechToTextForm } from "@/components/converter/SpeechToTextForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free AI Speech to Text",
  description:
    "Transcribe audio to text free with AI (Whisper). Auto-detects language, includes timestamps, exports as text or SRT captions.",
  keywords: [
    "speech to text free",
    "audio transcription online",
    "transcribe audio to text",
    "automatic transcription",
    "speech recognition online",
    "transcript generator",
    "subtitle generator",
    "caption generator",
    "auto transcribe mp3",
    "generate srt from audio",
    "transcribe mp3 to text",
    "transcribe wav to text",
    "txt vs srt",
    "multilingual transcription",
  ],
  alternates: { canonical: `${SITE_URL}/speech-to-text` },
  openGraph: {
    title: "Free AI Speech to Text — Transcribe Audio with Timestamps",
    description:
      "Transcribe audio to text free with AI (Whisper), no sign-up. Auto-detects language, includes timestamps, and exports as plain text or SRT captions and subtitles.",
    url: `${SITE_URL}/speech-to-text`,
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
    title: "Free AI Speech to Text — Transcribe Audio with Timestamps",
    description:
      "Transcribe audio to text free with AI (Whisper), no sign-up. Auto-detects language, includes timestamps, and exports as plain text or SRT captions and subtitles.",
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI Speech to Text Transcriber",
  url: `${SITE_URL}/speech-to-text`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  dateModified: "2026-07-25",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Automatic language detection",
    "Timestamped transcript segments",
    "Export as plain text or SRT",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Speech to Text", item: `${SITE_URL}/speech-to-text` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Transcribe Audio to Text",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, or OGG file." },
    { "@type": "HowToStep", name: "Transcribe", text: "Processing runs automatically — language is auto-detected, no settings needed." },
    { "@type": "HowToStep", name: "Choose export", text: "Export the result as plain text or SRT captions." },
    { "@type": "HowToStep", name: "Download", text: "Download your transcript or caption file." },
  ],
};

// Same 9 questions and answers as before, word-for-word.
const faqs = [
  {
    question: "How long does transcription take?",
    answer:
      "It can take a few minutes for longer files — transcription runs on CPU, processing one file at a time, so it's slower than the other tools on this site.",
  },
  {
    question: "Can I get captions or subtitles from this?",
    answer:
      "Yes — the transcript includes timestamps, so you can export it directly as an SRT caption file in addition to plain text.",
  },
  {
    question: "Do I need to specify the language?",
    answer: "No — language is automatically detected.",
  },
  {
    question: "What affects transcription accuracy?",
    answer:
      "Background noise, overlapping speech, and low recording volume are the most common causes of transcription errors. Cleaning up noisy audio before transcribing it usually improves the result more than anything else.",
  },
  {
    question: "What formats can I upload?",
    answer: "MP3, WAV, FLAC, M4A, AAC, and OGG, up to 80MB and 20 minutes long.",
  },
  {
    question: "Is this really free?",
    answer:
      "Yes — completely free, no sign-up. Limited to 2 transcriptions per 5 minutes since only one runs at a time.",
  },
  {
    question: "What's the difference between the TXT and SRT export?",
    answer:
      "Plain text is the transcript as continuous readable text, with no timing information — good for reading, searching, or pasting into notes. SRT is the same transcript split into timed caption blocks that video players and editors recognize directly as subtitles.",
  },
  {
    question: "What languages does this support?",
    answer:
      "The underlying model supports a wide range of languages and detects the spoken language automatically. Accuracy is generally strongest for widely-spoken languages with more training data, and can vary for less common languages or heavy accents.",
  },
  {
    question: "Are my files stored after transcription?",
    answer:
      "No — your audio is processed only for the time needed to generate the transcript and isn't retained afterward.",
  },
];

export default function SpeechToTextPage() {
  const relatedTools = getRelatedTools("speech-to-text", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free AI Speech to Text
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload audio and get a full transcript with timestamps, free, no
            sign-up, exportable as text or SRT captions.
          </p>
        </header>

        <SpeechToTextForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Auto language detection", desc: "No need to specify what language it's in." },
            { title: "Timestamped", desc: "Every segment includes start and end times." },
            { title: "Two export formats", desc: "Plain text or SRT captions, your choice." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to transcribe audio to text</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, or OGG file.</li>
            <li>Processing runs automatically — language is detected for you.</li>
            <li>Choose plain text or SRT captions as your export format.</li>
            <li>Download your transcript or caption file.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            {["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG"].map((fmt) => (
              <span
                key={fmt}
                className="inline-flex items-center gap-1 rounded-full border border-graphite-800 bg-graphite-900 px-3 py-1 text-xs text-text-muted"
              >
                <span className="text-teal-400">✓</span>
                {fmt}
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Set your expectations on wait time</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            This tool runs on Whisper, an AI speech-recognition model, processing
            on a CPU-based backend one file at a time rather than the near-instant
            way a format conversion or a simple effect can run. Longer files can
            take several minutes to finish — this is the slowest tool here by
            design, not a bug.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">TXT vs SRT: which export should you pick?</h2>
          <p className="text-text-muted leading-relaxed">
            <strong className="text-text-primary">Plain text</strong> gives you the
            transcript as continuous readable text with no timing markers — the
            right choice for reading back an interview, searching a transcript for
            a quote, or pasting notes somewhere. <strong className="text-text-primary">
            SRT</strong> splits the same transcript into timed caption blocks that
            video editors and players recognize directly as subtitles — use this
            when the transcript is headed into a video, whether that&apos;s for
            accessibility captions, translation work, or just burning subtitles
            into a clip.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Language support</h2>
          <p className="text-text-muted leading-relaxed">
            The transcription model auto-detects the spoken language and supports
            a wide range of languages without you needing to specify anything.
            Accuracy is generally strongest for widely-spoken languages with more
            available training data, and can vary more for less common languages,
            heavy accents, or mixed-language audio.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What affects transcription accuracy</h2>
          <p className="text-text-muted leading-relaxed">
            Background noise, overlapping speech, and low recording volume are the
            most common reasons a transcript comes back with errors — this is true
            of any speech-to-text engine, not specific to this tool. A few quick
            fixes before you transcribe tend to help more than anything else:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-text-muted leading-relaxed">
            <li>
              Noticeable hiss, hum, or background noise? Run it through the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              first.
            </li>
            <li>
              Non-speech background noise from music or field recording?{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              gives you adjustable control instead.
            </li>
            <li>
              Only need to transcribe part of a longer file?{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Trim Audio
              </Link>{" "}
              down to the relevant section first — shorter files also process faster.
            </li>
            <li>
              Wrong file format?{" "}
              <Link href="/convert" className="text-amber-400 hover:underline">
                Convert
              </Link>{" "}
              it to one of the supported formats before uploading.
            </li>
          </ul>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of what specifically degrades accuracy and how
            to prep a file properly?{" "}
            <Link href="/guides/transcribing-audio-accurately" className="text-amber-400 hover:underline">
              Read How to Get Accurate Audio Transcripts
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Turn a podcast episode or interview into a searchable text transcript,
              generate SRT captions or subtitles for a video, pull quotable text from
              a voice memo without re-listening to the whole thing, or convert a
              lecture or online-course recording into notes you can search and skim.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why use AudioForges?</h2>
          <ul className="grid gap-2 sm:grid-cols-2 text-text-muted leading-relaxed">
            {[
              "Free, no sign-up required",
              "No watermark on any export",
              "Runs entirely in your browser",
              "Files aren't retained after processing",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-teal-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
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