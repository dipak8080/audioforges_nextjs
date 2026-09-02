import type { Metadata } from "next";
import Link from "next/link";
import { KeyFinderForm } from "@/components/converter/KeyFinderForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
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
  "Free song key finder and BPM finder. Detect the musical key, tempo and Camelot notation of any track — MP3, WAV, FLAC, AAC, M4A, OGG or AIFF. No sign-up.";

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
    ],
    url: `${SITE_URL}/key-finder`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Detect musical key of any song",
      "Detect BPM / tempo",
      "Camelot notation for harmonic mixing",
      `Accepts ${formatList}`,
      "No sign-up required",
      "Nothing to install",
    ],
  };

  const faqs = [
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
        "The first three minutes. The server makes a trimmed copy, analyses that, and deletes it — which is why a nine-minute mix comes back as fast as a three-minute single. For most music that's plenty, since key and tempo are established early. It matters when a track opens with a long intro that isn't representative: trim to a section with the harmony in it and analyse that instead.",
    },
    {
      question: "How long does key and BPM detection take?",
      answer:
        "Just a few seconds for most tracks — results appear as soon as analysis finishes, no waiting in a queue.",
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
        "No. Your file is deleted as soon as analysis finishes — including if it fails, and including the temporary trimmed copy the analyser works from. Nothing is stored afterward: the key and BPM come back directly in the response, so there's no result file and nothing with an expiry. There are no accounts, so nothing is linked to you.",
    },
    {
      question: "What affects detection accuracy?",
      answer:
        "The first three minutes are what matter, since that's what gets analysed — so a track whose opening three minutes represent the song will read well, and one that opens with a long ambient or drum-only intro can read badly no matter how clear the rest is. If that's your track, trim to a section with the harmony in it and analyse that instead. Beyond the intro problem: consistent tempo and clear harmonic content help, while live recordings, heavy distortion, mid-track tempo changes and spoken-word audio all give the analysis less to lock onto.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Key & BPM Finder" }]} />
        }
        title="Free Song Key Finder &amp; BPM Finder"
        lede="Upload any song and instantly detect its musical key and tempo, free, no sign-up, nothing to install."
        tool={<KeyFinderForm />}
      >
        <FeatureStrip
          features={[
            { title: "Instant", desc: "Results in a few seconds. No queue, no waiting." },
            { title: "Accurate", desc: "Key, BPM, and Camelot notation for confident mixing." },
            {
              title: "No sign-up",
              desc: `No account, no install. Up to ${limits.maxUploadMb}MB per file.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to find a song's key and BPM">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Analysis runs automatically — no settings to configure.</li>
            <li>Get the detected key, BPM, and Camelot code in a few seconds.</li>
          </ol>
        </ToolSection>

        <ToolSection id="why-it-matters" title="Why key and BPM matter">
          <p>
            Every piece of tonal music sits in a <strong>key</strong> — a home
            note and scale the melody and chords are built around.{" "}
            <strong>BPM</strong> is how fast the track pulses. Together,
            they&apos;re the two numbers DJs and producers need before mixing,
            remixing, or layering two tracks.
          </p>
          <p>
            <strong>Harmonic mixing</strong> — blending tracks with compatible
            keys — is what separates a set that flows from one that clashes.
          </p>
        </ToolSection>

        <ToolSection id="major-minor" title="Major vs. minor keys">
          <p>
            A detected key is always either major or minor. Major keys generally
            read as brighter or more resolved; minor keys read as darker or more
            emotional. Every major key shares its exact notes with a relative
            minor key — which is exactly why they sit at the same Camelot number
            with a different letter (8A and 8B, for example), and why that
            pairing is always a safe harmonic move.
          </p>
        </ToolSection>

        <ToolSection id="camelot" title="Understanding Camelot notation">
          <p>
            The <strong>Camelot Wheel</strong> renames the 24 musical keys as
            numbers 1–12 followed by &quot;A&quot; (minor) or &quot;B&quot;
            (major). From any key, you can safely mix into the same number, the
            next number up, or the next number down.
          </p>
          <p>
            Want the full breakdown of how to use this for building a set?{" "}
            <Link href="/guides/camelot-wheel-harmonic-mixing">
              Read The Camelot Wheel Explained: Harmonic Mixing for DJs
            </Link>
            .
          </p>
          <p>
            Once you&apos;ve got key and BPM tagged, the next step is grouping
            tracks by Camelot compatibility and ordering them for energy before
            you play.{" "}
            <Link href="/guides/dj-set-prep-checklist">
              Read the 6-Step DJ Set Prep Checklist
            </Link>
            .
          </p>
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
        <ToolSection id="accuracy" title="What affects detection accuracy">
          <p>
            Only the first three minutes are analysed. The server writes a
            trimmed copy, reads that, and deletes it — which is why a nine-minute
            mix comes back as fast as a three-minute single, and why a longer
            file buys nothing in accuracy.
          </p>
          <p>
            That makes the opening the whole story. A track whose first three
            minutes represent the song reads well. A track that opens with a long
            ambient pad or a drum-only intro can read badly no matter how clear
            the rest of it is, because the analyser never reaches the rest. If
            that&apos;s your track, trim to a section with the harmony in it
            using the <Link href="/trim">Audio Trimmer</Link> and analyse that
            instead.
          </p>
          <p>
            Beyond the intro: consistent tempo and clear harmonic content help,
            while live recordings, heavy distortion, mid-track tempo changes and
            spoken-word audio all give the analysis less to lock onto. If your
            recording has significant background noise, running it through the{" "}
            <Link href="/noise-remove" prefetch={false}>
              Noise Remover
            </Link>{" "}
            first can improve detection.
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}