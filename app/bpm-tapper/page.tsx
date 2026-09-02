import type { Metadata } from "next";
import Link from "next/link";
import { BpmTapperForm } from "@/components/browser/BpmTapperForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
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
    question: "Can I find the BPM of a song by tapping?",
    answer:
      "Yes. Play the song and tap the button in time with its beat. After several taps, the tool calculates an estimated BPM from the intervals between your taps.",
  },
  {
    question: "How does this figure out the BPM?",
    answer:
      "It measures the time between each tap and averages the intervals from your most recent taps, converting that average into beats per minute — the more consistently you tap, the more accurate the result.",
  },
  {
    question: "How many times do I need to tap?",
    answer:
      "At least two taps give an estimate, but tapping along for 6-8 beats gives a much more stable, accurate reading than just two or three.",
  },
  {
    question: "What if I pause partway through?",
    answer:
      "A pause of more than 2 seconds starts a fresh tapping session rather than treating the gap as a very slow beat, so a brief interruption won't throw off your result — just start tapping again.",
  },
  {
    question: "Can I use my keyboard instead of clicking?",
    answer: "Yes — press Space or Enter in time with the beat once the tap area is focused.",
  },
  {
    question: "Can I send the result straight to a metronome?",
    answer:
      "Yes — once a BPM is detected, the \"Use in Metronome\" button opens the Metronome pre-set to that exact tempo.",
    answerNode: (
      <>
        Yes — once a BPM is detected, the &quot;Use in Metronome&quot;
        button opens the{" "}
        <Link href="/metronome" className="text-amber-400 hover:underline">
          Metronome
        </Link>{" "}
        pre-set to that exact tempo.
      </>
    ),
  },
  {
    question: "Is this really free?",
    answer: "Yes — completely free, no sign-up, no ads, no limits.",
  },
];

export default function BpmTapperPage() {
  const relatedTools = getRelatedTools("bpm-tapper", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "BPM Tapper" }]} />
        }
        title="Free BPM Tapper"
        lede="Tap along to a beat and find its BPM and tempo in seconds, free, no sign-up, right in your browser."
        tool={<BpmTapperForm />}
      >
        <FeatureStrip
          features={[
            { title: "Live estimate", desc: "See your BPM update as you tap." },
            { title: "Keyboard support", desc: "Tap with a click, Space, or Enter." },
            { title: "No sign-up", desc: "No account, no ads, no limits." },
          ]}
        />

        <ToolSection id="how-to" title="How to find a tempo by tapping">
          <ol>
            <li>Tap the button in time with a beat — from a song, a metronome, or your own count.</li>
            <li>Keep tapping for 6-8 beats for a stable, accurate result.</li>
            <li>Send the result straight to the Metronome, or note it down.</li>
          </ol>
        </ToolSection>

        <ToolSection id="what-is-it" title="What is a BPM tapper?">
          <p>
            A BPM tapper is an online tool that calculates the tempo of music by
            measuring the time between your taps. BPM stands for beats per
            minute, which is the standard way of describing musical tempo. Tap
            along with a song, beat, or metronome and this tool estimates its
            BPM from your tapping pattern.
          </p>
        </ToolSection>

        <ToolSection id="accuracy" title="How accurate is a BPM tapper?">
          <p>
            The result depends on how consistently you tap. Two taps provide a
            basic estimate, while tapping along for 6 to 8 beats gives the tool
            more intervals to average. This BPM tapper uses only your most
            recent taps to keep the estimate responsive if the tempo changes
            partway through. If you pause for more than two seconds, a new
            tapping session starts automatically rather than treating the gap as
            one very slow beat.
          </p>
          <p>
            Want the fuller breakdown of why only recent taps count and how the
            pause-reset threshold actually works?{" "}
            <Link href="/guides/how-tap-tempo-detection-works">
              Read How Tap Tempo Detection Actually Works
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="bpm-vs-tempo" title="What is the difference between BPM and tempo?">
          <p>
            BPM means beats per minute and gives a numerical measurement of
            tempo. For example, 60 BPM means 60 beats occur in one minute, while
            120 BPM means 120 beats occur in one minute. Tempo describes how fast
            or slow the music feels, while BPM provides a precise number for that
            tempo.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Finding the tempo of a song you&apos;re learning to play along with,
            setting a metronome to match a track without looking up its BPM
            online, and quickly checking your own natural tapping tempo.
          </p>
        </ToolSection>

        <ToolSection id="more-tempo-tools" title="More tools for working with tempo">
          <p>
            Once you know the BPM, use the{" "}
            <Link href="/metronome">Online Metronome</Link> to practice at that
            tempo. If you want to change the speed of an existing recording
            instead, the <Link href="/tempo">Tempo Changer</Link> handles that.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}