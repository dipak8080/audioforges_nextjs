import type { Metadata } from "next";
import Link from "next/link";
import { KeyFinderForm } from "@/components/converter/KeyFinderForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CamelotWheel } from "@/components/tools/CamelotWheel";
import { MAX_BATCH_FILES } from "@/lib/data/key-finder";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { Prose } from "@/components/ui/Prose";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/*
  TITLE. Bing Keyword Research, three months to 30 Aug 2026:

    bpm             250.8K   too generic — "bpm" alone is not this intent
    tunebat          80.8K   competitor brand, navigational, unwinnable
    bpm finder       50.2K
    key finder       23.9K   <- was split by "& BPM" in the old title
    keyfinder         9.9K
    tunebat key finder 7.4K  brand again
    bpm detector      6.6K
    song key finder   4.2K
    key and bpm finder 4.0K
    tempo finder      3.5K

  "Song Key Finder & BPM Finder" is the efficient phrasing: it contains
  "key finder" (23.9K) AND "song key finder" (4.2K) as adjacent words at no
  extra length, and keeps "bpm finder" (50.2K) adjacent too. The old
  "Song Key & BPM Finder" only managed the last of those three.

  `absolute`, so the brand suffix doesn't eat the differentiator.
*/
const PAGE_TITLE = "Song Key Finder & BPM Finder – Free, No Sign-Up";
const PAGE_DESCRIPTION =
  "Free key and BPM finder. Detect key, tempo and Camelot code for one track or a batch of 20, then export a CSV or the files renamed. No sign-up.";

const UPDATED = "2026-09-11";

const OG_IMAGE = ogForTool("key-finder", "Free Song Key & BPM Finder");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/key-finder` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/key-finder`,
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

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.
//
// NO RATE LIMIT IS STATED, deliberately. /analyze has no RATE_LIMITS entry —
// KeyFinderForm's own comment records that getRetryAfterFallback returns its
// 300s default for it. Nothing to publish without inventing a number.

export default async function KeyFinderPage() {
  const relatedTools = getRelatedTools("key-finder", 5);

  // Rendered from the backend list. A hand-written array here named six
  // formats where allowed_audio_formats has seven — AIFF was missing, and
  // KeyFinderForm's own accept string ends ".aiff".
  const limits = await getLimits();
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Song Key Finder & BPM Finder",
    // Standalone entity labels. No "Tunebat" variants — that is a competitor
    // brand and a navigational query, not something this page can serve.
    alternateName: [
      "Song Key Finder",
      "Key Finder",
      "BPM Finder",
      "BPM Detector",
      "Tempo Finder",
      "Camelot Key Finder",
      "Batch Key Finder",
      "Bulk BPM Analyzer",
      "DJ Library Key Tagger",
    ],
    url: `${SITE_URL}/key-finder`,
    dateModified: UPDATED,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Detect musical key of any song",
      "Detect BPM / tempo",
      "Camelot notation for harmonic mixing",
      `Batch analysis of up to ${MAX_BATCH_FILES} files at once`,
      "Export results as CSV",
      "Download the original files renamed with their key and BPM",
      `Accepts ${formatList}`,
      "No sign-up required",
      "Nothing to install",
    ],
  };

  const faqs = [
    {
      question: "Can I analyse several tracks at once?",
      answer: `Yes. Drop up to ${MAX_BATCH_FILES} files and they run one after another, never in parallel, so the analyser is not overloaded. Sort the results by key, BPM or a suggested mix order, then download a CSV of the results, or the original files renamed with their key and BPM in front, like A minor - 128 - Track.wav. The audio itself is not touched.`,
    },
    {
      question: "Can I rename my music files with the key and BPM?",
      answer:
        "Yes, after a batch run. The ZIP download contains your original files, byte for byte, each renamed to put the key and BPM at the front, like A minor - 128 - Track.wav. Nothing is re-encoded, so the audio is untouched. Useful if you sort a DJ crate by filename; if your software reads tags instead, use the CSV.",
    },
    {
      question: "What is Camelot notation?",
      answer:
        "A numbering system for musical keys (1A–12B) that maps every key onto a wheel where neighbours are harmonically compatible. Standard on Rekordbox, Serato, Traktor and Mixed In Key.",
    },
    {
      question: "Why does BPM matter for DJs?",
      answer: "Matching or beat-syncing BPM is what allows two tracks to play in time together.",
    },
    {
      question: "What's the difference between major and minor keys?",
      answer:
        "Major keys generally sound brighter and more resolved, while minor keys sound darker or more emotional. Every major key has a relative minor built from the same notes, which is why they share the same Camelot number with a different letter.",
    },
    {
      question: "What file formats can I upload?",
      answer: `${formatList}, up to ${limits.maxUploadMb}MB per file.`,
    },
    {
      question: "Does it analyse the whole track?",
      answer:
        "The first three minutes. The server makes a trimmed copy, analyses that, and deletes it, which is why a nine-minute mix comes back as fast as a three-minute single. For most music that's plenty, since key and tempo are established early. It matters when a track opens with a long intro that isn't representative: trim to a section with the harmony in it and analyse that instead.",
    },
    {
      question: "How long does key and BPM detection take?",
      answer:
        "Just a few seconds for most tracks, results appear as soon as analysis finishes, no waiting in a queue.",
    },
    {
      /*
        The strongest privacy sentence on the site, and it used to be delivered
        as a hedge ("does not store or distribute uploaded tracks", which never
        says deleted).

        /analyze is genuinely different from every other route here: it returns
        NUMBERS, not a file. The upload is deleted in an unconditional finally
        — success, a 400 on a corrupt file, or a 500 — along with the trimmed
        analysis copy. And it creates no job row, so there's no output file and
        nothing with a TTL. Every other tool's answer has a second half
        ("...and the result lasts an hour"); this one doesn't.
      */
      question: "Is my uploaded track stored or shared?",
      answer:
        "No. Your file is deleted as soon as analysis finishes, including if it fails, and including the temporary trimmed copy the analyser works from. Nothing is stored afterward: the key and BPM come back directly in the response, so there's no result file and nothing with an expiry. There are no accounts, so nothing is linked to you.",
    },
    {
      question: "What affects detection accuracy?",
      answer:
        "The first three minutes are what matter, since that's what gets analysed, so a track whose opening three minutes represent the song will read well, and one that opens with a long ambient or drum-only intro can read badly no matter how clear the rest is. If that's your track, trim to a section with the harmony in it and analyse that instead. Beyond the intro problem: consistent tempo and clear harmonic content help, while live recordings, heavy distortion, mid-track tempo changes and spoken-word audio all give the analysis less to lock onto.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Key & BPM Finder" }]} />
        }
        meta={["No account", `Batch up to ${MAX_BATCH_FILES} files`, "CSV or renamed files"]}
        title="Free Song Key Finder &amp; BPM Finder"
        lede="Upload any song and instantly detect its musical key and tempo, free, no sign-up, nothing to install."
        tool={<KeyFinderForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Measured accuracy",
              value: "85% on BPM, about 50% on key",
              note: "Scored on the GiantSteps set and written up in full. Nobody else in this category publishes a number.",
            },
            {
              label: "Nothing stored",
              value: "Your file is deleted on completion",
              note: "Key and BPM come back as numbers, not a file. No job row, no result to expire.",
            },
            {
              label: "A folder at a time",
              value: `Up to ${MAX_BATCH_FILES} files, one after another`,
              note: "Drop a whole crate. Download the results as CSV, or the same files renamed with key and BPM.",
            },
            {
              label: "Output",
              value: "Key, BPM and Camelot code",
              note: `Reads in a few seconds. ${formatList}, up to ${limits.maxUploadMb}MB.`,
            },
          ]}
        />

        <ToolSection id="camelot" title="What the Camelot code is for" bleed>
          <Prose className="mb-5">
            <p>
              Every result comes back with a Camelot code as well as the key name. The wheel renames the 24 keys as
              1 to 12 plus A for minor or B for major, and puts every compatible key next to its neighbours. From
              whatever is playing, three moves are safe: the same number with the other letter, one number up, one
              number down.
            </p>
          </Prose>
          <CamelotWheel highlight="8A" />
          <Prose className="mt-5">
            <p>
              8A is A minor. 8B is C major, its relative major, built from the same notes, which is why the letter
              swap always works. 7A and 9A are one step around the circle of fifths in each direction. Everything
              else on the wheel will fight it to some degree.
            </p>
            <p>
              Camelot codes are what Rekordbox, Serato, Traktor and Mixed In Key all display, so a code from here
              drops straight into your library.{" "}
              <Link href="/guides/camelot-wheel-harmonic-mixing">The full harmonic mixing guide</Link> covers
              building a set around it, and the{" "}
              <Link href="/guides/dj-set-prep-checklist">set prep checklist</Link> covers ordering for energy once
              everything is tagged.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="how-to" title="Three steps, nothing to configure" bleed>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["Upload", `Drop an ${formatList} file. Up to ${limits.maxUploadMb}MB.`],
              ["Analyse", "Runs automatically. No settings, no queue, a few seconds."],
              ["Read", "Key, BPM and Camelot code. Copy them into your library and the file is already gone."],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <p className="font-mono text-[11px] text-amber-400">Step {i + 1}</p>
                <p className="mt-1.5 font-medium text-text-primary">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </ToolSection>

        {/*
          REWRITTEN TO MATCH THE FAQ ANSWER OF THE SAME NAME.

          This section said detection "works best on clean, full-length tracks"
          and listed long intros as one caveat among several, while the FAQ —
          already corrected — said the opposite: only the first three minutes
          are read, so length past that buys nothing, and a long intro is the
          failure case rather than a mild caveat. The page gave two different
          answers depending on which half you read, and the visible section had
          the wrong one.
        */}
        <ToolSection id="accuracy" title="How accurate it is, and when it is wrong" bleed>
          <CompareTable
            columns={["BPM", "Key"]}
            highlight={0}
            rows={[
              {
                label: "Detector",
                cells: [
                  { text: "TempoCNN, pretrained", mono: true },
                  { text: "Essentia bgate profile", mono: true },
                ],
              },
              {
                label: "Exact match on GiantSteps",
                cells: [
                  { state: "yes", text: "85%", sub: "up from 42% before the model change" },
                  { state: "partial", text: "About 50%", sub: "the harder of the two problems" },
                ],
              },
              {
                label: "Usual failure",
                cells: [
                  { text: "Reads half or double the real tempo" },
                  { text: "Returns the relative major or minor" },
                ],
              },
            ]}
            footnote="Measured on the public GiantSteps set, not estimated. The method is in the write-up below."
          />
          <Prose className="mt-6">
            <p>
              Only the first three minutes are analysed. The server writes a trimmed copy, reads that, and deletes
              it, which is why a nine-minute mix comes back as fast as a three-minute single and why a longer file
              buys nothing in accuracy.
            </p>
            <p>
              That makes the opening the whole story. A track whose first three minutes represent the song reads
              well. A track that opens with a long ambient pad or a drum-only intro can read badly no matter how
              clear the rest of it is, because the analyser never reaches the rest. If that is your track, trim to a
              section with the harmony in it using the <Link href="/trim">Audio Trimmer</Link> and analyse that
              instead.
            </p>
            <p>
              Beyond the intro: consistent tempo and clear harmonic content help, while live recordings, heavy
              distortion, mid-track tempo changes and spoken-word audio all give the analysis less to lock onto. If
              the recording has significant background noise, the{" "}
              <Link href="/noise-remove" prefetch={false}>Noise Remover</Link> first can improve detection.
            </p>
            <p>
              The full write-up of what the detectors are, what failed and how the numbers were measured is in{" "}
              <Link href="/guides/bpm-detection-tempocnn">
                BPM Detection: From 42% to 85% Accuracy With a Pretrained Model
              </Link>
              . For the plain-language version of why a reading comes back half or double, see{" "}
              <Link href="/guides/how-key-and-bpm-detection-works">how key and BPM detection works</Link>.
            </p>
          </Prose>
        </ToolSection>

        <ToolVideo slug="key-finder" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline updated={UPDATED} note="BPM detection moved to a pretrained TempoCNN model" />
      </ToolPageShell>
    </>
  );
}