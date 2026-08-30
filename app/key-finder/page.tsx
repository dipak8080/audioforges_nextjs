import type { Metadata } from "next";
import Link from "next/link";
import { KeyFinderForm } from "@/components/converter/KeyFinderForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getLimits } from "@/lib/api/limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. AIFF WAS MISSING FROM THE FORMAT LIST. Six formats named where
 *    allowed_audio_formats has seven, and KeyFinderForm's own accept string
 *    ends ".aiff" — so the tool takes AIFF and the page said it didn't. Same
 *    understatement found on /stems. It appeared in three places plus the meta
 *    description; all of them now render from the backend list.
 *
 * 2. A RAW APOSTROPHE IN JSX TEXT would fail lint: "How to find a song's key
 *    and BPM". Third page with this after /loudness-normalizer and
 *    /sample-rate-converter. `next build` doesn't run ESLint, so none of these
 *    ever surfaced.
 *
 * 3. THE RETENTION ANSWER WAS VAGUE, AND THE TRUE ANSWER IS BETTER. It said
 *    "AudioForges does not store or distribute uploaded tracks" — which never
 *    says deleted, the same hedge found on /audio-to-text.
 *
 *    This route is genuinely different from every other tool on the site:
 *    /analyze returns NUMBERS, not a file. There is no output to keep, no
 *    download link, nothing on disk after the response. That's a stronger
 *    privacy claim than any other page here can make, and it was being
 *    delivered as a hedge.
 *
 *    CONFIRMED 2026-08-30, and the real answer is stronger than the
 *    audio_tools shape it was inferred from. /analyze deletes the upload in an
 *    unconditional `finally` — success, a 400 on a corrupt file, or an
 *    unexpected 500, the file goes either way — and it deletes the trimmed
 *    analysis copy alongside it. Two files in, zero left.
 *
 *    The stronger part: /analyze creates NO JOB ROW. It's synchronous —
 *    upload, analyse, return JSON. So there is no output file, no job record,
 *    and nothing with a TTL. Every other tool's answer has a second half
 *    ("...and the result lasts an hour"); this one doesn't, and saying so
 *    plainly is the best privacy sentence on the site.
 *
 *    NOT added to the retention block, deliberately. It has no retention to
 *    describe, which is the point — a fifth JSON shape full of nulls would say
 *    less clearly than one sentence of prose.
 *
 * 5. ONLY THE FIRST 3 MINUTES ARE ANALYSED (ANALYSIS_MAX_SECONDS). The server
 *    writes a trimmed copy, analyses that, and deletes it. This was never
 *    stated, and it silently changed the meaning of an answer already on the
 *    page — see the accuracy FAQ below.
 *
 * 4. NO RATE LIMIT IS STATED, deliberately. /analyze has no RATE_LIMITS entry
 *    — KeyFinderForm's own comment records that getRetryAfterFallback returns
 *    its 300s default for it. Nothing to publish without inventing a number.
 */

const PAGE_TITLE = "Free Song Key & BPM Finder";
const PAGE_DESCRIPTION =
  "Find the musical key, BPM, tempo, and Camelot notation of any song online for free. Upload MP3, WAV, FLAC, AAC, M4A, OGG, or AIFF. No sign-up required.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  /*
    `keywords` removed — ignored by Google since 2009. Target terms kept for
    reference:
      key finder / bpm finder / key bpm finder / bpm checker
      song key finder / key and bpm finder / keyfinder / free key bpm finder
      camelot wheel finder / camelot notation / harmonic mixing
      find key of song / detect song key / song bpm detector
      music key detector / track key finder / tempo detector
      find bpm of song / detect tempo / dj key finder / harmonic mixing tool
  */
  alternates: { canonical: `${SITE_URL}/key-finder` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/key-finder`,
    siteName: "AudioForges",
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

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Key & BPM Finder", item: `${SITE_URL}/key-finder` },
  ],
};

// HowTo JSON-LD intentionally omitted: Google deprecated HowTo rich results
// on desktop (and mobile) as of Sept 2023 — no rich-result benefit, so we
// don't ship the schema. Same reasoning already applied on /youtube-key-finder.
// FAQPage schema is emitted by <FAQSection /> — do not duplicate it here.

export default async function KeyFinderPage() {
  const relatedTools = getRelatedTools("key-finder", 5);

  const limits = await getLimits();
  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Song Key & BPM Finder",
    url: `${SITE_URL}/key-finder`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Detect musical key of any song",
      "Detect BPM / tempo",
      "Camelot notation for harmonic mixing",
      `Accepts ${formatList}`,
      "No sign-up required",
      "Nothing to install",
    ],
  };

  const faqs = [
    {
      question: "What is Camelot notation?",
      answer:
        "A numbering system for musical keys (1A–12B) that maps every key onto a wheel where neighbours are harmonically compatible. Standard on Rekordbox, Serato, Traktor and Mixed In Key.",
    },
    {
      question: "Why does BPM matter for DJs?",
      answer: "Matching or beat-syncing BPM is what allows two tracks to play in time together.",
    },
    {
      question: "What's the difference between major and minor keys?",
      answer:
        "Major keys generally sound brighter and more resolved, while minor keys sound darker or more emotional. Every major key has a relative minor built from the same notes, which is why they share the same Camelot number with a different letter.",
    },
    {
      /*
        CORRECTED. Named six formats where the backend allows seven — AIFF was
        missing, and KeyFinderForm accepts it. Rendered from the backend list
        now, so it can't fall behind again.
      */
      question: "What file formats can I upload?",
      answer: `${formatList}, up to ${limits.maxUploadMb}MB per file.`,
    },
    {
      /*
        ADDED. Never stated anywhere, and it's the answer to a question people
        actually form: why does a nine-minute mix analyse as fast as a single?

        It's checkable, which is the whole argument this page makes — and a
        producer would rather know the analyser reads the first three minutes
        than wonder why a track with a long intro came back wrong.
      */
      question: "Does it analyse the whole track?",
      answer:
        "The first three minutes. The server makes a trimmed copy, analyses that, and deletes it — which is why a nine-minute mix comes back as fast as a three-minute single. For most music that's plenty, since key and tempo are established early. It matters when a track opens with a long intro that isn't representative: trim to a section with the harmony in it and analyse that instead.",
    },
    {
      question: "How long does key and BPM detection take?",
      answer:
        "Just a few seconds for most tracks — results appear as soon as analysis finishes, no waiting in a queue.",
    },
    {
      /*
        REWRITTEN. Said "AudioForges does not store or distribute uploaded
        tracks", which never actually says deleted.

        The real answer is stronger, and specific to this tool: analysis
        returns numbers, not a file. There's no download link and nothing
        written to disk, so unlike every other tool here there is no output to
        keep at all.
      */
      question: "Is my uploaded track stored or shared?",
      answer:
        "No. Your file is deleted as soon as analysis finishes — including if it fails, and including the temporary trimmed copy the analyser works from. Nothing is stored afterward: the key and BPM come back directly in the response, so there's no result file and nothing with an expiry. There are no accounts, so nothing is linked to you.",
    },
    {
      /*
        REWRITTEN. The old answer praised "full-length tracks" and listed "long
        drum-only intros" as one caveat among several. With ANALYSIS_MAX_SECONDS
        at 180 both readings were off:

        · length past three minutes buys nothing, because it is never read;
        · a long intro isn't a mild caveat, it's THE failure case — three
          minutes of drums means the analyser sees only drums.

        The page was delivering its most actionable warning as a shrug.
      */
      question: "What affects detection accuracy?",
      answer:
        "The first three minutes are what matter, since that's what gets analysed — so a track whose opening three minutes represent the song will read well, and one that opens with a long ambient or drum-only intro can read badly no matter how clear the rest is. If that's your track, trim to a section with the harmony in it and analyse that instead. Beyond the intro problem: consistent tempo and clear harmonic content help, while live recordings, heavy distortion, mid-track tempo changes and spoken-word audio all give the analysis less to lock onto.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Song Key &amp; BPM Finder
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload any song and instantly detect its musical key and tempo,
            free, no sign-up, nothing to install.
          </p>
        </header>

        <KeyFinderForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Instant", desc: "Results in a few seconds. No queue, no waiting." },
            { title: "Accurate", desc: "Key, BPM, and Camelot notation for confident mixing." },
            {
              title: "No sign-up",
              desc: `No account, no install. Up to ${limits.maxUploadMb}MB per file.`,
            },
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
          {/* The apostrophe here was raw, which fails
              react-hooks/no-unescaped-entities. */}
          <h2 className="text-2xl font-bold text-text-primary">
            How to find a song&apos;s key and BPM
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Analysis runs automatically — no settings to configure.</li>
            <li>Get the detected key, BPM, and Camelot code in a few seconds.</li>
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why key and BPM matter</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Every piece of tonal music sits in a <strong className="text-text-primary">key</strong> —
              a home note and scale the melody and chords are built around.{" "}
              <strong className="text-text-primary">BPM</strong> is how fast the track pulses.
              Together, they&apos;re the two numbers DJs and producers need before mixing,
              remixing, or layering two tracks.
            </p>
            <p>
              <strong className="text-text-primary">Harmonic mixing</strong> — blending
              tracks with compatible keys — is what separates a set that flows from
              one that clashes.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Major vs. minor keys</h2>
          <p className="text-text-muted leading-relaxed">
            A detected key is always either major or minor. Major keys
            generally read as brighter or more resolved; minor keys read as
            darker or more emotional. Every major key shares its exact notes
            with a relative minor key — which is exactly why they sit at the
            same Camelot number with a different letter (8A and 8B, for
            example), and why that pairing is always a safe harmonic move.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Understanding Camelot notation</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              The <strong className="text-text-primary">Camelot Wheel</strong> renames
              the 24 musical keys as numbers 1–12 followed by &quot;A&quot; (minor) or
              &quot;B&quot; (major). From any key, you can safely mix into the same
              number, the next number up, or the next number down.
            </p>
            <p>
              Want the full breakdown of how to use this for building a set?{" "}
              <Link href="/guides/camelot-wheel-harmonic-mixing" className="text-amber-400 hover:underline">
                Read The Camelot Wheel Explained: Harmonic Mixing for DJs
              </Link>.
            </p>
            <p>
              Once you&apos;ve got key and BPM tagged, the next step is
              grouping tracks by Camelot compatibility and ordering them for
              energy before you play.{" "}
              <Link href="/guides/dj-set-prep-checklist" className="text-amber-400 hover:underline">
                Read the 6-Step DJ Set Prep Checklist
              </Link>.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">What affects detection accuracy</h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              Key and BPM detection works best on clean, full-length tracks
              with a consistent tempo and clear harmonic content throughout.
            </p>
            <p>
              Live recordings, heavy distortion, songs with tempo changes
              mid-track, spoken-word audio, or long intros containing only
              drums give the analysis less to work with, which can reduce
              accuracy — there&apos;s simply less clear harmonic and rhythmic
              information for it to lock onto.
            </p>
            <p>
              If your recording has significant background noise, running it
              through the{" "}
              <Link href="/noise-remove" prefetch={false} className="text-amber-400 hover:underline">
                Noise Remover
              </Link>{" "}
              first can improve detection.
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

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}