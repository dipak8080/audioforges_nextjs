import type { Metadata } from "next";
import Link from "next/link";
import { KeyFinderForm } from "@/components/converter/KeyFinderForm";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Song Key & BPM Finder",
  description:
    "Find any song's musical key, BPM, and Camelot notation online free. Upload MP3, WAV, FLAC, AAC, M4A, or OGG — no sign-up required.",
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
    "camelot notation",
    "harmonic mixing",
    "find key of song",
    "detect song key",
  ],
  alternates: { canonical: `${SITE_URL}/key-finder` },
  openGraph: {
    title: "Free Song Key & BPM Finder",
    description:
      "Find any song's key, BPM, and Camelot notation free, instantly — no sign-up.",
    url: `${SITE_URL}/key-finder`,
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
    title: "Free Song Key & BPM Finder",
    description:
      "Find any song's key, BPM, and Camelot notation free, instantly — no sign-up.",
    images: ["/images/og-default.png"],
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
      name: "What's the difference between major and minor keys?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Major keys generally sound brighter and more resolved, while minor keys sound darker or more emotional. Every major key has a relative minor built from the same notes, which is why they share the same Camelot number with a different letter.",
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
  const relatedTools = getRelatedTools("key-finder", 5);

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
          <h2 className="text-2xl font-bold text-text-primary">How to find a song's key and BPM</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, or OGG file.</li>
            <li>Analysis runs automatically — no settings to configure.</li>
            <li>Get the detected key, BPM, and Camelot code in a few seconds.</li>
          </ol>
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
          <h2 className="text-2xl font-bold text-text-primary">Major vs. minor keys</h2>
          <p className="text-text-muted leading-relaxed">
            A detected key is always either major or minor. Major keys
            generally read as brighter or more resolved; minor keys read as
            darker or more emotional. Every major key shares its exact notes
            with a relative minor key — which is exactly why they sit at the
            same Camelot number with a different letter (8A and 8B, for
            example), and why that pairing is always a safe harmonic move.
          </p>
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
            <p>
              Want the full breakdown of how to use this for building a set?{" "}
              <Link href="/guides/camelot-wheel-harmonic-mixing" className="text-amber-400 hover:underline">
                Read The Camelot Wheel Explained: Harmonic Mixing for DJs
              </Link>.
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
              <h3 className="font-semibold text-text-primary mb-1">What is Camelot notation?</h3>
              <p>A numbering system for musical keys (1A–12B) mapping every key onto a wheel of harmonically compatible neighbours.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Why does BPM matter for DJs?</h3>
              <p>Matching or beat-syncing BPM lets two tracks play in time together.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What&apos;s the difference between major and minor keys?</h3>
              <p>Major keys generally sound brighter and more resolved, while minor keys sound darker or more emotional. Every major key has a relative minor built from the same notes, which is why they share the same Camelot number with a different letter.</p>
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