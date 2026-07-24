import type { Metadata } from "next";
import Link from "next/link";
import { TrimForm } from "@/components/converter/TrimForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Trimmer — Cut Any Track Online",
  description:
    "Trim or cut audio files online free. Cut MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF with a precise start and end point. No sign-up, no watermark.",
  keywords: [
    "audio trimmer",
    "audio cutter",
    "cut audio online free",
    "trim mp3 online",
    "mp3 cutter",
    "trim audio",
    "cut mp3",
    "clip audio file",
    "trim wav",
    "cut audio online",
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
      name: "What's the difference between trimming and cutting?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "For this tool, they mean the same thing — selecting a start and end point and keeping only what's in between. \"Trim\" and \"cut\" are just different words people use for the same operation.",
      },
    },
    {
      "@type": "Question",
      name: "Can I remove silence throughout a track, not just the ends?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "That's a separate tool. Trim cuts to a single start and end point; the Silence Remover strips silent gaps everywhere in the file, not just the edges.",
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

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Trim or Cut an Audio File",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file." },
    { "@type": "HowToStep", name: "Set start point", text: "Drag the start marker to where you want the clip to begin." },
    { "@type": "HowToStep", name: "Set end point", text: "Drag the end marker to where you want the clip to end." },
    { "@type": "HowToStep", name: "Download", text: "Download the trimmed clip in its original format." },
  ],
};

export default function TrimPage() {
  const relatedTools = getRelatedTools("trim", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

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
          <h2 className="text-2xl font-bold text-text-primary">How to trim or cut an audio file</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Drag the start marker to where you want the clip to begin.</li>
            <li>Drag the end marker to where you want the clip to end.</li>
            <li>Download the trimmed clip — same format as your upload.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Trim vs. cut: same thing, different word</h2>
          <p className="text-text-muted leading-relaxed">
            &quot;Trim&quot; and &quot;cut&quot; describe the same operation here —
            selecting a start and end point and keeping only what&apos;s between
            them. Some people search for an &quot;audio cutter,&quot; others for an
            &quot;audio trimmer&quot;; either way, this tool does exactly that: one
            clean cut, original format preserved.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Cut a long recording down to a specific clip for sharing, pull a sample
              or intro from a track, trim dead air off the start or end of a voice
              memo, or grab just the chorus of a song for a quick reference. It&apos;s
              also useful for cutting a podcast segment down to a shareable clip, or
              pulling a short section out of a long field recording for a sample
              library.
            </p>
            <p>
              Need the clip in a different format too? Trim keeps the original format
              by design — run the result through the{" "}
              <Link href="/convert" className="text-amber-400 hover:underline">
                Format Converter
              </Link>{" "}
              afterward if you need something else. Need to strip silence throughout
              the whole file, not just cut one section? The{" "}
              <Link href="/silence-remove" className="text-amber-400 hover:underline">
                Silence Remover
              </Link>{" "}
              handles that instead.
            </p>
            <p>
              Want to know why a bad cut point can cause a click or pop, and how
              lossless vs. lossy formats handle trimming differently?{" "}
              <Link href="/guides/how-to-trim-audio-without-losing-quality" className="text-amber-400 hover:underline">
                Read How to Trim Audio Without Losing Quality
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
              <h3 className="font-semibold text-text-primary mb-1">Does trimming change the audio quality?</h3>
              <p>No — trimming just cuts the selected range and keeps your original format, with no quality loss beyond the format&apos;s normal characteristics.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What&apos;s the difference between trimming and cutting?</h3>
              <p>For this tool, they mean the same thing — selecting a start and end point and keeping only what&apos;s in between.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Can I remove silence throughout a track, not just the ends?</h3>
              <p>
                That&apos;s a separate tool. Trim cuts to a single start and end
                point; the{" "}
                <Link href="/silence-remove" className="text-amber-400 hover:underline">
                  Silence Remover
                </Link>{" "}
                strips silent gaps everywhere in the file, not just the edges.
              </p>
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