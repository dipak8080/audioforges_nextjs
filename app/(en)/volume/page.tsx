import type { Metadata } from "next";
import Link from "next/link";
import { VolumeForm } from "@/components/converter/VolumeForm";
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

/**
 * The gain range (-30dB to +30dB) is NOT read from the backend: it's a
 * client-side control range defined in VolumeForm, not a server limit, so
 * there's nothing in /limits to read it from. Check it against MIN_GAIN /
 * MAX_GAIN there if it ever changes.
 */

const PAGE_TITLE = "Free Audio Volume Booster";
const SOCIAL_TITLE = "Free Audio Volume Booster — Increase or Reduce Volume Online";
const PAGE_DESCRIPTION =
  "Increase or reduce audio volume online free. Adjust gain from -30dB to +30dB on MP3, WAV, FLAC, and more. No sign-up, no watermark, fast processing.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("volume", "Free Audio Volume Booster");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/volume` },
  openGraph: {
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/volume`,
    siteName: SITE_NAME,
    type: "website",
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SOCIAL_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Volume Booster",
  url: `${SITE_URL}/volume`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Boost audio volume up to +30dB",
    "Reduce audio volume down to -30dB",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — Google retired HowTo rich results for web search,
// so it earns nothing while duplicating the visible steps. FAQPage comes from
// <FAQSection />, BreadcrumbList from <Breadcrumb />.


/**
 * Every figure comes from /limits. The hand-written sentence said "up to 80MB
 * and 20 minutes" — the size was right, the length wrong by forty minutes.
 * /volume takes the audio_tools default of one hour; 20 minutes is the
 * transcription cap, which is almost certainly where it was copied from.
 */
export default async function VolumePage() {
  const relatedTools = getRelatedTools("volume", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "volume");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What gain range can I use?",
      answer:
        "From -30dB to +30dB. Extreme values near either end will often sound distorted or overly quiet, that's expected behavior, not a bug.",
    },
    {
      question: "What's a safe boost amount?",
      answer:
        "+6dB to +10dB is a solid, clearly audible boost without heavy clipping risk on most source material.",
    },
    {
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per file with no length limit.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long.`,
    },
    {
      question: "Does boosting volume reduce quality?",
      answer:
        "The gain change itself doesn't discard any audio quality. The only quality risk is clipping if you push the boost high enough that peaks exceed the format's maximum level, moderate boosts don't carry that risk.",
    },
    {
      question: "Why is my audio still quiet after boosting?",
      answer:
        "If the source recording was very quiet to begin with, a single gain boost may not be enough to reach a comfortable listening level without introducing clipping. Try a moderate boost first and check the result before pushing higher.",
    },
    {
      question: "Is this different from normalization?",
      answer:
        "Yes. Normalization automatically raises a track to a target loudness level. This tool applies a fixed gain change you choose yourself, which gives you direct control but means you're responsible for picking a value that doesn't clip.",
      answerNode: (
        <>
          Yes. The{" "}
          <Link href="/loudness-normalizer" className="text-amber-400 hover:underline">
            Loudness Normalizer
          </Link>{" "}
          automatically raises a track to a target loudness level. This tool
          applies a fixed gain change you choose yourself, which gives you direct
          control but means you&apos;re responsible for picking a value that
          doesn&apos;t clip.
        </>
      ),
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
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Volume Booster" }]} />}
        meta={["No account", "-30 to +30 dB", "Clipping checked first"]}
        title="Free Audio Volume Booster"
        lede="Raise or lower a file's volume by an exact number of decibels. The page reads your file's loudest peak first, so you know before you press go whether the boost will clip."
        tool={<VolumeForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Control",
              value: "Gain from -30 to +30 dB",
              note: "A flat shift. Every sample moves by the same amount, quiet parts and loud parts alike.",
            },
            {
              label: "Before it runs",
              value: "Your file's peak, measured in the browser",
              note: "The form finds the loudest point and tells you how much headroom a given boost leaves, or by how much it would clip.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: "Format, sample rate and channels are left as they are. Uploads are deleted on completion.",
            },
          ]}
        />

        <ToolSection id="scale" title="Why the ceiling is the whole question" bleed>
          <LoudnessScale mode="gain" />
        </ToolSection>

        <ToolSection id="gain-vs-normalize" title="Gain or normalize?" bleed>
          <CompareTable
            columns={["Volume booster, this page", "Loudness normalizer"]}
            highlight={-1}
            rows={[
              {
                label: "What it does",
                cells: [
                  { text: "Adds or subtracts a fixed number of dB you choose" },
                  { text: "Measures the file in LUFS, then moves it to a target" },
                ],
              },
              {
                label: "Good for",
                cells: [
                  { text: "One file that is simply too quiet or too loud" },
                  { text: "Matching several files, or hitting a platform's number" },
                ],
              },
              {
                label: "Clipping",
                cells: [
                  { state: "partial", text: "Possible. The peak reading above tells you before it happens" },
                  { state: "yes", text: "Held below the ceiling by a true-peak limit" },
                ],
              },
              {
                label: "Dynamics",
                cells: [
                  { state: "yes", text: "Untouched. Loud and quiet parts keep their distance" },
                  { state: "partial", text: "Untouched on a single pass unless the target forces limiting" },
                ],
              },
            ]}
            footnote="Rough guide: +6 dB is clearly louder with low clipping risk on most material. +20 and above only makes sense on a file that was recorded very quietly."
          />
          <Prose className="mt-5">
            <p>
              Still quiet after a boost? The peak was already near the ceiling, so the loud parts had nowhere to
              go. That is a dynamics problem, and the <Link href="/loudness-normalizer">Loudness Normalizer</Link>{" "}
              is the tool for it. Background noise gets louder with everything else; run the{" "}
              <Link href="/noise-remove">Noise Remover</Link> first if that is the issue.
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