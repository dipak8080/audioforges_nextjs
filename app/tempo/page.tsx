import type { Metadata } from "next";
import Link from "next/link";
import { TempoForm } from "@/components/converter/TempoForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Speed Changer — Tempo Without Pitch Change",
  description:
    "Speed up or slow down audio free, no sign-up — from 50% to 200% speed, pitch stays the same. Upload, adjust, and download.",
  keywords: [
    "audio speed changer",
    "change tempo without pitch",
    "slow down audio online free",
    "speed up mp3 free",
    "tempo changer",
  ],
  alternates: { canonical: `${SITE_URL}/tempo` },
  openGraph: {
    title: "Free Audio Speed Changer — Tempo Without Pitch Change",
    description: "Speed up or slow down audio free, no sign-up. Pitch stays the same.",
    url: `${SITE_URL}/tempo`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Audio Speed Changer — Tempo Without Pitch Change",
    description: "Speed up or slow down audio free, no sign-up. Pitch stays the same.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does changing speed affect the pitch?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — tempo is changed independently of pitch, so the key stays the same, only speed and duration change.",
      },
    },
    {
      "@type": "Question",
      name: "What speed range is available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "From 50% (half speed) to 200% (double speed).",
      },
    },
    {
      "@type": "Question",
      name: "Will the output file be a different length?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — speeding up to 200% halves the duration, slowing to 50% doubles it. That's expected, not an error.",
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
  name: "Audio Speed Changer",
  url: `${SITE_URL}/tempo`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Change speed from 50% to 200%",
    "Independent of pitch",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Speed Changer", item: `${SITE_URL}/tempo` },
  ],
};

export default function TempoPage() {
  const relatedTools = getRelatedTools("tempo", 2);

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
            Free Audio Speed Changer
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Speed up or slow down a track without changing its pitch — free, no
            sign-up, no watermark.
          </p>
        </header>

        <TempoForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "50%–200%", desc: "Half speed to double speed." },
            { title: "Pitch unaffected", desc: "Key stays the same, only speed changes." },
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
              Slow a track down to learn a fast passage note-by-note, speed up a
              lecture or podcast to save time, or nudge a track&apos;s tempo slightly
              to match another for a mashup — all without the pitch shifting along
              with it, which is what a simple playback-speed change would do instead.
            </p>
            <p>
              Need to change key without affecting speed? Use the{" "}
              <Link href="/pitch" className="text-amber-400 hover:underline">
                Pitch Shifter
              </Link>{" "}
              instead — same engine, applied to pitch rather than speed.
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
              <h3 className="font-semibold text-text-primary mb-1">Does changing speed affect the pitch?</h3>
              <p>No — tempo is changed independently of pitch, so the key stays the same, only speed and duration change.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What speed range is available?</h3>
              <p>From 50% (half speed) to 200% (double speed).</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Will the output file be a different length?</h3>
              <p>Yes — speeding up to 200% halves the duration, slowing to 50% doubles it. That&apos;s expected, not an error.</p>
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