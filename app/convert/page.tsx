import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ConvertForm } from "@/components/converter/ConvertForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
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
const PAGE_TITLE = "Free Audio Converter — MP3, WAV, M4A, FLAC & More";
const PAGE_DESCRIPTION =
  "Free online audio converter — convert between MP3, WAV, M4A, FLAC, AAC, OGG and AIFF, any format to any other. Fast, no sign-up, no watermark on the output.";

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
const EXAMPLE_PAIRS = [
  ["M4A", "MP3"],
  ["MP3", "WAV"],
  ["WAV", "MP3"],
  ["FLAC", "MP3"],
  ["WAV", "FLAC"],
  ["AIFF", "MP3"],
  ["OGG", "MP3"],
  ["AAC", "WAV"],
];

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
      answer: `Any of ${formatList} — every format converts to every other one.`,
    },
    {
      // Reabsorbed from the deleted /m4a-to-mp3 page. The head long-tail for
      // that intent now has a literal on-page answer here, on the hub.
      question: "How do I convert M4A to MP3 without iTunes?",
      answer:
        "Upload the .m4a above and choose MP3 as the output — that's the whole thing. It runs in your browser on any device, so there's no iTunes, Music app, or GarageBand involved, and nothing to install on Windows or Mac. Both M4A and MP3 are compressed, so this is a compatibility change, not a quality one — the MP3 plays on car stereos, older players, and hardware that rejects Apple's format.",
    },
    {
      question: "Does converting MP3 to WAV improve quality?",
      answer:
        "No. Converting a lossy file like MP3 to a lossless format like WAV repackages the audio but doesn't restore data the original MP3 encoding already discarded — the file gets larger, not higher quality.",
    },
    {
      question: "Is this really free?",
      answer: "Yes — every conversion is free, with no sign-up and no watermark on the output file.",
    },
    {
      question: "How long does conversion take?",
      answer: "Usually just a few seconds, much faster than tools that process a full audio separation.",
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Uploads are limited to ${limits.maxUploadMb}MB per file. There's no length limit — converting between formats is quick enough that a long recording is fine.`
          : `Uploads are limited to ${limits.maxUploadMb}MB per file, and up to ${durationLabel(durationCap)} of audio.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio Converter" }]} />
        }
        /* SHORT H1, LONG TITLE TAG — deliberately different.
           The <title> carries all three head pairs because the SERP rewards
           exact-match placement. The H1 is read by someone who has already
           clicked and only needs to know they are in the right place; three
           format pairs stacked over two lines reads as a keyword list. The
           pairs move to the lede, still inside the first 20 words of body
           copy for a crawler, but as a sentence. */
        title="Free Audio Converter"
        lede="Convert between MP3, WAV, M4A, FLAC, AAC, OGG and AIFF — any format to any other, free, no sign-up, no watermark."
        tool={<ConvertForm />}
      >
        <FeatureStrip
          features={[
            { title: "Fast", desc: "Most conversions finish in a few seconds." },
            // Counted, not typed. An eighth format on the backend used to mean
            // this line quietly said "7".
            { title: `${formats.length} formats`, desc: "Any format converts to any other format." },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ]}
        />

        <ToolSection id="how-to" title="How to convert an audio file">
          <ol>
            <li>Upload any {formatList} file.</li>
            <li>Choose the output format you need.</li>
            <li>Click Convert.</li>
            <li>Download the converted file — usually ready in a few seconds.</li>
          </ol>
        </ToolSection>

        <ToolSection id="formats" title="Supported formats" bleed>
          <Prose>
            <p>
              Every format below converts to every other one — upload any of
              these, pick any other as your target:
            </p>
          </Prose>
          {/* Rendered from the backend's allowed_audio_formats. A hand-written
              array here is how /stems ended up omitting AIFF from a list of
              formats it happily accepted. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {formats.map((fmt) => (
              <span
                key={fmt}
                className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
              >
                {fmt}
              </span>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Convert to WAV or FLAC when you need lossless audio for editing or
              DJ software. Convert to MP3 or AAC when file size and easy sharing
              matter more than absolute quality. Note: converting a lossy format
              (like MP3) to a lossless one (like WAV or FLAC) repackages the
              audio but doesn&apos;t recover any quality already lost in the
              original encoding.
            </p>
          </Prose>
        </ToolSection>

        {/* M4A->MP3 no longer has a dedicated page (/m4a-to-mp3 deleted
            2026-09-04), so the hub owns this intent again. This is the full
            treatment now — it converts here rather than pointing at a page
            that no longer exists. */}
        <ToolSection id="m4a-to-mp3" title="Convert M4A to MP3 without iTunes">
          <p>
            M4A is what an iPhone voice memo, a Mac screen recording, and most Apple Music
            downloads come out as. It plays fine on Apple devices — and then fails on the one
            thing that matters: a car head unit, an older MP3 player, a USB stick in a rental
            car, or Windows software that only reads MP3. Converting to MP3 fixes that.
          </p>
          <p>
            Upload the .m4a above and choose MP3 — that&apos;s all there is to it. It runs in
            the browser on any device, so there&apos;s no iTunes, no Music app, and nothing to
            install. Both formats are compressed, so this is a compatibility change rather than
            a quality one: you&apos;re changing what can play the file, not improving or degrading
            the audio. If the M4A is instead headed into a DAW or a sampler, choose WAV so
            you&apos;re not stacking a second lossy generation before you process it.
          </p>
        </ToolSection>

        {/* Pointers to the two dedicated WAV/MP3 pages — short, not a second
            copy of their content, so nothing duplicates. */}
        <ToolSection id="wav-mp3-pages" title="Converting between WAV and MP3?">
          <p>
            Those two go both ways and each has a dedicated page with file-size math and the honest
            quality story: use the{" "}
            <Link href="/wav-to-mp3">WAV to MP3 converter</Link> to shrink a big uncompressed file
            for sharing, or the <Link href="/mp3-to-wav">MP3 to WAV converter</Link> to get an
            uncompressed file for editing. You can also do either right here.
          </p>
        </ToolSection>

        <ToolSection id="examples" title="A few common conversions" bleed>
          <Prose>
            <p>
              These are just examples — every format above converts to every
              other one, not only the pairs shown here:
            </p>
          </Prose>
          {/* Was an eight-row table. Eight from/to pairs are chips, not a
              tabulated dataset. */}
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLE_PAIRS.map(([from, to]) => (
              <span
                key={`${from}-${to}`}
                className="rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-1.5 font-mono text-[13px] text-text-muted"
              >
                {from} <span className="text-amber-500">→</span> {to}
              </span>
            ))}
          </div>
        </ToolSection>

        {/* Was a two-column table with a header row. Format and "best for" is a
            term/definition pair. */}
        <ToolSection id="which-format" title="Which format should you pick?">
          <dl className="codes">
            {FORMAT_GUIDE.map(([fmt, use]) => (
              <Fragment key={fmt}>
                <dt>{fmt}</dt>
                <dd>{use}</dd>
              </Fragment>
            ))}
          </dl>
          <p>
            Want the deeper technical explanation of lossless vs. lossy, and why
            converting up to WAV doesn&apos;t recover lost quality?{" "}
            <Link href="/guides/lossless-vs-lossy-audio-formats">
              Read Lossless vs Lossy Audio: Which Format to Use
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="sources" title="Works with files from anywhere">
          <p>
            Since conversion works on the file format itself rather than where it
            came from, this handles exports from Audacity, Adobe Audition,
            Ableton Live, Logic Pro, FL Studio, GarageBand, OBS, Premiere Pro,
            DaVinci Resolve, or anywhere else — as long as the file is one of the
            formats above.
          </p>
          <p>
            Need to trim, reverse, or adjust a file before or after converting
            it? The <Link href="/trim">Audio Trimmer</Link>,{" "}
            <Link href="/pitch">Pitch Shifter</Link>, and{" "}
            <Link href="/tempo">Tempo Changer</Link> all work on any of these
            formats too.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}