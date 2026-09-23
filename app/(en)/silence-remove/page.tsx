import type { Metadata } from "next";
import Link from "next/link";
import { SilenceRemoveForm } from "@/components/converter/SilenceRemoveForm";
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
  TITLE. Volumes NOT pulled from Bing Keyword Research – verify and record:
  remove silence from audio · silence remover · audio silence remover ·
  remove silence · dead air removal · auto trim silence.

  What IS measured: a crawl of the live SERP (Sep 2026) – kapwing.com,
  audiocleaner.ai, rendley.com, notevibes.com, submind.co, verbatik.com,
  bahaasr.com, voicecleaner.ai. Three findings.

  1. "Remove Silence from Audio" is the phrase EVERY competitor titles on, and
     it was absent here. "Silence Remover" alone is the shorter, smaller half.

  2. The 35-char ceiling this title was written to is gone. It existed because
     a bare `title` opts into the root template's " | AudioForges" suffix;
     `absolute` suppresses it and returns those fourteen characters, which is
     exactly enough for the head phrase.

  3. Client-side, for the FOURTH time on this site. Notevibes "no upload",
     Submind "no file upload, 100% private", Verbatik "all processing happens
     in your browser". See /fade, /mono-stereo-converter,
     /sample-rate-converter. Four tools losing one axis is a product decision
     waiting to be made, not four copy problems.
*/
const PAGE_TITLE = "Remove Silence from Audio – Free Silence Remover";
const PAGE_DESCRIPTION =
  "Remove silence from audio online free. Cuts dead air throughout a podcast, audiobook or recording – not just the ends. No sign-up, no watermark.";

const UPDATED = "2026-09-11";

const OG_IMAGE = ogForTool("silence-remove", "Free Silence Remover");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/silence-remove` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/silence-remove`,
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
  name: "Silence Remover",
  alternateName: [
    "Remove Silence from Audio",
    "Audio Silence Remover",
    "Dead Air Remover",
    "Auto Trim Silence",
  ],
  url: `${SITE_URL}/silence-remove`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Speech mode: Silero VAD voice-activity detection",
    "Cuts silent gaps throughout, not just leading/trailing",
    "Adjustable threshold and gap length",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema – Google retired HowTo rich results for web search,
// so it earns nothing while adding a second copy of the steps that can drift
// from the visible ones. FAQPage comes from <FAQSection />, BreadcrumbList
// from <Breadcrumb />.

export default async function SilenceRemovePage() {
  const relatedTools = getRelatedTools("silence-remove", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "silence-remove");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does this only trim silence from the start and end?",
      answer:
        "No, it strips silent gaps throughout the entire recording, not just the leading and trailing edges. That's the difference between this and a trimmer: you don't have to find the gaps yourself.",
    },
    {
      question: "What do threshold and minimum gap length control?",
      answer:
        "Threshold sets how quiet something has to be to count as silence, in decibels. Minimum gap length sets how long that quiet stretch has to last before it gets cut. A stretch has to satisfy both at once, which is why a brief pause between words survives while a two-second gap doesn't.",
    },
    {
      /*
        The page previously named no limit anywhere and hedged with "fair-use
        limits apply on file size", no figure, on a tool whose readers upload
        hour-long podcast recordings. That vagueness is what makes someone
        close the tab rather than test it, and the real numbers are perfectly
        reasonable.
      */
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Up to ${limits.maxUploadMb}MB per file, with no length limit.`
          : `Up to ${limits.maxUploadMb}MB per file, and up to ${durationLabel(durationCap)} of audio, enough for a full podcast episode or lecture recording. There's no paid tier that raises either one.`,
    },
    {
      question: "Will the output be shorter than the original?",
      answer:
        "Yes, gaps are cut out entirely rather than muted, so the result is shorter than the input. How much shorter depends on how much dead air was in the recording.",
    },
    {
      question: "Does removing silence affect audio quality?",
      answer:
        "The audio that remains is untouched, only the silent sections are removed, and the format and quality of everything else is preserved.",
    },
    {
      question: "How is this different from the Silence Splitter?",
      answer:
        "Both find the same silent gaps. The Silence Remover deletes them and gives you one shorter file. The Silence Splitter uses them as cut points and gives you separate files, one per section. Use the remover to tighten a recording, the splitter to break one long recording into tracks.",
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
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Silence Remover" }]} />}
        meta={["No account", "Music or speech mode", "Whole file, not just the ends"]}
        title="Silence Remover"
        lede="Cut every quiet gap out of a recording, not only the start and end. Set the threshold, see exactly which gaps will go, then run it. Free, no sign-up."
        tool={<SilenceRemoveForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Before it runs",
              value: "Every gap it will cut, drawn on the waveform",
              note: "In Music mode the page scans the file in your browser and marks the quiet ranges as you move the sliders. Speech mode detects on the server, so it has no preview.",
            },
            {
              label: "Two modes",
              value: "Music by level, Speech by Silero VAD",
              note: "Music finds quiet gaps with a threshold you set. Speech finds where someone stops talking, whatever else is in the audio.",
            },
            {
              label: "Limits",
              value: limitLabel,
              note: `${formatList}. Output keeps your format; only the cut ranges change.`,
            },
          ]}
        />

        <ToolSection id="modes" title="Two ways to find the gaps" bleed>
          <CompareTable
            columns={["How it decides", "Use it for"]}
            highlight={-1}
            rows={[
              {
                label: "Music mode",
                cells: [
                  { text: "By level. Anything quieter than the threshold you set counts as silence." },
                  { text: "Vinyl and cassette rips, mixes, voice memos recorded somewhere quiet." },
                ],
              },
              {
                label: "Speech mode",
                cells: [
                  { text: "Silero VAD, a small model that finds where someone is talking. Level does not matter, so the threshold slider goes away." },
                  { text: "Podcasts, interviews and narration, including over a music bed or room tone." },
                ],
              },
            ]}
            footnote="Speech mode treats music, applause and room tone as gaps, and keeps breaths inside sentences. It does not tell speakers apart, so cross-talk and quick back-and-forth will not split."
          />
        </ToolSection>

        <ToolSection id="settings" title="Which setting does what, in Music mode" bleed>
          <CompareTable
            columns={["Raise it", "Lower it"]}
            highlight={-1}
            rows={[
              {
                label: "Threshold, dB",
                cells: [
                  { text: "Toward -10. More counts as silence: room tone, breaths, quiet tails all go. Risk of clipping soft words" },
                  { text: "Toward -90. Only near-digital silence goes. Safe, but a noisy room may leave nothing to cut" },
                ],
              },
              {
                label: "Minimum gap, seconds",
                cells: [
                  { text: "Toward 10. Only long dead air is removed. Natural pauses in speech survive" },
                  { text: "Toward 0.1. Every tiny gap goes. Speech starts to sound rushed" },
                ],
              },
              {
                label: "Start with",
                cells: [
                  { state: "yes", text: "-30 dB, 0.5 s for a podcast or voice memo" },
                  { state: "partial", text: "-45 dB, 1.5 s for music, where quiet passages are not silence" },
                ],
              },
            ]}
            footnote="The waveform preview updates as you drag, so the right answer is the one where the marked ranges match what you would cut by hand."
          />
          <Prose className="mt-5">
            <p>
              Only need the start and end tidied? The <Link href="/trim">Audio Trimmer</Link> does that with a
              selection. Want each gap to become a separate file, one per take? That is the{" "}
              <Link href="/silence-split">Silence Splitter</Link>.
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