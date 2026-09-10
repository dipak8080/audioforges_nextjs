import type { Metadata } from "next";
import Link from "next/link";
import { JoinForm } from "@/components/converter/JoinForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, durationLabel, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/*
  TITLE, from Bing Keyword Research (three months to 30 Aug 2026):

    audio joiner       17.4K   head term — keeps position zero
    audio mixer        15.6K   NOT ours, see below
    audio merger        2.3K
    audio joiner online 2.0K
    mp3 joiner          1.5K   ┐
    audiojoiner         1.5K   |  ~3.5K phrased with "MP3", and the title
    mp3 merger          1.1K   |  said "Audio" throughout
    merge audio         1.0K   ┘

  "MP3" earns its place; "audio mixer" does not. Mixing means layering tracks
  to play at the same time. This tool concatenates end to end with no gap and
  no crossfade — see the FAQ. Ranking for mixer queries would bring in people
  who bounce on arrival, which costs more than the impressions are worth. If a
  real mixer ever ships, it is a separate page.

  `absolute` so the root template does not append " | AudioForges" — fourteen
  characters on a brand with no recorded search volume, matching the other
  commercial pages.
*/
const PAGE_TITLE = "Audio Joiner – Merge MP3 & Audio Files Online, Free";
const PAGE_DESCRIPTION =
  "Free online audio joiner and MP3 merger. Combine multiple files into one track, reorder them, mix formats, pick your output. No sign-up, no watermark.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("audio-joiner", "Free Audio Joiner");

// Every limit on this page comes from GET /limits, including the file count
// (nested as `join.max_files`, not a flat `max_join_files`). Nothing here is
// hand-maintained — the previous hand table drifted and the FAQ said 30
// minutes while the backend cap had moved.
export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
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
    name: "Audio Joiner & MP3 Merger",
    // Standalone entity labels, so each query can associate with the page
    // independently. No "Audio Mixer" — this tool does not mix.
    alternateName: [
      "Audio Joiner",
      "MP3 Joiner",
      "Audio Merger",
      "MP3 Merger",
      "Online Audio Joiner",
    ],
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
        "Yes, every file is resampled to a common sample rate (44.1kHz) before joining, so a file recorded at 48kHz followed by one at 44.1kHz still joins correctly instead of playing at the wrong speed or pitch partway through.",
    },
    {
      question: "How many files can I join at once?",
      answer:
        `Up to ${MAX_FILES} files, with a combined total of ${maxTotalSize} and up to ` +
        `${maxTotalDuration} of audio across all files together. Each individual ` +
        `file is also capped at ${maxPerFileSize}, a single file over that is ` +
        `rejected even when the combined total is well under the limit.`,
    },
    {
      question: "What output formats are available?",
      answer: `${formatList}, regardless of what formats the input files were in.`,
    },
    {
      question: "Does joining reduce audio quality?",
      answer:
        "Every input file is resampled to a common rate before joining, which means each file passes through a decode-and-re-encode step as part of the process, this isn't a raw splice of the original file data. In practice this has minimal audible impact, but it's not a byte-for-byte lossless passthrough even when input and output formats match.",
    },
    {
      question: "Will there be a gap or crossfade between files?",
      answer:
        "Files are joined end-to-end with no gap and no crossfade, whatever silence or lack of silence exists at the boundary between two files is exactly what carries over into the merged result.",
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
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio Joiner" }]} />}
        meta={["No account", "Mixed formats welcome", "Resampled to match"]}
        title="Audio Joiner"
        lede="Combine several audio files into one, in the order you set. Files at different sample rates or formats are matched first, so nothing plays at the wrong speed at the seam. Free, no sign-up."
        tool={<JoinForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Mismatched inputs",
              value: "Every file resampled to 44.1 kHz first",
              note: "A 48 kHz file after a 44.1 one, joined raw, plays the second at the wrong speed and pitch. Matching first is what most free joiners skip.",
            },
            {
              label: "The join",
              value: "Butt-joined, no gap, no crossfade",
              note: "Files meet end to end. Add a fade to each file first if you want a soft transition.",
            },
            {
              label: "Limits",
              value: `Up to ${limits.join.maxFiles} files, ${maxTotalSize} total, ${maxTotalDuration}`,
              note: `${maxPerFileSize} per file. ${formatList}. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="how" title="What happens to each file" bleed>
          <CompareTable
            columns={["Same rate, same format", "Different rates or formats"]}
            highlight={-1}
            rows={[
              { label: "Sample rate", cells: [{ state: "yes", text: "Kept as is" }, { state: "partial", text: "All resampled to 44.1 kHz so the seam plays at the right speed" }] },
              { label: "Channels", cells: [{ state: "yes", text: "Kept as is" }, { state: "partial", text: "Matched so a mono clip does not come out half-width next to a stereo one" }] },
              { label: "Quality", cells: [{ state: "yes", text: "Lossless if the output format is lossless" }, { state: "partial", text: "One resample on the files that needed it. Inaudible, but keep the originals" }] },
              { label: "Order", cells: [{ text: "The order in the list. Drag to reorder before joining" }, { text: "Same" }] },
            ]}
            footnote="A join that is refused for length is the total duration cap, not one file. Trim the longest input and try again."
          />
          <Prose className="mt-5">
            <p>
              Soft transitions: run each file through <Link href="/fade">Fade In / Out</Link> first. Pieces of one
              long recording: <Link href="/trim">Trim</Link> them, then join.{" "}
              <Link href="/guides/why-you-cant-just-concatenate-audio-files">Why you cannot just concatenate audio files</Link>{" "}
              explains the seam problem.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="You are responsible for having the right to process any file you upload. AudioForges does not host or distribute the files processed here."
        />
      </ToolPageShell>
    </>
  );
}