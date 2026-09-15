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
  NoSpeakerLabels,
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
const PATH = "/video-to-text";
const PAGE_TITLE = "Transcribe Video to Text Free, MP4 to SRT";
const OG_IMAGE = ogForTool("video-to-text", "Video to text and SRT");

const SUBTITLE_TARGETS: Array<[string, string, string]> = [
  ["YouTube", "Studio > Subtitles > Add > Upload file > With timing", "SRT"],
  ["Premiere Pro", "File > Import, then drag the caption track onto the timeline", "SRT"],
  ["DaVinci Resolve", "Right-click the media pool > Import Subtitle", "SRT"],
  ["Final Cut Pro", "File > Import > Captions", "SRT"],
  ["CapCut", "Captions > Import captions", "SRT"],
  ["Kdenlive", "Project > Subtitles > Import Subtitle File", "SRT"],
  ["Vimeo", "Video settings > Distribution > Subtitles > Upload", "SRT or VTT"],
  ["VLC", "Keep the .srt next to the video with the same filename", "SRT"],
  ["Your own site", "<track kind=\"captions\" src=\"...\"> inside the <video> element", "VTT"],
];

const FFMPEG_RECIPES = [
  {
    goal: "Attach captions as a track viewers can switch off",
    when: "Any player that supports subtitle tracks. Finishes in seconds and loses nothing.",
    command: "ffmpeg -i video.mp4 -i captions.srt -c copy -c:s mov_text output.mp4",
    note: "mov_text is for MP4. For MKV, use -c:s srt.",
  },
  {
    goal: "Burn captions into the picture",
    when: "Instagram, TikTok, LinkedIn: anywhere captions can't be a separate file.",
    command: "ffmpeg -i video.mp4 -vf subtitles=captions.srt -c:a copy output.mp4",
    note: "Re-encodes the video, so it is slower and costs a little quality.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const { paywallTools } = await getFeatureFlags();
  const description = paywallTools.transcribe
    ? "Transcribe MP4, MOV, MKV or WEBM to text. No account, no watermark. Export SRT or VTT subtitles. Free monthly runs, exports never paywalled."
    : "Transcribe MP4, MOV, MKV or WEBM to text free. No account, no watermark. Export SRT or VTT subtitles, never paywalled.";
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

export default async function VideoToTextPage() {
  const relatedTools = getRelatedTools("video-to-text", 4);
  const [{ paywallTools }, limits, languages] = await Promise.all([
    getFeatureFlags(),
    getLimits(),
    getTranscriptionLanguages().catch(() => null),
  ]);

  const metered = Boolean(paywallTools.transcribe);
  const cost = transcriptionCost(metered);
  const videoMb = limits.maxVideoTranscribeMb;
  const maxLabel = durationLabel(limits.featureDurations.transcription);
  const rateLimit = rateLimitLabel(limits.rateLimits.video_to_text ?? 2, windowFor(limits, "video_to_text"));
  const formats = limits.allowedVideoFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, " and $1");
  const retention = retentionSentences(limits.retention.transcription);

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Video to Text Converter",
    alternateName: ["Video Transcription", "MP4 to Text", "MP4 to SRT", "Video Subtitle Generator"],
    url: `${SITE_URL}${PATH}`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    dateModified: UPDATED,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      `Transcribe ${formatList}`,
      `Runs ${TRANSCRIPTION_MODEL} on a GPU`,
      "No audio extraction step",
      "Export as TXT, SRT or VTT subtitles",
      "No account and no watermark",
      `Videos up to ${maxLabel} and ${videoMb}MB`,
    ],
  };

  const faqs: FAQItem[] = [
    {
      question: "How do I turn a video into text or subtitles?",
      answer: `Upload the video above and download the transcript as TXT, SRT or VTT. It takes ${formatList} up to ${videoMb}MB and ${maxLabel}. No account needed.`,
    },
    {
      question: "Is it free?",
      answer: `${cost.sentence} Subtitle files always download, whether the run was free or paid.`,
    },
    {
      question: "Do I need to extract the audio first?",
      answer: "No. Upload the video as it is. The audio is pulled out on the server before transcription.",
    },
    {
      question: "SRT or VTT, which do I need?",
      answer:
        "SRT for video editors, YouTube and most upload forms. VTT for video on your own website. If an editor accepts the file but shows nothing, try the other one.",
    },
    {
      question: "Can it burn captions into the video?",
      answer:
        "No, it returns subtitle files, not video. The two ffmpeg commands on this page attach or burn them in yourself.",
    },
    {
      question: "Can I edit the subtitles?",
      answer:
        "Not here. SRT and VTT are plain text, so any text editor works for a quick fix, and every video editor listed above lets you adjust them after import.",
    },
    {
      question: "Are my videos kept?",
      answer: `${retention.input} ${retention.output} Nothing is linked to an account.`,
    },
    {
      question: "How accurate is it?",
      answer: `It runs ${TRANSCRIPTION_MODEL}. A lapel mic in a quiet room comes back close to perfect; a phone across a meeting room won't. No accuracy percentage is published because one number across every recording would mean nothing.`,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Video to Text" }]} />}
        title={metered ? "Transcribe video to text and subtitles" : "Transcribe video to text free"}
        lede="Upload an MP4, MOV or MKV and get a transcript plus SRT and VTT subtitle files. No audio extraction, no watermark."
        meta={["No account", "SRT · VTT", cost.meta]}
        tool={
          <div className="space-y-5">
            <TranscriptionModeTabs active="/video-to-text" />
            <TranscriptionForm mode="video" languages={languages} />
          </div>
        }
      >
        <ProofStrip
          proofs={[
            modelProof(),
            { label: "Subtitles", value: "SRT and VTT on every run", note: "No watermark, because there is no video output." },
            { label: "Price", value: cost.proofValue, note: cost.proofNote },
          ]}
        />

        <ToolSection id="exports" title="What you get back" bleed>
          <ExportFormats />
        </ToolSection>

        <ToolSection id="where-it-goes" title="Where the subtitle file goes" bleed>
          <CompareTable
            columns={["How to add it", "Use"]}
            highlight={-1}
            gridClass="sm:grid-cols-[minmax(7rem,0.9fr)_2.4fr_minmax(5rem,0.6fr)]"
            rows={SUBTITLE_TARGETS.map(([app, how, format]) => ({
              label: app,
              cells: [{ text: how }, { text: format, mono: true }],
            }))}
            footnote={`Menu paths checked ${UPDATED}. Apps move them now and then.`}
          />
          <Prose className="mt-5">
            <p>
              On YouTube, uploading your own file beats auto-captions. The uploaded track is what gets indexed, and it
              keeps names and jargon right.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="ffmpeg" title="Captions inside the video, with ffmpeg" bleed>
          <Prose className="mb-5">
            <p>
              Most caption tools charge for a captioned video. It is one command. Put the video and the .srt in the
              same folder and run the one you need.
            </p>
          </Prose>
          <div className="space-y-4">
            {FFMPEG_RECIPES.map((r) => (
              <div key={r.goal} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{r.goal}</p>
                <p className="mt-1 text-sm text-text-muted">{r.when}</p>
                <pre className="scrollbar-thin mt-3 overflow-x-auto rounded-lg border border-graphite-700 bg-graphite-950 p-3">
                  <code className="font-mono text-[13px] text-text-primary">{r.command}</code>
                </pre>
                <p className="mt-2 text-xs text-text-subtle">{r.note}</p>
              </div>
            ))}
          </div>
        </ToolSection>

        <ToolSection id="limits" title="What it won't do" bleed>
          <TranscriptionLimits
            items={[
              ["No captioned video", "You get subtitle files. Use the ffmpeg commands above to add them."],
              ["No speaker labels", <NoSpeakerLabels key="s" />],
              ["No editor", "Fix wording in any text editor or in your video editor after import."],
              ["Limits", `${maxLabel} and ${videoMb}MB per video, ${rateLimit}.`],
            ]}
          />
          <Prose className="mt-5">
            <p>
              Only need the audio track? <Link href="/video-to-audio">Video to Audio</Link> extracts it without
              transcribing.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline updated={UPDATED} note={`${TRANSCRIPTION_MODEL}, ${maxLabel} and ${videoMb}MB per video`} />
      </ToolPageShell>
    </>
  );
}