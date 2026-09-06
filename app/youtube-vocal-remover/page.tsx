import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { YouTubeSeparateForm } from "@/components/converter/YouTubeSeparateForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel } from "@/lib/data/tool-limits";
import { getFeatureFlags } from "@/lib/api/railway";
import { ogForTool } from "@/lib/og";

const PAGE_TITLE = "Free YouTube Vocal Remover";
const PAGE_DESCRIPTION =
  "Remove vocals from YouTube videos with AI. Get isolated vocals and instrumental tracks free, with no sign-up.";

const OG_IMAGE = ogForTool("youtube-vocal-remover", "Free YouTube Vocal Remover");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/youtube-vocal-remover` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-vocal-remover`,
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

// Every claim below is checked against actual YouTubeSeparateForm/backend
// behaviour. GPU-accelerated is stated because separation genuinely runs on
// GPU infrastructure; no speed or accuracy numbers are claimed, since none are
// measured.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Vocal Remover",
  url: `${SITE_URL}/youtube-vocal-remover`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI vocal and instrumental separation from a YouTube link",
    "No manual download step",
    "Separate vocal and instrumental downloads",
    "No sign-up required",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

// Read from lib/data/rate-limits.ts rather than hardcoded — the same source
// YouTubeSeparateForm.tsx uses, so the tool UI and this copy can't quietly
// drift apart. Fallback text only fires if a key is missing or renamed.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";
const standardLimitLabel = getRateLimitLabel("youtube/separate") ?? FALLBACK_RATE_LIMIT_LABEL;
const hqLimitLabel = getRateLimitLabel("youtube/separate-hq") ?? FALLBACK_RATE_LIMIT_LABEL;

/**
 * Video length caps, from lib/data/tool-limits.ts for the same reason.
 *
 * This was not a cosmetic drift. The page previously stated a hardcoded
 * "videos longer than 15 minutes aren't supported". The real ceiling is
 * MAX_SEPARATION_DURATION_SECONDS — TEN minutes, and SIX on Studio Quality. So
 * a 14-minute video was explicitly invited by this copy, accepted, downloaded
 * in full through the paid residential proxy, and only then refused at the
 * separation step. The user waited for a fetch that could never have been
 * usable, and we paid for the bandwidth.
 *
 * The 15 almost certainly came from someone reading the DOWNLOAD cap and
 * rounding — see the "two stacked caps" note at the top of tool-limits.ts for
 * why the download number is never the one to show on a page like this.
 *
 * THE TWO FALLBACKS DIFFER ON PURPOSE. The HQ fallback used to read "10
 * minutes" — the standard figure — so a missing key would have silently
 * over-promised by four minutes on the tier with the tighter cap, and shown
 * two identical values in a table whose whole point is that they differ.
 */
const FALLBACK_STANDARD_DURATION = "10 minutes";
const FALLBACK_HQ_DURATION = "6 minutes";
const standardDurationLabel = getDurationLabel("youtube/separate") ?? FALLBACK_STANDARD_DURATION;
const hqDurationLabel = getDurationLabel("youtube/separate-hq") ?? FALLBACK_HQ_DURATION;

const WHAT_YOU_GET = [
  {
    name: "Vocals",
    desc: "Lead and backing vocals, isolated from the instrumentation around them — usable as an acapella on its own.",
  },
  {
    name: "Instrumental",
    desc: "The full mix with vocals removed, ready as a karaoke backing track or a base to build a remix around.",
  },
  {
    name: "Preview and download",
    desc: "Both tracks play directly in the browser once separation finishes, and each downloads independently — grab one, the other, or both.",
  },
];

export default async function YouTubeVocalRemoverPage() {
  const relatedTools = getRelatedTools("youtube-vocal-remover", 5);
  const { separationHqEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "What is a YouTube vocal remover?",
      answer:
        "A tool that fetches the audio from a YouTube video and uses AI source separation to split it into an isolated vocal track and an instrumental, reconstructing parts that only exist mixed together in the original upload.",
    },
    {
      question: "How do I remove vocals from a YouTube video?",
      answer:
        "Paste the video's link into the tool above. The audio is fetched and separated automatically, then the vocals and instrumental are ready to preview and download.",
    },
    {
      question: "How is this different from the regular Vocal Remover?",
      answer:
        "The regular Vocal Remover needs an audio file already on your device. This version takes a YouTube link directly, fetching and separating the audio in one step so you skip the download-then-reupload workflow entirely.",
    },
    {
      question: "How long does it take?",
      answer:
        "Usually 30 seconds to 1 minute for standard quality. Fetching the audio is the fast part, and the AI separation is what takes most of the time.",
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality mode?",
            answer:
              "An optional higher-fidelity separation mode using a larger, ensembled AI model. It produces noticeably cleaner vocal and instrumental tracks, at the cost of a longer processing time, typically 1 to 2 minutes instead of 30 seconds to 1 minute.",
          },
        ]
      : []),
    {
      question: "Can I turn a YouTube song into an acapella?",
      answer:
        "Yes. Paste a YouTube link and the tool separates the vocals from the instrumental. The isolated vocal track can then be previewed and downloaded as an acapella.",
    },
    {
      question: "Can I make a karaoke track?",
      answer:
        "Yes — the instrumental has the lead vocal removed, which is the standard basis for a karaoke backing track from a YouTube song.",
    },
    {
      question: "What do I get back?",
      answer:
        "Two separate tracks: the isolated vocals, and the instrumental with vocals removed. Each previews and downloads independently.",
    },
    {
      question: "What affects separation quality?",
      answer:
        "How densely the source track is mixed matters most — sparser arrangements separate more cleanly than dense, heavily layered production. YouTube's own audio compression adds artifacts on top of that, which is why results vary between videos even at the same quality tier.",
    },
    {
      question: "Does it work with YouTube Shorts?",
      answer: "Yes — watch links, youtu.be links, and Shorts links are all supported.",
    },
    // Derived from tool-limits.ts — see the note above the constants for why
    // the previous hardcoded "15 minutes" cost users time and us proxy
    // bandwidth. Studio Quality has a tighter cap than standard, so when HQ is
    // available both numbers are stated rather than just the looser one.
    {
      question: "Is there a video length limit?",
      answer: separationHqEnabled
        ? `Yes — up to ${standardDurationLabel} at standard quality, or ${hqDurationLabel} with Studio Quality, which is more intensive to process.`
        : `Yes — videos up to ${standardDurationLabel} long are supported.`,
    },
    {
      question: "What videos cannot be processed?",
      answer:
        "Videos that are private, age-restricted, or region-locked may not be accessible to the downloader and can't be processed as a result, since the audio has to be fetched before separation can run.",
    },
    {
      question: "Can I get drums and bass separately too?",
      answer:
        "Yes — the YouTube Stem Splitter produces four separate stems (vocals, drums, bass, other) from the same kind of link.",
      answerNode: (
        <>
          Yes — the{" "}
          <Link href="/youtube-stem-splitter" className="text-amber-400 hover:underline">
            YouTube Stem Splitter
          </Link>{" "}
          produces four separate stems (vocals, drums, bass, other) from the same
          kind of link.
        </>
      ),
    },
    {
      question: "Is this really free?",
      answer:
        "Yes, completely free. Because this chains a YouTube download with GPU-accelerated AI separation, it's rate-limited per person to keep it available for everyone.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb
            items={[{ name: "Tools", href: "/tools" }, { name: "YouTube Vocal Remover" }]}
          />
        }
        title="Free YouTube Vocal Remover"
        lede="Paste a link and get an isolated vocal track and an instrumental back. No download step, no sign-up."
        tool={<YouTubeSeparateForm hqAvailable={separationHqEnabled} />}
      >
        <FeatureStrip
          features={[
            { title: "No download step", desc: "Paste a link, skip the save-and-reupload." },
            {
              title: "Both tracks",
              desc: "Isolated vocals and the instrumental, downloaded separately.",
            },
            { title: "Free", desc: "No sign-up, no watermark, free for everyone." },
          ]}
        />

        <ToolSection id="how-to" title="How to remove vocals from a YouTube video">
          <ol>
            <li>
              Paste a YouTube video, Shorts, or youtu.be link — up to{" "}
              {standardDurationLabel} long.
            </li>
            <li>
              The audio is fetched and separated automatically, usually 30 seconds
              to 1 minute.
            </li>
            <li>Preview and download the vocals, the instrumental, or both.</li>
          </ol>
        </ToolSection>

        <ToolSection id="what-you-get" title="What you get">
          <dl>
            {WHAT_YOU_GET.map((item) => (
              <Fragment key={item.name}>
                <dt>{item.name}</dt>
                <dd>{item.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="why-link" title="Why paste a link instead of downloading first">
          <p>
            The regular <Link href="/vocal-remover">Vocal Remover</Link> works from
            a file already on your device — which normally means downloading the
            audio with one tool, then uploading it to another. This version chains
            both steps together, so a link is all you need. The separation itself
            is identical; only the input method differs.
          </p>
          <p>
            Curious why this takes longer than a file upload, or what happens when
            a video can&apos;t be fetched at all?{" "}
            <Link href="/guides/how-youtube-tools-fetch-then-process">
              Read How AudioForges&apos; YouTube Tools Work: Fetch, Then Process
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="how-it-works" title="How AI vocal removal works">
          <p>
            AI source separation estimates the vocal and instrumental parts from a
            single mixed recording — it isn&apos;t undoing a mix with access to the
            original multitracks, it&apos;s reconstructing an approximation of them
            from what a voice sounds like versus an instrument. That&apos;s what
            separates it from an old center-channel filter, which only cuts
            whatever&apos;s panned dead-center and leaves any off-center vocal
            element behind.
          </p>
          <p>
            AudioForges processes the AI separation workload on GPU-accelerated
            infrastructure. Fetching the audio from YouTube is the fast half of
            this tool; separation is the slower one, and usage is rate-limited per
            person so it stays free and available for everyone.
          </p>
        </ToolSection>

        {separationHqEnabled && (
          <ToolSection id="standard-vs-studio" title="Standard vs. Studio Quality" bleed>
            <div className="overflow-x-auto rounded-xl border border-graphite-800">
              <table className="w-full text-left text-sm text-text-muted">
                <thead className="bg-graphite-900">
                  <tr>
                    <th className="w-1/4 px-4 py-3">
                      <span className="sr-only">Comparison</span>
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-subtle">
                      Standard
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-amber-400">
                      Studio Quality
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800">
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Processing time</td>
                    <td className="px-4 py-3 font-mono tabular-nums">30 sec–1 min</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">1–2 min</td>
                  </tr>
                  <tr>
                    {/* From getDurationLabel. The two tiers have genuinely
                        different caps — HQ holds the single separation slot
                        several times longer — so this row isn't decorative.
                        Don't hardcode it. */}
                    <td className="px-4 py-3 font-medium text-text-subtle">Max video length</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{standardDurationLabel}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      {hqDurationLabel}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Separation quality</td>
                    <td className="px-4 py-3">Good for most tracks</td>
                    <td className="px-4 py-3">Noticeably cleaner on both stems</td>
                  </tr>
                  <tr>
                    {/* From getRateLimitLabel — don't hardcode these two cells
                        again. */}
                    <td className="px-4 py-3 font-medium text-text-subtle">Usage limit</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{standardLimitLabel}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      {hqLimitLabel}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Best for</td>
                    <td className="px-4 py-3">Quick previews, casual use</td>
                    <td className="px-4 py-3">
                      Sampling, remixing, anything going into a final mix
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Prose className="mt-5">
              <p>
                Studio Quality uses a larger, ensembled model rather than a single
                pass, which is why it takes longer — the trade-off is worth it when
                the stems are headed into an actual production, not just a quick
                check. It also accepts a shorter video, since a single job occupies
                the separation queue for much longer.
              </p>
            </Prose>
          </ToolSection>
        )}

        <ToolSection id="quality" title="Separation quality">
          <p>
            Results genuinely vary by song. Dense, heavily layered mixes give the
            model more overlapping frequencies to untangle than a sparser
            arrangement, so separation is typically cleaner on the latter. Heavy
            reverb or effects on a vocal blur the boundary between the two stems,
            and backing vocals stacked against a lead can end up split less cleanly
            than a single dry vocal line would be.
          </p>
          <p>
            YouTube&apos;s own audio compression adds one more variable — the
            source here is already an encoded stream rather than a master, and
            that&apos;s part of why the same tool can produce a noticeably cleaner
            result on one video than another. GPU acceleration changes the
            infrastructure this runs on, not the difficulty of the underlying
            problem.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <dl>
            <dt>Karaoke &amp; practice</dt>
            <dd>
              Make a backing track from a song on YouTube to sing or play along
              with.
            </dd>

            <dt>Remixing &amp; mashups</dt>
            <dd>Pull an acapella from one track to lay over another&apos;s instrumental.</dd>

            <dt>Arrangement analysis</dt>
            <dd>
              Study how a track is built by listening to its parts separately. Pair
              it with the{" "}
              <Link href="/youtube-key-finder">YouTube Key &amp; BPM Finder</Link>{" "}
              to get key and tempo from the same link.
            </dd>

            <dt>DJ &amp; reference material</dt>
            <dd>
              Prep an instrumental or acapella for a set from a track you only have
              as a link.
            </dd>
          </dl>
        </ToolSection>

        <ToolVideo slug="youtube-vocal-remover" />

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2 — a footnote under the page's content rather than a
            section sitting in the outline beside the real ones. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; fair use</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            You are responsible for ensuring you have the right to process any video
            you submit — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the videos or
            audio processed through this tool.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}