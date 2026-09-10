import type { Metadata } from "next";
import Link from "next/link";
import { ChannelsForm } from "@/components/converter/ChannelsForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { ChannelDiagram } from "@/components/tools/ChannelDiagram";
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
  TITLE. Volumes NOT pulled from Bing Keyword Research yet — verify and record
  them: stereo to mono · stereo to mono converter · mono to stereo ·
  convert stereo to mono · make audio mono.

  What IS measured: a crawl of the live SERP (Sep 2026) — notevibes.com,
  onaircode.com, elysiatools.com, wutools.com, nuttertools.dev, plus the
  Wondershare and MiniTool listicles. Three findings.

  1. THE OLD TITLE DID NOT CONTAIN THE PHRASE. "Audio to Stereo & Mono
     Converter" has "Stereo & Mono", not "stereo to mono" — and every single
     competing result titles on "Stereo to Mono Converter". The head phrase
     was simply absent.

  2. Notevibes runs TWO pages, /stereo-to-mono-converter and
     /mono-to-stereo-converter, treating the directions as separate intents.
     Worth considering if this page ever earns impressions: they are different
     jobs (downmix vs duplicate) with different reasons behind them. Not split
     yet — one page with no traffic should not become two.

  3. Client-side, again. "No upload", "processes locally", "100% in-browser
     via FFmpeg.wasm" — the same axis /fade loses on. A channel downmix is
     (L+R)/2, trivially doable in Web Audio. See the note on /fade.
*/
const PAGE_TITLE = "Stereo to Mono Converter – Free, Also Mono to Stereo";
const PAGE_DESCRIPTION =
  "Free online stereo to mono converter. Downmix stereo to a single channel, or duplicate mono to stereo — no sign-up, no watermark, no software to install.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("mono-stereo-converter", "Free mono & stereo converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/mono-stereo-converter` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/mono-stereo-converter`,
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

// Every claim below is checked against actual ChannelsForm/backend behaviour.
// No accuracy, performance or file-size-reduction claims — encoding settings
// and format affect size.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Stereo to Mono Converter",
  alternateName: [
    "Stereo to Mono Converter",
    "Mono to Stereo Converter",
    "Audio Channel Converter",
    "Mono Downmix Tool",
  ],
  url: `${SITE_URL}/mono-stereo-converter`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert stereo to mono",
    "Convert mono to stereo",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.


export default async function MonoStereoConverterPage() {
  const relatedTools = getRelatedTools("mono-stereo-converter", 5);
  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "mono-stereo-converter");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");
  const limitLabel =
    durationCap === null
      ? `${limits.maxUploadMb}MB per upload`
      : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  const faqs = [
    {
      question: "Does mono to stereo create real stereo?",
      answer:
        "No. It duplicates the identical mono signal onto both channels rather than inventing new left/right content. It satisfies a two-channel requirement, but there's no actual stereo width or separation, since there was nothing to separate in the mono source.",
    },
    {
      question: "Is mono better for voice recordings?",
      answer:
        "Often, yes — a single voice usually doesn't benefit from stereo width, and many phone systems, IVR platforms, and podcast hosts expect or prefer single-channel audio for spoken content.",
    },
    {
      question: "Does converting stereo to mono lose left/right information?",
      answer:
        "Yes — combining two channels into one is a real change. Any separation between the left and right channels in the original is gone in the mono result; the audio isn't damaged, but it's a genuinely different listening experience from the stereo original.",
    },
    {
      question: "Does this conversion affect audio quality?",
      answer:
        "It changes channel count, not fidelity — but stereo-to-mono is not a lossless no-op, since it genuinely discards the left/right separation that existed. Mono-to-stereo doesn't lose anything, since it's only duplicating what's already there.",
    },
    {
      question: "Will converting to mono make my file smaller?",
      answer:
        "Often, since there's less channel data to store, but the exact difference depends on the output format and encoding settings rather than being a fixed, guaranteed reduction.",
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `${limits.maxUploadMb}MB per upload, with no length limit.`
          : `${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio.`,
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
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Mono / Stereo Converter" }]} />}
        meta={["No account", "Both directions", "Honest about width"]}
        title="Stereo to Mono Converter"
        lede="Fold a stereo file to one channel, or copy a mono file to two. Free, no sign-up, and clear about what each direction does to the sound."
        tool={<ChannelsForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Stereo to mono",
              value: "Left and right combined into one",
              note: "Panning and width are gone for good. Check a mix this way before a client plays it on a phone speaker.",
            },
            {
              label: "Mono to stereo",
              value: "One channel, copied to both",
              note: "Satisfies a two-channel requirement. Sounds identical. No width is invented, because there is none to find.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. Sample rate and bit depth are left alone; only the channel count changes.`,
            },
          ]}
        />

        <ToolSection id="what-happens" title="What each direction actually does" bleed>
          <ChannelDiagram />
        </ToolSection>

        <ToolSection id="when" title="Which way, and why" bleed>
          <CompareTable
            columns={["Stereo to mono", "Mono to stereo"]}
            highlight={-1}
            rows={[
              {
                label: "The job",
                cells: [
                  { text: "Phone systems, IVR prompts, some podcast hosts, and any single voice that never used the width" },
                  { text: "A platform or player that refuses single-channel files, or a template that expects two" },
                ],
              },
              {
                label: "What changes in the sound",
                cells: [
                  { state: "partial", text: "Panning and stereo effects collapse. Out-of-phase content partly cancels" },
                  { state: "yes", text: "Nothing. Same audio, twice" },
                ],
              },
              {
                label: "File size",
                cells: [
                  { text: "Roughly halves for WAV and AIFF. Compressed formats shrink less" },
                  { text: "Roughly doubles for WAV and AIFF" },
                ],
              },
              {
                label: "Reversible",
                cells: [
                  { state: "no", text: "No. Keep the stereo original" },
                  { state: "yes", text: "Yes, fold it straight back" },
                ],
              },
            ]}
            footnote="Want actual stereo from a mono mix? That is a separation job, not a channel job. The Vocal Remover and Stem Splitter pull a mix apart so you can place the parts yourself."
          />
          <Prose className="mt-5">
            <p>
              Summing to mono yourself, before a transfer or an upload, beats letting a platform do it silently on
              the way in: you hear what collapsed and can fix the mix first.{" "}
              <Link href="/vocal-remover">Vocal Remover</Link> and <Link href="/stems">Stem Splitter</Link> are the
              tools for building width from a source that never had it.
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