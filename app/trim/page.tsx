import type { Metadata } from "next";
import Link from "next/link";
import { TrimForm } from "@/components/converter/TrimForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Trimmer — Cut Any Track Online",
  description:
    "Trim or cut audio free, no sign-up. Pick a start and end point on the timeline and download just the clip you need, in seconds.",
  keywords: [
    "audio trimmer",
    "cut audio online free",
    "trim mp3 online",
    "audio cutter",
    "clip audio file",
  ],
  alternates: { canonical: `${SITE_URL}/trim` },
  openGraph: {
    title: "Free Audio Trimmer — Cut Any Track Online",
    description: "Trim or cut audio free, no sign-up.",
    url: `${SITE_URL}/trim`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Audio Trimmer — Cut Any Track Online",
    description: "Trim or cut audio free, no sign-up.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Does trimming change the audio quality?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No — trimming just cuts the selected range and keeps your original format, with no quality loss beyond the format's normal characteristics.",
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
    {
      "@type": "Question",
      name: "Is there a length limit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The source file can be up to 20 minutes long and 50MB.",
      },
    },
    {
      "@type": "Question",
      name: "Can I convert the trimmed clip to a different format too?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Trim keeps the original format by design. Run the trimmed result through the Format Converter afterward if you need a different format.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Trimmer",
  url: `${SITE_URL}/trim`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Cut audio to any start/end point",
    "Keeps original format and quality",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio Trimmer", item: `${SITE_URL}/trim` },
  ],
};

export default function TrimPage() {
  const relatedTools = getRelatedTools("trim", 2);

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
            Free Audio Trimmer
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Cut any audio file down to just the part you need — free, no sign-up, no
            watermark.
          </p>
        </header>

        <TrimForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Precise", desc: "Drag to pick your exact start and end point." },
            { title: "No quality loss", desc: "Output keeps your original format." },
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
              Cut a long recording down to a specific clip for sharing, pull a sample
              or intro from a track, trim dead air off the start or end of a voice
              memo, or grab just the chorus of a song for a quick reference.
            </p>
            <p>
              Need the clip in a different format too? Trim keeps the original format
              by design — run the result through the{" "}
              <Link href="/convert" className="text-amber-400 hover:underline">
                Format Converter
              </Link>{" "}
              afterward if you need something else.
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
              <h3 className="font-semibold text-text-primary mb-1">Does trimming change the audio quality?</h3>
              <p>No — trimming just cuts the selected range and keeps your original format, with no quality loss beyond the format&apos;s normal characteristics.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — completely free, no sign-up, no watermark on the output.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is there a length limit?</h3>
              <p>The source file can be up to 20 minutes long and 50MB.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Can I convert the trimmed clip to a different format too?</h3>
              <p>Trim keeps the original format by design. Run the trimmed result through the Format Converter afterward if you need a different format.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}