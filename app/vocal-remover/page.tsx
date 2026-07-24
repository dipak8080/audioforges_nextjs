import type { Metadata } from "next";
import Link from "next/link";
import { VocalRemoverForm } from "@/components/converter/VocalRemoverForm";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free AI Vocal Remover Online",
  description:
    "Remove vocals from any song online with AI for free. Create instrumentals or extract acapellas from MP3, WAV, FLAC, AAC, and more. No sign-up required.",
  keywords: [
    "vocal remover",
    "ai vocal remover",
    "remove vocals from song",
    "vocal remover online free",
    "extract instrumental",
    "karaoke maker",
    "acapella extractor",
    "isolate vocals",
    "free vocal remover",
    "stem splitter",
    "instrumental maker",
    "vocal isolation",
    "extract vocals",
    "ai stem splitter",
  ],
  alternates: { canonical: `${SITE_URL}/vocal-remover` },
  openGraph: {
    title: "Free AI Vocal Remover Online",
    description:
      "Remove vocals from any song free with AI — no sign-up, no download required.",
    url: `${SITE_URL}/vocal-remover`,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Free AI Vocal Remover Online",
    description:
      "Remove vocals from any song free with AI — no sign-up, no download required.",
    images: ["/images/og-default.png"],
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
        text: "Usually 1–5 minutes, depending on track length and server load — this runs real AI audio-separation processing, not a simple filter.",
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
    {
      "@type": "Question",
      name: "Can AI remove vocals completely?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AI source separation gets much closer than a center-channel filter, but it isn't perfect on every track — dense mixes, heavy reverb, or doubled vocals can leave faint traces behind. Simpler mixes tend to separate more cleanly.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to download anything?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Everything runs in your browser — upload a track, wait for processing, and download the result directly. No app or software install required.",
      },
    },
    {
      "@type": "Question",
      name: "How is this different from a karaoke center-channel filter?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Center-channel filters only remove audio panned dead-center, which often leaves vocal bleed and damages the stereo mix. This tool uses AI source separation to isolate vocals and instrumental as fully separate stems.",
      },
    },
  ],
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI Vocal Remover",
  url: `${SITE_URL}/vocal-remover`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "AI-powered vocal and instrumental separation",
    "No sign-up required",
    "No download or software install required",
    "Karaoke track creation",
    "Acapella extraction",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Vocal Remover", item: `${SITE_URL}/vocal-remover` },
  ],
};

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Remove Vocals from a Song",
  step: [
    { "@type": "HowToStep", name: "Upload", text: "Upload an MP3, WAV, FLAC, AAC, M4A, or OGG file." },
    { "@type": "HowToStep", name: "Processing", text: "AI source separation splits the track into vocal and instrumental components, typically taking a few minutes." },
    { "@type": "HowToStep", name: "Download", text: "Download the resulting instrumental or vocal stem directly from your browser." },
  ],
};

export default function VocalRemoverPage() {
  const relatedTools = getRelatedTools("vocal-remover", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free AI Vocal Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload any song and get back a clean instrumental with AI — no
            sign-up, no download required. Great for karaoke, practice, or
            pulling an acapella for a remix.
          </p>
        </header>

        <VocalRemoverForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "AI-powered", desc: "Real source separation, not a basic center-channel filter." },
            { title: "No download", desc: "Runs entirely in your browser — upload, process, download." },
            { title: "Free", desc: "No sign-up, no watermark — one track per hour, free for everyone." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to remove vocals from a song</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, AAC, M4A, or OGG file.</li>
            <li>AI source separation splits the track into vocal and instrumental components — usually a few minutes, depending on length and server load.</li>
            <li>Download the result directly in your browser, no install needed.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How AI vocal removal works</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              This tool uses real AI audio-source-separation processing to split a
              track into <strong className="text-text-primary">vocals</strong> and{" "}
              <strong className="text-text-primary">instrumental</strong> — not a
              simple center-channel filter, which only partially removes vocals and
              often damages the mix.
            </p>
            <p>
              A center-channel filter works by cutting whatever&apos;s panned
              dead-center in the stereo mix — that catches lead vocals in many
              commercial mixes, but it also strips out anything else placed
              centrally (kick, bass, snare) and leaves behind any vocal element that
              isn&apos;t perfectly centered. AI source separation instead analyzes
              the audio&apos;s learned characteristics of what a voice sounds like
              versus an instrument, which is why it can isolate vocals regardless
              of where they sit in the stereo field, and why it produces a cleaner
              instrumental as a result.
            </p>
            <p>
              Because this runs on CPU rather than expensive GPU infrastructure, a
              single track takes a few minutes and we limit it to one separation per
              hour per person, so it stays free and available for everyone. No
              download, install, or account is needed — everything happens in your
              browser.
            </p>
            <p>
              Want the fuller breakdown of how this compares to older methods and
              where separation still struggles?{" "}
              <Link href="/guides/ai-vocal-removal-explained" className="text-amber-400 hover:underline">
                Read How AI Vocal Removal Actually Works
              </Link>.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Instrumental vs. acapella</h2>
          <p className="text-text-muted leading-relaxed">
            An <strong className="text-text-primary">instrumental</strong> is the
            track with vocals removed — everything except the voice. An{" "}
            <strong className="text-text-primary">acapella</strong> is the reverse:
            just the isolated vocal, with the instrumentation removed. Both come
            from the same underlying separation process, just keeping the opposite
            stem. Karaoke and remixing usually call for the instrumental; sampling
            a vocal hook or building a mashup usually calls for the acapella.
          </p>
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
              <strong className="text-text-primary">DJ mashups:</strong> pull an
              acapella from one track to lay over the instrumental of another.
            </p>
            <p>
              <strong className="text-text-primary">Cover reference:</strong> hear the
              instrumentation clearly without the original vocal in the way.
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
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Can AI remove vocals completely?</h3>
              <p>
                It gets much closer than a center-channel filter, but it isn&apos;t
                perfect on every track — dense mixes, heavy reverb, or doubled
                vocals can leave faint traces behind. Simpler mixes tend to
                separate more cleanly.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">Do I need to download anything?</h3>
              <p>
                No. Everything runs in your browser — upload a track, wait for
                processing, and download the result directly.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                How is this different from a karaoke center-channel filter?
              </h3>
              <p>
                Center-channel filters only remove audio panned dead-center, often
                leaving vocal bleed. This uses AI source separation to isolate vocals
                and instrumental as fully separate stems.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}