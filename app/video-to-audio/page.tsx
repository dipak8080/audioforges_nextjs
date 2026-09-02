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

/**
 * UNCHANGED AND DELIBERATE: the WAV-path claims describe pcm_s16le only.
 * MP3/FLAC/M4A/AAC/OGG/AIFF use different encoder flags that haven't been
 * verified, and the page is careful not to speak for them. Don't broaden those
 * sentences without checking the command.
 */

/*
  TITLE RETARGETED 2026-09-01, FROM BING KEYWORD RESEARCH (3 months to 30 Aug):

    mp4 to mp3               169K   <- absent from the old title entirely
    mp4 to mp3 converter    49.5K
    video to mp3            34.9K
    convert mp4 to mp3      23.3K
    video to mp3 converter  17.9K
    video to audio           8.2K
    video to wav              857

  The old title led with "MP4 to WAV & MOV to MP3" and never said "MP4 to
  MP3" — the largest term in the cluster by a wide margin. MP4-to-WAV is not
  demoted because it is small (that phrase was never measured; the ahrefs note
  below still stands), but because it cannot outrank a term with 169K
  impressions for the lead position.

  `absolute` now, matching /youtube-to-mp3 and /tiktok-to-mp3: a bare string
  opts into the root layout template, which appends " | AudioForges" and spends
  14 characters on a brand with no recorded search volume. Those 14 characters
  buy "Video to MP3" instead.
*/
const PAGE_TITLE = "MP4 to MP3 Converter – Free Video to MP3 and WAV";
const PAGE_DESCRIPTION =
  "Convert MP4 to MP3 free, or extract audio as WAV, M4A, FLAC, AAC, OGG or AIFF. Also handles MOV to MP3, MOV to WAV and MKV. No sign-up, no watermark.";

const OG_IMAGE = ogForTool("video-to-audio", "Free MP4 to WAV converter");

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

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Ordered by search volume, head terms first, so the rows a crawler reads
// first are the ones the page competes for. MP4→MP3 leads on Bing's measured
// 169K; the ahrefs figures behind the rest (mp4 to wav >10,000/mo, mov to mp3
// >10,000/mo, mov to wav >1,000/mo, Aug 2026) still stand.
const FORMAT_PAIRS = [
  { from: "MP4", to: "MP3" },
  { from: "MP4", to: "WAV" },
  { from: "MOV", to: "MP3" },
  { from: "MOV", to: "WAV" },
  { from: "MP4", to: "M4A" },
  { from: "MKV", to: "MP3" },
  { from: "WebM", to: "MP3" },
  { from: "AVI", to: "WAV" },
];

/**
 * 16-bit PCM size, in decimal MB (1 MB = 1,000,000 bytes) — which is how macOS
 * and Windows report file size.
 *
 *   bytes/sec = sample_rate × 2 bytes × channels
 *
 * COMPUTED RATHER THAN TYPED. The four table rows were correct as literals,
 * but the ceiling sentence beneath them multiplies by the duration cap — and
 * that cap lives on the backend. A literal there goes stale the moment
 * video_extract_max_seconds moves, with nothing to catch it.
 *
 * The backend passes -c:a pcm_s16le with NO -ar and NO -ac, so rate and channel
 * count are inherited from the source. Don't state a fixed rate anywhere.
 */
const pcmMegabytes = (sampleRate: number, channels: number, seconds: number) =>
  (sampleRate * 2 * channels * seconds) / 1e6;

const WAV_SIZE_SOURCES = [
  { label: "48 kHz stereo", rate: 48000, channels: 2 },
  { label: "44.1 kHz stereo", rate: 44100, channels: 2 },
  { label: "48 kHz mono", rate: 48000, channels: 1 },
  { label: "44.1 kHz mono", rate: 44100, channels: 1 },
];

// Slugs verified against lib/data/tools.ts. A previous version shipped
// /key-bpm-finder and /stem-separation, neither of which exists — two 404s in
// the one section on this page competitors structurally can't copy.
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

  /*
    THE RIGHT CAP FOR THIS ROUTE. Three different video-related ceilings exist
    and they're easy to mix up:
      max_upload_mb            80   ordinary audio routes
      max_video_upload_mb     200   this page
      max_video_transcribe_mb 100   /video-to-text
    Showing 200 on the transcribe page, or 100 here, is wrong for one of them.
  */
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

  // Derived from the cap rather than typed. "Roughly 690 MB" was right for a
  // 60-minute ceiling and becomes wrong the moment that ceiling moves.
  const ceilingWavMb = Math.round(pcmMegabytes(48000, 2, maxSeconds) / 10) * 10;

  const retention = retentionSentences(limits.retention.audio_tools);

  // Every claim below is checked against the actual backend command:
  //   ffmpeg -y -i <input> -vn -map 0:a:0 -c:a pcm_s16le <output>.wav
  // No guaranteed-timing claims — extraction speed depends on the source.
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MP4 to MP3 & Video to Audio Converter",
    // alternateName carries the head terms as standalone entity labels, which
    // helps Google associate the page with each query independently.
    alternateName: [
      "MP4 to MP3 Converter",
      "Video to MP3 Converter",
      "MP4 to WAV Converter",
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
      "Convert MP4 to WAV",
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
    // Exact-match commercial questions first. These mirror the long-tail
    // variants in the ahrefs pull ("convert mp4 to wav", "how to convert mp4
    // to wav", ".mov to mp3", "mov to mp3 converter free") so each has a
    // literal on-page answer rather than a paraphrase.
    {
      question: "How do I convert MP4 to WAV?",
      answer:
        "Upload the MP4 file, select WAV as the output format, and download the result. There are no encoder settings to configure and no sign-up step.",
    },
    {
      question: "How do I convert MOV to MP3?",
      answer:
        "Upload the .mov file, select MP3 as the output format, and download the extracted audio. QuickTime audio codecs are handled automatically.",
    },
    {
      question: "Is this MP4 to WAV converter free?",
      answer:
        "Yes — the converter is completely free, with no account, no email, no trial limit, and no watermark on the output file.",
    },
    {
      question: "Can I convert MOV to WAV?",
      answer:
        "Yes — upload the MOV file and select WAV as the target output format for an uncompressed audio file.",
    },
    {
      question: "Can I convert MP4 to MP3?",
      answer: `Yes — MP3 is one of the ${audioFormats.length} output formats available, alongside ${audioFormats.filter((f) => f !== "MP3").join(", ")}.`,
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
      // From allowed_video_formats. This list was enforced and unpublished for
      // a long time — the same gap that left AIFF off /stems.
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
      // max_video_upload_mb, not max_upload_mb — see the note above.
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
      // Conversion happens server-side via ffmpeg, not in the browser.
      question: "Do I need to install software?",
      answer:
        "No — there's no app or plugin to install. You upload the video through your browser, it's converted on the server, and you download the audio file. Nothing runs locally on your machine.",
    },
    {
      /*
        This said the upload is deleted when conversion finishes — true — and
        stopped there. It said nothing about the extracted file, which lives an
        hour. Someone reading only the first half assumes their WAV went with
        it, and comes back to a download that expired without anyone telling
        them it would.
      */
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
        /* Short H1, long title tag — same reasoning as /convert. The head
           terms still appear in the first 20 words of body copy, in query
           order, via the lede. */
        title="Free Video to Audio Converter"
        lede="Convert MP4 to MP3, MP4 to WAV, or MOV to MP3 online — free, no sign-up, no watermark."
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

        {/* Written to match the "how to convert mp4 to wav" long-tail
            (>100/mo) rather than a generic "how it works" heading. */}
        <ToolSection id="how-to" title="How to convert MP4 to WAV or MOV to MP3">
          <ol>
            <li>Upload your MP4, MOV, MKV, AVI, WebM, or other supported video file.</li>
            <li>
              Choose an output format — WAV for uncompressed audio, MP3 for a small
              file, or M4A/AAC for the fastest extraction when the source already
              contains compatible AAC audio.
            </li>
            <li>Download the extracted audio file.</li>
          </ol>
        </ToolSection>

        {/* Two dedicated sections give each >10,000/mo head term its own
            substantive block of unique content rather than sharing one generic
            paragraph. That's what lets Google treat both queries as
            independently well-served by the page. */}
        <ToolSection id="mp4-to-wav" title="Convert MP4 to WAV">
          <p>
            MP4 is the most common video container, and its audio track is usually
            AAC. Converting MP4 to WAV produces an uncompressed file that&apos;s
            suited to editing in a DAW, importing into a video-editing timeline,
            or any workflow where you need audio that isn&apos;t re-compressed on
            every save. Upload your MP4 above, choose WAV as the output, and
            download the extracted track — this MP4 to WAV converter has no
            encoder settings to configure.
          </p>
          <p>
            Keep in mind that WAV output decodes the original AAC audio and writes
            it out uncompressed. The file will be larger, but it won&apos;t sound
            better than the source — see{" "}
            <a href="#wav-quality">why lossless output doesn&apos;t restore lost detail</a>.
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
            every tool here, the MOV to MP3 converter is free with no daily upload
            cap.
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

        {/* The differentiator. No competitor in this SERP states these or does
            the file-size arithmetic, and it's the section most likely to get
            cited by answer engines because it contains concrete verifiable
            numbers instead of marketing adjectives. Claims here describe the
            WAV path only. */}
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

        {/* Renamed from "Convert MP4 to WAV, MOV to MP3, and More" — that
            heading duplicated the two dedicated H2s above and diluted them.
            This is clearly the catch-all now, not a third contender. */}
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
            {/* Link text matches the guide's actual title. It previously read
                "Why Extracting Audio to M4A Is Instant (and WAV Isn't)" — a
                title that doesn't exist. */}
            Want the fuller breakdown of what a stream copy actually is, and when
            lossless output genuinely helps versus when it&apos;s just a bigger
            file?{" "}
            <Link href="/guides/why-m4a-extraction-is-instant" prefetch={false}>
              Read Why M4A Extraction Is Instant (WAV Isn&apos;t)
            </Link>
            .
          </p>
        </ToolSection>

        {/* id is load-bearing — the MP4-to-WAV section links to #wav-quality. */}
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

        {/* The one case where the honest answer is "don't use this page".
            Someone who only wants the words gets a smaller, faster result from
            /video-to-text, and sending them there beats having them extract a
            115 MB WAV they'll delete. */}
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

        {/* The producer/DJ workflow is the one thing on this page that
            CloudConvert, FreeConvert, Convertio and Zamzar structurally can't
            copy. Naming it as a workflow rather than burying it in the tool
            grid is what turns a commodity converter into a reason to return. */}
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