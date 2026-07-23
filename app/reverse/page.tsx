import type { Metadata } from "next";
import Link from "next/link";
import { ReverseForm } from "@/components/converter/ReverseForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Reverser — Play a Track Backwards",
  description:
    "Reverse any audio file free, no sign-up. Upload a track, flip it backwards, and download the result in seconds.",
  keywords: [
    "reverse audio",
    "audio reverser",
    "play audio backwards",
    "reverse audio online free",
    "flip audio track",
    "backwards audio maker",
  ],
  alternates: { canonical: `${SITE_URL}/reverse` },
  openGraph: {
    title: "Free Audio Reverser — Play a Track Backwards",
    description: "Reverse any audio file free, no sign-up.",
    url: `${SITE_URL}/reverse`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Audio Reverser — Play a Track Backwards",
    description: "Reverse any audio file free, no sign-up.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What does reversing audio do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It flips the entire file so it plays back to front — the last sound becomes the first, and vice versa.",
      },
    },
    {
      "@type": "Question",
      name: "Is this really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — reversing audio is free, with no sign-up and no watermark on the output.",
      },
    },
    {
      "@type": "Question",
      name: "What formats are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF. The output keeps the same format as your upload.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a file size or length limit?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Files up to 50MB and 20 minutes long are supported.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Reverser",
  url: `${SITE_URL}/reverse`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Reverse any audio file",
    "Keeps original format",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio Reverser", item: `${SITE_URL}/reverse` },
  ],
};

export default function ReversePage() {
  const relatedTools = getRelatedTools("reverse", 2);

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
            Free Audio Reverser
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload a track and get it back flipped backwards — free, no sign-up, no
            watermark.
          </p>
        </header>

        <ReverseForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Fast", desc: "Most reversals finish in a few seconds." },
            { title: "One click", desc: "No settings to configure — just upload." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why reverse audio?</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Reversed audio is a classic production trick — reversed cymbal swells and
              vocal chops are staples in melodic house, hip-hop, and cinematic sound
              design. It&apos;s also handy for spotting hidden or backmasked content in a
              recording, or just for creative sound experiments.
            </p>
            <p>
              The output keeps your original file format, so a WAV stays a WAV and an
              MP3 stays an MP3 — no extra conversion step needed.
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
              <h3 className="font-semibold text-text-primary mb-1">What does reversing audio do?</h3>
              <p>It flips the entire file so it plays back to front — the last sound becomes the first, and vice versa.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — reversing audio is free, with no sign-up and no watermark on the output.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What formats are supported?</h3>
              <p>MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF. The output keeps the same format as your upload.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is there a file size or length limit?</h3>
              <p>Files up to 50MB and 20 minutes long are supported.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}