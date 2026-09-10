import type { Metadata } from "next";
import Link from "next/link";
import { ReverseForm } from "@/components/converter/ReverseForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { ogForTool } from "@/lib/og";
import { getRelatedTools } from "@/lib/data/tools";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

// Every limit on this page comes from /limits. Don't type one in by hand —
// hand-written duration caps have been wrong, always understated, on more
// than half the pages that stated one.

/*
  TITLE. Bing Keyword Research, three months to 30 Aug 2026:

    reverse               32.7K   generic — not this intent
    reverse audio          1.7K   <- larger than "audio reverser", and absent
    audio reverser         1.1K
    reverse singing        979    see below
    reverse voice          644
    voice reverser         544
    reverser               506
    reverse sound          243
    online audio reverser   47

  "Reverse Audio Online" carries the head term, the "online" variant, and
  contains "reverse audio" exactly. "Audio Reverser" stays for its own 1.1K.

  REVERSE SINGING is worth knowing about: reverseplay.org and reverseaudio.fun
  are entire sites built on that one trend — you sing something backwards,
  reverse the recording, and hear what it turns into. This tool does it and the
  page has never mentioned it. Added to the description and alternateName
  rather than the title, which has no room left.

  SERP note (Sep 2026): audioreverser.com, reverse-audio.com and
  reverseaudio.fun are all exact-match domains in the top 10. Tiny cluster
  (~5K excluding the generic term) against three EMDs — low priority.
*/
const PAGE_TITLE = "Reverse Audio Online – Free Audio Reverser";
const PAGE_DESCRIPTION =
  "Reverse audio online free — MP3, WAV, FLAC, AAC, M4A and OGG. Play a track backwards, reverse a voice recording or try reverse singing.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("reverse", "Free Audio Reverser");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/reverse` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/reverse`,
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
  name: "Audio Reverser",
  alternateName: [
    "Reverse Audio",
    "Audio Reverser",
    "Voice Reverser",
    "Reverse Singing Tool",
    "MP3 Reverser",
  ],
  url: `${SITE_URL}/reverse`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Reverse any audio file",
    "Keeps original format",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function ReversePage() {
  const relatedTools = getRelatedTools("reverse", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "reverse");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does reversing reduce audio quality?",
      answer:
        "No. Reversing changes the playback order only, not the underlying audio data. Since the output stays in your original format, there's no additional quality loss beyond that format's normal characteristics.",
    },
    {
      question: "Can I reverse just part of a track?",
      answer:
        "This tool reverses the entire file. If you only want a section reversed, trim the clip you want first, then reverse the trimmed result.",
    },
    {
      question: "Is there a file size or length limit?",
      answer:
        durationCap === null
          ? `Files up to ${limits.maxUploadMb}MB are supported, with no length limit.`
          : `Files up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)} long are supported.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Can I reverse a voice recording?",
      answer:
        "Yes. The tool works with voice recordings, podcasts, music, sound effects, and any other supported audio file.",
    },
  ];
  const limitLabel =
    durationCap === null ? `${limits.maxUploadMb}MB per upload` : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Reverse Audio" }]} />}
        meta={["No account", "Sample-exact", "Format kept"]}
        title="Reverse Audio"
        lede="Play a file backwards and download it. Every sample is flipped end to end, nothing is resampled, and the output keeps your format. Free, no sign-up."
        tool={<ReverseForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "What it does",
              value: "Flips the sample order, end to end",
              note: "The last sample becomes the first. No decode-and-guess, no speed change, no pitch change.",
            },
            {
              label: "Quality",
              value: "Nothing lost, nothing added",
              note: "Reversing is one of the few edits that is exactly reversible: run it twice and you have the original back.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="uses" title="What people reverse, and why" bleed>
          <CompareTable
            columns={["The effect", "How to use it"]}
            highlight={-1}
            rows={[
              { label: "Reverse reverb", cells: [{ text: "A swell that builds into the note instead of trailing after it" }, { text: "Reverse the phrase, add reverb, reverse the result. Line the tail up with the downbeat" }] },
              { label: "Reverse cymbal or riser", cells: [{ text: "The classic build into a drop" }, { text: "Reverse a crash or a held chord. Trim so the loudest point lands on beat one" }] },
              { label: "Backwards vocal", cells: [{ text: "Texture that sounds like speech without being readable" }, { text: "Reverse a spoken line, pitch it down a few semitones, tuck it under the mix" }] },
              { label: "Ear training and transcription", cells: [{ text: "Hearing a fast run in a new way" }, { text: "Reverse the passage, then slow it down with the tempo changer" }] },
            ]}
            footnote="Reversing the whole file is what this page does. To reverse one section, trim it out first, reverse the clip, then join it back."
          />
          <Prose className="mt-5">
            <p>
              <Link href="/trim">Trim</Link> the section first if you only need part of it,{" "}
              <Link href="/tempo">slow it down</Link> to study it, and <Link href="/audio-joiner">join</Link> the
              pieces back when you are done.
            </p>
          </Prose>
        </ToolSection>

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