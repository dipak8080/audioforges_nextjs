import type { Metadata } from "next";
import Link from "next/link";
import { TrimForm } from "@/components/converter/TrimForm";
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
import { ogForTool } from "@/lib/og";
import { getRelatedTools } from "@/lib/data/tools";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/*
  TITLE. Bing Keyword Research, three months to 30 Aug 2026:

    audio trimmer   15.6K   head term – already led the old title, kept

  OPEN QUESTION, worth ten seconds in Keyword Research: "audio cutter".
  This page's own copy says people search both words for the same thing, and
  mp3cut.net – one of the strongest sites in this space – calls its tool
  "Audio Cutter". If that term is larger than 15.6K, the lead should swap.
  Until it is measured, the measured term keeps position zero.

  "Cut Audio Online" replaces "Cut Any Track Online": same length, and it puts
  the verb next to the noun people actually type.

  `absolute` so the brand suffix doesn't take this past the budget.
*/
const PAGE_TITLE = "Audio Trimmer – Cut Audio Online Free, No Sign-Up";
const PAGE_DESCRIPTION =
  "Free online audio trimmer and cutter. Cut MP3, WAV, FLAC, AAC, M4A or OGG to a precise start and end point. No sign-up, no watermark.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("trim", "Free Audio Trimmer");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/trim` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/trim`,
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

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Trimmer",
  alternateName: ["Audio Trimmer", "Audio Cutter", "MP3 Cutter", "Cut Audio Online"],
  url: `${SITE_URL}/trim`,
  dateModified: UPDATED,
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

// Don't add HowTo schema – deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Every limit on this page comes from /limits. Don't type one in by hand —
// hand-written duration caps have been wrong, always understated, on more
// than half the pages that stated one.
export default async function TrimPage() {
  const relatedTools = getRelatedTools("trim", 5);

  const limits = await getLimits();

  // Bare lowercase from the API ("mp3"); uppercase is a display choice.
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", and $1");

  const durationCap = durationCapFor(limits, "trim");
  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    {
      question: "Does trimming change the audio quality?",
      answer:
        "No, trimming just cuts the selected range and keeps your original format, with no quality loss beyond the format's normal characteristics.",
    },
    {
      question: "Can I remove silence throughout a track, not just the ends?",
      answer:
        "That's a separate tool. Trim cuts to a single start and end point; the Silence Remover strips silent gaps everywhere in the file, not just the edges.",
      answerNode: (
        <>
          That&apos;s a separate tool. Trim cuts to a single start and end
          point; the{" "}
          <Link href="/silence-remove" className="text-amber-400 hover:underline">
            Silence Remover
          </Link>{" "}
          strips silent gaps everywhere in the file, not just the edges.
        </>
      ),
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Uploads are limited to ${limits.maxUploadMb}MB per file, with no length limit.`
          : `The source file can be up to ${durationLabel(durationCap)} long and ${limits.maxUploadMb}MB.`,
    },
    {
      question: "Can I convert the trimmed clip to a different format too?",
      answer:
        "Trim keeps the original format by design. Run the trimmed result through the Format Converter afterward if you need a different format.",
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Does trimming reduce the file size?",
      answer:
        "Yes, proportionally to how much you cut, a shorter clip has less audio data, so the file comes out smaller than the original.",
    },
  ];

  const limitLabel =
    durationCap === null ? `${limits.maxUploadMb}MB per upload` : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio Trimmer" }]} />}
        meta={["No account", "Drag on the waveform", "Format kept"]}
        title="Audio Trimmer"
        lede="Cut a section out of an audio file by dragging across its waveform. The clip comes back in the same format you uploaded. Free, no sign-up."
        tool={<TrimForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Selection",
              value: "Drag on the real waveform",
              note: "The file is decoded in your browser so you can see where the sound is. Nudge either edge, or type exact times.",
            },
            {
              label: "Output",
              value: "Same format in, same format out",
              note: "A WAV stays WAV, an MP3 stays MP3. Nothing is resampled and nothing outside the selection is touched.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="which-tool" title="Trim, or one of the other three?" bleed>
          <CompareTable
            columns={["Use it when"]}
            highlight={-1}
            rows={[
              { label: "Trimmer, this page", cells: [{ state: "yes", text: "You want one continuous section: a clip from a song, a memo without the dead air at either end" }] },
              { label: "Silence Remover", cells: [{ state: "partial", text: "You want every quiet gap in the middle gone too, automatically" }] },
              { label: "Silence Splitter", cells: [{ state: "partial", text: "You want one file per take, split wherever the audio goes quiet" }] },
              { label: "Ringtone Maker", cells: [{ state: "partial", text: "You want a phone-ready clip with fades and the right format already applied" }] },
            ]}
            footnote="All four keep the audio inside the cut untouched. Trimming never lowers quality; it only removes."
          />
          <Prose className="mt-5">
            <p>
              <Link href="/silence-remove">Silence Remover</Link>, <Link href="/silence-split">Silence Splitter</Link>{" "}
              and <Link href="/ringtone-maker">Ringtone Maker</Link> are each one click away. To change the format
              of the clip afterwards, the <Link href="/convert">Audio Converter</Link> takes the trimmed file.
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