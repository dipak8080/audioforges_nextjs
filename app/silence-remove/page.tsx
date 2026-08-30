import type { Metadata } from "next";
import Link from "next/link";
import { SilenceRemoveForm } from "@/components/converter/SilenceRemoveForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import {
  getLimits,
  durationCapFor,
  durationLabel,
  retentionSentences,
} from "@/lib/api/limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE PAGE STATED NO LIMIT, AND HEDGED ABOUT IT. "Fair-use limits apply on
 *    file size so one person can't tie up the servers" names no figure at all.
 *    On a page whose readers upload hour-long podcast recordings, that's the
 *    sentence that makes someone close the tab rather than test it — and the
 *    real numbers are perfectly reasonable, so the vagueness bought nothing.
 *
 *    80MB and one hour, both from /limits.
 *
 * 2. NO RETENTION ANSWER. Added from the backend's own retention block.
 *
 * 3. Formats read from allowed_audio_formats rather than a hand-written array
 *    — the mechanism that left AIFF off /stems while the tool accepted it.
 *
 * 4. `keywords` removed (ignored by Google since 2009), prefetch disabled on
 *    the tool grid, feature strip matched to the other pages.
 */

// Title kept to 35 chars so it survives the " | AudioForges" suffix
// inside the ~60-char SERP budget. The previous one ran to 53 and got
// truncated mid-phrase, losing the differentiator entirely.
const PAGE_TITLE = "Free Silence Remover — Cut Dead Air";
const PAGE_DESCRIPTION =
  "Strip silent gaps from a podcast, audiobook, or recording free. Cuts dead air throughout, not just the ends. No sign-up, no watermark, no account.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  /*
    `keywords` removed — ignored by Google since 2009, treated as a spam signal
    by Bing. Target terms kept for reference:

      silence remover online
      remove silence from audio
      remove dead air podcast
      cut silence from audio free
      strip silence mp3
      podcast silence cutter
      audio silence detector
      remove pauses from recording
      silence remover vs splitter
      remove silence audacity alternative
      automatically cut silence
  */
  alternates: { canonical: `${SITE_URL}/silence-remove` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/silence-remove`,
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

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Silence Remover", item: `${SITE_URL}/silence-remove` },
  ],
};

// HowTo JSON-LD removed. Google retired HowTo rich results for web
// search, so it earned nothing while adding a second copy of the steps
// that could drift out of sync with the visible ones below.

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
        ADDED. The page named no limit anywhere and hedged with "fair-use
        limits apply on file size" — no figure, on a tool whose readers are
        uploading hour-long podcast recordings. Both numbers come from /limits.
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
      // ADDED: no retention answer existed.
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-12">
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-text-primary">
            Free Silence Remover
          </h1>
          <p className="text-lg text-text-muted max-w-xl mx-auto">
            Cut dead air throughout a recording, not just the start and end,
            free, no sign-up, no watermark.
          </p>
        </header>

        <SilenceRemoveForm />

        {/* One bordered strip with hairline dividers, matching the other tool
            pages. The third cell now carries the limits, which the page
            previously never stated anywhere. */}
        <section className="grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { title: "Whole-file cleanup", desc: "Cuts gaps everywhere, not just the ends." },
            { title: "One-click ready", desc: "Sensible defaults, no tuning required." },
            {
              title: "No sign-up",
              desc:
                durationCap === null
                  ? `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB per file.`
                  : `No account, no email, no watermark. Up to ${limits.maxUploadMb}MB and ${durationLabel(durationCap)}.`,
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
          <h2 className="text-2xl font-bold text-text-primary">How to remove silence from audio</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an {formatList} file.</li>
            <li>Leave threshold and minimum gap length at their defaults, or adjust them.</li>
            <li>Download the result — shorter than the original, with dead air cut throughout.</li>
          </ol>
          {/* Rendered from allowed_audio_formats rather than a hand-written
              array. */}
          <div className="flex flex-wrap gap-2 pt-1">
            {formats.map((fmt) => (
              <span
                key={fmt}
                className="inline-flex items-center gap-1 rounded-full border border-graphite-800 bg-graphite-900 px-3 py-1 text-xs text-text-muted"
              >
                <span className="text-teal-400" aria-hidden>✓</span>
                {fmt}
              </span>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How silence detection works</h2>
          <p className="text-text-muted leading-relaxed">
            The tool scans the recording for stretches that fall below your
            chosen loudness threshold. Once a quiet stretch lasts longer than
            the minimum gap length you&apos;ve set, it&apos;s cut out
            entirely and the audio on either side is joined back together.
            Anything quieter than the threshold but shorter than the minimum
            gap — a brief pause between words, for instance — is left alone,
            since it doesn&apos;t meet both conditions at once.
          </p>
          <p className="text-text-muted leading-relaxed">
            That &quot;both conditions&quot; part is what makes the two
            settings work as a pair rather than independently, and it&apos;s
            why changing one often has no effect until you change the other
            too.
          </p>
        </section>

        {/* Three-way, not two-way. The tool people actually confuse this
            with is the Splitter, not the Trimmer — they detect identical
            gaps and differ only in what they do with them. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Silence Remover vs. Splitter vs. Trimmer
          </h2>
          <p className="text-text-muted leading-relaxed">
            Three tools that all cut audio, easy to pick the wrong one. The
            short version: the remover shortens one file, the splitter turns
            one file into several, and the trimmer keeps a section you choose
            yourself.
          </p>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
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
          <p className="text-text-muted leading-relaxed">
            Splitting one long recording into separate tracks instead?{" "}
            <Link href="/silence-split" className="text-amber-400 hover:underline">
              Silence Splitter
            </Link>{" "}
            uses the same detection to cut rather than delete. Keeping just one
            section?{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>{" "}
            is the better fit.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Choosing a threshold</h2>
          <p className="text-text-muted leading-relaxed">
            The defaults — -30dB threshold, 0.5 second minimum gap — handle most
            podcast and voice-memo cleanup without adjustment. When they
            don&apos;t, the symptom tells you which way to move:
          </p>
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
                  <td className="px-4 py-3">Gaps left behind, barely shorter</td>
                  <td className="px-4 py-3">
                    Raise the threshold toward -20dB — your room tone is louder
                    than the current setting
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Natural pauses cut, speech sounds rushed</td>
                  <td className="px-4 py-3">
                    Lower toward -40dB, or lengthen the minimum gap
                  </td>
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
          <p className="text-text-muted leading-relaxed">
            There&apos;s no correct preset for a given content type — it depends
            on how quiet your room tone is and how tightly you want the result
            edited. Preview and adjust rather than assuming one setting fits
            every recording.
          </p>
        </section>

        {/* Captures "how to remove silence in audacity" — high-volume, and
            a good share of those searchers would rather click one button
            than learn Truncate Silence. Saying plainly when Audacity is
            the better answer is what makes the rest of the page credible. */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Doing this in Audacity instead
          </h2>
          <p className="text-text-muted leading-relaxed">
            Audacity has a Truncate Silence effect that does the same job, with
            more control: it can shorten gaps to a set length rather than
            removing them outright, and you can undo, audition and re-run it on
            a selection while watching the waveform. If you&apos;re already
            editing in Audacity, or you need gaps shortened rather than
            deleted, that&apos;s the better tool.
          </p>
          {durationCap !== null && (
            <p className="text-text-muted leading-relaxed">
              It also has no length limit, which makes it the right answer for a
              recording longer than {durationLabel(durationCap)}.
            </p>
          )}
          <p className="text-text-muted leading-relaxed">
            This page exists for the other case: you have one file, you want the
            dead air gone, and installing a desktop editor to do it once
            isn&apos;t worth it. Upload, download, done — nothing to learn and
            nothing to install.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">When this is worth doing</h2>
          <p className="text-text-muted leading-relaxed">
            Anywhere a recording has more quiet in it than a listener will sit
            through. In practice that&apos;s three situations:
          </p>
          <ul className="list-disc list-inside space-y-1.5 text-text-muted leading-relaxed">
            <li>
              <strong className="text-text-primary">Spoken-word editing</strong>{" "}
              — podcasts, interviews and voice-overs, where scattered pauses
              add up to minutes across an episode and scrubbing for them by
              hand is the slowest part of the edit.
            </li>
            <li>
              <strong className="text-text-primary">Long-form recordings</strong>{" "}
              — lectures, audiobook chapters and meeting recordings with long
              quiet stretches between sections.
            </li>
            <li>
              <strong className="text-text-primary">Before further processing</strong>{" "}
              — less audio means less to transcribe, upload or store.
            </li>
          </ul>
          <p className="text-text-muted leading-relaxed">
            On that last point: cutting dead air first means less audio for{" "}
            <Link href="/audio-to-text" className="text-amber-400 hover:underline">
              Audio to Text
            </Link>{" "}
            to work through. If background noise rather than silence is the
            problem, the{" "}
            <Link href="/noise-remove" className="text-amber-400 hover:underline">
              Noise Remover
            </Link>{" "}
            or, for speech specifically, the{" "}
            <Link href="/voice-clean" className="text-amber-400 hover:underline">
              Voice Cleaner
            </Link>{" "}
            handle that instead — silence detection won&apos;t touch a
            continuous hiss, because it never falls below the threshold.
          </p>
          <p className="text-text-muted leading-relaxed">
            Want the full breakdown of how these two settings interact, and why
            cutting too aggressively can clip natural pauses?{" "}
            <Link href="/guides/editing-out-dead-air-podcasts" className="text-amber-400 hover:underline">
              Read Cutting Dead Air from Podcasts &amp; Recordings
            </Link>.
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

        <FAQSection faqs={faqs} />
      </main>
    </>
  );
}