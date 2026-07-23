import type { Metadata } from "next";
import Link from "next/link";
import { SilenceRemoveForm } from "@/components/converter/SilenceRemoveForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Silence Remover — Cut Dead Air From Any Recording",
  description:
    "Strip silent gaps from a podcast, voice memo, or recording free, no sign-up. Removes dead air throughout, not just the ends — download in seconds.",
  keywords: [
    "silence remover online",
    "remove dead air podcast",
    "cut silence from audio free",
    "strip silence mp3",
    "podcast silence cutter",
  ],
  alternates: { canonical: `${SITE_URL}/silence-remove` },
  openGraph: {
    title: "Free Silence Remover — Cut Dead Air From Any Recording",
    description: "Strip silent gaps from a recording free, no sign-up.",
    url: `${SITE_URL}/silence-remove`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Silence Remover — Cut Dead Air From Any Recording",
    description: "Strip silent gaps from a recording free, no sign-up.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does this only trim silence from the start and end?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — it strips silent gaps throughout the entire recording, not just the leading and trailing edges. Good for cutting dead air between spoken sections in a podcast.",
      },
    },
    {
      "@type": "Question",
      name: "Will the output be shorter than the original?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — gaps are cut entirely, not just muted, so the output duration will be shorter than the input.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to adjust the settings?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — both the threshold and minimum gap length have sensible defaults that work well for most podcast and voice-memo cleanup.",
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
  name: "Silence Remover",
  url: `${SITE_URL}/silence-remove`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Cuts silent gaps throughout, not just leading/trailing",
    "Adjustable threshold and gap length",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Silence Remover", item: `${SITE_URL}/silence-remove` },
  ],
};

export default function SilenceRemovePage() {
  const relatedTools = getRelatedTools("silence-remove", 2);

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
            Free Silence Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Cut dead air throughout a recording — not just the start and end — free,
            no sign-up, no watermark.
          </p>
        </header>

        <SilenceRemoveForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Whole-file cleanup", desc: "Cuts gaps everywhere, not just the ends." },
            { title: "One-click ready", desc: "Sensible defaults, no tuning required." },
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
              Perfect for podcast editing — cutting the dead air between sentences or
              during long pauses without manually scrubbing through the whole
              recording. Also useful for voice memos with awkward gaps, or field
              recordings with long quiet stretches you don&apos;t need.
            </p>
            <p>
              Want tighter or looser detection? Lower the threshold toward -90dB to
              catch even quiet background noise as silence, or raise it toward -10dB
              to only cut near-total silence. Shorter minimum gap lengths cut brief
              pauses too; longer ones only remove genuinely long dead air.
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
              <h3 className="font-semibold text-text-primary mb-1">Does this only trim silence from the start and end?</h3>
              <p>No — it strips silent gaps throughout the entire recording, not just the leading and trailing edges.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Will the output be shorter than the original?</h3>
              <p>Yes — gaps are cut entirely, not just muted, so the output duration will be shorter than the input.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Do I need to adjust the settings?</h3>
              <p>No — both the threshold and minimum gap length have sensible defaults that work well for most podcast and voice-memo cleanup.</p>
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