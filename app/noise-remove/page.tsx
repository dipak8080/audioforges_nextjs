import type { Metadata } from "next";
import Link from "next/link";
import { NoiseRemoveForm } from "@/components/converter/NoiseRemoveForm";
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

/*
  TITLE. Bing Keyword Research, three months to 30 Aug 2026:

    noise cancellation            10.8K   NOT ours — headphone/ANC intent
    background noise remover       2.3K
    audio cleaner                  2.3K
    noise reduction                1.5K
    noise remover                  1.2K   (contained in the term above)
    remove background noise from audio  911
    noise reducer                   780
    background sound remover        612
    remove background noise         586
    background noise remover free   538

  "Background Noise Remover" already contains "noise remover" as adjacent
  words, so the head term costs nothing extra. Adding "Noise Reduction" picks
  up 1.5K more. "Denoise Any Audio File" was replaced because nobody searches
  "denoise" — it is engineer vocabulary, like LUFS on /loudness-normalizer.

  WORTH KNOWING BEFORE INVESTING HERE: the top 10 contains three exact-match
  domains — noise-remover.com, noiseremover.net, noise-reducer.com — plus
  LALAL.AI. EMDs are hard to beat on their own term, and this whole cluster is
  under ~10K excluding the ANC noise. Low priority compared with the converter
  pages.
*/
const PAGE_TITLE = "Background Noise Remover – Free Audio Noise Reduction";
const PAGE_DESCRIPTION =
  "Free background noise remover. Remove hiss, hum, fan noise and static from MP3, WAV, FLAC and more — online, no sign-up, no watermark.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("noise-remove", "Free Background Noise Remover");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/noise-remove` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/noise-remove`,
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
  name: "Background Noise Remover",
  // No "AI Noise Remover" — this is an FFT denoiser, not a model, and every
  // competitor in this SERP leads with "AI". Same rule as /echo-remove.
  alternateName: [
    "Background Noise Remover",
    "Noise Remover",
    "Audio Noise Reduction",
    "Noise Reducer",
    "Audio Cleaner",
  ],
  url: `${SITE_URL}/noise-remove`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Adjustable noise reduction strength",
    "Works on music or speech",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Every figure comes from /limits. The hand-written version said "up to 80MB
// and 20 minutes" — size right, length wrong by forty minutes. That sentence
// was true on the transcription guide and got copied into six pages where it
// wasn't.
export default async function NoiseRemovePage() {
  const relatedTools = getRelatedTools("noise-remove", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "noise-remove");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What kind of noise does this remove?",
      answer:
        "Background hiss, hum, and static via an FFT-based denoiser. It's general-purpose, suitable for both music and speech.",
    },
    {
      question: "Does noise reduction affect audio quality?",
      answer:
        "At moderate strength, quality impact is minimal. Pushed too aggressively, it can introduce a warbling artifact by cutting into frequencies the wanted audio actually needs. Start at the default strength and only raise it if noise is still clearly audible.",
    },
    {
      question: "Should I use this or the Voice Cleaner for a podcast?",
      answer:
        "For speech-only recordings, the Voice Cleaner's fixed speech-tuned preset (rumble cut, denoise, loudness normalize) generally works better. Use this tool when you want direct control over reduction strength, or for music and non-speech audio.",
    },
    {
      question: "What formats are supported, and is there a size limit?",
      answer:
        durationCap === null
          ? `${formatList}, up to ${limits.maxUploadMb}MB per upload.`
          : `${formatList}, up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Should I denoise before or after boosting volume?",
      answer:
        "Denoise first, then boost volume. Boosting first raises the noise right along with everything else, which just means the denoiser has more to remove, cleaning it up before adjusting levels gives a clearer result.",
    },
  ];
  const limitLabel =
    durationCap === null ? `${limits.maxUploadMb}MB per upload` : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Noise Remover" }]} />}
        meta={["No account", "Strength you control", "Not an AI model, and says so"]}
        title="Free Background Noise Remover"
        lede="Take hiss, hum and steady background noise out of a recording, with a strength slider that tells you when you are pushing it too far. Free, no sign-up."
        tool={<NoiseRemoveForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "What it is",
              value: "ffmpeg noise reduction, not a neural model",
              note: "Good at steady noise: hiss, hum, fan, room tone. It cannot separate a voice from another voice or from music.",
            },
            {
              label: "Control",
              value: "Strength 1 to 97, default 12",
              note: "The slider warns as you enter the range where the wanted audio starts to warble. Raise it only if noise is still audible.",
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
                label: "Noise Remover, this page",
                cells: [
                  { text: "Hiss, hum, fan, traffic, on any audio" },
                  { state: "yes", text: "Denoise only, with a strength slider from 1 to 97" },
                ],
              },
              {
                label: "Voice Cleaner",
                cells: [
                  { text: "Speech: podcasts, interviews, voice memos" },
                  { state: "partial", text: "Fixed chain, no settings: rumble cut, speech-tuned denoise, loudness normalize" },
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
            footnote="Steady noise is the easy case for all three. Intermittent noise, crosstalk and music under speech are the hard cases, and none of these tools claims them."
          />
          <Prose className="mt-5">
            <p>
              Speech only, and you would rather not think about a slider? <Link href="/voice-clean">Voice Cleaner</Link>{" "}
              runs a fixed chain built for that. Echo rather than noise?{" "}
              <Link href="/echo-remove">Echo Remover</Link>.
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