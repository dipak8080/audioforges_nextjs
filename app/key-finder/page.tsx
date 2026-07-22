import type { Metadata } from "next";
import Link from "next/link";
import { KeyFinderForm } from "@/components/converter/KeyFinderForm";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Free Song Key & BPM Finder",
  description:
    "Find any song's key, BPM, and Camelot notation free, instantly — no sign-up, 100% web-based. Upload a track and get accurate results for DJ mixing and production.",
  keywords: [
    "key finder",
    "bpm finder",
    "key bpm finder",
    "bpm checker",
    "song key finder",
    "key and bpm finder",
    "keyfinder",
    "free key bpm finder",
    "camelot wheel finder",
  ],
  alternates: { canonical: `${SITE_URL}/key-finder` },
  openGraph: {
    title: "Free Song Key & BPM Finder",
    description:
      "Find any song's key, BPM, and Camelot notation free, instantly — no sign-up.",
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
    {
      "@type": "Question",
      name: "How long does key and BPM detection take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Just a few seconds for most tracks — results appear as soon as analysis finishes, no waiting in a queue.",
      },
    },
    {
      "@type": "Question",
      name: "Is my uploaded track stored or shared?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Analysis runs entirely to detect key and tempo — AudioForges does not store or distribute uploaded tracks.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Song Key & BPM Finder",
  url: `${SITE_URL}/key-finder`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Detect musical key of any song",
    "Detect BPM / tempo",
    "Camelot notation for harmonic mixing",
    "No sign-up required",
    "100% web-based",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Key & BPM Finder", item: `${SITE_URL}/key-finder` },
  ],
};

export default function KeyFinderPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Song Key &amp; BPM Finder
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload any song and instantly detect its musical key and tempo —
            free, no sign-up, 100% web-based.
          </p>
        </header>

        <KeyFinderForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Instant", desc: "Results in a few seconds — no queue, no waiting." },
            { title: "Accurate", desc: "Key, BPM, and Camelot notation for confident mixing." },
            { title: "Web-based", desc: "No install, no account — upload and go." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

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
          <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/youtube-to-wav"
              className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
            >
              <h3 className="font-semibold text-text-primary">YouTube to WAV Converter</h3>
              <p className="text-sm text-text-muted mt-1">
                Pull a track from YouTube, then check its key and BPM here.
              </p>
            </Link>
            <Link
              href="/vocal-remover"
              className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
            >
              <h3 className="font-semibold text-text-primary">Vocal Remover</h3>
              <p className="text-sm text-text-muted mt-1">
                Isolate the instrumental, then confirm its key before you mix it in.
              </p>
            </Link>
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
            <div>
              <h3 className="font-semibold text-text-primary mb-1">How long does key and BPM detection take?</h3>
              <p>Just a few seconds for most tracks — no queue, no waiting.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is my uploaded track stored or shared?</h3>
              <p>No — AudioForges does not store or distribute uploaded tracks.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}