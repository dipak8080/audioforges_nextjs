import type { Metadata } from "next";
import Link from "next/link";
import { VocalRemoverForm } from "@/components/converter/VocalRemoverForm";
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
import { PageByline } from "@/components/tools/PageByline";
import { SeparationDiagram } from "@/components/tools/SeparationDiagram";
import { CompareTable } from "@/components/tools/CompareTable";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

// Shared with /pricing: same 41 s clip through both tiers, level-matched.
const DEMO_STANDARD = "/audio/demo-vocals-standard.wav";
const DEMO_STUDIO = "/audio/demo-vocals-studio.wav";

// Bumped whenever the copy or the numbers on this page change.
const UPDATED = "2026-09-10";

const PAGE_TITLE = "Free AI Vocal Remover – Remove Vocals & Voice Online";
const PAGE_DESCRIPTION =
  "Free AI vocal remover and free LALAL.AI alternative. Remove vocals from a song online to get an instrumental or acapella — MP3, WAV, FLAC, AAC. No sign-up, no watermark.";

const OG_IMAGE = ogForTool("vocal-remover", "Free AI Vocal Remover");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/vocal-remover` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/vocal-remover`,
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
  name: "AI Vocal Remover",
  alternateName: [
    "Vocal Remover",
    "AI Vocal Remover",
    "Voice Remover",
    "Vocal Remover Online",
    "Vocal Isolator",
    "Acapella Extractor",
    "Karaoke Maker",
    "Instrumental Maker",
  ],
  url: `${SITE_URL}/vocal-remover`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI vocal and instrumental separation",
    "Forge Mixer: multi-track stem player with per-stem mute, solo, volume and pan",
    "Mix presets, A–B loop, and in-browser WAV export of your custom balance",
    "No sign-up required",
    "No download or software install required",
    "Karaoke track creation",
    "Acapella extraction",
  ],
};

export default async function VocalRemoverPage() {
  const relatedTools = getRelatedTools("vocal-remover", 5);
  const { separationHqEnabled } = await getFeatureFlags();
  const limits = await getLimits();

  // Keys are the file-upload Vocal Remover's own pair, not "stems" or the YouTube tool.
  const standardLimitLabel = rateLimitLabel(
    limits.rateLimits.separate ?? 6,
    windowFor(limits, "separate")
  );
  const hqLimitLabel = rateLimitLabel(
    limits.rateLimits.separate_hq ?? 2,
    windowFor(limits, "separate_hq")
  );
  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  // Number derives from /limits; the retention sentence stays hand-written.
  const separationRetention = limits.retention.separation;
  const retentionWindow = durationLabel(
    separationRetention.inputSeconds ?? separationRetention.outputSeconds
  );

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs: FAQItem[] = [
    {
      question: "Is there a free alternative to LALAL.AI?",
      answer:
        "Yes. AudioForges separates full-length tracks free with no account. LALAL.AI's free Starter plan lets you preview a result but not download the full one, and its paid tiers are monthly subscriptions. For the cleanest split here, Studio Quality runs MelBand RoFormer at one credit per job, with no subscription and credits that never expire.",
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
              "A second tier that runs MelBand RoFormer instead of htdemucs. It is a different architecture, not the same model run harder, and the difference is audible: less vocal bleed in the instrumental and fewer watery artifacts on cymbals and breaths. It takes 1 to 2 minutes instead of 20 seconds to 1 minute and costs one credit per run after the free monthly allowance.",
          },
        ]
      : []),
    {
      question: "Can I remove vocals from a YouTube video directly?",
      answer:
        "Yes. Paste the link into the YouTube Vocal Remover instead of downloading the audio first, as long as you have the right to process that content.",
      answerNode: (
        <>
          Yes. Paste the link into the{" "}
          <Link href="/youtube-vocal-remover" prefetch={false} className="text-amber-400 hover:underline">
            YouTube Vocal Remover
          </Link>{" "}
          instead of downloading the audio first, as long as you have the right to process that content.
        </>
      ),
    },
    {
      question: "Can I separate drums or bass instead of vocals?",
      answer:
        "Not here. This tool returns exactly two stems, vocals and instrumental. The Stem Splitter separates vocals, drums, bass, and other individually.",
      answerNode: (
        <>
          Not here. This tool returns exactly two stems, vocals and instrumental. The{" "}
          <Link href="/stems" prefetch={false} className="text-amber-400 hover:underline">
            Stem Splitter
          </Link>{" "}
          separates vocals, drums, bass, and other individually.
        </>
      ),
    },
    {
      question: "Does it work on live recordings?",
      answer:
        "It works, but expect a less clean result than a studio mix. Crowd noise and stage bleed are harder for the model to tell apart from the vocal.",
    },
    {
      question: "Does separation improve the audio quality?",
      answer:
        "No. It isolates what is already in the mix. It does not remaster or add fidelity the original recording never had, and the output is always 16-bit 44.1 kHz stereo WAV regardless of what you upload.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Vocal Remover" }]} />
        }
        title="Free AI Vocal Remover"
        lede="Upload a song, get the vocals and the instrumental back as two separate WAV files. No sign-up, nothing to install."
        meta={["No account", "No watermark", "Full-length WAV"]}
        tool={<VocalRemoverForm hqAvailable={separationHqEnabled} />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Models",
              value: "htdemucs and MelBand RoFormer",
              note: "Named so you can check them. Real source separation, not a center-channel trick.",
            },
            {
              label: "Output",
              value: "16-bit, 44.1 kHz, stereo WAV",
              note: "Lossless, spec published below. Most tools in this category never say.",
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
                desc: "The full mix with the voice removed. Drums, bass and everything else stay intact.",
              },
              {
                name: "Vocals",
                desc: "Lead and backing vocals on their own. Usable as an acapella as is.",
              },
            ]}
            jobs={[
              { name: "Karaoke", uses: "instrumental", desc: "Sing or play over the original arrangement." },
              {
                name: "Remix",
                uses: "either",
                desc: "Build on a clean bed or a clean hook.",
                href: "/key-finder",
                linkLabel: "Check the key first.",
              },
              { name: "DJ mashup", uses: "vocals", desc: "Lay one track's acapella over another's instrumental." },
              { name: "Cover reference", uses: "instrumental", desc: "Hear every part clearly without the lead in the way." },
            ]}
          />
        </ToolSection>

        <ToolSection id="how-it-works" title="How it works, and where it fails" bleed>
          <SeparationDiagram />
          <Prose className="mt-6">
            <p>
              The output is fixed by the pipeline, not by your file. Every result comes back as 16-bit, 44.1 kHz,
              stereo WAV, about 1,411 kbps. A 48 kHz upload comes back at 44.1. A mono upload comes back as two
              channels. This is true of every tool built on Demucs, including the ones that do not mention it.
            </p>
          </Prose>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Choir and group vocals", "Several voice-like sources to untangle. Expect traces in the instrumental."],
              ["Distorted guitars", "Share enough character with a screamed vocal to blur the split."],
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
              Quality takes 1 to 2.{" "}
              <Link href="/guides/ai-vocal-removal-explained">Read the longer explanation</Link> if you want the
              detail.
            </p>
          </Prose>
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
                    { text: "Free monthly allowance, then 1 credit per run", sub: "allowance shared across Studio Quality tools" },
                  ],
                },
              ]}
            />
          </ToolSection>
        )}

        <ToolSection id="free-alternative" title="Compared with the paid tools" bleed>
          <Prose className="mb-5">
            <p>
              Every cell below is checkable on the other sites&apos; own pages. No claim is made that cannot be verified;
              the demo above and your ears cover the rest.
            </p>
          </Prose>
          <CompareTable
            columns={["AudioForges", "LALAL.AI", "Vocalremover.org"]}
            highlight={0}
            rows={[
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
              Any paid tool&apos;s preview against AudioForges, same track, same section. That is the only comparison that
              matters and it costs nothing.
            </p>
          </div>
        </ToolSection>

        <ToolVideo slug="vocal-remover" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          note="Studio Quality now runs MelBand RoFormer"
          legal="You are responsible for having the right to process any track you upload. AudioForges does not host or distribute the tracks processed here."
        />
      </ToolPageShell>
    </>
  );
}