import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { LoudnormForm } from "@/components/converter/LoudnormForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
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
  TITLE — NOT YET MEASURED. Unlike the other tool pages, no Bing Keyword
  Research numbers have been pulled for this cluster, so this is a phrasing
  judgement rather than a data-driven one. Verify before relying on it, and
  record the figures here when you do:

    audio normalizer · normalize audio · loudness normalizer · lufs ·
    normalize audio online · mp3 normalizer · audio volume normalizer

  The reasoning: LUFS is producer vocabulary. Someone who already knows the
  unit is a small, expert slice of the people who want this tool — most search
  "normalize audio" or "audio normalizer" because the problem they have is
  "these tracks are different volumes", not "I need -14 LUFS integrated".
  Leading with LUFS is the same mistake /video-to-audio made leading with
  "MP4 to WAV": precise, and narrower than the audience.

  LUFS stays in the title, just not at position zero — it is what separates
  this from a plain gain tool, and the people searching it are the ones most
  likely to actually use the presets.
*/
const PAGE_TITLE = "Audio Normalizer – Normalize Audio to LUFS, Free";
const PAGE_DESCRIPTION =
  "Free online audio normalizer. Normalize audio to a streaming, club or broadcast LUFS target with two-pass accuracy. No sign-up, no watermark.";

const OG_IMAGE = ogForTool("loudness-normalizer", "Free LUFS Loudness Normalizer");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/loudness-normalizer` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/loudness-normalizer`,
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

// Every claim below is checked against actual LoudnormForm/backend behaviour.
// Preset labels only — NOT asserted as universal cross-platform standards; see
// the visible copy for the caveat.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Normalizer",
  alternateName: [
    "Audio Normalizer",
    "Loudness Normalizer",
    "LUFS Normalizer",
    "Audio Volume Normalizer",
    "MP3 Normalizer",
  ],
  url: `${SITE_URL}/loudness-normalizer`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Two-pass accurate loudness normalization",
    "Streaming, club, and broadcast loudness presets",
    "Custom LUFS target",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

const TARGETS = [
  {
    label: "-14 LUFS — Streaming",
    desc: "A reasonable single target for releasing to multiple streaming platforms at once — close to Spotify's and YouTube's own normalization level.",
  },
  {
    label: "-9 LUFS — Club",
    desc: "Louder, matching common club and DJ mastering conventions where the material is played through a system built for a loud room rather than normalized playback.",
  },
  {
    label: "-23 LUFS — Broadcast",
    desc: "The EBU R128 / ATSC A/85 standard used in TV and radio delivery — considerably quieter than either streaming or club targets.",
  },
  {
    label: "Custom",
    desc: "Useful when a specific platform, client, or delivery spec gives you an exact LUFS target that doesn't match any of the presets above.",
  },
];

export default async function LoudnessNormalizerPage() {
  const relatedTools = getRelatedTools("loudness-normalizer", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "loudness-normalizer");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What is LUFS?",
      answer:
        "Loudness Units relative to Full Scale — a standardized way of measuring perceived loudness across an entire track, rather than just peak level. It's the measurement streaming platforms and broadcasters actually use to normalize playback volume.",
    },
    {
      question: "What LUFS should I master to for Spotify?",
      answer:
        "Spotify's default normalization target is -14 LUFS integrated. Mastering at or near that level means Spotify applies little or no correction on playback, so your track keeps the dynamics you intended rather than getting turned down.",
    },
    {
      question: "Why does this matter for streaming platforms?",
      answer:
        "Streaming services normalize playback loudness rather than playing tracks at whatever level they were mastered, but the exact target isn't identical everywhere. Spotify normalizes to -14 LUFS. Apple Music normalizes closer to -16 LUFS, a bit quieter. A track mastered significantly louder than a platform's target gets turned down on playback and can end up sounding flatter or less punchy than one that was already close to target.",
    },
    {
      question: "What's the difference between the presets?",
      answer:
        "Streaming (-14 LUFS) is a reasonable single target if you're releasing to multiple platforms at once, close to what Spotify normalizes to. Club (-9 LUFS) is louder, matching typical club/DJ mastering conventions. Broadcast (-23 LUFS) follows the EBU R128 / ATSC A/85 standard used in TV and radio.",
    },
    {
      question: "Why two-pass normalization instead of one pass?",
      answer:
        "A single pass estimates the correction in real time as it streams through the file, which can miss the target by a full LU or more on tracks with uneven dynamics. Two-pass first measures the track's actual loudness, true peak, and dynamic range in a dedicated analysis pass, then applies the exact correction needed — the result lands on target far more reliably.",
    },
    {
      question: "Will this affect the dynamic range of my track?",
      answer:
        "Normalization adjusts overall level to hit the target loudness; it doesn't compress or limit the track's internal dynamics beyond what's needed to stay under the true peak ceiling.",
    },
    {
      /*
        The length half matters more here than on most tools: a finished master
        is often the longest file someone uploads anywhere on the site, and a
        DJ set can run well past the cap.
      */
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes — ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio. A long DJ set can run past that; splitting it first is the workaround.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[{ name: "Tools", href: "/tools" }, { name: "Loudness Normalizer" }]}
          />
        }
        title="Free Audio Normalizer"
        lede="Normalize audio to a streaming, club or broadcast LUFS target — free, no sign-up, no watermark."
        tool={<LoudnormForm />}
      >
        <FeatureStrip
          features={[
            {
              title: "Two-pass accurate",
              desc: "Measures actual loudness first, then corrects precisely.",
            },
            {
              title: "3 presets + custom",
              desc: "Streaming, club, broadcast, or your own LUFS target.",
            },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to normalize loudness">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Choose Streaming, Club, Broadcast, or set a custom LUFS target.</li>
            <li>Download the result — measured and corrected in two passes for accuracy.</li>
          </ol>
        </ToolSection>

        <ToolSection id="why-it-matters" title="Why loudness matching matters for streaming">
          <p>
            Streaming platforms don&apos;t play tracks at whatever level they
            were mastered — each one normalizes playback to its own target,
            turning louder tracks down to match it. The exact target isn&apos;t
            identical everywhere, though: Spotify&apos;s default normalization
            level is -14 LUFS integrated, and YouTube sits in the same
            neighborhood, while Apple Music normalizes closer to -16 LUFS — a bit
            quieter than the other two. A track mastered significantly louder
            than a platform&apos;s target gets turned down on playback and can
            end up sounding flatter or less punchy relative to a track that was
            already close to it.
          </p>
          <p>
            Mastering with a platform&apos;s target in mind ahead of time means
            the platform has less (or no) correction to apply, preserving more of
            the intended dynamics and impact. -14 LUFS is a reasonable single
            target if you&apos;re releasing to more than one platform at once,
            since it&apos;s close to what Spotify and YouTube both normalize
            toward.
          </p>
        </ToolSection>

        {/* Was four paragraphs each opening with a bolded target — term and
            definition pairs, so the dl renders them as a spec table. */}
        <ToolSection id="which-target" title="What LUFS level should you use?">
          <dl className="codes">
            {TARGETS.map((t) => (
              <Fragment key={t.label}>
                <dt>{t.label}</dt>
                <dd>{t.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="two-pass" title="Why two passes instead of one">
          <p>
            A single-pass loudness correction estimates the needed adjustment in
            real time as it streams through the file — a reasonable
            approximation, but one that can miss the actual target by a
            noticeable margin on tracks with uneven loudness throughout. This
            tool always runs two passes: the first measures the track&apos;s true
            integrated loudness, peak, and dynamic range with the whole file
            already analyzed; the second applies the exact correction those
            measurements call for. The cost is one extra decode pass; the benefit
            is a result that actually lands on the target you asked for.
          </p>
          <p>
            Want the fuller breakdown of LUFS vs. peak level, and why different
            platforms genuinely target different loudness levels?{" "}
            <Link href="/guides/what-is-lufs-loudness-explained">
              Read What Is LUFS, and Why Does Streaming Loudness Matter?
            </Link>
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Preparing a track for upload to Spotify, YouTube, or Apple Music at a
            competitive loudness level; mastering a DJ set or club track to a
            louder, dancefloor-appropriate level; delivering audio to broadcast at
            the EBU R128 standard; and matching loudness across a batch of tracks
            so a playlist doesn&apos;t have jarring volume jumps between songs.
          </p>
          <p>
            Working from a raw mix that&apos;s too quiet or too loud overall
            before normalizing? The{" "}
            <Link href="/volume" prefetch={false}>
              Volume Booster
            </Link>{" "}
            adjusts gain by a fixed decibel amount instead of a loudness-standard
            target, which is a simpler tool if you just need a quick gain change
            rather than accurate LUFS matching.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}