import type { Metadata } from "next";
import Link from "next/link";
import { KeyFinderForm } from "@/components/converter/KeyFinderForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Song Key & BPM Finder",
  description:
    "Find the musical key, BPM, tempo, and Camelot notation of any song online for free. Upload MP3, WAV, FLAC, AAC, M4A, or OGG. No sign-up required.",
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
    "song bpm detector",
    "music key detector",
    "track key finder",
    "tempo detector",
    "find bpm of song",
    "detect tempo",
    "dj key finder",
    "harmonic mixing tool",
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

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Find the Key and BPM of a Song",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, or OGG file." },
    { "@type": "HowToStep", name: "Analyze", text: "The tool automatically analyzes the musical key and tempo — no settings to configure." },
    { "@type": "HowToStep", name: "View results", text: "See the detected key, BPM, and Camelot notation in a few seconds." },
  ],
};

// Same 7 questions and answers as before, word-for-word.
const faqs = [
  {
    question: "What is Camelot notation?",
    answer:
      "A numbering system for musical keys (1A–12B) that maps every key onto a wheel where neighbours are harmonically compatible. Standard on Rekordbox, Serato, Traktor and Mixed In Key.",
  },
  {
    question: "Why does BPM matter for DJs?",
    answer: "Matching or beat-syncing BPM is what allows two tracks to play in time together.",
  },
  {
    question: "What's the difference between major and minor keys?",
    answer:
      "Major keys generally sound brighter and more resolved, while minor keys sound darker or more emotional. Every major key has a relative minor built from the same notes, which is why they share the same Camelot number with a different letter.",
  },
  {
    question: "What file formats can I upload?",
    answer: "MP3, WAV, FLAC, M4A, AAC and OGG, up to 50MB per file.",
  },
  {
    question: "How long does key and BPM detection take?",
    answer:
      "Just a few seconds for most tracks — results appear as soon as analysis finishes, no waiting in a queue.",
  },
  {
    question: "Is my uploaded track stored or shared?",
    answer:
      "No. Analysis runs entirely to detect key and tempo — AudioForges does not store or distribute uploaded tracks.",
  },
  {
    question: "What affects detection accuracy?",
    answer:
      "Clean, full-length tracks with consistent tempo and clear harmonic content analyze most reliably. Live recordings, heavy distortion, tempo changes mid-track, spoken-word audio, or long drum-only intros give the analysis less to work with and can reduce accuracy.",
  },
];

export default function KeyFinderPage() {
  const relatedTools = getRelatedTools("key-finder", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

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

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What affects detection accuracy</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Key and BPM detection works best on clean, full-length tracks
              with a consistent tempo and clear harmonic content throughout.
            </p>
            <p>
              Live recordings, heavy distortion, songs with tempo changes
              mid-track, spoken-word audio, or long intros containing only
              drums give the analysis less to work with, which can reduce
              accuracy — there&apos;s simply less clear harmonic and rhythmic
              information for it to lock onto.
            </p>
            <p>
              If your recording has significant background noise, running it
              through the{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              first can improve detection.
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