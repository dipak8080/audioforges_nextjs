import type { Metadata } from "next";
import Link from "next/link";
import { TempoForm } from "@/components/converter/TempoForm";
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

    music speed changer   3.6K   <- larger, and the title led with the other
    audio speed changer   2.2K
    bpm changer           1.9K   (from the /pitch result set)

  Small cluster, one real change: "music speed changer" leads instead of
  "audio speed changer". "Speed up or slow down" follows because that is how
  people describe the job when they don't know the tool has a name.

  Also fixed: this was a bare `title`, so the root template appended
  " | AudioForges" and the rendered title carried TWO pipes —
  "Free Audio Speed Changer | Tempo Changer | AudioForges". `absolute` removes
  the suffix, and the pipe goes with it.

  "Tempo Changer" moves to alternateName. It is what the tool is called in a
  DAW, but it is not what people search.
*/
const PAGE_TITLE = "Music Speed Changer – Speed Up or Slow Down Audio, Free";
const PAGE_DESCRIPTION =
  "Free music and audio speed changer. Speed up or slow down a track from 50% to 200% — pitch stays the same. MP3, WAV, FLAC and more. No sign-up.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("tempo", "Free Audio Speed Changer");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tempo` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/tempo`,
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
  name: "Audio Speed Changer",
  alternateName: [
    "Music Speed Changer",
    "Audio Speed Changer",
    "Tempo Changer",
    "BPM Changer",
    "Song Speed Changer",
  ],
  url: `${SITE_URL}/tempo`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Change speed from 50% to 200%",
    "Independent of pitch",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

export default async function TempoPage() {
  const relatedTools = getRelatedTools("tempo", 5);

  const limits = await getLimits();

  const rateLimitText = rateLimitLabel(limits.rateLimits.tempo ?? 5, windowFor(limits, "tempo"));

  // 900s — one of only two per-tool duration overrides, wired up on the
  // backend the morning of 2026-08-30. Before that, tempo silently took the
  // 3600 default, so a page saying "an hour" was right the day before and
  // rejects real uploads now.
  const durationCap = durationCapFor(limits, "tempo");
  const maxDurationLabel = durationCap === null ? null : durationLabel(durationCap);
  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does changing speed affect the pitch?",
      answer:
        "No, tempo is changed independently of pitch, so the key stays the same, only speed and duration change.",
    },
    {
      question: "Does changing tempo reduce audio quality?",
      answer:
        "Small changes near the original speed are close to transparent. Pushing further toward half or double speed can introduce artifacts, transients like drum hits or plucks may sound slightly smeared, since the engine is reconstructing more of the waveform to hit the new duration.",
    },
    {
      question: "What speed range is available?",
      answer: "From 50% (half speed) to 200% (double speed).",
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
        Was three sentences of hand-written prose. The prose was CORRECT, it
        came from a verified backend description, but it described two numbers
        in a paragraph, which is exactly the shape that went wrong on
        /vocal-remover. It renders from the retention block now, so a TTL change
        carries through rather than needing someone to remember this page.
      */
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Does changing speed also change the BPM?",
      answer:
        "Yes, effectively, since this changes an already-recorded audio file rather than a MIDI tempo track, speeding it up compresses the time between beats, which raises its audible BPM proportionally. A 120 BPM track played at 200% speed sounds like roughly 240 BPM.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Tempo Changer" }]} />}
        meta={["No account", "50% to 200%", "Pitch unchanged"]}
        title="Tempo Changer"
        lede="Speed a track up or slow it down, from half speed to double, without the pitch moving. Rubber Band time-stretch, not a tape-speed trick. Free, no sign-up."
        tool={<TempoForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Range",
              value: "0.5× to 2×",
              note: "Half speed for practice, double for a sketch. Enter a percentage or pick a preset; BPM scales with it, pitch does not.",
            },
            {
              label: "Engine",
              value: "Rubber Band time-stretch",
              note: "Reconstructs the waveform at the new length with pitch held. A turntable or tape shifts pitch with speed; this does not.",
            },
            {
              label: "Limits",
              value: maxDurationLabel ? `${maxUploadLabel}, ${maxDurationLabel}` : maxUploadLabel,
              note: `${formatList}. ${rateLimitText} per IP; the stretch reads the whole file and costs real processing time.`,
            },
          ]}
        />

        <ToolSection id="how-far" title="How far you can push it before it shows" bleed>
          <CompareTable
            columns={["What it is good for", "What to expect"]}
            highlight={-1}
            rows={[
              { label: "85% to 115%", cells: [{ text: "Matching two tracks for a mix, nudging a backing track to a comfortable speed" }, { state: "yes", text: "Transparent on nearly everything" }] },
              { label: "60% to 85%, or up to 140%", cells: [{ text: "Learning a solo, transcribing a fast run, fitting a bed to a video length" }, { state: "yes", text: "Clean on most material. Transients soften a little on drums" }] },
              { label: "50% to 60%, or up to 200%", cells: [{ text: "Slow study of a very fast passage, halftime and doubletime effects" }, { state: "partial", text: "Audible smearing on cymbals, reverb tails and sustained vocals. Usable for study, rough for release" }] },
            ]}
            footnote="Slowing down asks the engine to invent time that was not recorded; speeding up asks it to discard some. Both get harder the further from 100% you go."
          />
          <Prose className="mt-5">
            <p>
              Want the pitch to move and the speed to stay? That is the <Link href="/pitch">Pitch Shifter</Link>.
              Not sure of the track&apos;s BPM to begin with? <Link href="/key-finder">Key &amp; BPM Finder</Link>{" "}
              reads it, and{" "}
              <Link href="/guides/dj-tempo-matching-without-pitch-shift">tempo matching without pitch shift</Link>{" "}
              walks through the DJ case.
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