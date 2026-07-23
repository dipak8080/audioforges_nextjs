import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Converter (MP3, WAV, FLAC & More)",
  description:
    "Free audio converter — no sign-up, no limits. Convert between MP3, WAV, FLAC, M4A, AAC, OGG and AIFF in seconds, then download instantly.",
  keywords: [
    "audio converter",
    "mp3 to wav converter",
    "wav to mp3 converter",
    "convert audio online free",
    "flac to wav converter",
    "audio format converter",
    "aac to wav",
  ],
  alternates: { canonical: `${SITE_URL}/convert` },
  openGraph: {
    title: "Free Audio Converter (MP3, WAV, FLAC & More)",
    description:
      "Free audio converter — no sign-up, no limits. Convert between any of 7 major audio formats in seconds.",
    url: `${SITE_URL}/convert`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Audio Converter (MP3, WAV, FLAC & More)",
    description:
      "Free audio converter — no sign-up, no limits. Convert between any of 7 major audio formats in seconds.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What formats can I convert between?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Any of MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF — every format converts to every other one.",
      },
    },
    {
      "@type": "Question",
      name: "Is this really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — every conversion is free, with no sign-up and no watermark on the output file.",
      },
    },
    {
      "@type": "Question",
      name: "How long does conversion take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Usually just a few seconds, much faster than tools that process a full audio separation.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a file size limit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Uploads are limited to 50MB per file.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Format Converter",
  url: `${SITE_URL}/convert`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert between MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF",
    "Any format to any other format",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio Converter", item: `${SITE_URL}/convert` },
  ],
};

const ALL_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF"];

export default function ConvertPage() {
  const relatedTools = getRelatedTools("convert", 2);

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
            Free Audio Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Convert between MP3, WAV, FLAC, M4A, AAC, OGG and AIFF free — no
            sign-up, no watermark. Upload a file and download the converted
            version in seconds.
          </p>
        </header>

        <ConvertForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Fast", desc: "Most conversions finish in a few seconds." },
            { title: "7 formats", desc: "Any format converts to any other format." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported formats</h2>
          <p className="text-text-muted leading-relaxed">
            Every format below converts to every other one — upload any of these,
            pick any other as your target:
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_FORMATS.map((fmt) => (
              <span
                key={fmt}
                className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
              >
                {fmt}
              </span>
            ))}
          </div>
          <p className="text-text-muted leading-relaxed">
            Convert to WAV or FLAC when you need lossless audio for editing or DJ
            software. Convert to MP3 or AAC when file size and easy sharing matter
            more than absolute quality. Note: converting a lossy format (like MP3)
            to a lossless one (like WAV or FLAC) repackages the audio but doesn&apos;t
            recover any quality already lost in the original encoding.
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

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Frequently asked questions</h2>
          <div className="space-y-5 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What formats can I convert between?</h3>
              <p>Any of MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF — every format converts to every other one.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — every conversion is free, with no sign-up and no watermark on the output file.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">How long does conversion take?</h3>
              <p>Usually just a few seconds, much faster than tools that process a full audio separation.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is there a file size limit?</h3>
              <p>Uploads are limited to 50MB per file.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}