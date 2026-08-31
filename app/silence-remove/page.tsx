import type { Metadata } from "next";
import Link from "next/link";
import { SilenceRemoveForm } from "@/components/converter/SilenceRemoveForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { ogForTool } from "@/lib/og";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

// Kept to 35 chars so it survives the " | AudioForges" suffix inside the
// ~60-char SERP budget. The previous title ran to 53 and got truncated
// mid-phrase, losing the differentiator entirely.
const PAGE_TITLE = "Free Silence Remover — Cut Dead Air";
const PAGE_DESCRIPTION =
  "Strip silent gaps from a podcast, audiobook, or recording free. Cuts dead air throughout, not just the ends. No sign-up, no watermark, no account.";

const OG_IMAGE = ogForTool("silence-remove", "Free Silence Remover");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/silence-remove` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/silence-remove`,
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

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Silence Remover",
  url: `${SITE_URL}/silence-remove`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Cuts silent gaps throughout, not just leading/trailing",
    "Adjustable threshold and gap length",
    "No sign-up required",
    "No watermark",
  ],
};

// Don't add HowTo schema — Google retired HowTo rich results for web search,
// so it earns nothing while adding a second copy of the steps that can drift
// from the visible ones. FAQPage comes from <FAQSection />, BreadcrumbList
// from <Breadcrumb />.

export default async function SilenceRemovePage() {
  const relatedTools = getRelatedTools("silence-remove", 5);

  const limits = await getLimits();
  const durationCap = durationCapFor(limits, "silence-remove");
  const retention = retentionSentences(limits.retention.audio_tools);

  const formats = limits.allowedAudioFormats.map((f) => f.toUpperCase());
  const formatList = formats.join(", ").replace(/, ([^,]*)$/, ", or $1");

  const faqs = [
    {
      question: "Does this only trim silence from the start and end?",
      answer:
        "No — it strips silent gaps throughout the entire recording, not just the leading and trailing edges. That's the difference between this and a trimmer: you don't have to find the gaps yourself.",
    },
    {
      question: "What do threshold and minimum gap length control?",
      answer:
        "Threshold sets how quiet something has to be to count as silence, in decibels. Minimum gap length sets how long that quiet stretch has to last before it gets cut. A stretch has to satisfy both at once, which is why a brief pause between words survives while a two-second gap doesn't.",
    },
    {
      question: "What threshold should I use?",
      answer:
        "Start with the -30dB default. If gaps are being left behind, your room tone is louder than the threshold — try -20dB. If natural pauses are being cut, go the other way toward -40dB. Room tone varies enough between recordings that there's no single correct value.",
    },
    {
      /*
        The page previously named no limit anywhere and hedged with "fair-use
        limits apply on file size" — no figure, on a tool whose readers upload
        hour-long podcast recordings. That vagueness is what makes someone
        close the tab rather than test it, and the real numbers are perfectly
        reasonable.
      */
      question: "Is there a size or length limit?",
      answer:
        durationCap === null
          ? `Up to ${limits.maxUploadMb}MB per file, with no length limit.`
          : `Up to ${limits.maxUploadMb}MB per file, and up to ${durationLabel(durationCap)} of audio — enough for a full podcast episode or lecture recording. There's no paid tier that raises either one.`,
    },
    {
      question: "Will the output be shorter than the original?",
      answer:
        "Yes — gaps are cut out entirely rather than muted, so the result is shorter than the input. How much shorter depends on how much dead air was in the recording.",
    },
    {
      question: "Does removing silence affect audio quality?",
      answer:
        "The audio that remains is untouched — only the silent sections are removed, and the format and quality of everything else is preserved.",
    },
    {
      question: "How is this different from the Silence Splitter?",
      answer:
        "Both find the same silent gaps. The Silence Remover deletes them and gives you one shorter file. The Silence Splitter uses them as cut points and gives you separate files — one per section. Use the remover to tighten a recording, the splitter to break one long recording into tracks.",
    },
    {
      question: "Are my uploaded files kept?",
      answer: `${retention.input} ${retention.output} There are no accounts, so nothing is linked to you.`,
    },
    {
      question: "Is this really free?",
      answer:
        "Yes — no sign-up, no email, no account, and no watermark on the output. The size and length limits above exist so one person can't tie up the servers, and there's no paid tier that removes them.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={
          <Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Silence Remover" }]} />
        }
        title="Free Silence Remover"
        lede="Cut dead air throughout a recording, not just the start and end, free, no sign-up, no watermark."
        tool={<SilenceRemoveForm />}
      >
        <FeatureStrip
          features={[
            { title: "Whole-file cleanup", desc: "Cuts gaps everywhere, not just the ends." },
            { title: "One-click ready", desc: "Sensible defaults, no tuning required." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
            },
          ]}
        />

        <ToolSection id="how-to" title="How to remove silence from audio" bleed>
          <Prose>
            <ol>
              <li>Upload an {formatList} file.</li>
              <li>Leave threshold and minimum gap length at their defaults, or adjust them.</li>
              <li>
                Download the result — shorter than the original, with dead air cut
                throughout.
              </li>
            </ol>
          </Prose>
          {/* Rendered from allowed_audio_formats rather than a hand-written
              array — the mechanism that left AIFF off /stems. */}
          <div className="mt-5 flex flex-wrap gap-2">
            {formats.map((fmt) => (
              <span
                key={fmt}
                className="inline-flex items-center gap-1 rounded-full border border-graphite-800 bg-graphite-900 px-3 py-1 text-xs text-text-muted"
              >
                <span className="text-teal-400" aria-hidden>
                  ✓
                </span>
                {fmt}
              </span>
            ))}
          </div>
        </ToolSection>

        <ToolSection id="how-it-works" title="How silence detection works">
          <p>
            The tool scans the recording for stretches that fall below your chosen
            loudness threshold. Once a quiet stretch lasts longer than the minimum
            gap length you&apos;ve set, it&apos;s cut out entirely and the audio
            on either side is joined back together. Anything quieter than the
            threshold but shorter than the minimum gap — a brief pause between
            words, for instance — is left alone, since it doesn&apos;t meet both
            conditions at once.
          </p>
          <p>
            That &quot;both conditions&quot; part is what makes the two settings
            work as a pair rather than independently, and it&apos;s why changing
            one often has no effect until you change the other too.
          </p>
        </ToolSection>

        {/* Three-way, not two-way. The tool people actually confuse this with
            is the Splitter, not the Trimmer — they detect identical gaps and
            differ only in what they do with them. */}
        <ToolSection id="vs-splitter-vs-trimmer" title="Silence Remover vs. Splitter vs. Trimmer" bleed>
          <Prose>
            <p>
              Three tools that all cut audio, easy to pick the wrong one. The
              short version: the remover shortens one file, the splitter turns one
              file into several, and the trimmer keeps a section you choose
              yourself.
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    <span className="sr-only">Comparison</span>
                  </th>
                  <th className="px-4 py-3 font-semibold">Silence Remover</th>
                  <th className="px-4 py-3 font-semibold">Silence Splitter</th>
                  <th className="px-4 py-3 font-semibold">Audio Trimmer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">What it does</td>
                  <td className="px-4 py-3">Deletes silent gaps</td>
                  <td className="px-4 py-3">Cuts at silent gaps</td>
                  <td className="px-4 py-3">Keeps one section</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">You get back</td>
                  <td className="px-4 py-3">One shorter file</td>
                  <td className="px-4 py-3">Several files</td>
                  <td className="px-4 py-3">One clip</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Best for</td>
                  <td className="px-4 py-3">Tightening a podcast or voice memo</td>
                  <td className="px-4 py-3">Splitting a long recording into tracks</td>
                  <td className="px-4 py-3">Extracting a specific quote or clip</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-text-primary">Manual work</td>
                  <td className="px-4 py-3">None — automatic</td>
                  <td className="px-4 py-3">None — automatic</td>
                  <td className="px-4 py-3">You pick start and end</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              Splitting one long recording into separate tracks instead?{" "}
              <Link href="/silence-split">Silence Splitter</Link> uses the same
              detection to cut rather than delete. Keeping just one section?{" "}
              <Link href="/trim">Audio Trimmer</Link> is the better fit.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="threshold" title="Choosing a threshold" bleed>
          <Prose>
            <p>
              The defaults — -30dB threshold, 0.5 second minimum gap — handle most
              podcast and voice-memo cleanup without adjustment. When they
              don&apos;t, the symptom tells you which way to move:
            </p>
          </Prose>
          <div className="mt-5 overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-left text-sm text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">What you&apos;re seeing</th>
                  <th className="px-4 py-3 font-semibold">What to change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-800">
                <tr>
                  <td className="px-4 py-3">Gaps left behind, barely shorter</td>
                  <td className="px-4 py-3">
                    Raise the threshold toward -20dB — your room tone is louder than
                    the current setting
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Natural pauses cut, speech sounds rushed</td>
                  <td className="px-4 py-3">Lower toward -40dB, or lengthen the minimum gap</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Long gaps handled, short ones remain</td>
                  <td className="px-4 py-3">Shorten the minimum gap below 0.5s</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Result feels choppy between sentences</td>
                  <td className="px-4 py-3">Lengthen the minimum gap past 1s</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Prose className="mt-5">
            <p>
              There&apos;s no correct preset for a given content type — it depends
              on how quiet your room tone is and how tightly you want the result
              edited. Preview and adjust rather than assuming one setting fits
              every recording.
            </p>
          </Prose>
        </ToolSection>

        {/* Captures "how to remove silence in audacity" — high volume, and a
            good share of those searchers would rather click one button than
            learn Truncate Silence. Saying plainly when Audacity is the better
            answer is what makes the rest of the page credible. */}
        <ToolSection id="audacity" title="Doing this in Audacity instead">
          <p>
            Audacity has a Truncate Silence effect that does the same job, with
            more control: it can shorten gaps to a set length rather than removing
            them outright, and you can undo, audition and re-run it on a selection
            while watching the waveform. If you&apos;re already editing in
            Audacity, or you need gaps shortened rather than deleted, that&apos;s
            the better tool.
          </p>
          {durationCap !== null && (
            <p>
              It also has no length limit, which makes it the right answer for a
              recording longer than {durationLabel(durationCap)}.
            </p>
          )}
          <p>
            This page exists for the other case: you have one file, you want the
            dead air gone, and installing a desktop editor to do it once
            isn&apos;t worth it. Upload, download, done — nothing to learn and
            nothing to install.
          </p>
        </ToolSection>

        <ToolSection id="when-worth-it" title="When this is worth doing">
          <p>
            Anywhere a recording has more quiet in it than a listener will sit
            through. In practice that&apos;s three situations:
          </p>
          <dl>
            <dt>Spoken-word editing</dt>
            <dd>
              Podcasts, interviews and voice-overs, where scattered pauses add up
              to minutes across an episode and scrubbing for them by hand is the
              slowest part of the edit.
            </dd>

            <dt>Long-form recordings</dt>
            <dd>
              Lectures, audiobook chapters and meeting recordings with long quiet
              stretches between sections.
            </dd>

            <dt>Before further processing</dt>
            <dd>Less audio means less to transcribe, upload or store.</dd>
          </dl>
          <p>
            On that last point: cutting dead air first means less audio for{" "}
            <Link href="/audio-to-text">Audio to Text</Link> to work through. If
            background noise rather than silence is the problem, the{" "}
            <Link href="/noise-remove">Noise Remover</Link> or, for speech
            specifically, the <Link href="/voice-clean">Voice Cleaner</Link> handle
            that instead — silence detection won&apos;t touch a continuous hiss,
            because it never falls below the threshold.
          </p>
          <p>
            Want the full breakdown of how these two settings interact, and why
            cutting too aggressively can clip natural pauses?{" "}
            <Link href="/guides/editing-out-dead-air-podcasts">
              Read Cutting Dead Air from Podcasts &amp; Recordings
            </Link>
            .
          </p>
        </ToolSection>

        <RelatedToolsGrid tools={relatedTools} />

        <FAQSection faqs={faqs} />
      </ToolPageShell>
    </>
  );
}