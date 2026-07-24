import type { Metadata } from "next";
import Link from "next/link";
import { VolumeForm } from "@/components/converter/VolumeForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Volume Booster - Increase or Reduce Audio Volume Online",
  description:
    "Increase or reduce audio volume online free — adjust gain from -30dB to +30dB on MP3, WAV, FLAC, and more. No sign-up, no watermark, fast processing.",
  keywords: [
    "volume booster",
    "audio volume booster",
    "increase audio volume",
    "increase mp3 volume",
    "boost mp3 volume",
    "reduce audio volume online",
    "audio gain adjuster",
    "make audio louder",
  ],
  alternates: { canonical: `${SITE_URL}/volume` },
  openGraph: {
    title: "Volume Booster - Increase or Reduce Audio Volume Online",
    description: "Increase or reduce audio volume online, free and fast.",
    url: `${SITE_URL}/volume`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Volume Booster - Increase or Reduce Audio Volume Online",
    description: "Increase or reduce audio volume online, free and fast.",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What gain range can I use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "From -30dB to +30dB. Extreme values near either end will often sound distorted or overly quiet — that's expected behavior, not a bug.",
      },
    },
    {
      "@type": "Question",
      name: "What's a safe boost amount?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "+6dB to +10dB is a solid, clearly audible boost without heavy clipping risk on most source material.",
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
  name: "Audio Volume Adjuster",
  url: `${SITE_URL}/volume`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Boost audio volume up to +30dB",
    "Reduce audio volume down to -30dB",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Volume Adjuster", item: `${SITE_URL}/volume` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Increase or Reduce Audio Volume Online",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload your MP3, WAV, FLAC, or other supported audio file." },
    { "@type": "HowToStep", name: "Set gain", text: "Move the gain slider between -30dB and +30dB." },
    { "@type": "HowToStep", name: "Apply", text: "Click Adjust volume to process the file." },
    { "@type": "HowToStep", name: "Download", text: "Download the volume-adjusted file in the original format." },
  ],
};

export default function VolumePage() {
  const relatedTools = getRelatedTools("volume", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Audio Volume Booster
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Increase or reduce audio volume online, free — no sign-up, no
            watermark. Adjust gain and download in seconds.
          </p>
        </header>

        <VolumeForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "-30 to +30dB", desc: "Full range gain control, either direction." },
            { title: "Fast", desc: "Most adjustments finish in a few seconds." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is an audio volume booster?</h2>
          <p className="text-text-muted leading-relaxed">
            A volume booster increases or decreases the loudness of an audio
            file without touching its speed, pitch, or format. It&apos;s the
            right fix when a recording came out too quiet, a podcast has
            uneven levels between takes, or a track needs a small loudness
            adjustment before sharing — a straightforward gain change, nothing
            more.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to increase or reduce audio volume</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload your MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Move the gain slider to your target dB value, positive to boost or negative to reduce.</li>
            <li>Click Adjust volume to process the file.</li>
            <li>Download the result — same format as your upload, just at the new level.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Choosing a gain amount</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">+6dB to +10dB</strong> is a
              solid, clearly audible boost without heavy clipping risk on most
              recordings. Going much higher toward +30dB will often introduce
              distortion — that&apos;s the tradeoff of pushing gain that far, not a
              flaw in the tool.
            </p>
            <p>
              On the reduction side, <strong className="text-text-primary">-6dB to
              -10dB</strong> is enough to noticeably quiet a recording that&apos;s too
              loud, while still keeping it clearly audible.
            </p>
            <p>
              Want the full explanation of why clipping happens and where gain
              adjustments fit in a mixing workflow? Read{" "}
              <Link href="/guides/gain-staging-for-home-studios" className="text-amber-400 hover:underline">
                Gain Staging Explained for Home Studios
              </Link>.
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
              <h3 className="font-semibold text-text-primary mb-1">What gain range can I use?</h3>
              <p>
                From -30dB to +30dB. Extreme values near either end will often sound
                distorted or overly quiet — that&apos;s expected behavior, not a bug.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What&apos;s a safe boost amount?</h3>
              <p>+6dB to +10dB is a solid, clearly audible boost without heavy clipping risk on most source material.</p>
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