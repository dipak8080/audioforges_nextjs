import type { Metadata } from "next";
import Link from "next/link";
import { VoiceCleanForm } from "@/components/converter/VoiceCleanForm";
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
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

const PAGE_TITLE = "Voice Cleaner – Clean Up Podcasts & Memos";
const PAGE_DESCRIPTION =
  "Clean voice recordings online free. Remove background noise, hiss, hum, and low-frequency rumble from podcasts, interviews, and voice memos. No sign-up.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("voice-clean", "Free Voice Cleaner");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/voice-clean` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/voice-clean`,
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
  name: "Voice Cleaner",
  url: `${SITE_URL}/voice-clean`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Rumble/low-end cut",
    "Speech-tuned denoise",
    "Loudness normalization",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

/**
 * Every figure comes from /limits. The hand-written sentence here said "up to
 * 80MB and 20 minutes" — the real cap is an hour, and this is the page where
 * the understatement cost most: the audience is podcasts, interviews and
 * lectures, which is exactly the material that runs past twenty minutes.
 */
export default async function VoiceCleanPage() {
  const relatedTools = getRelatedTools("voice-clean", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "voice-clean");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  // Includes "Will it reduce audio quality?", which used to exist in the schema
  // but was missing from the visible accordion — a real schema/content
  // mismatch. Both are fed from this one array now.
  const faqs = [
    {
      question: "Does it work on Zoom recordings or phone recordings?",
      answer:
        "Yes, any speech-only recording works, including calls, Zoom recordings, phone memos, and narration, since the chain is tuned for the voice frequency range generally, not one specific recording method.",
    },
    {
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per upload.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long, enough for a full podcast episode or lecture recording in one pass.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Will it change my voice?",
      answer:
        "No. It only affects background noise and loudness, it doesn't alter pitch, formants, or anything about how your voice actually sounds.",
    },
    {
      question: "Does it remove keyboard clicks or mouse clicks?",
      answer:
        "Not reliably. This chain is built for steady background noise like hiss, hum, and rumble, short, one-off sounds like keyboard clicks don't have a consistent noise profile for it to remove, so some may still come through.",
    },
    {
      question: "Can it remove breathing sounds?",
      answer:
        "Not specifically, breaths are close enough to speech frequencies that a general noise-reduction chain isn't built to isolate and remove them the way it removes steady background hiss or hum.",
    },
    {
      question: "Will it reduce audio quality?",
      answer:
        "No, it removes noise and evens out loudness without discarding quality from the rest of the recording.",
    },
  ];
  const limitLabel =
    durationCap === null ? `${limits.maxUploadMb}MB per upload` : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Voice Cleaner" }]} />}
        meta={["No account", "One click, no settings", "Speech only"]}
        title="Free Voice Cleaner"
        lede="One pass for a podcast, interview or voice memo: rumble cut, speech-tuned denoise, then loudness normalized. Nothing to configure. Free, no sign-up."
        tool={<VoiceCleanForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "The chain",
              value: "Rumble cut, denoise, normalize",
              note: "Three fixed stages in one run. Low rumble and handling noise go first, then steady noise, then the level is brought to a spoken-word target.",
            },
            {
              label: "Scope",
              value: "Built for speech, not music",
              note: "The denoise is tuned to a voice. Run music through it and the settings are wrong for the material; use the Noise Remover instead.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. Output keeps your format. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="which" title="Which cleaner for which problem" bleed>
          <CompareTable
            columns={["Best for", "What it actually does"]}
            highlight={-1}
            rows={[
              {
                label: "Noise Remover",
                cells: [
                  { text: "Hiss, hum, fan, traffic, on any audio" },
                  { state: "partial", text: "Denoise only, with a strength slider from 1 to 97" },
                ],
              },
              {
                label: "Voice Cleaner, this page",
                cells: [
                  { text: "Speech: podcasts, interviews, voice memos" },
                  { state: "yes", text: "Fixed chain, no settings: rumble cut, speech-tuned denoise, loudness normalize" },
                ],
              },
              {
                label: "Echo Remover",
                cells: [
                  { text: "Slap-back and mild room echo" },
                  { state: "partial", text: "Gates trailing reflections. Not a dereverb model; heavy room reverb stays" },
                ],
              },
            ]}
            footnote="Echo and reverb are a different problem from noise; this chain does not touch them. Crosstalk and music under speech are not handled by any of the three."
          />
          <Prose className="mt-5">
            <p>
              Want control over how hard the denoise works? <Link href="/noise-remove">Noise Remover</Link> has the
              slider. Room echo? <Link href="/echo-remove">Echo Remover</Link>. Once it is clean,{" "}
              <Link href="/audio-to-text">Audio to Text</Link> transcribes it, and clean input is what makes that
              accurate.
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