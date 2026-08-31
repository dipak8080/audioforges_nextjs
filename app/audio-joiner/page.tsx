import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/converter/JoinForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, durationLabel, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Free Audio Joiner — Merge Multiple Files Online";
const PAGE_DESCRIPTION =
  "Combine multiple audio files into one track online, free. Reorder files, mix formats, choose your output. No sign-up, no watermark.";

const OG_IMAGE = ogForTool("audio-joiner", "Free Audio Joiner");

// Every limit on this page comes from GET /limits, including the file count
// (nested as `join.max_files`, not a flat `max_join_files`). Nothing here is
// hand-maintained — the previous hand table drifted and the FAQ said 30
// minutes while the backend cap had moved.
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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function AudioJoinerPage() {
  const relatedTools = getRelatedTools("audio-joiner", 5);

  const limits = await getLimits();

  /*
    THE TWO "TOTAL" FIGURES REJECT INDEPENDENTLY and neither is implied by
    the per-file cap: ten 20MB files pass the per-file check and fail the
    combined one; ten four-minute tracks pass any per-file duration
    intuition and fail at forty minutes combined. Both are stated
    explicitly below for that reason.
  */
  const MAX_FILES = limits.join.maxFiles;
  const maxTotalSize = `${limits.join.maxTotalMb}MB`;
  const maxPerFileSize = `${limits.join.maxPerFileMb}MB`;
  const maxTotalDuration = durationLabel(limits.durations.joinMaxTotalSeconds);

  // Bare lowercase from the API ("mp3"); uppercase is a display choice.
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const retention = retentionSentences(limits.retention.audio_tools);

  // Every claim below is checked against confirmed backend behaviour. No
  // channel-layout or lossless-passthrough claims — neither is confirmed by
  // the implementation.
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

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[{ name: "Tools", href: "/tools" }, { name: "Audio Joiner" }]}
          />
        }
        title="Free Audio Joiner"
        lede="Combine multiple audio files into one track, free, no sign-up, no watermark."
        tool={<JoinForm />}
      >
        <FeatureStrip
          features={[
            {
              title: `Up to ${MAX_FILES} files`,
              desc: `${maxTotalSize} combined, any mix of supported formats.`,
            },
            { title: "Reorderable", desc: "Set the exact playback order before joining." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ]}
        />

        <ToolSection id="how-to" title="How to combine audio files">
          <ol>
            <li>Add two or more {formatList} files.</li>
            <li>Use the up/down arrows to set the order they should play in.</li>
            <li>Choose an output format.</li>
            <li>Download the single merged file.</li>
          </ol>
        </ToolSection>

        {/* Was a bordered two-column table. Four label/value pairs is a
            definition list, and the dl style already renders it as a spec
            table without a box around it. */}
        <ToolSection id="limits" title="Limits">
          <dl className="codes">
            <dt>Files per join</dt>
            <dd>Up to {MAX_FILES}</dd>

            <dt>Combined size</dt>
            <dd>{maxTotalSize}</dd>

            <dt>Per-file size</dt>
            <dd>{maxPerFileSize}</dd>

            <dt>Combined length</dt>
            <dd>{maxTotalDuration}</dd>
          </dl>
          <p>
            Both size limits apply independently — a single file over{" "}
            {maxPerFileSize} is rejected even when the combined total sits
            comfortably under {maxTotalSize}. Length is checked across all
            files together, before any processing begins, and it&apos;s a total
            rather than a per-file figure: ten four-minute tracks is a
            forty-minute job however short each one looks on its own.
          </p>
        </ToolSection>

        <ToolSection id="mismatched" title="Why mismatched files still join correctly">
          <p>
            Joining audio files directly is riskier than it looks — a file
            recorded at 48kHz followed by one at 44.1kHz, played back
            end-to-end without correction, can play the second file at the
            wrong speed and pitch. This tool resamples every input file to a
            common sample rate (44.1kHz) before joining, so files recorded at
            different rates, in different source formats, still combine into
            one correctly-playing track instead of shifting speed at the seam.
          </p>
          <p>
            Want the fuller breakdown of what&apos;s actually happening when
            mismatched files get joined, and what &quot;no gap, no crossfade&quot;
            really means for the result?{" "}
            <Link href="/guides/why-you-cant-just-concatenate-audio-files">
              Read Why You Can&apos;t Just Concatenate Audio Files
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="quality" title="What happens to audio quality during joining">
          <p>
            Because every input is resampled to a common rate as part of the
            join, each file goes through a decode-and-re-encode step rather
            than being spliced together as raw, untouched data — that&apos;s true
            even when the input and chosen output format already match. In
            practice the audible difference is minimal, but it&apos;s worth
            knowing this isn&apos;t a byte-for-byte lossless passthrough, the
            same way any format conversion involves an encoding step.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Combining separately recorded podcast segments into one episode
            file, merging voice memos recorded across multiple takes,
            stitching together audio clips for a longer presentation, and
            joining separately downloaded tracks into a single continuous
            file.
          </p>
          <p>
            Need to trim a file before adding it to the mix? Use the{" "}
            <Link href="/trim">Audio Trimmer</Link> first. Want a smooth
            transition between joined files rather than a hard cut? Trim each
            clip with a short fade first using the{" "}
            <Link href="/fade">Fade In/Out</Link> tool.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}