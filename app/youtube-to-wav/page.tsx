import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeConverterForm } from "@/components/converter/YouTubeConverterForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { BitrateChainDiagram } from "@/components/tools/BitrateChainDiagram";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Free YouTube to WAV Converter – Lossless Audio";
const PAGE_DESCRIPTION =
  "Convert YouTube videos to lossless WAV online for free. No sign-up, no watermark, supports YouTube Shorts, and downloads high-quality audio in seconds.";

const UPDATED = "2026-09-10";

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
  dateModified: UPDATED,
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
      answer: `Yes. Every conversion is free, with no sign-up, no watermark, and nothing to install. The fair-use limit is ${rateLimitText}, which is well past what a normal session needs.`,
    },
    {
      question: "What's the difference between WAV and MP3 here?",
      answer:
        "WAV is lossless 44.1kHz audio, larger files, no compression artifacts. Use it for DJing, sampling, or editing. MP3 is 320kbps CBR, smaller files, transparent enough for casual listening.",
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
        "Yes. The converter works in any mobile browser on iPhone or Android, no app install required.",
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
        "Not currently. The converter processes one video URL at a time rather than an entire playlist.",
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
      answer: `Nothing is uploaded from your device, you paste a link, and what gets stored is the converted audio, derived from a public video rather than from a file of yours. It's cached ${cacheWindow} so that a repeat request for the same video and format is served instantly, and the cache is keyed on the video and format alone, with nothing identifying you in it. That means someone else converting the same link gets the same cached file. Entries are also evicted early when the cache fills, so ${cacheDays} days is a ceiling rather than a guarantee. There are no accounts, and no record of who converted what.`,
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
        meta={["No account", "No watermark", "Lossless WAV"]}
        title="Free YouTube to WAV Converter"
        lede="Paste a link and download lossless WAV audio in seconds. No sign-up, no watermark, no app to install."
        tool={<YouTubeConverterForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Speed",
              value: "8 to 20 seconds, typically",
              note: `Videos up to ${maxVideoLabel}. Anything longer is rejected before conversion starts, not after the wait.`,
            },
            {
              label: "Output",
              value: "Lossless WAV, or 320kbps MP3",
              note: "Same converter either way. Pick the format on the tool above.",
            },
            {
              label: "Nothing of yours is stored",
              value: "No upload, no account",
              note: `The converted audio is cached ${cacheWindow}, keyed on the video and format alone, with nothing identifying you in it.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="Three steps, nothing to install" bleed>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Paste the link", "Any YouTube URL, including Shorts. Copy it from the address bar or the share sheet."],
              ["Pick a format", "WAV for lossless, MP3 for a file about a quarter the size. The rest is automatic."],
              ["Download", `Straight to your device. Fair-use limit is ${rateLimitText}, well past a normal session.`],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <p className="font-mono text-[11px] text-amber-400">Step {i + 1}</p>
                <p className="mt-1.5 font-medium text-text-primary">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <Prose className="mt-5">
            <p>
              It works on any browser, phone or desktop, with nothing to install. Age-restricted, private,
              members-only and region-blocked videos cannot be fetched, and live streams have no finished file to
              pull, so those are the links that fail.
            </p>
          </Prose>
        </ToolSection>

        {/*
          THE POINT OF THIS SECTION: this is the page with the most search
          traffic on the site, and most of it leaves with a file and never sees
          anything else we built. These four are what people actually do with
          YouTube audio next.
        */}
        <ToolSection id="next" title="What to do with the audio next" bleed>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Remove the vocals", "Get an instrumental for karaoke, or the acapella on its own.", "/youtube-vocal-remover", "Skip the download step"],
              ["Split into stems", "Vocals, drums, bass and other as four separate files.", "/youtube-stem-splitter", "Skip the download step"],
              ["Find key and BPM", "Camelot code included, ready for your DJ library.", "/key-finder", "Upload the WAV"],
              ["Convert to something else", "FLAC, AIFF, OGG and more, from the WAV you just made.", "/convert", "Upload the WAV"],
            ].map(([title, desc, href, how]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="group rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
              >
                <p className="font-medium text-text-primary group-hover:text-amber-400">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
                <p className="mt-2 font-mono text-[11px] text-text-subtle">{how}</p>
              </Link>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              For the first two you do not need this page at all: paste the same link into those tools and they
              fetch the audio and separate it in one go.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="what-wav-means" title="What lossless means from a YouTube source" bleed>
          <BitrateChainDiagram
            outputLabel="WAV, 1,411 kbps"
            outputWidth={620}
            ceilingNote="what arrives is what the WAV keeps, with nothing lost and nothing added"
            caption="YouTube serves Opus at roughly 130 to 160 kbps, so no converter can hand you studio quality. What WAV does is stop the chain there: the audio is decoded once into uncompressed PCM and never compressed again. MP3 would compress it a second time. That is the whole difference, and for sampling, DJ software or anything that gets processed further, it is the one that matters."
          />
        </ToolSection>

        <ToolSection id="wav-vs-mp3" title="WAV vs MP3: which should you choose?" bleed>
          <Prose>
            <p>
              WAV stores the original PCM audio with no compression, which is why
              it&apos;s preferred for editing, sampling, and mastering, 
              there&apos;s nothing for further processing to expose. MP3 trades
              some of that data for a much smaller file, which is the right call
              when you&apos;re just listening or sharing rather than processing
              further.
            </p>
          </Prose>
          <CompareTable
            columns={["WAV", "MP3 at 320kbps"]}
            highlight={0}
            rows={[
              {
                label: "File size",
                cells: [
                  { text: "About 10MB per minute", mono: true },
                  { text: "About 2.4MB per minute", mono: true },
                ],
              },
              {
                label: "Compression",
                cells: [
                  { state: "yes", text: "None. Original PCM audio" },
                  { state: "partial", text: "Lossy, transparent for listening" },
                ],
              },
              {
                label: "Editing and sampling",
                cells: [
                  { state: "yes", text: "Nothing for processing to expose" },
                  { state: "partial", text: "Fine as reference, riskier under heavy processing" },
                ],
              },
              {
                label: "DJ software",
                cells: [
                  { state: "yes", text: "Preferred" },
                  { state: "partial", text: "Workable" },
                ],
              },
              {
                label: "Listening and sharing",
                cells: [
                  { state: "partial", text: "Overkill on size" },
                  { state: "yes", text: "Ideal" },
                ],
              },
            ]}
            footnote="Neither recovers what YouTube already compressed away. WAV keeps what arrives intact; MP3 compresses it a second time."
          />
          <Prose className="mt-5">
            <p>
              If MP3 is what you actually want, the{" "}
              <Link href="/youtube-to-mp3">YouTube to MP3 converter</Link> is the
              page for it, same converter, MP3 preselected, with file sizes and
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

        <ToolVideo slug="youtube-to-wav" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="This tool is for content you own, that is royalty-free or Creative Commons licensed, or that is in the public domain. You are responsible for having the right to download and use anything you convert. AudioForges does not host, store or distribute copyrighted material."
        />
      </ToolPageShell>
    </>
  );
}