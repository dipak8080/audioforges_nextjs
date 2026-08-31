import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { TunerForm } from "@/components/browser/TunerForm";
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

const PAGE_TITLE = "Free Online Guitar Tuner & Chromatic Tuner";
const PAGE_DESCRIPTION =
  "Free online guitar and chromatic tuner. Tune guitar, bass, ukulele, violin, and more with your microphone in real time.";

const OG_IMAGE = ogForTool("tuner", "Free Online Guitar Tuner");

export const metadata: Metadata = {
  title: PAGE_TITLE,
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
  applicationCategory: "MusicApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Free online guitar tuner",
    "Chromatic tuner for all 12 notes",
    "Real-time microphone pitch detection",
    "Tune guitar, bass, ukulele, violin, viola, cello, and other instruments",
    "Sharp and flat cents indicator",
    "Works directly in the browser",
    "No download or sign-up required",
  ],
};

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

const GUITAR_STRINGS: [string, string, string][] = [
  ["6th string", "E2", "82.41 Hz"],
  ["5th string", "A2", "110.00 Hz"],
  ["4th string", "D3", "146.83 Hz"],
  ["3rd string", "G3", "196.00 Hz"],
  ["2nd string", "B3", "246.94 Hz"],
  ["1st string", "E4", "329.63 Hz"],
];

const ALT_TUNINGS: [string, string][] = [
  ["Standard", "E A D G B E"],
  ["Drop D", "D A D G B E"],
  ["D Standard", "D G C F A D"],
  ["Open G", "D G D G B D"],
];

const faqs = [
  {
    question: "Is this a free online guitar tuner?",
    answer:
      "Yes. This guitar tuner is free to use in your browser with no sign-up, download, or account required.",
  },
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
    question: "What is standard guitar tuning?",
    answer:
      "Standard six-string guitar tuning is E2, A2, D3, G3, B3, and E4, from the lowest-pitched string to the highest.",
  },
  {
    question: "How accurate is the online tuner?",
    answer:
      "The tuner displays pitch deviation in cents. Accuracy depends on microphone quality, background noise, and how clearly the instrument produces a single sustained note.",
  },
  {
    question: "Can I tune bass and ukulele with this tuner?",
    answer:
      "Yes. Because it detects chromatic pitch rather than a fixed set of guitar strings, it can be used with bass, ukulele, violin, and other pitched instruments.",
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

export default function TunerPage() {
  const relatedTools = getRelatedTools("tuner", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Online Guitar Tuner" }]} />
        }
        title="Free Online Guitar Tuner & Chromatic Tuner"
        lede="Tune guitar, bass, ukulele, violin, or any instrument with your microphone, in real time."
        tool={<TunerForm />}
      >
        <FeatureStrip
          features={[
            {
              title: "Guitar, bass & more",
              desc: "Tune guitar, bass, ukulele, violin, and other instruments.",
            },
            {
              title: "Chromatic detection",
              desc: "Detects all 12 notes and shows pitch in real time.",
            },
            {
              title: "Nothing uploaded",
              desc: "Your microphone audio is analyzed directly in your browser.",
            },
          ]}
        />

        <ToolSection id="how-to" title="How to tune a guitar online">
          <ol>
            <li>Click &quot;Start tuning&quot; and allow microphone access.</li>
            <li>Play one guitar string at a time and let it ring clearly.</li>
            <li>
              Watch the note and cents indicator to see whether the string is
              sharp or flat.
            </li>
            <li>
              Adjust the tuning peg until the note is centered and the tuner shows
              it&apos;s in tune.
            </li>
          </ol>
        </ToolSection>

        {/* The six strings were six bordered cards. String, note and frequency
            are three genuine columns of the same dataset — that's a table. */}
        <ToolSection id="guitar" title="Free online guitar tuner" bleed>
          <Prose>
            <p>
              Tune your acoustic or electric guitar online using your
              device&apos;s microphone. Play one string at a time and watch the
              pitch indicator show whether the note is sharp, flat, or in tune.
            </p>
            <h3>Standard guitar tuning</h3>
            <p>
              Standard guitar tuning from the lowest string to the highest is E2,
              A2, D3, G3, B3, and E4. Use the chromatic tuner to check each string
              and adjust until the pitch is centered.
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">String</th>
                  <th className="px-4 py-3 font-semibold">Note</th>
                  <th className="px-4 py-3 font-semibold">Frequency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                {GUITAR_STRINGS.map(([string, note, frequency]) => (
                  <tr key={string}>
                    <td className="px-4 py-3">{string}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-amber-400">{note}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolSection>

        <ToolSection id="chromatic" title="Free chromatic tuner">
          <p>
            This is a chromatic tuner, so it can detect all twelve notes of the
            musical scale rather than being limited to one instrument or tuning.
            Use it for guitar, bass, ukulele, violin, viola, cello, flute,
            clarinet, trumpet, vocals, and other instruments that produce a clear
            pitch.
          </p>
          <p>
            The tuner shows the detected note, frequency, and cents difference
            from the nearest note. A centered reading means the instrument is in
            tune, while a negative or positive reading indicates the pitch is flat
            or sharp.
          </p>
        </ToolSection>

        {/* Four bordered cards for a name and a six-note string is a definition
            list. The tuning itself is a code, so it goes in mono. */}
        <ToolSection id="tunings" title="Guitar tunings you can use">
          <p>
            Because this is a chromatic tuner, you can use it for standard and
            alternate guitar tunings. Play each string and tune it to the target
            note for the tuning you want.
          </p>
          <dl>
            {ALT_TUNINGS.map(([name, tuning]) => (
              <Fragment key={name}>
                <dt>{name}</dt>
                <dd>
                  <code>{tuning}</code>
                </dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="how-it-works" title="How the pitch detection works">
          <p>
            This tuner analyzes the actual shape of your instrument&apos;s sound
            wave to find its true fundamental frequency, rather than just checking
            which frequency band is loudest. That distinction matters for
            accuracy: a simpler approach can easily confuse two notes that are
            close together, while analyzing the waveform&apos;s repeating pattern
            directly gives a much finer, more reliable reading of exactly what
            pitch is being played.
          </p>
          <p>
            Want the fuller breakdown of how autocorrelation-based pitch detection
            actually works, and why the tuner turns off your browser&apos;s echo
            cancellation and noise suppression?{" "}
            <Link href="/guides/how-instrument-tuners-detect-pitch">
              Read How Instrument Tuners Actually Detect Pitch
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <p>
            Tuning a guitar, bass, ukulele, or violin before practicing or
            recording, checking vocal pitch accuracy during warm-ups, and
            verifying an instrument&apos;s intonation across its range.
          </p>
          <p>
            Need to find the pitch of an existing recording instead? Try the{" "}
            <Link href="/key-finder">Key &amp; BPM Finder</Link>. Once your
            instrument is tuned, use the{" "}
            <Link href="/metronome">Online Metronome</Link> to practice at a
            consistent tempo.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}