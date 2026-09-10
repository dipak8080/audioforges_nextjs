import type { Metadata } from "next";
import Link from "next/link";
import { LoudnormForm } from "@/components/converter/LoudnormForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { LoudnessScale } from "@/components/tools/LoudnessScale";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/*
  TITLE — NOT YET MEASURED. Unlike the other tool pages, no Bing Keyword
  Research numbers have been pulled for this cluster, so this is a phrasing
  judgement rather than a data-driven one. Verify before relying on it, and
  record the figures here when you do:

    audio normalizer · normalize audio · loudness normalizer · lufs ·
    normalize audio online · mp3 normalizer · audio volume normalizer

  The reasoning: LUFS is producer vocabulary. Someone who already knows the
  unit is a small, expert slice of the people who want this tool — most search
  "normalize audio" or "audio normalizer" because the problem they have is
  "these tracks are different volumes", not "I need -14 LUFS integrated".
  Leading with LUFS is the same mistake /video-to-audio made leading with
  "MP4 to WAV": precise, and narrower than the audience.

  LUFS stays in the title, just not at position zero — it is what separates
  this from a plain gain tool, and the people searching it are the ones most
  likely to actually use the presets.
*/
const PAGE_TITLE = "Audio Normalizer – Normalize Audio to LUFS, Free";
const PAGE_DESCRIPTION =
  "Free online audio normalizer. Normalize audio to a streaming, club or broadcast LUFS target with two-pass accuracy. No sign-up, no watermark.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("loudness-normalizer", "Free LUFS Loudness Normalizer");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/loudness-normalizer` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/loudness-normalizer`,
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

// Every claim below is checked against actual LoudnormForm/backend behaviour.
// Preset labels only — NOT asserted as universal cross-platform standards; see
// the visible copy for the caveat.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Normalizer",
  alternateName: [
    "Audio Normalizer",
    "Loudness Normalizer",
    "LUFS Normalizer",
    "Audio Volume Normalizer",
    "MP3 Normalizer",
  ],
  url: `${SITE_URL}/loudness-normalizer`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Two-pass accurate loudness normalization",
    "Streaming, club, and broadcast loudness presets",
    "Custom LUFS target",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.


export default async function LoudnessNormalizerPage() {
  const relatedTools = getRelatedTools("loudness-normalizer", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "loudness-normalizer");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What is LUFS?",
      answer:
        "Loudness Units relative to Full Scale, a standardized way of measuring perceived loudness across an entire track, rather than just peak level. It's the measurement streaming platforms and broadcasters actually use to normalize playback volume.",
    },
    {
      question: "What LUFS should I master to for Spotify?",
      answer:
        "Spotify's default normalization target is -14 LUFS integrated. Mastering at or near that level means Spotify applies little or no correction on playback, so your track keeps the dynamics you intended rather than getting turned down.",
    },
    {
      question: "What's the difference between the presets?",
      answer:
        "Streaming (-14 LUFS) is a reasonable single target if you're releasing to multiple platforms at once, close to what Spotify normalizes to. Club (-9 LUFS) is louder, matching typical club/DJ mastering conventions. Broadcast (-23 LUFS) follows the EBU R128 / ATSC A/85 standard used in TV and radio.",
    },
    {
      question: "Why two-pass normalization instead of one pass?",
      answer:
        "A single pass estimates the correction in real time as it streams through the file, which can miss the target by a full LU or more on tracks with uneven dynamics. Two-pass first measures the track's actual loudness, true peak, and dynamic range in a dedicated analysis pass, then applies the exact correction needed, the result lands on target far more reliably.",
    },
    {
      question: "Will this affect the dynamic range of my track?",
      answer:
        "Normalization adjusts overall level to hit the target loudness; it doesn't compress or limit the track's internal dynamics beyond what's needed to stay under the true peak ceiling.",
    },
    {
      /*
        The length half matters more here than on most tools: a finished master
        is often the longest file someone uploads anywhere on the site, and a
        DJ set can run well past the cap.
      */
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes, ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio. A long DJ set can run past that; splitting it first is the workaround.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  const limitLabel =
    durationCap === null ? `${limits.maxUploadMb}MB per upload` : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Loudness Normalizer" }]} />}
        meta={["No account", "Two-pass loudnorm", "-14, -9, -23 or custom"]}
        title="Loudness Normalizer"
        lede="Bring a file to a streaming, club or broadcast loudness target in LUFS, measured in two passes so it lands on the number rather than near it. Free, no sign-up."
        tool={<LoudnormForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Targets",
              value: "-14, -9, -23 LUFS, or your own",
              note: "Streaming, club and EBU R128 broadcast presets. Custom runs from -70 to +5.",
            },
            {
              label: "Method",
              value: "Two-pass loudnorm",
              note: "Pass one measures integrated loudness, range and true peak. Pass two applies the correction using those numbers. One pass guesses.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. 10 to 30 seconds, because it reads the whole file twice. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="scale" title="Where the targets sit" bleed>
          <LoudnessScale mode="loudnorm" />
        </ToolSection>

        <ToolSection id="targets" title="Which target, and what it costs" bleed>
          <CompareTable
            columns={["Use it for", "What to expect"]}
            highlight={-1}
            rows={[
              {
                label: "-14 LUFS, streaming",
                cells: [
                  { text: "Spotify, YouTube, Apple Music, most podcast hosts" },
                  { state: "yes", text: "The platform will not turn it down. Louder masters get turned down to this anyway" },
                ],
              },
              {
                label: "-9 LUFS, club",
                cells: [
                  { text: "DJ masters, tracks that need to sit next to commercial releases in a set" },
                  { state: "partial", text: "Louder than streaming wants. Peaks get limited to fit, so some dynamic range goes" },
                ],
              },
              {
                label: "-23 LUFS, broadcast",
                cells: [
                  { text: "TV, radio, EBU R128 and ATSC A/85 delivery" },
                  { state: "yes", text: "Quiet by music standards, full dynamics kept. Exactly what the spec asks for" },
                ],
              },
              {
                label: "Custom",
                cells: [
                  { text: "A house standard, or matching a batch to one reference" },
                  { state: "partial", text: "Anything above about -9 will lean on the limiter hard" },
                ],
              },
            ]}
            footnote="Normalizing does not change dynamic range on its own. Range only shrinks when the target is loud enough that peaks have to be limited to fit under the ceiling."
          />
          <Prose className="mt-5">
            <p>
              Just need one file louder, without a target? The <Link href="/volume">Volume Booster</Link> adds a
              flat number of dB and shows you the clipping headroom first. Matching several files to each other is
              this page&apos;s job, not that one&apos;s.
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