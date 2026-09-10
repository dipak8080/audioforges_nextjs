import type { Metadata } from "next";
import Link from "next/link";
import { FadeForm } from "@/components/converter/FadeForm";
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
  them here: audio fade · fade in audio · fade out audio · fade mp3 ·
  add fade to audio · audio fade in out.

  What IS measured: a crawl of the live SERP (Sep 2026) — notevibes.com,
  audioeditor.org, premierely.io, wutools.com, aijinglemaker.com,
  products.aspose.app. Two findings.

  1. MP3 is named explicitly by almost every competitor, and Aspose runs a
     dedicated /mp3 subpage for it. This title said "Audio" only.

  2. THE ONE THAT MATTERS, AND IT IS NOT A COPY PROBLEM. Nearly every result
     processes in-browser and leads with it: "your file is never uploaded",
     "all processing happens on your device". That is the axis this SERP
     competes on, and we upload to a server, so we lose it outright.

     A fade is a gain ramp — Web Audio API handles it client-side, and
     components/browser/ already exists for exactly this kind of tool (BPM
     tapper, metronome). Moving fade there would make it instant, free to
     run, and let the page make the same privacy claim honestly. That is the
     change worth making here; the title below is the small half.
*/
const PAGE_TITLE = "Audio Fade In & Fade Out – Fade MP3 or WAV, Free";
const PAGE_DESCRIPTION =
  "Add a fade in and fade out to MP3, WAV, FLAC and more, online and free. Smooth an abrupt start or a hard cut at the end. No sign-up, no watermark.";

/**
 * The per-fade ceiling, from the same constant FadeForm enforces
 * (FADE_MAX_SECONDS). NOT a backend limit — it's a client-side control range,
 * so there's nothing in /limits to read it from. If it changes, change it
 * there and here together.
 */
const MAX_FADE_SECONDS = 30;

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("fade", "Free audio fade in & out");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/fade` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/fade`,
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

// Every claim below is checked against actual FadeForm/backend behaviour. No
// performance, accuracy or ranking claims.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio Fade In/Out Tool",
  alternateName: [
    "Audio Fade In Out",
    "Fade In Audio",
    "Fade Out Audio",
    "MP3 Fade Tool",
    "Add Fade to Audio",
  ],
  url: `${SITE_URL}/fade`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Independent fade in and fade out durations",
    `Up to ${MAX_FADE_SECONDS} seconds per fade`,
    "Output keeps the original file format",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function FadePage() {
  const relatedTools = getRelatedTools("fade", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "fade");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Do I need both a fade in and a fade out?",
      answer:
        "No, turn on just one if that's all you need. At least one of the two has to be enabled to submit, but they're otherwise independent.",
    },
    {
      question: "Can a fade prevent clicks and pops?",
      answer:
        "It addresses the most common cause: a hard cut at a point where the waveform isn't at zero, which produces a sudden jump in amplitude your speakers reproduce as a click. A fade ramps the volume down to (or up from) zero instead, removing that jump. It won't fix clicks caused by something else, like a corrupted file or a bad recording.",
    },
    {
      question: "How long should a fade be?",
      answer: `It depends on the use. A loop point usually wants a very short fade, since anything long enough to be noticeable also changes how the loop sounds on repeat. A podcast outro or the end of a voice recording can take a longer, more deliberate fade without feeling abrupt. Up to ${MAX_FADE_SECONDS} seconds is available for either fade.`,
    },
    {
      /*
        FadeForm clamps each fade against the track's own length, two fades
        can never overlap past the end of the file, so the ceiling on a short
        clip is the clip, not the 30 seconds the page advertises. Someone with
        a 20-second sample otherwise reads "up to 30 seconds" and finds the
        handle refuses to go there.
      */
      question: `Why won't my fade go to ${MAX_FADE_SECONDS} seconds?`,
      answer: `Because the clip is shorter than that, or the other fade is using the room. Each fade is capped at ${MAX_FADE_SECONDS} seconds OR whatever the track's length leaves after the other one, a 20-second clip can't hold two 15-second fades, so the handles stop where they'd collide. The limit you hit on a short file is the file, not the tool.`,
    },
    {
      question: "Does fading reduce audio quality?",
      answer:
        "No, a fade only adjusts the volume envelope at the start and/or end of the file. The output keeps the same format as the file you uploaded.",
    },
    {
      question: "Is there a file size or length limit?",
      answer:
        durationCap === null
          ? `Yes, ${limits.maxUploadMb}MB per upload, with no length limit.`
          : `Yes, ${limits.maxUploadMb}MB per upload, and up to ${durationLabel(durationCap)} of audio.`,
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
  ];
  const limitLabel =
    durationCap === null ? `${limits.maxUploadMb}MB per upload` : `${limits.maxUploadMb}MB and ${durationLabel(durationCap)}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Fade In / Out" }]} />}
        meta={["No account", "Preview in the browser", "Up to 30 s each end"]}
        title="Audio Fade In and Fade Out"
        lede="Add a fade in, a fade out or both, hear it before you commit, and download in the same format you uploaded. Free, no sign-up."
        tool={<FadeForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Before it runs",
              value: "Preview the fade in the page",
              note: "The file is decoded in your browser and the ramp is applied to playback, so you hear the exact fade before anything is processed.",
            },
            {
              label: "Control",
              value: "0 to 30 s, each end, in tenths",
              note: "Both fades are capped so together they never exceed the file. Linear ramp, which is what a DAW fade defaults to.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. Output keeps your format. Uploads are deleted on completion.`,
            },
          ]}
        />

        <ToolSection id="how-long" title="How long a fade should be" bleed>
          <CompareTable
            columns={["Fade in", "Fade out"]}
            highlight={-1}
            rows={[
              { label: "Removing a click at a hard cut", cells: [{ text: "0.01 to 0.05 s. Just enough to start from silence", mono: true }, { text: "0.01 to 0.05 s. Same idea at the end", mono: true }] },
              { label: "Song intro or outro", cells: [{ text: "0.5 to 2 s. Longer feels hesitant", mono: true }, { text: "3 to 8 s. The classic album fade", mono: true }] },
              { label: "Podcast music bed under speech", cells: [{ text: "1 to 3 s", mono: true }, { text: "2 to 5 s, timed to end as the voice begins", mono: true }] },
              { label: "Ambient loop or background", cells: [{ text: "5 to 15 s", mono: true }, { text: "5 to 15 s. Long enough that nobody notices the join", mono: true }] },
            ]}
            footnote="A fade changes level over time at the ends only. It is not a volume change, which moves the whole file, and not a trim, which removes audio. Fading never lowers quality."
          />
          <Prose className="mt-5">
            <p>
              Need to cut the file first? <Link href="/trim">Trim it</Link>, then fade the clip. Whole file too loud
              or too quiet? That is the <Link href="/volume">Volume Booster</Link>.{" "}
              <Link href="/guides/why-audio-needs-a-fade-in-out">Why audio needs a fade</Link> covers the click
              problem in detail.
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