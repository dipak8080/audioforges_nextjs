import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ChannelsForm } from "@/components/converter/ChannelsForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
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
  TITLE. Volumes NOT pulled from Bing Keyword Research yet — verify and record
  them: stereo to mono · stereo to mono converter · mono to stereo ·
  convert stereo to mono · make audio mono.

  What IS measured: a crawl of the live SERP (Sep 2026) — notevibes.com,
  onaircode.com, elysiatools.com, wutools.com, nuttertools.dev, plus the
  Wondershare and MiniTool listicles. Three findings.

  1. THE OLD TITLE DID NOT CONTAIN THE PHRASE. "Audio to Stereo & Mono
     Converter" has "Stereo & Mono", not "stereo to mono" — and every single
     competing result titles on "Stereo to Mono Converter". The head phrase
     was simply absent.

  2. Notevibes runs TWO pages, /stereo-to-mono-converter and
     /mono-to-stereo-converter, treating the directions as separate intents.
     Worth considering if this page ever earns impressions: they are different
     jobs (downmix vs duplicate) with different reasons behind them. Not split
     yet — one page with no traffic should not become two.

  3. Client-side, again. "No upload", "processes locally", "100% in-browser
     via FFmpeg.wasm" — the same axis /fade loses on. A channel downmix is
     (L+R)/2, trivially doable in Web Audio. See the note on /fade.
*/
const PAGE_TITLE = "Stereo to Mono Converter – Free, Also Mono to Stereo";
const PAGE_DESCRIPTION =
  "Free online stereo to mono converter. Downmix stereo to a single channel, or duplicate mono to stereo — no sign-up, no watermark, no software to install.";

const OG_IMAGE = ogForTool("mono-stereo-converter", "Free mono & stereo converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/mono-stereo-converter` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/mono-stereo-converter`,
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

// Every claim below is checked against actual ChannelsForm/backend behaviour.
// No accuracy, performance or file-size-reduction claims — encoding settings
// and format affect size.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Stereo to Mono Converter",
  alternateName: [
    "Stereo to Mono Converter",
    "Mono to Stereo Converter",
    "Audio Channel Converter",
    "Mono Downmix Tool",
  ],
  url: `${SITE_URL}/mono-stereo-converter`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert stereo to mono",
    "Convert mono to stereo",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

const USE_CASES = [
  {
    name: "Podcasts & voice content",
    desc: "Converting spoken-word recordings to mono for hosts and pipelines that expect single-channel audio.",
  },
  {
    name: "IVR & telephone systems",
    desc: "Phone-based audio commonly requires mono input, regardless of how the source was originally recorded.",
  },
  {
    name: "Voice-over work",
    desc: "Preparing narration for whichever channel format a project or delivery spec requires.",
  },
  {
    name: "Video editing",
    desc: "Matching a voice track's channel format to the rest of a project's audio before syncing it to picture.",
  },
  {
    name: "Music production",
    desc: "Checking how a mix collapses to mono to catch phase or balance issues that only show up once stereo separation is removed.",
  },
  {
    name: "Upload compatibility",
    desc: "Satisfying a platform's channel-count requirement when it rejects or mishandles the format you started with.",
  },
];

export default async function ChannelsPage() {
  const relatedTools = getRelatedTools("mono-stereo-converter", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "mono-stereo-converter");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "How do I convert mono to stereo?",
      answer:
        "Upload your mono file, choose stereo as the target, and download the result. The tool duplicates the single mono signal onto both the left and right channels.",
    },
    {
      question: "How do I convert stereo to mono?",
      answer:
        "Upload your stereo file, choose mono as the target, and download the result. The tool combines the left and right channels into a single centered channel.",
    },
    {
      question: "Does mono to stereo create real stereo?",
      answer:
        "No. It duplicates the identical mono signal onto both channels rather than inventing new left/right content. It satisfies a two-channel requirement, but there's no actual stereo width or separation, since there was nothing to separate in the mono source.",
    },
    {
      question: "Is mono better for voice recordings?",
      answer:
        "Often, yes — a single voice usually doesn't benefit from stereo width, and many phone systems, IVR platforms, and podcast hosts expect or prefer single-channel audio for spoken content.",
    },
    {
      question: "Is stereo better for music?",
      answer:
        "Music that was recorded or mixed with genuine left/right separation — instruments panned to different sides, stereo effects — benefits from staying in stereo, since converting it to mono collapses that separation into one channel.",
    },
    {
      question: "Does converting stereo to mono lose left/right information?",
      answer:
        "Yes — combining two channels into one is a real change. Any separation between the left and right channels in the original is gone in the mono result; the audio isn't damaged, but it's a genuinely different listening experience from the stereo original.",
    },
    {
      question: "Does this conversion affect audio quality?",
      answer:
        "It changes channel count, not fidelity — but stereo-to-mono is not a lossless no-op, since it genuinely discards the left/right separation that existed. Mono-to-stereo doesn't lose anything, since it's only duplicating what's already there.",
    },
    {
      question: "Will converting to mono make my file smaller?",
      answer:
        "Often, since there's less channel data to store, but the exact difference depends on the output format and encoding settings rather than being a fixed, guaranteed reduction.",
    },
    {
      question: "What audio formats are supported?",
      answer: `${formatList}.`,
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `${limits.maxUploadMb}MB per upload, with no length limit.`
          : `${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio.`,
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
            items={[{ name: "Tools", href: "/tools" }, { name: "Mono/Stereo Converter" }]}
          />
        }
        title="Free Stereo to Mono Converter"
        lede="Downmix stereo to mono, or duplicate mono to stereo, in seconds. No sign-up, no watermark."
        tool={<ChannelsForm />}
      >
        <FeatureStrip
          features={[
            { title: "Both directions", desc: "Mono to stereo, or stereo to mono." },
            { title: "Any format", desc: `${formats.join(", ")}.` },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="what-is-mono" title="What is mono audio?">
          <p>
            Mono (monaural) audio is a single audio channel. The same signal
            plays from every speaker or earbud — there&apos;s no left/right
            distinction, because there&apos;s only one channel to begin with.
          </p>
        </ToolSection>

        <ToolSection id="what-is-stereo" title="What is stereo audio?">
          <p>
            Stereo audio uses two independent channels, left and right, which can
            carry different content. That difference between the two channels is
            what creates a sense of width and positioning — an instrument panned
            left, another panned right, or a wide stereo effect spread across the
            field.
          </p>
        </ToolSection>

        <ToolSection id="comparison" title="Mono vs. stereo: what's the difference?" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Mono</th>
                  <th className="px-4 py-3 font-semibold">Stereo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Channels</td>
                  <td className="px-4 py-3">1</td>
                  <td className="px-4 py-3">2 (left + right)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    Left/right information
                  </td>
                  <td className="px-4 py-3">None — same signal everywhere</td>
                  <td className="px-4 py-3">Can differ between channels</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Stereo width</td>
                  <td className="px-4 py-3">None</td>
                  <td className="px-4 py-3">Present when the two channels genuinely differ</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Common uses</td>
                  <td className="px-4 py-3">Voice, phone systems, podcasts</td>
                  <td className="px-4 py-3">Music, sound design, most media</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    Reason to convert here
                  </td>
                  <td className="px-4 py-3">A target expects/prefers single-channel audio</td>
                  <td className="px-4 py-3">A target requires two channels present</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ToolSection>

        <ToolSection id="mono-to-stereo" title="Mono to stereo: what happens?">
          <p>
            The single mono channel is duplicated onto both the left and right
            channels. The result is technically two-channel audio, but it plays
            back exactly as centered as the mono original — nothing new is
            separated between the channels, because there was only one signal to
            begin with.
          </p>
        </ToolSection>

        <ToolSection id="stereo-to-mono" title="Stereo to mono: what happens?">
          <p>
            The left and right channels are combined into a single centered
            channel. Whatever separation existed between them — instruments
            panned to one side, a wide stereo effect — collapses into one signal.
            This is a genuine change to how the audio sounds, not just a format
            formality.
          </p>
        </ToolSection>

        <ToolSection id="when-mono" title="When should you convert stereo to mono?">
          <p>
            When a target platform expects single-channel audio — phone systems,
            IVR prompts, and some podcast hosts commonly do — or when the content
            itself, like a single spoken voice, was never relying on stereo
            separation in the first place.
          </p>
        </ToolSection>

        <ToolSection id="when-stereo" title="When should you convert mono to stereo?">
          <p>
            When an upload target rejects or mishandles mono files and simply
            requires two channels to be present, regardless of whether they carry
            different content. This satisfies that requirement without changing
            how the audio actually sounds.
          </p>
        </ToolSection>

        <ToolSection id="real-stereo" title="Does mono to stereo create real stereo?">
          <p>
            No. Real stereo width comes from having two channels that genuinely
            carry different content — different mic positions, panned
            instruments, a stereo effect. Duplicating a mono signal across two
            channels satisfies a channel-count requirement, but it doesn&apos;t
            create anything to separate, so no width is added.
          </p>
          <p>
            Want the fuller breakdown of why this distinction matters and what
            each direction is actually doing under the hood?{" "}
            <Link href="/guides/mono-vs-stereo-what-changes">
              Read Mono vs. Stereo: What Actually Changes When You Convert
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="quality" title="Does converting stereo to mono affect audio quality?">
          <p>
            Converting stereo to mono changes the channel configuration and can
            remove left/right separation that was present in the original. The
            result isn&apos;t necessarily lower-quality audio, but it can sound
            different, because stereo information is being combined into one
            channel. Whether that matters depends on the source: a mono voice
            recording loses nothing meaningful, while a stereo music mix with
            real left/right content will sound different once collapsed to one
            channel.
          </p>
        </ToolSection>

        <ToolSection id="how-to" title="How to convert between mono and stereo">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Choose mono or stereo as the target.</li>
            <li>Download the converted file.</li>
          </ol>
        </ToolSection>

        <ToolSection id="formats" title="Supported formats" bleed>
          {/* Rendered from the backend's allowed_audio_formats rather than a
              hand-written array — the mechanism that left AIFF off /stems and
              /key-finder. */}
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <span
                key={format}
                className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
              >
                {format}
              </span>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Upload any of the formats above, up to {limits.maxUploadMb}MB per
              file
              {durationCap !== null ? ` and ${durationLabel(durationCap)} long` : ""}.
            </p>
          </Prose>
        </ToolSection>

        {/* Was six paragraphs each opening with a bolded category — term and
            definition pairs. */}
        <ToolSection id="common-uses" title="Common uses">
          <dl>
            {USE_CASES.map((u) => (
              <Fragment key={u.name}>
                <dt>{u.name}</dt>
                <dd>{u.desc}</dd>
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