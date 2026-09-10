import type { Metadata } from "next";
import Link from "next/link";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/*
  GENERAL HUB. Bing Keyword Research, three months to 30 Aug 2026:

    m4a to mp3            35.9K   <- /m4a-to-mp3 DELETED 2026-09-04; reabsorbed here
    mp3 to wav            33.7K   <- own page /mp3-to-wav
    wav to mp3            26.1K   <- own page /wav-to-mp3
    online audio converter 22.5K  <- this page's core target

  Targets the general terms — "audio converter", "online audio converter",
  "free audio converter" — and links to the dedicated wav<->mp3 pages, which
  own those two exact phrases. M4A->MP3 no longer has a dedicated page, so this
  hub picks that intent back up: the phrase is carried in schema alternateName,
  a FAQ, and an on-page section that converts here rather than linking away.
  It does NOT lead with wav<->mp3 in the title/lede, so it doesn't self-compete
  with those two pages.

  `absolute`, so the root template's " | AudioForges" isn't appended.
*/
const PAGE_TITLE = "Audio Converter – MP3, WAV, M4A, FLAC & More";
const PAGE_DESCRIPTION =
  "Free online audio converter — convert between MP3, WAV, M4A, FLAC, AAC, OGG and AIFF, any format to any other. No sign-up, no watermark.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("convert", "Free audio converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/convert` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/convert`,
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

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Free Audio Converter",
  // General converter terms, plus M4A->MP3 reabsorbed from the deleted
  // dedicated page so this hub is the entity that owns that phrase now.
  alternateName: [
    "Audio Converter",
    "Online Audio Converter",
    "Free Audio Converter",
    "Online MP3 Converter",
    "M4A to MP3 Converter",
    "Convert M4A to MP3",
  ],
  url: `${SITE_URL}/convert`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert between MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF",
    "Convert M4A to MP3 without iTunes",
    "Any format to any other format",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Ordered by measured volume, head pairs first: m4a to mp3 35.9K, mp3 to wav
// 33.7K, wav to mp3 26.1K. The rest are illustrative.

// Deliberately NOT generated from the format list: each entry is a judgement
// about when to use that format and there's nothing in the API to derive it
// from. If a new format appears in the badges, add a row here.
const FORMAT_GUIDE = [
  ["MP3", "Sharing, casual listening, small file size"],
  ["WAV", "Editing, sampling, DJ software — lossless"],
  ["FLAC", "Archiving at full quality with a smaller footprint than WAV"],
  ["M4A", "Apple devices and Apple Music/iTunes compatibility"],
  ["AAC", "Mobile and streaming — similar to MP3, often smaller at equal quality"],
  ["OGG", "Open-source software and games"],
  ["AIFF", "Professional editing on Apple/Logic-based workflows — lossless"],
];

export default async function ConvertPage() {
  const relatedTools = getRelatedTools("convert", 5);

  // Server-side, cached an hour, falls back to the hand tables if the backend
  // is unreachable. Never import into a client component.
  const limits = await getLimits();

  // Bare lowercase from the API ("mp3"); uppercase is a display choice.
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", and $1");

  /*
    NULL here, and that's the correct answer rather than a missing one.
    /convert is the only route passing check_duration=False, so applying the
    3600 default would advertise a limit the server doesn't enforce and turn
    away files it accepts. When this pattern is copied to another page, the
    null branch is the bit to keep.
  */
  const durationCap = durationCapFor(limits, "convert");

  const retention = retentionSentences(limits.retention.audio_tools);

  const faqs = [
    {
      question: "What formats can I convert between?",
      answer: `Any of ${formatList}, every format converts to every other one.`,
    },
    {
      // Reabsorbed from the deleted /m4a-to-mp3 page. The head long-tail for
      // that intent now has a literal on-page answer here, on the hub.
      question: "How do I convert M4A to MP3 without iTunes?",
      answer:
        "Upload the .m4a above and choose MP3 as the output, that's the whole thing. It runs in your browser on any device, so there's no iTunes, Music app, or GarageBand involved, and nothing to install on Windows or Mac. Both M4A and MP3 are compressed, so this is a compatibility change, not a quality one, the MP3 plays on car stereos, older players, and hardware that rejects Apple's format.",
    },
    {
      question: "Does converting MP3 to WAV improve quality?",
      answer:
        "No. Converting a lossy file like MP3 to a lossless format like WAV repackages the audio but doesn't restore data the original MP3 encoding already discarded, the file gets larger, not higher quality.",
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Uploads are limited to ${limits.maxUploadMb}MB per file. There's no length limit, converting between formats is quick enough that a long recording is fine.`
          : `Uploads are limited to ${limits.maxUploadMb}MB per file, and up to ${durationLabel(durationCap)} of audio.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  const sizeLabel =
    durationCap === null
      ? `${limits.maxUploadMb}MB per upload, no length limit`
      : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio Converter" }]} />}
        meta={["No account", "Any to any", "Lossless stays lossless"]}
        title="Audio Converter"
        lede={`Convert between ${formatList}. Any format to any other, free, no sign-up, and the page tells you when a conversion cannot improve anything.`}
        tool={<ConvertForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Formats",
              value: formatList,
              note: "Every pair works in both directions. Sample rate and channels are left as they are.",
            },
            {
              label: "Lossy output",
              value: "MP3 at 320 kbps CBR",
              note: "Fixed, not selectable. Transparent for listening; the highest rate MP3 supports.",
            },
            {
              label: "Limits",
              value: sizeLabel,
              note: "The only tool on the site with no duration cap. Uploads are deleted on completion.",
            },
          ]}
        />

        <ToolSection id="what-changes" title="What each direction does to the audio" bleed>
          <CompareTable
            columns={["To lossless (WAV, AIFF, FLAC)", "To lossy (MP3, AAC, M4A, OGG)"]}
            highlight={-1}
            rows={[
              {
                label: "From lossless",
                cells: [
                  { state: "yes", text: "Nothing changes. Same audio, different wrapper. FLAC is about half the size of WAV" },
                  { state: "partial", text: "One lossy pass. At 320 kbps you will not hear it, but keep the original if you will edit again" },
                ],
              },
              {
                label: "From lossy",
                cells: [
                  { state: "partial", text: "Bigger, not better. Decoded once and written out; what the first encoder discarded stays gone" },
                  { state: "no", text: "A second generation of loss on top of the first. Do it only when the target device demands it" },
                ],
              },
            ]}
            footnote="Rule of thumb: convert toward lossless when the file is going to be edited, toward lossy when it is going to be played."
          />
        </ToolSection>

        <ToolSection id="which" title="Which format to pick" bleed>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FORMAT_GUIDE.map(([fmt, use]) => (
              <div key={fmt} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-mono text-sm font-semibold text-amber-400">{fmt}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{use}</p>
              </div>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              The common jobs have their own pages with the specifics: <Link href="/mp3-to-wav">MP3 to WAV</Link>,{" "}
              <Link href="/wav-to-mp3">WAV to MP3</Link>, and for a video file,{" "}
              <Link href="/video-to-audio">video to audio</Link>. M4A to MP3 is the one people ask about most, and
              it is just the converter above: no iTunes, no app, and the file works on anything that plays MP3.
            </p>
          </Prose>
        </ToolSection>

        <ToolVideo slug="convert" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="You are responsible for having the right to process any file you upload. AudioForges does not host or distribute the files processed here."
        />
      </ToolPageShell>
    </>
  );
}