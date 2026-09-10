import type { Metadata } from "next";
import Link from "next/link";
import { BpmTapperForm } from "@/components/browser/BpmTapperForm";
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
  Small cluster — Bing Keyword Research, three months to 30 Aug 2026:

    bpm tapper     2.9K   head term
    bpm checker    2.8K
    tap bpm        2.8K
    tap tempo      2.5K   <- was split across the title, never adjacent
    bpm analyzer   1.6K
    tap counter    1.5K
    tempo tapper   1.5K
    bpm tap        1.4K

  ~17K in total, so this page is not a traffic play and the title should not
  be stuffed to chase it. One change only: "Tap Tempo" now sits as an adjacent
  pair, which the old "Tap to Find BPM & Tempo" never gave despite containing
  both words.

  Two larger terms in the same result set belong to OTHER pages and should not
  be pulled here: "online metronome" (6.7K) is /metronome's, and "song key
  finder" (4.2K) is /key-finder's. Both are bigger than this page's head term.
*/
const PAGE_TITLE = "BPM Tapper – Tap Tempo to Find BPM, Free";
const PAGE_DESCRIPTION =
  "Tap along to a beat to find its BPM and tempo instantly. Free online BPM tapper with keyboard support, no sign-up, and no download.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("bpm-tapper", "Free BPM Tapper");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/bpm-tapper` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/bpm-tapper`,
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

// Every claim below matches the actual BpmTapperForm implementation
// (rolling 8-tap window, 2-second reset).
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "BPM Tapper",
  alternateName: ["Tap Tempo", "BPM Checker", "Tempo Tapper", "Tap BPM"],
  url: `${SITE_URL}/bpm-tapper`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Tap-to-tempo BPM detection",
    "Keyboard support (Space/Enter)",
    "Sends the result directly to the Metronome",
    "No sign-up required",
  ],
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

const faqs = [
  {
    question: "How does this figure out the BPM?",
    answer:
      "It measures the time between each tap and averages the intervals from your most recent taps, converting that average into beats per minute, the more consistently you tap, the more accurate the result.",
  },
  {
    question: "How many times do I need to tap?",
    answer:
      "At least two taps give an estimate, but tapping along for 6-8 beats gives a much more stable, accurate reading than just two or three.",
  },
  {
    question: "What if I pause partway through?",
    answer:
      "A pause of more than 2 seconds starts a fresh tapping session rather than treating the gap as a very slow beat, so a brief interruption won't throw off your result, just start tapping again.",
  },
  {
    question: "Can I use my keyboard instead of clicking?",
    answer: "Yes, press Space or Enter in time with the beat once the tap area is focused.",
  },
  {
    question: "Can I send the result straight to a metronome?",
    answer:
      "Yes, once a BPM is detected, the \"Use in Metronome\" button opens the Metronome pre-set to that exact tempo.",
    answerNode: (
      <>
        Yes, once a BPM is detected, the &quot;Use in Metronome&quot;
        button opens the{" "}
        <Link href="/metronome" className="text-amber-400 hover:underline">
          Metronome
        </Link>{" "}
        pre-set to that exact tempo.
      </>
    ),
  },
];

export default function BpmTapperPage() {
  const relatedTools = getRelatedTools("bpm-tapper", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "BPM Tapper" }]} />}
        meta={["No account", "Runs in the page", "Tells you when to trust it"]}
        title="Free BPM Tapper"
        lede="Tap along to a beat, on the button or the space bar, and read the tempo. It averages your last eight taps and says when they are steady enough to trust. Free, nothing uploaded."
        tool={<BpmTapperForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "The maths",
              value: "Rolling average of the last 8 taps",
              note: "Not the whole session. If you drift, the reading follows you instead of being dragged by taps from a minute ago.",
            },
            {
              label: "Confidence",
              value: "Marked steady below 6% variation",
              note: "Once your intervals cluster tightly the reading is flagged as trustworthy. Rushing or a missed tap shows up as unsteady.",
            },
            {
              label: "Pauses",
              value: "A gap over 2 s starts a fresh count",
              note: "Stop, listen again, tap again. The stale interval is not folded into the average.",
            },
          ]}
        />

        <ToolSection id="which" title="Tapping, or detection?" bleed>
          <CompareTable
            columns={["BPM Tapper, this page", "Key & BPM Finder"]}
            highlight={-1}
            rows={[
              { label: "Input", cells: [{ text: "You, tapping to something playing anywhere" }, { text: "An audio file you upload" }] },
              { label: "Accuracy", cells: [{ state: "partial", text: "As good as your timing. Within 1 to 2 BPM after eight steady taps" }, { state: "yes", text: "85% exact on a public test set, measured" }] },
              { label: "Best for", cells: [{ text: "Music on the radio, a live band, a video, a feel you have in your head" }, { text: "Files in your library that you want tagged" }] },
              { label: "Common failure", cells: [{ text: "Tapping half or double time. Try tapping the snare instead of every beat" }, { text: "Reading half or double the real tempo on sparse intros" }] },
            ]}
            footnote="Both hand off to the metronome. Send the tapped tempo straight over and practise at the speed you just found."
          />
          <Prose className="mt-5">
            <p>
              Have the file? <Link href="/key-finder">Key &amp; BPM Finder</Link> reads it with the Camelot code
              included. Found the tempo and want to practise at it? <Link href="/metronome">Metronome</Link>.{" "}
              <Link href="/guides/how-tap-tempo-detection-works">How tap tempo detection works</Link> covers the
              averaging in detail.
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