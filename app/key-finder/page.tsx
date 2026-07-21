import type { Metadata } from "next";
import { KeyFinderForm } from "@/components/converter/KeyFinderForm";

const SITE_URL = "https://audioforges.com";

export const metadata: Metadata = {
  title: "Song Key Finder & BPM Detector | AudioForges",
  description:
    "Find any song's key, BPM, and Camelot notation free, instantly — no sign-up. Upload a track and get accurate results for DJ mixing and production.",
  keywords: [
    "key finder",
    "bpm finder",
    "key bpm finder",
    "bpm checker",
    "song key finder",
    "key and bpm finder",
    "keyfinder",
  ],
  alternates: { canonical: `${SITE_URL}/key-finder` },
  openGraph: {
    title: "Song Key Finder & BPM Detector | AudioForges",
    description: "Find any song's key, BPM, and Camelot notation free, instantly.",
    url: `${SITE_URL}/key-finder`,
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
      name: "What is Camelot notation?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A numbering system for musical keys (1A–12B) that maps every key onto a wheel where neighbours are harmonically compatible. Standard on Rekordbox, Serato, Traktor and Mixed In Key.",
      },
    },
    {
      "@type": "Question",
      name: "Why does BPM matter for DJs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Matching or beat-syncing BPM is what allows two tracks to play in time together.",
      },
    },
    {
      "@type": "Question",
      name: "What file formats can I upload?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MP3, WAV, FLAC, M4A, AAC and OGG, up to 50MB per file.",
      },
    },
  ],
};

export default function KeyFinderPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Song Key &amp; BPM Finder
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload any song and instantly detect its musical key and tempo for mixing
            and production.
          </p>
        </header>

        <KeyFinderForm />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why key and BPM matter</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Every piece of tonal music sits in a <strong className="text-text-primary">key</strong> —
              a home note and scale the melody and chords are built around.{" "}
              <strong className="text-text-primary">BPM</strong> is how fast the track pulses.
              Together, they&apos;re the two numbers DJs and producers need before mixing,
              remixing, or layering two tracks.
            </p>
            <p>
              <strong className="text-text-primary">Harmonic mixing</strong> — blending
              tracks with compatible keys — is what separates a set that flows from
              one that clashes.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Understanding Camelot notation</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              The <strong className="text-text-primary">Camelot Wheel</strong> renames
              the 24 musical keys as numbers 1–12 followed by &quot;A&quot; (minor) or
              &quot;B&quot; (major). From any key, you can safely mix into the same
              number, the next number up, or the next number down.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Frequently asked questions</h2>
          <div className="space-y-5 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What is Camelot notation?</h3>
              <p>A numbering system for musical keys (1A–12B) mapping every key onto a wheel of harmonically compatible neighbours.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Why does BPM matter for DJs?</h3>
              <p>Matching or beat-syncing BPM lets two tracks play in time together.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What file formats can I upload?</h3>
              <p>MP3, WAV, FLAC, M4A, AAC and OGG, up to 50MB per file.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}