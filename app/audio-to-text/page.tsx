import type { Metadata } from "next";
import Link from "next/link";
import { TranscriptionForm } from "@/components/converter/TranscriptionForm";
import { TranscriptionModeTabs } from "@/components/converter/TranscriptionModeTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { TRANSCRIPTION_LIMITS } from "@/lib/api/transcription";

/* ------------------------------------------------------------------ */
/* Limits — derived, never typed twice                                 */
/* ------------------------------------------------------------------ */
/**
 * NOTHING BELOW WRITES A LIMIT AS A LITERAL.
 *
 * These numbers used to appear seven times in this file as plain text —
 * in the meta description, four FAQ answers, the comparison table and
 * the "honest limits" list. Tightening the GPU budget meant finding all
 * seven, and missing one meant the page said 20 while the form said 10.
 *
 * That's not just a maintenance problem here. The entire position of
 * this page is "we tell you the real limit up front" — a stale number
 * in the SERP snippet doesn't make the page slightly out of date, it
 * makes the one claim the page rests on false on first contact.
 *
 * The meta description is the worst of the seven, because Google keeps
 * serving it for weeks after a deploy.
 */
const MAX_MINUTES = TRANSCRIPTION_LIMITS.durationSeconds / 60;
const AUDIO_MB = Math.round(TRANSCRIPTION_LIMITS.audioBytes / (1024 * 1024));
const RATE_LIMIT = getRateLimitLabel("speech-to-text") ?? "2 per 5 minutes";

/**
 * Move this when the LIMITS OR THE MODEL actually change — not on every
 * unrelated deploy. A dateModified that ticks on every build is noise
 * Google learns to discount, and it's a claim about verification that
 * nobody performed.
 */
const LAST_VERIFIED = "2026-08-21";

// 39 chars, so 53 with the " | AudioForges" suffix — comfortably inside
// the SERP budget with the differentiator ("No Sign-Up") intact.
//
// "Online" was considered and left out. It would push the title to ~60
// and the only thing it could displace is "No Sign-Up", which is the
// actual differentiator in this SERP. The term is carried in the
// description and the body copy instead, which is enough for a modifier
// that broad.
const PAGE_TITLE = "Free Audio to Text Converter, No Sign-Up";
const PAGE_DESCRIPTION = `Transcribe MP3, WAV, M4A and FLAC to text free online. No account, no email, no credits. Export TXT, SRT or VTT. Files up to ${MAX_MINUTES} minutes.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  keywords: [
    "free audio to text converter",
    "free audio to text converter online",
    "audio to text",
    "transcribe audio to text free",
    "audio transcription no sign up",
    "mp3 to text converter",
    "free transcription no credit card",
    "audio to srt",
    "convert voice recording to text",
    "free speech to text online",
    "transcribe interview free",
  ],
  alternates: { canonical: `${SITE_URL}/audio-to-text` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/audio-to-text`,
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

// Every entry below is checked against the running backend. No accuracy
// percentage is claimed anywhere on this page — the model name is
// verifiable, "98.86% accurate" is not, and being the one result in the
// SERP that doesn't invent a number is the position.
//
// Deliberately NO aggregateRating. Every competitor carries one and a
// good share of them are invented. A fabricated rating is a structured
// data violation, and on this page specifically it would contradict the
// only argument the copy makes.
const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio to Text Converter",
  alternateName: ["Free Audio to Text Converter", "Audio Transcription", "MP3 to Text"],
  url: `${SITE_URL}/audio-to-text`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  dateModified: LAST_VERIFIED,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Transcribe MP3, WAV, FLAC, M4A, AAC, OGG and AIFF",
    "Runs online in the browser — nothing to install",
    "Automatic language detection, or set the language yourself",
    "Translate non-English speech to English in the same pass",
    "Timestamped segments",
    "Export as TXT, SRT or VTT",
    "No account or email required",
    "No watermark and no export paywall",
    `Files up to ${MAX_MINUTES} minutes and ${AUDIO_MB}MB`,
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio to Text", item: `${SITE_URL}/audio-to-text` },
  ],
};

/**
 * Every answer leads with the answer.
 *
 * That's a readability rule first, but it's also what gets a page quoted
 * in an AI Overview — an extractive summariser takes the opening clause,
 * so an answer that spends its first sentence setting up context gets
 * either skipped or misquoted. A site with no backlinks yet gets its
 * first impressions from those panels more often than from position 4.
 */
const faqs = [
  {
    question: "Is this really free, with no account?",
    answer: `Yes. No sign-up, no email, no credits, no card. Exports aren't paywalled either — TXT, SRT and VTT all download without an account. ${MAX_MINUTES} minutes per file and ${RATE_LIMIT} are the only limits, and they exist to keep the queue moving rather than to sell you an upgrade.`,
  },
  {
    question: "Do I need to install anything?",
    answer:
      "No. It runs online in the browser — there's no app, no extension and no login. Upload the file, wait, and the transcript appears on the same page with the download buttons already on it.",
  },
  {
    question: "What audio formats can I upload?",
    answer: `MP3, WAV, FLAC, M4A, AAC, OGG and AIFF, up to ${AUDIO_MB}MB and ${MAX_MINUTES} minutes per file. For video, use Video to Text instead — it takes MP4 and MOV directly without extracting the audio first.`,
  },
  {
    question: "How long does a transcript take?",
    answer:
      "Usually under a minute. The transcription server spins down when idle, so the first run after a quiet period spends about a minute starting up — which means a 30-second voice memo and a 10-minute podcast often take roughly the same wall time. Once it's warm, most files come back in seconds.",
  },
  {
    question: "How accurate is it?",
    answer:
      "It depends far more on your recording than on the tool. Clean speech with one speaker close to a microphone comes back near-perfect; a phone recording of a meeting from across a table won't. We don't publish an accuracy percentage because a single number across every language, accent and recording condition wouldn't mean anything — and nobody publishing one shows their methodology.",
  },
  {
    question: "What model does this use?",
    answer:
      "Whisper large-v3, the largest model in that family, running on a GPU. Naming it means you can check it. Most free tools run a smaller variant and don't say which.",
  },
  {
    question: "Do I have to pick the language?",
    answer:
      "No — it's detected automatically. Setting it yourself helps for clips under about thirty seconds, heavy accents, or audio that mixes two languages, since detection works from the opening seconds.",
  },
  {
    question: "Can I get an English transcript from another language?",
    answer:
      "Yes — choose English output and it translates as it transcribes, in one pass, at no extra cost. English is the only translation target available.",
  },
  {
    question: "What's the difference between TXT, SRT and VTT?",
    answer:
      "TXT is the words with no timing, for reading and searching. SRT and VTT are timed caption formats — SRT for video editors and most upload forms, VTT for HTML5 video on the web. All three are free to export.",
  },
  {
    question: "Are my files kept after transcription?",
    answer:
      "The uploaded audio is processed and not retained as a personal file, and there's no account for anything to be attached to. Jobs expire an hour after they're created.",
  },
  {
    question: `Can I transcribe a recording longer than ${MAX_MINUTES} minutes?`,
    answer:
      "Not in one pass. Split it into sections first — the Silence Splitter cuts at natural pauses, which gives cleaner boundaries than cutting at a fixed time — then transcribe each section.",
  },
];

export default function AudioToTextPage() {
  const relatedTools = getRelatedTools("audio-to-text", 4);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 pb-16">
        {/* Hero — mono eyebrow above the h1, matching the homepage. The
            three facts in it are the entire competitive position, so they
            go above the fold rather than in a features grid below.

            The body paragraph now names the formats and says "online".
            Both were previously only in the meta description and the FAQ,
            which meant the first hundred words of actual page copy
            carried neither — and "online" is a separate query with its
            own volume rather than a synonym Google folds in for free. */}
        <section className="pt-14 text-center sm:pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            No account · No credits · Free exports
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Free audio to text converter
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Upload an MP3, WAV, M4A or FLAC and get the words back, with
            timestamps. It runs online in your browser — nothing to install, no
            account to make — and TXT, SRT and VTT all export free.
          </p>
        </section>

        <div className="mt-8 flex justify-center">
          <TranscriptionModeTabs active="/audio-to-text" />
        </div>

        <div className="mt-6">
          <TranscriptionForm mode="audio" />
        </div>

        {/* THE WEDGE.
            Deliberately no competitor names — their limits change, and a
            table that names Notta or Turboscribe is out of date the week
            they adjust a tier. The pattern is what's stable, and stating
            it as a pattern is harder to argue with than a callout. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="The catch"
            title="What &quot;free&quot; usually means"
            description="Most free transcription tools are a trial wearing a different word. Here's the shape it usually takes, and what happens here instead."
          />

          <div className="mt-8 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">&nbsp;</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Typically</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Here</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Account</td>
                  <td className="px-4 py-3">Email required after the first file</td>
                  <td className="px-4 py-3 text-text-primary">Never</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Free allowance</td>
                  <td className="px-4 py-3">Credits or minutes that run out</td>
                  <td className="px-4 py-3 text-text-primary">No credits, no total cap</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Downloading it</td>
                  <td className="px-4 py-3">Export is the paid feature</td>
                  <td className="px-4 py-3 text-text-primary">TXT, SRT and VTT, free</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Accuracy claim</td>
                  <td className="px-4 py-3">A precise-sounding percentage</td>
                  <td className="px-4 py-3 text-text-primary">The model name, so you can check</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">The real limit</td>
                  <td className="px-4 py-3">Discovered when you hit it</td>
                  <td className="px-4 py-3 text-text-primary">
                    {MAX_MINUTES} min per file, {RATE_LIMIT}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 leading-relaxed text-text-muted">
            There&apos;s no paid tier here, so there&apos;s nothing for a limit
            to push you toward. The two that exist are there because
            transcription runs on GPU time that costs real money per minute,
            and capping it per person keeps it working for everyone.
          </p>

          <p className="mt-4 leading-relaxed text-text-muted">
            More on how that pattern works, and five questions worth asking any
            transcription tool before you upload —{" "}
            <Link
              href="/free-transcription-no-sign-up"
              prefetch={false}
              className="text-amber-400 hover:underline"
            >
              free transcription without signing up
            </Link>
            .
          </p>
        </section>

        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading eyebrow="How it works" title="Three steps, no settings to learn" />

          <ol className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload",
                body: `MP3, WAV, FLAC, M4A, AAC, OGG or AIFF, up to ${AUDIO_MB}MB and ${MAX_MINUTES} minutes.`,
              },
              {
                step: "02",
                title: "Set the language",
                body: "Or leave it on auto-detect, which handles clear single-language audio fine.",
              },
              {
                step: "03",
                title: "Read or export",
                body: "Click any line to hear it. Copy the text, or download TXT, SRT or VTT.",
              },
            ].map((item) => (
              <li key={item.step} className="border-t border-graphite-800 pt-4">
                <p className="font-mono text-xs text-amber-500">{item.step}</p>
                <h3 className="mt-2 font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Language is the section nobody else writes, and it's where a
            small site can genuinely be the best result. Kept concrete —
            when detection fails and why — rather than a language count. */}
        <section className="grid gap-10 border-t border-graphite-800 py-12 sm:py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading eyebrow="Languages" title="Auto-detect, or tell it yourself" />
            <div className="mt-5 space-y-3 leading-relaxed text-text-muted">
              <p>
                Detection reads the opening seconds of the audio, which is
                exactly why it fails in predictable ways. A thirty-second clip
                gives it little to work with. A recording that opens in English
                before switching languages gets labelled English. Two languages
                alternating throughout get whichever came first.
              </p>
              <p>
                Setting the language yourself removes the guess entirely, and
                costs nothing — same model either way. It&apos;s worth doing for
                short clips, strong accents, and mixed-language audio.
                Whisper&apos;s larger models are also noticeably stronger on
                lower-resource languages than the smaller ones most free tools
                run, which matters if you&apos;re working in Nepali, Hindi,
                Bengali or Urdu.
              </p>
              <p>
                Non-English audio can also come back as English. Choosing
                English output translates as it transcribes, in one pass — you
                don&apos;t transcribe first and translate after.
              </p>
            </div>
          </div>

          <dl className="divide-y divide-graphite-800 border-y border-graphite-800 lg:col-span-5 lg:self-start">
            {[
              ["Detect automatically", "Clear speech, one language, over a minute."],
              ["Set it manually", "Short clips, heavy accents, two languages mixed."],
              ["Translate to English", "Any source language. English is the only target."],
            ].map(([term, description]) => (
              <div key={term} className="py-4">
                <dt className="font-medium text-text-primary">{term}</dt>
                <dd className="mt-0.5 text-sm text-text-muted">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="Exports"
            title="TXT, SRT or VTT"
            description="Same words in all three. What differs is whether timing travels with them, and how it's written."
          />

          <div className="mt-8 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Format</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Use it for</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Timing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-mono text-text-primary">TXT</td>
                  <td className="px-4 py-3">Reading, searching, pasting into notes</td>
                  <td className="px-4 py-3">None</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-text-primary">SRT</td>
                  <td className="px-4 py-3">Video editors, YouTube, most caption uploads</td>
                  <td className="px-4 py-3">Numbered blocks, comma before ms</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-text-primary">VTT</td>
                  <td className="px-4 py-3">HTML5 video, via a &lt;track&gt; element</td>
                  <td className="px-4 py-3">WEBVTT header, period before ms</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 leading-relaxed text-text-muted">
            That comma-versus-period difference is the most common reason a
            caption file silently fails to load. If an editor accepts the file
            but shows nothing, check that first.
          </p>
        </section>

        {/* Saying what it can't do, on the page, unprompted. In a SERP
            where every result claims 98%-something, this is the section
            that makes the rest of the page believable. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="Honest limits"
            title="What this won't do"
            description="Worth knowing before you upload rather than after."
          />

          <ul className="mt-8 space-y-3 leading-relaxed text-text-muted">
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">No speaker labels.</strong> An
              interview comes back as continuous text, not &quot;Speaker 1 /
              Speaker 2&quot;. Two people talking over each other is also the
              hardest case for any transcription engine.
            </li>
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">No editor.</strong> You get
              the transcript and the export. Corrections happen in whatever you
              paste it into.
            </li>
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">
                {MAX_MINUTES} minutes per file.
              </strong>{" "}
              Longer recordings need splitting first with the{" "}
              <Link href="/silence-split" prefetch={false} className="text-amber-400 hover:underline">
                Silence Splitter
              </Link>
              , which cuts at natural pauses.
            </li>
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">Noisy audio stays noisy.</strong>{" "}
              Nothing cleans the recording before transcribing it. Run it
              through the{" "}
              <Link href="/voice-clean" prefetch={false} className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              first — that improves a transcript more than any setting here.
            </li>
          </ul>

          <p className="mt-6 leading-relaxed text-text-muted">
            For the fuller version — what degrades accuracy, when to set the
            language, and how to handle long recordings —{" "}
            <Link
              href="/guides/transcribing-audio-accurately"
              prefetch={false}
              className="text-amber-400 hover:underline"
            >
              read the transcription accuracy guide
            </Link>
            .
          </p>
        </section>

        {relatedTools.length > 0 && (
          <section className="border-t border-graphite-800 py-12 sm:py-14">
            <SectionHeading eyebrow="Next" title="More free tools" />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {relatedTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/${tool.slug}`}
                  prefetch={false}
                  className="group relative block overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-5 transition-colors duration-200 hover:border-amber-500/40 hover:bg-graphite-850 focus:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-amber-500 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
                  />
                  <h3 className="font-semibold text-text-primary transition-colors group-hover:text-amber-400">
                    {tool.name}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    {tool.shortDescription}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="border-t border-graphite-800 py-12 sm:py-14">
          <FAQSection eyebrow="Questions" faqs={faqs} />
        </div>

        {/* A freshness signal that says what was checked rather than
            "last updated", which on a tool page means nothing and is
            usually a build timestamp. Every result in this SERP shows a
            recent date; this one is at least true. Pairs with
            dateModified in the WebApplication schema above — move both
            together, and only when the limits or the model change. */}
        <p className="border-t border-graphite-800 pt-6 font-mono text-xs text-text-subtle">
          Limits and model last verified{" "}
          <time dateTime={LAST_VERIFIED}>
            {new Date(LAST_VERIFIED).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          . Whisper large-v3 · {MAX_MINUTES} min per file · {RATE_LIMIT}.
        </p>
      </main>
    </>
  );
}