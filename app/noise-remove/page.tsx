import type { Metadata } from "next";
import Link from "next/link";
import { NoiseRemoveForm } from "@/components/converter/NoiseRemoveForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Noise Remover — Denoise Any Audio File",
  description:
    "Remove background hiss, hum, and static from any audio file free, no sign-up. Adjustable strength, works on music or speech, download in seconds.",
  keywords: [
    "noise remover online",
    "denoise audio free",
    "remove background noise from audio",
    "audio noise reduction",
    "remove hiss from recording",
  ],
  alternates: { canonical: `${SITE_URL}/noise-remove` },
  openGraph: {
    title: "Free Noise Remover — Denoise Any Audio File",
    description: "Remove background hiss, hum, and static free, no sign-up.",
    url: `${SITE_URL}/noise-remove`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free Noise Remover — Denoise Any Audio File",
    description: "Remove background hiss, hum, and static free, no sign-up.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What kind of noise does this remove?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Background hiss, hum, and static via an FFT-based denoiser. It's general-purpose, suitable for both music and speech.",
      },
    },
    {
      "@type": "Question",
      name: "Should I use this or the Voice Cleaner for a podcast?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For speech-only recordings, the Voice Cleaner's fixed speech-tuned preset (rumble cut, denoise, loudness normalize) generally works better. Use this tool when you want direct control over reduction strength, or for music and non-speech audio.",
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
      name: "What formats are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF, up to 50MB and 20 minutes long.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Noise Remover",
  url: `${SITE_URL}/noise-remove`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Adjustable noise reduction strength",
    "Works on music or speech",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Noise Remover", item: `${SITE_URL}/noise-remove` },
  ],
};

export default function NoiseRemovePage() {
  const relatedTools = getRelatedTools("noise-remove", 2);

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
            Free Noise Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Strip background hiss, hum, and static from any recording — free, no
            sign-up, no watermark.
          </p>
        </header>

        <NoiseRemoveForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Adjustable", desc: "Control exactly how aggressive the cleanup is." },
            { title: "Works on anything", desc: "Music, speech, or field recordings." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">This tool vs. Voice Cleaner</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              This is a general-purpose denoiser that works on any audio — music,
              field recordings, or speech — with a strength slider you control
              directly.
            </p>
            <p>
              If your source is specifically speech (a podcast, phone recording, or
              interview), the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              runs a fixed chain tuned just for that — rumble cut, speech-optimized
              denoise, and loudness normalization in one pass — and will usually
              outperform manually tuning this tool for voice content.
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
              <h3 className="font-semibold text-text-primary mb-1">What kind of noise does this remove?</h3>
              <p>Background hiss, hum, and static via an FFT-based denoiser. It&apos;s general-purpose, suitable for both music and speech.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Should I use this or the Voice Cleaner for a podcast?</h3>
              <p>
                For speech-only recordings, the Voice Cleaner&apos;s fixed speech-tuned
                preset generally works better. Use this tool when you want direct
                control over reduction strength, or for music and non-speech audio.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>Yes — completely free, no sign-up, no watermark on the output.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What formats are supported?</h3>
              <p>MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF, up to 50MB and 20 minutes long.</p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}