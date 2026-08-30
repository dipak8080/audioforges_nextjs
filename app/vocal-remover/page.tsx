import type { Metadata } from "next";
import Link from "next/link";
import { VocalRemoverForm } from "@/components/converter/VocalRemoverForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { FILE_SIZE_LIMITS } from "@/lib/utils/validation";
import { getFeatureFlags } from "@/lib/api/railway";

const PAGE_TITLE = "Free AI Vocal Remover – Remove Vocals Online";
const PAGE_DESCRIPTION =
  "Remove vocals from songs online with AI for free. Extract instrumentals or acapellas from MP3, WAV, FLAC, AAC and more. No sign-up, no watermark.";

// FIX 2: `keywords` meta removed. Google has ignored the keywords meta tag
// since 2009, and no other tool page on the site carries it — it was dead
// weight and an inconsistency, not a ranking factor.
export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/vocal-remover` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/vocal-remover`,
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "AudioForges",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "AI Vocal Remover",
  // FIX 3: alternateName carries the head terms as standalone entity labels,
  // which helps Google associate the page with each query independently.
  // Same pattern already used on /video-to-audio.
  // Volumes (SE Ranking, Aug 2026, US):
  //   vocal remover              90,500/mo
  //   remove vocals              22,200/mo
  //   vocal isolator              8,100/mo
  //   ai vocal remover            6,600/mo
  //   remove vocals from a song   6,600/mo
  alternateName: [
    "Vocal Remover",
    "AI Vocal Remover",
    "Vocal Isolator",
    "Acapella Extractor",
    "Karaoke Maker",
    "Instrumental Maker",
  ],
  url: `${SITE_URL}/vocal-remover`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "GPU-accelerated AI vocal and instrumental separation",
    "No sign-up required",
    "No download or software install required",
    "Karaoke track creation",
    "Acapella extraction",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Vocal Remover", item: `${SITE_URL}/vocal-remover` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.
// This matches the standard already applied on /stems and both YouTube
// separation pages.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

// Rate-limit numbers shown in the "Standard vs. Studio Quality" table below
// AND in the FAQ are read from lib/data/rate-limits.ts rather than hardcoded —
// same source VocalRemoverForm.tsx uses ("separate"/"separate-hq", the
// file-upload Vocal Remover's own endpoint, distinct from the 4-stem
// Stem Splitter and the YouTube Vocal Remover). Fallback text only fires
// if a key is ever missing/renamed in rate-limits.ts.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";
const standardLimitLabel = getRateLimitLabel("separate") ?? FALLBACK_RATE_LIMIT_LABEL;
const hqLimitLabel = getRateLimitLabel("separate-hq") ?? FALLBACK_RATE_LIMIT_LABEL;

/**
 * The cap validateAudioFile actually enforces.
 *
 * The FAQ used to answer "Yes, 80MB per upload" as a typed number. Same rule as
 * the rate limits above: read it, don't restate it — otherwise the day that
 * constant moves, this answer is quietly wrong and nothing fails.
 */
const MAX_UPLOAD_LABEL = `${Math.round(FILE_SIZE_LIMITS.audio / (1024 * 1024))}MB`;

export default async function VocalRemoverPage() {
  const relatedTools = getRelatedTools("vocal-remover", 5);
  const { separationHqEnabled } = await getFeatureFlags();

  /*
    REMOVED 2026-08-28: a third header line reading "Includes 2 free Studio
    Quality runs every month".

    It was added to surface the allowance above the fold, and it backfired two
    ways. This is a Server Component, so it cannot know how many runs a given
    visitor has left — it could only ever print the static monthly figure. A
    visitor who has spent theirs therefore read "2 free runs every month" in
    the header while the badge on the quality toggle, twenty pixels below,
    read "1 CREDIT". The page contradicted itself, and the header was the half
    that was wrong.

    Second, it front-loaded a paywall concept above a tool nobody had used
    yet. FreeTierBadge already states the real, per-visitor answer at the
    exact moment it matters — on the control being chosen.

    That reasoning still holds, and it is NOT an argument for saying nothing
    about cost anywhere — see the Cost row in the comparison table, which
    states what is true for every visitor without promising a count.
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
      // FIX 6: was hardcoded "three tracks per hour". rate-limits.ts raised
      // `separate` from 3 to 6 on 2026-08-22 — this page was under-reporting
      // the real allowance by half. Now read from the single source of truth,
      // so a future backend change can't silently make this copy lie again.
      question: "Is this really free?",
      answer: `Yes, completely free — no account, no email, no watermark. Because separation is processing-intensive, standard quality is limited to ${standardLimitLabel} per IP address to keep it available for everyone.`,
    },
    {
      /*
        CORRECTED 2026-08-30. The previous answer said the upload was deleted
        "once processing finishes", and carried a ⚠️ VERIFY note that never got
        acted on. It shipped, and it was wrong.

        UpgradeToHqCard's own docstring states the real behaviour: "the backend
        keeps the source file for two hours and exposes an upgrade route".
        That TTL is what `input_expires_at` counts down, and it is why the
        one-click Studio Quality re-run needs no second upload.

        So the page claimed files were deleted immediately while a feature on
        the same page depended on them not being. On the one tool where people
        upload copyrighted music, that is the answer that gets read closely.

        FINALISED 2026-08-30 against /limits.retention.separation:
          input_seconds  7200
          output_seconds 7200   ← one TTL sweep deletes both together
        So "two hours" covers everything, with no split between the upload and
        the stems — which is simpler to say and simpler to keep true.

        The framing matters as much as the number. Separation is the ONLY tool
        family that holds an upload at all: every other route deletes its input
        in _run_tool_job's finally block, win or lose. So this is a deliberate
        exception with a reason, not a general policy — and saying so is more
        reassuring than staying quiet about it.
      */
      question: "Are my uploaded tracks kept?",
      answer:
        "For two hours, then everything is deleted automatically — your upload and the separated stems together, by the same expiry. That window is what lets the one-click Studio Quality re-run work without a second upload, so it applies to standard runs too, since a standard run is the one you'd upgrade from. Separation is the only tool on the site that holds an upload at all; every other one deletes it the moment processing finishes. There are no accounts, so nothing is linked to you, published, or shared.",
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
      // FIX 5: previously claimed "Everything runs in your browser", which is
      // false — separation runs Demucs on GPU infrastructure server-side. The
      // page contradicted itself three sections later, and the claim was
      // incompatible with the retention answer above. Same error class already
      // corrected on /video-to-audio.
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
          <Link href="/youtube-vocal-remover" className="text-amber-400 hover:underline">
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
          <Link href="/stems" className="text-amber-400 hover:underline">
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
      question: "Is there a maximum file size?",
      // Read from FILE_SIZE_LIMITS — the constant validateAudioFile enforces —
      // so this can't drift from what the form actually rejects.
      answer: `Yes, ${MAX_UPLOAD_LABEL} per upload.`,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free AI Vocal Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload a song and remove vocals with AI to create an instrumental
            or acapella, no sign-up, no download required. Free for karaoke,
            practice, remixing, and sampling.
          </p>
        </header>

        <VocalRemoverForm hqAvailable={separationHqEnabled} />

        {/*
          One bordered strip with hairline dividers, not three floating cards.
          Three separate boxes directly under the tool read as three more
          things to deal with; divided cells read as one row of facts about
          the thing above them. Text unchanged — this is purely how it sits.
        */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "GPU-accelerated AI", desc: "Real source separation, not a basic center-channel filter." },
            // FIX 4: was "Runs entirely in your browser" — factually wrong,
            // separation runs server-side on GPU. Reworded to say what's
            // actually true and still answer the "do I need software?" worry.
            { title: "No install", desc: "Nothing to download. Upload, process, download in your browser." },
            { title: "Free", desc: "No sign-up, no watermark, free for everyone." },
          ].map((f) => (
            <div key={f.title} className="space-y-1.5 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
                {f.title}
              </p>
              <p className="text-sm leading-relaxed text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What you get</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-text-primary">Vocals</h3>
              <p className="text-text-muted leading-relaxed">
                Lead and backing vocals, isolated from the instrumentation
                around them — usable as an acapella on its own.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Instrumental</h3>
              <p className="text-text-muted leading-relaxed">
                The full mix with vocals removed, ready as a karaoke backing
                track or a base to build a remix around.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Preview and download</h3>
              <p className="text-text-muted leading-relaxed">
                Both tracks play directly in the browser once separation
                finishes, and each downloads independently — grab one, the
                other, or both.
              </p>
            </div>
          </div>
        </section>

        {/*
          THE SPEC SECTION. This replaces a TODO that had sat here since the
          page was written, blocked on the backend separation command.

          It is the only section on this page a competitor cannot copy without
          publishing their own numbers, and the "fixed regardless of your
          source" row is the one that changes a producer's decision: everyone
          else's copy implies the output follows the input, and with Demucs it
          cannot.
        */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What the output actually is</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="w-2/5 px-4 py-3 font-medium text-text-subtle">Format</td>
                  <td className="px-4 py-3 text-text-primary">WAV (RIFF), 16-bit signed PCM</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Bitrate</td>
                  <td className="px-4 py-3">Lossless — about 1,411 kbps at 44.1 kHz stereo</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Sample rate</td>
                  <td className="px-4 py-3 font-mono tabular-nums">44,100 Hz — fixed</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Channels</td>
                  <td className="px-4 py-3">2 (stereo) — fixed</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-subtle">Inherited from your file</td>
                  <td className="px-4 py-3 text-text-primary">None of it</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="leading-relaxed text-text-muted">
            That last row is worth reading twice if you work at 48 kHz. Demucs
            operates at 44.1 kHz in stereo internally, so the output rate and
            channel count are fixed no matter what you upload — a 48 kHz file
            comes back at 44.1 kHz, a mono file comes back as two channels, and
            a 24-bit file comes back at 16-bit. That is how the model pipeline
            works rather than a choice we made, and it is true of every tool
            built on Demucs, including the ones that don&apos;t mention it. Drop
            a stem into any editor and check.
          </p>
          <p className="leading-relaxed text-text-muted">
            You can also verify the models: standard runs{" "}
            <strong className="text-text-primary">htdemucs</strong> at 0.25
            overlap, Studio Quality runs{" "}
            <strong className="text-text-primary">htdemucs_ft</strong> — four
            fine-tuned instances, ensembled — at 0.5. Higher overlap means more
            redundant computation across chunk boundaries, which is where the
            artifacts on longer tracks tend to show up. Between the ensemble and
            the overlap, Studio Quality is roughly five times the compute of
            standard, which is where the extra minute goes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Who is this for?</h2>
          <p className="text-text-muted leading-relaxed">
            Producers pulling an instrumental to sample or build on, DJs
            extracting an acapella for a mashup, singers practicing over a
            clean backing track, music teachers preparing karaoke material
            for students, and content creators needing an instrumental bed
            all use this tool for the same underlying job — splitting a mix
            into vocal and instrumental stems.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to remove vocals from a song</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, AAC, M4A, or OGG file.</li>
            <li>AI source separation splits the track into vocal and instrumental components, usually 20 seconds to 1 minute, depending on length and server load.</li>
            <li>Download the result directly in your browser, no install needed.</li>
          </ol>
          <p className="text-text-muted leading-relaxed">
            Need a track from YouTube first? Grab it with our{" "}
            <Link href="/youtube-to-wav" className="text-amber-400 hover:underline">
              YouTube to WAV converter
            </Link>{" "}
            and upload the result here, or skip the step entirely with the{" "}
            <Link href="/youtube-vocal-remover" className="text-amber-400 hover:underline">
              YouTube Vocal Remover
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Remove Vocals From a Song Online</h2>
          <p className="text-text-muted leading-relaxed">
            AudioForges lets you remove vocals from a song online without
            installing audio software. Upload an MP3, WAV, FLAC, AAC, M4A, or
            OGG file and the AI separation model creates two tracks: an
            isolated vocal stem and an instrumental with the vocals removed.
          </p>
          <p className="text-text-muted leading-relaxed">
            You can use the instrumental for karaoke or practice, or use the
            isolated vocal as an acapella for remixing, sampling, and
            mashups. Each result can be previewed and downloaded separately
            after processing.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How AI vocal removal works</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              This tool uses real AI audio-source-separation processing to split a
              track into <strong className="text-text-primary">vocals</strong> and{" "}
              <strong className="text-text-primary">instrumental</strong> — not a
              simple center-channel filter, which only partially removes vocals and
              often damages the mix.
            </p>
            <p>
              A center-channel filter works by cutting whatever&apos;s panned
              dead-center in the stereo mix — that catches lead vocals in many
              commercial mixes, but it also strips out anything else placed
              centrally (kick, bass, snare) and leaves behind any vocal element that
              isn&apos;t perfectly centered. AI source separation instead analyzes
              the audio&apos;s learned characteristics of what a voice sounds like
              versus an instrument, which is why it can isolate vocals regardless
              of where they sit in the stereo field, and why it produces a cleaner
              instrumental as a result. The model processes and outputs full stereo
              audio, and splits a track into exactly two stems — vocals and
              instrumental — rather than separating individual instruments like
              drums or bass on their own.
            </p>
            <p>
              AudioForges processes the AI separation workload on GPU-accelerated
              infrastructure. A single track usually takes 20 seconds to 1 minute,
              and usage is rate-limited per IP address so it stays free and
              available for everyone. There is no app or plugin to install —
              you upload through the browser and the separation runs on the server.
            </p>
            <p>
              The model is{" "}
              <strong className="text-text-primary">htdemucs</strong> — the published
              Hybrid Transformer Demucs, not something wrapped and renamed. Studio
              Quality runs{" "}
              <strong className="text-text-primary">htdemucs_ft</strong>, a
              &quot;bag of four&quot;: four instances of the same architecture, each
              fine-tuned toward one stem, then ensembled. That is where the extra
              minute goes and why the stems come out cleaner.
            </p>
            <p>
              Both stems come back as <strong className="text-text-primary">WAV</strong>.
              One thing worth saying because it&apos;s counter-intuitive: asking for
              two stems instead of four doesn&apos;t make this cheaper to run. The
              model separates all four sources internally either way and sums three
              of them into the instrumental — vocal removal is the same amount of
              work as a full stem split, just with different files kept.
            </p>
            <p>
              Want the fuller breakdown of how this compares to older methods and
              where separation still struggles?{" "}
              <Link href="/guides/ai-vocal-removal-explained" className="text-amber-400 hover:underline">
                Read How AI Vocal Removal Actually Works
              </Link>.
            </p>
          </div>
        </section>

        {separationHqEnabled && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">Standard vs. Studio Quality</h2>
            <div className="overflow-x-auto rounded-xl border border-graphite-800">
              <table className="w-full text-sm text-left text-text-muted">
                <thead className="bg-graphite-900">
                  <tr>
                    <th className="w-1/4 px-4 py-3">
                      <span className="sr-only">Comparison</span>
                    </th>
                    {/* The paid column is the one being weighed. Amber marks it
                        as the subject rather than leaving two identical
                        headings for the eye to sort out. */}
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] font-medium text-text-subtle">
                      Standard
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] font-medium text-amber-400">
                      Studio Quality
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800">
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Processing time</td>
                    <td className="px-4 py-3 font-mono tabular-nums">20 sec–1 min</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      1–2 min
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Separation quality</td>
                    <td className="px-4 py-3">Good for most tracks</td>
                    <td className="px-4 py-3">Noticeably cleaner on both stems</td>
                  </tr>
                  <tr>
                    {/* Pulled from lib/data/rate-limits.ts (getRateLimitLabel) —
                        do not hardcode these two cells again.

                        The Studio Quality figure is the FREE-TIER one, and it is
                        labelled as such: that rule is tiered, credits raise it
                        substantially, and a Server Component cannot know which
                        tier this visitor is. Unqualified, this cell was simply
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
                    {/*
                      A comparison table that lists time, quality, limit and
                      best-for, and NOT price, sends someone to a toggle that
                      then says "1 CREDIT".

                      No per-visitor number here — this is a Server Component,
                      and the header line that tried to give one was removed for
                      exactly that reason. But "can't state a count" is not
                      "can't mention cost". The allowance being SHARED across
                      the Studio Quality tools is the part people otherwise find
                      out by surprise, which is the same trap the transcription
                      form documents.
                    */}
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
                    <td className="px-4 py-3">Sampling, remixing, anything going into a final mix</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-text-muted leading-relaxed">
              Studio Quality uses a larger, ensembled model rather than a single
              pass, which is why it takes longer — the trade-off is
              worth it when the stems are headed into an actual production, not
              just a quick check.
            </p>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">AI vocal removal isn&apos;t perfect</h2>
          <p className="text-text-muted leading-relaxed">
            Separation quality depends heavily on the source track. Choir or
            group vocals confuse the model since it has multiple overlapping
            vocal-like sources to untangle instead of one. Heavy distortion
            can share enough spectral character with a distorted or screamed
            vocal that the two get separated less cleanly. Live recordings
            with crowd noise or stage bleed give the model a messier signal
            to work from than a controlled studio mix. None of these make
            separation fail outright — they just tend to leave more audible
            traces behind than a clean studio recording would.
          </p>
          <p className="text-text-muted leading-relaxed">
            GPU acceleration changes the infrastructure the separation runs
            on, not the difficulty of the underlying problem — source quality
            and arrangement still determine the final result.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Instrumental vs. acapella</h2>
          <p className="text-text-muted leading-relaxed">
            An <strong className="text-text-primary">instrumental</strong> is the
            track with vocals removed — everything except the voice. An{" "}
            <strong className="text-text-primary">acapella</strong> is the reverse:
            just the isolated vocal, with the instrumentation removed. Both come
            from the same underlying separation process, just keeping the opposite
            stem. Karaoke and remixing usually call for the instrumental; sampling
            a vocal hook or building a mashup usually calls for the acapella.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Karaoke &amp; practice:</strong>{" "}
              get an instrumental to sing or play along with.
            </p>
            <p>
              <strong className="text-text-primary">Remixing &amp; sampling:</strong>{" "}
              isolate an acapella or a clean instrumental bed to build on. Check the
              key first with our{" "}
              <Link href="/key-finder" className="text-amber-400 hover:underline">
                Key &amp; BPM Finder
              </Link>{" "}
              if you&apos;re building something new around the sample.
            </p>
            <p>
              <strong className="text-text-primary">DJ mashups:</strong> pull an
              acapella from one track to lay over the instrumental of another.
            </p>
            <p>
              <strong className="text-text-primary">Cover reference:</strong> hear the
              instrumentation clearly without the original vocal in the way.
            </p>
          </div>
        </section>

        {relatedTools.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-text-primary">More free tools</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  prefetch={false}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 hover:border-amber-500/40 transition-colors"
                >
                  <h3 className="font-semibold text-text-primary">{tool.name}</h3>
                  <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            You are responsible for ensuring you have the right to process any track
            you upload — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the tracks
            processed through this tool.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}