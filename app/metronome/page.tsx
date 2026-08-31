import type { Metadata } from "next";
import Link from "next/link";
import { MetronomeForm } from "@/components/browser/MetronomeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Free Online Metronome – Adjustable BPM & Tempo";
const PAGE_DESCRIPTION =
  "Use a free online metronome with adjustable BPM and time signature. Set your tempo from 30 to 300 BPM and practice rhythm directly in your browser.";

/** Same range MetronomeForm enforces. Not a backend limit, so there's nothing
 *  in /limits to read it from — change both together. */
const MIN_BPM = 30;
const MAX_BPM = 300;

const OG_IMAGE = ogForTool("metronome", "Free Online Metronome");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/metronome` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/metronome`,
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

// Every claim below matches the actual MetronomeForm implementation.
// "Scheduled against the audio clock" rather than "sample-accurate" as a
// headline claim — the latter hasn't been benchmarked, even though
// AudioContext timing is genuinely far more precise than a JS timer.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Online Metronome",
  url: `${SITE_URL}/metronome`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    `Adjustable BPM from ${MIN_BPM} to ${MAX_BPM}`,
    "Configurable time signature with an accented downbeat",
    "Scheduled against the audio clock to avoid drift",
    "No sign-up required",
  ],
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

const faqs = [
  {
    question: "Does this metronome drift out of time?",
    answer:
      "No — it schedules each click ahead of time directly against your browser's audio clock, rather than relying on a regular JavaScript timer that can drift under load. Timing stays consistent for as long as you leave it running.",
  },
  {
    question: "What BPM range is supported?",
    answer: `${MIN_BPM} to ${MAX_BPM} BPM, covering everything from a slow largo to a fast presto.`,
  },
  {
    question: "What does the accented beat mean?",
    answer:
      "The first beat of each measure (the downbeat) plays at a slightly higher pitch and louder volume, matching how a physical metronome marks the start of each bar.",
  },
  {
    question: "Can I change the time signature?",
    answer:
      "Yes — set beats per measure from 2 to 8 to match 2/4, 3/4, 4/4, 5/4, 6/8, and other common signatures.",
  },
  {
    question: "Do I need to install anything?",
    answer: "No — it runs entirely in your browser using Web Audio, no app or plugin needed.",
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no ads, no limits.",
  },
  {
    question: "Is there a tool to figure out a song's BPM instead of setting one?",
    answer:
      "Yes — the BPM Tapper lets you tap along to a beat and calculates the tempo for you.",
    answerNode: (
      <>
        Yes — the{" "}
        <Link href="/bpm-tapper" className="text-amber-400 hover:underline">
          BPM Tapper
        </Link>{" "}
        lets you tap along to a beat and calculates the tempo for you.
      </>
    ),
  },
];

/**
 * `?bpm=` is a public, hand-editable URL — the BPM Tapper links here with it —
 * so it's validated rather than trusted. parseInt alone passed NaN through on
 * `?bpm=abc` and any out-of-range number on `?bpm=99999`, both of which reach
 * MetronomeForm as an initial tempo the page says isn't supported.
 */
function parseBpm(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return undefined;
  if (value < MIN_BPM || value > MAX_BPM) return undefined;
  return value;
}

interface MetronomePageProps {
  searchParams: Promise<{ bpm?: string }>;
}

export default async function MetronomePage({ searchParams }: MetronomePageProps) {
  const relatedTools = getRelatedTools("metronome", 5);
  const { bpm } = await searchParams;
  const initialBpm = parseBpm(bpm);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Metronome" }]} />
        }
        title="Free Online Metronome"
        lede="Adjustable BPM and time signature, right in your browser, free, no sign-up, no app."
        tool={<MetronomeForm initialBpm={initialBpm} />}
      >
        <FeatureStrip
          features={[
            {
              title: `${MIN_BPM}–${MAX_BPM} BPM`,
              desc: "Adjustable tempo covering everything from largo to presto.",
            },
            {
              title: "No drift",
              desc: "Scheduled against your browser's audio clock, not a basic timer.",
            },
            { title: "No sign-up", desc: "No account, no ads, no limits." },
          ]}
        />

        <ToolSection id="how-to" title="How to use the metronome">
          <ol>
            <li>Set your tempo using the slider or +/- buttons.</li>
            <li>Choose how many beats per measure to match your time signature.</li>
            <li>Tap start — the first beat of each measure is accented.</li>
          </ol>
        </ToolSection>

        <ToolSection id="what-is-it" title="What is an online metronome?">
          <p>
            An online metronome is a browser-based tool that plays a steady beat
            at a chosen tempo, measured in beats per minute (BPM). Musicians use
            a metronome to practice timing, improve rhythm, learn songs, and
            gradually increase playing speed. This one lets you choose a BPM from{" "}
            {MIN_BPM} to {MAX_BPM} and set the number of beats in each measure to
            match your time signature.
          </p>
        </ToolSection>

        <ToolSection id="what-bpm" title="What BPM should I practice at?">
          <p>
            Start at a tempo where you can play the exercise accurately and
            comfortably. For difficult passages, many musicians begin slowly and
            increase the BPM gradually as their timing improves. There&apos;s no
            single ideal practice tempo — the right BPM depends on the exercise,
            the song, and your current playing level. If you already know a
            song&apos;s tempo and want to match it exactly, the{" "}
            <Link href="/key-finder">Key &amp; BPM Finder</Link> can detect it
            directly from an audio file.
          </p>
        </ToolSection>

        <ToolSection id="common-tempos" title="Common metronome tempos">
          <p>
            Slow practice tempos are often useful for learning difficult
            passages, while faster tempos can be used once the notes and rhythm
            are secure. A tempo like 60 BPM gives one beat per second, while 120
            BPM gives two beats per second. Use the BPM controls above to find
            the tempo that fits your practice.
          </p>
          <p>
            Practicing an instrument and need to check pitch too? The{" "}
            <Link href="/tuner">Online Tuner</Link> runs the same way, directly
            in your browser.
          </p>
        </ToolSection>

        <ToolSection id="no-drift" title="Why this metronome doesn't drift">
          <p>
            Many simple online metronomes use a basic JavaScript timer to trigger
            each click, which can drift audibly out of time under normal browser
            load. This one schedules every click ahead of time directly against
            your browser&apos;s own audio clock — the same technique used in
            professional audio software — so timing stays consistent no matter
            how long you leave it running.
          </p>
          <p>
            Want the fuller technical breakdown of why plain JavaScript timers
            drift and how look-ahead scheduling actually fixes it?{" "}
            <Link href="/guides/why-online-metronomes-drift">
              Read Why Online Metronomes Drift Out of Time
            </Link>
            . Need to change a recording&apos;s tempo to match your practice
            speed instead? The <Link href="/tempo">Tempo Changer</Link> handles
            that.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}