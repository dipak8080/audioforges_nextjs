import type { Metadata } from "next";
import Link from "next/link";
import { TunerForm, type TunerInitialSettings } from "@/components/browser/TunerForm";
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

const PAGE_TITLE = "Online Guitar Tuner – Free Chromatic Tuner";
const PAGE_DESCRIPTION =
  "Free online tuner for guitar, bass, ukulele, violin and more. String-by-string or chromatic, with Drop D, Open G and DADGAD. No app, no sign-up.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("tuner", "Free Online Guitar Tuner");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/tuner` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/tuner`,
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

// Every claim below matches the actual TunerForm implementation (chromatic
// autocorrelation detection, cents display). No "more accurate than physical
// tuners" claim — unbenchmarked.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Online Guitar Tuner",
  url: `${SITE_URL}/tuner`,
  dateModified: UPDATED,
  applicationCategory: "MusicApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Free online guitar tuner with string-by-string mode",
    "Chromatic tuner for all 12 notes",
    "Instrument presets: guitar, bass, ukulele, violin, viola, cello, mandolin",
    "Alternate guitar tunings: Drop D, Half-step down, Open G, DADGAD",
    "Auto-detects which string you're playing and tells you to tighten or loosen",
    "Warns before you over-tighten and snap a string",
    "Auto-advances to the next string and tracks tuning progress",
    "Per-string reference tones for tuning by ear",
    "Real-time microphone pitch detection",
    "Adjustable reference pitch (415–466 Hz) that transposes all string targets",
    "Shareable tuning links",
    "Works directly in the browser",
    "No download or sign-up required",
  ],
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

const faqs = [
  {
    question: "Can I tune a guitar with my phone microphone?",
    answer:
      "Yes. Allow microphone access, play one guitar string at a time, and the tuner will detect the note and show whether it's sharp or flat.",
  },
  {
    question: "Does this work as a chromatic tuner?",
    answer:
      "Yes. It detects all twelve chromatic notes, so it can be used for guitar, bass, ukulele, violin, and many other instruments.",
  },
  {
    question: "How accurate is the online tuner?",
    answer:
      "The tuner displays pitch deviation in cents. Accuracy depends on microphone quality, background noise, and how clearly the instrument produces a single sustained note.",
  },
  {
    question: "How do I know which string I'm tuning?",
    answer:
      "Pick your instrument and the tuner shows every string as a button. It auto-detects which string you're playing and highlights it, then tells you in plain words whether to tighten or loosen. You can also tap any string to tune it specifically.",
  },
  {
    question: "Can it stop me from over-tightening a string?",
    answer:
      "Yes. If the detected pitch is far above the selected string's target, the classic sign of tuning an octave too high, the tuner warns you to stop tightening before the string snaps.",
  },
  {
    question: "Can I hear what a string should sound like?",
    answer:
      "Yes. Each string has a small speaker button that plays its exact target pitch, so you can tune by ear when the microphone struggles, useful for low bass strings on laptop mics.",
  },
  {
    question: "Why isn't it detecting anything?",
    answer:
      "Make sure microphone access was granted, play a single sustained note rather than a chord (the detector is built for one pitch at a time), and reduce background noise if possible.",
  },
  {
    question: "Is my microphone audio uploaded?",
    answer:
      "No. Pitch analysis happens directly in your browser. The microphone audio is not recorded, saved, or uploaded to a server.",
  },
];

/** Share-link params are public and hand-editable — validated, not trusted.
 *  Anything malformed falls back to the chromatic default. */
const INSTRUMENT_IDS = ["guitar", "bass", "ukulele", "violin", "viola", "cello", "mandolin"] as const;
const TUNING_IDS = ["standard", "drop-d", "half-step", "open-g", "dadgad", "4-string", "5-string"] as const;

function parseChoice<T extends string>(raw: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

function parseRefPitch(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return undefined;
  if (value < 415 || value > 466) return undefined;
  return value;
}

interface TunerPageProps {
  searchParams: Promise<{ i?: string; t?: string; ref?: string }>;
}

export default async function TunerPage({ searchParams }: TunerPageProps) {
  const relatedTools = getRelatedTools("tuner", 5);
  const params = await searchParams;
  const initialSettings: TunerInitialSettings = {
    instrument: parseChoice(params.i, INSTRUMENT_IDS),
    tuning: parseChoice(params.t, TUNING_IDS),
    referencePitch: parseRefPitch(params.ref),
  };


  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Tuner" }]} />}
        meta={["No account", "Microphone stays on your device", "Guitar, bass, uke, strings"]}
        title="Free Online Guitar Tuner & Chromatic Tuner"
        lede="Tune guitar, bass, ukulele, violin or anything else with your microphone. Pitch detection runs in the page; nothing is recorded or sent anywhere. Free, no sign-up."
        tool={<TunerForm initialSettings={initialSettings} />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Detection",
              value: "Time-domain autocorrelation, in the browser",
              note: "Resolves the fundamental more precisely than an FFT bin can at low frequencies, which is why a low E reads cleanly. Nothing leaves your device.",
            },
            {
              label: "Instruments",
              value: "Guitar, bass, ukulele, violin, viola, cello, mandolin",
              note: "Standard, Drop D, half-step down, Open G, DADGAD, 4 and 5-string bass. Or chromatic, for anything.",
            },
            {
              label: "Reference",
              value: "A = 440 by default, 415 to 444 available",
              note: "For baroque pitch or an orchestra that tunes sharp. Every string target moves with it.",
            },
          ]}
        />

        <ToolSection id="reading" title="Reading the tuner" bleed>
          <CompareTable
            columns={["What it means", "What to do"]}
            highlight={-1}
            rows={[
              { label: "Needle left, flat", cells: [{ text: "The string is below the target" }, { text: "Tighten, slowly. Always tune up to the note, not down, so the string holds" }] },
              { label: "Needle right, sharp", cells: [{ text: "The string is above the target" }, { text: "Loosen past the note, then come back up to it" }] },
              { label: "Locked, green", cells: [{ state: "yes", text: "Readings have clustered within a few cents" }, { text: "Move to the next string" }] },
              { label: "Wrong string name", cells: [{ state: "partial", text: "Usually an octave read, or the pickup catching a harmonic" }, { text: "Pluck once, near the twelfth fret, and let it ring. Mute the other strings" }] },
              { label: "Nothing detected", cells: [{ state: "no", text: "Microphone blocked, or too far from the instrument" }, { text: "Allow the mic in the browser, get within a metre, pluck harder" }] },
            ]}
            footnote="The lock waits for a stable reading on purpose. A tuner that flickers on every attack is not more accurate, it is just less filtered."
          />
          <Prose className="mt-5">
            <p>
              Want to hear the target note? Each string has a reference tone in the tuner. Tuning a whole song
              rather than an instrument? <Link href="/key-finder">Key &amp; BPM Finder</Link> reads the key from a
              file. <Link href="/guides/how-instrument-tuners-detect-pitch">How instrument tuners detect pitch</Link>{" "}
              explains autocorrelation versus FFT.
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