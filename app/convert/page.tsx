import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * ── THIS PASS: THE REFERENCE WIRING ────────────────────────────────────
 *
 * First page to read its numbers from GET /limits instead of from the
 * hand-maintained tables. The other ~19 job-tool pages follow this exact
 * shape, so it's worth explaining rather than just doing.
 *
 * WHY BOTHER, GIVEN THE TABLES ARE CORRECT TODAY
 *
 * They're correct because we spent a day checking them. They have been wrong
 * five times, each found by accident: a 10-minute cap advertised as 15, a
 * 5-per-5-min limit reported as 3, an 18/hour reported as 15, four HQ keys
 * saying 1 when the API said 2, and AIFF missing from a list of formats the
 * tool accepted. The tables are a fallback now, not the source.
 *
 * It also just caught a live one: pitch and tempo dropped from an hour to
 * fifteen minutes in a deploy this morning. A page with "1 hour" typed into it
 * would be rejecting real uploads right now.
 *
 * THE PART MOST LIKELY TO BE COPIED WRONG
 *
 * /convert has NO duration cap. It's the only route passing
 * check_duration=False, and durationCapFor() returns null for it. Applying the
 * 3600 default here would advertise a limit the server doesn't enforce and
 * turn away files it would accept — a cap the client invents is as bad as one
 * it omits. When this pattern gets copied to /trim and the rest, that null
 * branch is the bit to keep.
 *
 * ALSO IN THIS PASS
 *
 * - The retention answer, from retentionSentences(). This page had none, and
 *   the version written from assumption on /vocal-remover was wrong for weeks.
 * - Format list and size cap read from the backend rather than typed.
 * - HowTo schema removed (deprecated by Google, desktop, Sept 2023) and the
 *   `keywords` meta removed (ignored since 2009) — matching every other tool
 *   page.
 * - prefetch={false} on the tool grid, and the feature strip matched to the
 *   divided-cell treatment the other pages use.
 */

export const metadata: Metadata = {
  title: "Free MP3 to WAV & WAV to MP3 Converter",
  description:
    "Convert MP3 to WAV, WAV to MP3, and between FLAC, M4A, AAC, OGG, and AIFF, all free. Fast conversion, no sign-up, no watermark on the output.",
  // `keywords` removed: ignored by Google since 2009, and no other tool page
  // on the site carries it any more.
  alternates: { canonical: `${SITE_URL}/convert` },
  openGraph: {
    title: "Free MP3 to WAV & WAV to MP3 Converter",
    description:
      "Convert MP3 to WAV, WAV to MP3, and between FLAC, M4A, AAC, OGG, and AIFF, all free. Fast conversion, no sign-up, no watermark on the output.",
    url: `${SITE_URL}/convert`,
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
    title: "Free MP3 to WAV & WAV to MP3 Converter",
    description:
      "Convert MP3 to WAV, WAV to MP3, and between FLAC, M4A, AAC, OGG, and AIFF, all free. Fast conversion, no sign-up, no watermark on the output.",
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "MP3 to WAV & WAV to MP3 Converter",
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

// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023), no
// ranking or rich-result benefit remains. Visible how-to steps stay. This
// matches /stems, /vocal-remover, /pitch and /tempo.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

const EXAMPLE_PAIRS = [
  ["MP3", "WAV"],
  ["WAV", "MP3"],
  ["FLAC", "MP3"],
  ["WAV", "FLAC"],
  ["AIFF", "MP3"],
  ["OGG", "MP3"],
  ["M4A", "MP3"],
  ["AAC", "WAV"],
];

export default async function ConvertPage() {
  const relatedTools = getRelatedTools("convert", 5);

  /*
    Server-side, cached an hour, and it falls back to the hand tables if the
    backend is unreachable — so a blip renders slightly stale numbers rather
    than blanks. Never import this into a client component.
  */
  const limits = await getLimits();

  // Bare lowercase from the API ("mp3"); uppercase is a display choice.
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", and $1");

  /*
    NULL here, and that is the correct answer rather than a missing one.
    /convert is in exempt_tools — the only route passing check_duration=False.
    The FAQ says so explicitly, because "no limit" is a genuine selling point
    on the one tool that has none, and because inventing the 3600 default would
    turn away files the server accepts.
  */
  const durationCap = durationCapFor(limits, "convert");

  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    {
      question: "What formats can I convert between?",
      answer: `Any of ${formatList} — every format converts to every other one.`,
    },
    {
      question: "Does converting MP3 to WAV improve quality?",
      answer:
        "No. Converting a lossy file like MP3 to a lossless format like WAV repackages the audio but doesn't restore data the original MP3 encoding already discarded — the file gets larger, not higher quality.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — every conversion is free, with no sign-up and no watermark on the output file.",
    },
    {
      question: "How long does conversion take?",
      answer: "Usually just a few seconds, much faster than tools that process a full audio separation.",
    },
    {
      // Both numbers from the backend. The length half is the interesting one:
      // most tools here cap at fifteen minutes or an hour, and this one
      // genuinely doesn't — worth saying rather than leaving unstated.
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Uploads are limited to ${limits.maxUploadMb}MB per file. There's no length limit — converting between formats is quick enough that a long recording is fine.`
          : `Uploads are limited to ${limits.maxUploadMb}MB per file, and up to ${durationLabel(durationCap)} of audio.`,
    },
    {
      // This page had no retention answer at all. Built from the backend's own
      // retention block rather than written by hand — the hand-written version
      // of this sentence was wrong on /vocal-remover for weeks.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free MP3 to WAV &amp; WAV to MP3 Converter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Convert MP3 to WAV, WAV to MP3, or between FLAC, M4A, AAC, OGG
            and AIFF, free. No sign-up, no watermark. Upload a file and
            download the converted version in seconds.
          </p>
        </header>

        <ConvertForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages — three floating boxes under the tool read as three more
            things to deal with. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Fast", desc: "Most conversions finish in a few seconds." },
            // Counted, not typed. An eighth format on the backend used to mean
            // this line quietly said "7".
            { title: `${formats.length} formats`, desc: "Any format converts to any other format." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="space-y-1.5 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
                {f.title}
              </p>
              <p className="text-sm leading-relaxed text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to convert an audio file</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload any {formatList} file.</li>
            <li>Choose the output format you need.</li>
            <li>Click Convert.</li>
            <li>Download the converted file — usually ready in a few seconds.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported formats</h2>
          <p className="text-text-muted leading-relaxed">
            Every format below converts to every other one — upload any of these,
            pick any other as your target:
          </p>
          {/* Rendered from the backend's allowed_audio_formats. A hand-written
              array here is exactly how /stems ended up omitting AIFF from a
              list of formats it happily accepted. */}
          <div className="flex flex-wrap gap-2">
            {formats.map((fmt) => (
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

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">A few common conversions</h2>
          <p className="text-text-muted leading-relaxed">
            These are just examples — every format above converts to every
            other one, not only the pairs shown here:
          </p>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Convert from</th>
                  <th className="px-4 py-3 font-semibold">Convert to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {EXAMPLE_PAIRS.map(([from, to]) => (
                  <tr key={`${from}-${to}`}>
                    <td className="px-4 py-3 font-mono">{from}</td>
                    <td className="px-4 py-3 font-mono">{to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Which format should you pick?</h2>
          {/* Deliberately NOT generated from the format list: each row is a
              judgement about when to use that format, and there is nothing in
              the API to derive it from. If a new format appears in the badges
              above without a row here, add one. */}
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Format</th>
                  <th className="px-4 py-3 font-semibold">Best for</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-mono">MP3</td>
                  <td className="px-4 py-3">Sharing, casual listening, small file size</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">WAV</td>
                  <td className="px-4 py-3">Editing, sampling, DJ software — lossless</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">FLAC</td>
                  <td className="px-4 py-3">Archiving at full quality with a smaller footprint than WAV</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">M4A</td>
                  <td className="px-4 py-3">Apple devices and Apple Music/iTunes compatibility</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">AAC</td>
                  <td className="px-4 py-3">Mobile and streaming — similar to MP3, often smaller at equal quality</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">OGG</td>
                  <td className="px-4 py-3">Open-source software and games</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono">AIFF</td>
                  <td className="px-4 py-3">Professional editing on Apple/Logic-based workflows — lossless</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Want the deeper technical explanation of lossless vs. lossy, and why
            converting up to WAV doesn&apos;t recover lost quality?{" "}
            <Link href="/guides/lossless-vs-lossy-audio-formats" className="text-amber-400 hover:underline">
              Read Lossless vs Lossy Audio: Which Format to Use
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Works with files from anywhere</h2>
          <p className="text-text-muted leading-relaxed">
            Since conversion works on the file format itself rather than
            where it came from, this handles exports from Audacity, Adobe
            Audition, Ableton Live, Logic Pro, FL Studio, GarageBand, OBS,
            Premiere Pro, DaVinci Resolve, or anywhere else — as long as the
            file is one of the formats above.
          </p>
          <p className="text-text-muted leading-relaxed">
            Need to trim, reverse, or adjust a file before or after
            converting it? The{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>
            ,{" "}
            <Link href="/pitch" className="text-amber-400 hover:underline">
              Pitch Shifter
            </Link>
            , and{" "}
            <Link href="/tempo" className="text-amber-400 hover:underline">
              Tempo Changer
            </Link>{" "}
            all work on any of these formats too.
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
                  // prefetch disabled on bulk tool links, matching the other
                  // tool pages — four edge requests per route adds up on a grid
                  // that renders on every one of them.
                  prefetch={false}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}