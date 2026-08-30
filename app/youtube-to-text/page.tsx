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

/* ==================================================================== */
/* TARGETING — READ THIS BEFORE EDITING THE COPY                        */
/* ==================================================================== */
/**
 * THIS PAGE DELIBERATELY DOES NOT CHASE "youtube transcript".
 *
 * That term carries >10,000 volume and every result on it — extensions,
 * free web tools, the lot — reads YouTube's EXISTING caption track from
 * the timedtext endpoint. Instant, any length, zero compute cost.
 *
 * We download the audio and run Whisper on a GPU: ~90s cold start, a
 * hard length cap, and a tight rate limit. For a video that already has
 * captions we are strictly worse than the free extension ranking above
 * us. Ranking for the head term would buy bounces.
 *
 * So the page targets the cluster where we are the ONLY answer — videos
 * with captions disabled, languages YouTube won't auto-caption, and
 * auto-captions that are visibly wrong. Lower volume, genuinely
 * winnable, and every visitor who arrives is one the tool actually
 * serves.
 *
 * ── NOT CHASING THE TERM ISN'T THE SAME AS OMITTING IT ────────────────
 *
 * The title carries "YouTube transcript" as an ENTITY. The qualifier
 * that follows it is what keeps the page off the head intent — someone
 * who just wants to read the captions of a captioned video reads
 * "Even Without Captions" and self-selects out, which is the whole
 * point.
 *
 * Being absent from the entity entirely was the earlier mistake: it
 * cost the match without buying any protection from the wrong intent,
 * and it made the title read as a restriction on the tool ("only works
 * when captions are off") rather than a capability.
 *
 * ── THE REAL FIX IS A BACKEND CHANGE ──────────────────────────────────
 *
 * TODO(dipak): caption fast path. On submit, ask YouTube whether a
 * caption track exists (yt-dlp already exposes --list-subs, and we shell
 * out to it anyway). If one does, return it immediately — instant, any
 * length, no GPU, no rate limit. Fall back to Whisper only when there
 * isn't one.
 *
 * That flips every disadvantage at once: instant on the common case,
 * still works on the case extensions can't touch, and GPU spend drops to
 * only the hard requests. It would make us the one tool on that SERP
 * that handles both, which is the point at which competing for the head
 * term stops being a bad idea.
 *
 * It's also the only route to the volume that actually exists here. A
 * gap run against youtubetotranscript.com, tactiq.io, notegpt.io,
 * downsub.com and kome.ai returned nothing in the captions-disabled
 * cluster worth targeting — that cluster is small because it genuinely
 * is small. The volume sits on "transcription youtube" (~110k) and
 * "transcript youtube videos" (~22k), and both are head-intent terms
 * this page can't serve until the fast path ships.
 *
 * When it ships: widen the title toward the head term, rewrite the
 * hero, and drop the length caveat from the comparison table — captions
 * have no length limit.
 */

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * Third of the transcription trio, and it carried the same two faults as the
 * other two plus one of its own.
 *
 * 1. THE FALLBACK WAS STALE AND TOO GENEROUS. `?? "2 per 5 minutes"` against a
 *    limit that moved to 2 per hour on 2026-08-26. All three routes changed in
 *    one commit; all three tables were updated; none of the three fallbacks
 *    were. Derived end-to-end now.
 *
 * 2. LAST_VERIFIED SAT AT 2026-08-21, five days before that change. The footer
 *    publishes it as a promise about the numbers above it.
 *
 * 3. NO RETENTION ANSWER, and this is the route where the shared helper
 *    doesn't fit. retentionSentences().input says "your upload is deleted…" —
 *    but nothing is uploaded here. The user sends a URL and the server fetches
 *    the audio itself, so that sentence describes something that never
 *    happened. The output half is identical to the other two and comes from
 *    the helper unchanged; the input half is written for this route, with the
 *    stronger fact stated first: what you send is a link, not a file.
 *
 * 4. `keywords` moved out of metadata — ignored by Google since 2009, treated
 *    as a spam signal by Bing. The list is preserved as a comment because the
 *    targeting reasoning above depends on knowing what it contains.
 */

const PUBLISHED: string = "2026-08-20";
/** Move ONLY after re-checking the limits and the model. It sat at 2026-08-21
 *  through a rate-limit change on the 26th — the exact failure it exists to
 *  prevent. */
const LAST_VERIFIED: string = "2026-08-30";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/*
  TARGET TERMS — reference only, deliberately NOT emitted as a meta tag.

  The winnable cluster, first:
    youtube transcript captions disabled
    transcript from youtube video without captions
    youtube video no subtitles transcript
    youtube auto captions wrong
    transcribe youtube video free

  Entity terms — present in the copy, not targeted. See the note above:
    youtube to text
    youtube transcript
    youtube to srt
    youtube transcript no sign up
    get transcript from youtube video

  Head terms surfaced by the gap run. Recorded as targeting HISTORY, not as a
  claim this page can win them — see the fast-path TODO. Revisit both when it
  ships:
    transcription youtube          (~110k)
    transcript youtube videos      (~22k)
*/

// 46 chars → 60 with the " | AudioForges" suffix, which sits right at
// the desktop truncation edge (~580px). "Captions" is the at-risk word
// and it's also the differentiator, so check a live SERP snippet after
// this indexes. If it's cutting, drop "Even":
// "Free YouTube Transcript Without Captions" is 40 → 54 and renders
// guaranteed, at the cost of some of the phrasing's warmth.
const PAGE_TITLE = "Free YouTube Transcript, Even Without Captions";

/**
 * `metadata` is evaluated at module scope, where getLimits() can't be awaited.
 * This matches the fallback in lib/api/limits.ts, so head and body can only
 * disagree if the backend moved AND that fallback wasn't updated.
 */
const DESCRIPTION_MINUTES = 20;
const PAGE_DESCRIPTION = `Free YouTube transcript with no account or extension. It reads the audio, so it works even when captions are disabled. Export TXT, SRT or VTT, up to ${DESCRIPTION_MINUTES} min.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // `keywords` intentionally absent — see the term list above.
  alternates: { canonical: `${SITE_URL}/youtube-to-text` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/youtube-to-text`,
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
    { "@type": "ListItem", position: 2, name: "YouTube to Text", item: `${SITE_URL}/youtube-to-text` },
  ],
};

export default async function YouTubeToTextPage() {
  const relatedTools = getRelatedTools("youtube-to-text", 4);

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

  const maxMinutesLabel = durationLabel(limits.featureDurations.transcription);

  // Derived end-to-end. The old fallback read "2 per 5 minutes".
  const rateLimit = rateLimitLabel(
    limits.rateLimits.youtube_transcribe ?? 2,
    windowFor(limits, "youtube_transcribe")
  );

  /*
    OUTPUT half only. retentionSentences().input opens "Your upload is
    deleted…" and there is no upload on this route — the user sends a link and
    the server fetches the audio. Using it unchanged would describe something
    that never happened, which on a privacy answer reads as boilerplate.
  */
  const retention = retentionSentences(limits.retention.transcription);

  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "YouTube to Text Transcript Generator",
    alternateName: ["YouTube Transcript Generator", "YouTube to SRT", "YouTube Video to Text"],
    url: `${SITE_URL}/youtube-to-text`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript.",
    dateModified: LAST_VERIFIED,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Transcribe a YouTube video from its link",
      "Works on videos with captions disabled — it reads the audio",
      `Runs ${TRANSCRIPTION_MODEL} on a GPU`,
      "Automatic language detection, or set the language yourself",
      "Translate non-English speech to English in the same pass",
      "Timestamped segments",
      "Export as TXT, SRT or VTT",
      "No account, no email, no browser extension",
      `Videos up to ${maxMinutesLabel}`,
    ],
  };

  /**
   * Plain strings only.
   *
   * The old "Is this free" entry carried both `answer` and `answerNode`,
   * on the assumption FAQSection renders the node. If it doesn't, the link
   * inside it never appeared and nobody would notice — the plain answer
   * renders and looks fine. Rather than depend on that, the internal link
   * lives in body copy where it's visible either way.
   *
   * Every answer opens with the answer: extractive summarisers take the
   * first clause, and AI panels are where a page with no backlinks gets
   * its first impressions.
   */
  const faqs = [
    {
      question: "Can I get a transcript if captions are turned off?",
      answer:
        "Yes — this transcribes the audio directly, so it doesn't depend on whether a caption track exists. That's the one thing browser extensions and most free transcript sites can't do: they read YouTube's existing captions, so when the creator disables them there's nothing for those tools to read.",
    },
    {
      question: "Doesn't YouTube already show a transcript?",
      answer:
        "Often, yes — under the video, via the three-dot menu, and that's the faster route when it's there and you only need to read it. It falls short when the creator disabled captions, when the language isn't one YouTube auto-captions, when you want a downloadable SRT rather than text you have to clean up by hand, or when the auto-captions are visibly wrong.",
    },
    {
      question: "The auto-captions are wrong. Can I get a better transcript?",
      answer: `Sometimes, and it's worth comparing. YouTube's auto-captions and this run on different systems — ours is ${TRANSCRIPTION_MODEL} — so on accented speech, technical vocabulary or music under the voice they often disagree. Neither is authoritative. Having two independent passes to compare is more useful than either side claiming an accuracy percentage.`,
    },
    {
      question: "Do I need to download the video or install an extension?",
      answer:
        "Neither. Paste the link and that's it — nothing is downloaded to your device, and there's no extension, no add-on and no permissions to grant.",
    },
    {
      question: `Can I transcribe a video longer than ${maxMinutesLabel}?`,
      answer: `Not in one pass — ${maxMinutesLabel} is the per-video limit, which rules out most full podcasts and long-form talks. The workaround is to convert the video to audio, split it at natural pauses, and transcribe each section. If the video does have captions, YouTube's own transcript panel has no length limit and is the better route for something that long.`,
    },
    {
      question: "Can I get SRT subtitles from a YouTube video?",
      answer:
        "Yes — SRT and VTT both download free, alongside plain text. YouTube's own transcript panel has no download button for viewers, which is usually why people end up here.",
    },
    {
      question: "Does it work with Shorts and youtu.be links?",
      answer:
        "Yes — standard watch links, youtu.be short links, and /shorts URLs are all accepted. Private, deleted, and region-blocked videos aren't accessible.",
    },
    {
      question: "Can I get an English transcript from a video in another language?",
      answer:
        "Yes — choose English output and it translates as it transcribes, in one pass. English is the only translation target available.",
    },
    {
      question: "Is this free, and is there an account?",
      answer: `Free, with no account, no email and no credits. Exports aren't paywalled. The limits are ${maxMinutesLabel} per video and ${rateLimit}, and they exist to keep the queue moving — there's no paid tier to upgrade to.`,
    },
    {
      /*
        ADDED, and written for this route rather than taken from the shared
        helper. The input sentence there begins "Your upload is deleted…" and
        nothing is uploaded here — the strongest true fact is that what leaves
        your browser is a link, not a file. The output half is the helper's,
        unchanged, because that part is identical across all three
        transcription routes.
      */
      question: "What happens to the video and the transcript?",
      answer: `Nothing is uploaded from your device — you send a link, and the audio is fetched server-side. That downloaded audio is deleted as soon as the transcript is finished, whether the job succeeded or failed. ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Can I use a YouTube transcript I generate here?",
      answer:
        "That depends on the video and what you're doing with it. Transcribing someone else's video for personal reference, accessibility, study or quotation is generally reasonable; republishing the transcript as your own content is not. You're responsible for how you use it.",
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
        {/* H1 says "with or without" rather than "even with captions off".
            Same fact, but phrased as a capability instead of a condition
            — the old wording read as a restriction on the tool, which is
            the opposite of what it does. */}
        <section className="pt-14 text-center sm:pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            No account · No extension · Free SRT
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Free YouTube transcript, with or without captions
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Paste a link and get the words back with timestamps, free and with no
            account. This reads the audio rather than YouTube&apos;s caption track,
            so it works on videos where the transcript panel and every browser
            extension come back empty.
          </p>
        </section>

        <div className="mt-8 flex justify-center">
          <TranscriptionModeTabs active="/youtube-to-text" />
        </div>

        <div className="mt-6">
          <TranscriptionForm mode="youtube" languages={languages} />
        </div>

        {/* THE SECTION THIS PAGE LIVES OR DIES ON.
            YouTube's own transcript panel is the real competitor here, not
            other tools, and a reader who remembers it exists while reading
            a page that never mentions it will bounce. Naming it first and
            saying plainly when it's the better option is what buys the
            right to explain when it isn't — and it's also just true. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="Start here"
            title="If the video has captions, YouTube is faster"
            description="Open the video, click the three dots under it, choose Show transcript. If that works and you only need to read it, you're done — close this tab, no tool required."
          />

          <div className="mt-6 space-y-3 leading-relaxed text-text-muted">
            <p>
              Worth saying first, because most pages competing for this search
              quietly hope you&apos;ve forgotten it exists. The same goes for
              the extensions — they read that same caption track, which is why
              they&apos;re instant and why they fail in exactly the same places
              YouTube does.
            </p>
            <p>
              This tool takes a different route. It downloads the audio and
              transcribes it with {TRANSCRIPTION_MODEL}, which is slower and
              capped at {maxMinutesLabel} — and which works in four
              situations where reading the caption track gets you nothing:
            </p>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Situation</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    YouTube&apos;s panel &amp; extensions
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">Here</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">Captions disabled by the creator</td>
                  <td className="px-4 py-3">Nothing to read</td>
                  <td className="px-4 py-3 text-text-primary">Works — reads the audio</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Language YouTube doesn&apos;t auto-caption</td>
                  <td className="px-4 py-3">Nothing generated</td>
                  <td className="px-4 py-3 text-text-primary">Around 100 languages</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Auto-captions are visibly wrong</td>
                  <td className="px-4 py-3">Copies the same mistakes</td>
                  <td className="px-4 py-3 text-text-primary">Independent second pass</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">You need a subtitle file</td>
                  <td className="px-4 py-3">No download for viewers</td>
                  <td className="px-4 py-3 text-text-primary">SRT or VTT, free</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Video is over {maxMinutesLabel}</td>
                  <td className="px-4 py-3 text-text-primary">No length limit</td>
                  <td className="px-4 py-3">Rejected — see below</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 leading-relaxed text-text-muted">
            That last row is a real loss, not a hedge. On a long video that
            already has captions, YouTube&apos;s panel wins outright and this
            page is the wrong tool. Saying so is cheaper than letting you find
            out at an error message — and it&apos;s the same reasoning behind{" "}
            <Link
              href="/free-transcription-no-sign-up"
              prefetch={false}
              className="text-amber-400 hover:underline"
            >
              what &quot;free&quot; usually means in this category
            </Link>
            .
          </p>
        </section>

        {/* The quality case. Distinct from the availability case above —
            this is for people whose captions exist and are wrong, which is
            its own search intent and one no caption-reading tool can
            serve by construction. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="When the auto-captions are wrong"
            title="A second opinion, not a verdict"
            description="Auto-captions mangle names, jargon and accented speech, and they get worse with music under the voice. Reading them from a different tool gets you the same mistakes."
          />

          <div className="mt-6 space-y-3 leading-relaxed text-text-muted">
            <p>
              Every browser extension and free transcript site is reading the
              same caption track YouTube already generated. If that track is
              wrong, all of them are wrong in identical ways — there is nothing
              in that pipeline that could disagree.
            </p>
            <p>
              This runs {TRANSCRIPTION_MODEL} over the audio independently, so
              where the two disagree you have something to compare. Neither is
              authoritative and we&apos;re not going to claim ours is: two
              independent passes on a difficult name is genuinely more useful
              than one confident number from either side.
            </p>
            <p>
              What actually decides accuracy is the recording, not the tool. A
              studio podcast transcribes near-perfectly on both. A handheld
              phone in a busy room is hard for everything.
            </p>
          </div>
        </section>

        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading eyebrow="How it works" title="Paste, wait, export" />

          <ol className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Paste the link",
                body: "Watch links, youtu.be and Shorts all work. Nothing downloads to your device.",
              },
              {
                step: "02",
                title: "Set the language",
                body: "Or leave it on auto-detect. Set it for short clips and mixed-language videos.",
              },
              {
                step: "03",
                title: "Read or export",
                body: "Copy the text, or download TXT, SRT or VTT — no account at any point.",
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

        {/* The length cap is the single most likely reason someone leaves
            this page unhappy — podcasts and talks are the obvious use case
            and almost all of them exceed it. Better to own it with a
            working route through three other tools than to let them find
            out at the error message. */}
        <section className="grid gap-10 border-t border-graphite-800 py-12 sm:py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading
              eyebrow="Long videos"
              title={`Past ${maxMinutesLabel}, there's a longer route`}
            />
            <div className="mt-5 space-y-3 leading-relaxed text-text-muted">
              <p>
                {maxMinutesLabel} covers most interviews, lectures and music
                videos. It does not cover a two-hour podcast, and pretending
                otherwise would just waste your time — a longer link is
                rejected rather than half-transcribed.
              </p>
              <p>
                If the video has captions, stop here and use YouTube&apos;s own
                transcript panel; it has no length limit. If it doesn&apos;t,
                the workaround runs through three other tools here and takes a
                few minutes: pull the audio out of the video, split it at
                natural pauses so no sentence is cut in half, then transcribe
                each section. Timestamps restart at zero in each piece, so
                joining plain text is easy while building one continuous
                caption file means adding each section&apos;s offset.
              </p>
            </div>
          </div>

          <ol className="divide-y divide-graphite-800 border-y border-graphite-800 lg:col-span-5 lg:self-start">
            {[
              {
                href: "/youtube-to-wav",
                label: "YouTube to WAV",
                body: "Pull the audio out of the video.",
              },
              {
                href: "/silence-split",
                label: "Silence Splitter",
                body: "Cut it at natural pauses, not fixed times.",
              },
              {
                href: "/audio-to-text",
                label: "Audio to Text",
                body: "Transcribe each section in turn.",
              },
            ].map((item, i) => (
              <li key={item.href} className="py-4">
                <p className="font-mono text-xs text-amber-500">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <Link
                  href={item.href}
                  prefetch={false}
                  className="mt-1 block font-medium text-amber-400 hover:underline"
                >
                  {item.label}
                </Link>
                <p className="mt-0.5 text-sm text-text-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="Honest limits"
            title="What this won't do"
            description="Worth knowing before you paste a link rather than after."
          />

          <ul className="mt-8 space-y-3 leading-relaxed text-text-muted">
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">
                It&apos;s slower than reading the caption track.
              </strong>{" "}
              Transcribing audio takes up to about a minute; an extension that
              reads existing captions is instant. That&apos;s the trade for
              working when there are no captions to read.
            </li>
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">No playlists or channels.</strong>{" "}
              One video per run. There&apos;s no bulk mode.
            </li>
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">No speaker labels.</strong> An
              interview comes back as continuous text, not &quot;Host / Guest&quot;.
            </li>
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">
                Private and region-blocked videos won&apos;t load.
              </strong>{" "}
              If the server can&apos;t reach the video, there&apos;s no audio to
              work from.
            </li>
            <li className="border-t border-graphite-800 pt-3">
              <strong className="text-text-primary">No playback here.</strong>{" "}
              Unlike the file-based tools, there&apos;s no audio to click a
              transcript line against — watch the video alongside it instead.
            </li>
          </ul>

          <p className="mt-6 leading-relaxed text-text-muted">
            For what actually degrades a transcript and when to set the language
            manually,{" "}
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

        <section className="space-y-2 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h2 className="font-semibold text-text-primary">Copyright &amp; fair use</h2>
          <p className="text-sm leading-relaxed text-text-muted">
            You&apos;re responsible for how you use a transcript of someone
            else&apos;s video. Personal reference, accessibility, study and
            quotation are generally reasonable; republishing a transcript as
            your own content is not. AudioForges doesn&apos;t host or
            redistribute video, audio, or the transcripts produced here.
          </p>
        </section>

        <p className="mt-8 border-t border-graphite-800 pt-6 font-mono text-xs text-text-subtle">
          Published <time dateTime={PUBLISHED}>{formatDate(PUBLISHED)}</time>
          {LAST_VERIFIED !== PUBLISHED && (
            <>
              {" · "}limits and model re-checked{" "}
              <time dateTime={LAST_VERIFIED}>{formatDate(LAST_VERIFIED)}</time>
            </>
          )}
          {". "}
          {TRANSCRIPTION_MODEL} · {maxMinutesLabel} per video · {rateLimit}.
        </p>
      </main>
    </>
  );
}