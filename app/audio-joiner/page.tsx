import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/converter/JoinForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { TOOL_LIMITS, formatBytes, formatDuration } from "@/lib/data/tool-limits";

const PAGE_TITLE = "Free Audio Joiner — Merge Multiple Files Online";
const PAGE_DESCRIPTION =
  "Combine multiple audio files into one track online, free. Reorder files, mix formats, choose your output. No sign-up, no watermark.";

// Every limit shown on this page resolves from ONE place. Previously the
// file count, byte ceiling, and duration cap were each written out by
// hand in three or four spots (schema featureList, the feature grid, the
// FAQ answer) — and they had already drifted once: the FAQ said "30
// minutes" while the backend cap moved. Raising a cap on the VPS now
// means updating tool-limits.ts alone, not grepping this file for
// numbers.
const JOIN = TOOL_LIMITS.join;

const MAX_FILES = JOIN.maxFiles ?? 10;
const MAX_TOTAL_SIZE = formatBytes(JOIN.maxTotalBytes ?? 0);
const MAX_PER_FILE_SIZE = formatBytes(JOIN.maxFileBytes ?? 0);
const MAX_TOTAL_DURATION = formatDuration(JOIN.maxTotalDurationSeconds ?? 0);

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/audio-joiner` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/audio-joiner`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below is checked against confirmed
// backend behavior (JOIN_MAX_FILES, JOIN_MAX_TOTAL_BYTES,
// JOIN_OUTPUT_SAMPLE_RATE). No channel-layout or lossless-passthrough
// claims, since neither is confirmed by the implementation.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Joiner",
  url: `${SITE_URL}/audio-joiner`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    `Join up to ${MAX_FILES} audio files into one`,
    "Reorder files before joining",
    "Resamples mismatched inputs to a common sample rate",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio Joiner", item: `${SITE_URL}/audio-joiner` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.

const faqs = [
  {
    question: "Can I join files that are in different formats or sample rates?",
    answer:
      "Yes — every file is resampled to a common sample rate (44.1kHz) before joining, so a file recorded at 48kHz followed by one at 44.1kHz still joins correctly instead of playing at the wrong speed or pitch partway through.",
  },
  {
    question: "How many files can I join at once?",
    answer:
      `Up to ${MAX_FILES} files, with a combined total of ${MAX_TOTAL_SIZE} and up to ` +
      `${MAX_TOTAL_DURATION} of audio across all files together. Each individual ` +
      `file is also capped at ${MAX_PER_FILE_SIZE} — a single file over that is ` +
      `rejected even when the combined total is well under the limit.`,
  },
  {
    question: "Does the order I add files in matter?",
    answer:
      "The output order matches whatever order the files are arranged in on screen — use the up/down arrows next to each file to rearrange them before joining, independent of the order you originally selected or dropped them in.",
  },
  {
    question: "Can I remove a file after adding it?",
    answer: "Yes — each file in the list has its own remove button.",
  },
  {
    question: "What output formats are available?",
    answer: "MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF, regardless of what formats the input files were in.",
  },
  {
    question: "Does joining reduce audio quality?",
    answer:
      "Every input file is resampled to a common rate before joining, which means each file passes through a decode-and-re-encode step as part of the process — this isn't a raw splice of the original file data. In practice this has minimal audible impact, but it's not a byte-for-byte lossless passthrough even when input and output formats match.",
  },
  {
    question: "Will there be a gap or crossfade between files?",
    answer:
      "Files are joined end-to-end with no gap and no crossfade — whatever silence or lack of silence exists at the boundary between two files is exactly what carries over into the merged result.",
  },
  {
    question: "Why was my join rejected for being too long?",
    answer:
      `The combined running time of all files is capped at ${MAX_TOTAL_DURATION}. ` +
      `This is checked before any processing starts, so an over-length batch is ` +
      `rejected immediately rather than failing partway through. If you're over ` +
      `the limit, trim the individual files first or join them in two passes.`,
    answerNode: (
      <>
        The combined running time of all files is capped at{" "}
        {MAX_TOTAL_DURATION}. This is checked before any processing starts,
        so an over-length batch is rejected immediately rather than failing
        partway through. If you&apos;re over the limit, trim the individual
        files first with the{" "}
        <Link href="/trim" className="text-amber-400 hover:underline">
          Audio Trimmer
        </Link>{" "}
        or join them in two passes.
      </>
    ),
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no watermark on the output.",
  },
];

export default function AudioJoinerPage() {
  const relatedTools = getRelatedTools("audio-joiner", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Audio Joiner
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Combine multiple audio files into one track, free, no sign-up,
            no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <JoinForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: `Up to ${MAX_FILES} files`,
              desc: `${MAX_TOTAL_SIZE} combined, any mix of supported formats.`,
            },
            { title: "Reorderable", desc: "Set the exact playback order before joining." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to combine audio files</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Add two or more MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF files.</li>
            <li>Use the up/down arrows to set the order they should play in.</li>
            <li>Choose an output format.</li>
            <li>Download the single merged file.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Limits</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Files per join</td>
                  <td className="px-4 py-3">Up to {MAX_FILES}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Combined size</td>
                  <td className="px-4 py-3">{MAX_TOTAL_SIZE}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Per-file size</td>
                  <td className="px-4 py-3">{MAX_PER_FILE_SIZE}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Combined length</td>
                  <td className="px-4 py-3">{MAX_TOTAL_DURATION}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Both size limits apply independently — a single file over{" "}
            {MAX_PER_FILE_SIZE} is rejected even when the combined total sits
            comfortably under {MAX_TOTAL_SIZE}. Length is checked across all
            files together, before any processing begins.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why mismatched files still join correctly</h2>
          <p className="text-text-muted leading-relaxed">
            Joining audio files directly is riskier than it looks — a file
            recorded at 48kHz followed by one at 44.1kHz, played back
            end-to-end without correction, can play the second file at the
            wrong speed and pitch. This tool resamples every input file to a
            common sample rate (44.1kHz) before joining, so files recorded at
            different rates, in different source formats, still combine into
            one correctly-playing track instead of shifting speed at the
            seam.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of what&apos;s actually happening when
            mismatched files get joined, and what &quot;no gap, no crossfade&quot;
            really means for the result?{" "}
            <Link href="/guides/why-you-cant-just-concatenate-audio-files" className="text-amber-400 hover:underline">
              Read Why You Can&apos;t Just Concatenate Audio Files
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What happens to audio quality during joining</h2>
          <p className="text-text-muted leading-relaxed">
            Because every input is resampled to a common rate as part of the
            join, each file goes through a decode-and-re-encode step rather
            than being spliced together as raw, untouched data — that&apos;s true
            even when the input and chosen output format already match. In
            practice the audible difference is minimal, but it&apos;s worth
            knowing this isn&apos;t a byte-for-byte lossless passthrough, the
            same way any format conversion involves an encoding step.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Combining separately recorded podcast segments into one
              episode file, merging voice memos recorded across multiple
              takes, stitching together audio clips for a longer
              presentation, and joining separately downloaded tracks into
              a single continuous file.
            </p>
            <p>
              Need to trim a file before adding it to the mix? Use the{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>{" "}
              first. Want a smooth transition between joined files rather
              than a hard cut? Trim each clip with a short fade first using
              the{" "}
              <Link href="/fade" className="text-amber-400 hover:underline">
                Fade In/Out
              </Link>{" "}
              tool.
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

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}