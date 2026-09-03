import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Free YouTube to WAV Converter — Lossless Audio";
const PAGE_DESCRIPTION =
  "Convert YouTube videos to lossless WAV online for free. No sign-up, no watermark, supports YouTube Shorts, and downloads high-quality audio in seconds.";

const OG_IMAGE = ogForTool("youtube-to-wav", "Free YouTube to WAV Converter");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  /*
    `keywords` removed — ignored by Google since 2009, treated as a spam signal
    by Bing. Target terms kept for reference, since this is the page that
    actually ranks:

      youtube to wav / youtube to wav converter
      free youtube to wav converter / youtube to wav downloader
      youtube to mp3 / yt to wav / youtube wav converter
      convert youtube to wav free / youtube audio downloader
      youtube to wav online / youtube shorts to wav
      youtube video to wav / download youtube audio
  */
  alternates: { canonical: `${SITE_URL}/youtube-to-wav` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-to-wav`,
    siteName: "AudioForges",
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
  name: "YouTube to WAV Converter",
  url: `${SITE_URL}/youtube-to-wav`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert YouTube videos to WAV",
    "Convert YouTube videos to MP3",
    "No sign-up required",
    "No watermark",
    "Supports YouTube Shorts",
  ],
};

// No HowTo schema. Google deprecated HowTo rich results (desktop since Sept
// 2023) and dropped them after, so it earned nothing — and it was a second,
// hand-maintained copy of the four visible steps below, free to drift from
// them. This page was the last one on the site still emitting it.
//
// FAQPage comes from <FAQSection />, BreadcrumbList from <Breadcrumb />.

const FORMAT_COMPARISON = [
  ["File size", "Large (~10MB/min)", "Small (~2.4MB/min at 320kbps)"],
  ["Quality", "Lossless", "Compressed, transparent at 320kbps"],
  ["Editing / sampling", "Ideal — no artifacts to expose", "Fine for reference, riskier for heavy processing"],
  ["DJ software", "Preferred", "Workable"],
  ["Casual listening / sharing", "Overkill on size", "Ideal"],
];

export default async function YouTubeToWavPage() {
  const relatedTools = getRelatedTools("youtube-to-wav", 5);

  const limits = await getLimits();

  /*
    Both were typed as literals, twice each, and both were correct — which is
    exactly what the six wrong literals found elsewhere looked like the day
    before they went wrong.

    The download cap moved source too. It used to be read from the frontend's
    TRANSCRIPTION_LIMITS — an odd home, since it governs the downloader, not
    transcription. /limits publishes it as durations.youtube_download_max_seconds
    now, named without "transcribe" so it can't drift back.
  */
  const rateLimitText = rateLimitLabel(
    limits.rateLimits.download ?? 18,
    windowFor(limits, "download")
  );
  const maxVideoLabel = durationLabel(limits.durations.youtubeDownloadMaxSeconds);

  /*
    THE CACHE WINDOW — the most unusual privacy statement on the site, and the
    backend publishes it as a FOURTH retention shape (`download_cache`) with
    its own fields rather than the input/output pair, because
    input_deleted_when is meaningless for a route that takes no upload.

    "Up to", never "for". `guaranteed` is false because the cache is
    LRU-evicted against a size cap, so the age is a ceiling a given entry may
    never reach. The reader in lib/api/limits defaults that flag to false on an
    unreadable value, so a parse failure can't turn into a promise.
  */
  const cache = limits.downloadCache;
  const cacheDays = Math.round(cache.maxAgeSeconds / 86400);
  const cacheWindow = cache.guaranteed ? `${cacheDays} days` : `up to ${cacheDays} days`;

  const faqs = [
    {
      question: "Is this really free?",
      answer: `Yes — every conversion is free, with no sign-up, no watermark, and nothing to install. The fair-use limit is ${rateLimitText}, which is well past what a normal session needs.`,
    },
    {
      question: "What's the difference between WAV and MP3 here?",
      answer:
        "WAV is lossless 44.1kHz audio — larger files, no compression artifacts. Use it for DJing, sampling, or editing. MP3 is 320kbps CBR — smaller files, transparent enough for casual listening.",
    },
    {
      question: "Does this work with YouTube Shorts?",
      answer:
        "Yes. Standard youtube.com/watch links, short youtu.be links, and /shorts URLs are all supported.",
    },
    {
      question: "How long does conversion take?",
      answer: `Most videos convert to WAV or MP3 in 8–20 seconds. Longer videos take proportionally longer, and the limit is ${maxVideoLabel}.`,
    },
    {
      question: "Does it work on mobile?",
      answer:
        "Yes — the converter works in any mobile browser on iPhone or Android, no app install required.",
    },
    {
      question: "Is downloading YouTube audio legal?",
      answer:
        "It depends on whether you own the content, it's Creative Commons or public domain, or you have permission from the rights holder. You are responsible for how you use the tool.",
    },
    {
      question: "Can I convert very long YouTube videos?",
      answer: `Up to ${maxVideoLabel}. Past that the video is rejected before conversion starts, so you find out immediately rather than after a long wait. Music videos, podcast clips and Shorts are all comfortably inside it.`,
    },
    {
      question: "Does it support YouTube playlists?",
      answer:
        "Not currently — the converter processes one video URL at a time rather than an entire playlist.",
    },
    {
      question: "Why did my conversion fail?",
      answer:
        "The most common reasons are: the video is private, deleted, or removed for copyright; it's geo-restricted and unavailable from our server's location; or YouTube is temporarily requiring extra verification. Trying a different video, or trying again in a few minutes, usually resolves it.",
    },
    {
      question: "Can I use the downloaded audio commercially?",
      answer:
        "Only if you own the content, it's royalty-free or Creative Commons licensed for that use, or you have explicit permission from the rights holder. AudioForges doesn't grant any rights to the content you convert.",
    },
    {
      /*
        The order of these sentences is deliberate: the fact that nothing is
        uploaded comes FIRST, because it's what makes this page's privacy
        answer different in KIND from every other tool's rather than different
        in duration. What's stored is converted audio derived from a public
        video, not anyone's file.

        The key is (video_id, format) with no visitor identity in it, so one
        person's conversion genuinely serves the next person's request for the
        same URL — worth saying plainly rather than leaving as "cached".
      */
      question: "Is my converted file stored?",
      answer: `Nothing is uploaded from your device — you paste a link, and what gets stored is the converted audio, derived from a public video rather than from a file of yours. It's cached ${cacheWindow} so that a repeat request for the same video and format is served instantly, and the cache is keyed on the video and format alone, with nothing identifying you in it. That means someone else converting the same link gets the same cached file. Entries are also evicted early when the cache fills, so ${cacheDays} days is a ceiling rather than a guarantee. There are no accounts, and no record of who converted what.`,
    },
    {
      question: "Can I get FLAC or AIFF instead of WAV or MP3?",
      answer:
        "Not directly from YouTube, but you can convert the WAV output afterward using our free Audio Converter, which supports FLAC, AIFF, and several other formats.",
      answerNode: (
        <>
          Not directly from YouTube, but you can convert the WAV output afterward
          using our free{" "}
          <Link href="/convert" prefetch={false} className="text-amber-400 hover:underline">
            Audio Converter
          </Link>
          , which supports FLAC, AIFF, and several other formats.
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
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "YouTube to WAV" }]} />
        }
        title="Free YouTube to WAV Converter"
        lede="Paste a link and download lossless WAV audio in seconds. No sign-up, no watermark, no app to install."
        tool={<YouTubeConverterForm />}
      >
        {/* The third cell carries the limits, which appeared only in the FAQ
            before. */}
        <FeatureStrip
          features={[
            { title: "Fast", desc: "Most conversions finish in 8–20 seconds." },
            {
              title: "High quality",
              desc: "Lossless WAV or 320kbps MP3 — your choice, every time.",
            },
            {
              title: "No sign-up",
              desc: `No account, no email, no watermark. Videos up to ${maxVideoLabel}.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to convert YouTube to WAV">
          {/*
            The cache sentence here used to read "cached for a short period"
            with no figure — the exact vagueness the FAQ answer was rewritten to
            replace. With the window derived, the page was saying "up to 30
            days" in one place and "a short period" in another. Same constant
            now, so they can't disagree.
          */}
          <p>
            Converting a YouTube video to WAV or MP3 with AudioForges takes four
            steps and no software install. The converter extracts the audio track
            directly from the video URL you provide — you never need to download
            the video itself first. Converted audio is cached {cacheWindow} so a
            repeat request for the same video is served instantly, and nothing
            about it is linked to you: no account, no email, no record of who
            converted what.
          </p>
          <ol>
            <li>Copy a YouTube video, Shorts, or youtu.be URL.</li>
            <li>Paste it into the converter above.</li>
            <li>
              Choose WAV for lossless audio, or MP3 for a smaller file — the{" "}
              <Link href="/youtube-to-mp3">YouTube to MP3 converter</Link> has the
              bitrate and file-size detail if that&apos;s the one you want.
            </li>
            <li>Click Convert and download — usually ready in 8-20 seconds.</li>
          </ol>
          <p>
            If you&apos;re not sure which format to pick: WAV is the better
            default whenever the audio is headed into a DAW, a DJ set, or any kind
            of editing — it hands off every bit of detail in the original
            recording with nothing discarded. MP3 is the better choice when you
            just want a smaller file for listening on a phone or sharing with
            someone else, since 320kbps is transparent enough that most listeners
            won&apos;t hear a difference from the source.
          </p>
        </ToolSection>

        <ToolSection id="why-wav" title="Why convert YouTube to WAV?">
          <p>
            WAV preserves audio without lossy compression, which is exactly what
            matters for sampling, DJ software, music production, audio editing,
            and archival purposes — any workflow where the audio gets processed
            further benefits from starting with every bit of the original
            recording intact. If you&apos;re only planning to listen back or share
            the file as-is, MP3&apos;s much smaller size is usually the more
            practical choice instead — the{" "}
            <Link href="/youtube-to-mp3">YouTube to MP3 converter</Link> is set up
            for that, at 320kbps by default.
          </p>
        </ToolSection>

        <ToolSection id="who-for" title="Who is this for?">
          <p>
            This converter gets used across a range of workflows — pulling a
            reference track before a session, backing up your own uploaded
            content, or getting a clean clip ready for editing:
          </p>
          <ul>
            <li>
              Music producers pulling reference tracks or samples they have the
              rights to use
            </li>
            <li>DJs building a set from tracks they own or have permission to use</li>
            <li>Podcast editors extracting a clip from their own or licensed content</li>
            <li>Video editors grabbing a clean audio bed for a project</li>
            <li>Students and musicians studying a performance or arrangement</li>
          </ul>
          <p>
            Not sure which reference tracks are actually worth pulling?{" "}
            <Link href="/guides/finding-reference-tracks">
              Read How to Find Reference Tracks That Actually Help
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="about" title="About the YouTube to WAV / MP3 converter">
          <p>
            AudioForges&apos; YouTube converter is completely free and extracts
            the audio track from a video URL, delivering it as a clean{" "}
            <strong>WAV</strong> (44.1kHz, uncompressed) or <strong>MP3</strong>{" "}
            (320kbps CBR) file. It supports standard youtube.com/watch, short
            youtu.be, and /shorts links — one video at a time, rather than full
            playlists, up to {maxVideoLabel} long. Both formats run on the same
            endpoint; the{" "}
            <Link href="/youtube-to-mp3">YouTube to MP3 converter</Link> is the
            same tool with MP3 selected and the MP3-specific detail written out.
          </p>
          <p>
            <strong>Common legitimate uses:</strong> downloading your own uploaded
            videos, extracting audio from Creative-Commons or public-domain
            content, saving royalty-free tracks, backing up podcasts you have
            permission to save, and grabbing reference audio for a track you own.
          </p>
        </ToolSection>

        <ToolSection id="wav-vs-mp3" title="WAV vs MP3: which should you choose?" bleed>
          <Prose>
            <p>
              WAV stores the original PCM audio with no compression, which is why
              it&apos;s preferred for editing, sampling, and mastering —
              there&apos;s nothing for further processing to expose. MP3 trades
              some of that data for a much smaller file, which is the right call
              when you&apos;re just listening or sharing rather than processing
              further.
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Feature</th>
                  <th className="px-4 py-3 font-semibold">WAV</th>
                  <th className="px-4 py-3 font-semibold">MP3</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {FORMAT_COMPARISON.map(([feature, wav, mp3]) => (
                  <tr key={feature}>
                    <td className="px-4 py-3">{feature}</td>
                    <td className="px-4 py-3">{wav}</td>
                    <td className="px-4 py-3">{mp3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              If MP3 is what you actually want, the{" "}
              <Link href="/youtube-to-mp3">YouTube to MP3 converter</Link> is the
              page for it — same converter, MP3 preselected, with file sizes and
              an honest account of what 320kbps does and doesn&apos;t recover from
              a YouTube source. Want the full technical breakdown of why the
              choice matters for sampling and production specifically?{" "}
              <Link href="/guides/wav-vs-mp3-for-sampling">
                Read WAV vs MP3 for Sampling: What Actually Changes
              </Link>
              . Need FLAC or AIFF instead? Convert the WAV output using our{" "}
              <Link href="/convert" prefetch={false}>
                Audio Converter
              </Link>
              .
            </p>
          </Prose>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2 — a footnote under the page's content rather than a
            section sitting in the outline beside the real ones. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; fair use</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            This tool is intended for downloading content you own the rights to,
            that is royalty-free or Creative Commons licensed, or that is in the
            public domain. You are solely responsible for ensuring you have the
            right to download and use any content. AudioForges does not host,
            store, or distribute copyrighted material.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}