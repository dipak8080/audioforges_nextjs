import type { Metadata } from "next";
import Link from "next/link";
import { ReverseForm } from "@/components/converter/ReverseForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
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
      question: "What does reversing audio do?",
      answer:
        "It flips the entire file so it plays back to front — the last sound becomes the first, and vice versa.",
    },
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
      question: "Is this really free?",
      answer: "Yes — reversing audio is free, with no sign-up and no watermark on the output.",
    },
    {
      question: "What formats are supported?",
      answer: `${formatList}. The output keeps the same format as your upload.`,
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[
              { name: "Tools", href: "/tools" },
              { name: "Audio Reverser" },
            ]}
          />
        }
        title="Free Audio Reverser"
        lede="Upload a track and get it back flipped backwards, free, no sign-up, no watermark."
        tool={<ReverseForm />}
      >
        <FeatureStrip
          features={[
            { title: "Fast", desc: "Most reversals finish in a few seconds." },
            { title: "One click", desc: "No settings to configure — just upload." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to reverse an audio file">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Click Reverse — nothing to configure.</li>
            <li>Download the reversed file, same format as your upload.</li>
          </ol>
        </ToolSection>

        <ToolSection id="why" title="Why reverse audio?">
          <p>
            Reversed audio is a classic production trick — reversed cymbal swells and
            vocal chops are staples in melodic house, hip-hop, and cinematic sound
            design. It&apos;s also handy for spotting hidden or backmasked content in a
            recording, or just for creative sound experiments.
          </p>
          <p>
            The output keeps your original file format, so a WAV stays a WAV and an
            MP3 stays an MP3 — no extra conversion step needed.
          </p>
        </ToolSection>

        <ToolSection id="reverse-vs-playback" title="Reverse audio vs. reverse playback">
          <p>
            Reversing an audio file here creates an actual new file with every
            sample rearranged in the opposite order — something you can
            download, share, edit, or drop straight into a DAW.
          </p>
          <p>
            Reverse playback is a different thing entirely: some media
            players can temporarily play a file backwards while
            you&apos;re listening, without ever creating a new file — close
            the player and there&apos;s nothing saved. This tool does the
            former, permanently generating a reversed copy you can keep and
            use anywhere, not just a playback trick in one app.
          </p>
        </ToolSection>

        <ToolSection id="quality" title="Does reversing change quality?">
          <p>
            No. Reversing only changes the playback order of the audio — every
            sample stays exactly as it was, just read back to front. Since the
            output keeps your original format, there&apos;s no extra quality loss
            beyond whatever that format&apos;s normal characteristics already are.
            A reversed WAV is exactly as lossless as the WAV you uploaded.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            <strong>Music production:</strong> reversed cymbal swells, risers, and
            vocal chops — staples in melodic house, hip-hop, and cinematic sound
            design.
          </p>
          <p>
            <strong>Sound design &amp; SFX:</strong> flip a recorded sound effect for
            a distinctive texture that a forward sound simply doesn&apos;t have. Need
            to change the speed of the reversed audio too? Run it through the{" "}
            <Link href="/tempo">Audio Speed Changer</Link> afterward.
          </p>
          <p>
            <strong>Backmasking curiosity:</strong> check a track or recording for
            hidden or unintentional content by listening to it in reverse.
          </p>
          <p>
            <strong>Creative experiments:</strong> reverse a voice memo, a field
            recording, or anything else just to hear what it sounds like flipped.
          </p>
          <p>
            Only need part of a track reversed, not the whole file? Trim the
            section you want with the <Link href="/trim">Audio Trimmer</Link>{" "}
            first, then reverse the trimmed clip.
          </p>
          <p>
            Want the deeper explanation of how reversed swells and vocal chops
            are actually built?{" "}
            <Link href="/guides/reversed-audio-in-music-production">
              Read Reversed Audio: Creative Uses in Production
            </Link>
            .
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}