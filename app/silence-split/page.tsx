import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { SilenceSplitForm } from "@/components/converter/SilenceSplitForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getToolLimits } from "@/lib/data/tool-limits";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  windowFor,
  rateLimitLabel,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

// 46 chars, so ~60 with the " | AudioForges" suffix — right at the SERP
// budget. If it truncates it drops "by Silence" and still reads as "Free
// Silence Splitter — Split Audio", which is intact enough. The previous title
// lost its differentiator entirely when cut.
const PAGE_TITLE = "Free Silence Splitter — Split Audio by Silence";

/**
 * `metadata` is evaluated at module scope where getLimits() can't be awaited,
 * so the segment cap here comes from the hand table — the same value the
 * /limits fallback carries.
 */
const DESCRIPTION_SEGMENTS = getToolLimits("silence-split")?.maxOutputSegments ?? 50;
const PAGE_DESCRIPTION = `Split one long recording into separate tracks at silent gaps. Adjustable threshold and gap length, up to ${DESCRIPTION_SEGMENTS} tracks. Free, no sign-up, no watermark.`;

const OG_IMAGE = ogForTool("silence-split", "Free Silence Splitter");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/silence-split` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/silence-split`,
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

// No HowTo schema — Google retired HowTo rich results for web search.
//
// FAQ note: <FAQSection> emits its own FAQPage block, so none is hand-written
// here. Worth knowing FAQPage no longer produces rich results for a site like
// this one — Google restricted them to government and health domains in 2023.
// The FAQ earns its place by answering things the body doesn't, which is why
// it's nine questions rather than fifteen.

const SOURCE_TYPES = [
  {
    name: "DJ mixes and sets",
    desc: "Works well when there are real quiet moments between tracks. Mixes that crossfade continuously — one song blending directly into the next with no true silence — are much harder to split reliably this way, since there's no acoustic gap to detect in the first place.",
  },
  {
    name: "Vinyl rips and digitized albums",
    desc: "A full side ripped as one file often has natural pauses between songs, which makes it a good candidate. Surface noise or turntable rumble can sometimes keep a supposedly quiet gap from reading as silence — lowering the threshold usually helps.",
  },
  {
    name: "Podcasts and interviews",
    desc: "Useful for dividing a long recording into segments, provided the boundaries you want actually have longer pauses than ordinary conversational speech. Normal sentence-to-sentence gaps are usually too short to count once the minimum gap length is set appropriately.",
  },
  {
    name: "Audiobooks and lectures",
    desc: "Can work for chapter or section breaks where there's a genuinely long pause — but this detects quiet gaps, not chapter markers, so it won't reliably find every chapter boundary unless that boundary has real silence around it.",
  },
  {
    name: "Voice memos and field recordings",
    desc: "A single recording covering several distinct ideas or moments, separated by pauses, splits cleanly into individual clips this way.",
  },
];

export default async function SilenceSplitPage() {
  const relatedTools = getRelatedTools("silence-split", 5);

  const limits = await getLimits();
  const toolLimits = getToolLimits("silence-split");

  const maxSegments = toolLimits?.maxOutputSegments ?? 50;
  const minSegmentSeconds = toolLimits?.minOutputSegmentSeconds ?? 1;
  const fileSizeLabel = `${limits.maxUploadMb}MB`;

  /*
    RENDERED, this time. The old code assigned getRateLimitLabel("silence-split")
    at module scope, the comment above it claimed both values were used below,
    and only one of them was — so the tightest limit on the site was also the
    only one the page never stated. Reading from the table doesn't help if
    nothing reads the variable.
  */
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

  // Every claim below is checked against the actual product. No accuracy,
  // performance or privacy claims are asserted — none have been verified
  // against the backend implementation.
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
        "Up to N segments" reads as truncation. It isn't: the backend raises
        BEFORE cutting anything, so an over-cap file produces NOTHING rather
        than the first N. Materially different, and this page's own examples —
        a two-hour set, a full vinyl side — are exactly the files that hit it.
      */
      question: "How many tracks can one upload produce?",
      answer: `Up to ${maxSegments}. Past that the split is refused rather than trimmed to ${maxSegments} — nothing is written, and the error tells you the real count so you can raise the silence threshold or the minimum gap to merge nearby segments and run it again. Any segment shorter than ${minSegmentSeconds} second is dropped automatically rather than kept as a near-empty fragment.`,
    },
    {
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

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Silence Splitter" }]} />
        }
        title="Free Silence Splitter"
        lede="Upload one long recording and split it automatically at every silent gap, free, no sign-up, no watermark."
        tool={<SilenceSplitForm />}
      >
        <FeatureStrip
          features={[
            {
              title: "Automatic detection",
              desc: "Finds quiet gaps across the whole file instead of you scrubbing through it by hand.",
            },
            {
              title: "Adjustable",
              desc: "Control the silence threshold and minimum gap length to decide what counts as a split point.",
            },
            {
              title: `Up to ${maxSegments} tracks`,
              desc: "One long recording becomes as many separate, individually downloadable files as it has real gaps.",
            },
          ]}
        />

        <ToolSection id="what-is-it" title="What is a silence splitter?">
          <p>
            There are a few ways to turn one long recording into several separate
            files. You can cut it manually, marking exact timestamps in an audio
            editor — precise, but slow for anything with more than a couple of
            boundaries. You can divide it into equal-length chunks, which is fast
            but ignores where the recording actually changes. A silence splitter
            takes a third approach: it scans the whole file for quiet gaps and
            uses qualifying gaps as the cut points automatically. That works well
            specifically because a lot of source material — a DJ mix, a vinyl rip,
            a voice memo covering several ideas — already has real pauses between
            its natural sections; the splitter just finds them instead of you
            marking them by hand.
          </p>
        </ToolSection>

        <ToolSection id="how-to" title="How to split audio by silence">
          <ol>
            <li>Upload an {formatList} file.</li>
            <li>Choose the output format for the resulting tracks.</li>
            <li>Set the silence threshold, or leave it at the -30dB default.</li>
            <li>Set the minimum gap length, or leave it at the 0.5 second default.</li>
            <li>Run the split.</li>
            <li>Preview and download each resulting track individually.</li>
          </ol>
        </ToolSection>

        {/* Four numbers that decide whether an upload works at all, none of
            which the page previously stated — and this page's own worked
            examples (DJ sets, full vinyl sides) are the files most likely to
            exceed the first two. */}
        <ToolSection id="limits" title="Before you upload a long recording">
          <dl className="codes">
            {durationCap !== null && (
              <>
                <dt>Longest recording</dt>
                <dd>{durationLabel(durationCap)}</dd>
              </>
            )}
            <dt>Largest file</dt>
            <dd>{fileSizeLabel}</dd>

            <dt>Most tracks out</dt>
            <dd>{maxSegments}</dd>

            <dt>How often</dt>
            <dd>{rateLimit}</dd>
          </dl>
          <p>
            The track count is the one worth understanding, because it
            doesn&apos;t behave like the others. Going over it doesn&apos;t give
            you the first {maxSegments} tracks — the split is refused outright and
            nothing is written, so a two-hour set with {maxSegments + 13} gaps
            comes back empty rather than partly done. The error names the real
            count, and raising the silence threshold or the minimum gap length
            merges nearby segments until it fits. Nothing is lost in the meantime;
            the run simply didn&apos;t happen.
          </p>
        </ToolSection>

        {/* The threshold explanation, the troubleshooting steps and four of the
            old FAQs were three separate versions of this one section.
            Consolidated: the two settings explained once, then a
            symptom-to-fix table answering the question people actually arrive
            with — "mine came out wrong, what do I change?" */}
        <ToolSection id="settings" title="Silence threshold and minimum gap length" bleed>
          <Prose>
            <dl>
              <dt>Silence threshold</dt>
              <dd>
                The loudness level, in decibels, below which audio counts as quiet
                enough to potentially be a gap. A more negative number (like
                -50dB) requires the signal to be quieter before it qualifies; a
                less negative number (like -20dB) is more lenient and will catch
                quieter background noise as well. The default is -30dB.
              </dd>

              <dt>Minimum gap length</dt>
              <dd>
                How long that quiet stretch has to last before it counts as a real
                boundary rather than a brief pause. The default is 0.5 seconds. A
                short breath between sentences or a quick beat drop in a mix
                usually doesn&apos;t last this long, so it won&apos;t trigger a
                split on its own — only a longer, genuine gap will.
              </dd>
            </dl>
            <p>
              A stretch has to satisfy both conditions at once to become a cut
              point, which is why changing one setting often has no visible effect
              until you change the other too.
            </p>
          </Prose>

          <div className="mt-6 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
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
                    Background noise is likely sitting above the threshold — raise
                    it toward -20dB and try again
                  </td>
                </tr>
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

          <Prose className="mt-6">
            <p>
              There&apos;s no single correct combination — it depends entirely on
              how the original recording was made. A podcast with long pauses
              between segments needs a longer minimum gap than a DJ mix with short
              breaks between songs; a noisy field recording needs a less negative
              threshold than a clean studio take. Preview the result and adjust
              from there.
            </p>
            <p>
              Want the fuller breakdown — how DJ mixes, vinyl rips, and voice
              recordings each behave differently, and what to do when a crossfade
              leaves no real gap to detect?{" "}
              <Link href="/guides/splitting-a-recording-into-separate-tracks">
                Read How to Split a Recording Into Separate Tracks by Silence
              </Link>
              .
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="source-types" title="Common ways to split audio by silence">
          <dl>
            {SOURCE_TYPES.map((s) => (
              <Fragment key={s.name}>
                <dt>{s.name}</dt>
                <dd>{s.desc}</dd>
              </Fragment>
            ))}
          </dl>
        </ToolSection>

        {/* Audacity's Label Sounds + Export Multiple is how most people are
            taught to do this, so "audacity split by silence" carries far more
            volume than "silence splitter". Being straight about when Audacity
            is the better answer is what makes the paragraph after it worth
            believing. */}
        <ToolSection id="audacity" title="Doing this in Audacity instead">
          <p>
            Audacity can do this with Label Sounds followed by Export Multiple,
            and it has real advantages: you see the detected boundaries as labels
            on the waveform before committing, you can drag any of them to a
            better position, and you can name each region so the exported files
            come out with proper titles instead of numbers. For a vinyl rip you
            intend to keep, that naming step alone is often worth the setup.
          </p>
          <p>
            It also has no length limit and no track-count ceiling, which makes it
            the right answer for a recording longer than{" "}
            {durationCap !== null ? durationLabel(durationCap) : "the cap here"} or
            one that genuinely needs more than {maxSegments} pieces.
          </p>
          <p>
            The trade is time. Installing Audacity, finding Label Sounds under the
            Analyze menu, understanding its threshold settings, then configuring
            Export Multiple is a genuine afternoon the first time. This page is for
            the case where you have one file, you want it in pieces, and learning a
            desktop editor to do it once isn&apos;t worth it.
          </p>
        </ToolSection>

        <ToolSection id="vs-remover" title="Silence Splitter vs. Silence Remover" bleed>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
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
                  <td className="px-4 py-3 font-medium text-text-primary">
                    What happens to the gaps
                  </td>
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
                  <td className="px-4 py-3">
                    A DJ mix, vinyl rip, or multi-idea recording you want as
                    individual tracks
                  </td>
                  <td className="px-4 py-3">
                    A podcast or voice memo you want tightened into one file
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ToolSection>

        {/* "vs. manual cutting", "Limitations" and "Is this right for you?" were
            three passes at the same point: detection is acoustic, so it can't
            find a boundary that isn't audible. Said once, with the alternatives
            attached. */}
        <ToolSection id="wont-work" title="When this won't work">
          <p>
            Silence detection identifies quiet gaps from loudness alone. It
            doesn&apos;t recognise song titles, artists, chapter markers, or
            musical structure — it can&apos;t tell that a moment is the end of a
            song except by measuring that the audio genuinely went quiet there. So
            three situations defeat it, and no amount of setting adjustment fixes
            them:
          </p>
          <ul>
            <li>
              Continuously crossfaded mixes, where one track blends into the next
              without ever going quiet.
            </li>
            <li>
              Recordings with constant background noise that never drops below any
              usable threshold.
            </li>
            <li>
              Boundaries that are structural rather than acoustic — a chapter
              change with no pause around it.
            </li>
          </ul>
          <p>
            In all three cases there&apos;s no acoustic gap to find, so marking cut
            points by hand with the <Link href="/trim">Audio Trimmer</Link> is the
            reliable option — slower, but it works regardless of what the source
            sounds like. If you want those gaps deleted rather than used as
            boundaries, the <Link href="/silence-remove">Silence Remover</Link> uses
            the same detection to shorten one file instead of producing several.
            And if the resulting tracks need transcribing, each one works directly
            with <Link href="/audio-to-text">Audio to Text</Link>.
          </p>
        </ToolSection>

        <ToolSection id="formats" title="Supported formats" bleed>
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
          <Prose className="mt-5">
            <p>
              Upload any of the formats above, up to {fileSizeLabel} per file.
              Choose one output format and every resulting track is saved in that
              format.
            </p>
          </Prose>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        {/* h3, not h2 — a footnote under the page's content rather than a
            section sitting in the outline beside the real ones. */}
        <section className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
          <h3 className="font-semibold text-text-primary">Copyright &amp; fair use</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            You are responsible for ensuring you have the right to process any
            recording you upload — including DJ mixes, vinyl rips, or other source
            audio you didn&apos;t create yourself. AudioForges does not host or
            distribute the files processed through this tool.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
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
      </ToolPageShell>
    </>
  );
}