import type { Metadata } from "next";
import Link from "next/link";
import { TranscriptionForm } from "@/components/converter/TranscriptionForm";
import { TranscriptionModeTabs } from "@/components/converter/TranscriptionModeTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { TRANSCRIPTION_MODEL, getTranscriptionLanguages } from "@/lib/api/transcription";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * The file already argued, correctly, that nothing here should write a limit
 * as a literal — and then wrote three anyway, in the places that are hardest
 * to notice.
 *
 * 1. THE FALLBACK WAS STALE, AND STALE IN THE GENEROUS DIRECTION.
 *    `getRateLimitLabel("speech-to-text") ?? "2 per 5 minutes"`. All three
 *    transcription routes moved to 2 per HOUR on 2026-08-26; the table was
 *    updated and the hand-written fallback beside it wasn't. The branch that
 *    only runs when something is already broken printed a figure twelve times
 *    too generous. Derived end-to-end now.
 *
 * 2. THE VERIFICATION DATE HAD GONE FALSE. LAST_VERIFIED said 2026-08-21 —
 *    five days before the rate limit changed underneath it. The footer
 *    publishes that date as a promise about the numbers above it, which is
 *    exactly why a stale one costs more than the figure it vouches for.
 *
 * 3. THE RETENTION ANSWER WAS THE VAGUEST SENTENCE ON THE PAGE. "The uploaded
 *    audio is processed and not retained as a personal file" doesn't say
 *    deleted — it's the shape of wording a company uses when the real answer
 *    is awkward. Here the real answer is BETTER: the input is deleted the
 *    moment the job ends, the transcript lives an hour as text in the job
 *    record, and nothing sits on disk afterwards at all. On a page whose whole
 *    argument is that it states real facts while competitors don't, that
 *    sentence was the weakest link.
 *
 * 4. "Runs online in the browser" appeared as a FEATURE claim beside a GPU
 *    model. Softer than the "everything happens in your browser" line already
 *    corrected on /stems, /vocal-remover and /video-to-audio, but the same
 *    ambiguity: the interface is in the browser, the transcription is not.
 *    Both halves stated now — it's still the answer to "do I install
 *    anything", and it's no longer arguable.
 *
 * 5. `keywords` moved out of metadata. Ignored by Google since 2009, treated
 *    as a spam signal by Bing. The list is preserved as a comment because it
 *    records what the page targets, which is worth keeping.
 */

/**
 * Move this when the LIMITS OR THE MODEL actually change — not on every
 * unrelated deploy. A dateModified that ticks on every build is noise
 * Google learns to discount, and it's a claim about verification that
 * nobody performed.
 *
 * Equally: do not leave it behind when they DO change. It sat at 2026-08-21
 * through a rate-limit change on the 26th, which is the failure this constant
 * exists to prevent.
 */
const LAST_VERIFIED = "2026-08-30";

/*
  TARGET TERMS — reference only, deliberately NOT emitted as a meta tag.
  Google has ignored `<meta name="keywords">` since 2009 and Bing treats it as
  a spam signal, so shipping it is at best inert. The list still records what
  this page is written to rank for, which a future edit needs to know.

    free audio to text converter
    free audio to text converter online
    audio to text
    transcribe audio to text free
    audio transcription no sign up
    mp3 to text converter
    free transcription no credit card
    audio to srt
    convert voice recording to text
    free speech to text online
    transcribe interview free

  From a gap run against youtubetotranscript.com, tactiq.io, notegpt.io,
  downsub.com and kome.ai (US/English) — natural-language phrasings, KD 10–22.
  Volumes in that dataset are Keyword Planner buckets, so several share an
  identical figure because they're one aggregate. Treat the block as one.

    transcribe audio recording to text
    audio to text transcription
    transcribe from audio
    transcribe an audio
    transcribe a voice recording
    audio transcribe to text
*/

// 39 chars, so 53 with the " | AudioForges" suffix — comfortably inside
// the SERP budget with the differentiator ("No Sign-Up") intact.
//
// "Online" was considered and left out. It would push the title to ~60
// and the only thing it could displace is "No Sign-Up", which is the
// actual differentiator in this SERP. The term is carried in the
// description and the body copy instead, which is enough for a modifier
// that broad.
const PAGE_TITLE = "Free Audio to Text Converter, No Sign-Up";

/**
 * `metadata` is evaluated at module scope, where getLimits() can't be awaited.
 * These read the same values as the fallback in lib/api/limits.ts, so the head
 * and the body can only disagree if the backend has moved AND that fallback
 * hasn't been updated — the same narrow window every other page has.
 */
const DESCRIPTION_MINUTES = 20;
const PAGE_DESCRIPTION = `Transcribe MP3, WAV, M4A and FLAC to text free online. No account, no email, no credits. Export TXT, SRT or VTT. Files up to ${DESCRIPTION_MINUTES} minutes.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // `keywords` intentionally absent — see the term list above.
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

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Audio to Text", item: `${SITE_URL}/audio-to-text` },
  ],
};

export default async function AudioToTextPage() {
  const relatedTools = getRelatedTools("audio-to-text", 4);

  const limits = await getLimits();

  /*
    Fetched here so the ~99-language dropdown is populated on first paint.
    TranscriptionForm falls back to fetching it client-side when this is
    omitted — which works, but flashes a list containing only "Detect
    automatically" while it lands, which is the degraded path that component
    was written to avoid.

    .catch(() => null) is load-bearing: without it a backend blip would fail
    the whole page render, when the client-side fetch already handles that
    case perfectly well.
  */
  const languages = await getTranscriptionLanguages().catch(() => null);

  // max_upload_mb (80) — NOT max_video_transcribe_mb (100), which is
  // /video-to-text's, nor max_video_upload_mb (200), which is
  // /video-to-audio's. Three caps, three routes.
  const audioMb = limits.maxUploadMb;
  const maxMinutesLabel = durationLabel(limits.featureDurations.transcription);

  // Derived end-to-end. The old fallback here read "2 per 5 minutes" — the
  // figure this route carried before 2026-08-26.
  const rateLimit = rateLimitLabel(
    limits.rateLimits.speech_to_text ?? 2,
    windowFor(limits, "speech_to_text")
  );

  const audioFormats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const audioFormatList = audioFormats.join(", ").replace(/, ([^,]*)$/, " and $1");

  // The `text` shape: the transcript is inline in the job record rather than a
  // file on disk, so the output sentence is different in kind.
  const retention = retentionSentences(limits.retention.transcription);

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
      `Transcribe ${audioFormatList}`,
      // Was "Runs online in the browser — nothing to install", listed as a
      // feature beside a GPU model. Both halves stated, so it can't be read
      // as a claim about where the work happens.
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
   * Every answer leads with the answer.
   *
   * That's a readability rule first, but it's also what gets a page quoted
   * in an AI Overview — an extractive summariser takes the opening clause,
   * so an answer that spends its first sentence setting up context gets
   * either skipped or misquoted. A site with no backlinks yet gets its
   * first impressions from those panels more often than from position 4.
   *
   * ORDER MATTERS HERE. The first entry is the exact-match question form
   * of the softest keyword in the cluster, and early entries get weighted
   * by the same summarisers. Don't reorder without a reason.
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
      // Same correction as the featureList entry: the interface is in the
      // browser, the transcription isn't, and saying both is no longer than
      // saying one.
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
      /*
        REWRITTEN. Said "processed and not retained as a personal file", which
        doesn't say deleted — it's the shape of wording used when the real
        answer is awkward. Here the real answer is stronger, so there was
        nothing to soften: the input goes the moment the job ends, the
        transcript is text in the job record for an hour, and nothing sits on
        disk afterwards.
      */
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 pb-16">
        {/* Hero — mono eyebrow above the h1, matching the homepage. The
            three facts in it are the entire competitive position, so they
            go above the fold rather than in a features grid below. */}
        <section className="pt-14 text-center sm:pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            No account · No credits · Free exports
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Free audio to text converter
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Transcribe an audio recording to text in a couple of minutes —
            upload an MP3, WAV, M4A or FLAC and get the words back, with
            timestamps. It works online with nothing to install and no account
            to make, and TXT, SRT and VTT all export free.
          </p>
        </section>

        <div className="mt-8 flex justify-center">
          <TranscriptionModeTabs active="/audio-to-text" />
        </div>

        <div className="mt-6">
          <TranscriptionForm mode="audio" languages={languages} />
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
                {maxMinutesLabel} per file.
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
          . {TRANSCRIPTION_MODEL} · {maxMinutesLabel} per file · {rateLimit}.
        </p>
      </main>
    </>
  );
}