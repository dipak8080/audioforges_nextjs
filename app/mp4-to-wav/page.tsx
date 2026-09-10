import type { Metadata } from "next";
import Link from "next/link";
import { VideoToAudioForm } from "@/components/converter/VideoToAudioForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { Prose } from "@/components/ui/Prose";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { DemuxDiagram } from "@/components/tools/DemuxDiagram";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, durationLabel, retentionSentences } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/*
  DEDICATED PAGE for the "mp4 to wav" cluster. Ahrefs, Aug 2026:

    mp4 to wav            >10,000   Easy KD
    mp4 to wav converter  >1,000    Easy KD
    convert mp4 to wav    >1,000    Easy KD
    how to convert mp4 to wav  >100 Easy KD

  Easy across the board with real volume — the sweet spot. /video-to-audio is
  retargeted off "mp4 to wav" (it keeps "mp4 to mp3" at 169K, a Medium/Hard
  term it's better placed to chase there). The two link to each other and don't
  compete.

  DIFFERENTIATION: this is audio EXTRACTION (video in, WAV out), not a file
  conversion. The angle competitors miss is the honest one — a WAV pulled from
  an MP4 is uncompressed but NOT higher quality than the AAC it came from, and
  it's often larger than the whole video. Concrete size math and that honest
  note are what an answer engine cites.

  WAV-path claims describe pcm_s16le only (backend: -c:a pcm_s16le, no -ar/-ac);
  don't broaden them to other output formats without checking the command.

  `absolute` title, so " | AudioForges" isn't appended.
*/
const PAGE_TITLE = "MP4 to WAV Converter – Free, Keeps the Sample Rate";
const PAGE_DESCRIPTION =
  "Extract a video's audio as 16-bit PCM WAV at the source sample rate, with no resampling and no downmix. Free, no sign-up, no watermark, no app.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("mp4-to-wav", "Free MP4 to WAV converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/mp4-to-wav` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/mp4-to-wav`,
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

// 16-bit PCM: bytes/sec = rate * 2 * channels. Decimal MB.
const pcmMegabytes = (rate: number, channels: number, seconds: number) =>
  (rate * 2 * channels * seconds) / 1e6;

const SIZE_ROWS = [
  { label: "48 kHz stereo", rate: 48000, channels: 2 },
  { label: "44.1 kHz stereo", rate: 44100, channels: 2 },
  { label: "48 kHz mono", rate: 48000, channels: 1 },
];

export default async function Mp4ToWavPage() {
  const relatedTools = getRelatedTools("video-to-audio", 5);
  const limits = await getLimits();

  const maxUploadMb = limits.maxVideoUploadMb;
  const maxSeconds = limits.durations.videoExtractMaxSeconds;
  const maxDurationLabel = durationLabel(maxSeconds);
  const retention = retentionSentences(limits.retention.audio_tools);

  const perMinute48 = `${pcmMegabytes(48000, 2, 60).toFixed(1)} MB`;
  // Derived from the cap, not typed — stays correct if the ceiling moves.
  const ceilingWavMb = Math.round(pcmMegabytes(48000, 2, maxSeconds) / 10) * 10;
  const sizeTable = SIZE_ROWS.map((s) => ({
    source: s.label,
    perMinute: `${pcmMegabytes(s.rate, s.channels, 60).toFixed(1)} MB`,
    tenMinutes: `${Math.round(pcmMegabytes(s.rate, s.channels, 600))} MB`,
  }));

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MP4 to WAV Converter",
    alternateName: ["Convert MP4 to WAV", "MP4 to WAV Converter Free", "Extract WAV from MP4"],
    url: `${SITE_URL}/mp4-to-wav`,
    dateModified: UPDATED,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Extract WAV audio from an MP4 video",
      "16-bit PCM WAV at the source sample rate",
      "Also handles MOV, MKV, WebM and AVI",
      "No sign-up, no watermark",
      "Runs on Windows, Mac, iPhone and Android",
    ],
  };

  const faqs = [
    {
      question: "Does the WAV sound better than the MP4's audio?",
      answer:
        "No. An MP4's audio track is almost always AAC, which is already lossy. Extracting it to WAV writes it out uncompressed, but it cannot recover detail the AAC already discarded. The WAV is larger, not higher quality. It is the right format for editing, not a quality upgrade.",
    },
    {
      question: "What sample rate and bit depth is the WAV?",
      answer:
        "16-bit PCM at the source video's own sample rate and channel count. A 48 kHz stereo video gives a 48 kHz stereo WAV. There is no resampling and no downmix, which is not true of most free converters.",
    },
    {
      question: "How big will the WAV be?",
      answer: `Roughly ${perMinute48} per minute for 48 kHz stereo, so a WAV extracted from a video is often larger than the video itself. Mono sources are about half that. At the ${maxDurationLabel} cap, a stereo WAV is around ${ceilingWavMb} MB.`,
    },
    {
      question: "Why WAV instead of MP3?",
      answer:
        "If the audio is going into a DAW, a video timeline, a sampler or a transcription pipeline, WAV means no second lossy generation stacks on top of the video's AAC. If you only want to listen or share, MP3 is a fraction of the size and sounds the same. The video to audio converter outputs MP3 and M4A.",
      answerNode: (
        <>
          If the audio is going into a DAW, a video timeline, a sampler or a transcription pipeline, WAV means no
          second lossy generation stacks on top of the video&apos;s AAC. If you only want to listen or share, MP3 is a
          fraction of the size and sounds the same. The{" "}
          <Link href="/video-to-audio" prefetch={false} className="text-amber-400 hover:underline">
            video to audio converter
          </Link>{" "}
          outputs MP3 and M4A.
        </>
      ),
    },
    {
      question: "Can I extract WAV from MOV, MKV, WebM or AVI too?",
      answer:
        "Yes. The same extraction handles MOV, MKV, WebM and AVI, including iPhone videos and Mac or Windows screen recordings. The file just needs an audio track; a silent screen capture has nothing to extract.",
    },
    {
      question: "My video has more than one audio track. Which one comes out?",
      answer:
        "The first audio track in the file. There is no track selector yet, so alternate-language or multi-mic tracks come through as just that first one.",
    },
    {
      question: "What is the maximum size and length?",
      answer: `Up to ${maxUploadMb}MB per upload and up to ${maxDurationLabel} of video. Longer or larger files are refused before upload, not after.`,
    },
    {
      question: "Are my uploaded videos kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is it free?",
      answer:
        "Yes. No account, no email, no watermark, no app. It runs in the browser on Windows, Mac, iPhone and Android.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "MP4 to WAV" }]} />}
        meta={["No account", "No resampling", "Source sample rate kept"]}
        title="MP4 to WAV Converter"
        lede="Pull the audio out of a video as an uncompressed WAV at the source sample rate. For editing, not for listening. No sign-up, no app."
        tool={<VideoToAudioForm defaultFormat="wav" />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Output",
              value: "16-bit PCM, source rate, source channels",
              note: "48 kHz in, 48 kHz out. No resampling, no downmix. Most free converters quietly do both.",
            },
            {
              label: "Also takes",
              value: "MOV, MKV, WebM, AVI",
              note: "iPhone videos and screen recordings included. It only needs an audio track.",
            },
            {
              label: "Limits",
              value: `${maxUploadMb}MB, ${maxDurationLabel}`,
              note: `About ${perMinute48} of WAV per minute of 48 kHz stereo, so plan for the file to be bigger than the video.`,
            },
          ]}
        />

        <ToolSection id="what-happens" title="What is kept, and what is dropped" bleed>
          <DemuxDiagram containerLabel="MP4" audioCodec="AAC" />
        </ToolSection>

        <ToolSection id="size" title="How big the WAV will be" bleed>
          <CompareTable
            columns={["Per minute", "Ten minutes"]}
            highlight={0}
            rows={sizeTable.map((r) => ({
              label: r.source,
              cells: [
                { text: r.perMinute, mono: true },
                { text: r.tenMinutes, mono: true },
              ],
            }))}
            footnote="Uncompressed PCM. Video is compressed hundreds of times harder than this, which is why the WAV usually outweighs the whole MP4."
          />
        </ToolSection>

        <ToolSection id="which-format" title="WAV, MP3, or just the words?" bleed>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Editing", "WAV, this page", "Going into a DAW, a timeline, a sampler or a transcription pipeline. No second lossy pass on top of the AAC.", null],
              ["Listening or sharing", "MP3 or M4A", "A fraction of the size, sounds the same in a car or on a phone.", "/video-to-audio"],
              ["Only the words", "Transcript", "Skip the audio file. Video to text transcribes the MP4 directly, with timestamps and subtitle export.", "/video-to-text"],
            ].map(([job, pick, desc, href]) => {
              const inner = (
                <>
                  <p className="text-xs text-text-subtle">{job}</p>
                  <p className="mt-1 font-medium text-text-primary">{pick}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{desc}</p>
                </>
              );
              return href ? (
                <Link
                  key={job as string}
                  href={href as string}
                  prefetch={false}
                  className="group rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
                >
                  {inner}
                </Link>
              ) : (
                <div key={job as string} className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
                  {inner}
                </div>
              );
            })}
          </div>
          <Prose className="mt-5">
            <p>
              After the WAV: <Link href="/trim">trim it</Link>, <Link href="/audio-to-text">transcribe it</Link>,{" "}
              <Link href="/stems">split it into stems</Link>, or <Link href="/convert">send it to another format</Link>.
            </p>
          </Prose>
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