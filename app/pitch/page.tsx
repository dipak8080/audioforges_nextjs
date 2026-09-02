import type { Metadata } from "next";
import Link from "next/link";
import { PitchForm } from "@/components/converter/PitchForm";
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
    audio speed changer   2.2K   NOT ours — /tempo's
    bpm changer           1.9K   NOT ours — /tempo's
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
  "Free online pitch changer and pitch shifter. Change a song's key by up to 12 semitones without changing tempo — MP3, WAV, FLAC, AAC, M4A, OGG and AIFF.";

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
  // No "Speed Changer" or "BPM Changer" — those surfaced in the same result
  // set but belong to /tempo. Two pages on one query helps neither.
  alternateName: [
    "Pitch Changer",
    "Pitch Shifter",
    "Audio Pitch Changer",
    "Song Pitch Changer",
    "Key Changer",
  ],
  url: `${SITE_URL}/pitch`,
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

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
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
        "No — pitch is shifted independently of tempo, so the duration and speed of the track stay exactly the same, only the pitch moves.",
    },
    {
      question: "How much can I shift the pitch?",
      answer: "Up to 12 semitones in either direction — a full octave up or down.",
    },
    {
      question: "Will shifting pitch affect audio quality?",
      answer:
        "Small shifts of a semitone or two are close to transparent. Larger shifts toward a full octave start to noticeably affect timbre, since formants — the resonances that give a voice or instrument its characteristic tone — shift along with the pitch.",
    },
    {
      question: "What's the difference between pitch and key?",
      answer:
        "Pitch is the raw frequency of a sound; key is the overall tonal center a piece of music is built around. Shifting a track's pitch by a fixed number of semitones effectively transposes it into a new key.",
    },
    {
      // The tool blocks both of these before anything uploads, and neither
      // number appeared anywhere on the page — so the first time a visitor
      // learned the limit was when the button refused to run.
      question: "Is there a size or length limit?",
      answer: maxDurationLabel
        ? `Yes — up to ${maxUploadLabel} per file, and up to ${maxDurationLabel} of audio. Longer files are caught in your browser before anything uploads, so you're not left waiting on a transfer that gets rejected at the end.`
        : `Yes — up to ${maxUploadLabel} per file.`,
    },
    {
      question: "Why is there a stricter limit on this tool?",
      answer: `Pitch shifting is more CPU-intensive than a simple conversion, so it's limited to ${rateLimitText} to keep it available for everyone. That's deliberately higher than the older limit, because transposing is usually iterative — shift, listen, adjust.`,
    },
    {
      /*
        This page deliberately carried no retention answer for a while, with a
        note saying to ask the backend rather than assume — because the assumed
        version on /vocal-remover shipped wrong and sat wrong for weeks. The
        backend published its retention block on 2026-08-30, so this comes from
        retentionSentences() rather than from prose and can't drift the same way.
      */
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer: "Yes — completely free, no sign-up, no watermark on the output.",
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
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Pitch Shifter" }]} />
        }
        title="Free Pitch Changer"
        lede="Shift a track's pitch up or down without touching its tempo, free, no sign-up, no watermark."
        tool={<PitchForm />}
      >
        <FeatureStrip
          features={[
            { title: "±1 octave", desc: "Shift up to 12 semitones either way." },
            { title: "Tempo unaffected", desc: "Duration and speed stay identical." },
            {
              title: "No sign-up",
              desc: maxDurationLabel
                ? `No account, no watermark. Up to ${maxUploadLabel} and ${maxDurationLabel}.`
                : `No account, no watermark. Up to ${maxUploadLabel} per file.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to shift pitch">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>
              Move the slider to your target shift — a semitone or two for subtle
              retuning, up to a full octave for a dramatic change.
            </li>
            <li>Apply the shift.</li>
            <li>Download the result — same tempo, new pitch.</li>
          </ol>
        </ToolSection>

        <ToolSection id="semitones" title="Semitones and octaves explained">
          <p>
            Pitch is usually adjusted in semitones. Twelve semitones make one
            octave, so shifting a track by +12 moves every note one octave
            higher, while -12 moves everything one octave lower. Smaller
            adjustments of one or two semitones are commonly used to match a
            singer&apos;s vocal range or transpose a song into a more comfortable
            key.
          </p>
          <p>
            Large pitch shifts are possible, but bigger changes naturally sound
            less realistic because voices and instruments take on different tonal
            characteristics as they move farther from their original range.
          </p>
        </ToolSection>

        <ToolSection id="vs-tempo" title="Pitch Shifter vs. Tempo Changer" bleed>
          {/* NOTE: the Tempo Changer range below is a literal describing a
              DIFFERENT tool. There's no shared source to derive it from, so if
              /tempo's range ever moves, this row goes stale silently — the same
              class of drift the rest of this page was rewritten to avoid. */}
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Pitch Shifter</th>
                  <th className="px-4 py-3 font-semibold">Tempo Changer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Changes</td>
                  <td className="px-4 py-3">Musical key / pitch</td>
                  <td className="px-4 py-3">Playback speed</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Stays the same</td>
                  <td className="px-4 py-3">Tempo and duration</td>
                  <td className="px-4 py-3">Pitch and key</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Range</td>
                  <td className="px-4 py-3">±1 octave (12 semitones)</td>
                  <td className="px-4 py-3">50%–200% speed</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              Want the deeper explanation of why these are two separate
              operations, and how a time-stretching engine keeps one variable
              fixed while changing the other?{" "}
              <Link href="/guides/pitch-shifting-vs-key-changing">
                Read Pitch Shifting Explained: Semitones &amp; Musical Keys
              </Link>
              .
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="who-uses-it" title="Who uses a pitch shifter?">
          <p>
            Pitch shifting comes up for singers practicing in a different key,
            musicians transposing a backing track, DJs preparing harmonically
            compatible mixes, producers building vocal effects, and content
            creators nudging background music to better fit a project. Because
            tempo stays fixed, everything stays synchronized — only the musical
            key changes.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Transpose a track into a more comfortable vocal range for practice,
            change the key of a karaoke track to match your own range, test how a
            sample sounds in a different key before dropping it into a session,
            or create a pitched-up or pitched-down variation for a remix — all
            without the tempo shifting along with it, which is what a simple
            speed change would do instead. It&apos;s also useful for DJ mashups
            where two tracks need to sit in the same key, and for instrument
            practice when you want to play along in a different range.
          </p>
          <p>
            Not sure what key your source track is already in? Run it through the{" "}
            <Link href="/key-finder" prefetch={false}>
              Key &amp; BPM Finder
            </Link>{" "}
            first, then transpose it here to the key you need.
          </p>
          <p>
            Need to trim the audio before transposing it? Use the{" "}
            <Link href="/trim" prefetch={false}>
              Audio Trimmer
            </Link>{" "}
            first, then apply the pitch shift to only the section you need.
          </p>
          <p>
            Need to change speed without affecting pitch? Use the{" "}
            <Link href="/tempo" prefetch={false}>
              Tempo Changer
            </Link>{" "}
            instead — it&apos;s the same underlying approach, applied to speed
            rather than key.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}