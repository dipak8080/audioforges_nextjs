import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { StemsForm } from "@/components/converter/StemsForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { FILE_SIZE_LIMITS } from "@/lib/utils/validation";
import { getFeatureFlags } from "@/lib/api/railway";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE BROWSER CLAIM, THIRD INSTANCE — AND THIS ONE CONTRADICTS ITSELF
 *    INSIDE ONE PARAGRAPH. "How 4-stem separation works" opened with
 *    "AudioForges processes the AI separation workload on GPU-accelerated
 *    infrastructure" and closed, two sentences later, with "everything happens
 *    in your browser".
 *
 *    The FAQ answer and the feature strip had both already been corrected on
 *    this page; this third copy was missed because it reads like a throwaway
 *    reassurance rather than a technical claim. It is the one a reader is most
 *    likely to quote back at us, since it sits under a heading promising to
 *    explain how the thing works.
 *
 * 2. THE RETENTION ANSWER WAS MISSING, and it's now answerable. The backend
 *    confirmed SEPARATION_JOB_TTL_SECONDS = 7200 and that it applies to ALL
 *    FOUR separation routes, not only Studio Quality — a standard run is
 *    precisely the one someone upgrades from, so it's the one that must keep
 *    its input. Same wording as /vocal-remover, which is the point: two pages
 *    describing one backend behaviour must not describe it differently.
 *
 * 3. THE STUDIO QUALITY LIMIT IS THE FREE-TIER FIGURE, UNLABELLED. Same as
 *    /vocal-remover before it was fixed: the rule is tiered, credits raise it
 *    substantially, and a Server Component can't know which tier the visitor
 *    is. Unqualified, that cell is wrong for everyone who paid.
 *
 * 4. THE COMPARISON TABLE NEVER MENTIONED COST. Time, quality, limit and
 *    best-for, but not price — so the visitor decides from the table and meets
 *    "1 CREDIT" on the toggle. No per-visitor number (this is a Server
 *    Component), but the allowance being SHARED across the Studio Quality
 *    tools is the part people otherwise discover by surprise.
 *
 * 5. 80MB WAS TYPED TWICE. Read from FILE_SIZE_LIMITS.audio, the constant
 *    validateAudioFile actually enforces.
 *
 * 6. THE MODELS ARE NAMED, matching /vocal-remover. htdemucs and htdemucs_ft
 *    are the published Demucs models; naming them is checkable, which is the
 *    entire argument this page makes against "our proprietary AI".
 *
 * ⚠️ ONE THING TO VERIFY: SUPPORTED_FORMATS omits AIFF, and so does the FAQ.
 * The shared audio validator accepts .aiff on other tools. If it accepts it
 * here too, this page is understating what it takes — check what
 * MultiOutputToolForm passes as fileAccept before adding it, rather than
 * assuming the lists match.
 */

const PAGE_TITLE = "Free AI Stem Splitter – Split Songs Into Stems";
const PAGE_DESCRIPTION =
  "Split songs into vocals, drums, bass, and other stems with AI. Upload MP3, WAV, FLAC, M4A, AAC, or OGG for free. No sign-up.";

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
  name: "AI Stem Splitter",
  url: `${SITE_URL}/stems`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "GPU-accelerated AI 4-stem separation: vocals, drums, bass, other",
    "No sign-up required",
    "No download or software install required",
    "Individually downloadable stems",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Stem Splitter", item: `${SITE_URL}/stems` },
  ],
};

/*
 * AIFF ADDED 2026-08-30. StemsForm passes no fileAccept override, so
 * MultiOutputToolForm's default applies — and that default has always ended
 * ".aiff". The tool accepted AIFF; this list, the FAQ answer and the how-to
 * step all said it didn't. Understating what you accept costs uploads from
 * exactly the people most likely to have AIFF: anyone exporting from Logic.
 */
const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF"];

// Rate-limit numbers shown in the "Standard vs. Studio Quality" table below
// are read from lib/data/rate-limits.ts rather than hardcoded here — same
// source StemsForm.tsx uses ("stems"/"stems-hq"). Fallback text only fires
// if a key is ever missing/renamed in rate-limits.ts.
const FALLBACK_RATE_LIMIT_LABEL = "rate limited";
const standardLimitLabel = getRateLimitLabel("stems") ?? FALLBACK_RATE_LIMIT_LABEL;
const hqLimitLabel = getRateLimitLabel("stems-hq") ?? FALLBACK_RATE_LIMIT_LABEL;

/**
 * The cap validateAudioFile actually enforces. This page wrote "80MB" twice as
 * a literal — in the FAQ and under Supported Formats — so the day that
 * constant moves, both are quietly wrong and nothing fails.
 */
const MAX_UPLOAD_LABEL = `${Math.round(FILE_SIZE_LIMITS.audio / (1024 * 1024))}MB`;

/** Same style as the convert page — clean mono badges, no check icons */
function FormatBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      {SUPPORTED_FORMATS.map((format) => (
        <span
          key={format}
          className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
        >
          {format}
        </span>
      ))}
    </div>
  );
}

/** Only used in comparison tables */
function CheckMark() {
  return <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
}

export default async function StemsPage() {
  const relatedTools = getRelatedTools("stems", 5);
  const { separationHqEnabled } = await getFeatureFlags();

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
        ADDED 2026-08-30, worded identically to /vocal-remover on purpose. Both
        pages describe one backend behaviour and two descriptions of the same
        thing are how a privacy claim ends up half-right.

        From /limits.retention.separation: input_seconds 7200, output_seconds
        7200 — one TTL sweep deletes the upload and the stems together, so "two
        hours" covers everything with no split to explain.

        It applies to ALL FOUR separation routes, not only Studio Quality: a
        standard run is precisely the one someone upgrades from, so it is the
        one that has to keep its input. And separation is the ONLY family that
        holds an upload at all — every other tool deletes its input in
        _run_tool_job's finally block — which makes this a deliberate exception
        with a reason rather than a general policy.
      */
      question: "Are my uploaded tracks kept?",
      answer:
        "For two hours, then everything is deleted automatically — your upload and the separated stems together, by the same expiry. That window is what lets the one-click Studio Quality re-run work without a second upload, so it applies to standard runs too, since a standard run is the one you'd upgrade from. Separation is the only tool on the site that holds an upload at all; every other one deletes it the moment processing finishes. There are no accounts, so nothing is linked to you, published, or shared.",
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
      // Read from FILE_SIZE_LIMITS rather than typed, so it can't drift from
      // what the form actually rejects.
      answer: `MP3, WAV, FLAC, AAC, M4A, OGG, and AIFF are all supported, up to ${MAX_UPLOAD_LABEL} per upload.`,
    },
    {
      question: "Do I need to sign up or install anything?",
      // CORRECTED: claimed "Everything runs in your browser". Separation runs
      // Demucs on GPU infrastructure server-side, which this page states
      // plainly further down — the two contradicted each other. Same fix
      // already applied to the equivalent answer on /vocal-remover (FIX 5).
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
          <Link href="/youtube-stem-splitter" className="text-amber-400 hover:underline">
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free AI Stem Splitter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Split a song into separate vocals, drums, bass, and other stems using
            AI source separation. Upload MP3, WAV, FLAC, AAC, M4A, OGG, or AIFF and
            download each stem individually. No sign-up, no software install.
          </p>
        </header>

        <StemsForm hqAvailable={separationHqEnabled} />

        {/* One bordered strip with hairline dividers, matching /vocal-remover:
            three floating boxes under the tool read as three more things to
            deal with; divided cells read as one row of facts about it. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "4 stems", desc: "Vocals, drums, bass, and other — not just a 2-way split." },
            // CORRECTED: said "Runs entirely in your browser", which is false —
            // separation runs server-side on GPU, and this page's own "How
            // 4-stem separation works" section says so three screens down. The
            // identical claim was already fixed on /vocal-remover (FIX 4); this
            // copy of it was missed.
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
          <h2 className="text-2xl font-bold text-text-primary">What is a stem splitter?</h2>
          <p className="text-text-muted leading-relaxed">
            A stem splitter takes a fully mixed-down song — a single audio file
            with everything blended together — and separates it back into
            individual parts, called stems. Normally, separate stems only exist
            if a producer kept the original multitrack recording. AI source
            separation gets around that: a model trained on learned
            characteristics of what a voice, a drum kit, a bass line, and other
            instrumentation each sound like reconstructs an approximation of
            those separate parts from the finished mix alone. That&apos;s the
            same underlying idea as audio source separation more broadly — it&apos;s
            why producers, remixers, and DJs use it to get usable stems from a
            track they only have as a finished MP3 or WAV.
          </p>
          <p className="text-text-muted leading-relaxed">
            AudioForges lets you split a song online without the original
            project files or multitrack session. Upload a finished track and
            the AI separates it into vocals, drums, bass, and other
            instrumentation that you can preview and download individually.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            4-Stem Separation: Vocals, Drums, Bass &amp; Other
          </h2>
          <p className="text-text-muted leading-relaxed">
            Every upload is split into these four stems in a single pass:
          </p>
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
                percussion — separated as one combined drum stem.
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
                Everything that isn&apos;t vocals, drums, or bass — guitars, keys,
                synths, pads, strings, and any remaining instrumentation, kept
                together as a single stem rather than split further into
                individual instruments.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Who is this for?</h2>
          <p className="text-text-muted leading-relaxed">
            Producers pulling isolated drum or bass stems to sample and rebuild
            around, remixers who need more than just an instrumental, mashup
            artists layering elements from multiple tracks, and anyone studying
            an arrangement instrument-by-instrument all use this tool for the
            same underlying job — splitting a full mix into its four core
            components.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Stem Splitter vs. Vocal Remover</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
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
          <p className="text-text-muted leading-relaxed">
            Just need vocals out of the way? The{" "}
            <Link href="/vocal-remover" className="text-amber-400 hover:underline">
              Vocal Remover
            </Link>{" "}
            does the same separation and hands back one clean instrumental
            instead of four stems to sort through. Worth knowing it isn&apos;t the
            cheaper operation: the model separates all four sources either way
            and sums three of them, so the only difference is which files you
            get back.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to Split a Song Into Stems</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, AAC, M4A, OGG, or AIFF file.</li>
            <li>AI source separation splits the track into vocals, drums, bass, and other, usually 20 seconds to 1 minute, depending on length and server load.</li>
            <li>Preview and download each stem individually, directly in your browser.</li>
          </ol>
          <p className="text-text-muted leading-relaxed">
            Need a track from YouTube first? Use the{" "}
            <Link href="/youtube-stem-splitter" className="text-amber-400 hover:underline">
              YouTube Stem Splitter
            </Link>{" "}
            to skip the manual download step entirely.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How 4-stem separation works</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              This tool uses the same AI source-separation model as our{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:underline">
                Vocal Remover
              </Link>
              , but keeps all four of the internally separated components instead
              of combining three of them back into one instrumental track. The
              model analyzes learned characteristics of what a voice, a drum kit,
              a bass line, and everything else each sound like, and separates all
              four simultaneously in a single pass, outputting full stereo audio
              for each stem.
            </p>
            <p>
              The model is <strong className="text-text-primary">htdemucs</strong> —
              the published Hybrid Transformer Demucs, not something wrapped and
              renamed. Studio Quality runs{" "}
              <strong className="text-text-primary">htdemucs_ft</strong>, a
              &quot;bag of four&quot;: four instances of the same architecture, each
              fine-tuned toward one stem, then ensembled. That is where the extra
              minute goes and why the stems come out cleaner.
            </p>
            {/*
              CORRECTED: this paragraph ended "No download, install, or account
              is needed — everything happens in your browser", two sentences
              after saying the workload runs on our GPUs. It contradicted
              itself inside a single paragraph, under a heading promising to
              explain how the tool works.
            */}
            <p>
              AudioForges processes the AI separation workload on GPU-accelerated
              infrastructure. A single track usually takes 20 seconds to 1 minute,
              and usage is rate-limited per IP address so it stays free and
              available for everyone. There is no app, plugin, or account to set
              up — you upload through the browser and the separation runs on the
              server.
            </p>
            <p>
              Want the fuller technical breakdown — why bass and drums are the
              hardest pair to separate, and what Studio Quality actually buys
              you?{" "}
              <Link href="/guides/ai-stem-separation-explained" className="text-amber-400 hover:underline">
                Read How AI Stem Separation Actually Works
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
                    <td className="px-4 py-3 font-mono tabular-nums text-text-primary">
                      1–2 min
                    </td>
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

                      No per-visitor number — this is a Server Component and
                      cannot know a visitor's remaining allowance. But the
                      allowance being SHARED across the Studio Quality tools is
                      the part people otherwise find out by surprise.
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
          <h2 className="text-2xl font-bold text-text-primary">Supported Audio Formats</h2>
          <FormatBadges />
          <p className="text-text-muted leading-relaxed">
            Upload any of the formats above, up to {MAX_UPLOAD_LABEL} per file. Output
            stems are delivered as individually downloadable audio files.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Stem Splitter isn&apos;t perfect</h2>
          <p className="text-text-muted leading-relaxed">
            Separation quality depends heavily on how densely the source track
            is mixed. Bass and low guitar can bleed into each other since they
            occupy similar frequency ranges. Programmed drums with heavy
            processing sometimes separate less cleanly than an acoustic kit.
            Live recordings with crowd noise or stage bleed give the model a
            messier signal than a controlled studio mix. None of this makes
            separation fail outright — it just tends to leave more audible
            traces behind on a dense or heavily processed mix than on a sparser,
            cleaner one.
          </p>
          <p className="text-text-muted leading-relaxed">
            GPU acceleration changes the infrastructure the separation runs on,
            not the difficulty of the underlying problem — source quality and
            arrangement still determine the final result.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common uses</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Sampling &amp; production:</strong>{" "}
              pull an isolated drum loop or bassline to build a new track around.
            </p>
            <p>
              <strong className="text-text-primary">Remixing:</strong> replace or
              rework individual elements instead of starting from a full
              instrumental.
            </p>
            <p>
              <strong className="text-text-primary">Practice &amp; study:</strong>{" "}
              isolate a bass or drum part to learn it note-for-note without the
              rest of the mix in the way.
            </p>
            <p>
              <strong className="text-text-primary">Mashups:</strong> combine
              stems from different tracks — a vocal from one, drums and bass
              from another.
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
                  // prefetch disabled on bulk tool links, matching
                  // /vocal-remover — four edge requests per route adds up on a
                  // grid that renders on every tool page.
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
          <p className="text-sm text-text-muted leading-relaxed">
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
      </main>
    </>
  );
}