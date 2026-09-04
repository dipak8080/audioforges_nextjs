import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { VideoToAudioForm } from "@/components/converter/VideoToAudioForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
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
const FORMAT_PAIRS = [
  { from: "MP4", to: "MP3" },
  { from: "MOV", to: "MP3" },
  { from: "MOV", to: "WAV" },
  { from: "MP4", to: "M4A" },
  { from: "MKV", to: "MP3" },
  { from: "WebM", to: "MP3" },
  { from: "AVI", to: "WAV" },
];

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

// Slugs verified against lib/data/tools.ts.
const AFTER_EXTRACTION = [
  {
    href: "/key-finder",
    label: "Key & BPM detection",
    body: "For a live set recording or a reference track pulled from a video.",
  },
  {
    href: "/stems",
    label: "Stem separation",
    body: "Split the extracted audio into vocals, drums, bass, and other.",
  },
  {
    href: "/audio-to-text",
    label: "Audio to Text",
    body: "Transcribe an interview or lecture, with timestamps and SRT export.",
  },
  {
    href: "/audio-to-midi",
    label: "Audio to MIDI",
    body: "Convert a melody or riff from the video into notes you can edit.",
  },
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

  const ceilingWavMb = Math.round(pcmMegabytes(48000, 2, maxSeconds) / 10) * 10;

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
      question: "How do I convert MOV to MP3?",
      answer:
        "Upload the .mov file, select MP3 as the output format, and download the extracted audio. QuickTime audio codecs are handled automatically.",
    },
    {
      question: "Can I convert MP4 to MP3?",
      answer: `Yes — MP3 is one of the ${audioFormats.length} output formats available, alongside ${audioFormats.filter((f) => f !== "MP3").join(", ")}.`,
    },
    {
      question: "Is this converter free?",
      answer:
        "Yes — completely free, with no account, no email, no trial limit, and no watermark on the output file.",
    },
    {
      question: "Can I convert MOV to WAV?",
      answer:
        "Yes — upload the MOV file and select WAV as the target output format for an uncompressed audio file.",
    },
    {
      question: "What sample rate and bit depth is the WAV output?",
      answer:
        "WAV output is 16-bit PCM. The sample rate and channel count come from the source video and aren't changed — a 48 kHz stereo source gives a 48 kHz stereo WAV. There's no resampling and no downmix to mono.",
    },
    {
      question: "How big will the extracted WAV file be?",
      answer: `Roughly ${wavSizeTable[0].perMinute} per minute for 48 kHz stereo audio, or ${wavSizeTable[1].perMinute} per minute at 44.1 kHz. Mono sources are about half that. A 10-minute video produces a WAV of roughly ${wavSizeTable[1].tenMinutes} to ${wavSizeTable[0].tenMinutes}, which is often larger than the source video itself.`,
    },
    {
      question: "My video has multiple audio tracks — which one is extracted?",
      answer:
        "The first audio track in the file. Videos with alternate language tracks or separate microphone channels will produce only that first track; there's no track selector at the moment.",
    },
    {
      question: "What video formats can I upload?",
      answer: `${videoFormatList}.`,
    },
    {
      question: "Why is M4A/AAC output faster than MP3 or WAV?",
      answer:
        "When the video's audio is already encoded as AAC, extracting it to a compatible M4A or AAC output can copy the existing audio stream without re-encoding. MP3, WAV, FLAC, OGG, and AIFF output generally requires decoding and processing the audio into the new format, which takes additional time.",
    },
    {
      question: "Does choosing WAV or FLAC give me better quality than M4A?",
      answer:
        "No — if the source video's audio is AAC, it's already lossy. Converting that audio to a lossless container such as WAV or FLAC can't recover detail that was already discarded. It only produces a larger file. Lossless output is most useful when the original audio was itself lossless.",
    },
    {
      question: "What's the maximum video file size and length?",
      answer: `Up to ${maxUploadMb}MB per upload, and up to ${maxDurationLabel} of video.`,
    },
    {
      question: "Can I convert several videos at once?",
      answer:
        "Not yet — files are converted one at a time. For a batch, run them through individually.",
    },
    {
      question: "Does the converter work on iPhone videos and screen recordings?",
      answer:
        "Yes — iPhone videos are usually .mov or .mp4, and both are supported, as are Mac and Windows screen recordings. The file needs to contain an audio track; a silent recording can't produce an extracted audio file.",
    },
    {
      question: "Do I need to install software?",
      answer:
        "No — there's no app or plugin to install. You upload the video through your browser, it's converted on the server, and you download the audio file. Nothing runs locally on your machine.",
    },
    {
      question: "Are my uploaded videos kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you, published, or shared.`,
    },
    {
      question: "Can I get a transcript from my video without converting it first?",
      answer:
        "Yes — Video to Text takes MP4, MOV, MKV and WEBM directly and returns a transcript with timestamps, plus SRT or VTT subtitle export. Use this converter when you want the audio file itself; use that one when text is all you're after.",
      answerNode: (
        <>
          Yes —{" "}
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[{ name: "Tools", href: "/tools" }, { name: "Video to Audio" }]}
          />
        }
        title="Free Video to Audio Converter"
        lede="Convert MP4 to MP3, or MOV to MP3 online — free, no sign-up, no watermark."
        tool={<VideoToAudioForm />}
      >
        <FeatureStrip
          features={[
            {
              title: `${videoFormats.length} video formats`,
              desc: `${videoFormats.slice(0, 5).join(", ")}, and more.`,
            },
            {
              title: `${audioFormats.length} audio formats`,
              desc: `${audioFormats.join(", ")}.`,
            },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ]}
        />

        <ToolSection id="how-to" title="How to convert MP4 or MOV to MP3">
          <ol>
            <li>Upload your MP4, MOV, MKV, AVI, WebM, or other supported video file.</li>
            <li>
              Choose an output format — MP3 for a small, universal file, M4A/AAC
              for the fastest extraction when the source already contains
              compatible AAC audio, or WAV for uncompressed audio.
            </li>
            <li>Download the extracted audio file.</li>
          </ol>
        </ToolSection>

        <ToolSection id="mp4-to-mp3" title="Convert MP4 to MP3">
          <p>
            MP4 is the most common video container, and pulling its audio out as
            MP3 gives you a small, universally compatible file — the right choice
            for a voice memo, interview, lecture, or soundtrack you just want to
            listen to or share. Upload the MP4 above, choose MP3, and download the
            track; there are no encoder settings to configure.
          </p>
          <p>
            MP3 re-encodes the audio, so it takes a little longer than a
            direct-copy format. If the source audio is already AAC and you don&apos;t
            need MP3 specifically, M4A or AAC copies it out almost instantly —{" "}
            <a href="#m4a-fast">see why M4A/AAC can be the fast option</a>.
          </p>
        </ToolSection>

        <ToolSection id="mov-to-mp3" title="Convert MOV to MP3">
          <p>
            MOV is Apple&apos;s QuickTime container — the format behind iPhone
            videos, Mac screen recordings, and Final Cut Pro exports. Converting
            MOV to MP3 strips the video track and compresses the audio into a
            small, universally compatible file. That&apos;s useful for pulling a
            voice memo, interview, or narration out of a clip without carrying the
            full video file size around.
          </p>
          <p>
            Upload the .mov file above and select MP3 as the output format. The
            converter handles QuickTime&apos;s audio codecs automatically, so
            there&apos;s nothing to configure beyond picking the format — and like
            every tool here, it&apos;s free with no daily upload cap.
          </p>
        </ToolSection>

        <ToolSection id="mov-to-wav" title="Convert MOV to WAV">
          <p>
            If you need the audio from a MOV file for editing rather than
            listening, convert MOV to WAV instead of MP3. WAV keeps the audio
            uncompressed after decoding, which avoids stacking a second round of
            lossy compression on top of whatever the camera or screen recorder
            already applied. It&apos;s the right choice when the extracted audio
            is going into a DAW, a mix, or a transcription pipeline rather than
            straight onto a phone.
          </p>
        </ToolSection>

        {/* Pointer to the dedicated /mp4-to-wav page — a short link, not a
            duplicated section, so this page doesn't compete for "mp4 to wav". */}
        <ToolSection id="mp4-to-wav" title="Need MP4 to WAV specifically?">
          <p>
            Want the audio from an MP4 as an uncompressed WAV for editing? You can
            pick WAV as the output above, but the dedicated{" "}
            <Link href="/mp4-to-wav">MP4 to WAV converter</Link> covers it in full —
            the file-size math, the 16-bit PCM details, and the honest note on why
            a WAV pulled from an MP4 is bigger but not higher quality than the AAC
            it came from.
          </p>
        </ToolSection>

        <ToolSection id="wav-output-spec" title="What the extracted WAV file actually contains" bleed>
          <Prose>
            <p>
              WAV output is written as 16-bit PCM. The sample rate and channel
              layout are carried over from the source video rather than forced to
              a fixed value — a 48 kHz stereo recording produces a 48 kHz stereo
              WAV, and a 44.1 kHz mono recording produces a 44.1 kHz mono WAV.
              There is no resampling step and no downmix, so nothing is altered
              beyond decoding the compressed source audio and writing it out
              uncompressed.
            </p>
            <p>
              If your video contains more than one audio track — alternate
              language tracks, or separate microphone channels from a multi-cam
              recording — the first audio track is the one extracted. There is
              currently no track picker.
            </p>
            <h3>How large will the WAV file be?</h3>
            <p>
              Uncompressed audio is considerably larger than the video it came
              from. A 12 MB phone clip can produce a WAV several times that size,
              which surprises people expecting the audio-only file to be smaller.
              Sizes for 16-bit PCM:
            </p>
          </Prose>

          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <caption className="sr-only">
                WAV file size by source sample rate and channel count
              </caption>
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Source audio</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Per minute</th>
                  <th scope="col" className="px-4 py-3 font-semibold">10-minute video</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {wavSizeTable.map((row) => (
                  <tr key={row.source}>
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.perMinute}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{row.tenMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Prose className="mt-5">
            <p>
              At the {maxDurationLabel} upload ceiling, a 48 kHz stereo source
              produces a WAV of roughly {ceilingWavMb} MB. If you only need the
              audio for listening or sharing, MP3 or M4A will be a small fraction
              of that size. Choose WAV when the file is going into a DAW or an
              editing timeline.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="all-combinations" title="Every supported video and audio format combination" bleed>
          <Prose>
            <p>
              The same converter handles any combination of supported video and
              audio formats — upload once, then pick whichever output your project
              needs:
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <caption className="sr-only">
                Supported video input formats and their audio output formats
              </caption>
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">From</th>
                  <th scope="col" className="px-4 py-3 font-semibold">To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {FORMAT_PAIRS.map((pair) => (
                  <tr key={`${pair.from}-${pair.to}`}>
                    <td className="px-4 py-3 font-mono">{pair.from}</td>
                    <td className="px-4 py-3 font-mono">{pair.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              These are just examples — every supported video format converts to
              any of the {audioFormats.length} audio output formats, not only the
              pairs shown here.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="m4a-fast" title="Why M4A/AAC can be the fast option">
          <p>
            Many video files already contain audio encoded as AAC. When the source
            audio is compatible, extracting it to M4A or AAC can copy the existing
            audio stream into an audio-only file without re-encoding it. That
            avoids an unnecessary quality conversion and can make the extraction
            substantially faster.
          </p>
          <p>
            Other output formats such as WAV, MP3, FLAC, OGG, and AIFF generally
            require the audio to be decoded and processed into the new format,
            which takes additional processing time.
          </p>
          <p>
            Want the fuller breakdown of what a stream copy actually is, and when
            lossless output genuinely helps versus when it&apos;s just a bigger
            file?{" "}
            <Link href="/guides/why-m4a-extraction-is-instant" prefetch={false}>
              Read Why M4A Extraction Is Instant (WAV Isn&apos;t)
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="wav-quality" title="WAV and FLAC don't add quality back">
          <p>
            A common assumption is that WAV or FLAC output is automatically higher
            quality. If the video&apos;s original audio was AAC, it has already
            gone through lossy compression. Wrapping or converting that audio into
            a lossless format afterward can&apos;t recover detail that was already
            discarded. It simply produces a larger file containing the processed
            audio. Lossless output is most useful when the source audio was itself
            lossless.
          </p>
        </ToolSection>

        <ToolSection id="skip-this" title="If you only need the words, skip this step">
          <p>
            Extracting audio purely to transcribe it is a detour.{" "}
            <Link href="/video-to-text" prefetch={false}>
              Video to Text
            </Link>{" "}
            takes the MP4, MOV, MKV or WEBM directly and returns the transcript —
            no intermediate WAV to download, and no second upload. You get
            timestamps and SRT or VTT subtitle export from the same run.
          </p>
          <p>
            Use this converter instead when you want the audio file itself: to
            edit in a DAW, to keep as an archive, or to run through cleanup before
            doing anything else with it.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="What people use this converter for">
          <p>
            Pulling the soundtrack from a screen recording, extracting an interview
            or podcast&apos;s audio from a video recording, getting a WAV out of a
            phone video for editing, and preparing audio from a video file for
            further processing.
          </p>
          <p>
            Need a specific section of the extracted audio rather than the whole
            thing? Trim it down afterward with the{" "}
            <Link href="/trim" prefetch={false}>
              Audio Trimmer
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="after-extraction" title="After the WAV: what you can do with it here">
          <p>
            Extraction is usually the first step rather than the last one. Once you
            have the audio file, the rest of the workflow runs on this site without
            re-uploading to a different service:
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

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}