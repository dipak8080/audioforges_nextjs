import type { Metadata } from "next";
import Link from "next/link";
import { SpeechToTextForm } from "@/components/converter/SpeechToTextForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Speech to Text — Transcribe Audio with Timestamps",
  description:
    "Transcribe audio to text free, no sign-up. Auto-detects language, includes timestamps, and exports as plain text or SRT captions and subtitles.",
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
  ],
  alternates: { canonical: `${SITE_URL}/speech-to-text` },
  openGraph: {
    title: "Free Speech to Text — Transcribe Audio with Timestamps",
    description: "Transcribe audio to text free, no sign-up. Includes timestamps.",
    url: `${SITE_URL}/speech-to-text`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Speech to Text — Transcribe Audio with Timestamps",
    description: "Transcribe audio to text free, no sign-up. Includes timestamps.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How long does transcription take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It can take a few minutes for longer files — transcription runs on CPU, processing one file at a time, so it's slower than the other tools on this site.",
      },
    },
    {
      "@type": "Question",
      name: "Can I get captions or subtitles from this?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — the transcript includes timestamps, so you can export it directly as an SRT caption file in addition to plain text.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to specify the language?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — language is automatically detected.",
      },
    },
    {
      "@type": "Question",
      name: "What affects transcription accuracy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Background noise, overlapping speech, and low recording volume are the most common causes of transcription errors. Cleaning up noisy audio before transcribing it usually improves the result more than anything else.",
      },
    },
    {
      "@type": "Question",
      name: "What formats can I upload?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MP3, WAV, FLAC, M4A, AAC, and OGG, up to 50MB and 20 minutes long.",
      },
    },
    {
      "@type": "Question",
      name: "Is this really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — completely free, no sign-up. Limited to 2 transcriptions per 5 minutes since only one runs at a time.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Speech to Text Transcriber",
  url: `${SITE_URL}/speech-to-text`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
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

export default function SpeechToTextPage() {
  const relatedTools = getRelatedTools("speech-to-text", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Speech to Text
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload audio and get a full transcript with timestamps — free, no
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
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
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
        </section>

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Set your expectations on wait time</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Unlike the other tools on this site, transcription runs on a CPU-based
            model that processes one file at a time. Longer files can take several
            minutes to finish — this is the slowest tool here by design, not a bug.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported formats</h2>
          <p className="text-text-muted leading-relaxed">
            Upload MP3, WAV, FLAC, M4A, AAC, or OGG files up to 50MB and 20 minutes
            long. The transcript comes back with per-segment timestamps regardless
            of source format, so you can export the same result as plain text for
            reading or SRT for captions.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What affects transcription accuracy</h2>
          <p className="text-text-muted leading-relaxed">
            Background noise, overlapping speech, and low recording volume are the
            most common reasons a transcript comes back with errors — this is true
            of any speech-to-text engine, not specific to this tool. If your source
            recording has noticeable hiss, hum, or background noise, running it
            through the{" "}
            <Link href="/voice-clean" className="text-amber-400 hover:underline">
              Voice Cleaner
            </Link>{" "}
            first is the single most effective way to improve accuracy before you
            transcribe.
          </p>
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

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Frequently asked questions</h2>
          <div className="space-y-5 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">How long does transcription take?</h3>
              <p>It can take a few minutes for longer files — transcription runs on CPU, processing one file at a time, so it&apos;s slower than the other tools on this site.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Can I get captions or subtitles from this?</h3>
              <p>Yes — the transcript includes timestamps, so you can export it directly as an SRT caption file in addition to plain text.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Do I need to specify the language?</h3>
              <p>No — language is automatically detected.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What affects transcription accuracy?</h3>
              <p>
                Background noise, overlapping speech, and low recording volume are
                the most common causes of transcription errors. Cleaning up noisy
                audio before transcribing it usually improves the result more than
                anything else.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What formats can I upload?</h3>
              <p>MP3, WAV, FLAC, M4A, AAC, and OGG, up to 50MB and 20 minutes long.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — completely free, no sign-up. Limited to 2 transcriptions per 5 minutes since only one runs at a time.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}