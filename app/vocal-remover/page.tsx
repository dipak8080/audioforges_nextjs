import type { Metadata } from "next";
import { VocalRemoverForm } from "@/components/converter/VocalRemoverForm";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Free Vocal Remover — Extract Instrumentals Online | AudioForges",
  description:
    "Remove vocals from any song free, no sign-up. Get a clean instrumental for karaoke, practice, or remixing — upload and download in minutes.",
  keywords: [
    "vocal remover",
    "remove vocals from song",
    "vocal remover online free",
    "extract instrumental",
    "karaoke maker",
    "acapella extractor",
    "isolate vocals",
  ],
  alternates: { canonical: `${SITE_URL}/vocal-remover` },
  openGraph: {
    title: "Free Vocal Remover — Extract Instrumentals Online | AudioForges",
    description: "Remove vocals from any song free, no sign-up.",
    url: `${SITE_URL}/vocal-remover`,
    siteName: "AudioForges",
    type: "website",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How long does vocal removal take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Usually 1–5 minutes, depending on track length and server load — this runs real audio-separation processing, not a simple filter.",
      },
    },
    {
      "@type": "Question",
      name: "Is this really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, completely free. Because separation is CPU-intensive, it's limited to one track per hour per person to keep it available for everyone.",
      },
    },
    {
      "@type": "Question",
      name: "What can I use the instrumental for?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Karaoke practice, remixing, sampling, or isolating vocals for an acapella — as long as you have the right to use the source track that way.",
      },
    },
  ],
};

export default function VocalRemoverPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Vocal Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload any song and get back a clean instrumental — great for karaoke,
            practice, or pulling an acapella for a remix.
          </p>
        </header>

        <VocalRemoverForm />

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How it works</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              This tool uses real audio-source-separation processing to split a track
              into <strong className="text-text-primary">vocals</strong> and{" "}
              <strong className="text-text-primary">instrumental</strong> — not a
              simple center-channel filter, which only partially removes vocals and
              often damages the mix.
            </p>
            <p>
              Because this runs on CPU rather than expensive GPU infrastructure, a
              single track takes a few minutes and we limit it to one separation per
              hour per person, so it stays free and available for everyone.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Karaoke &amp; practice:</strong>{" "}
              get an instrumental to sing or play along with.
            </p>
            <p>
              <strong className="text-text-primary">Remixing &amp; sampling:</strong>{" "}
              isolate an acapella or a clean instrumental bed to build on.
            </p>
            <p>
              <strong className="text-text-primary">Cover reference:</strong> hear the
              instrumentation clearly without the original vocal in the way.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            You are responsible for ensuring you have the right to process any track
            you upload — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the tracks
            processed through this tool.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Frequently asked questions</h2>
          <div className="space-y-5 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">How long does vocal removal take?</h3>
              <p>Usually 1–5 minutes, depending on track length and server load.</p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Is this really free?</h3>
              <p>
                Yes. Because it&apos;s CPU-intensive, it&apos;s limited to one track per
                hour per person to keep it available for everyone.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">What can I use the instrumental for?</h3>
              <p>
                Karaoke practice, remixing, sampling, or isolating vocals for an
                acapella — as long as you have the right to use the source track.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}