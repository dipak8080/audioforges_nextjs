import type { Metadata } from "next";
import Link from "next/link";
import { MetronomeForm } from "@/components/browser/MetronomeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free Online Metronome – Adjustable BPM & Tempo";
const PAGE_DESCRIPTION =
  "Use a free online metronome with adjustable BPM and time signature. Set your tempo from 30 to 300 BPM and practice rhythm directly in your browser.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/metronome` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/metronome`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges Online Metronome" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below matches the actual
// MetronomeForm implementation. "Precisely scheduled" rather than
// "sample-accurate" as a headline claim, since the latter hasn't been
// independently benchmarked even though AudioContext timing is genuinely
// far more precise than a JS timer.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Online Metronome",
  url: `${SITE_URL}/metronome`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Adjustable BPM from 30 to 300",
    "Configurable time signature with an accented downbeat",
    "Scheduled against the audio clock to avoid drift",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Metronome", item: `${SITE_URL}/metronome` },
  ],
};

const faqs = [
  {
    question: "Does this metronome drift out of time?",
    answer:
      "No — it schedules each click ahead of time directly against your browser's audio clock, rather than relying on a regular JavaScript timer that can drift under load. Timing stays consistent for as long as you leave it running.",
  },
  {
    question: "What BPM range is supported?",
    answer: "30 to 300 BPM, covering everything from a slow largo to a fast presto.",
  },
  {
    question: "What does the accented beat mean?",
    answer:
      "The first beat of each measure (the downbeat) plays at a slightly higher pitch and louder volume, matching how a physical metronome marks the start of each bar.",
  },
  {
    question: "Can I change the time signature?",
    answer: "Yes — set beats per measure from 2 to 8 to match 2/4, 3/4, 4/4, 5/4, 6/8, and other common signatures.",
  },
  {
    question: "Do I need to install anything?",
    answer: "No — it runs entirely in your browser using Web Audio, no app or plugin needed.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no ads, no limits.",
  },
  {
    question: "Is there a tool to figure out a song's BPM instead of setting one?",
    answer:
      "Yes — the BPM Tapper lets you tap along to a beat and calculates the tempo for you.",
    answerNode: (
      <>
        Yes — the{" "}
        <Link href="/bpm-tapper" className="text-amber-400 hover:underline">
          BPM Tapper
        </Link>{" "}
        lets you tap along to a beat and calculates the tempo for you.
      </>
    ),
  },
];

interface MetronomePageProps {
  searchParams: Promise<{ bpm?: string }>;
}

export default async function MetronomePage({ searchParams }: MetronomePageProps) {
  const relatedTools = getRelatedTools("metronome", 5);
  const resolvedSearchParams = await searchParams;
  const parsedBpm = resolvedSearchParams.bpm ? parseInt(resolvedSearchParams.bpm, 10) : undefined;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Online Metronome
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Adjustable BPM and time signature, right in your browser, free,
            no sign-up, no app.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <MetronomeForm initialBpm={parsedBpm} />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "30–300 BPM", desc: "Adjustable tempo covering everything from largo to presto." },
            { title: "No drift", desc: "Scheduled against your browser's audio clock, not a basic timer." },
            { title: "No sign-up", desc: "No account, no ads, no limits." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to use the metronome</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Set your tempo using the slider or +/- buttons.</li>
            <li>Choose how many beats per measure to match your time signature.</li>
            <li>Tap start — the first beat of each measure is accented.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is an online metronome?</h2>
          <p className="text-text-muted leading-relaxed">
            An online metronome is a browser-based tool that plays a steady
            beat at a chosen tempo, measured in beats per minute (BPM).
            Musicians use a metronome to practice timing, improve rhythm,
            learn songs, and gradually increase playing speed. This one lets
            you choose a BPM from 30 to 300 and set the number of beats in
            each measure to match your time signature.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What BPM should I practice at?</h2>
          <p className="text-text-muted leading-relaxed">
            Start at a tempo where you can play the exercise accurately and
            comfortably. For difficult passages, many musicians begin slowly
            and increase the BPM gradually as their timing improves. There&apos;s
            no single ideal practice tempo — the right BPM depends on the
            exercise, the song, and your current playing level. If you
            already know a song&apos;s tempo and want to match it exactly, the{" "}
            <Link href="/key-finder" className="text-amber-400 hover:underline">
              Key &amp; BPM Finder
            </Link>{" "}
            can detect it directly from an audio file.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common metronome tempos</h2>
          <p className="text-text-muted leading-relaxed">
            Slow practice tempos are often useful for learning difficult
            passages, while faster tempos can be used once the notes and
            rhythm are secure. A tempo like 60 BPM gives one beat per
            second, while 120 BPM gives two beats per second. Use the BPM
            controls above to find the tempo that fits your practice.
          </p>
          <p className="text-text-muted leading-relaxed">
            Practicing an instrument and need to check pitch too? The{" "}
            <Link href="/tuner" className="text-amber-400 hover:underline">
              Online Tuner
            </Link>{" "}
            runs the same way, directly in your browser.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why this metronome doesn&apos;t drift</h2>
          <p className="text-text-muted leading-relaxed">
            Many simple online metronomes use a basic JavaScript timer to
            trigger each click, which can drift audibly out of time under
            normal browser load. This one schedules every click ahead of
            time directly against your browser&apos;s own audio clock — the
            same technique used in professional audio software — so timing
            stays consistent no matter how long you leave it running.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller technical breakdown of why plain JavaScript
            timers drift and how look-ahead scheduling actually fixes it?{" "}
            <Link href="/guides/why-online-metronomes-drift" className="text-amber-400 hover:underline">
              Read Why Online Metronomes Drift Out of Time
            </Link>. Need to change a recording&apos;s tempo to match your
            practice speed instead? The{" "}
            <Link href="/tempo" className="text-amber-400 hover:underline">
              Tempo Changer
            </Link>{" "}
            handles that.
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

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}