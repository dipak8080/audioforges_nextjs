import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeAnalyzeForm } from "@/components/converter/YouTubeAnalyzeForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel } from "@/lib/data/tool-limits";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Free YouTube Key & BPM Finder";
const PAGE_DESCRIPTION =
  "Paste a YouTube link and automatically get its musical key, BPM, and Camelot notation, free. No download, no sign-up required.";

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
      "Usually 20 to 60 seconds — it needs to fetch the audio from YouTube before analysis can even start, so it's slower than analyzing a file you've already uploaded.",
  },
  {
    question: "Does this work with Shorts?",
    answer: "Yes — standard videos, youtu.be links, and Shorts are all supported.",
  },
  // Derived from tool-limits.ts — see the note above the constants for why the
  // previous hardcoded "15 minutes" was turning away videos this tool handles.
  {
    question: "Is there a video length limit?",
    answer: `Yes — videos up to ${durationLabel} long are supported.`,
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
    answer: `Yes, free to use — usage is limited to ${rateLimitLabel} per person, since this chains a YouTube fetch together with analysis.`,
  },
  {
    question: "Can I remove the vocals from the same video too?",
    answer: "Yes — the YouTube Vocal Remover works the same way, straight from a link.",
    answerNode: (
      <>
        Yes — the{" "}
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
        title="Free YouTube Key & BPM Finder"
        lede="Paste a YouTube link and get its key, BPM, and Camelot notation automatically — no download step, no sign-up."
        tool={<YouTubeAnalyzeForm />}
      >
        <FeatureStrip
          features={[
            {
              title: "No download step",
              desc: "Paste a link, skip the manual save-and-reupload.",
            },
            {
              title: "Same detection engine",
              desc: "Runs the same analysis as the file-based tool.",
            },
            { title: "No sign-up", desc: "No account, no email, no watermark." },
          ]}
        />

        <ToolSection id="how-to" title="How to find a YouTube video's key and BPM">
          <ol>
            <li>Paste a YouTube video, Shorts, or youtu.be link — up to {durationLabel} long.</li>
            <li>The audio is fetched and analyzed automatically — no settings to configure.</li>
            <li>View the detected key, BPM, and Camelot code.</li>
          </ol>
        </ToolSection>

        <ToolSection id="what-they-mean" title="What the key, BPM, and Camelot code mean">
          <p>
            <strong>Key</strong> is the track&apos;s tonal center — something like
            A minor or C major. <strong>BPM</strong> (beats per minute) is its
            tempo. <strong>Camelot notation</strong> translates that musical key
            into the letter-and-number code DJs use to quickly judge which tracks
            will mix harmonically with each other.
          </p>
        </ToolSection>

        <ToolSection id="why-link" title="Why paste a link instead of downloading first">
          <p>
            The regular <Link href="/key-finder">Key &amp; BPM Finder</Link> works
            from a file already saved on your device, which usually means
            downloading the audio first with a separate tool and re-uploading it.
            This version chains that fetch step together with the analysis itself,
            so a YouTube link is all you need.
          </p>
        </ToolSection>

        <ToolSection id="accuracy" title="How accurate is the result?">
          <p>
            Automated key and BPM detection works well on most conventional
            tracks, but it isn&apos;t infallible. Songs with ambiguous tonality,
            live performances, complex or layered arrangements, heavy effects
            processing, or a tempo that changes partway through can all produce a
            less certain result than a straightforward studio track in 4/4 time.
            Each result includes a confidence percentage, and the key or BPM
            reading is flagged with a &quot;Lower confidence&quot; indicator
            whenever two independent checks disagree with each other rather than
            confirming the same answer.
          </p>
          <p>
            Want the fuller explanation of why key and BPM readings can disagree
            between tools, and what a lower-confidence result actually means?{" "}
            <Link href="/guides/how-key-and-bpm-detection-works">
              Read How Automatic Key and BPM Detection Actually Works
            </Link>
            .
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2 — a footnote under the page's content rather than a
            section sitting in the outline beside the real ones. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; processing notice</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            You are responsible for ensuring you have the right to process any
            video you submit — for personal use, content you own, or material you
            have permission to use. Audio is fetched temporarily to run the
            analysis; AudioForges does not publicly host or distribute the videos
            or audio processed through this tool.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}