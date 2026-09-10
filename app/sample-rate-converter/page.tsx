import type { Metadata } from "next";
import { ResampleForm } from "@/components/converter/ResampleForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { SampleRateDiagram } from "@/components/tools/SampleRateDiagram";
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

/**
 * The four sample rates and three bit depths are NOT read from the backend:
 * they're the option set ResampleForm offers, not a server limit, so there's
 * nothing in /limits to read them from. Check against that component if they
 * change.
 */

/*
  TITLE. Volumes NOT pulled from Bing Keyword Research — verify and record
  them: sample rate converter · audio resampler · resample audio ·
  sample rate changer · 44100 to 48000 · change sample rate.

  What IS measured: a crawl of the live SERP (Sep 2026) — notevibes.com,
  ultimatedesigntools.com, xcodecpack.com, toolmagic.io, blackfm.com, plus the
  WonderFox and VideoGrabber listicles. Two findings.

  1. "Sample Rate Converter" is the dominant phrase and this title already led
     with it. What was missing is the VERB: "resample" and "audio resampler"
     appear in nearly every competing title, and this page never used either.
     Added, with the rates kept for the "44.1 to 48" long tail.

  2. Client-side, for the third time on this site. Notevibes "no upload",
     UltimateDesignTools "runs entirely in your browser", ToolMagic
     "100% browser-based" via OfflineAudioContext. Resampling is a Web Audio
     primitive. Same finding as /fade and /mono-stereo-converter — three tools
     losing the same axis is a pattern, not a coincidence.
*/
const PAGE_TITLE = "Sample Rate Converter – Resample to 44.1, 48 or 96 kHz";
const PAGE_DESCRIPTION =
  "Free online sample rate converter and audio resampler. Resample to 22.05, 44.1, 48 or 96 kHz, with optional bit depth conversion.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("sample-rate-converter", "Free Sample Rate Converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
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
  alternateName: [
    "Audio Resampler",
    "Sample Rate Changer",
    "Resample Audio",
    "Audio Sample Rate Converter",
  ],
  url: `${SITE_URL}/sample-rate-converter`,
  dateModified: UPDATED,
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


export default async function SampleRateConverterPage() {
  const relatedTools = getRelatedTools("sample-rate-converter", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "sample-rate-converter");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "What sample rate should I use for music?",
      answer:
        "44.1kHz is the long-standing standard for music distribution and matches the CD format most sample libraries and DAWs default to.",
    },
    {
      question: "What sample rate should I use for video?",
      answer:
        "48kHz is the broadcast and video-editing standard, matching it avoids sync or compatibility issues when the audio is going into a video project.",
    },
    {
      question: "Should I convert 44.1kHz to 48kHz, or the other way around?",
      answer:
        "Whichever direction matches what your destination actually requires, a video editor expecting 48kHz, or a music project expecting 44.1kHz. Neither rate is inherently better; it's a compatibility choice, not a quality one.",
    },
    {
      question: "Does converting to a higher sample rate improve quality?",
      answer:
        "No. Converting 44.1kHz audio up to 96kHz doesn't add detail that wasn't in the original recording, it just represents the same information with more samples. Quality is set by the original recording, not by the sample rate you convert to afterward.",
    },
    {
      question: "Does changing sample rate reduce audio quality?",
      answer:
        "Converting to a higher rate doesn't lose anything, but converting to a lower rate is a genuine change, fewer samples per second means less of the original signal is represented afterward, though 44.1kHz already covers the full range of normal human hearing.",
    },
    {
      question: "What is bit depth, and when does it apply?",
      answer:
        "Bit depth controls how finely each sample's amplitude is measured, 16-bit is CD standard, 24-bit and 32-bit are common in production. It only applies to uncompressed WAV/AIFF files here; compressed formats like MP3 or AAC don't expose a user-facing PCM bit depth to convert.",
    },
    {
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes. ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio.`,
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
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Sample Rate Converter" }]} />}
        meta={["No account", "22.05 to 96 kHz", "Bit depth too"]}
        title="Sample Rate Converter"
        lede="Resample audio to 22.05, 44.1, 48 or 96 kHz, and change the bit depth of a WAV or AIFF while you are at it. Free, no sign-up."
        tool={<ResampleForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Rates",
              value: "22.05, 44.1, 48, 96 kHz",
              note: "The four that matter. 44.1 for music, 48 for anything with picture, 96 for processing headroom.",
            },
            {
              label: "Bit depth",
              value: "16, 24, or 32-bit float",
              note: "For WAV and AIFF. The page reads your file's current rate and depth before you choose, so you are not guessing.",
            },
            {
              label: "Honest limit",
              value: "Upsampling adds nothing",
              note: "New samples are computed from the old ones. The picture below shows why, and when converting down is safe.",
            },
          ]}
        />

        <ToolSection id="nyquist" title="What each rate can actually hold" bleed>
          <SampleRateDiagram />
        </ToolSection>

        <ToolSection id="which" title="Which rate to convert to" bleed>
          <CompareTable
            columns={["Use it for", "Why"]}
            highlight={-1}
            rows={[
              {
                label: "44.1 kHz",
                cells: [
                  { text: "Music projects, sample libraries, CD, streaming" },
                  { text: "The rate most music tools expect. Standardising a mixed batch of samples to it saves your DAW resampling on the fly." },
                ],
              },
              {
                label: "48 kHz",
                cells: [
                  { text: "Video editors, broadcast, anything synced to picture" },
                  { text: "The convention those tools are built around. Dropping 44.1 audio into a 48 timeline unconverted is how drift starts." },
                ],
              },
              {
                label: "96 kHz",
                cells: [
                  { text: "Heavy pitch-shifting, time-stretching, sound design" },
                  { text: "Headroom for processing that pushes content above 20 kHz back down. For delivery it is twice the file for nothing audible." },
                ],
              },
              {
                label: "22.05 kHz",
                cells: [
                  { text: "Speech, telephony-style audio, retro game assets" },
                  { text: "Half the size of 44.1. Fine for a voice; music loses everything above 11 kHz." },
                ],
              },
            ]}
            footnote="Going down is the only conversion that changes the sound, and only above the new ceiling. Going up changes nothing except file size."
          />
        </ToolSection>

        <ToolSection id="bit-depth" title="Bit depth is a separate knob" bleed>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["16-bit", "CD and delivery. 96 dB of range, more than any playback chain uses. Convert here last, once the mix is done."],
              ["24-bit", "Recording and mixing. Room to leave the levels low without the noise floor coming up. The DAW default."],
              ["32-bit float", "Processing between tools. Cannot clip. Pointless for distribution and twice the size of 16-bit."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-mono text-sm font-semibold text-amber-400">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </div>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Sample rate is how often the signal is measured; bit depth is how finely each measurement is stored.
              They do not trade off against each other, and only WAV and AIFF expose a bit depth to change. MP3 and
              AAC have no user-facing PCM depth, so the depth option is greyed out for them. Uploads accepted:{" "}
              {formatList}, up to {limits.maxUploadMb}MB.
            </p>
          </Prose>
        </ToolSection>

        <ToolVideo slug="sample-rate-converter" />

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