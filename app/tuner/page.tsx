import type { Metadata } from "next";
import Link from "next/link";
import { TunerForm } from "@/components/browser/TunerForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free Online Guitar Tuner & Chromatic Tuner";
const PAGE_DESCRIPTION =
"Free online guitar and chromatic tuner. Tune guitar, bass, ukulele, violin, and more with your microphone in real time.";
export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tuner` },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Tune guitar, bass, ukulele, violin, and other instruments online with your microphone. Free chromatic tuner with real-time pitch detection.",
    url: `${SITE_URL}/tuner`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges Online Guitar Tuner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Tune guitar, bass, ukulele, violin, and other instruments online with your microphone.",
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below matches the actual TunerForm
// implementation (chromatic autocorrelation detection, cents display).
// No "more accurate than physical tuners" claim — unbenchmarked.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Online Guitar Tuner",
  url: `${SITE_URL}/tuner`,
  applicationCategory: "MusicApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Free online guitar tuner",
    "Chromatic tuner for all 12 notes",
    "Real-time microphone pitch detection",
    "Tune guitar, bass, ukulele, violin and other instruments",
    "Sharp and flat cents indicator",
    "Works directly in the browser",
    "No download or sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Online Guitar Tuner", item: `${SITE_URL}/tuner` },
  ],
};

const faqs = [
  {
    question: "Is this a free online guitar tuner?",
    answer:
      "Yes. This guitar tuner is free to use in your browser with no sign-up, download, or account required.",
  },
  {
    question: "Can I tune a guitar with my phone microphone?",
    answer:
      "Yes. Allow microphone access, play one guitar string at a time, and the tuner will detect the note and show whether it's sharp or flat.",
  },
  {
    question: "Does this work as a chromatic tuner?",
    answer:
      "Yes. It detects all twelve chromatic notes, so it can be used for guitar, bass, ukulele, violin, and many other instruments.",
  },
  {
    question: "What is standard guitar tuning?",
    answer:
      "Standard six-string guitar tuning is E2, A2, D3, G3, B3, and E4, from the lowest-pitched string to the highest.",
  },
  {
    question: "How accurate is the online tuner?",
    answer:
      "The tuner displays pitch deviation in cents. Accuracy depends on microphone quality, background noise, and how clearly the instrument produces a single sustained note.",
  },
  {
    question: "Can I tune bass and ukulele with this tuner?",
    answer:
      "Yes. Because it detects chromatic pitch rather than a fixed set of guitar strings, it can be used with bass, ukulele, violin, and other pitched instruments.",
  },
  {
    question: "Why isn't it detecting anything?",
    answer:
      "Make sure microphone access was granted, play a single sustained note rather than a chord (the detector is built for one pitch at a time), and reduce background noise if possible.",
  },
  {
    question: "Is my microphone audio uploaded?",
    answer:
      "No. Pitch analysis happens directly in your browser. The microphone audio is not recorded, saved, or uploaded to a server.",
  },
];

export default function TunerPage() {
  const relatedTools = getRelatedTools("tuner", 5);

  const GUITAR_STRINGS: [string, string, string][] = [
    ["6th string", "E2", "82.41 Hz"],
    ["5th string", "A2", "110.00 Hz"],
    ["4th string", "D3", "146.83 Hz"],
    ["3rd string", "G3", "196.00 Hz"],
    ["2nd string", "B3", "246.94 Hz"],
    ["1st string", "E4", "329.63 Hz"],
  ];

  const ALT_TUNINGS: [string, string][] = [
    ["Standard", "E A D G B E"],
    ["Drop D", "D A D G B E"],
    ["D Standard", "D G C F A D"],
    ["Open G", "D G D G B D"],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Online Guitar Tuner &amp; Chromatic Tuner
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Tune your guitar, bass, ukulele, violin, or any instrument with
            your microphone. Free chromatic tuner with real-time pitch
            detection.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <TunerForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Guitar, bass & more", desc: "Tune guitar, bass, ukulele, violin, and other instruments." },
            { title: "Chromatic detection", desc: "Detects all 12 notes and shows pitch in real time." },
            { title: "Nothing uploaded", desc: "Your microphone audio is analyzed directly in your browser." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to Tune a Guitar Online</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Click &quot;Start tuning&quot; and allow microphone access.</li>
            <li>Play one guitar string at a time and let it ring clearly.</li>
            <li>Watch the note and cents indicator to see whether the string is sharp or flat.</li>
            <li>Adjust the tuning peg until the note is centered and the tuner shows it&apos;s in tune.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Free Online Guitar Tuner</h2>
          <p className="text-text-muted leading-relaxed">
            Tune your acoustic or electric guitar online using your device&apos;s
            microphone. Play one string at a time and watch the pitch
            indicator show whether the note is sharp, flat, or in tune.
          </p>
          <h3 className="text-lg font-semibold text-text-primary">Standard Guitar Tuning</h3>
          <p className="text-text-muted leading-relaxed">
            Standard guitar tuning from the lowest string to the highest is
            E2, A2, D3, G3, B3, and E4. Use the chromatic tuner to check
            each string and adjust until the pitch is centered.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {GUITAR_STRINGS.map(([string, note, frequency]) => (
              <div key={string} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="text-sm text-text-muted">{string}</p>
                <p className="text-xl font-bold text-text-primary">{note}</p>
                <p className="text-xs text-text-subtle">{frequency}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Free Chromatic Tuner</h2>
          <p className="text-text-muted leading-relaxed">
            This is a chromatic tuner, so it can detect all twelve notes of
            the musical scale rather than being limited to one instrument or
            tuning. Use it for guitar, bass, ukulele, violin, cello, brass,
            woodwinds, vocals, and other instruments that produce a clear
            pitch.
          </p>
          <p className="text-text-muted leading-relaxed">
            The tuner shows the detected note, frequency, and cents
            difference from the nearest note. A centered reading means the
            instrument is in tune, while a negative or positive reading
            indicates the pitch is flat or sharp.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Guitar Tunings You Can Use</h2>
          <p className="text-text-muted leading-relaxed">
            Because this is a chromatic tuner, you can use it for standard
            and alternate guitar tunings. Play each string and tune it to
            the target note for the tuning you want.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ALT_TUNINGS.map(([name, tuning]) => (
              <div key={name} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <h3 className="font-semibold text-text-primary">{name}</h3>
                <p className="mt-1 font-mono text-sm text-text-muted">{tuning}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How the pitch detection works</h2>
          <p className="text-text-muted leading-relaxed">
            This tuner analyzes the actual shape of your instrument&apos;s
            sound wave to find its true fundamental frequency, rather than
            just checking which frequency band is loudest. That distinction
            matters for accuracy: a simpler approach can easily confuse two
            notes that are close together, while analyzing the waveform&apos;s
            repeating pattern directly gives a much finer, more reliable
            reading of exactly what pitch is being played.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of how autocorrelation-based pitch
            detection actually works, and why the tuner turns off your
            browser&apos;s echo cancellation and noise suppression?{" "}
            <Link href="/guides/how-instrument-tuners-detect-pitch" className="text-amber-400 hover:underline">
              Read How Instrument Tuners Actually Detect Pitch
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <p className="text-text-muted leading-relaxed">
            Tuning a guitar, bass, ukulele, or violin before practicing or
            recording, checking vocal pitch accuracy during warm-ups, and
            verifying an instrument&apos;s intonation across its range.
          </p>
          <p className="text-text-muted leading-relaxed">
            Need to find the pitch of an existing recording instead? Try the{" "}
            <Link href="/key-finder" className="text-amber-400 hover:underline">
              Key &amp; BPM Finder
            </Link>
            . Once your instrument is tuned, use the{" "}
            <Link href="/metronome" className="text-amber-400 hover:underline">
              Online Metronome
            </Link>{" "}
            to practice at a consistent tempo.
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