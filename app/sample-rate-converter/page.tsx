import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ResampleForm } from "@/components/converter/ResampleForm";
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

/**
 * The four sample rates and three bit depths are NOT read from the backend:
 * they're the option set ResampleForm offers, not a server limit, so there's
 * nothing in /limits to read them from. Check against that component if they
 * change.
 */

const PAGE_TITLE = "Free Sample Rate Converter — 44.1kHz, 48kHz & 96kHz";
const PAGE_DESCRIPTION =
  "Convert audio sample rates online for free. Resample to 22.05kHz, 44.1kHz, 48kHz, or 96kHz, with optional bit depth conversion. No sign-up.";

const OG_IMAGE = ogForTool("sample-rate-converter", "Free Sample Rate Converter");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/sample-rate-converter` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/sample-rate-converter`,
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

// Every claim below is checked against actual ResampleForm/backend behaviour.
// No accuracy or quality-improvement claims — resampling doesn't add detail
// beyond what the original file has.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Sample Rate Converter",
  url: `${SITE_URL}/sample-rate-converter`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert between 22.05kHz, 44.1kHz, 48kHz, and 96kHz",
    "Optional bit depth conversion for WAV/AIFF",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

const WHEN_TO_CONVERT = [
  {
    rate: "44.1 kHz",
    desc: "When the destination is a music project, sample library, or DAW that expects the CD-standard rate — the most common reason to standardize toward 44.1kHz.",
  },
  {
    rate: "48 kHz",
    desc: "When the destination is a video editor, broadcast pipeline, or anything syncing audio to picture — 48kHz is the convention those tools are built around.",
  },
  {
    rate: "96 kHz",
    desc: "When a specific high-resolution workflow or platform requires it — not as a way to improve an existing lower-rate recording, since upsampling doesn't add detail that wasn't captured originally.",
  },
];

export default async function ResamplePage() {
  const relatedTools = getRelatedTools("sample-rate-converter", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "sample-rate-converter");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What is sample rate?",
      answer:
        "How many times per second the audio signal is measured when it's digitized. 44.1kHz (44,100 samples per second) is the CD standard; 48kHz is standard for video and broadcast; 96kHz is used in some high-resolution audio and production workflows.",
    },
    {
      question: "What sample rate should I use for music?",
      answer:
        "44.1kHz is the long-standing standard for music distribution and matches the CD format most sample libraries and DAWs default to.",
    },
    {
      question: "What sample rate should I use for video?",
      answer:
        "48kHz is the broadcast and video-editing standard — matching it avoids sync or compatibility issues when the audio is going into a video project.",
    },
    {
      question: "Should I convert 44.1kHz to 48kHz, or the other way around?",
      answer:
        "Whichever direction matches what your destination actually requires — a video editor expecting 48kHz, or a music project expecting 44.1kHz. Neither rate is inherently better; it's a compatibility choice, not a quality one.",
    },
    {
      question: "Why would I need to change sample rate at all?",
      answer:
        "A project, platform, or piece of software sometimes requires audio at a specific sample rate — a video editor working at 48kHz, for example, or a sample library that expects 44.1kHz.",
    },
    {
      question: "Does converting to a higher sample rate improve quality?",
      answer:
        "No — converting 44.1kHz audio up to 96kHz doesn't add detail that wasn't in the original recording, it just represents the same information with more samples. Quality is set by the original recording, not by the sample rate you convert to afterward.",
    },
    {
      question: "Does changing sample rate reduce audio quality?",
      answer:
        "Converting to a higher rate doesn't lose anything, but converting to a lower rate is a genuine change — fewer samples per second means less of the original signal is represented afterward, though 44.1kHz already covers the full range of normal human hearing.",
    },
    {
      question: "What is bit depth, and when does it apply?",
      answer:
        "Bit depth controls how finely each sample's amplitude is measured — 16-bit is CD standard, 24-bit and 32-bit are common in production. It only applies to uncompressed WAV/AIFF files here; compressed formats like MP3 or AAC don't expose a user-facing PCM bit depth to convert.",
    },
    {
      question: "What's the difference between sample rate and bit depth?",
      answer:
        "Sample rate measures how often the signal is sampled per second (a time-axis measurement); bit depth measures how finely each of those samples' amplitude is captured (an amplitude-axis measurement). They're independent settings that happen to be adjusted together in a lot of audio software.",
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes — ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio.`,
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
            items={[{ name: "Tools", href: "/tools" }, { name: "Sample Rate Converter" }]}
          />
        }
        title="Free Audio Sample Rate Converter"
        lede="Change an audio file's sample rate and bit depth, free, no sign-up, no watermark."
        tool={<ResampleForm />}
      >
        <FeatureStrip
          features={[
            { title: "4 sample rates", desc: "22.05kHz, 44.1kHz, 48kHz, and 96kHz." },
            { title: "Optional bit depth", desc: "16, 24, or 32-bit for WAV/AIFF." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="what-is-sample-rate" title="What is sample rate?">
          <p>
            Sample rate is how many times per second an audio signal is measured
            when it&apos;s digitized. 44.1kHz means 44,100 samples per second,
            48kHz means 48,000, and 96kHz means 96,000. A higher number means the
            signal is measured more frequently — it doesn&apos;t by itself mean
            the recording sounds better, only that it&apos;s represented with more
            data points per second.
          </p>
        </ToolSection>

        <ToolSection id="441-vs-48" title="44.1kHz vs. 48kHz">
          <p>
            44.1kHz is the long-standing standard for music — it&apos;s the CD
            format, and most sample libraries, DAWs, and music distribution
            pipelines default to it. 48kHz is the standard for video and
            broadcast audio instead. Neither is simply &ldquo;better&rdquo; than
            the other; they&apos;re different conventions for different
            destinations. The right choice comes down to what your project or
            platform actually requires — matching a video editor&apos;s timeline
            calls for 48kHz, while a music-focused project usually calls for
            44.1kHz.
          </p>
        </ToolSection>

        <ToolSection id="96khz" title="What is 96kHz used for?">
          <p>
            96kHz shows up in some high-resolution audio releases and production
            workflows, where the extra samples per second can give more headroom
            during intensive processing before that processing starts introducing
            artifacts. Converting an existing 44.1kHz file up to 96kHz afterward
            doesn&apos;t retroactively give it that benefit — the extra headroom
            only matters when the original recording and processing chain were
            actually done at 96kHz from the start.
          </p>
        </ToolSection>

        <ToolSection id="upsampling" title="Does converting to a higher sample rate improve quality?">
          <p>
            No. Upsampling doesn&apos;t restore detail that wasn&apos;t captured
            in the original recording — it represents the same underlying
            information with more samples, rather than pulling in new information
            that was never there. If a recording was made at 44.1kHz, that rate
            set the ceiling on what was captured; changing the file&apos;s stored
            rate afterward doesn&apos;t move that ceiling.
          </p>
        </ToolSection>

        <ToolSection id="bit-depth" title="What is bit depth?">
          <p>
            Bit depth is a separate setting from sample rate — it controls how
            finely each individual sample&apos;s amplitude is measured. 16-bit is
            the CD standard; 24-bit and 32-bit are common in production for the
            extra headroom they give during mixing and processing. Bit depth
            conversion here only applies to uncompressed WAV and AIFF files, since
            compressed formats like MP3 or AAC don&apos;t store audio as raw PCM
            samples and so don&apos;t expose a user-facing bit depth to convert.
          </p>
        </ToolSection>

        <ToolSection id="rate-vs-depth" title="Sample rate vs. bit depth" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Sample rate</th>
                  <th className="px-4 py-3 font-semibold">Bit depth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Measures</td>
                  <td className="px-4 py-3">Samples per second</td>
                  <td className="px-4 py-3">Amplitude resolution per sample</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Examples</td>
                  <td className="px-4 py-3">22.05kHz, 44.1kHz, 48kHz, 96kHz</td>
                  <td className="px-4 py-3">16-bit, 24-bit, 32-bit</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Mainly affects</td>
                  <td className="px-4 py-3">Frequency representation over time</td>
                  <td className="px-4 py-3">Dynamic range / noise floor</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Common use</td>
                  <td className="px-4 py-3">Music/video compatibility</td>
                  <td className="px-4 py-3">Recording and production headroom</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              They&apos;re independent settings that happen to get adjusted
              together in a lot of audio software, which is why they&apos;re easy
              to conflate — but changing one doesn&apos;t change the other.
            </p>
          </Prose>
        </ToolSection>

        {/* Was three h3 + paragraph pairs — a definition list, and the terms
            are rates, so the mono treatment fits. */}
        <ToolSection id="when-to-convert" title="When should you convert to each rate?">
          <dl className="codes">
            {WHEN_TO_CONVERT.map((item) => (
              <Fragment key={item.rate}>
                <dt>{item.rate}</dt>
                <dd>{item.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="how-to" title="How to convert sample rate">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Choose a target sample rate, and optionally a bit depth for WAV/AIFF.</li>
            <li>Download the converted file.</li>
          </ol>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Matching a video editor&apos;s expected 48kHz audio, converting
            samples down to 44.1kHz for a music project, preparing audio for a
            platform with a specific sample-rate requirement, and standardizing a
            batch of files recorded at inconsistent rates before combining them.
          </p>
          <p>
            Want the fuller breakdown of why upsampling and downsampling behave so
            differently, and what bit depth is actually doing under the hood?{" "}
            <Link href="/guides/sample-rate-and-bit-depth-explained">
              Read Sample Rate and Bit Depth: What They Actually Change
            </Link>
            . Combining files afterward? The{" "}
            <Link href="/audio-joiner" prefetch={false}>
              Audio Joiner
            </Link>{" "}
            already normalizes sample rate automatically when it merges files, but
            resampling first is useful if you need a specific rate for a reason
            beyond just joining.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}