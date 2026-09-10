import type { Metadata } from "next";
import Link from "next/link";
import { StemsForm } from "@/components/converter/StemsForm";
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
import { getFeatureFlags } from "@/lib/api/railway";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

// Shared with /pricing and /vocal-remover: same 41 s clip through both tiers.
const DEMO_STANDARD = "/audio/demo-vocals-standard.wav";
const DEMO_STUDIO = "/audio/demo-vocals-studio.wav";

const UPDATED = "2026-09-10";

const PAGE_TITLE = "Free AI Stem Splitter – Split Songs Into Stems";
const PAGE_DESCRIPTION =
  "Free stem splitter and LALAL.AI alternative — split songs into vocals, drums, bass, and other stems with AI. Upload MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF for free. No sign-up.";

const OG_IMAGE = ogForTool("stems", "Free AI Stem Splitter");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/stems` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/stems`,
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
  name: "AI Stem Splitter",
  alternateName: [
    "Stem Splitter",
    "AI Stem Separator",
    "Song Splitter",
    "Multitrack Extractor",
    "Drum Stem Extractor",
    "Bassline Isolator",
  ],
  url: `${SITE_URL}/stems`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI 4-stem separation: vocals, drums, bass, other",
    "Forge Mixer: multi-track stem player with per-stem mute, solo, volume and pan",
    "Mix presets, A–B loop, and in-browser WAV export of your custom balance",
    "No sign-up required",
    "No download or software install required",
    "Individually downloadable stems",
  ],
};

export default async function StemsPage() {
  const relatedTools = getRelatedTools("stems", 5);
  const { separationHqEnabled } = await getFeatureFlags();
  const limits = await getLimits();

  // "stems"/"stems_hq" are this tool's own keys, not the Vocal Remover's.
  const standardLimitLabel = rateLimitLabel(limits.rateLimits.stems ?? 6, windowFor(limits, "stems"));
  const hqLimitLabel = rateLimitLabel(limits.rateLimits.stems_hq ?? 2, windowFor(limits, "stems_hq"));
  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  // Number derives from /limits; the retention sentence stays hand-written and
  // matches /vocal-remover word for word, since it describes one backend rule.
  const separationRetention = limits.retention.separation;
  const retentionWindow = durationLabel(
    separationRetention.inputSeconds ?? separationRetention.outputSeconds
  );

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs: FAQItem[] = [
    {
      question: "Is there a free alternative to LALAL.AI's stem splitter?",
      answer:
        "Yes. AudioForges splits full-length tracks into vocals, drums, bass and other free, with no account. LALAL.AI's free Starter plan previews a result but does not let you download the full one, and its paid tiers are monthly subscriptions. Studio Quality here upgrades the split for one credit per job, with no subscription and credits that never expire.",
    },
    {
      question: "Are my uploaded tracks kept?",
      answer: `For ${retentionWindow}, then everything is deleted automatically, your upload and the separated stems together, by the same expiry. That window is what lets the one-click Studio Quality re-run work without a second upload, so it applies to standard runs too. Separation is the only tool on the site that holds an upload at all; every other one deletes it the moment processing finishes. There are no accounts, so nothing is linked to you, published, or shared.`,
    },
    {
      question: "What formats can I upload, and is there a size limit?",
      answer: `${formatList}, up to ${maxUploadLabel} per upload. Standard quality is limited to ${standardLimitLabel} per IP address so it stays free for everyone.`,
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality?",
            answer:
              "A two-stage pipeline instead of one pass. MelBand RoFormer extracts the vocal first, then htdemucs_ft splits the vocal-free instrumental into drums, bass and other. Every stem comes back cleaner because the model separating them is not fighting the voice. It takes 1 to 2 minutes instead of 20 seconds to 1 minute and costs one credit per run after the free monthly allowance.",
          },
        ]
      : []),
    {
      question: "Can I split a YouTube video into stems directly?",
      answer:
        "Yes. Paste the link into the YouTube Stem Splitter instead of downloading the audio first, as long as you have the right to process that content.",
      answerNode: (
        <>
          Yes. Paste the link into the{" "}
          <Link href="/youtube-stem-splitter" prefetch={false} className="text-amber-400 hover:underline">
            YouTube Stem Splitter
          </Link>{" "}
          instead of downloading the audio first, as long as you have the right to process that content.
        </>
      ),
    },
    {
      question: "Can I get guitar or piano on their own?",
      answer:
        "Not as separate stems. Guitars, keys, synths, pads and strings all land together in the other stem. If you only need the voice and the backing, the Vocal Remover returns two stems instead of four.",
      answerNode: (
        <>
          Not as separate stems. Guitars, keys, synths, pads and strings all land together in the other stem. If you
          only need the voice and the backing, the{" "}
          <Link href="/vocal-remover" prefetch={false} className="text-amber-400 hover:underline">
            Vocal Remover
          </Link>{" "}
          returns two stems instead of four.
        </>
      ),
    },
    {
      question: "Does it work on any genre?",
      answer:
        "It works across genres, but the mix matters more than the genre. Dense, heavily layered arrangements are harder to untangle than sparse ones with clearly distinct instruments, and instruments sharing a frequency range, like bass and a low guitar, can bleed into each other.",
    },
    {
      question: "Can I download each stem individually?",
      answer:
        "Yes. Each of the four stems previews and downloads on its own, so you only take the ones you want. There is also a download-all button, and Forge Mixer can export a custom balance of the four as a single WAV.",
    },
    {
      question: "Does separation improve the audio quality?",
      answer:
        "No. It isolates what is already in the mix. It does not remaster or add fidelity the original recording never had, and every stem comes back as 16-bit 44.1 kHz stereo WAV regardless of what you upload.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Stem Splitter" }]} />}
        meta={["No account", "No watermark", "Four full-length stems"]}
        title="Free AI Stem Splitter"
        lede="Split a song into vocals, drums, bass and other. Four separate WAV files, no sign-up, nothing to install."
        tool={<StemsForm hqAvailable={separationHqEnabled} />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Models",
              value: "htdemucs, RoFormer and htdemucs_ft",
              note: "Named so you can check them. Studio Quality runs two stages, not the same model run harder.",
            },
            {
              label: "Output",
              value: "Four 16-bit, 44.1 kHz WAVs",
              note: "Lossless, stereo, each one downloadable on its own. Spec published below.",
            },
            {
              label: "Price",
              value: "Full tracks free, no watermark",
              note: "No account, no preview-only tier. Rate-limited per IP so it stays free.",
            },
          ]}
        />

        {separationHqEnabled && (
          <ToolSection id="hear-the-difference" title="Hear the difference">
            <p>
              The vocal stem from both tiers, on the same song. Click a lane to switch while it plays; the playhead
              stays put, so you hear the same bar twice. Drag on a lane to loop the part you want to compare. The
              vocal is the stem where the two tiers differ most, and on Studio Quality it is what the other three are
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
              { name: "Sampling", uses: "drums, bass", desc: "Pull a clean loop or bassline to build a track around." },
              {
                name: "Remixing",
                uses: "any stem",
                desc: "Rework one element instead of starting from a full instrumental.",
                href: "/key-finder",
                linkLabel: "Check the key first.",
              },
              { name: "Learning a part", uses: "bass, drums", desc: "Isolate the part and loop it until it sticks." },
              { name: "Mashups", uses: "vocals", desc: "A vocal from one track over drums and bass from another." },
            ]}
          />
        </ToolSection>

        <ToolSection id="how-it-works" title="How it works, and where it fails" bleed>
          <StemPipelineDiagram />
          <Prose className="mt-6">
            <p>
              The output is fixed by the pipeline, not by your file. Every stem comes back as 16-bit, 44.1 kHz,
              stereo WAV, about 1,411 kbps. A 48 kHz upload comes back at 44.1. A mono upload comes back as two
              channels. This is true of every tool built on Demucs, including the ones that do not mention it.
            </p>
          </Prose>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Dense, layered mixes", "More sources overlapping means more bleed between stems."],
              ["Bass against low guitar", "Instruments sharing a frequency range are the hardest pair to split."],
              ["Live recordings", "Crowd and stage bleed leave more behind than a studio mix."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ul>
          <Prose className="mt-5">
            <p>
              None of these break separation. Standard runs take 20 seconds to 1 minute on GPU hardware; Studio
              Quality takes 1 to 2. Uploads accepted: {formatList}, up to {maxUploadLabel}.
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
                { label: "Time", cells: [{ text: "20 sec to 1 min", mono: true }, { text: "1 to 2 min", mono: true }] },
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

        <ToolSection id="vs-vocal-remover" title="Four stems or two?" bleed>
          <CompareTable
            columns={["Stem Splitter", "Vocal Remover"]}
            highlight={0}
            rows={[
              {
                label: "Vocals on their own",
                cells: [
                  { state: "yes", text: "Yes" },
                  { state: "yes", text: "Yes" },
                ],
              },
              {
                label: "Drums and bass separately",
                cells: [
                  { state: "yes", text: "Yes" },
                  { state: "no", text: "Combined into the instrumental" },
                ],
              },
              { label: "Files returned", cells: [{ text: "Four" }, { text: "Two" }] },
              {
                label: "Best for",
                cells: [
                  { text: "Sampling, remixing, learning a part" },
                  { text: "Karaoke, acapellas, a quick instrumental" },
                ],
              },
            ]}
            footnote="Same models underneath. Standard runs the full four-way split either way and sums three stems for the Vocal Remover, so a two-stem job is no faster."
          />
          <Prose className="mt-4">
            <p>
              Only need the voice and the backing?{" "}
              <Link href="/vocal-remover">Use the Vocal Remover</Link> instead.
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
            columns={["AudioForges", "LALAL.AI", "Vocalremover.org Splitter"]}
            highlight={0}
            rows={[
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

        <ToolVideo slug="stems" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          note="Studio Quality now runs a RoFormer and htdemucs_ft pipeline"
          legal="You are responsible for having the right to process any track you upload. AudioForges does not host or distribute the tracks processed here."
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