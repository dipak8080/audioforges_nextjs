import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { StemsForm } from "@/components/converter/StemsForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";

const PAGE_TITLE = "Free AI Stem Splitter – Split Songs Into Stems";
const PAGE_DESCRIPTION =
  "Split songs into vocals, drums, bass, and other stems with AI. Upload MP3, WAV, FLAC, M4A, AAC, or OGG for free. No sign-up.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/stems` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/stems`,
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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI Stem Splitter",
  url: `${SITE_URL}/stems`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "GPU-accelerated AI 4-stem separation: vocals, drums, bass, other",
    "No sign-up required",
    "No download or software install required",
    "Individually downloadable stems",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Stem Splitter", item: `${SITE_URL}/stems` },
  ],
};

const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG"];

/** Same style as the convert page — clean mono badges, no check icons */
function FormatBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      {SUPPORTED_FORMATS.map((format) => (
        <span
          key={format}
          className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
        >
          {format}
        </span>
      ))}
    </div>
  );
}

/** Only used in comparison tables */
function CheckMark() {
  return <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
}

export default async function StemsPage() {
  const relatedTools = getRelatedTools("stems", 5);
  const { separationHqEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "What is a stem splitter?",
      answer:
        "A stem splitter uses AI source separation to take a fully mixed song and split it back into individual parts — vocals, drums, bass, and other — without needing the original multitrack recording.",
    },
    {
      question: "How long does stem separation take?",
      answer:
        "Usually 1–5 minutes for standard quality, depending on track length and server load — this runs real AI audio-separation processing on GPU-accelerated infrastructure, not a simple filter.",
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality mode?",
            answer:
              "An optional higher-fidelity separation mode using a larger, ensembled AI model. It produces noticeably cleaner stems across all four tracks, at the cost of a much longer processing time — typically 10 to 20 minutes instead of a few minutes.",
          },
        ]
      : []),
    {
      question: "Is this really free?",
      answer:
        "Yes, completely free. Because separation is processing-intensive, it's rate-limited per person to keep it available for everyone.",
    },
    {
      question: "What are the four stems?",
      answer:
        "Vocals (lead and backing vocals), drums (the full kit), bass (bass guitar or synth bass), and other (everything else — guitars, keys, pads, synths, and anything that isn't vocals, drums, or bass).",
    },
    {
      question: "Can I download each stem individually?",
      answer:
        "Yes — each of the four stems previews and downloads independently, so you only need to grab the ones you actually want.",
    },
    {
      question: "Does it work on any genre?",
      answer:
        "It works across genres, but separation quality varies with how the track is mixed. Dense, heavily layered mixes are harder to untangle cleanly than sparser arrangements with clearly distinct instruments.",
    },
    {
      question: "Why can AI-separated stems have artifacts?",
      answer:
        "Dense mixes, heavy distortion, live recordings with crowd noise, and instruments that share a similar frequency range (like bass and low guitar) are all harder for the model to cleanly separate than a clean studio recording with distinct instrumentation — this can leave faint bleed between stems.",
    },
    {
      question: "What audio formats are supported, and is there a size limit?",
      answer: "MP3, WAV, FLAC, AAC, M4A, and OGG are all supported, up to 80MB per upload.",
    },
    {
      question: "Do I need to sign up or install anything?",
      answer:
        "No. Everything runs in your browser — upload a track, wait for processing, and download the stems directly. No app, software, or account required.",
    },
    {
      question: "Can I split a YouTube video into stems directly?",
      answer:
        "Yes — paste a YouTube link into the YouTube Stem Splitter instead of downloading the audio first, as long as you have the right to process that content.",
      answerNode: (
        <>
          Yes — paste a YouTube link into the{" "}
          <Link href="/youtube-stem-splitter" className="text-amber-400 hover:underline">
            YouTube Stem Splitter
          </Link>{" "}
          instead of downloading the audio first, as long as you have the right to
          process that content.
        </>
      ),
    },
    {
      question: "Does it preserve stereo sound?",
      answer:
        "Yes — the separation model processes and outputs stereo audio for every stem, not a mono downmix.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free AI Stem Splitter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Split a song into separate vocals, drums, bass, and other stems using
            AI source separation. Upload MP3, WAV, FLAC, AAC, M4A, or OGG and
            download each stem individually — no sign-up, no software install.
          </p>
        </header>

        <StemsForm hqAvailable={separationHqEnabled} />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "4 stems", desc: "Vocals, drums, bass, and other — not just a 2-way split." },
            { title: "No download", desc: "Runs entirely in your browser — upload, process, download." },
            { title: "Free", desc: "No sign-up, no watermark, free for everyone." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What is a stem splitter?</h2>
          <p className="text-text-muted leading-relaxed">
            A stem splitter takes a fully mixed-down song — a single audio file
            with everything blended together — and separates it back into
            individual parts, called stems. Normally, separate stems only exist
            if a producer kept the original multitrack recording. AI source
            separation gets around that: a model trained on learned
            characteristics of what a voice, a drum kit, a bass line, and other
            instrumentation each sound like reconstructs an approximation of
            those separate parts from the finished mix alone. That&apos;s the
            same underlying idea as audio source separation more broadly — it&apos;s
            why producers, remixers, and DJs use it to get usable stems from a
            track they only have as a finished MP3 or WAV.
          </p>
          <p className="text-text-muted leading-relaxed">
            AudioForges lets you split a song online without the original
            project files or multitrack session. Upload a finished track and
            the AI separates it into vocals, drums, bass, and other
            instrumentation that you can preview and download individually.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            4-Stem Separation: Vocals, Drums, Bass &amp; Other
          </h2>
          <p className="text-text-muted leading-relaxed">
            Every upload is split into these four stems in a single pass:
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-text-primary">Vocals</h3>
              <p className="text-text-muted leading-relaxed">
                Lead and backing vocals, isolated from the instrumentation
                around them.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Drums</h3>
              <p className="text-text-muted leading-relaxed">
                The full kit — kick, snare, hi-hats, cymbals, and other
                percussion — separated as one combined drum stem.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Bass</h3>
              <p className="text-text-muted leading-relaxed">
                Bass guitar or synth bass, covering the low end of the
                arrangement.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Other</h3>
              <p className="text-text-muted leading-relaxed">
                Everything that isn&apos;t vocals, drums, or bass — guitars, keys,
                synths, pads, strings, and any remaining instrumentation, kept
                together as a single stem rather than split further into
                individual instruments.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Who is this for?</h2>
          <p className="text-text-muted leading-relaxed">
            Producers pulling isolated drum or bass stems to sample and rebuild
            around, remixers who need more than just an instrumental, mashup
            artists layering elements from multiple tracks, and anyone studying
            an arrangement instrument-by-instrument all use this tool for the
            same underlying job — splitting a full mix into its four core
            components.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Stem Splitter vs. Vocal Remover</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold">Stem Splitter</th>
                  <th className="px-4 py-3 font-semibold">Vocal Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Vocals</td>
                  <td className="px-4 py-3"><CheckMark /></td>
                  <td className="px-4 py-3"><CheckMark /></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Drums</td>
                  <td className="px-4 py-3"><CheckMark /></td>
                  <td className="px-4 py-3">Combined into instrumental</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Bass</td>
                  <td className="px-4 py-3"><CheckMark /></td>
                  <td className="px-4 py-3">Combined into instrumental</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Output</td>
                  <td className="px-4 py-3">4 separate stems</td>
                  <td className="px-4 py-3">2 stems (vocal + instrumental)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Best for</td>
                  <td className="px-4 py-3">Sampling, remixing individual elements</td>
                  <td className="px-4 py-3">Karaoke, simple instrumentals</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Just need vocals out of the way? The{" "}
            <Link href="/vocal-remover" className="text-amber-400 hover:underline">
              Vocal Remover
            </Link>{" "}
            does the same separation and hands back one clean instrumental
            instead of four stems to sort through.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to Split a Song Into Stems</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, AAC, M4A, or OGG file.</li>
            <li>AI source separation splits the track into vocals, drums, bass, and other — usually a few minutes, depending on length and server load.</li>
            <li>Preview and download each stem individually, directly in your browser.</li>
          </ol>
          <p className="text-text-muted leading-relaxed">
            Need a track from YouTube first? Use the{" "}
            <Link href="/youtube-stem-splitter" className="text-amber-400 hover:underline">
              YouTube Stem Splitter
            </Link>{" "}
            to skip the manual download step entirely.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How 4-stem separation works</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              This tool uses the same AI source-separation model as our{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:underline">
                Vocal Remover
              </Link>
              , but keeps all four of the internally separated components instead
              of combining three of them back into one instrumental track. The
              model analyzes learned characteristics of what a voice, a drum kit,
              a bass line, and everything else each sound like, and separates all
              four simultaneously in a single pass, outputting full stereo audio
              for each stem.
            </p>
            <p>
              AudioForges processes the AI separation workload on GPU-accelerated
              infrastructure. A single track still takes a few minutes, and usage
              is rate-limited per person so it stays free and available for
              everyone. No download, install, or account is needed — everything
              happens in your browser.
            </p>
            <p>
              Want the fuller technical breakdown — why bass and drums are the
              hardest pair to separate, and what Studio Quality actually buys
              you?{" "}
              <Link href="/guides/ai-stem-separation-explained" className="text-amber-400 hover:underline">
                Read How AI Stem Separation Actually Works
              </Link>.
            </p>
          </div>
        </section>

        {separationHqEnabled && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">Standard vs. Studio Quality</h2>
            <div className="overflow-x-auto rounded-xl border border-graphite-800">
              <table className="w-full text-sm text-left text-text-muted">
                <thead className="bg-graphite-900 text-text-primary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">&nbsp;</th>
                    <th className="px-4 py-3 font-semibold">Standard</th>
                    <th className="px-4 py-3 font-semibold">Studio Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800">
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-primary">Processing time</td>
                    <td className="px-4 py-3">A few minutes</td>
                    <td className="px-4 py-3">10–20 minutes</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-primary">Separation quality</td>
                    <td className="px-4 py-3">Good for most tracks</td>
                    <td className="px-4 py-3">Noticeably cleaner across all four stems</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-primary">Usage limit</td>
                    <td className="px-4 py-3">3 per hour</td>
                    <td className="px-4 py-3">1 per hour</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-primary">Best for</td>
                    <td className="px-4 py-3">Quick previews, casual use</td>
                    <td className="px-4 py-3">Sampling, remixing, anything going into a final mix</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-text-muted leading-relaxed">
              Studio Quality uses a larger, ensembled model rather than a single
              pass, which is why it takes considerably longer — the trade-off is
              worth it when the stems are headed into an actual production, not
              just a quick check.
            </p>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported Audio Formats</h2>
          <FormatBadges />
          <p className="text-text-muted leading-relaxed">
            Upload any of the formats above, up to 80MB per file. Output stems
            are delivered as individually downloadable audio files.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Stem Splitter isn&apos;t perfect</h2>
          <p className="text-text-muted leading-relaxed">
            Separation quality depends heavily on how densely the source track
            is mixed. Bass and low guitar can bleed into each other since they
            occupy similar frequency ranges. Programmed drums with heavy
            processing sometimes separate less cleanly than an acoustic kit.
            Live recordings with crowd noise or stage bleed give the model a
            messier signal than a controlled studio mix. None of this makes
            separation fail outright — it just tends to leave more audible
            traces behind on a dense or heavily processed mix than on a sparser,
            cleaner one.
          </p>
          <p className="text-text-muted leading-relaxed">
            GPU acceleration changes the infrastructure the separation runs on,
            not the difficulty of the underlying problem — source quality and
            arrangement still determine the final result.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Sampling &amp; production:</strong>{" "}
              pull an isolated drum loop or bassline to build a new track around.
            </p>
            <p>
              <strong className="text-text-primary">Remixing:</strong> replace or
              rework individual elements instead of starting from a full
              instrumental.
            </p>
            <p>
              <strong className="text-text-primary">Practice &amp; study:</strong>{" "}
              isolate a bass or drum part to learn it note-for-note without the
              rest of the mix in the way.
            </p>
            <p>
              <strong className="text-text-primary">Mashups:</strong> combine
              stems from different tracks — a vocal from one, drums and bass
              from another.
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
          <p className="text-sm text-text-muted leading-relaxed">
            See our{" "}
            <Link href="/about" className="text-amber-400 hover:underline">
              About
            </Link>
            ,{" "}
            <Link href="/privacy" className="text-amber-400 hover:underline">
              Privacy
            </Link>
            , and{" "}
            <Link href="/terms" className="text-amber-400 hover:underline">
              Terms
            </Link>{" "}
            pages for more on how AudioForges handles uploaded files.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}