import type { Metadata } from "next";
import Link from "next/link";
import { MetronomeForm, type MetronomeInitialSettings } from "@/components/browser/MetronomeForm";
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

/*
  TITLE. Bing Keyword Research, three months to 30 Aug 2026:

    bpm                250.8K   generic — belongs to /bpm-tapper, not here
    tempo              169.1K   generic
    metronome          136.5K   head term
    metronome online    24.0K   <- the title had the OTHER word order
    metronom            12.2K   German/Turkish/Polish spelling
    online metronome     6.7K
    metronome google     3.6K   ┐ navigational to Google's own widget,
    google metronome     2.1K   ┘ unwinnable and not worth chasing
    metronome app        1.5K
    free metronome       0.7K

  "metronome online" and "online metronome" are the same two words reversed
  and differ by 3.5x. The old title carried the smaller one. Bing weights
  exact-match placement hard enough that word order is worth getting right.

  `absolute`, so the brand suffix doesn't push this past the budget.
*/
const PAGE_TITLE = "Metronome Online – Free, Adjustable BPM and Tempo";
const PAGE_DESCRIPTION =
  "Free metronome online with adjustable BPM and time signature. Set any tempo from 30 to 300 BPM and practice rhythm in your browser. No app, no sign-up.";

/** Same range MetronomeForm enforces. Not a backend limit, so there's nothing
 *  in /limits to read it from — change both together. */
const MIN_BPM = 30;
const MAX_BPM = 300;

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("metronome", "Free Online Metronome");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
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
  alternateName: ["Metronome Online", "Free Metronome", "Metronome", "Browser Metronome"],
  url: `${SITE_URL}/metronome`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    `Adjustable BPM from ${MIN_BPM} to ${MAX_BPM}`,
    "Configurable time signature with an accented downbeat",
    "Subdivisions: eighths, triplets, and sixteenths",
    "Silent-bar practice mode with a visual beat that keeps running",
    "Speed trainer that raises the tempo automatically",
    "Classical tempo presets from Largo to Presto",
    "Shareable practice-settings links",
    "Scheduled against the audio clock to avoid drift",
    "No sign-up required",
  ],
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

const faqs = [
  {
    question: "Does this metronome drift out of time?",
    answer:
      "No, it schedules each click ahead of time directly against your browser's audio clock, rather than relying on a regular JavaScript timer that can drift under load. Timing stays consistent for as long as you leave it running.",
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
      "Yes, set beats per measure from 2 to 8 to match 2/4, 3/4, 4/4, 5/4, 6/8, and other common signatures.",
  },
  {
    question: "What is silent-bar practice?",
    answer:
      "The metronome plays a set number of bars out loud, then mutes for a set number of bars while the visual beat keeps running. If you're still in time when the sound comes back, your internal tempo is solid, a standard exercise for building timing without depending on the click.",
  },
  {
    question: "How does the speed trainer work?",
    answer:
      "Set a BPM increment, how many bars to play at each tempo, and a target BPM. The metronome raises the tempo automatically as you play, without stopping or glitching, until it reaches the target, where it either holds or loops back to your starting tempo.",
  },
  {
    question: "Can it play subdivisions like triplets?",
    answer:
      "Yes, choose eighths, triplets, or sixteenths and the metronome plays quieter, higher-pitched ticks between the main beats, keeping the accented downbeat intact.",
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

/** Share-link params follow the same rule as `?bpm=`: public, hand-editable,
 *  validated rather than trusted. Anything malformed or out of range is
 *  silently dropped and the form falls back to its default. */
function parseIntIn(raw: string | undefined, min: number, max: number): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return undefined;
  if (value < min || value > max) return undefined;
  return value;
}

function parseChoice<T extends string>(raw: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

interface MetronomeSearchParams {
  bpm?: string;
  beats?: string;
  sub?: string;
  mp?: string;
  mm?: string;
  ti?: string;
  tb?: string;
  tt?: string;
  tm?: string;
  snd?: string;
}

interface MetronomePageProps {
  searchParams: Promise<MetronomeSearchParams>;
}

export default async function MetronomePage({ searchParams }: MetronomePageProps) {
  const relatedTools = getRelatedTools("metronome", 5);
  const params = await searchParams;
  const initialBpm = parseBpm(params.bpm);

  const mutePlayed = parseIntIn(params.mp, 1, 4);
  const muteMuted = parseIntIn(params.mm, 1, 4);
  const trainerIncrement = parseIntIn(params.ti, 1, 20);
  const initialSettings: MetronomeInitialSettings = {
    beats: parseIntIn(params.beats, 2, 8),
    subdivision: parseIntIn(params.sub, 1, 4),
    mutePlayed,
    muteMuted,
    muteOn: mutePlayed !== undefined && muteMuted !== undefined ? true : undefined,
    trainerOn: trainerIncrement !== undefined ? true : undefined,
    trainerIncrement,
    trainerBars: parseIntIn(params.tb, 1, 8),
    trainerTarget: parseIntIn(params.tt, MIN_BPM, MAX_BPM),
    trainerMode: parseChoice(params.tm, ["hold", "loop"] as const),
    sound: parseChoice(params.snd, ["beep", "wood", "tick"] as const),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Metronome" }]} />}
        meta={["No account", `${MIN_BPM} to ${MAX_BPM} BPM`, "Does not drift"]}
        title="Free Online Metronome"
        lede={`Any tempo from ${MIN_BPM} to ${MAX_BPM}, any time signature, subdivisions, silent bars and a speed trainer, scheduled on the audio clock so it does not drift. Free, nothing to install.`}
        tool={<MetronomeForm initialBpm={initialBpm} initialSettings={initialSettings} />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Timing",
              value: "Scheduled on the audio clock, not a JS timer",
              note: "A 25 ms look-ahead queues each click against the sample-accurate AudioContext clock. Tab in the background, timer jitter, none of it reaches the beat.",
            },
            {
              label: "Practice modes",
              value: "Silent bars, speed trainer, subdivisions",
              note: "Mute a bar in every few to test your internal clock. Step the tempo up by a set amount every so many bars. Eighths, triplets, sixteenths.",
            },
            {
              label: "Share a setup",
              value: "Every setting lives in the URL",
              note: "Send a student one link with the tempo, signature and trainer already set. Nothing to explain.",
            },
          ]}
        />

        <ToolSection id="tempos" title="Where the common tempos sit" bleed>
          <CompareTable
            columns={["BPM", "Where you hear it"]}
            highlight={-1}
            rows={[
              { label: "Largo", cells: [{ text: "40 to 60", mono: true }, { text: "Slow movements, ballads, working out a hard passage note by note" }] },
              { label: "Andante", cells: [{ text: "76 to 108", mono: true }, { text: "Walking pace. Hip-hop and lo-fi sit here" }] },
              { label: "Moderato", cells: [{ text: "108 to 120", mono: true }, { text: "Most pop. House starts around 120" }] },
              { label: "Allegro", cells: [{ text: "120 to 168", mono: true }, { text: "Techno, trance, most rock. Drum and bass at double time is 170" }] },
              { label: "Presto", cells: [{ text: "168 to 200", mono: true }, { text: "Punk, fast bebop, footwork" }] },
            ]}
            footnote="Practise slower than you can play cleanly, then use the speed trainer to climb. Speed you cannot hold at 80 does not exist at 120."
          />
          <Prose className="mt-5">
            <p>
              Do not know the tempo of a song? <Link href="/bpm-tapper">Tap it</Link>, or{" "}
              <Link href="/key-finder">upload the file</Link>. Why most online metronomes drift and this one does
              not: <Link href="/guides/why-online-metronomes-drift">the guide</Link>.
            </p>
          </Prose>
        </ToolSection>

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline updated={UPDATED} />
      </ToolPageShell>
    </>
  );
}