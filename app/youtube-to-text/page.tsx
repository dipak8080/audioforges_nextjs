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
const PATH = "/youtube-to-text";
const PAGE_TITLE = "Free YouTube Transcript, Even Without Captions";
const OG_IMAGE = ogForTool("youtube-to-text", "YouTube transcript");

const LONG_VIDEO_ROUTE = [
  { href: "/youtube-to-wav", label: "YouTube to WAV", body: "Pull the audio out of the video." },
  { href: "/silence-split", label: "Silence Splitter", body: "Cut it at natural pauses." },
  { href: "/audio-to-text", label: "Audio to Text", body: "Transcribe each part in turn." },
];

export async function generateMetadata(): Promise<Metadata> {
  const { paywallTools } = await getFeatureFlags();
  const description = paywallTools.transcribe
    ? "YouTube transcript from a link, no account or extension. It reads the audio, so it works when captions are off. TXT, SRT or VTT. Free monthly runs."
    : "Free YouTube transcript from a link, no account or extension. It reads the audio, so it works when captions are off. Export TXT, SRT or VTT.";
  return {
    title: PAGE_TITLE,
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

export default async function YouTubeToTextPage() {
  const relatedTools = getRelatedTools("youtube-to-text", 4);
  const [{ paywallTools }, limits, languages] = await Promise.all([
    getFeatureFlags(),
    getLimits(),
    getTranscriptionLanguages().catch(() => null),
  ]);

  const metered = Boolean(paywallTools.transcribe);
  const cost = transcriptionCost(metered);
  const maxLabel = durationLabel(limits.featureDurations.transcription);
  const rateLimit = rateLimitLabel(
    limits.rateLimits.youtube_transcribe ?? 2,
    windowFor(limits, "youtube_transcribe")
  );
  const retention = retentionSentences(limits.retention.transcription);

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "YouTube to Text Transcript Generator",
    alternateName: ["YouTube Transcript Generator", "YouTube to SRT", "YouTube Video to Text"],
    url: `${SITE_URL}${PATH}`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    dateModified: UPDATED,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Transcribe a YouTube video from its link",
      "Works when captions are disabled, by reading the audio",
      `Runs ${TRANSCRIPTION_MODEL} on a GPU`,
      "Automatic language detection or a set language",
      "Translate to English in the same pass",
      "Export as TXT, SRT or VTT",
      "No account and no browser extension",
      `Videos up to ${maxLabel}`,
    ],
  };

  const faqs: FAQItem[] = [
    {
      question: "Can I get a transcript if captions are turned off?",
      answer:
        "Yes. This transcribes the audio itself, so it doesn't need a caption track. Extensions and most transcript sites only read YouTube's existing captions, so they have nothing to show when the creator turns them off.",
    },
    {
      question: "Doesn't YouTube already show a transcript?",
      answer:
        "Often, and when it's there and you only want to read it, that's faster. It falls short when captions are off, when the language isn't auto-captioned, when the auto-captions are wrong, or when you need an SRT file to download.",
    },
    {
      question: "Is it free?",
      answer: `${cost.sentence} TXT, SRT and VTT always download, whether the run was free or paid.`,
    },
    {
      question: "Do I need to download the video or install an extension?",
      answer: "Neither. Paste the link. Nothing is saved to your device and there are no permissions to grant.",
    },
    {
      question: "Does it work with Shorts and youtu.be links?",
      answer:
        "Yes. Watch links, youtu.be links and /shorts URLs all work. Private, deleted and region-blocked videos can't be reached.",
    },
    {
      question: `Can I transcribe a video longer than ${maxLabel}?`,
      answer:
        "Not in one pass. Save the audio with YouTube to WAV, split it at pauses with the Silence Splitter, then transcribe each part. If the video has captions, YouTube's own transcript panel has no length limit.",
    },
    {
      question: "What happens to the video and the transcript?",
      answer: `You send a link, not a file. The audio fetched for the job is deleted as soon as it finishes, whether it worked or not. ${retention.output}`,
    },
    {
      question: "Can I reuse a transcript I make here?",
      answer:
        "That depends on the video and the use. Personal reference, study, accessibility and short quotes are generally fine; republishing someone else's words as your own content is not. You're responsible for how you use it.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "YouTube to Text" }]} />}
        title={metered ? "YouTube transcript, with or without captions" : "Free YouTube transcript, with or without captions"}
        lede="Paste a link and get the words back with timestamps. It reads the audio, so it works when captions are off."
        meta={["No account", "No extension", cost.meta]}
        tool={
          <div className="space-y-5">
            <TranscriptionModeTabs active="/youtube-to-text" />
            <TranscriptionForm mode="youtube" languages={languages} />
          </div>
        }
      >
        <ProofStrip
          proofs={[
            modelProof(),
            { label: "Works on", value: "Videos with captions off", note: "Transcribes the audio, not the caption track." },
            { label: "Price", value: cost.proofValue, note: cost.proofNote },
          ]}
        />

        <ToolSection id="compared" title="Three ways to get a YouTube transcript" bleed>
          <CompareTable
            columns={["AudioForges", "Caption extension", "YouTube's panel"]}
            highlight={0}
            rows={[
              {
                label: "Captions turned off",
                cells: [
                  { state: "yes", text: "Works, reads the audio" },
                  { state: "no", text: "Nothing to read" },
                  { state: "no", text: "No transcript shown" },
                ],
              },
              {
                label: "Download SRT or VTT",
                cells: [
                  { state: "yes", text: "Yes, every run" },
                  { state: "partial", text: "Varies, often paid" },
                  { state: "no", text: "Copy text by hand" },
                ],
              },
              {
                label: "Speed",
                cells: [
                  { state: "partial", text: "Up to about a minute" },
                  { state: "yes", text: "Instant" },
                  { state: "yes", text: "Instant" },
                ],
              },
              {
                label: "Length",
                cells: [
                  { state: "partial", text: `${maxLabel} per video` },
                  { state: "yes", text: "No limit" },
                  { state: "yes", text: "No limit" },
                ],
              },
              {
                label: "Install",
                cells: [
                  { state: "yes", text: "Nothing" },
                  { state: "no", text: "Browser extension" },
                  { state: "yes", text: "Nothing" },
                ],
              },
            ]}
            footnote="Use YouTube's own panel when captions exist and you only need to read them. Use this when they don't, or when you need a file."
          />
        </ToolSection>

        <ToolSection id="exports" title="What you get back" bleed>
          <ExportFormats />
        </ToolSection>

        <ToolSection id="long-videos" title={`Longer than ${maxLabel}?`} bleed>
          <ol className="grid gap-3 sm:grid-cols-3">
            {LONG_VIDEO_ROUTE.map((step, i) => (
              <li key={step.href}>
                <Link
                  href={step.href}
                  prefetch={false}
                  className="block h-full rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
                >
                  <p className="font-mono text-xs text-amber-500">0{i + 1}</p>
                  <p className="mt-1.5 font-medium text-text-primary">{step.label}</p>
                  <p className="mt-1 text-sm text-text-muted">{step.body}</p>
                </Link>
              </li>
            ))}
          </ol>
        </ToolSection>

        <ToolSection id="limits" title="What it won't do" bleed>
          <TranscriptionLimits
            items={[
              ["No playlists or channels", "One video per run."],
              ["No speaker labels", "An interview comes back as one continuous transcript."],
              ["Private or blocked videos", "If the server can't reach the video, there is no audio to work from."],
              ["Limits", `${maxLabel} per video, ${rateLimit}.`],
            ]}
          />
          <Prose className="mt-5">
            <p>
              What hurts a transcript and when to set the language yourself is in the{" "}
              <Link href="/guides/transcribing-audio-accurately">transcription accuracy guide</Link>.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          note={`${TRANSCRIPTION_MODEL}, ${maxLabel} per video, ${rateLimit}`}
          legal="You are responsible for having the right to transcribe and use the videos you submit."
        />
      </ToolPageShell>
    </>
  );
}