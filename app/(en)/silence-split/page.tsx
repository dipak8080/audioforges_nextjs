import type { Metadata } from "next";
import Link from "next/link";
import { SilenceSplitForm } from "@/components/converter/SilenceSplitForm";
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
import { getToolLimits } from "@/lib/data/tool-limits";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/*
  TITLE. Volumes NOT pulled from Bing Keyword Research — verify and record:
  audio splitter · split audio · split audio by silence · silence splitter ·
  audio splitter online · split mp3.

  What IS measured: a crawl of the live SERP (Sep 2026) — veed.io,
  aijinglemaker.com, audioeditor.org, fyletools.com, soniqtools.com,
  elysiatools.com, scribergpt.com. Three findings.

  1. "AUDIO SPLITTER" IS THE TERM, and this title never used it. Nearly every
     competitor titles on it; "silence splitter" is the narrower subset that
     only people who already know the technique search for. "Split audio by
     silence" was already here and stays — it is the right second phrase.

  2. The 46-char ceiling is gone: `absolute` suppresses the root template's
     " | AudioForges" and returns fourteen characters, which is what makes
     room for the broader term.

  3. Client-side, for the FIFTH time. And every competitor also offers split
     BY TIME alongside silence, which this tool does not — worth knowing as a
     feature gap rather than a copy one.
*/
const PAGE_TITLE = "Audio Splitter – Split Audio by Silence, Free Online";

/**
 * `metadata` is evaluated at module scope where getLimits() can't be awaited,
 * so the segment cap here comes from the hand table — the same value the
 * /limits fallback carries.
 */
const DESCRIPTION_SEGMENTS = getToolLimits("silence-split")?.maxOutputSegments ?? 50;
const PAGE_DESCRIPTION = `Free online audio splitter. Split audio by silence into separate tracks at every silent gap, up to ${DESCRIPTION_SEGMENTS}. Adjustable threshold, no sign-up.`;

const UPDATED = "2026-09-11";

const OG_IMAGE = ogForTool("silence-split", "Free Silence Splitter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/silence-split` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/silence-split`,
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

// No HowTo schema — Google retired HowTo rich results for web search.
//
// FAQ note: <FAQSection> emits its own FAQPage block, so none is hand-written
// here. Worth knowing FAQPage no longer produces rich results for a site like
// this one — Google restricted them to government and health domains in 2023.
// The FAQ earns its place by answering things the body doesn't, which is why
// it's nine questions rather than fifteen.


export default async function SilenceSplitPage() {
  const relatedTools = getRelatedTools("silence-split", 5);

  const limits = await getLimits();
  const toolLimits = getToolLimits("silence-split");

  const maxSegments = toolLimits?.maxOutputSegments ?? 50;
  const minSegmentSeconds = toolLimits?.minOutputSegmentSeconds ?? 1;
  const fileSizeLabel = `${limits.maxUploadMb}MB`;

  /*
    RENDERED, this time. The old code assigned getRateLimitLabel("silence-split")
    at module scope, the comment above it claimed both values were used below,
    and only one of them was — so the tightest limit on the site was also the
    only one the page never stated. Reading from the table doesn't help if
    nothing reads the variable.
  */
  const rateLimit = rateLimitLabel(
    limits.rateLimits["silence-split"] ?? 3,
    windowFor(limits, "silence-split")
  );

  /*
    Not exempt, no per-tool override, so this is the audio_tools default: one
    hour. It matters more here than almost anywhere — the worked examples on
    this page are DJ sets and full vinyl sides, and plenty of those run longer.
  */
  const durationCap = durationCapFor(limits, "silence-split");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, " and $1");

  // Every claim below is checked against the actual product. No accuracy,
  // performance or privacy claims are asserted — none have been verified
  // against the backend implementation.
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Audio Splitter",
    alternateName: [
      "Audio Splitter",
      "Silence Splitter",
      "Split Audio by Silence",
      "MP3 Splitter",
    ],
    url: `${SITE_URL}/silence-split`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
    "Speech mode: Silero VAD voice-activity detection",
      "Automatic silence detection",
      "Adjustable silence threshold",
      "Adjustable minimum gap length",
      `Splits one file into up to ${maxSegments} separate tracks`,
      "Choice of output format",
      "No sign-up required",
      "No watermark",
    ],
  };

  const faqs = [
    {
      question: "Can I split a DJ mix into individual tracks?",
      answer:
        "If the mix has genuine quiet gaps between songs, yes. Mixes that crossfade continuously from one track into the next often have no real silence to detect, so some manual adjustment, or a different tool entirely, may be needed for those.",
    },
    {
      question: "Can I split a vinyl rip into separate songs?",
      answer:
        "Yes, when there are quiet gaps between tracks on the recording, common on vinyl rips digitized with the natural pauses between songs intact. Surface noise can keep a gap from registering as silent; lowering the threshold usually fixes it.",
    },
    {
      /*
        "Up to N segments" reads as truncation. It isn't: the backend raises
        BEFORE cutting anything, so an over-cap file produces NOTHING rather
        than the first N. Materially different, and this page's own examples , 
        a two-hour set, a full vinyl side, are exactly the files that hit it.
      */
      question: "How many tracks can one upload produce?",
      answer: `Up to ${maxSegments}. Past that the split is refused rather than trimmed to ${maxSegments}, nothing is written, and the error tells you the real count so you can raise the silence threshold or the minimum gap to merge nearby segments and run it again. Any segment shorter than ${minSegmentSeconds} second is dropped automatically rather than kept as a near-empty fragment.`,
    },
    {
      question: "How often can I run a split?",
      answer: `${rateLimit}. That's the tightest limit here, because a split can produce dozens of files from one upload and each of them is encoded separately. If you hit it, the button shows a countdown rather than failing.`,
    },
    {
      question: "Does splitting reduce audio quality?",
      answer:
        "The cut itself doesn't alter the audio, it only divides it at the points detected. The resulting files are then encoded into whichever output format you choose, the same as any format conversion.",
    },
    {
      question: "Does it name the tracks or read chapter markers?",
      answer:
        "No. Detection works purely on loudness, so it has no way to know song titles, artists, or chapter positions. Segments come out numbered in order and you rename them yourself.",
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
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Silence Splitter" }]} />}
        meta={["No account", "Music or speech mode", `Up to ${maxSegments} tracks`]}
        title="Split Audio by Silence"
        lede="Turn one long recording into separate files, cut wherever the audio goes quiet. See every cut point on the waveform before it runs. Free, no sign-up."
        tool={<SilenceSplitForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Before it runs",
              value: "Every cut point, drawn on the waveform",
              note: "In Music mode the page scans the file in your browser and shows how many tracks you will get as you move the sliders. Speech mode detects on the server, so it has no preview.",
            },
            {
              label: "Two modes",
              value: "Music by level, Speech by Silero VAD",
              note: `Music finds quiet gaps with a threshold. Speech finds where someone stops talking. Segments under ${minSegmentSeconds} s are dropped rather than kept as fragments.`,
            },
            {
              label: "Limits",
              value: durationCap === null ? `${maxSegments} tracks, ${fileSizeLabel}` : `${maxSegments} tracks, ${fileSizeLabel}, ${durationLabel(durationCap)}`,
              note: `${formatList}. ${rateLimit} per IP, the tightest on the site, because one upload can produce ${maxSegments} files. Output keeps your format.`,
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

        <ToolSection id="what-splits" title="What splits cleanly, and what does not" bleed>
          <CompareTable
            columns={["Why"]}
            highlight={-1}
            rows={[
              { label: "Vinyl or cassette rip", cells: [{ state: "yes", text: "Real gaps between tracks. The default settings usually find them all" }] },
              { label: "A set of voice memos in one file", cells: [{ state: "yes", text: "Pauses between takes are long and near-silent. Raise the minimum gap so pauses within a take survive" }] },
              { label: "A podcast, in Speech mode", cells: [{ state: "partial", text: "Splits wherever speech stops, even over a music bed or room tone. It does not tell speakers apart, so cross-talk and quick exchanges still will not split" }] },
              { label: "A DJ mix", cells: [{ state: "no", text: "Tracks are beatmatched with no silence between them. There is nothing to split on. Use the trimmer with the tracklist times instead" }] },
              { label: "Live album with crowd noise", cells: [{ state: "no", text: "Music mode only, and applause is not silence. Lower the threshold toward -60 dB and expect to trim by hand. Speech mode does not help with music" }] },
            ]}
            footnote="Splitting keeps the audio inside each segment untouched. Files are named in order; there is no chapter-marker or track-title reading."
          />
          <Prose className="mt-5">
            <p>
              Want the quiet parts gone but one file back? That is the{" "}
              <Link href="/silence-remove">Silence Remover</Link>. Splitting at exact times rather than at silence?{" "}
              <Link href="/trim">Trim</Link> each section.
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