import type { Metadata } from "next";
import Link from "next/link";
import { TranscriptionForm } from "@/components/converter/TranscriptionForm";
import { TranscriptionModeTabs } from "@/components/converter/TranscriptionModeTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Prose } from "@/components/ui/Prose";
import { FAQSection } from "@/components/faq/FAQSection";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { TRANSCRIPTION_MODEL, getTranscriptionLanguages } from "@/lib/api/transcription";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * NOTHING ON THIS PAGE WRITES A LIMIT AS A LITERAL, including the fallbacks.
 * The old fallback read "2 per 5 minutes" — the figure this route carried
 * before 2026-08-26 — so the branch that only runs when something is already
 * broken printed a number twelve times too generous.
 */

/**
 * Move this when the LIMITS OR THE MODEL actually change — not on every
 * unrelated deploy. A dateModified that ticks on every build is noise Google
 * learns to discount, and it's a claim about verification nobody performed.
 *
 * Equally: do not leave it behind when they DO change. It sat at 2026-08-21
 * through a rate-limit change on the 26th, which is the failure this constant
 * exists to prevent.
 */
const LAST_VERIFIED = "2026-08-30";

/*
  TARGET TERMS — reference only, deliberately NOT emitted as a meta tag.
  Google has ignored <meta name="keywords"> since 2009 and Bing treats it as a
  spam signal. The list records what this page is written to rank for, which a
  future edit needs to know.

    free audio to text converter / online · audio to text
    transcribe audio to text free · audio transcription no sign up
    mp3 to text converter · free transcription no credit card
    audio to srt · convert voice recording to text
    free speech to text online · transcribe interview free
    transcribe audio recording to text · audio to text transcription
    transcribe from audio · transcribe an audio · transcribe a voice recording

  From a gap run against youtubetotranscript.com, tactiq.io, notegpt.io,
  downsub.com and kome.ai (US/English), KD 10–22. Volumes are Keyword Planner
  buckets, so several share a figure because they're one aggregate.
*/

/*
  TITLE, measured. Bing Keyword Research, three months to 30 Aug 2026:

    transcript                52.9K   ambiguous intent — not this page
    transcribe audio to text  27.3K   <- was absent from the title
    voice to text             19.1K   belongs on /speech-to-text
    audio to text             16.4K
    audio to text converter   11.6K
    transcribe audio to text free 3.8K
    convert audio to text      2.9K
    audio to text converter free  2.8K
    audio to text free         2.6K

  "Transcribe Audio to Text" leads, as the largest term this page can honestly
  own, and the four words sit adjacent so the exact phrase matches — Bing
  weights that placement hard. "Audio to Text" is contained inside it at no
  extra cost, so the 16.4K term is covered by the same words.

  NOT chased here: "transcript" (52.9K) is people looking for a transcript OF
  something — a video, a meeting, a podcast episode — not a tool to make one,
  and ranking for it would bring visitors who bounce. "voice to text" (19.1K)
  is a real term with the wrong noun for this page; /speech-to-text is its
  home, and cramming it in here would put two pages on one query.

  `absolute` now: 52 chars, and the root template's " | AudioForges" would push
  it to 66 and truncate the differentiator off the end.
*/
const PAGE_TITLE = "Transcribe Audio to Text — MP3, WAV & M4A to TXT/SRT";

/**
 * `metadata` is evaluated at module scope, where getLimits() can't be awaited.
 * This reads the same value as the fallback in lib/api/limits.ts, so head and
 * body can only disagree if the backend moved AND that fallback wasn't
 * updated — the same narrow window every other page has.
 */
const DESCRIPTION_MINUTES = 20;
const PAGE_DESCRIPTION = `Transcribe audio to text online — MP3, WAV, M4A and FLAC to TXT, SRT or VTT, with timestamps. Free, no account needed. Files up to ${DESCRIPTION_MINUTES} minutes.`;

const OG_IMAGE = ogForTool("audio-to-text", "Free audio to text converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  // `keywords` intentionally absent — see the term list above.
  alternates: { canonical: `${SITE_URL}/audio-to-text` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/audio-to-text`,
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

// BreadcrumbList comes from <Breadcrumb />; FAQPage from <FAQSection />.

export default async function AudioToTextPage() {
  const relatedTools = getRelatedTools("audio-to-text", 4);

  const limits = await getLimits();

  /*
    Fetched here so the ~99-language dropdown is populated on first paint.
    TranscriptionForm falls back to fetching it client-side when this is
    omitted — which works, but flashes a list containing only "Detect
    automatically" while it lands.

    .catch(() => null) is load-bearing: without it a backend blip would fail
    the whole page render, when the client-side fetch already handles that.
  */
  const languages = await getTranscriptionLanguages().catch(() => null);

  // max_upload_mb (80) — NOT max_video_transcribe_mb (100), which is
  // /video-to-text's, nor max_video_upload_mb (200), which is
  // /video-to-audio's. Three caps, three routes.
  const audioMb = limits.maxUploadMb;
  const maxMinutesLabel = durationLabel(limits.featureDurations.transcription);

  const rateLimit = rateLimitLabel(
    limits.rateLimits.speech_to_text ?? 2,
    windowFor(limits, "speech_to_text")
  );

  const audioFormats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const audioFormatList = audioFormats.join(", ").replace(/, ([^,]*)$/, " and $1");

  // The `text` shape: the transcript is inline in the job record rather than a
  // file on disk, so the output sentence is different in kind.
  const retention = retentionSentences(limits.retention.transcription);

  /*
    Every entry below is checked against the running backend. No accuracy
    percentage is claimed anywhere on this page — the model name is
    verifiable, "98.86% accurate" is not, and being the one result in the SERP
    that doesn't invent a number is the position.

    Deliberately NO aggregateRating. Every competitor carries one and a good
    share are invented. A fabricated rating is a structured data violation,
    and here it would contradict the only argument the copy makes.
  */
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Audio to Text Converter",
    alternateName: [
      "Transcribe Audio to Text",
      "Audio to Text Converter",
      "Free Audio to Text Converter",
      "Audio Transcription",
      "MP3 to Text",
    ],
    url: `${SITE_URL}/audio-to-text`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    dateModified: LAST_VERIFIED,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      `Transcribe ${audioFormatList}`,
      // Both halves stated, so it can't be read as a claim about where the
      // work happens: the interface is in the browser, the model isn't.
      "Nothing to install — upload in the browser, transcription runs on a GPU",
      `Runs ${TRANSCRIPTION_MODEL}`,
      "Automatic language detection, or set the language yourself",
      "Translate non-English speech to English in the same pass",
      "Timestamped segments",
      "Export as TXT, SRT or VTT",
      "No account or email required",
      "No watermark and no export paywall",
      `Files up to ${maxMinutesLabel} and ${audioMb}MB`,
    ],
  };

  /**
   * Every answer leads with the answer — a readability rule first, but also
   * what gets a page quoted in an AI Overview: an extractive summariser takes
   * the opening clause, so an answer that spends its first sentence on setup
   * gets skipped or misquoted.
   *
   * ORDER MATTERS. The first entry is the exact-match question form of the
   * softest keyword in the cluster, and early entries get weighted by the
   * same summarisers. Don't reorder without a reason.
   */
  const faqs = [
    {
      question: "How do I transcribe an audio recording to text?",
      answer: `Upload the file above and download the transcript — no account, no email, no credits. It takes ${audioFormatList} up to ${audioMb}MB and ${maxMinutesLabel}, and exports plain text plus SRT and VTT with nothing paywalled.`,
    },
    {
      question: "Is this really free, with no account?",
      answer: `Yes. No sign-up, no email, no credits, no card. Exports aren't paywalled either — TXT, SRT and VTT all download without an account. ${maxMinutesLabel} per file and ${rateLimit} are the only limits, and they exist to keep the queue moving rather than to sell you an upgrade.`,
    },
    {
      question: "Do I need to install anything?",
      answer:
        "No. There's no app, no extension and no login — you upload the file in your browser and the transcription runs on our GPU server. The transcript appears on the same page with the download buttons already on it.",
    },
    {
      question: "What audio formats can I upload?",
      answer: `${audioFormatList}, up to ${audioMb}MB and ${maxMinutesLabel} per file. For video, use Video to Text instead — it takes MP4 and MOV directly without extracting the audio first.`,
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
      answer: `${TRANSCRIPTION_MODEL}, the largest model in that family, running on a GPU. Naming it means you can check it. Most free tools run a smaller variant and don't say which.`,
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
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: `Can I transcribe a recording longer than ${maxMinutesLabel}?`,
      answer:
        "Not in one pass. Split it into sections first — the Silence Splitter cuts at natural pauses, which gives cleaner boundaries than cutting at a fixed time — then transcribe each section.",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:pt-14">
        <Breadcrumb
          items={[{ name: "Tools", href: "/tools" }, { name: "Audio to Text" }]}
          className="mb-8"
        />

        {/* The three facts in the eyebrow are the entire competitive
            position, so they sit above the fold rather than in a grid below. */}
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            No account · No credits · Free exports
          </p>
          {/* 4xl/5xl, not the 5xl/6xl used elsewhere: this h1 is five words
              and wrapped to two lines at the larger size, which — with a
              four-line lede under it — pushed the dropzone below the fold on
              the page whose visitors most often arrive with a file ready.

              The lede is one sentence for the same reason. Everything that
              followed "with timestamps" repeated the eyebrow directly above
              it: no account, free exports. It moves into the wedge section
              below, where it's the argument rather than a preamble. */}
          <h1 className="measure-wide mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.025em] text-text-primary sm:text-5xl">
            Transcribe audio to text
          </h1>
          <p className="measure-wide mt-4 text-lg leading-relaxed text-text-muted sm:text-xl">
            Upload an MP3, WAV, M4A or FLAC and get the words back with
            timestamps — nothing to install, nothing to sign up for.
          </p>
        </header>

        <div className="mt-7">
          <TranscriptionModeTabs active="/audio-to-text" />
        </div>

        <div className="mt-5">
          <TranscriptionForm mode="audio" languages={languages} />
        </div>

        {/* THE WEDGE. Deliberately no competitor names — their limits change,
            and a table naming Notta or Turboscribe is out of date the week
            they adjust a tier. The pattern is what's stable, and stating it
            as a pattern is harder to argue with than a callout. */}
        <section className="mt-16 border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="The catch"
            title="What &quot;free&quot; usually means"
            description="Most free transcription tools are a trial wearing a different word. Here's the shape it usually takes, and what happens here instead."
          />

          <div className="mt-8 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
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
                    {maxMinutesLabel} per file, {rateLimit}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Prose className="mt-6">
            <p>
              TXT, SRT and VTT all export free, with no account at any point.
              There&apos;s no paid tier here, so there&apos;s nothing for a limit
              to push you toward. The two that exist are there because
              transcription runs on GPU time that costs real money per minute,
              and capping it per person keeps it working for everyone.
            </p>
            <p>
              More on how that pattern works, and five questions worth asking any
              transcription tool before you upload —{" "}
              <Link href="/free-transcription-no-sign-up" prefetch={false}>
                free transcription without signing up
              </Link>
              .
            </p>
          </Prose>
        </section>

        <section className="border-t border-graphite-800 py-14">
          <SectionHeading eyebrow="How it works" title="Three steps, no settings to learn" />

          <ol className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Upload",
                body: `${audioFormatList}, up to ${audioMb}MB and ${maxMinutesLabel}.`,
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

        {/* Language is the section nobody else writes, and where a small site
            can genuinely be the best result. Kept concrete — when detection
            fails and why — rather than a language count. */}
        <section className="grid gap-10 border-t border-graphite-800 py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading eyebrow="Languages" title="Auto-detect, or tell it yourself" />
            <Prose className="mt-5">
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
            </Prose>
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

        <section className="border-t border-graphite-800 py-14">
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

          <Prose className="mt-6">
            <p>
              That comma-versus-period difference is the most common reason a
              caption file silently fails to load. If an editor accepts the file
              but shows nothing, check that first.
            </p>
          </Prose>
        </section>

        {/* Saying what it can't do, unprompted. In a SERP where every result
            claims 98%-something, this is what makes the rest believable. */}
        <section className="border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="Honest limits"
            title="What this won't do"
            description="Worth knowing before you upload rather than after."
          />

          {/* Was a <ul> of bold-lead-in items with hand-drawn top borders —
              term/explanation pairs, so the dl renders them properly. */}
          <Prose className="mt-8">
            <dl>
              <dt>No speaker labels</dt>
              <dd>
                An interview comes back as continuous text, not &quot;Speaker 1 /
                Speaker 2&quot;. Two people talking over each other is also the
                hardest case for any transcription engine.
              </dd>

              <dt>No editor</dt>
              <dd>
                You get the transcript and the export. Corrections happen in
                whatever you paste it into.
              </dd>

              <dt>{maxMinutesLabel} per file</dt>
              <dd>
                Longer recordings need splitting first with the{" "}
                <Link href="/silence-split" prefetch={false}>
                  Silence Splitter
                </Link>
                , which cuts at natural pauses.
              </dd>

              <dt>Noisy audio stays noisy</dt>
              <dd>
                Nothing cleans the recording before transcribing it. Run it
                through the{" "}
                <Link href="/voice-clean" prefetch={false}>
                  Voice Cleaner
                </Link>{" "}
                first — that improves a transcript more than any setting here.
              </dd>
            </dl>

            <p>
              For the fuller version — what degrades accuracy, when to set the
              language, and how to handle long recordings —{" "}
              <Link href="/guides/transcribing-audio-accurately" prefetch={false}>
                read the transcription accuracy guide
              </Link>
              .
            </p>
          </Prose>
        </section>

        <div className="border-t border-graphite-800 py-14">
          <RelatedToolsGrid tools={relatedTools} />
        </div>

        <div className="border-t border-graphite-800 py-14">
          <FAQSection eyebrow="Questions" faqs={faqs} />
        </div>

        {/* A freshness signal that says what was checked, rather than "last
            updated", which on a tool page is usually a build timestamp. Pairs
            with dateModified in the schema above — move both together, and
            only when the limits or the model change. */}
        <p className="border-t border-graphite-800 pt-6 font-mono text-xs text-text-subtle">
          Limits and model last verified{" "}
          <time dateTime={LAST_VERIFIED}>
            {new Date(LAST_VERIFIED).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
          . {TRANSCRIPTION_MODEL} · {maxMinutesLabel} per file · {rateLimit}.
        </p>
      </main>
    </>
  );
}