import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { VocalRemoverForm } from "@/components/converter/VocalRemoverForm";
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
import { getFeatureFlags } from "@/lib/api/railway";
import { getLimits, windowFor, rateLimitLabel, durationLabel } from "@/lib/api/limits";
import { ogForTool } from "@/lib/og";

/**
 * ⚠️ ONE DELIBERATE EXCEPTION — THE RETENTION ANSWER KEEPS ITS PROSE.
 *
 * Every other page renders retention from retentionSentences(). This one
 * doesn't, and shouldn't. The helper would produce two true, generic lines and
 * lose both the reason separation is the one family that holds an upload at
 * all, and the fact that a single TTL sweep takes the upload and the stems
 * together. So the reasoning stays and only the NUMBER derives.
 *
 * The general rule this file is the exception to: derive the figure, keep the
 * judgement.
 *
 * /stems says this identically on purpose. They describe one backend
 * behaviour, and two descriptions of the same thing is how a privacy claim
 * ends up half-right.
 */

/*
  TITLE. Bing Keyword Research, three months to 30 Aug 2026:

    vocal remover          106.1K   head term — the biggest on the site
    ultimate vocal remover  17.6K   UVR5, a desktop app — brand query, not ours
    vocalremover             9.2K   ┐ vocalremover.org navigational,
    vocalremover.org         6.7K   ┘ not winnable and not worth chasing
    voice remover            7.7K   <- same tool, different noun, was absent
    ai vocal remover         5.5K
    vocal remover free       5.1K
    remove vocal / vocals    4.2K each
    vocal remover ai         3.7K
    vocal remover online     3.2K

  The old title already led with the head term and covered "ai vocal remover"
  and "remove vocals". The one gap was "voice remover" — 7.7K of people using
  a different word for the same thing — so "& Voice" earns its place.

  `absolute` now: the root template appended " | AudioForges", taking the
  rendered title to 58 characters and pushing the differentiator toward
  truncation. Fourteen characters on a brand with no recorded search volume.

  WORTH BEING HONEST IN THIS COMMENT: the title is not why this page has no
  impressions. It is indexed on Bing with zero, against vocalremover.org,
  lalal.ai and Moises on a 106K term. That is an authority problem, and no
  wording change solves it. This edit closes a real gap; it is not a fix.
*/
const PAGE_TITLE = "Free AI Vocal Remover – Remove Vocals & Voice Online";
const PAGE_DESCRIPTION =
  "Free AI vocal remover. Remove vocals from a song online to get an instrumental or acapella — MP3, WAV, FLAC, AAC. No sign-up, no watermark.";

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
  // alternateName carries the head terms as standalone entity labels, which
  // helps Google associate the page with each query independently.
  // Volumes (SE Ranking, Aug 2026, US): vocal remover 90,500/mo · remove
  // vocals 22,200 · vocal isolator 8,100 · ai vocal remover 6,600 · remove
  // vocals from a song 6,600.
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
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI vocal and instrumental separation",
    "No sign-up required",
    "No download or software install required",
    "Karaoke track creation",
    "Acapella extraction",
  ],
};

// Don't add HowTo schema — deprecated by Google, no benefit. FAQPage comes
// from <FAQSection />, BreadcrumbList from <Breadcrumb />; don't duplicate.

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

export default async function VocalRemoverPage() {
  const relatedTools = getRelatedTools("vocal-remover", 5);
  const { separationHqEnabled } = await getFeatureFlags();
  const limits = await getLimits();

  /*
    Both from /limits. Note the KEYS: this is the file-upload Vocal Remover's
    own endpoint pair, distinct from the 4-stem Stem Splitter ("stems") and the
    YouTube Vocal Remover. Reusing the wrong key would silently print another
    tool's allowance.

    The HQ figure is the FREE-TIER one and is labelled as such below: the rule
    is tiered, credits raise it substantially, and a Server Component can't
    know which tier a visitor is on. Unqualified, that cell was simply wrong
    for anyone who had paid.
  */
  const standardLimitLabel = rateLimitLabel(
    limits.rateLimits.separate ?? 6,
    windowFor(limits, "separate")
  );
  const hqLimitLabel = rateLimitLabel(
    limits.rateLimits.separate_hq ?? 2,
    windowFor(limits, "separate_hq")
  );

  const maxUploadLabel = `${limits.maxUploadMb}MB`;

  /*
    The NUMBER derives; the sentence around it doesn't — see the note at the
    top. input_seconds and output_seconds are both 7200, which is what lets the
    copy say "everything, by the same expiry" rather than explaining two
    windows.
  */
  const separationRetention = limits.retention.separation;
  const retentionWindow = durationLabel(
    separationRetention.inputSeconds ?? separationRetention.outputSeconds
  );

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  /*
    DON'T RE-ADD THE HEADER LINE. A third hero line reading "Includes 2 free
    Studio Quality runs every month" was removed on 2026-08-28 and backfired
    two ways.

    This is a Server Component, so it can't know how many runs a given visitor
    has left — it could only print the static monthly figure. Someone who had
    spent theirs read "2 free runs every month" in the header while the badge
    on the quality toggle twenty pixels below read "1 CREDIT". The page
    contradicted itself, and the header was the half that was wrong.

    Second, it front-loaded a paywall concept above a tool nobody had used yet.
    FreeTierBadge states the real, per-visitor answer at the moment it matters.

    That is NOT an argument for saying nothing about cost anywhere — see the
    Cost row in the comparison table, which is true for every visitor without
    promising a count.
  */

  const faqs: FAQItem[] = [
    {
      question: "How long does vocal removal take?",
      answer:
        "Usually 20 seconds to 1 minute for standard quality, depending on track length and server load. This runs real AI audio-separation processing on GPU-accelerated infrastructure, not a simple filter.",
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality mode?",
            answer:
              "An optional higher-fidelity separation mode using a larger, ensembled AI model. It produces noticeably cleaner vocal and instrumental tracks, at the cost of a longer processing time, typically 1 to 2 minutes instead of 20 seconds to 1 minute.",
          },
        ]
      : []),
    {
      // Was hardcoded "three tracks per hour". `separate` was raised from 3 to
      // 6 on 2026-08-22 — this page was under-reporting the real allowance by
      // half.
      question: "Is this really free?",
      answer: `Yes, completely free — no account, no email, no watermark. Because separation is processing-intensive, standard quality is limited to ${standardLimitLabel} per IP address to keep it available for everyone.`,
    },
    {
      /*
        The previous answer said the upload was deleted "once processing
        finishes", and carried a ⚠️ VERIFY note that never got acted on. It
        shipped, and it was wrong: the backend keeps the source file for two
        hours and exposes an upgrade route, which is what `input_expires_at`
        counts down and why the one-click Studio Quality re-run needs no second
        upload. So the page claimed files were deleted immediately while a
        feature on the same page depended on them not being — on the one tool
        where people upload copyrighted music, which is the answer that gets
        read closely.

        The window derives from /limits.retention.separation, where
        input_seconds and output_seconds are both 7200 — one sweep takes the
        upload and the stems together, which is why this says "everything"
        rather than explaining two timers. The PROSE stays hand-written; see
        the note at the top of the file.
      */
      question: "Are my uploaded tracks kept?",
      answer: `For ${retentionWindow}, then everything is deleted automatically — your upload and the separated stems together, by the same expiry. That window is what lets the one-click Studio Quality re-run work without a second upload, so it applies to standard runs too, since a standard run is the one you'd upgrade from. Separation is the only tool on the site that holds an upload at all; every other one deletes it the moment processing finishes. There are no accounts, so nothing is linked to you, published, or shared.`,
    },
    {
      question: "What can I use the instrumental for?",
      answer:
        "Karaoke practice, remixing, sampling, or isolating vocals for an acapella — as long as you have the right to use the source track that way.",
    },
    {
      question: "Can AI remove vocals completely?",
      answer:
        "AI source separation gets much closer than a center-channel filter, but it isn't perfect on every track — dense mixes, heavy reverb, or doubled vocals can leave faint traces behind. Simpler mixes tend to separate more cleanly.",
    },
    {
      // Previously claimed "Everything runs in your browser", which is false —
      // separation runs Demucs on GPU infrastructure server-side. The page
      // contradicted itself three sections later, and the claim was
      // incompatible with the retention answer above.
      question: "Do I need to download anything?",
      answer:
        "No app or plugin to install. You upload a track through your browser, separation runs on the server, and you download the two stems when it finishes. Nothing runs locally on your machine.",
    },
    {
      question: "How is this different from a karaoke center-channel filter?",
      answer:
        "Center-channel filters only remove audio panned dead-center, which often leaves vocal bleed and damages the stereo mix. This tool uses AI source separation to isolate vocals and instrumental as fully separate stems.",
    },
    {
      question: "Does it work on live recordings?",
      answer:
        "It can, but results are usually less clean than a studio recording — crowd noise and stage bleed are harder for the model to separate from the vocal than a controlled studio mix.",
    },
    {
      question: "Can I remove vocals from a YouTube video directly?",
      answer:
        "Yes — paste a YouTube link into the YouTube Vocal Remover instead of downloading the audio first, as long as you have the right to process that content.",
      answerNode: (
        <>
          Yes — paste a YouTube link into the{" "}
          <Link href="/youtube-vocal-remover" prefetch={false} className="text-amber-400 hover:underline">
            YouTube Vocal Remover
          </Link>{" "}
          instead of downloading the audio first, as long as you have the right
          to process that content.
        </>
      ),
    },
    {
      question: "Can I separate drums or other instruments instead of vocals?",
      answer:
        "Not with this tool — it splits a track into exactly two stems, vocals and instrumental. The Stem Splitter separates vocals, drums, bass, and other individually.",
      answerNode: (
        <>
          Not with this tool — it splits a track into exactly two stems, vocals
          and instrumental. The{" "}
          <Link href="/stems" prefetch={false} className="text-amber-400 hover:underline">
            Stem Splitter
          </Link>{" "}
          separates vocals, drums, bass, and other individually.
        </>
      ),
    },
    {
      question: "Does it preserve stereo sound?",
      answer:
        "Yes — the separation model processes and outputs stereo audio, not a mono downmix.",
    },
    {
      question: "What formats can I upload, and is there a size limit?",
      answer: `${formatList}, up to ${maxUploadLabel} per upload.`,
    },
    {
      question: "Does AI separation improve the audio quality?",
      answer:
        "No — it isolates what's already in the mix, it doesn't remaster or add fidelity the original recording didn't have.",
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
        lede="Upload a song and remove vocals with AI to create an instrumental or acapella. No sign-up, nothing to install."
        tool={<VocalRemoverForm hqAvailable={separationHqEnabled} />}
      >
        <FeatureStrip
          features={[
            {
              title: "GPU-accelerated AI",
              desc: "Real source separation, not a basic center-channel filter.",
            },
            // Was "Runs entirely in your browser" — factually wrong, separation
            // runs server-side on GPU.
            {
              title: "No install",
              desc: "Nothing to download. Upload, process, download in your browser.",
            },
            { title: "Free", desc: `No sign-up, no watermark. Up to ${maxUploadLabel} per upload.` },
          ]}
        />

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

        {/*
          THE SPEC SECTION. The only part of this page a competitor can't copy
          without publishing their own numbers, and the "inherited from your
          file: none of it" row is the one that changes a producer's decision —
          everyone else's copy implies the output follows the input, and with
          Demucs it cannot.
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

        <ToolSection id="who-for" title="Who is this for?">
          <p>
            Producers pulling an instrumental to sample or build on, DJs
            extracting an acapella for a mashup, singers practicing over a clean
            backing track, music teachers preparing karaoke material for students,
            and content creators needing an instrumental bed all use this tool for
            the same underlying job — splitting a mix into vocal and instrumental
            stems.
          </p>
        </ToolSection>

        <ToolSection id="how-to" title="How to remove vocals from a song">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>
              AI source separation splits the track into vocal and instrumental
              components, usually 20 seconds to 1 minute, depending on length and
              server load.
            </li>
            <li>Download the result directly in your browser, no install needed.</li>
          </ol>
          <p>
            Need a track from YouTube first? Grab it with our{" "}
            <Link href="/youtube-to-wav" prefetch={false}>
              YouTube to WAV converter
            </Link>{" "}
            and upload the result here, or skip the step entirely with the{" "}
            <Link href="/youtube-vocal-remover" prefetch={false}>
              YouTube Vocal Remover
            </Link>
            .
          </p>
        </ToolSection>

        <ToolSection id="remove-vocals-online" title="Remove vocals from a song online">
          <p>
            AudioForges lets you remove vocals from a song online without
            installing audio software. Upload an {formatList} file and the AI
            separation model creates two tracks: an isolated vocal stem and an
            instrumental with the vocals removed.
          </p>
          <p>
            You can use the instrumental for karaoke or practice, or use the
            isolated vocal as an acapella for remixing, sampling, and mashups.
            Each result can be previewed and downloaded separately after
            processing.
          </p>
        </ToolSection>

        <ToolSection id="how-it-works" title="How AI vocal removal works">
          <p>
            This tool uses real AI audio-source-separation processing to split a
            track into <strong>vocals</strong> and <strong>instrumental</strong> —
            not a simple center-channel filter, which only partially removes
            vocals and often damages the mix.
          </p>
          <p>
            A center-channel filter works by cutting whatever&apos;s panned
            dead-center in the stereo mix — that catches lead vocals in many
            commercial mixes, but it also strips out anything else placed
            centrally (kick, bass, snare) and leaves behind any vocal element that
            isn&apos;t perfectly centered. AI source separation instead analyzes
            the audio&apos;s learned characteristics of what a voice sounds like
            versus an instrument, which is why it can isolate vocals regardless of
            where they sit in the stereo field, and why it produces a cleaner
            instrumental as a result. The model processes and outputs full stereo
            audio, and splits a track into exactly two stems — vocals and
            instrumental — rather than separating individual instruments like
            drums or bass on their own.
          </p>
          <p>
            AudioForges processes the AI separation workload on GPU-accelerated
            infrastructure. A single track usually takes 20 seconds to 1 minute,
            and usage is rate-limited per IP address so it stays free and
            available for everyone. There is no app or plugin to install — you
            upload through the browser and the separation runs on the server.
          </p>
          <p>
            The model is <strong>htdemucs</strong> — the published Hybrid
            Transformer Demucs, not something wrapped and renamed. Studio Quality
            runs <strong>htdemucs_ft</strong>, a &quot;bag of four&quot;: four
            instances of the same architecture, each fine-tuned toward one stem,
            then ensembled. That is where the extra minute goes and why the stems
            come out cleaner.
          </p>
          <p>
            Both stems come back as <strong>WAV</strong>. One thing worth saying
            because it&apos;s counter-intuitive: asking for two stems instead of
            four doesn&apos;t make this cheaper to run. The model separates all
            four sources internally either way and sums three of them into the
            instrumental — vocal removal is the same amount of work as a full stem
            split, just with different files kept.
          </p>
          <p>
            Want the fuller breakdown of how this compares to older methods and
            where separation still struggles?{" "}
            <Link href="/guides/ai-vocal-removal-explained">
              Read How AI Vocal Removal Actually Works
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
                    {/* The paid column is the one being weighed. Amber marks it
                        as the subject rather than leaving two identical
                        headings for the eye to sort out. */}
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
                    <td className="px-4 py-3">Noticeably cleaner on both stems</td>
                  </tr>
                  <tr>
                    {/* The Studio Quality figure is the FREE-TIER one and is
                        labelled as such. Unqualified, this cell was simply
                        wrong for anyone who had paid. */}
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
                        then says "1 CREDIT". No per-visitor number — this is a
                        Server Component — but "can't state a count" isn't
                        "can't mention cost". The allowance being SHARED across
                        the Studio Quality tools is what people otherwise find
                        out by surprise. */}
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

        <ToolSection id="limitations" title="AI vocal removal isn't perfect">
          <p>
            Separation quality depends heavily on the source track. Choir or group
            vocals confuse the model since it has multiple overlapping vocal-like
            sources to untangle instead of one. Heavy distortion can share enough
            spectral character with a distorted or screamed vocal that the two get
            separated less cleanly. Live recordings with crowd noise or stage
            bleed give the model a messier signal to work from than a controlled
            studio mix. None of these make separation fail outright — they just
            tend to leave more audible traces behind than a clean studio recording
            would.
          </p>
          <p>
            GPU acceleration changes the infrastructure the separation runs on,
            not the difficulty of the underlying problem — source quality and
            arrangement still determine the final result.
          </p>
        </ToolSection>

        <ToolSection id="instrumental-vs-acapella" title="Instrumental vs. acapella">
          <p>
            An <strong>instrumental</strong> is the track with vocals removed —
            everything except the voice. An <strong>acapella</strong> is the
            reverse: just the isolated vocal, with the instrumentation removed.
            Both come from the same underlying separation process, just keeping
            the opposite stem. Karaoke and remixing usually call for the
            instrumental; sampling a vocal hook or building a mashup usually calls
            for the acapella.
          </p>
        </ToolSection>

        <ToolSection id="common-uses" title="Common uses">
          <dl>
            <dt>Karaoke &amp; practice</dt>
            <dd>Get an instrumental to sing or play along with.</dd>

            <dt>Remixing &amp; sampling</dt>
            <dd>
              Isolate an acapella or a clean instrumental bed to build on. Check
              the key first with our{" "}
              <Link href="/key-finder" prefetch={false}>
                Key &amp; BPM Finder
              </Link>{" "}
              if you&apos;re building something new around the sample.
            </dd>

            <dt>DJ mashups</dt>
            <dd>Pull an acapella from one track to lay over the instrumental of another.</dd>

            <dt>Cover reference</dt>
            <dd>Hear the instrumentation clearly without the original vocal in the way.</dd>
          </dl>
        </ToolSection>

        <ToolVideo slug="vocal-remover" />

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
        </section>

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}