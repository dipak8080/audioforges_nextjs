import type { Metadata } from "next";
import Link from "next/link";
import { VideoToAudioForm } from "@/components/converter/VideoToAudioForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

// Title kept to 38 chars so the " | AudioForges" suffix (14) lands at 52 —
// well inside SERP truncation. Both head terms sit before the first pipe.
const PAGE_TITLE = "Free MP4 to WAV & MOV to MP3 Converter";
const PAGE_DESCRIPTION =
  "Convert MP4 to WAV, MOV to MP3, or MOV to WAV online, free. Extract audio from any video to WAV, MP3, M4A, FLAC, AAC, OGG, or AIFF. No sign-up, no watermark.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/video-to-audio` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/video-to-audio`,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below is checked against the actual
// backend command:
//   ffmpeg -y -i <input> -vn -map 0:a:0 -c:a pcm_s16le <output>.wav
// No guaranteed-timing claims, since extraction speed depends on the source.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "MP4 to WAV & MOV to MP3 Converter",
  // alternateName carries the head terms as standalone entity labels, which
  // helps Google associate the page with each query independently.
  alternateName: [
    "MP4 to WAV Converter",
    "MOV to MP3 Converter",
    "MOV to WAV Converter",
    "Video to Audio Converter",
  ],
  url: `${SITE_URL}/video-to-audio`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Convert MP4 to WAV",
    "Convert MOV to MP3",
    "Convert MOV to WAV",
    "Convert MP4 to MP3",
    "Extract audio from MP4, MOV, MKV, AVI, WebM, and more",
    "Output as WAV, MP3, FLAC, M4A, AAC, OGG, or AIFF",
    "16-bit PCM WAV output at the source sample rate",
    "Direct audio extraction for compatible M4A/AAC sources",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "MP4 to WAV & MOV to MP3 Converter",
      item: `${SITE_URL}/video-to-audio`,
    },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

// Ordered by verified search volume (ahrefs, Aug 2026):
//   mp4 to wav   >10,000/mo
//   mov to mp3   >10,000/mo
//   mov to wav    >1,000/mo
// Head terms lead the table so the first rows a crawler reads are the ones
// the page is actually competing for.
const FORMAT_PAIRS = [
  { from: "MP4", to: "WAV" },
  { from: "MOV", to: "MP3" },
  { from: "MOV", to: "WAV" },
  { from: "MP4", to: "MP3" },
  { from: "MP4", to: "M4A" },
  { from: "MKV", to: "MP3" },
  { from: "WebM", to: "MP3" },
  { from: "AVI", to: "WAV" },
];

// 16-bit PCM at the given rate and channel count, in decimal MB
// (1 MB = 1,000,000 bytes), which is how macOS and Windows report file size.
//   bytes/sec = sample_rate × 2 bytes × channels
// The backend passes -c:a pcm_s16le with NO -ar and NO -ac, so rate and
// channel count are inherited from the source. Don't state a fixed rate.
const WAV_SIZE_TABLE = [
  { source: "48 kHz stereo", perMinute: "11.5 MB", tenMinutes: "115 MB" },
  { source: "44.1 kHz stereo", perMinute: "10.6 MB", tenMinutes: "106 MB" },
  { source: "48 kHz mono", perMinute: "5.8 MB", tenMinutes: "58 MB" },
  { source: "44.1 kHz mono", perMinute: "5.3 MB", tenMinutes: "53 MB" },
];

// Slugs verified against lib/data/tools.ts. The previous version of this
// list shipped /key-bpm-finder and /stem-separation, neither of which
// exists — the registry uses "key-finder" and "stems". Two 404s sat in the
// one section on this page that competitors structurally can't copy.
const AFTER_EXTRACTION = [
  {
    href: "/key-finder",
    label: "Key & BPM detection",
    body: "for a live set recording or a reference track pulled from a video.",
  },
  {
    href: "/stems",
    label: "Stem separation",
    body: "split the extracted audio into vocals, drums, bass, and other.",
  },
  {
    href: "/audio-to-text",
    label: "Audio to Text",
    body: "transcribe an interview or lecture, with timestamps and SRT export.",
  },
  {
    href: "/audio-to-midi",
    label: "Audio to MIDI",
    body: "convert a melody or riff from the video into notes you can edit.",
  },
];

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
    answer:
      "Yes — MP3 is one of the seven output formats available, alongside WAV, FLAC, M4A, AAC, OGG, and AIFF.",
  },
  {
    question: "What sample rate and bit depth is the WAV output?",
    answer:
      "WAV output is 16-bit PCM. The sample rate and channel count come from the source video and aren't changed — a 48 kHz stereo source gives a 48 kHz stereo WAV. There's no resampling and no downmix to mono.",
  },
  {
    question: "How big will the extracted WAV file be?",
    answer:
      "Roughly 11.5 MB per minute for 48 kHz stereo audio, or 10.6 MB per minute at 44.1 kHz. Mono sources are about half that. A 10-minute video produces a WAV of roughly 100 to 115 MB, which is often larger than the source video itself.",
  },
  {
    question: "My video has multiple audio tracks — which one is extracted?",
    answer:
      "The first audio track in the file. Videos with alternate language tracks or separate microphone channels will produce only that first track; there's no track selector at the moment.",
  },
  {
    question: "What video formats can I upload?",
    answer: "MP4, MOV, MKV, AVI, WebM, FLV, WMV, M4V, 3GP, MPEG, and MPG.",
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
    answer: "Up to 200MB per upload, and up to 60 minutes of video.",
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
    // Corrected: conversion happens server-side via ffmpeg, not in the
    // browser. The previous "runs entirely online in your browser" wording
    // was inaccurate and contradicted the retention answer below.
    question: "Do I need to install software?",
    answer:
      "No — there's no app or plugin to install. You upload the video through your browser, it's converted on the server, and you download the audio file. Nothing runs locally on your machine.",
  },
  {
    question: "Are my uploaded video files kept?",
    answer:
      "No — the uploaded video is deleted from the server as soon as the conversion finishes. There are no accounts, so nothing is linked to you, published, or shared.",
  },
  {
    // Rewritten. This used to send people to extract audio first and then
    // upload it somewhere else — a two-step that's no longer necessary, and
    // bad advice on a page whose whole subject is video files.
    question: "Can I get a transcript from my video without converting it first?",
    answer:
      "Yes — Video to Text takes MP4, MOV, MKV and WEBM directly and returns a transcript with timestamps, plus SRT or VTT subtitle export. Use this converter when you want the audio file itself; use that one when text is all you're after.",
    answerNode: (
      <>
        Yes —{" "}
        <Link
          href="/video-to-text"
          prefetch={false}
          className="text-amber-400 hover:underline"
        >
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

export default function VideoToAudioPage() {
  const relatedTools = getRelatedTools("video-to-audio", 5);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free MP4 to WAV &amp; MOV to MP3 Converter
          </h1>
          {/* Both head terms appear in the first 20 words of body copy, in
              their natural query order, before any secondary format names. */}
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Convert MP4 to WAV, MOV to MP3, or MOV to WAV online. Extract audio
            from any video file to WAV, MP3, M4A, FLAC and more — free, no
            sign-up, no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <VideoToAudioForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Any video format", desc: "MP4, MOV, MKV, AVI, WebM, and more." },
            { title: "7 audio formats", desc: "WAV, MP3, FLAC, M4A, AAC, OGG, AIFF." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2"
            >
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* H2 written to match the "how to convert mp4 to wav" long-tail
            (>100/mo) rather than a generic "how it works" heading. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            How to convert MP4 to WAV or MOV to MP3
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>
              Upload your MP4, MOV, MKV, AVI, WebM, or other supported video
              file.
            </li>
            <li>
              Choose an output format — WAV for uncompressed audio, MP3 for a
              small file, or M4A/AAC for the fastest extraction when the source
              already contains compatible AAC audio.
            </li>
            <li>Download the extracted audio file.</li>
          </ol>
        </section>

        {/* Two dedicated sections give each >10,000/mo head term its own
            substantive block of unique content, rather than sharing one
            generic paragraph. This is what lets Google treat both queries
            as independently well-served by the page. */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text-primary">
            Convert MP4 to WAV
          </h2>
          <p className="text-text-muted leading-relaxed">
            MP4 is the most common video container, and its audio track is
            usually AAC. Converting MP4 to WAV produces an uncompressed file
            that&apos;s suited to editing in a DAW, importing into a
            video-editing timeline, or any workflow where you need audio that
            isn&apos;t re-compressed on every save. Upload your MP4 above,
            choose WAV as the output, and download the extracted track — this
            MP4 to WAV converter has no encoder settings to configure.
          </p>
          <p className="text-text-muted leading-relaxed">
            Keep in mind that WAV output decodes the original AAC audio and
            writes it out uncompressed. The file will be larger, but it
            won&apos;t sound better than the source — see{" "}
            <a href="#wav-quality" className="text-amber-400 hover:underline">
              why lossless output doesn&apos;t restore lost detail
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text-primary">
            Convert MOV to MP3
          </h2>
          <p className="text-text-muted leading-relaxed">
            MOV is Apple&apos;s QuickTime container — the format behind iPhone
            videos, Mac screen recordings, and Final Cut Pro exports.
            Converting MOV to MP3 strips the video track and compresses the
            audio into a small, universally compatible file. That&apos;s
            useful for pulling a voice memo, interview, or narration out of a
            clip without carrying the full video file size around.
          </p>
          <p className="text-text-muted leading-relaxed">
            Upload the .mov file above and select MP3 as the output format.
            The converter handles QuickTime&apos;s audio codecs automatically,
            so there&apos;s nothing to configure beyond picking the format —
            and like every tool here, the MOV to MP3 converter is free with no
            daily upload cap.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-text-primary">
            Convert MOV to WAV
          </h2>
          <p className="text-text-muted leading-relaxed">
            If you need the audio from a MOV file for editing rather than
            listening, convert MOV to WAV instead of MP3. WAV keeps the audio
            uncompressed after decoding, which avoids stacking a second round
            of lossy compression on top of whatever the camera or screen
            recorder already applied. It&apos;s the right choice when the
            extracted audio is going into a DAW, a mix, or a transcription
            pipeline rather than straight onto a phone.
          </p>
        </section>

        {/* Output specs — the differentiator. No competitor in this SERP
            states them or does the file-size arithmetic, and it's the section
            most likely to get cited by AI answer engines because it contains
            concrete verifiable numbers instead of marketing adjectives.
            Claims here describe the WAV path only; MP3/FLAC/M4A/AAC/OGG/AIFF
            use different encoder flags that haven't been verified yet. */}
        <section id="wav-output-spec" className="space-y-6">
          <h2 className="text-2xl font-bold text-text-primary">
            What the extracted WAV file actually contains
          </h2>

          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              WAV output is written as 16-bit PCM. The sample rate and channel
              layout are carried over from the source video rather than forced
              to a fixed value — a 48 kHz stereo recording produces a 48 kHz
              stereo WAV, and a 44.1 kHz mono recording produces a 44.1 kHz mono
              WAV. There is no resampling step and no downmix, so nothing is
              altered beyond decoding the compressed source audio and writing it
              out uncompressed.
            </p>
            <p>
              If your video contains more than one audio track — alternate
              language tracks, or separate microphone channels from a multi-cam
              recording — the first audio track is the one extracted. There is
              currently no track picker.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-text-primary">
              How large will the WAV file be?
            </h3>
            <p className="text-text-muted leading-relaxed">
              Uncompressed audio is considerably larger than the video it came
              from. A 12 MB phone clip can produce a WAV several times that
              size, which surprises people expecting the audio-only file to be
              smaller. Sizes for 16-bit PCM:
            </p>
            <div className="overflow-x-auto rounded-xl border border-graphite-800">
              <table className="w-full text-sm text-left text-text-muted">
                <caption className="sr-only">
                  WAV file size by source sample rate and channel count
                </caption>
                <thead className="bg-graphite-900 text-text-primary">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Source audio
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Per minute
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      10-minute video
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800">
                  {WAV_SIZE_TABLE.map((row) => (
                    <tr key={row.source}>
                      <td className="px-4 py-3">{row.source}</td>
                      <td className="px-4 py-3 font-mono">{row.perMinute}</td>
                      <td className="px-4 py-3 font-mono">{row.tenMinutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-text-muted leading-relaxed">
              At the 60-minute upload ceiling, a 48 kHz stereo source produces a
              WAV of roughly 690 MB. If you only need the audio for listening or
              sharing, MP3 or M4A will be a small fraction of that size. Choose
              WAV when the file is going into a DAW or an editing timeline.
            </p>
          </div>
        </section>

        {/* Renamed from "Convert MP4 to WAV, MOV to MP3, and More" — that
            heading duplicated the two dedicated H2s above and diluted them.
            This section is now clearly the catch-all, not a third contender. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Every supported video and audio format combination
          </h2>
          <p className="text-text-muted leading-relaxed">
            The same converter handles any combination of supported video and
            audio formats — upload once, then pick whichever output your project
            needs:
          </p>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <caption className="sr-only">
                Supported video input formats and their audio output formats
              </caption>
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    From
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    To
                  </th>
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
          <p className="text-text-muted leading-relaxed">
            These are just examples — every supported video format converts to
            any of the seven audio output formats, not only the pairs shown
            here.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Why M4A/AAC can be the fast option
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Many video files already contain audio encoded as AAC. When the
              source audio is compatible, extracting it to M4A or AAC can copy
              the existing audio stream into an audio-only file without
              re-encoding it. That avoids an unnecessary quality conversion and
              can make the extraction substantially faster.
            </p>
            <p>
              Other output formats such as WAV, MP3, FLAC, OGG, and AIFF
              generally require the audio to be decoded and processed into the
              new format, which takes additional processing time.
            </p>
            <p>
              {/* FIX: link text now matches the guide's actual title in
                  lib/data/guides.ts ("Why M4A Extraction Is Instant (WAV
                  Isn't)"). It previously read "Why Extracting Audio to M4A Is
                  Instant (and WAV Isn't)" — a title that doesn't exist.
                  Anchor text that misstates the destination's title is a weak
                  relevance signal and confuses the reader on arrival. */}
              Want the fuller breakdown of what a stream copy actually is, and
              when lossless output genuinely helps versus when it&apos;s just a
              bigger file?{" "}
              <Link
                href="/guides/why-m4a-extraction-is-instant"
                prefetch={false}
                className="text-amber-400 hover:underline"
              >
                Read Why M4A Extraction Is Instant (WAV Isn&apos;t)
              </Link>
              .
            </p>
          </div>
        </section>

        <section id="wav-quality" className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            WAV and FLAC don&apos;t add quality back
          </h2>
          <p className="text-text-muted leading-relaxed">
            A common assumption is that WAV or FLAC output is automatically
            higher quality. If the video&apos;s original audio was AAC, it has
            already gone through lossy compression. Wrapping or converting that
            audio into a lossless format afterward can&apos;t recover detail
            that was already discarded. It simply produces a larger file
            containing the processed audio. Lossless output is most useful when
            the source audio was itself lossless.
          </p>
        </section>

        {/* Added: the one case where the honest answer is "don't use this
            page". Someone who only wants the words gets a smaller, faster
            result from /video-to-text, and sending them there beats having
            them extract a 115 MB WAV they'll delete. It also passes a link
            from a page ranking on >10,000/mo head terms to a brand-new one,
            which is the cheapest authority transfer available. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            If you only need the words, skip this step
          </h2>
          <p className="text-text-muted leading-relaxed">
            Extracting audio purely to transcribe it is a detour.{" "}
            <Link
              href="/video-to-text"
              prefetch={false}
              className="text-amber-400 hover:underline"
            >
              Video to Text
            </Link>{" "}
            takes the MP4, MOV, MKV or WEBM directly and returns the transcript
            — no intermediate WAV to download, and no second upload. You get
            timestamps and SRT or VTT subtitle export from the same run.
          </p>
          <p className="text-text-muted leading-relaxed">
            Use this converter instead when you want the audio file itself: to
            edit in a DAW, to keep as an archive, or to run through cleanup
            before doing anything else with it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            What people use this converter for
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Pulling the soundtrack from a screen recording, extracting an
              interview or podcast&apos;s audio from a video recording, getting
              a WAV out of a phone video for editing, and preparing audio from a
              video file for further processing.
            </p>
            <p>
              Need a specific section of the extracted audio rather than the
              whole thing? Trim it down afterward with the{" "}
              <Link
                href="/trim"
                prefetch={false}
                className="text-amber-400 hover:underline"
              >
                Audio Trimmer
              </Link>
              .
            </p>
          </div>
        </section>

        {/* The producer/DJ workflow is the one thing on this page that
            CloudConvert, FreeConvert, Convertio and Zamzar structurally can't
            copy. Naming it as a workflow rather than burying it in the
            undifferentiated tool grid is what turns a commodity converter
            into a reason to come back.
            Slugs now driven by AFTER_EXTRACTION above and checked against
            lib/data/tools.ts — two of the four were previously 404s. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            After the WAV: what you can do with it here
          </h2>
          <p className="text-text-muted leading-relaxed">
            Extraction is usually the first step rather than the last one. Once
            you have the audio file, the rest of the workflow runs on this site
            without re-uploading to a different service:
          </p>
          <ul className="space-y-2 text-text-muted leading-relaxed">
            {AFTER_EXTRACTION.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  className="text-amber-400 hover:underline"
                >
                  {item.label}
                </Link>{" "}
                — {item.body}
              </li>
            ))}
          </ul>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">
              More free tools
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                // prefetch disabled on bulk tool links sitewide — these
                // otherwise burn Vercel Edge Requests on every page view.
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  prefetch={false}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">
                    {tool.name}
                  </h3>
                  <p className="text-sm text-text-muted mt-1">
                    {tool.shortDescription}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}