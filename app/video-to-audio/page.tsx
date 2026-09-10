import type { Metadata } from "next";
import Link from "next/link";
import { VideoToAudioForm } from "@/components/converter/VideoToAudioForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { DemuxDiagram } from "@/components/tools/DemuxDiagram";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, durationLabel, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/*
  General MP4→MP3 / video→audio hub. Targets: mp4 to mp3 (169K), video to mp3
  (34.9K), mov to mp3, mov to wav, video to audio. "mp4 to wav" is owned by the
  dedicated /mp4-to-wav page — this page does NOT target that phrase in title,
  OG, schema, FAQ or section headings, so the two don't self-compete. The only
  mp4→wav mention here is a single pointer link to the canonical page.
  WAV-path claims describe pcm_s16le only; don't broaden them without checking
  the ffmpeg command. absolute title so " | AudioForges" isn't appended.
*/
const PAGE_TITLE = "MP4 to MP3 Converter – Online Video to MP3";
const PAGE_DESCRIPTION =
  "Convert MP4 to MP3 free, or extract audio as M4A, WAV, FLAC, AAC, OGG or AIFF. Also handles MOV to MP3, MOV to WAV, MKV and WebM. No sign-up.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("video-to-audio", "Free MP4 to MP3 converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/video-to-audio` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/video-to-audio`,
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

// FAQPage comes from <FAQSection />, BreadcrumbList from <Breadcrumb />.

// mp4→wav removed — that pair is /mp4-to-wav's. mov→wav / avi→wav stay.

// 16-bit PCM, decimal MB. Backend passes -c:a pcm_s16le with no -ar/-ac, so
// rate and channels come from the source. Computed, not typed.
const pcmMegabytes = (sampleRate: number, channels: number, seconds: number) =>
  (sampleRate * 2 * channels * seconds) / 1e6;

const WAV_SIZE_SOURCES = [
  { label: "48 kHz stereo", rate: 48000, channels: 2 },
  { label: "44.1 kHz stereo", rate: 44100, channels: 2 },
  { label: "48 kHz mono", rate: 48000, channels: 1 },
  { label: "44.1 kHz mono", rate: 44100, channels: 1 },
];


export default async function VideoToAudioPage() {
  const relatedTools = getRelatedTools("video-to-audio", 5);

  const limits = await getLimits();

  // max_video_upload_mb (200), not max_upload_mb or max_video_transcribe_mb.
  const maxUploadMb = limits.maxVideoUploadMb;
  const maxSeconds = limits.durations.videoExtractMaxSeconds;
  const maxDurationLabel = durationLabel(maxSeconds);

  const audioFormats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const audioFormatList = audioFormats.join(", ").replace(/, ([^,]*)$/, ", or $1");
  const videoFormats = limits.allowedVideoFormats.map((f) => f.toUpperCase());
  const videoFormatList = videoFormats.join(", ").replace(/, ([^,]*)$/, ", and $1");

  const wavSizeTable = WAV_SIZE_SOURCES.map((s) => ({
    source: s.label,
    perMinute: `${pcmMegabytes(s.rate, s.channels, 60).toFixed(1)} MB`,
    tenMinutes: `${Math.round(pcmMegabytes(s.rate, s.channels, 600))} MB`,
  }));

  const retention = retentionSentences(limits.retention.audio_tools);

  // Checked against: ffmpeg -y -i <input> -vn -map 0:a:0 -c:a pcm_s16le <out>.wav
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MP4 to MP3 & Video to Audio Converter",
    alternateName: [
      "MP4 to MP3 Converter",
      "Video to MP3 Converter",
      "MOV to MP3 Converter",
      "MOV to WAV Converter",
      "Video to Audio Converter",
    ],
    url: `${SITE_URL}/video-to-audio`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Convert MP4 to MP3",
      "Convert MOV to MP3",
      "Convert MOV to WAV",
      `Extract audio from ${videoFormats.slice(0, 5).join(", ")}, and more`,
      `Output as ${audioFormatList}`,
      "16-bit PCM WAV output at the source sample rate",
      "Direct audio extraction for compatible M4A/AAC sources",
      "No sign-up required",
      "No watermark",
    ],
  };

  const faqs = [
    {
      question: "What sample rate and bit depth is the WAV output?",
      answer:
        "WAV output is 16-bit PCM. The sample rate and channel count come from the source video and aren't changed, a 48 kHz stereo source gives a 48 kHz stereo WAV. There's no resampling and no downmix to mono.",
    },
    {
      question: "How big will the extracted WAV file be?",
      answer: `Roughly ${wavSizeTable[0].perMinute} per minute for 48 kHz stereo audio, or ${wavSizeTable[1].perMinute} per minute at 44.1 kHz. Mono sources are about half that. A 10-minute video produces a WAV of roughly ${wavSizeTable[1].tenMinutes} to ${wavSizeTable[0].tenMinutes}, which is often larger than the source video itself.`,
    },
    {
      question: "My video has multiple audio tracks, which one is extracted?",
      answer:
        "The first audio track in the file. Videos with alternate language tracks or separate microphone channels will produce only that first track; there's no track selector at the moment.",
    },
    {
      question: "Why is M4A/AAC output faster than MP3 or WAV?",
      answer:
        "When the video's audio is already encoded as AAC, extracting it to a compatible M4A or AAC output can copy the existing audio stream without re-encoding. MP3, WAV, FLAC, OGG, and AIFF output generally requires decoding and processing the audio into the new format, which takes additional time.",
    },
    {
      question: "Does choosing WAV or FLAC give me better quality than M4A?",
      answer:
        "No, if the source video's audio is AAC, it's already lossy. Converting that audio to a lossless container such as WAV or FLAC can't recover detail that was already discarded. It only produces a larger file. Lossless output is most useful when the original audio was itself lossless.",
    },
    {
      question: "What's the maximum video file size and length?",
      answer: `Up to ${maxUploadMb}MB per upload, and up to ${maxDurationLabel} of video.`,
    },
    {
      question: "Does the converter work on iPhone videos and screen recordings?",
      answer:
        "Yes, iPhone videos are usually .mov or .mp4, and both are supported, as are Mac and Windows screen recordings. The file needs to contain an audio track; a silent recording can't produce an extracted audio file.",
    },
    {
      question: "Are my uploaded videos kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you, published, or shared.`,
    },
    {
      question: "Can I get a transcript from my video without converting it first?",
      answer:
        "Yes, Video to Text takes MP4, MOV, MKV and WEBM directly and returns a transcript with timestamps, plus SRT or VTT subtitle export. Use this converter when you want the audio file itself; use that one when text is all you're after.",
      answerNode: (
        <>
          Yes.{" "}
          <Link href="/video-to-text" prefetch={false} className="text-amber-400 hover:underline">
            Video to Text
          </Link>{" "}
          takes MP4, MOV, MKV and WEBM directly and returns a transcript with
          timestamps, plus SRT or VTT subtitle export. Use this converter when you
          want the audio file itself; use that one when text is all you&apos;re
          after.
        </>
      ),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Video to Audio" }]} />}
        meta={["No account", videoFormatList, "Seven output formats"]}
        title="MP4 to MP3 Converter"
        lede="Pull the audio out of any video as MP3, M4A, WAV, FLAC, AAC, OGG or AIFF. iPhone MOV files and screen recordings included. Free, no sign-up."
        tool={<VideoToAudioForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Fastest path",
              value: "M4A is a stream copy",
              note: "When the video already carries AAC, the audio is lifted out without re-encoding. Seconds, and no quality lost.",
            },
            {
              label: "Lossless path",
              value: "WAV at the source rate",
              note: "16-bit PCM, no resampling, no downmix. Bigger, not better: it cannot recover what the video's codec discarded.",
            },
            {
              label: "Limits",
              value: `${maxUploadMb}MB, ${maxDurationLabel}`,
              note: `Accepts ${videoFormatList}. Refused before upload, not after, and deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="what-happens" title="What is kept, and what is dropped" bleed>
          <DemuxDiagram containerLabel="MP4 / MOV / MKV" audioCodec="AAC" />
        </ToolSection>

        <ToolSection id="which-format" title="Which output to pick" bleed>
          <CompareTable
            columns={["Pick it for", "What happens to the audio"]}
            highlight={-1}
            rows={[
              {
                label: "M4A / AAC",
                cells: [
                  { text: "Listening, sharing, the fastest result" },
                  { state: "yes", text: "Copied out as is when the source is AAC. No re-encode, no loss" },
                ],
              },
              {
                label: "MP3",
                cells: [
                  { text: "Anything that only plays MP3: car stereos, old players" },
                  { state: "partial", text: "Decoded and re-encoded. A second lossy pass, transparent for listening" },
                ],
              },
              {
                label: "WAV / AIFF",
                cells: [
                  { text: "Editing, a DAW, a sampler, a transcription pipeline" },
                  { state: "yes", text: "Decoded once to PCM at the source rate and channels. No further loss, large file" },
                ],
              },
              {
                label: "FLAC",
                cells: [
                  { text: "Archiving, when WAV is too big" },
                  { state: "yes", text: "Same audio as WAV at roughly half the size" },
                ],
              },
              {
                label: "OGG",
                cells: [
                  { text: "Games, web audio, open-source pipelines" },
                  { state: "partial", text: "Decoded and re-encoded, like MP3" },
                ],
              },
            ]}
            footnote="None of these add quality back. The video's audio was compressed when the video was made; the best any output can do is not compress it again."
          />
          <Prose className="mt-5">
            <p>
              Only need the words? Skip the audio file: <Link href="/video-to-text">Video to Text</Link> transcribes
              the video directly, with timestamps and subtitle export. Need WAV specifically and want the sizes
              first? <Link href="/mp4-to-wav">The MP4 to WAV page</Link> has a size table by sample rate.{" "}
              <Link href="/guides/why-m4a-extraction-is-instant">Why M4A extraction is instant</Link> covers what
              a stream copy is.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="next" title="After the audio" bleed>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Transcribe it", "An interview or lecture, with timestamps and SRT.", "/audio-to-text"],
              ["Split into stems", "Vocals, drums, bass and other.", "/stems"],
              ["Find key and BPM", "A live set or a reference track.", "/key-finder"],
              ["Trim it", "Just the section you need, lossless.", "/trim"],
            ].map(([title, desc, href]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="group rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
              >
                <p className="font-medium text-text-primary group-hover:text-amber-400">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
              </Link>
            ))}
          </div>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="You are responsible for having the right to process any video you upload. AudioForges does not host or distribute the files processed here."
        />
      </ToolPageShell>
    </>
  );
}