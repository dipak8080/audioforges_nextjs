import type { Metadata } from "next";
import Link from "next/link";
import { SilenceSplitForm } from "@/components/converter/SilenceSplitForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getToolLimits } from "@/lib/data/tool-limits";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE RATE LIMIT WAS FETCHED AND NEVER RENDERED. `getRateLimitLabel(
 *    "silence-split")` was assigned at module scope, the comment above it
 *    claimed both values were used below, and only one of them was. So the
 *    page stated no rate limit at all — on the tightest limit on the site (3
 *    per 5 minutes) and the only one not shared with another tool.
 *
 *    Worth noting it's the exact failure that constant exists to prevent:
 *    reading from the table doesn't help if nothing reads the variable.
 *
 * 2. "UP TO 50 SEGMENTS" READS AS TRUNCATION. IT ISN'T. The backend raises
 *    before cutting anything, so a file that would produce 63 segments returns
 *    NOTHING — not the first 50. That's a materially different outcome and
 *    this page's own examples are exactly the files that hit it: a two-hour DJ
 *    set, a full vinyl side. Stated plainly now, with the fix, because the
 *    server's own error message names the count and the remedy and the page
 *    should agree with it.
 *
 * 3. THE DURATION CAP WAS UNSTATED, on the page where it bites hardest.
 *    silence-split isn't exempt and has no per-tool override, so it takes the
 *    audio_tools default of one hour. A page whose worked examples are DJ sets
 *    and vinyl rips owes the reader that number before they upload.
 *
 * 4. Retention answer added; formats, size and limits now read from /limits;
 *    prefetch disabled on the tool grid.
 */

// 46 chars, so ~60 with the " | AudioForges" suffix — right at the SERP
// budget. If it truncates, it drops "by Silence" and still reads as
// "Free Silence Splitter — Split Audio", which is intact enough. The
// previous title lost its differentiator entirely when cut.
const PAGE_TITLE = "Free Silence Splitter — Split Audio by Silence";

/**
 * `metadata` is evaluated at module scope where getLimits() can't be awaited,
 * so the segment cap here comes from the hand table — the same value the
 * /limits fallback carries. This was the ONE place a number was still typed
 * despite the file's own comment claiming otherwise.
 */
const DESCRIPTION_SEGMENTS = getToolLimits("silence-split")?.maxOutputSegments ?? 50;
const PAGE_DESCRIPTION = `Split one long recording into separate tracks at silent gaps. Adjustable threshold and gap length, up to ${DESCRIPTION_SEGMENTS} tracks. Free, no sign-up, no watermark.`;

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  // `keywords` removed — ignored by Google since 2009, treated as a spam
  // signal by Bing. Target terms kept below for reference.
  /*
    silence splitter online
    split audio by silence
    split audio into multiple files
    split dj mix into tracks
    split vinyl rip into songs
    audacity split by silence alternative
    auto split audio
    cue sheet alternative
    split mp3 by silence
    separate tracks from one recording
  */
  alternates: { canonical: `${SITE_URL}/silence-split` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/silence-split`,
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

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Silence Splitter", item: `${SITE_URL}/silence-split` },
  ],
};
// No HowTo schema — Google retired HowTo rich results for web search.
//
// FAQ note: <FAQSection> emits its own FAQPage block, so none is added by
// hand here. Worth knowing that FAQPage no longer produces rich results
// for a site like this one — Google restricted them to government and
// health domains in 2023. The FAQ below earns its place by answering
// things the body doesn't, not by chasing a snippet, which is why it's
// nine questions rather than fifteen.

export default async function SilenceSplitPage() {
  const relatedTools = getRelatedTools("silence-split", 5);

  const limits = await getLimits();
  const toolLimits = getToolLimits("silence-split");

  const maxSegments = toolLimits?.maxOutputSegments ?? 50;
  const minSegmentSeconds = toolLimits?.minOutputSegmentSeconds ?? 1;
  const fileSizeLabel = `${limits.maxUploadMb}MB`;

  // Rendered, this time. 3 per 5 minutes — the tightest window on the site.
  const rateLimit = rateLimitLabel(
    limits.rateLimits["silence-split"] ?? 3,
    windowFor(limits, "silence-split")
  );

  /*
    Not exempt, no per-tool override, so this is the audio_tools default: one
    hour. It matters more here than almost anywhere — the worked examples on
    this page are DJ sets and full vinyl sides, and plenty of those run longer.
  */
  const durationCap = durationCapFor(limits, "silence-split");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, " and $1");

  // WebApplication schema — every claim below is checked against the actual
  // product. No accuracy/performance/privacy claims are asserted since none
  // have been verified against the backend implementation.
  const webAppJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Silence Splitter",
    url: `${SITE_URL}/silence-split`,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Automatic silence detection",
      "Adjustable silence threshold",
      "Adjustable minimum gap length",
      `Splits one file into up to ${maxSegments} separate tracks`,
      "Choice of output format",
      "No sign-up required",
      "No watermark",
    ],
  };

  const faqs = [
    {
      question: "Can I split a DJ mix into individual tracks?",
      answer:
        "If the mix has genuine quiet gaps between songs, yes. Mixes that crossfade continuously from one track into the next often have no real silence to detect, so some manual adjustment — or a different tool entirely — may be needed for those.",
    },
    {
      question: "Can I split a vinyl rip into separate songs?",
      answer:
        "Yes, when there are quiet gaps between tracks on the recording — common on vinyl rips digitized with the natural pauses between songs intact. Surface noise can keep a gap from registering as silent; lowering the threshold usually fixes it.",
    },
    {
      question: "Can I split a podcast or interview by silence?",
      answer:
        "Yes, if the boundaries you want have longer pauses than ordinary conversational speech. Normal sentence-to-sentence gaps are usually well under half a second, so a longer minimum gap length keeps normal speech from being split up unintentionally.",
    },
    {
      /*
        REWRITTEN. Said "Up to N segments per upload", which reads as a
        ceiling that truncates. It doesn't: the backend raises before cutting
        anything, so an over-cap file produces NOTHING rather than the first N.
        Someone splitting a long vinyl rip needs to know that before they wait
        for it.
      */
      question: "How many tracks can one upload produce?",
      answer: `Up to ${maxSegments}. Past that the split is refused rather than trimmed to ${maxSegments} — nothing is written, and the error tells you the real count so you can raise the silence threshold or the minimum gap to merge nearby segments and run it again. Any segment shorter than ${minSegmentSeconds} second is dropped automatically rather than kept as a near-empty fragment.`,
    },
    {
      /*
        ADDED. The rate limit was read from the table at module scope and then
        never rendered anywhere on the page — so the tightest limit on the site
        was also the least visible one.
      */
      question: "How often can I run a split?",
      answer: `${rateLimit}. That's the tightest limit here, because a split can produce dozens of files from one upload and each of them is encoded separately. If you hit it, the button shows a countdown rather than failing.`,
    },
    {
      question: "Does splitting reduce audio quality?",
      answer:
        "The cut itself doesn't alter the audio — it only divides it at the points detected. The resulting files are then encoded into whichever output format you choose, the same as any format conversion.",
    },
    {
      question: "Can I choose the output format?",
      answer: `Yes — pick one output format and every resulting segment is saved in that format, regardless of what you uploaded. ${formatList} are supported, up to ${fileSizeLabel} per upload.`,
    },
    {
      question: "Does it name the tracks or read chapter markers?",
      answer:
        "No. Detection works purely on loudness, so it has no way to know song titles, artists, or chapter positions. Segments come out numbered in order and you rename them yourself.",
    },
    {
      // ADDED: no retention answer existed.
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this free, and do I need to sign up?",
      answer:
        "Yes, completely free — no sign-up, no email, no account, and no watermark on any resulting file.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Silence Splitter
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Upload one long recording and split it automatically at every
            silent gap. Adjust the silence threshold and minimum gap length to
            control exactly where it cuts, free, no sign-up, no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <SilenceSplitForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Automatic detection", desc: "Finds quiet gaps across the whole file instead of you scrubbing through it by hand." },
            { title: "Adjustable", desc: "Control the silence threshold and minimum gap length to decide what counts as a split point." },
            { title: `Up to ${maxSegments} tracks`, desc: "One long recording becomes as many separate, individually downloadable files as it has real gaps." },
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
          <h2 className="text-2xl font-bold text-text-primary">What is a silence splitter?</h2>
          <p className="text-text-muted leading-relaxed">
            There are a few ways to turn one long recording into several
            separate files. You can cut it manually, marking exact timestamps
            in an audio editor — precise, but slow for anything with more than
            a couple of boundaries. You can divide it into equal-length
            chunks, which is fast but ignores where the recording actually
            changes. A silence splitter takes a third approach: it scans the
            whole file for quiet gaps and uses qualifying gaps as the cut
            points automatically. That works well specifically because a lot
            of source material — a DJ mix, a vinyl rip, a voice memo covering
            several ideas — already has real pauses between its natural
            sections; the splitter just finds them instead of you marking
            them by hand.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to split audio by silence</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Choose the output format for the resulting tracks.</li>
            <li>Set the silence threshold, or leave it at the -30dB default.</li>
            <li>Set the minimum gap length, or leave it at the 0.5 second default.</li>
            <li>Run the split.</li>
            <li>Preview and download each resulting track individually.</li>
          </ol>
        </section>

        {/* ADDED. Three numbers that decide whether an upload works at all,
            none of which the page previously stated — and this page's own
            worked examples (DJ sets, full vinyl sides) are the files most
            likely to exceed the first two. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Before you upload a long recording</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <tbody className="divide-y divide-graphite-800">
                {durationCap !== null && (
                  <tr>
                    <td className="w-2/5 px-4 py-3 font-medium text-text-primary">Longest recording</td>
                    <td className="px-4 py-3">{durationLabel(durationCap)}</td>
                  </tr>
                )}
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Largest file</td>
                  <td className="px-4 py-3">{fileSizeLabel}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Most tracks out</td>
                  <td className="px-4 py-3">{maxSegments}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">How often</td>
                  <td className="px-4 py-3">{rateLimit}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-text-muted leading-relaxed">
            The track count is the one worth understanding, because it
            doesn&apos;t behave like the others. Going over it doesn&apos;t
            give you the first {maxSegments} tracks — the split is refused
            outright and nothing is written, so a two-hour set with{" "}
            {maxSegments + 13} gaps comes back empty rather than partly done.
            The error names the real count, and raising the silence threshold
            or the minimum gap length merges nearby segments until it fits.
            Nothing is lost in the meantime; the run simply didn&apos;t happen.
          </p>
        </section>

        {/* The threshold explanation, the troubleshooting steps and four of
            the old FAQs were three separate versions of this one section.
            Consolidated: the two settings explained once, then a
            symptom-to-fix table that answers the question people actually
            arrive with — "mine came out wrong, what do I change?" */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Silence threshold and minimum gap length
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed">
            <p>
              <strong className="text-text-primary">Silence threshold</strong>{" "}
              is the loudness level, in decibels, below which audio counts as
              quiet enough to potentially be a gap. A more negative number
              (like -50dB) requires the signal to be quieter before it
              qualifies; a less negative number (like -20dB) is more lenient
              and will catch quieter background noise as well. The default is
              -30dB.
            </p>
            <p>
              <strong className="text-text-primary">Minimum gap length</strong>{" "}
              is how long that quiet stretch has to last before it counts as a
              real boundary rather than a brief pause. The default is 0.5
              seconds. A short breath between sentences or a quick beat drop
              in a mix usually doesn&apos;t last this long, so it won&apos;t
              trigger a split on its own — only a longer, genuine gap will.
            </p>
            <p>
              A stretch has to satisfy both conditions at once to become a cut
              point, which is why changing one setting often has no visible
              effect until you change the other too.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">What you&apos;re seeing</th>
                  <th className="px-4 py-3 font-semibold">What to change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">Too many tracks, split mid-sentence</td>
                  <td className="px-4 py-3">
                    Lengthen the minimum gap so only real boundaries count
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Gaps you expected weren&apos;t found</td>
                  <td className="px-4 py-3">
                    Lower the threshold toward -50dB, or shorten the minimum gap
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Nothing split at all</td>
                  <td className="px-4 py-3">
                    Background noise is likely sitting above the threshold —
                    raise it toward -20dB and try again
                  </td>
                </tr>
                {/* Added alongside the rejection copy above: this is now a
                    symptom people will actually see, and it has a fix. */}
                <tr>
                  <td className="px-4 py-3">Refused for producing too many tracks</td>
                  <td className="px-4 py-3">
                    Raise the threshold or lengthen the minimum gap — both merge
                    nearby segments
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Right number of tracks, wrong boundaries</td>
                  <td className="px-4 py-3">
                    The gaps aren&apos;t where you think — trim manually instead
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-text-muted leading-relaxed">
            There&apos;s no single correct combination — it depends entirely on
            how the original recording was made. A podcast with long pauses
            between segments needs a longer minimum gap than a DJ mix with
            short breaks between songs; a noisy field recording needs a less
            negative threshold than a clean studio take. Preview the result and
            adjust from there.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the fuller breakdown — how DJ mixes, vinyl rips, and voice
            recordings each behave differently, and what to do when a
            crossfade leaves no real gap to detect?{" "}
            <Link href="/guides/splitting-a-recording-into-separate-tracks" className="text-amber-400 hover:underline">
              Read How to Split a Recording Into Separate Tracks by Silence
            </Link>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Common ways to split audio by silence</h2>
          <div className="space-y-4 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary">DJ mixes and sets</h3>
              <p>
                Works well when there are real quiet moments between tracks.
                Mixes that crossfade continuously — one song blending directly
                into the next with no true silence — are much harder to split
                reliably this way, since there&apos;s no acoustic gap to detect
                in the first place.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Vinyl rips and digitized albums</h3>
              <p>
                A full side ripped as one file often has natural pauses
                between songs, which makes it a good candidate. Surface noise
                or turntable rumble can sometimes keep a supposedly quiet gap
                from reading as silence — lowering the threshold usually
                helps.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Podcasts and interviews</h3>
              <p>
                Useful for dividing a long recording into segments, provided
                the boundaries you want actually have longer pauses than
                ordinary conversational speech. Normal sentence-to-sentence
                gaps are usually too short to count once the minimum gap
                length is set appropriately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Audiobooks and lectures</h3>
              <p>
                Can work for chapter or section breaks where there&apos;s a
                genuinely long pause — but this detects quiet gaps, not
                chapter markers, so it won&apos;t reliably find every chapter
                boundary unless that boundary has real silence around it.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Voice memos and field recordings</h3>
              <p>
                A single recording covering several distinct ideas or moments,
                separated by pauses, splits cleanly into individual clips this
                way.
              </p>
            </div>
          </div>
        </section>

        {/* Audacity's Label Sounds + Export Multiple is how most people are
            taught to do this, so "audacity split by silence" carries far
            more volume than "silence splitter". Being straight about when
            Audacity is the better answer is what makes the paragraph after
            it worth believing. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Doing this in Audacity instead
          </h2>
          <p className="text-text-muted leading-relaxed">
            Audacity can do this with Label Sounds followed by Export
            Multiple, and it has real advantages: you see the detected
            boundaries as labels on the waveform before committing, you can
            drag any of them to a better position, and you can name each
            region so the exported files come out with proper titles instead
            of numbers. For a vinyl rip you intend to keep, that naming step
            alone is often worth the setup.
          </p>
          <p className="text-text-muted leading-relaxed">
            It also has no length limit and no track-count ceiling, which
            makes it the right answer for a recording longer than{" "}
            {durationCap !== null ? durationLabel(durationCap) : "the cap here"}{" "}
            or one that genuinely needs more than {maxSegments} pieces.
          </p>
          <p className="text-text-muted leading-relaxed">
            The trade is time. Installing Audacity, finding Label Sounds under
            the Analyze menu, understanding its threshold settings, then
            configuring Export Multiple is a genuine afternoon the first time.
            This page is for the case where you have one file, you want it in
            pieces, and learning a desktop editor to do it once isn&apos;t
            worth it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Silence Splitter vs. Silence Remover</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Silence Splitter</th>
                  <th className="px-4 py-3 font-semibold">Silence Remover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">What happens to the gaps</td>
                  <td className="px-4 py-3">Used as cut points — nothing is deleted</td>
                  <td className="px-4 py-3">Deleted entirely</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Output</td>
                  <td className="px-4 py-3">Multiple separate files</td>
                  <td className="px-4 py-3">One continuous file</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Best for</td>
                  <td className="px-4 py-3">A DJ mix, vinyl rip, or multi-idea recording you want as individual tracks</td>
                  <td className="px-4 py-3">A podcast or voice memo you want tightened into one file</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* "vs. manual cutting", "Limitations" and "Is this right for you?"
            were three passes at the same point: detection is acoustic, so
            it can't find a boundary that isn't audible. Said once, with the
            alternatives attached. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">When this won&apos;t work</h2>
          <p className="text-text-muted leading-relaxed">
            Silence detection identifies quiet gaps from loudness alone. It
            doesn&apos;t recognise song titles, artists, chapter markers, or
            musical structure — it can&apos;t tell that a moment is the end of
            a song except by measuring that the audio genuinely went quiet
            there. So three situations defeat it, and no amount of setting
            adjustment fixes them:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-text-muted leading-relaxed">
            <li>
              Continuously crossfaded mixes, where one track blends into the
              next without ever going quiet.
            </li>
            <li>
              Recordings with constant background noise that never drops below
              any usable threshold.
            </li>
            <li>
              Boundaries that are structural rather than acoustic — a chapter
              change with no pause around it.
            </li>
          </ul>
          <p className="text-text-muted leading-relaxed">
            In all three cases there&apos;s no acoustic gap to find, so marking
            cut points by hand with the{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>{" "}
            is the reliable option — slower, but it works regardless of what
            the source sounds like. If you want those gaps deleted rather than
            used as boundaries, the{" "}
            <Link href="/silence-remove" className="text-amber-400 hover:underline">
              Silence Remover
            </Link>{" "}
            uses the same detection to shorten one file instead of producing
            several. And if the resulting tracks need transcribing, each one
            works directly with{" "}
            <Link href="/audio-to-text" className="text-amber-400 hover:underline">
              Audio to Text
            </Link>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported formats</h2>
          {/* Rendered from the backend's allowed_audio_formats rather than a
              hand-written array — the mechanism that left AIFF off /stems. */}
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
          <p className="text-text-muted leading-relaxed">
            Upload any of the formats above, up to {fileSizeLabel} per file.
            Choose one output format and every resulting track is saved in
            that format.
          </p>
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
            You are responsible for ensuring you have the right to process any
            recording you upload — including DJ mixes, vinyl rips, or other
            source audio you didn&apos;t create yourself. AudioForges does not
            host or distribute the files processed through this tool.
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
            pages for how AudioForges handles uploaded files.
          </p>
        </section>

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}