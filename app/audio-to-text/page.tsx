import type { Metadata } from "next";
import Link from "next/link";
import { TranscriptionForm } from "@/components/converter/TranscriptionForm";
import { TranscriptionModeTabs } from "@/components/converter/TranscriptionModeTabs";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import {
  ExportFormats,
  LanguageModes,
  NoSpeakerLabels,
  NoisyAudio,
  TranscriptionLimits,
  modelProof,
  transcriptionCost,
} from "@/components/tools/TranscriptionBlocks";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";
import { TRANSCRIPTION_MODEL, getTranscriptionLanguages } from "@/lib/api/transcription";
import { ogForTool } from "@/lib/og";
import { getLimits, windowFor, rateLimitLabel, durationLabel, retentionSentences } from "@/lib/api/limits";

const UPDATED = "2026-09-15";
const PATH = "/audio-to-text";
const PAGE_TITLE = "Transcribe Audio to Text – MP3, WAV & M4A to TXT/SRT";
const OG_IMAGE = ogForTool("audio-to-text", "Audio to text converter");

export async function generateMetadata(): Promise<Metadata> {
  const { paywallTools } = await getFeatureFlags();
  const description = paywallTools.transcribe
    ? "Transcribe audio to text online. MP3, WAV, M4A and FLAC to TXT, SRT or VTT with timestamps. No account, free monthly runs, exports never paywalled."
    : "Transcribe audio to text online. MP3, WAV, M4A and FLAC to TXT, SRT or VTT with timestamps. Free, no account, exports never paywalled.";
  return {
    title: { absolute: PAGE_TITLE },
    description,
    alternates: { canonical: `${SITE_URL}${PATH}` },
    openGraph: {
      title: PAGE_TITLE,
      description,
      url: `${SITE_URL}${PATH}`,
      siteName: SITE_NAME,
      type: "website",
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: PAGE_TITLE, description, images: [OG_IMAGE.url] },
  };
}

export default async function AudioToTextPage() {
  const relatedTools = getRelatedTools("audio-to-text", 4);
  const [{ paywallTools }, limits, languages] = await Promise.all([
    getFeatureFlags(),
    getLimits(),
    getTranscriptionLanguages().catch(() => null),
  ]);

  const metered = Boolean(paywallTools.transcribe);
  const cost = transcriptionCost(metered);
  const audioMb = limits.maxUploadMb;
  const maxLabel = durationLabel(limits.featureDurations.transcription);
  const rateLimit = rateLimitLabel(limits.rateLimits.speech_to_text ?? 2, windowFor(limits, "speech_to_text"));
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, " and $1");
  const retention = retentionSentences(limits.retention.transcription);

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Audio to Text Converter",
    alternateName: ["Transcribe Audio to Text", "Audio Transcription", "MP3 to Text", "Audio to SRT"],
    url: `${SITE_URL}${PATH}`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    dateModified: UPDATED,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      `Transcribe ${formatList}`,
      `Runs ${TRANSCRIPTION_MODEL} on a GPU`,
      "Automatic language detection or a set language",
      "Translate to English in the same pass",
      "Timestamped segments",
      "Export as TXT, SRT or VTT",
      "No account required",
      `Files up to ${maxLabel} and ${audioMb}MB`,
    ],
  };

  const faqs: FAQItem[] = [
    {
      question: "How do I transcribe an audio recording to text?",
      answer: `Upload the file above and download the transcript. It takes ${formatList} up to ${audioMb}MB and ${maxLabel}, and exports TXT, SRT and VTT. No account needed.`,
    },
    {
      question: "Is it free?",
      answer: `${cost.sentence} TXT, SRT and VTT always download, whether the run was free or paid.`,
    },
    {
      question: "How long does it take?",
      answer:
        "Usually under a minute. The first run after a quiet spell spends about a minute starting the GPU, so a short memo and a 10-minute podcast can take similar time. Once warm, most files come back in seconds.",
    },
    {
      question: "How accurate is it?",
      answer:
        "It depends more on the recording than on the tool. One clear voice near a microphone comes back close to perfect; a phone across a meeting table will not. No accuracy percentage is published because one number across every language and room would mean nothing.",
    },
    {
      question: "Do I have to pick the language?",
      answer:
        "No, it is detected from the opening seconds. Set it yourself for clips under about thirty seconds, strong accents, or audio that switches language.",
    },
    {
      question: "Can I get an English transcript of another language?",
      answer: "Yes. Choose English output and it translates while it transcribes, in one pass. English is the only target.",
    },
    {
      question: "Are my files kept?",
      answer: `${retention.input} ${retention.output} Nothing is linked to an account.`,
    },
    {
      question: `Can I transcribe something longer than ${maxLabel}?`,
      answer:
        "Not in one pass. Split it at natural pauses with the Silence Splitter, then transcribe each part.",
      answerNode: (
        <>
          Not in one pass. Split it at natural pauses with the{" "}
          <Link href="/silence-split" prefetch={false} className="text-amber-400 hover:underline">
            Silence Splitter
          </Link>
          , then transcribe each part.
        </>
      ),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio to Text" }]} />}
        title="Transcribe audio to text"
        lede="Upload an MP3, WAV, M4A or FLAC and get the words back with timestamps. Nothing to install, no account."
        meta={["No account", "TXT · SRT · VTT", cost.meta]}
        tool={
          <div className="space-y-5">
            <TranscriptionModeTabs active="/audio-to-text" />
            <TranscriptionForm mode="audio" languages={languages} />
          </div>
        }
      >
        <ProofStrip
          proofs={[
            modelProof(),
            { label: "Exports", value: "TXT, SRT and VTT", note: "Timestamped. All three download on every run." },
            { label: "Price", value: cost.proofValue, note: cost.proofNote },
          ]}
        />

        <ToolSection id="exports" title="What you get back" bleed>
          <ExportFormats />
        </ToolSection>

        <ToolSection id="languages" title="Auto-detect, or tell it the language" bleed>
          <Prose className="mb-5">
            <p>
              Detection reads the opening seconds, so it slips in predictable places: very short clips, and recordings
              that start in one language and switch. Setting the language removes the guess and costs nothing extra.
            </p>
          </Prose>
          <LanguageModes />
        </ToolSection>

        <ToolSection id="compared" title="How it compares with typical free tools" bleed>
          <CompareTable
            columns={["AudioForges", "Typical free tool"]}
            highlight={0}
            rows={[
              {
                label: "Account",
                cells: [
                  { state: "yes", text: "Never needed" },
                  { state: "no", text: "Email asked for after the first file" },
                ],
              },
              {
                label: "Downloading the result",
                cells: [
                  { state: "yes", text: "TXT, SRT and VTT on every run" },
                  { state: "no", text: "Export is the paid feature" },
                ],
              },
              {
                label: "Model",
                cells: [
                  { state: "yes", text: TRANSCRIPTION_MODEL, mono: true },
                  { state: "unknown", text: "\"Advanced AI\" and an accuracy percentage" },
                ],
              },
              {
                label: "Limits",
                cells: [
                  { state: "yes", text: `${maxLabel} per file, ${rateLimit}`, sub: "stated before you upload" },
                  { state: "partial", text: "Found when you hit them" },
                ],
              },
              {
                label: "Paying",
                cells: [
                  { text: metered ? "Free monthly runs, then 1 credit. No subscription" : "Free" },
                  { text: "Monthly subscription" },
                ],
              },
            ]}
            footnote="A pattern across the category, not a claim about any one tool."
          />
          <p className="mt-4 text-sm leading-relaxed text-text-muted">
            More on how free usually works, and what to check before uploading anywhere:{" "}
            <Link href="/free-transcription-no-sign-up" prefetch={false} className="text-amber-400 hover:underline">
              free transcription without signing up
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="limits" title="What it won't do" bleed>
          <TranscriptionLimits
            items={[
              ["No speaker labels", <NoSpeakerLabels key="s" />],
              ["No editor", "You get the transcript and the files. Corrections happen wherever you paste it."],
              [`${maxLabel} per file`, `Split longer recordings first. Uploads up to ${audioMb}MB.`],
              ["Noisy audio stays noisy", <NoisyAudio key="n" />],
            ]}
          />
          <Prose className="mt-5">
            <p>
              The longer version, with what hurts accuracy and how to handle long recordings, is in the{" "}
              <Link href="/guides/transcribing-audio-accurately">transcription accuracy guide</Link>.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline updated={UPDATED} note={`${TRANSCRIPTION_MODEL}, ${maxLabel} per file, ${rateLimit}`} />
      </ToolPageShell>
    </>
  );
}