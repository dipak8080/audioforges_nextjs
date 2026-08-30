import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/converter/JoinForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, durationLabel, retentionSentences } from "@/lib/api/limits";

const PAGE_TITLE = "Free Audio Joiner — Merge Multiple Files Online";
const PAGE_DESCRIPTION =
  "Combine multiple audio files into one track online, free. Reorder files, mix formats, choose your output. No sign-up, no watermark.";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * This page was already doing the right thing in the right way — one source
 * for every limit, no numbers repeated across the schema, the feature grid and
 * the FAQ. It just had the wrong source.
 *
 * It resolved from TOOL_LIMITS.join, the hand-maintained table. The comment it
 * carried says that table already drifted once: "the FAQ said 30 minutes while
 * the backend cap moved". The discipline was right and it still went wrong,
 * because a hand table has no way to know the backend changed.
 *
 * Three of the four now come from GET /limits:
 *
 *   combined size    max_join_total_mb              150
 *   per-file size    max_upload_mb                  80
 *   combined length  durations.join_max_total_seconds  5400
 *
 * ALL FOUR NOW COME FROM THE BACKEND, including the file count. It was
 * published all along — nested as `join.max_files` alongside the three size
 * caps, not as a top-level `max_join_files`, which is why grepping for the
 * flat name found nothing. Nothing on this page is hand-maintained any more.
 *
 * ALSO: retention answer added. /join is one of the four routes with its own
 * submit path, and the backend confirmed it passes `input_paths` to
 * cleanup_paths like the rest — so the standard audio-tools answer applies
 * with no special case.
 */

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
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function AudioJoinerPage() {
  const relatedTools = getRelatedTools("audio-joiner", 5);

  const limits = await getLimits();

  /*
    Four caps, all from the backend's `join` block plus durations.

    THE TWO "TOTAL" FIGURES REJECT INDEPENDENTLY and neither is implied by the
    per-file cap: ten 20MB files pass the per-file check and fail the combined
    one; ten four-minute tracks pass any per-file duration intuition and fail
    at forty minutes combined. Both are stated explicitly below for that
    reason.
  */
  const MAX_FILES = limits.join.maxFiles;
  const maxTotalSize = `${limits.join.maxTotalMb}MB`;
  const maxPerFileSize = `${limits.join.maxPerFileMb}MB`;
  const maxTotalDuration = durationLabel(limits.durations.joinMaxTotalSeconds);

  // Bare lowercase from the API ("mp3"); uppercase is a display choice.
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const retention = retentionSentences(limits.retention.audio_tools);

  // WebApplication schema — every claim below is checked against confirmed
  // backend behavior. No channel-layout or lossless-passthrough claims, since
  // neither is confirmed by the implementation.
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

  const faqs = [
    {
      question: "Can I join files that are in different formats or sample rates?",
      answer:
        "Yes — every file is resampled to a common sample rate (44.1kHz) before joining, so a file recorded at 48kHz followed by one at 44.1kHz still joins correctly instead of playing at the wrong speed or pitch partway through.",
    },
    {
      question: "How many files can I join at once?",
      answer:
        `Up to ${MAX_FILES} files, with a combined total of ${maxTotalSize} and up to ` +
        `${maxTotalDuration} of audio across all files together. Each individual ` +
        `file is also capped at ${maxPerFileSize} — a single file over that is ` +
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
      answer: `${formatList}, regardless of what formats the input files were in.`,
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
        `The combined running time of all files is capped at ${maxTotalDuration}. ` +
        `This is checked before any processing starts, so an over-length batch is ` +
        `rejected immediately rather than failing partway through. If you're over ` +
        `the limit, trim the individual files first or join them in two passes.`,
      answerNode: (
        <>
          The combined running time of all files is capped at {maxTotalDuration}.
          This is checked before any processing starts, so an over-length batch is
          rejected immediately rather than failing partway through. If you&apos;re
          over the limit, trim the individual files first with the{" "}
          <Link href="/trim" className="text-amber-400 hover:underline">
            Audio Trimmer
          </Link>{" "}
          or join them in two passes.
        </>
      ),
    },
    {
      // ADDED: this page had no retention answer. /join builds its own submit
      // path, and the backend confirmed it passes input_paths to cleanup like
      // every other route — so the standard answer applies, no special case.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
  ];

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

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            {
              title: `Up to ${MAX_FILES} files`,
              desc: `${maxTotalSize} combined, any mix of supported formats.`,
            },
            { title: "Reorderable", desc: "Set the exact playback order before joining." },
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
          <h2 className="text-2xl font-bold text-text-primary">How to combine audio files</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Add two or more {formatList} files.</li>
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
                  <td className="px-4 py-3">{maxTotalSize}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Per-file size</td>
                  <td className="px-4 py-3">{maxPerFileSize}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Combined length</td>
                  <td className="px-4 py-3">{maxTotalDuration}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            Both size limits apply independently — a single file over{" "}
            {maxPerFileSize} is rejected even when the combined total sits
            comfortably under {maxTotalSize}. Length is checked across all
            files together, before any processing begins, and it&apos;s a total
            rather than a per-file figure: ten four-minute tracks is a
            forty-minute job however short each one looks on its own.
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
                  // prefetch disabled on bulk tool links, matching the other
                  // tool pages.
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