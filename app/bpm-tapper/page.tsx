import type { Metadata } from "next";
import Link from "next/link";
import { BpmTapperForm } from "@/components/browser/BpmTapperForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free BPM Tapper – Tap to Find BPM & Tempo";
const PAGE_DESCRIPTION =
  "Tap along to a beat to find its BPM and tempo instantly. Free online BPM tapper with keyboard support, no sign-up, and no download.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/bpm-tapper` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/bpm-tapper`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges BPM Tapper" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below matches the actual
// BpmTapperForm implementation (rolling 8-tap window, 2-second reset).
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "BPM Tapper",
  url: `${SITE_URL}/bpm-tapper`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Tap-to-tempo BPM detection",
    "Keyboard support (Space/Enter)",
    "Sends the result directly to the Metronome",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "BPM Tapper", item: `${SITE_URL}/bpm-tapper` },
  ],
};

const faqs = [
  {
    question: "Can I find the BPM of a song by tapping?",
    answer:
      "Yes. Play the song and tap the button in time with its beat. After several taps, the tool calculates an estimated BPM from the intervals between your taps.",
  },
  {
    question: "How does this figure out the BPM?",
    answer:
      "It measures the time between each tap and averages the intervals from your most recent taps, converting that average into beats per minute — the more consistently you tap, the more accurate the result.",
  },
  {
    question: "How many times do I need to tap?",
    answer:
      "At least two taps give an estimate, but tapping along for 6-8 beats gives a much more stable, accurate reading than just two or three.",
  },
  {
    question: "What if I pause partway through?",
    answer:
      "A pause of more than 2 seconds starts a fresh tapping session rather than treating the gap as a very slow beat, so a brief interruption won't throw off your result — just start tapping again.",
  },
  {
    question: "Can I use my keyboard instead of clicking?",
    answer: "Yes — press Space or Enter in time with the beat once the tap area is focused.",
  },
  {
    question: "Can I send the result straight to a metronome?",
    answer:
      "Yes — once a BPM is detected, the \"Use in Metronome\" button opens the Metronome pre-set to that exact tempo.",
    answerNode: (
      <>
        Yes — once a BPM is detected, the &quot;Use in Metronome&quot;
        button opens the{" "}
        <Link href="/metronome" className="text-amber-400 hover:underline">
          Metronome
        </Link>{" "}
        pre-set to that exact tempo.
      </>
    ),
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no ads, no limits.",
  },
];

export default function BpmTapperPage() {
  const relatedTools = getRelatedTools("bpm-tapper", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free BPM Tapper
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Tap along to a beat and find its BPM and tempo in seconds — free,
            no sign-up, right in your browser.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <BpmTapperForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Live estimate", desc: "See your BPM update as you tap." },
            { title: "Keyboard support", desc: "Tap with a click, Space, or Enter." },
            { title: "No sign-up", desc: "No account, no ads, no limits." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to find a tempo by tapping</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Tap the button in time with a beat — from a song, a metronome, or your own count.</li>
            <li>Keep tapping for 6-8 beats for a stable, accurate result.</li>
            <li>Send the result straight to the Metronome, or note it down.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is a BPM tapper?</h2>
          <p className="text-text-muted leading-relaxed">
            A BPM tapper is an online tool that calculates the tempo of
            music by measuring the time between your taps. BPM stands for
            beats per minute, which is the standard way of describing
            musical tempo. Tap along with a song, beat, or metronome and
            this tool estimates its BPM from your tapping pattern.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How accurate is a BPM tapper?</h2>
          <p className="text-text-muted leading-relaxed">
            The result depends on how consistently you tap. Two taps
            provide a basic estimate, while tapping along for 6 to 8 beats
            gives the tool more intervals to average. This BPM tapper uses
            only your most recent taps to keep the estimate responsive if
            the tempo changes partway through. If you pause for more than
            two seconds, a new tapping session starts automatically rather
            than treating the gap as one very slow beat.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of why only recent taps count and how
            the pause-reset threshold actually works?{" "}
            <Link href="/guides/how-tap-tempo-detection-works" className="text-amber-400 hover:underline">
              Read How Tap Tempo Detection Actually Works
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is the difference between BPM and tempo?</h2>
          <p className="text-text-muted leading-relaxed">
            BPM means beats per minute and gives a numerical measurement of
            tempo. For example, 60 BPM means 60 beats occur in one minute,
            while 120 BPM means 120 beats occur in one minute. Tempo
            describes how fast or slow the music feels, while BPM provides
            a precise number for that tempo.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <p className="text-text-muted leading-relaxed">
            Finding the tempo of a song you&apos;re learning to play along
            with, setting a metronome to match a track without looking up
            its BPM online, and quickly checking your own natural tapping
            tempo.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">More tools for working with tempo</h2>
          <p className="text-text-muted leading-relaxed">
            Once you know the BPM, use the{" "}
            <Link href="/metronome" className="text-amber-400 hover:underline">
              Online Metronome
            </Link>{" "}
            to practice at that tempo. If you want to change the speed of
            an existing recording instead, the{" "}
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