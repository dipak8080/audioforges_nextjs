import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { VideoToAudioForm } from "@/components/converter/VideoToAudioForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
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
const PAGE_TITLE = "MP4 to WAV Converter — Extract Lossless Audio";
const PAGE_DESCRIPTION =
  "Convert MP4 to WAV free online — extract a video's audio as an uncompressed WAV for editing or a DAW. No sign-up, no watermark, no app.";

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

// The three real intents behind "get audio out of an MP4", each routed to the
// tool that actually fits. Captures the "wav or mp3?" decision long-tail.
const PICK_FORMAT = [
  [
    "Editing → WAV",
    "Going into a DAW, a video timeline, a sampler, or a transcription pipeline? Extract WAV — uncompressed, so no second lossy generation stacks on the video's AAC. That's this page.",
  ],
  [
    "Listening or sharing → MP3 / M4A",
    "Just want to play it in a car, on a phone, or send it? MP3 or M4A is a fraction of the size and sounds the same for listening. Use the video to audio converter.",
  ],
  [
    "Only the words → transcript",
    "If the endpoint is text, skip the audio file entirely — video to text transcribes the MP4 directly, with timestamps and subtitle export, no WAV to download.",
  ],
];

const AFTER_EXTRACTION = [
  { href: "/trim", label: "Trim the WAV", body: "Cut to just the section you need — lossless." },
  { href: "/audio-to-text", label: "Transcribe it", body: "Turn a lecture or interview into text with timestamps." },
  { href: "/stems", label: "Split stems", body: "Separate vocals, drums, bass and other." },
  { href: "/convert", label: "Other formats", body: "Send the audio on to MP3, FLAC, M4A and more." },
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
      question: "How do I convert MP4 to WAV?",
      answer:
        "Upload the MP4 above — WAV is selected as the output — then click Convert and download the extracted audio. No encoder settings, no account, nothing to install.",
    },
    {
      question: "Does the WAV sound better than the MP4's audio?",
      answer:
        "No. An MP4's audio track is almost always AAC, which is already lossy. Extracting it to WAV writes it out uncompressed, but it can't recover detail the AAC already discarded — the WAV is larger, not higher quality. It's the right format for editing, not a quality upgrade.",
    },
    {
      question: "Why convert MP4 to WAV instead of MP3?",
      answer:
        "Because WAV is uncompressed, so if you're going to edit the audio — in a DAW, a video timeline, or a transcription pipeline — you avoid stacking a second round of lossy compression on top of the video's. If you only want to listen or share, MP3 or M4A is far smaller and just as good for that.",
    },
    {
      question: "Why is the WAV bigger than the whole video?",
      answer:
        "Because the video is compressed and the WAV isn't. An MP4 squeezes both picture and sound down hard; pulling the audio out and writing it uncompressed removes that compression, so at about 10 MB a minute the audio-only WAV can easily outsize the full video it came from. It's normal, not a mistake.",
    },
    {
      question: "How big will the WAV be?",
      answer: `Roughly ${perMinute48} per minute for 48 kHz stereo audio — about 10 MB a minute. That's uncompressed, so a WAV extracted from a video is often larger than the video file itself. Mono sources are about half that.`,
    },
    {
      question: "What sample rate and bit depth is the WAV?",
      answer:
        "16-bit PCM, at the source video's own sample rate — a 48 kHz stereo video gives a 48 kHz stereo WAV. There's no resampling and no downmix.",
    },
    {
      question: "Can I extract WAV from MOV, MKV or WebM too?",
      answer:
        "Yes — the same extractor takes MOV, MKV, WebM and AVI as well as MP4, and WAV output works from any of them. iPhone and QuickTime .mov files are handled the same way as MP4.",
    },
    {
      question: "Does it work on iPhone videos and screen recordings?",
      answer:
        "Yes. iPhone videos are usually .mov or .mp4 and both work, as do Mac and Windows screen recordings. The file just needs an audio track — a silent screen capture has nothing to extract.",
    },
    {
      question: "How do I convert MP4 to WAV on Windows or Mac?",
      answer:
        "Open this page in any browser on either, drag the MP4 in, and download the WAV. There's nothing to install — no need for VLC, Audacity, or a desktop converter.",
    },
    {
      question: "Is this MP4 to WAV converter free?",
      answer:
        "Yes — completely free, no account, no email, no trial limit, and no watermark on the output.",
    },
    {
      question: "What's the maximum video size and length?",
      answer: `Up to ${maxUploadMb}MB per upload, and up to ${maxDurationLabel} of video.`,
    },
    {
      question: "My video has more than one audio track — which is extracted?",
      answer:
        "The first audio track in the file. There's no track selector yet, so alternate language or multi-mic tracks come through as just that first one.",
    },
    {
      question: "Are my uploaded videos kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "MP4 to WAV" }]} />
        }
        title="MP4 to WAV Converter"
        lede="Convert MP4 to WAV free — pull the audio out of a video as an uncompressed WAV for editing or a DAW. No sign-up, no app."
        tool={<VideoToAudioForm defaultFormat="wav" />}
      >
        <FeatureStrip
          features={[
            { title: "Uncompressed", desc: "16-bit PCM WAV at the source sample rate." },
            { title: "For editing", desc: "The format DAWs and video timelines want." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ]}
        />

        <ToolSection id="how-to" title="How to convert MP4 to WAV">
          <ol>
            <li>Upload your MP4 (or MOV, MKV, WebM, AVI) — WAV is set as the output.</li>
            <li>Click Convert and wait for the audio to extract.</li>
            <li>Download the WAV.</li>
          </ol>
          <p>
            It runs in any browser on Windows, Mac, iPhone or Android — no VLC, no Audacity, no
            desktop converter to install.
          </p>
        </ToolSection>

        <ToolSection id="why" title="Why extract WAV from an MP4">
          <p>
            An MP4 carries its audio as a compressed track — usually AAC. Pulling that out as WAV
            gives you an uncompressed file, which is what a DAW, a video-editing timeline, or a
            transcription pipeline wants: audio that isn&apos;t re-compressed every time you save.
          </p>
          <p>
            If you only need to listen to or share the audio, WAV is overkill — MP3 or M4A is a
            fraction of the size. Reach for WAV specifically when the audio is going to be
            <em> edited</em>.
          </p>
        </ToolSection>

        {/* The honest note competitors skip — the reason to trust this page. */}
        <ToolSection id="quality" title="Does MP4 to WAV improve the audio quality?">
          <p>
            No, and it&apos;s worth stating plainly. The audio inside an MP4 is almost always AAC,
            which is lossy — data was discarded when the video was encoded. Extracting to WAV writes
            what remains out uncompressed, but it can&apos;t rebuild anything that was thrown away.
          </p>
          <p>
            So the WAV is <strong>uncompressed, not higher quality</strong>. It&apos;s the right
            choice for editing because it avoids a second lossy generation — not because it sounds
            better than the video did.{" "}
            <Link href="/guides/lossless-vs-lossy-audio-formats">
              Read Lossless vs Lossy Audio: Which Format to Use
            </Link>{" "}
            for the full picture.
          </p>
        </ToolSection>

        {/* Depth: what the WAV technically is. Bigger file != higher
            resolution — the honest counterpart to the size table. */}
        <ToolSection id="spec" title="What the extracted WAV actually contains">
          <p>
            The output is <strong>16-bit PCM</strong> at the video&apos;s own sample rate and
            channel count. A 48 kHz stereo source gives a 48 kHz stereo WAV; a 44.1 kHz mono
            source gives a 44.1 kHz mono WAV. There&apos;s no resampling, no upsampling, and no
            downmix — the extractor decodes the source audio to raw samples and writes them out
            uncompressed, exactly as they were.
          </p>
          <p>
            That&apos;s worth knowing because a big WAV looks like &quot;high resolution&quot; and
            isn&apos;t. A WAV pulled from a video whose audio was a modest AAC stream carries
            exactly that AAC&apos;s fidelity — the extra size is the cost of storing it
            uncompressed, not new detail. WAV is the right working format for editing; it is not a
            way to upgrade what the camera or screen recorder captured.
          </p>
        </ToolSection>

        {/* Depth + funnel: the "wav or mp3 or transcript?" decision, each
            routed to the tool that fits. Captures the decision long-tail and
            sends listeners/transcribers to the right page instead of a WAV
            they'll delete. */}
        <ToolSection id="pick-format" title="WAV, MP3, or just the transcript?">
          <p>
            &quot;Get the audio out of an MP4&quot; is really three different jobs. Pick by what
            you&apos;re going to do with it:
          </p>
          <dl className="codes">
            {PICK_FORMAT.map(([label, use]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{use}</dd>
              </Fragment>
            ))}
          </dl>
          <p>
            This page is the WAV route. For the other two, the{" "}
            <Link href="/video-to-audio">video to audio converter</Link> handles MP3 and M4A, and{" "}
            <Link href="/video-to-text">video to text</Link> goes straight to a transcript.
          </p>
        </ToolSection>

        {/* Concrete size math — the surprise, and the citable table. */}
        <ToolSection id="size" title="How big will the extracted WAV be?" bleed>
          <div className="mt-2 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <caption className="sr-only">WAV size by source sample rate and channels</caption>
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Source audio</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Per minute</th>
                  <th scope="col" className="px-4 py-3 font-semibold">10-minute video</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {sizeTable.map((row) => (
                  <tr key={row.source}>
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.perMinute}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.tenMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-text-muted">
            Uncompressed audio runs about 10 MB a minute, so a WAV pulled from a video is often
            larger than the whole MP4 it came from. At the {maxDurationLabel} ceiling a 48 kHz
            stereo source lands around {ceilingWavMb} MB. If you only need it to listen, MP3 is a
            fraction of the size.
          </p>
        </ToolSection>

        <ToolSection id="formats" title="Works with MOV, MKV, WebM and AVI too">
          <p>
            MP4 is the common case, but the same extractor takes other containers — MOV (including
            iPhone and QuickTime video), MKV, WebM, and AVI — and WAV output works from any of them.
            Screen recordings from Mac, Windows, OBS, and phone captures all extract the same way,
            as long as the file actually contains an audio track.
          </p>
        </ToolSection>

        <ToolSection id="after" title="After the WAV: the rest on this site">
          <p>
            Extraction is usually the first step. Once you have the WAV, the next thing runs here
            too, no re-upload:
          </p>
          <dl>
            {AFTER_EXTRACTION.map((item) => (
              <Fragment key={item.href}>
                <dt>
                  <Link href={item.href} prefetch={false}>
                    {item.label}
                  </Link>
                </dt>
                <dd>{item.body}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="other" title="Want MP3 instead, or a different format?">
          <p>
            If you just want to listen, extract MP3 with the{" "}
            <Link href="/video-to-audio">video to audio converter</Link>, which outputs MP3, M4A,
            FLAC, AAC, OGG and AIFF too and handles MOV, MKV and WebM. Only need the words? The{" "}
            <Link href="/video-to-text">video to text</Link> tool transcribes the video directly, no
            extraction step.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}