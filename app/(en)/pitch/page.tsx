import type { Metadata } from "next";
import Link from "next/link";
import { PitchForm } from "@/components/converter/PitchForm";
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
  windowFor,
  rateLimitLabel,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/*
  TITLE. Bing Keyword Research, three months to 30 Aug 2026:

    pitch changer         3.1K   <- larger than "pitch shifter", and absent
    pitch shifter         2.5K
    audio speed changer   2.2K   NOT ours – /tempo's
    bpm changer           1.9K   NOT ours – /tempo's
    audio pitch changer   1.4K
    pitch changer online  1.1K
    change pitch          827
    audio pitch           346
    pitch editor          335
    song pitch changer    233

  "Pitch Changer Online" covers three of those at once: the head term, the
  "online" variant, and "audio pitch changer" partially. "Pitch Shifter" stays
  because it is 2.5K in its own right and the two words are what the tool is
  actually called in a DAW.

  SERP note (Sep 2026): pitchchanger.org and pitchchanger.io are both
  exact-match domains in the top 10, alongside vocalremover.org and mp3cut.net.
  EMDs are hard to beat on their own term and this cluster is only ~13K in
  total. Low priority next to the converter pages.
*/
const PAGE_TITLE = "Pitch Changer Online – Free Pitch Shifter, Change Key";
const PAGE_DESCRIPTION =
  "Free online pitch changer and pitch shifter. Change a song's key by up to 12 semitones without changing tempo – MP3, WAV, FLAC, AAC, M4A, OGG and AIFF.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("pitch", "Free Pitch Shifter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pitch` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/pitch`,
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
  name: "Pitch Changer",
  // No "Speed Changer" or "BPM Changer" – those surfaced in the same result
  // set but belong to /tempo. Two pages on one query helps neither.
  alternateName: [
    "Pitch Changer",
    "Pitch Shifter",
    "Audio Pitch Changer",
    "Song Pitch Changer",
    "Key Changer",
  ],
  url: `${SITE_URL}/pitch`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Shift pitch up to 1 octave either direction",
    "Independent of tempo",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema – deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function PitchPage() {
  const relatedTools = getRelatedTools("pitch", 5);

  const limits = await getLimits();

  /*
    The rate limit is the figure that was wrong here: the FAQ typed "3 per 5
    minutes" while the config had allowed 5 since 2026-08-22 — a 40%
    understatement on the one tool where the workflow is genuinely iterative
    (shift, listen, adjust), which is why it was raised in the first place.
  */
  const rateLimitText = rateLimitLabel(limits.rateLimits.pitch ?? 5, windowFor(limits, "pitch"));

  /*
    900s — one of only two per-tool duration overrides, wired up on the backend
    the morning of 2026-08-30. Before that, pitch silently took the 3600
    default, so a page saying "an hour" was right the day before and rejects
    real uploads now.
  */
  const durationCap = durationCapFor(limits, "pitch");
  const maxDurationLabel = durationCap === null ? null : durationLabel(durationCap);
  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does pitch shifting change the tempo?",
      answer:
        "No, pitch is shifted independently of tempo, so the duration and speed of the track stay exactly the same, only the pitch moves.",
    },
    {
      question: "How much can I shift the pitch?",
      answer: "Up to 12 semitones in either direction, a full octave up or down.",
    },
    {
      question: "Will shifting pitch affect audio quality?",
      answer:
        "Small shifts of a semitone or two are close to transparent. Larger shifts toward a full octave start to noticeably affect timbre, since formants, the resonances that give a voice or instrument its characteristic tone, shift along with the pitch.",
    },
    {
      // The tool blocks both of these before anything uploads, and neither
      // number appeared anywhere on the page, so the first time a visitor
      // learned the limit was when the button refused to run.
      question: "Is there a size or length limit?",
      answer: maxDurationLabel
        ? `Yes, up to ${maxUploadLabel} per file, and up to ${maxDurationLabel} of audio. Longer files are caught in your browser before anything uploads, so you're not left waiting on a transfer that gets rejected at the end.`
        : `Yes, up to ${maxUploadLabel} per file.`,
    },
    {
      /*
        This page deliberately carried no retention answer for a while, with a
        note saying to ask the backend rather than assume, because the assumed
        version on /vocal-remover shipped wrong and sat wrong for weeks. The
        backend published its retention block on 2026-08-30, so this comes from
        retentionSentences() rather than from prose and can't drift the same way.
      */
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Can I change the key of a song without changing its speed?",
      answer:
        "Yes. This tool shifts pitch independently of tempo, so you can transpose a song into a different key while keeping its original duration.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Pitch Shifter" }]} />}
        meta={["No account", "±12 semitones", "Tempo unchanged"]}
        title="Pitch Shifter"
        lede="Move a track up or down by exact semitones without changing its speed. An octave either way, keyed to note names so you can see where it lands. Free, no sign-up."
        tool={<PitchForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Range",
              value: "-12 to +12 semitones",
              note: "One octave down to one octave up. The form shows the interval and the resulting note, so +7 reads as a fifth, C to G.",
            },
            {
              label: "Engine",
              value: "Rubber Band, time-domain shift",
              note: "Pitch moves, duration does not. The same engine DAWs license for this job, not a resample trick that speeds the file up.",
            },
            {
              label: "Limits",
              value: maxDurationLabel ? `${maxUploadLabel}, ${maxDurationLabel}` : maxUploadLabel,
              note: `${formatList}. ${rateLimitText} per IP, tighter than the fast tools, because a proper pitch shift reads the whole file.`,
            },
          ]}
        />

        <ToolSection id="how-far" title="How far you can push it before it shows" bleed>
          <CompareTable
            columns={["What it is good for", "What to expect"]}
            highlight={-1}
            rows={[
              {
                label: "1 to 2 semitones",
                cells: [
                  { text: "Matching a backing track to a singer, tuning a sample to a session" },
                  { state: "yes", text: "Transparent on almost anything" },
                ],
              },
              {
                label: "3 to 5 semitones",
                cells: [
                  { text: "Transposing a song for a different vocal range, key-matching for a mashup" },
                  { state: "yes", text: "Clean on most material. Dense reverb tails and cymbals start to smear first" },
                ],
              },
              {
                label: "6 to 12 semitones",
                cells: [
                  { text: "Octave effects, sound design, rough sketches" },
                  { state: "partial", text: "Audible artefacts on vocals and sustained notes. Formants move with the pitch, so voices change character" },
                ],
              },
            ]}
            footnote="Any shift is a transformation of the audio, not a lossless edit. Keep the original."
          />
          <Prose className="mt-5">
            <p>
              Pitch and speed are separate here. To change the speed and keep the key, use the{" "}
              <Link href="/tempo">Tempo Changer</Link>. To find the key first so you know how far to move, use the{" "}
              <Link href="/key-finder">Key &amp; BPM Finder</Link>.
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