import type { Metadata } from "next";
import Link from "next/link";
import { YouTubeStemForm } from "@/components/converter/YouTubeStemForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { getDurationLabel } from "@/lib/data/tool-limits";
import { getFeatureFlags } from "@/lib/api/railway";

const PAGE_TITLE = "Free YouTube Stem Splitter – Split Songs Into Stems";
const PAGE_DESCRIPTION =
  "Split YouTube songs into vocals, drums, bass, and other stems with AI. Free, no sign-up, no download required.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/youtube-stem-splitter` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-stem-splitter`,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

// WebApplication schema — every claim below is checked against the actual
// YouTubeStemForm/backend behavior. GPU-accelerated is stated because
// separation genuinely runs on GPU infrastructure; no speed or accuracy
// numbers are claimed, since none are measured.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Stem Splitter",
  url: `${SITE_URL}/youtube-stem-splitter`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "GPU-accelerated AI 4-stem separation from a YouTube link",
    "No manual download step",
    "Individually downloadable vocals, drums, bass, and other stems",
    "No sign-up required",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "YouTube Stem Splitter", item: `${SITE_URL}/youtube-stem-splitter` },
  ],
};
// NOTE: No HowTo schema — deprecated by Google (desktop since Sept 2023),
// no ranking or rich-result benefit remains. Visible how-to steps stay.

// Rate-limit numbers shown in the "Standard vs. Studio Quality" table below
// are read from lib/data/rate-limits.ts rather than hardcoded here — same
// source YouTubeStemForm.tsx uses, so the tool UI and this SEO copy can
// never quietly drift apart. Fallback text only fires if a key is ever
// missing/renamed in rate-limits.ts.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";
const standardLimitLabel = getRateLimitLabel("youtube/stems") ?? FALLBACK_RATE_LIMIT_LABEL;
const hqLimitLabel = getRateLimitLabel("youtube/stems-hq") ?? FALLBACK_RATE_LIMIT_LABEL;

// Video length caps, read from lib/data/tool-limits.ts for the same reason
// the rate limits above come from rate-limits.ts.
//
// FIXED 2026-08-22, identical bug to the one corrected on
// /youtube-vocal-remover the same day — the two pages had the same wrong
// sentence, which is what a copy-pasted hardcoded number does.
//
// This page previously stated "videos longer than 15 minutes aren't
// supported." The real ceiling is MAX_SEPARATION_DURATION_SECONDS — TEN
// minutes, and SIX on Studio Quality. A 14-minute video was therefore
// explicitly invited by this copy, accepted, downloaded in full through
// the paid residential proxy, and only then refused at the separation
// step. The user waited for a fetch that could never have been usable,
// and we paid for the bandwidth.
//
// The 15 almost certainly came from someone reading the DOWNLOAD cap
// (MAX_VIDEO_DURATION_SECONDS, 40 min) and rounding. Every /youtube/*
// tool stacks a download cap and a processing cap; the smaller one is
// what a user actually hits, and it is the only one worth showing. See
// the note at the top of tool-limits.ts.
const FALLBACK_DURATION_LABEL = "10 minutes";
const standardDurationLabel = getDurationLabel("youtube/stems") ?? FALLBACK_DURATION_LABEL;
const hqDurationLabel = getDurationLabel("youtube/stems-hq") ?? "10 minutes";

export default async function YouTubeStemSplitterPage() {
  const relatedTools = getRelatedTools("youtube-stem-splitter", 5);
  const { separationHqEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "What is a YouTube stem splitter?",
      answer:
        "A YouTube stem splitter takes audio from a YouTube video and uses AI source separation to create four separate tracks: vocals, drums, bass, and other.",
    },
    {
      question: "How do I split a YouTube song into stems?",
      answer:
        "Paste the video's link into the tool above. The audio is fetched and separated automatically, then all four stems are ready to preview and download.",
    },
    {
      question: "How is this different from the regular Stem Splitter?",
      answer:
        "The regular Stem Splitter needs an audio file already on your device. This version takes a YouTube link directly, fetching and separating the audio in one step instead of requiring a separate download tool first.",
    },
    {
      question: "How long does it take?",
      answer:
        "Usually 30 seconds to 1 minute for standard quality. Fetching the audio is the fast part, and the AI stem separation is what takes most of the time.",
    },
    ...(separationHqEnabled
      ? [
          {
            question: "What is Studio Quality mode?",
            answer:
              "An optional higher-fidelity separation mode using a larger, ensembled AI model. It produces noticeably cleaner stems across all four tracks, at the cost of a longer processing time, typically 1 to 2 minutes instead of 30 seconds to 1 minute.",
          },
        ]
      : []),
    {
      question: "What stems do I get?",
      answer:
        "Four: vocals, drums, bass, and other (everything else — guitars, keys, pads, synths). Each downloads independently.",
    },
    {
      question: "Can I download each stem separately?",
      answer:
        "Yes — each of the four stems previews and downloads independently, so you only need to grab the ones you actually want.",
    },
    {
      question: "What affects stem separation quality?",
      answer:
        "How densely the source track is mixed matters most. Bass and low guitar can bleed into each other since they occupy similar frequency ranges, and heavily processed drums sometimes separate less cleanly than an acoustic kit.",
    },
    {
      question: "Why can AI-separated stems have bleed?",
      answer:
        "The model estimates four sources from one mixed recording rather than recovering the original studio multitracks. Instruments sharing a similar frequency range are hardest to fully untangle, which is where bleed between stems tends to show up.",
    },
    {
      question: "Does it work with YouTube Shorts?",
      answer: "Yes — watch links, youtu.be links, and Shorts links are all supported.",
    },
    // Length limit, derived from tool-limits.ts — see the note above the
    // constants at the top of this file for why the previous hardcoded
    // "15 minutes" was actively costing users time and us proxy
    // bandwidth. Studio Quality has a tighter cap than standard (a single
    // job holds the one separation slot far longer), so when HQ is
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
      question: "I only want vocals and instrumental, not all 4 stems — is there a simpler option?",
      answer:
        "Yes — the YouTube Vocal Remover gives you just vocals and a combined instrumental, if you don't need drums and bass split out separately.",
      answerNode: (
        <>
          Yes — the{" "}
          <Link href="/youtube-vocal-remover" className="text-amber-400 hover:underline">
            YouTube Vocal Remover
          </Link>{" "}
          gives you just vocals and a combined instrumental, if you don&apos;t
          need drums and bass split out separately.
        </>
      ),
    },
    {
      question: "Is this really free?",
      answer:
        "Yes, completely free. Because this chains a YouTube download with GPU-accelerated 4-stem AI separation, it's rate-limited per person to keep it available for everyone.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free YouTube Stem Splitter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Paste a YouTube link and split a song into vocals, drums, bass,
            and other stems with AI. No download step, no sign-up, and free
            to use.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <YouTubeStemForm hqAvailable={separationHqEnabled} />

        {/* One bordered strip with hairline dividers, matching /vocal-remover
            and /stems: three floating boxes under the tool read as three more
            things to deal with; divided cells read as one row of facts. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "No download step", desc: "Paste a link, skip the save-and-reupload." },
            { title: "4 separate stems", desc: "Vocals, drums, bass, and other, each downloaded individually." },
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
          <h2 className="text-2xl font-bold text-text-primary">How to split a YouTube video into stems</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Paste a YouTube video, Shorts, or youtu.be link — up to {standardDurationLabel} long.</li>
            <li>The audio is fetched and split into four stems automatically, usually 30 seconds to 1 minute.</li>
            <li>Preview and download each stem individually.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What you get: the four stems</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-text-primary">Vocals</h3>
              <p className="text-text-muted leading-relaxed">
                Lead and backing vocals, isolated from the instrumentation
                around them.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Drums</h3>
              <p className="text-text-muted leading-relaxed">
                The full kit — kick, snare, hi-hats, cymbals, and other
                percussion — as one combined drum stem.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Bass</h3>
              <p className="text-text-muted leading-relaxed">
                Bass guitar or synth bass, covering the low end of the
                arrangement.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Other</h3>
              <p className="text-text-muted leading-relaxed">
                Everything that isn&apos;t vocals, drums, or bass — guitars,
                keys, synths, pads, and any remaining instrumentation, kept
                together as a single stem.
              </p>
            </div>
          </div>
          <p className="text-text-muted leading-relaxed">
            Each stem previews directly in the browser and downloads
            independently, so you can grab just the one you need without
            pulling the rest.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why paste a link instead of downloading first</h2>
          <p className="text-text-muted leading-relaxed">
            The regular{" "}
            <Link href="/stems" className="text-amber-400 hover:underline">
              Stem Splitter
            </Link>{" "}
            works from a file already on your device — usually meaning a
            separate download step before you can even start. This version
            chains the download and the 4-stem separation together, so a
            link is all you need. The separation itself is identical; only
            the input method differs.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown of how 4-stem separation actually
            works, and why bass and drums are the hardest pair to separate
            cleanly?{" "}
            <Link href="/guides/ai-stem-separation-explained" className="text-amber-400 hover:underline">
              Read How AI Stem Separation Actually Works
            </Link>
            . Curious why the YouTube version takes longer than uploading a
            file, or what happens when a video can&apos;t be fetched?{" "}
            <Link href="/guides/how-youtube-tools-fetch-then-process" className="text-amber-400 hover:underline">
              Read How AudioForges&apos; YouTube Tools Work: Fetch, Then Process
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Split YouTube Songs Into Stems</h2>
          <p className="text-text-muted leading-relaxed">
            This YouTube stem splitter turns a YouTube song into four separate
            audio tracks: vocals, drums, bass, and other. Instead of
            downloading the audio first and uploading it to a separate stem
            separation tool, you can paste the YouTube link directly and let
            AudioForges handle the audio fetching and AI separation in one
            workflow.
          </p>
          <p className="text-text-muted leading-relaxed">
            The four stems can be useful for remixing, sampling, mashups,
            music production, practice, and studying how a song is arranged.
            Each stem can be previewed and downloaded separately after
            processing.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How AI stem separation works</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              AI stem separation estimates four individual sources from a single
              mixed recording — it isn&apos;t recovering the original studio
              multitracks, it&apos;s reconstructing an approximation of them
              based on the learned characteristics of what a voice, a drum kit,
              a bass line, and everything else each sound like. All four are
              separated simultaneously in one pass, in full stereo.
            </p>
            <p>
              AudioForges processes the AI separation workload on
              GPU-accelerated infrastructure. Fetching the audio from YouTube
              is the fast half of this tool; separation is the slower one, and
              usage is rate-limited per person so it stays free and available
              for everyone.
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
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      1–2 min
                    </td>
                  </tr>
                  <tr>
                    {/* Pulled from lib/data/tool-limits.ts (getDurationLabel).
                        The two tiers have genuinely different caps — HQ holds
                        the single separation slot several times longer — so
                        this row is not decorative. Do not hardcode it. */}
                    <td className="px-4 py-3 font-medium text-text-subtle">Max video length</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{standardDurationLabel}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      {hqDurationLabel}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-text-subtle">Separation quality</td>
                    <td className="px-4 py-3">Good for most tracks</td>
                    <td className="px-4 py-3">Noticeably cleaner across all four stems</td>
                  </tr>
                  <tr>
                    {/* Pulled from lib/data/rate-limits.ts (getRateLimitLabel) —
                        do not hardcode these two cells again. */}
                    <td className="px-4 py-3 font-medium text-text-subtle">Usage limit</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{standardLimitLabel}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      {hqLimitLabel}
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
              just a quick check. It also accepts a shorter video, since a
              single job occupies the separation queue for much longer.
            </p>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Separation quality</h2>
          <p className="text-text-muted leading-relaxed">
            Separation quality depends on how densely the source track is
            mixed. Bass and low guitar can bleed into each other since they
            occupy similar frequency ranges, and heavily processed or
            programmed drums sometimes separate less cleanly than an
            acoustic kit. Reverb and effects on one source can stay faintly
            audible across more than one stem. This isn&apos;t specific to
            pulling audio from YouTube — it&apos;s the same behavior as the
            file-based Stem Splitter, since both run the same separation
            model.
          </p>
          <p className="text-text-muted leading-relaxed">
            YouTube&apos;s own audio compression adds one more variable, since
            the source here is an encoded stream rather than a master. GPU
            acceleration changes the infrastructure this runs on, not the
            difficulty of the underlying problem — perfectly clean separation
            on every track isn&apos;t a realistic expectation at any quality
            tier.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Sampling &amp; production:</strong>{" "}
              pull an isolated drum loop or bassline from a track on YouTube to
              build something new around.
            </p>
            <p>
              <strong className="text-text-primary">Remixing &amp; mashups:</strong>{" "}
              build around specific stems from a reference track rather than a
              full instrumental.
            </p>
            <p>
              <strong className="text-text-primary">Practice &amp; study:</strong>{" "}
              isolate a bass or drum part to learn it note-for-note. Pair it with
              the{" "}
              <Link href="/youtube-key-finder" className="text-amber-400 hover:underline">
                YouTube Key &amp; BPM Finder
              </Link>{" "}
              to get key and tempo from the same link.
            </p>
            <p>
              <strong className="text-text-primary">Arrangement analysis:</strong>{" "}
              break a track down instrument-by-instrument without needing the
              original files.
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
            You are responsible for ensuring you have the right to process any video
            you submit — for personal practice, content you own, or material you have
            permission to use. AudioForges does not host or distribute the videos or
            audio processed through this tool.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}