import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Check } from "lucide-react";
import { StemsForm } from "@/components/converter/StemsForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/**
 * ⚠️ DELIBERATE EXCEPTION, SAME AS /vocal-remover: the retention answer keeps
 * its prose and derives only its number. retentionSentences() would flatten it
 * into two generic lines and lose both the reason separation is the one family
 * that holds an upload, and the fact that one TTL sweep takes the upload and
 * the stems together. Derive the figure, keep the judgement.
 *
 * The two pages say this identically on purpose. They describe one backend
 * behaviour, and two descriptions of the same thing is how a privacy claim
 * ends up half-right.
 */

const PAGE_TITLE = "Free AI Stem Splitter – Split Songs Into Stems";
const PAGE_DESCRIPTION =
  "Split songs into vocals, drums, bass, and other stems with AI. Upload MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF for free. No sign-up.";

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
  url: `${SITE_URL}/stems`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI 4-stem separation: vocals, drums, bass, other",
    "No sign-up required",
    "No download or software install required",
    "Individually downloadable stems",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

/** Only used in the comparison tables. teal-400, not Tailwind's emerald —
 *  teal is the success colour in the theme. */
function CheckMark() {
  return <Check className="h-4 w-4 text-teal-400" aria-hidden="true" />;
}

const STEMS = [
  { name: "Vocals", desc: "Lead and backing vocals, isolated from the instrumentation around them." },
  {
    name: "Drums",
    desc: "The full kit — kick, snare, hi-hats, cymbals, and other percussion — separated as one combined drum stem.",
  },
  { name: "Bass", desc: "Bass guitar or synth bass, covering the low end of the arrangement." },
  {
    name: "Other",
    desc: "Everything that isn't vocals, drums, or bass — guitars, keys, synths, pads, strings, and any remaining instrumentation, kept together as a single stem rather than split further into individual instruments.",
  },
];

const USE_CASES = [
  {
    name: "Sampling & production",
    desc: "Pull an isolated drum loop or bassline to build a new track around.",
  },
  {
    name: "Remixing",
    desc: "Replace or rework individual elements instead of starting from a full instrumental.",
  },
  {
    name: "Practice & study",
    desc: "Isolate a bass or drum part to learn it note-for-note without the rest of the mix in the way.",
  },
  {
    name: "Mashups",
    desc: "Combine stems from different tracks — a vocal from one, drums and bass from another.",
  },
];

export default async function StemsPage() {
  const relatedTools = getRelatedTools("stems", 5);
  const { separationHqEnabled } = await getFeatureFlags();
  const limits = await getLimits();

  /*
    Note the KEYS: "stems"/"stems_hq" are the 4-stem splitter's own endpoint
    pair, distinct from the Vocal Remover's ("separate") and the YouTube
    variants'. Reusing the wrong key would print another tool's allowance.
  */
  const standardLimitLabel = rateLimitLabel(
    limits.rateLimits.stems ?? 6,
    windowFor(limits, "stems")
  );
  const hqLimitLabel = rateLimitLabel(
    limits.rateLimits.stems_hq ?? 2,
    windowFor(limits, "stems_hq")
  );

  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  // The number derives; the sentence around it doesn't — see the note at the
  // top. input_seconds and output_seconds are both 7200, which is what lets
  // the copy say "everything, by the same expiry".
  const separationRetention = limits.retention.separation;
  const retentionWindow = durationLabel(
    separationRetention.inputSeconds ?? separationRetention.outputSeconds
  );

  /*
    Rendered from the backend list. The old hand-written array omitted AIFF
    while MultiOutputToolForm's default fileAccept has always ended ".aiff" —
    the tool accepted it and three places on this page said otherwise.
    Understating what you accept costs uploads from exactly the people most
    likely to have AIFF: anyone exporting from Logic.
  */
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs: FAQItem[] = [
    {
      question: "What is a stem splitter?",
      answer:
        "A stem splitter uses AI source separation to take a fully mixed song and split it back into individual parts — vocals, drums, bass, and other — without needing the original multitrack recording.",
    },
    {
      question: "How long does stem separation take?",
      answer:
        "Usually 20 seconds to 1 minute for standard quality, depending on track length and server load. This runs real AI audio-separation processing on GPU-accelerated infrastructure, not a simple filter.",
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality mode?",
            answer:
              "An optional higher-fidelity separation mode using a larger, ensembled AI model. It produces noticeably cleaner stems across all four tracks, at the cost of a longer processing time, typically 1 to 2 minutes instead of 20 seconds to 1 minute.",
          },
        ]
      : []),
    {
      question: "Is this really free?",
      answer: `Yes, completely free. Because separation is processing-intensive, standard quality is limited to ${standardLimitLabel} per IP address to keep it available for everyone.`,
    },
    {
      /*
        Worded identically to /vocal-remover on purpose — one backend
        behaviour, and two descriptions of the same thing is how a privacy
        claim ends up half-right.

        input_seconds 7200, output_seconds 7200 — one TTL sweep deletes the
        upload and the stems together, so a single window covers everything.

        Applies to ALL FOUR separation routes, not only Studio Quality: a
        standard run is precisely the one someone upgrades from, so it's the
        one that has to keep its input. And separation is the ONLY family that
        holds an upload at all — every other tool deletes its input in
        _run_tool_job's finally block — which makes this a deliberate exception
        with a reason rather than a general policy.
      */
      question: "Are my uploaded tracks kept?",
      answer: `For ${retentionWindow}, then everything is deleted automatically — your upload and the separated stems together, by the same expiry. That window is what lets the one-click Studio Quality re-run work without a second upload, so it applies to standard runs too, since a standard run is the one you'd upgrade from. Separation is the only tool on the site that holds an upload at all; every other one deletes it the moment processing finishes. There are no accounts, so nothing is linked to you, published, or shared.`,
    },
    {
      question: "What are the four stems?",
      answer:
        "Vocals (lead and backing vocals), drums (the full kit), bass (bass guitar or synth bass), and other (everything else — guitars, keys, pads, synths, and anything that isn't vocals, drums, or bass).",
    },
    {
      question: "Can I download each stem individually?",
      answer:
        "Yes — each of the four stems previews and downloads independently, so you only need to grab the ones you actually want.",
    },
    {
      question: "Does it work on any genre?",
      answer:
        "It works across genres, but separation quality varies with how the track is mixed. Dense, heavily layered mixes are harder to untangle cleanly than sparser arrangements with clearly distinct instruments.",
    },
    {
      question: "Why can AI-separated stems have artifacts?",
      answer:
        "Dense mixes, heavy distortion, live recordings with crowd noise, and instruments that share a similar frequency range (like bass and low guitar) are all harder for the model to cleanly separate than a clean studio recording with distinct instrumentation — this can leave faint bleed between stems.",
    },
    {
      question: "What audio formats are supported, and is there a size limit?",
      answer: `${formatList} are all supported, up to ${maxUploadLabel} per upload.`,
    },
    {
      // Claimed "Everything runs in your browser". Separation runs Demucs on
      // GPU infrastructure server-side, which this page states plainly further
      // down — the two contradicted each other.
      question: "Do I need to sign up or install anything?",
      answer:
        "No app, plugin, or account required. You upload a track through your browser, separation runs on the server, and you download the stems when it finishes. Nothing runs locally on your machine.",
    },
    {
      question: "Can I split a YouTube video into stems directly?",
      answer:
        "Yes — paste a YouTube link into the YouTube Stem Splitter instead of downloading the audio first, as long as you have the right to process that content.",
      answerNode: (
        <>
          Yes — paste a YouTube link into the{" "}
          <Link href="/youtube-stem-splitter" prefetch={false} className="text-amber-400 hover:underline">
            YouTube Stem Splitter
          </Link>{" "}
          instead of downloading the audio first, as long as you have the right to
          process that content.
        </>
      ),
    },
    {
      question: "Does it preserve stereo sound?",
      answer:
        "Yes — the separation model processes and outputs stereo audio for every stem, not a mono downmix.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Stem Splitter" }]} />
        }
        title="Free AI Stem Splitter"
        lede="Split a song into separate vocals, drums, bass, and other stems using AI source separation. No sign-up, no software install."
        tool={<StemsForm hqAvailable={separationHqEnabled} />}
      >
        <FeatureStrip
          features={[
            { title: "4 stems", desc: "Vocals, drums, bass, and other — not just a 2-way split." },
            // Was "Runs entirely in your browser", which is false — separation
            // runs server-side on GPU, and this page's own "How 4-stem
            // separation works" section says so three screens down.
            {
              title: "No install",
              desc: "Nothing to download. Upload, process, download in your browser.",
            },
            { title: "Free", desc: `No sign-up, no watermark. Up to ${maxUploadLabel} per upload.` },
          ]}
        />

        <ToolSection id="what-is-it" title="What is a stem splitter?">
          <p>
            A stem splitter takes a fully mixed-down song — a single audio file
            with everything blended together — and separates it back into
            individual parts, called stems. Normally, separate stems only exist if
            a producer kept the original multitrack recording. AI source
            separation gets around that: a model trained on learned
            characteristics of what a voice, a drum kit, a bass line, and other
            instrumentation each sound like reconstructs an approximation of those
            separate parts from the finished mix alone. That&apos;s the same
            underlying idea as audio source separation more broadly — it&apos;s
            why producers, remixers, and DJs use it to get usable stems from a
            track they only have as a finished MP3 or WAV.
          </p>
          <p>
            AudioForges lets you split a song online without the original project
            files or multitrack session. Upload a finished track and the AI
            separates it into vocals, drums, bass, and other instrumentation that
            you can preview and download individually.
          </p>
        </ToolSection>

        <ToolSection id="four-stems" title="4-stem separation: vocals, drums, bass & other">
          <p>Every upload is split into these four stems in a single pass:</p>
          <dl>
            {STEMS.map((s) => (
              <Fragment key={s.name}>
                <dt>{s.name}</dt>
                <dd>{s.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <ToolSection id="who-for" title="Who is this for?">
          <p>
            Producers pulling isolated drum or bass stems to sample and rebuild
            around, remixers who need more than just an instrumental, mashup
            artists layering elements from multiple tracks, and anyone studying an
            arrangement instrument-by-instrument all use this tool for the same
            underlying job — splitting a full mix into its four core components.
          </p>
        </ToolSection>

        <ToolSection id="vs-vocal-remover" title="Stem Splitter vs. Vocal Remover" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900">
                <tr>
                  <th className="w-1/4 px-4 py-3">
                    <span className="sr-only">Comparison</span>
                  </th>
                  {/* This page's own tool is the subject; amber says which
                      column the reader is being asked to weigh. */}
                  <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-amber-400">
                    Stem Splitter
                  </th>
                  <th className="px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-text-subtle">
                    Vocal Remover
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Vocals</td>
                  <td className="px-4 py-3"><CheckMark /></td>
                  <td className="px-4 py-3"><CheckMark /></td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Drums</td>
                  <td className="px-4 py-3"><CheckMark /></td>
                  <td className="px-4 py-3">Combined into instrumental</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Bass</td>
                  <td className="px-4 py-3"><CheckMark /></td>
                  <td className="px-4 py-3">Combined into instrumental</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Output</td>
                  <td className="px-4 py-3">4 separate stems</td>
                  <td className="px-4 py-3">2 stems (vocal + instrumental)</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Best for</td>
                  <td className="px-4 py-3">Sampling, remixing individual elements</td>
                  <td className="px-4 py-3">Karaoke, simple instrumentals</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              Just need vocals out of the way? The{" "}
              <Link href="/vocal-remover" prefetch={false}>
                Vocal Remover
              </Link>{" "}
              does the same separation and hands back one clean instrumental
              instead of four stems to sort through. Worth knowing it isn&apos;t
              the cheaper operation: the model separates all four sources either
              way and sums three of them, so the only difference is which files
              you get back.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="how-to" title="How to split a song into stems">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>
              AI source separation splits the track into vocals, drums, bass, and
              other, usually 20 seconds to 1 minute, depending on length and
              server load.
            </li>
            <li>Preview and download each stem individually, directly in your browser.</li>
          </ol>
          <p>
            Need a track from YouTube first? Use the{" "}
            <Link href="/youtube-stem-splitter" prefetch={false}>
              YouTube Stem Splitter
            </Link>{" "}
            to skip the manual download step entirely.
          </p>
        </ToolSection>

        <ToolSection id="how-it-works" title="How 4-stem separation works">
          <p>
            This tool uses the same AI source-separation model as our{" "}
            <Link href="/vocal-remover" prefetch={false}>
              Vocal Remover
            </Link>
            , but keeps all four of the internally separated components instead of
            combining three of them back into one instrumental track. The model
            analyzes learned characteristics of what a voice, a drum kit, a bass
            line, and everything else each sound like, and separates all four
            simultaneously in a single pass, outputting full stereo audio for each
            stem.
          </p>
          <p>
            The model is <strong>htdemucs</strong> — the published Hybrid
            Transformer Demucs, not something wrapped and renamed. Studio Quality
            runs <strong>htdemucs_ft</strong>, a &quot;bag of four&quot;: four
            instances of the same architecture, each fine-tuned toward one stem,
            then ensembled. That is where the extra minute goes and why the stems
            come out cleaner.
          </p>
          {/* This paragraph used to end "everything happens in your browser",
              two sentences after saying the workload runs on our GPUs — a
              contradiction inside one paragraph, under a heading promising to
              explain how the tool works. */}
          <p>
            AudioForges processes the AI separation workload on GPU-accelerated
            infrastructure. A single track usually takes 20 seconds to 1 minute,
            and usage is rate-limited per IP address so it stays free and
            available for everyone. There is no app, plugin, or account to set up
            — you upload through the browser and the separation runs on the
            server.
          </p>
          <p>
            Want the fuller technical breakdown — why bass and drums are the
            hardest pair to separate, and what Studio Quality actually buys you?{" "}
            <Link href="/guides/ai-stem-separation-explained">
              Read How AI Stem Separation Actually Works
            </Link>
            .
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
                    <td className="px-4 py-3 font-mono tabular-nums">20 sec–1 min</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">1–2 min</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Model</td>
                    <td className="px-4 py-3 font-mono">htdemucs</td>
                    <td className="px-4 py-3 font-mono text-text-primary">htdemucs_ft</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Separation quality</td>
                    <td className="px-4 py-3">Good for most tracks</td>
                    <td className="px-4 py-3">Noticeably cleaner across all four stems</td>
                  </tr>
                  <tr>
                    {/* The Studio Quality figure is the FREE-TIER one and is
                        labelled as such: the rule is tiered, credits raise it
                        substantially, and a Server Component can't know which
                        tier this visitor is on. */}
                    <td className="px-4 py-3 font-medium text-text-subtle">Usage limit</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{standardLimitLabel}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      {hqLimitLabel}
                      <span className="ml-1.5 font-sans text-[11px] normal-case text-text-subtle">
                        on the free tier
                      </span>
                    </td>
                  </tr>
                  <tr>
                    {/* A comparison table listing time, quality, limit and
                        best-for but NOT price sends someone to a toggle that
                        then says "1 CREDIT". The allowance being SHARED across
                        the Studio Quality tools is the part people otherwise
                        find out by surprise. */}
                    <td className="px-4 py-3 font-medium text-text-subtle">Cost</td>
                    <td className="px-4 py-3">Free, always</td>
                    <td className="px-4 py-3 text-text-primary">
                      A free allowance each month, shared with the other Studio
                      Quality tools, then 1 credit per run
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
                pass, which is why it takes longer — the trade-off is worth it
                when the stems are headed into an actual production, not just a
                quick check.
              </p>
            </Prose>
          </ToolSection>
        )}

        {/*
          THE SPEC SECTION. The only part of this page a competitor can't copy
          without publishing their own numbers, and the "inherited from your
          file: none of it" row is the one that changes a producer's decision.
        */}
        <ToolSection id="output-spec" title="What the output actually is">
          <dl className="codes">
            <dt>Format</dt>
            <dd>WAV (RIFF), 16-bit signed PCM</dd>

            <dt>Bitrate</dt>
            <dd>Lossless — about 1,411 kbps at 44.1 kHz stereo</dd>

            <dt>Sample rate</dt>
            <dd>44,100 Hz — fixed</dd>

            <dt>Channels</dt>
            <dd>2 (stereo) — fixed</dd>

            <dt>Inherited from your file</dt>
            <dd>None of it</dd>
          </dl>
          <p>
            That last row is worth reading twice if you work at 48 kHz. Demucs
            operates at 44.1 kHz in stereo internally, so the output rate and
            channel count are fixed no matter what you upload — a 48 kHz file
            comes back at 44.1 kHz, a mono file comes back as two channels, and a
            24-bit file comes back at 16-bit. That is how the model pipeline works
            rather than a choice we made, and it is true of every tool built on
            Demucs, including the ones that don&apos;t mention it. Drop a stem
            into any editor and check.
          </p>
          <p>
            You can also verify the models: standard runs <strong>htdemucs</strong>{" "}
            at 0.25 overlap, Studio Quality runs <strong>htdemucs_ft</strong> —
            four fine-tuned instances, ensembled — at 0.5. Higher overlap means
            more redundant computation across chunk boundaries, which is where the
            artifacts on longer tracks tend to show up. Between the ensemble and
            the overlap, Studio Quality is roughly five times the compute of
            standard, which is where the extra minute goes.
          </p>
        </ToolSection>

        <ToolSection id="formats" title="Supported audio formats" bleed>
          {/* Rendered from allowed_audio_formats. The hand-written array here
              omitted AIFF while the tool accepted it. */}
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <span
                key={format}
                className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
              >
                {format}
              </span>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Upload any of the formats above, up to {maxUploadLabel} per file.
              Output stems are delivered as individually downloadable audio files.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="limitations" title="Stem Splitter isn't perfect">
          <p>
            Separation quality depends heavily on how densely the source track is
            mixed. Bass and low guitar can bleed into each other since they occupy
            similar frequency ranges. Programmed drums with heavy processing
            sometimes separate less cleanly than an acoustic kit. Live recordings
            with crowd noise or stage bleed give the model a messier signal than a
            controlled studio mix. None of this makes separation fail outright —
            it just tends to leave more audible traces behind on a dense or
            heavily processed mix than on a sparser, cleaner one.
          </p>
          <p>
            GPU acceleration changes the infrastructure the separation runs on,
            not the difficulty of the underlying problem — source quality and
            arrangement still determine the final result.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <dl>
            {USE_CASES.map((u) => (
              <Fragment key={u.name}>
                <dt>{u.name}</dt>
                <dd>{u.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2 — a footnote under the page's content rather than a
            section sitting in the outline beside the real ones. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; fair use</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            You are responsible for ensuring you have the right to process any track
            you upload — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the tracks
            processed through this tool.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            See our{" "}
            <Link href="/about" className="text-amber-400 hover:underline">
              About
            </Link>
            ,{" "}
            <Link href="/privacy" className="text-amber-400 hover:underline">
              Privacy
            </Link>
            , and{" "}
            <Link href="/terms" className="text-amber-400 hover:underline">
              Terms
            </Link>{" "}
            pages for more on how AudioForges handles uploaded files.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}