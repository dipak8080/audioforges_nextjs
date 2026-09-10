import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeStemForm } from "@/components/converter/YouTubeStemForm";
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
import { StemPipelineDiagram } from "@/components/tools/StemPipelineDiagram";
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

const PAGE_TITLE = "YouTube Stem Splitter – Split Songs Into Stems";
const PAGE_DESCRIPTION =
  "Split YouTube songs into stems free — vocals, drums, bass, and other with AI. Free, no sign-up, no download required.";

const OG_IMAGE = ogForTool("youtube-stem-splitter", "Free YouTube Stem Splitter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/youtube-stem-splitter` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-stem-splitter`,
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
  name: "YouTube Stem Splitter",
  alternateName: [
    "YouTube Stem Splitter",
    "YouTube Stem Separator",
    "YouTube Song Splitter",
    "YouTube Drum Stem Extractor",
  ],
  url: `${SITE_URL}/youtube-stem-splitter`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI 4-stem separation from a YouTube link",
    "Forge Mixer: multi-track stem player with per-stem mute, solo, volume and pan",
    "Mix presets, A–B loop, and in-browser WAV export of your custom balance",
    "No manual download step",
    "Individually downloadable stems",
    "No sign-up required",
  ],
};

// From lib/data/rate-limits.ts and lib/data/tool-limits.ts, the same sources
// YouTubeStemForm uses, so the tool and this copy can't drift.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";
const standardLimitLabel = getRateLimitLabel("youtube/stems") ?? FALLBACK_RATE_LIMIT_LABEL;
const hqLimitLabel = getRateLimitLabel("youtube/stems-hq") ?? FALLBACK_RATE_LIMIT_LABEL;

const FALLBACK_STANDARD_DURATION = "10 minutes";
const FALLBACK_HQ_DURATION = "6 minutes";
const standardDurationLabel = getDurationLabel("youtube/stems") ?? FALLBACK_STANDARD_DURATION;
const hqDurationLabel = getDurationLabel("youtube/stems-hq") ?? FALLBACK_HQ_DURATION;
// Stated separately only when they differ, so a row reading "10 minutes /
// 10 minutes" never ships.
const hqDurationDiffers = hqDurationLabel !== standardDurationLabel;

export default async function YouTubeStemSplitterPage() {
  const relatedTools = getRelatedTools("youtube-stem-splitter", 5);
  const { separationHqEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "How long can the video be?",
      answer: `Up to ${standardDurationLabel}${hqDurationDiffers ? `, and ${hqDurationLabel} on Studio Quality` : " on both tiers"}. The cap is on separation, not the fetch, so a longer video is refused rather than downloaded first and rejected afterwards. Usage is limited to ${standardLimitLabel} per IP address so the tool stays free.`,
    },
    {
      question: "Do I need to download the video first?",
      answer:
        "No. Paste the link, the audio is fetched server-side and goes straight into separation. Nothing lands on your device until you download a stem.",
    },
    {
      question: "What are the four stems?",
      answer:
        "Vocals, drums as one full-kit stem, bass, and other. Other holds guitars, keys, synths, pads and strings together rather than splitting them further, so a guitar or a piano does not come back on its own.",
    },
    {
      question: "Can I download each stem individually?",
      answer:
        "Yes. Each stem previews and downloads on its own, there is a download-all button, and Forge Mixer can export a custom balance of the four as a single WAV.",
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality?",
            answer:
              "A two-stage pipeline instead of one pass. MelBand RoFormer extracts the vocal first, then htdemucs_ft splits the vocal-free instrumental into drums, bass and other. Every stem comes back cleaner because the model separating them is not fighting the voice. It takes longer and costs one credit per run after the free monthly allowance.",
          },
        ]
      : []),
    {
      question: "Why does a link take longer than uploading a file?",
      answer:
        "There are two stages instead of one. The audio has to be fetched from YouTube before separation can start, and the fetch is the part that varies. Separation itself takes the same time either way.",
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
    {
      question: "I only want the vocals and the backing. Is there a simpler tool?",
      answer:
        "Yes. The YouTube Vocal Remover returns two stems instead of four, which is what you want for karaoke or an acapella.",
      answerNode: (
        <>
          Yes. The{" "}
          <Link href="/youtube-vocal-remover" prefetch={false} className="text-amber-400 hover:underline">
            YouTube Vocal Remover
          </Link>{" "}
          returns two stems instead of four, which is what you want for karaoke or an acapella.
        </>
      ),
    },
    {
      question: "Does separation improve the audio quality?",
      answer:
        "No. It isolates what is already in the mix. YouTube audio is compressed before you ever get to it, so a stem cannot be cleaner than the source, and every stem comes back as 16-bit 44.1 kHz stereo WAV.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "YouTube Stem Splitter" }]} />
        }
        meta={["No account", "No download step", "Four full-length stems"]}
        title="Free YouTube Stem Splitter"
        lede="Paste a link and split the song into vocals, drums, bass and other. Four separate WAV files, no download step, no sign-up."
        tool={<YouTubeStemForm hqAvailable={separationHqEnabled} />}
      >
        <ProofStrip
          proofs={[
            {
              label: "One step",
              value: "Link in, four stems out",
              note: "The audio is fetched server-side. Nothing touches your device until you download a stem.",
            },
            {
              label: "Models",
              value: "htdemucs, RoFormer and htdemucs_ft",
              note: "Named so you can check them. Studio Quality runs two stages, not the same model run harder.",
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
              stays put, so you hear the same bar twice. Drag on a lane to loop the part you want to compare. The
              vocal is the stem where the tiers differ most, and on Studio Quality it is what the other three are
              separated around.
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
                "The audio track is pulled from YouTube server-side. This stage varies with video length and how the video is served, and it is where a link fails if the video is private, age-restricted or a live stream.",
              ],
              [
                "Separate",
                "The same GPU pipeline the file tool uses, splitting the track four ways. All four stems then open together in Forge Mixer.",
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

        <ToolSection id="forge-mixer" title="Mix four stems before you download" bleed>
          <Prose className="mb-5">
            <p>
              Results open in Forge Mixer, a four-lane player built into this page. Every lane runs off one shared
              clock, so they never drift however long you listen. Set a balance and export it as a WAV without
              leaving the browser.
            </p>
          </Prose>
          <ForgeMixerCard
            lanes={[
              { name: "Vocals", peaks: mixerShape(3, 0.9), active: true },
              { name: "Drums", peaks: mixerShape(11, 1.25) },
              { name: "Bass", peaks: mixerShape(5, 0.7) },
              { name: "Other", peaks: mixerShape(7, 1.0) },
            ]}
            presets={["Karaoke", "Drums only", "Rhythm"]}
            points={[
              "Mute, solo, volume to 150% and full pan on every stem.",
              "Solo the drums and bass to check a groove in isolation.",
              "Drag on the timeline to loop a section, sample-accurate.",
              "Export the balance you set as a WAV. Rendered locally, no credits used.",
            ]}
          />
        </ToolSection>

        <ToolSection id="what-you-get" title="Four stems, four jobs" bleed>
          <StemUseGrid
            outputs={[
              { name: "Vocals", desc: "Lead and backing vocals, isolated from everything around them." },
              { name: "Drums", desc: "The whole kit as one stem: kick, snare, hats, cymbals, percussion." },
              { name: "Bass", desc: "Bass guitar or synth bass, the low end of the arrangement." },
              { name: "Other", desc: "Guitars, keys, synths, pads and strings, kept together rather than split further." },
            ]}
            jobs={[
              { name: "Sampling", uses: "drums, bass", desc: "Pull a clean loop or bassline out of a video." },
              {
                name: "Remixing",
                uses: "any stem",
                desc: "Rework one element instead of a full instrumental.",
                href: "/youtube-key-finder",
                linkLabel: "Check the key first.",
              },
              { name: "Learning a part", uses: "bass, drums", desc: "Isolate the part and loop it until it sticks." },
              { name: "Mashups", uses: "vocals", desc: "A vocal from one video over drums and bass from another." },
            ]}
          />
        </ToolSection>

        <ToolSection id="how-it-works" title="How the split works, and where it fails" bleed>
          <StemPipelineDiagram />
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Compressed source", "YouTube audio is lossy before you get to it. A stem cannot be cleaner than the video."],
              ["Bass against low guitar", "Instruments sharing a frequency range are the hardest pair to split."],
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
              Every stem comes back as 16-bit, 44.1 kHz, stereo WAV regardless of the source. If a link fails,
              downloading the audio with the <Link href="/youtube-to-wav">YouTube to WAV converter</Link> and running
              it through the <Link href="/stems">file Stem Splitter</Link> usually works.
            </p>
          </Prose>
        </ToolSection>

        {separationHqEnabled && (
          <ToolSection id="standard-vs-studio" title="Standard vs. Studio Quality" bleed>
            <CompareTable
              columns={["Standard", "Studio Quality"]}
              highlight={1}
              rows={[
                {
                  label: "Pipeline",
                  cells: [
                    { text: "htdemucs, one pass", mono: true },
                    { text: "RoFormer then htdemucs_ft", mono: true },
                  ],
                },
                {
                  label: "Vocal bleed in the other stems",
                  cells: [
                    { state: "partial", text: "Audible on dense mixes and long reverb tails" },
                    { state: "yes", text: "Gone on most material" },
                  ],
                },
                {
                  label: "Drums and bass definition",
                  cells: [
                    { state: "partial", text: "Good, some smearing on busy sections" },
                    { state: "yes", text: "Tighter, separated with the voice already out" },
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

        <ToolSection id="free-alternative" title="Compared with the paid tools" bleed>
          <Prose className="mb-5">
            <p>
              Every cell below is checkable on the other sites&apos; own pages. No claim is made that cannot be
              verified; the demo above and your ears cover the rest.
            </p>
          </Prose>
          <CompareTable
            columns={["AudioForges", "LALAL.AI", "Vocalremover.org Splitter"]}
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
                label: "Full-length stems without paying",
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
                  { state: "yes", text: "htdemucs, RoFormer, htdemucs_ft", sub: "open-source, verifiable" },
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
                  { state: "partial", text: "Stem volume rebalance" },
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

        <ToolVideo slug="youtube-stem-splitter" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          note="Studio Quality now runs a RoFormer and htdemucs_ft pipeline"
          legal="You are responsible for having the right to process any video you paste. AudioForges does not host or distribute the audio processed here."
        />
      </ToolPageShell>
    </>
  );
}

/** Fixed pseudo-random lane shapes, so server and client render the same bars. */
function mixerShape(seed: number, density: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 160; i++) {
    const t = i / 160;
    const env = 0.35 + 0.65 * Math.pow(Math.sin(t * Math.PI), 0.6);
    const a = Math.abs(Math.sin(i * 0.61 * seed + seed));
    const b = Math.abs(Math.cos(i * 1.37 + seed * 0.3));
    const c = Math.abs(Math.sin(i * 3.1 + seed));
    out.push(Math.min(1, env * (0.18 + (a * 0.5 + b * 0.35 + c * 0.15) * density)));
  }
  return out;
}