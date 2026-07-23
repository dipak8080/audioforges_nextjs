import type { Metadata } from "next";
import Link from "next/link";
import { PitchForm } from "@/components/converter/PitchForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Pitch Shifter — Change Key Without Changing Speed",
  description:
    "Shift audio pitch free, no sign-up — up or down up to an octave, independent of tempo. Upload, adjust, and download in seconds to a moment.",
  keywords: [
    "pitch shifter online",
    "change pitch of audio free",
    "transpose audio key",
    "pitch shift mp3",
    "key changer audio",
  ],
  alternates: { canonical: `${SITE_URL}/pitch` },
  openGraph: {
    title: "Free Pitch Shifter — Change Key Without Changing Speed",
    description: "Shift audio pitch free, no sign-up, independent of tempo.",
    url: `${SITE_URL}/pitch`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Pitch Shifter — Change Key Without Changing Speed",
    description: "Shift audio pitch free, no sign-up, independent of tempo.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does pitch shifting change the tempo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — pitch is shifted independently of tempo, so the duration and speed of the track stay exactly the same, only the pitch moves.",
      },
    },
    {
      "@type": "Question",
      name: "How much can I shift the pitch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Up to 12 semitones in either direction — a full octave up or down.",
      },
    },
    {
      "@type": "Question",
      name: "Why is there a stricter limit on this tool?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pitch shifting is more CPU-intensive than simple conversions, so it's limited to 3 requests per 5 minutes to keep it available for everyone.",
      },
    },
    {
      "@type": "Question",
      name: "Is this really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — completely free, no sign-up, no watermark on the output.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pitch Shifter",
  url: `${SITE_URL}/pitch`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Shift pitch up to 1 octave either direction",
    "Independent of tempo",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Pitch Shifter", item: `${SITE_URL}/pitch` },
  ],
};

export default function PitchPage() {
  const relatedTools = getRelatedTools("pitch", 2);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Pitch Shifter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Shift a track&apos;s pitch up or down without touching its tempo — free, no
            sign-up, no watermark.
          </p>
        </header>

        <PitchForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "±1 octave", desc: "Shift up to 12 semitones either way." },
            { title: "Tempo unaffected", desc: "Duration and speed stay identical." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Transpose a track into a more comfortable vocal range for practice, test
              how a sample sounds in a different key before dropping it into a
              session, or create a pitched-up or pitched-down variation for a remix —
              all without the tempo shifting along with it, which is what a simple
              speed change would do instead.
            </p>
            <p>
              Need to change speed without affecting pitch? Use the{" "}
              <Link href="/tempo" className="text-amber-400 hover:underline">
                Tempo Changer
              </Link>{" "}
              instead — it&apos;s the same rubberband engine, applied to speed rather
              than key.
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
              <h3 className="font-semibold text-text-primary mb-1">Does pitch shifting change the tempo?</h3>
              <p>No — pitch is shifted independently of tempo, so the duration and speed of the track stay exactly the same, only the pitch moves.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">How much can I shift the pitch?</h3>
              <p>Up to 12 semitones in either direction — a full octave up or down.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Why is there a stricter limit on this tool?</h3>
              <p>Pitch shifting is more CPU-intensive than simple conversions, so it&apos;s limited to 3 requests per 5 minutes to keep it available for everyone.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — completely free, no sign-up, no watermark on the output.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}