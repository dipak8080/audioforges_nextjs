import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeAnalyzeForm } from "@/components/converter/YouTubeAnalyzeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { Prose } from "@/components/ui/Prose";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CamelotWheel } from "@/components/tools/CamelotWheel";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel } from "@/lib/data/tool-limits";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Free YouTube Key & BPM Finder";
const PAGE_DESCRIPTION =
  "Paste a YouTube link and automatically get its musical key, BPM, and Camelot notation, free. No download, no sign-up required.";

const UPDATED = "2026-09-10";

const OG_IMAGE = ogForTool("youtube-key-finder", "Free YouTube Key & BPM Finder");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/youtube-key-finder` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-key-finder`,
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

/**
 * No accuracy guarantees and no "instant" claims — analysis genuinely takes
 * 20–60 seconds.
 *
 * This block used to carry a comment asserting that "every claim below is
 * checked against config.py's confirmed values". It wasn't true of the FAQ
 * answers beneath it and hadn't been for some time. A comment claiming
 * verification is worse than no comment once the verification has lapsed,
 * because it stops the next person from checking. Both numbers come from the
 * shared data files now, which is a claim the code can actually keep.
 */
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Key & BPM Finder",
  url: `${SITE_URL}/youtube-key-finder`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Detects musical key and BPM directly from a YouTube link",
    "No manual download step",
    "Camelot notation for harmonic mixing",
    "No sign-up required",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

/**
 * Rate limit, from lib/data/rate-limits.ts.
 *
 * The FAQ used to state "a couple of requests every 10 minutes". The real
 * limit is 15 per hour — roughly seven times more generous — so the copy was
 * actively talking people out of a tool they were free to keep using.
 */
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";
const rateLimitLabel = getRateLimitLabel("youtube/analyze") ?? FALLBACK_RATE_LIMIT_LABEL;

/**
 * Video length cap, from lib/data/tool-limits.ts.
 *
 * The FAQ used to state "videos longer than 15 minutes aren't supported". The
 * real cap is 40 minutes.
 *
 * WHY THIS PAGE IS THE ODD ONE OUT among the /youtube/* tools, because the
 * same wrong number here was wrong in the OPPOSITE direction to its siblings.
 * Every chained YouTube tool stacks a download cap (MAX_VIDEO_DURATION_SECONDS,
 * 40 min) against a processing cap, and the smaller of the two is what a user
 * hits:
 *
 *   /youtube-vocal-remover and /youtube-stem-splitter — separation caps at
 *   10 min (6 on HQ), so those pages were OVER-promising. A 14-minute video
 *   was accepted, downloaded through the paid proxy, then refused.
 *
 *   THIS tool has no processing cap at all. Key/BPM analysis trims to
 *   ANALYSIS_MAX_SECONDS rather than rejecting a long file, so nothing after
 *   the download turns anything away — the 40-minute download cap really is
 *   the ceiling. This page was UNDER-promising, turning away perfectly
 *   processable 20- and 30-minute videos in its own copy.
 *
 * One hardcoded "15 minutes" string on three pages, wrong in two different
 * directions. That's exactly what a copy-pasted number does.
 */
const FALLBACK_DURATION_LABEL = "40 minutes";
const durationLabel = getDurationLabel("youtube/analyze") ?? FALLBACK_DURATION_LABEL;

const faqs = [
  {
    question: "How is this different from the regular Key & BPM Finder?",
    answer:
      "The regular Key & BPM Finder needs a file already on your device. This version accepts a YouTube link directly, fetching the audio and running it through the same underlying analysis without you needing to download it first.",
  },
  {
    question: "How long does this take?",
    answer:
      "Usually 20 to 60 seconds, it needs to fetch the audio from YouTube before analysis can even start, so it's slower than analyzing a file you've already uploaded.",
  },
  {
    question: "Does this work with Shorts?",
    answer: "Yes. Standard videos, youtu.be links, and Shorts are all supported.",
  },
  // Derived from tool-limits.ts — see the note above the constants for why the
  // previous hardcoded "15 minutes" was turning away videos this tool handles.
  {
    question: "Is there a video length limit?",
    answer: `Yes. Videos up to ${durationLabel} long are supported.`,
  },
  {
    question: "What if the video is private, age-restricted, or region-locked?",
    answer:
      "Videos in any of those states may not be accessible to the downloader and can't be analyzed as a result.",
  },
  {
    question: "How accurate is the detected key and BPM?",
    answer:
      "The same detection method used by the file-based Key & BPM Finder runs here. It works well on most conventional tracks, but automated key and tempo detection can be less certain on songs with ambiguous tonality, live performances, complex arrangements, heavy effects, or tempo changes mid-track.",
  },
  // Derived from rate-limits.ts. Do not hardcode this again.
  {
    question: "Is this really free?",
    answer: `Yes, free to use, usage is limited to ${rateLimitLabel} per person, since this chains a YouTube fetch together with analysis.`,
  },
  {
    question: "Can I remove the vocals from the same video too?",
    answer: "Yes. The YouTube Vocal Remover works the same way, straight from a link.",
    answerNode: (
      <>
        Yes. The{" "}
        <Link href="/youtube-vocal-remover" className="text-amber-400 hover:underline">
          YouTube Vocal Remover
        </Link>{" "}
        works the same way, straight from a link.
      </>
    ),
  },
];

export default function YouTubeKeyFinderPage() {
  const relatedTools = getRelatedTools("youtube-key-finder", 5);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[{ name: "Tools", href: "/tools" }, { name: "YouTube Key & BPM Finder" }]}
          />
        }
        meta={["No account", "No download step", "Accuracy published"]}
        title="Free YouTube Key & BPM Finder"
        lede="Paste a YouTube link and get its key, BPM, and Camelot notation automatically, no download step, no sign-up."
        tool={<YouTubeAnalyzeForm />}
      >
        <ProofStrip
          proofs={[
            {
              label: "One step",
              value: "Link in, key and BPM out",
              note: "The audio is fetched server-side and analysed. Nothing is saved to your device.",
            },
            {
              label: "Measured accuracy",
              value: "85% on BPM, about 50% on key",
              note: "Same engine as the file tool, scored on the GiantSteps set and written up in full.",
            },
            {
              label: "Length",
              value: `Up to ${durationLabel}`,
              note: `Only the first three minutes are analysed, so longer videos come back just as fast. ${rateLimitLabel} per IP.`,
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
              Camelot codes are what Rekordbox, Serato, Traktor and Mixed In Key all display, so a code from here
              drops straight into your library.{" "}
              <Link href="/guides/camelot-wheel-harmonic-mixing">The full harmonic mixing guide</Link> covers
              building a set around it.
            </p>
          </Prose>
        </ToolSection>

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
                  { state: "yes", text: "85%" },
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
            footnote="Each result carries a confidence figure, and a reading is flagged lower-confidence when two independent checks disagree."
          />
          <Prose className="mt-6">
            <p>
              Only the first three minutes are analysed, so the opening is the whole story. A video that starts with
              a long ambient intro or a drum-only build can read badly no matter how clear the rest is. YouTube audio
              is also compressed before it reaches the analyser, which costs a little on key detection but almost
              nothing on tempo. Live recordings, heavy effects and mid-track tempo changes give it less to lock onto.
            </p>
            <p>
              The write-up of the detectors and how the numbers were measured is in{" "}
              <Link href="/guides/bpm-detection-tempocnn">
                BPM Detection: From 42% to 85% Accuracy With a Pretrained Model
              </Link>
              . For why a reading comes back half or double, see{" "}
              <Link href="/guides/how-key-and-bpm-detection-works">how key and BPM detection works</Link>.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="next" title="Same link, next job" bleed>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Remove the vocals", "Instrumental or acapella from the same video.", "/youtube-vocal-remover"],
              ["Split into stems", "Vocals, drums, bass and other, four files.", "/youtube-stem-splitter"],
              ["Download the WAV", "If you want the audio itself, lossless.", "/youtube-to-wav"],
            ].map(([title, desc, href]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="group rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors hover:border-amber-500/40"
              >
                <p className="font-medium text-text-primary group-hover:text-amber-400">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
              </Link>
            ))}
          </div>
        </ToolSection>

        <ToolVideo slug="youtube-key-finder" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          legal="You are responsible for having the right to process any video you paste. Audio is fetched temporarily to run the analysis and is not kept; AudioForges does not host or distribute the videos analysed here."
        />
      </ToolPageShell>
    </>
  );
}