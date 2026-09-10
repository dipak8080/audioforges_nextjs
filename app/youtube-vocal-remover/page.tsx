import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeSeparateForm } from "@/components/converter/YouTubeSeparateForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { StemCompare } from "@/components/credits/StemCompare";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { ForgeMixerCard } from "@/components/tools/ForgeMixerCard";
import { StemUseGrid } from "@/components/tools/StemUseGrid";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel } from "@/lib/data/tool-limits";
import { getFeatureFlags } from "@/lib/api/railway";
import { ogForTool } from "@/lib/og";

const DEMO_STANDARD = "/audio/demo-vocals-standard.wav";
const DEMO_STUDIO = "/audio/demo-vocals-studio.wav";

const UPDATED = "2026-09-10";

const PAGE_TITLE = "YouTube Vocal Remover – Free Instrumental & Acapella";
const PAGE_DESCRIPTION =
  "Remove vocals from any YouTube video free. Paste a link and get a clean instrumental and an isolated acapella — no download, no sign-up, no watermark.";

const OG_IMAGE = ogForTool("youtube-vocal-remover", "Free YouTube Vocal Remover");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
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

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Vocal Remover",
  alternateName: [
    "YouTube Vocal Remover",
    "YouTube Karaoke Maker",
    "YouTube Acapella Extractor",
    "YouTube Instrumental Extractor",
  ],
  url: `${SITE_URL}/youtube-vocal-remover`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI vocal and instrumental separation from a YouTube link",
    "Forge Mixer: multi-track stem player with per-stem mute, solo, volume and pan",
    "Mix presets, A–B loop, and in-browser WAV export of your custom balance",
    "No manual download step",
    "Separate vocal and instrumental downloads",
    "No sign-up required",
  ],
};

// From lib/data/rate-limits.ts and lib/data/tool-limits.ts, the same sources
// YouTubeSeparateForm uses, so the tool and this copy can't drift.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";
const standardLimitLabel = getRateLimitLabel("youtube/separate") ?? FALLBACK_RATE_LIMIT_LABEL;
const hqLimitLabel = getRateLimitLabel("youtube/separate-hq") ?? FALLBACK_RATE_LIMIT_LABEL;

// The two fallbacks differ on purpose: Studio Quality's ceiling is the tighter
// one, and a missing key must never over-promise on the tier with less room.
const FALLBACK_STANDARD_DURATION = "10 minutes";
const FALLBACK_HQ_DURATION = "6 minutes";
const standardDurationLabel = getDurationLabel("youtube/separate") ?? FALLBACK_STANDARD_DURATION;
const hqDurationLabel = getDurationLabel("youtube/separate-hq") ?? FALLBACK_HQ_DURATION;
// Same today. Stated separately only when they actually differ, so a row
// reading "10 minutes / 10 minutes" never ships.
const hqDurationDiffers = hqDurationLabel !== standardDurationLabel;

export default async function YouTubeVocalRemoverPage() {
  const relatedTools = getRelatedTools("youtube-vocal-remover", 5);
  const { separationHqEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "How long can the video be?",
      answer: `Up to ${standardDurationLabel}${hqDurationDiffers ? `, and ${hqDurationLabel} on Studio Quality` : " on both tiers"}. The cap is on separation, not the fetch, so a longer video is refused rather than downloaded first and rejected afterwards. Usage is limited to ${standardLimitLabel} per IP address so the tool stays free.`,
    },
    {
      question: "Do I need to download the video first?",
      answer:
        "No. That is the whole point of this page. Paste the link, the audio is fetched server-side and goes straight into separation. Nothing lands on your device until you download a stem.",
    },
    {
      question: "Is this different from the regular Vocal Remover?",
      answer:
        "Only the input. The separation, the models and the output are identical. Use this one when the track is on YouTube and the file version when it is already on your device.",
      answerNode: (
        <>
          Only the input. The separation, the models and the output are identical. Use this one when the track is on
          YouTube and the{" "}
          <Link href="/vocal-remover" prefetch={false} className="text-amber-400 hover:underline">
            file version
          </Link>{" "}
          when it is already on your device.
        </>
      ),
    },
    {
      question: "Why does a link take longer than uploading a file?",
      answer:
        "There are two stages instead of one. The audio has to be fetched from YouTube before separation can start, and the fetch is the part that varies with video length and network conditions. Separation itself takes the same time either way.",
      answerNode: (
        <>
          There are two stages instead of one. The audio has to be fetched from YouTube before separation can start,
          and the fetch is the part that varies. Separation itself takes the same time either way.{" "}
          <Link href="/guides/how-youtube-tools-fetch-then-process" className="text-amber-400 hover:underline">
            How the fetch stage works
          </Link>
          .
        </>
      ),
    },
    {
      question: "Some links fail. Why?",
      answer:
        "Age-restricted, private, members-only and region-blocked videos cannot be fetched, and live streams have no finished file to pull. Very long videos are refused by the duration cap above. If a link fails, downloading the audio yourself and using the file tool usually works.",
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality?",
            answer:
              "A second tier that runs MelBand RoFormer instead of htdemucs. Different architecture, not the same model run harder: less vocal bleed in the instrumental and fewer watery artifacts on cymbals and breaths. It takes 1 to 2 minutes instead of 20 seconds to 1 minute and costs one credit per run after the free monthly allowance.",
          },
        ]
      : []),
    {
      question: "Can I split the video into drums and bass too?",
      answer:
        "Not here. This tool returns two stems, vocals and instrumental. The YouTube Stem Splitter returns four.",
      answerNode: (
        <>
          Not here. This tool returns two stems, vocals and instrumental. The{" "}
          <Link href="/youtube-stem-splitter" prefetch={false} className="text-amber-400 hover:underline">
            YouTube Stem Splitter
          </Link>{" "}
          returns four.
        </>
      ),
    },
    {
      question: "Am I allowed to do this?",
      answer:
        "That depends on the video and on what you do with the result. Practising over an instrumental of a song you own, or working with material you have permission to use, is a different matter from republishing someone else's recording. You are responsible for having the right to process the video you paste.",
    },
    {
      question: "Does separation improve the audio quality?",
      answer:
        "No. It isolates what is already in the mix. YouTube audio is compressed before you ever get to it, so a stem cannot be cleaner than the source, and the output is always 16-bit 44.1 kHz stereo WAV.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "YouTube Vocal Remover" }]} />
        }
        meta={["No account", "No download step", "Full-length WAV"]}
        title="Free YouTube Vocal Remover"
        lede="Paste a link and get the vocals and the instrumental back as two separate WAV files. No download step, no sign-up."
        tool={<YouTubeSeparateForm hqAvailable={separationHqEnabled} />}
      >
        <ProofStrip
          proofs={[
            {
              label: "One step",
              value: "Link in, two stems out",
              note: "The audio is fetched server-side. Nothing touches your device until you download a stem.",
            },
            {
              label: "Models",
              value: "htdemucs and MelBand RoFormer",
              note: "Named so you can check them. Real source separation, not a center-channel trick.",
            },
            {
              label: "Length",
              value: `Up to ${standardDurationLabel}`,
              note: `${hqDurationDiffers ? `${hqDurationLabel} on Studio Quality. ` : ""}Checked before the fetch, so nothing is downloaded that cannot be processed.`,
            },
          ]}
        />

        {separationHqEnabled && (
          <ToolSection id="hear-the-difference" title="Hear the difference">
            <p>
              The vocal stem from both tiers, on the same song. Click a lane to switch while it plays; the playhead
              stays put, so you hear the same bar twice. Drag on a lane to loop the part you want to compare.
            </p>
            <StemCompare
              standardSrc={DEMO_STANDARD}
              studioSrc={DEMO_STUDIO}
              stemLabel="Vocals"
              trackLabel="Dense mix, long reverb tail"
              cues={[
                { at: 6, label: "quiet passage" },
                { at: 19, label: "held note" },
                { at: 31, label: "reverb tail" },
              ]}
            />
            <p className="text-xs text-text-subtle">
              Music: Culture Code, Make Me Move (feat. Karra) [NCS Release]
            </p>
          </ToolSection>
        )}

        <ToolSection id="two-stages" title="What happens after you paste the link" bleed>
          <ol className="grid gap-3 sm:grid-cols-2">
            {[
              [
                "Fetch",
                "The audio track is pulled from YouTube server-side. This is the stage that varies with video length and how the video is served, and it is where a link fails if the video is private, age-restricted or a live stream.",
              ],
              [
                "Separate",
                "The same GPU pipeline the file tool uses. 20 seconds to 1 minute on standard, 1 to 2 on Studio Quality, then both stems open in Forge Mixer.",
              ],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <p className="font-mono text-[11px] text-amber-400">Stage {i + 1}</p>
                <p className="mt-1.5 font-medium text-text-primary">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <Prose className="mt-5">
            <p>
              Two stages is why a link takes longer than an upload, and why the length cap is checked first: a video
              that cannot be separated is never fetched.{" "}
              <Link href="/guides/how-youtube-tools-fetch-then-process">
                The longer explanation of the fetch stage
              </Link>{" "}
              covers what happens when a video cannot be pulled at all.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="forge-mixer" title="Mix the stems before you download" bleed>
          <Prose className="mb-5">
            <p>
              Results open in Forge Mixer, a two-lane player built into this page. Both stems run from one shared
              clock, so they never drift. Set a balance you like and export it as a WAV without leaving the browser.
            </p>
          </Prose>
          <ForgeMixerCard
            points={[
              "Mute, solo, volume to 150% and full pan on each stem.",
              "Karaoke and Acapella presets, one tap each.",
              "Drag on the timeline to loop a section, sample-accurate.",
              "Export the mix you set as a WAV. Rendered locally, no credits used.",
            ]}
          />
        </ToolSection>

        <ToolSection id="what-you-get" title="Two stems, four jobs" bleed>
          <StemUseGrid
            outputs={[
              {
                name: "Instrumental",
                desc: "The video's audio with the voice removed. Drums, bass and everything else stay intact.",
              },
              { name: "Vocals", desc: "Lead and backing vocals on their own. Usable as an acapella as is." },
            ]}
            jobs={[
              { name: "Karaoke", uses: "instrumental", desc: "Sing over the original arrangement, not a MIDI cover." },
              {
                name: "Remix",
                uses: "either",
                desc: "Build on a clean bed or a clean hook.",
                href: "/youtube-key-finder",
                linkLabel: "Check the key first.",
              },
              { name: "DJ mashup", uses: "vocals", desc: "Lay one video's acapella over another track's instrumental." },
              { name: "Cover reference", uses: "instrumental", desc: "Hear the parts clearly without the lead in the way." },
            ]}
          />
        </ToolSection>

        {separationHqEnabled && (
          <ToolSection id="standard-vs-studio" title="Standard vs. Studio Quality" bleed>
            <CompareTable
              columns={["Standard", "Studio Quality"]}
              highlight={1}
              rows={[
                { label: "Model", cells: [{ text: "htdemucs", mono: true }, { text: "MelBand RoFormer", mono: true }] },
                {
                  label: "Vocal bleed in the instrumental",
                  cells: [
                    { state: "partial", text: "Audible on dense mixes and long reverb tails" },
                    { state: "yes", text: "Gone on most material" },
                  ],
                },
                {
                  label: "Watery artifacts",
                  cells: [
                    { state: "partial", text: "On cymbals, breaths and sibilance" },
                    { state: "yes", text: "Cymbals and consonants stay intact" },
                  ],
                },
                ...(hqDurationDiffers
                  ? [
                      {
                        label: "Max video length",
                        cells: [
                          { text: standardDurationLabel, mono: true },
                          { text: hqDurationLabel, mono: true },
                        ],
                      },
                    ]
                  : []),
                {
                  label: "Limit",
                  cells: [
                    { text: standardLimitLabel, mono: true },
                    { text: hqLimitLabel, mono: true, sub: "on the free tier" },
                  ],
                },
                {
                  label: "Cost",
                  cells: [
                    { text: "Free, always" },
                    {
                      text: "Free monthly allowance, then 1 credit per run",
                      sub: "allowance shared across Studio Quality tools",
                    },
                  ],
                },
              ]}
            />
          </ToolSection>
        )}

        <ToolSection id="limits" title="Where it struggles" bleed>
          <ul className="grid gap-3 sm:grid-cols-3">
            {[
              ["Compressed source", "YouTube audio is lossy before you get to it. A stem cannot be cleaner than the video."],
              ["Live and choir vocals", "Crowd noise and several voices at once leave more traces behind."],
              ["Links that cannot be fetched", "Private, age-restricted, members-only, region-blocked or live videos have nothing to pull."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ul>
          <Prose className="mt-5">
            <p>
              If a link fails, downloading the audio yourself with the{" "}
              <Link href="/youtube-to-wav">YouTube to WAV converter</Link> and running it through the{" "}
              <Link href="/vocal-remover">file Vocal Remover</Link> usually works.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="free-alternative" title="Compared with the paid tools" bleed>
          <Prose className="mb-5">
            <p>
              Every cell below is checkable on the other sites&apos; own pages. No claim is made that cannot be
              verified; the demo above and your ears cover the rest.
            </p>
          </Prose>
          <CompareTable
            columns={["AudioForges", "LALAL.AI", "Vocalremover.org"]}
            highlight={0}
            rows={[
              {
                label: "Takes a YouTube link directly",
                cells: [
                  { state: "yes", text: "Yes" },
                  { state: "no", text: "Upload a file or video" },
                  { state: "no", text: "Upload a file" },
                ],
              },
              {
                label: "Full-length result without paying",
                cells: [
                  { state: "yes", text: "Yes" },
                  { state: "no", text: "Preview only, full download is paid" },
                  { state: "yes", text: "Yes" },
                ],
              },
              {
                label: "No account needed",
                cells: [
                  { state: "yes", text: "Yes" },
                  { state: "no", text: "Account required for results" },
                  { state: "yes", text: "Yes" },
                ],
              },
              {
                label: "Models named",
                cells: [
                  { state: "yes", text: "htdemucs, MelBand RoFormer", sub: "open-source, verifiable" },
                  { state: "partial", text: "Andromeda engine, closed-source" },
                  { state: "unknown", text: "Not stated" },
                ],
              },
              {
                label: "Output spec published",
                cells: [
                  { state: "yes", text: "16-bit 44.1 kHz WAV" },
                  { state: "unknown", text: "Not stated" },
                  { state: "unknown", text: "Not stated" },
                ],
              },
              {
                label: "Mix stems in the browser",
                cells: [
                  { state: "yes", text: "Forge Mixer", sub: "mute, solo, pan, loop, export" },
                  { state: "no", text: "Preview snippets only" },
                  { state: "no", text: "Playback only" },
                ],
              },
              {
                label: "Paid tier",
                cells: [
                  { text: "1 credit per job, never expires" },
                  { text: "Subscription, plus one-time minute top-ups" },
                  { text: "None, donation-funded" },
                ],
              },
            ]}
            footnote={`Checked against their live pages on ${UPDATED}. Details may change.`}
          />
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
            <p className="font-medium text-text-primary">Run the same song through both.</p>
            <p className="mt-1.5 text-sm text-text-muted">
              Any paid tool&apos;s preview against AudioForges, same track, same section. That is the only comparison
              that matters and it costs nothing.
            </p>
          </div>
        </ToolSection>

        <ToolVideo slug="youtube-vocal-remover" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          note="Studio Quality now runs MelBand RoFormer"
          legal="You are responsible for having the right to process any video you paste. AudioForges does not host or distribute the audio processed here."
        />
      </ToolPageShell>
    </>
  );
}