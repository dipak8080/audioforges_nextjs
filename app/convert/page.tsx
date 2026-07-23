import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Converter (MP3, WAV, FLAC & More)",
  description:
    "Free audio converter — no sign-up, no limits. Convert MP3, WAV, FLAC, AAC, M4A, OGG and AIFF in seconds, then download instantly.",
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
      "Free audio converter — no sign-up, no limits. Convert between major audio formats in seconds.",
    url: `${SITE_URL}/convert`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Audio Converter (MP3, WAV, FLAC & More)",
    description:
      "Free audio converter — no sign-up, no limits. Convert between major audio formats in seconds.",
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
        text: "MP3 to WAV, WAV to MP3/FLAC/AAC/AIFF, FLAC to WAV, M4A to MP3, AAC to WAV, and OGG to MP3.",
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
    "Convert MP3 to WAV",
    "Convert WAV to MP3, FLAC, AAC, or AIFF",
    "Convert FLAC, M4A, AAC, and OGG",
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
            Convert MP3, WAV, FLAC, AAC, M4A, OGG and AIFF free — no sign-up, no
            watermark. Upload a file and download the converted version in seconds.
          </p>
        </header>

        <ConvertForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Fast", desc: "Most conversions finish in a few seconds." },
            { title: "7 formats", desc: "MP3, WAV, FLAC, AAC, M4A, OGG, AIFF." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported conversions</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">MP3</strong> → WAV.{" "}
              <strong className="text-text-primary">WAV</strong> → MP3, FLAC, AAC, or
              AIFF. <strong className="text-text-primary">FLAC</strong> → WAV.{" "}
              <strong className="text-text-primary">M4A</strong> → MP3.{" "}
              <strong className="text-text-primary">AAC</strong> → WAV.{" "}
              <strong className="text-text-primary">OGG</strong> → MP3.
            </p>
            <p>
              Convert to WAV when you need lossless audio for editing or DJ software.
              Convert to MP3 when file size and easy sharing matter more than absolute
              quality.
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
              <h3 className="font-semibold text-text-primary mb-1">What formats can I convert between?</h3>
              <p>MP3 to WAV, WAV to MP3/FLAC/AAC/AIFF, FLAC to WAV, M4A to MP3, AAC to WAV, and OGG to MP3.</p>
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