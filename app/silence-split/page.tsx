import type { Metadata } from "next";
import Link from "next/link";
import { SilenceSplitForm } from "@/components/converter/SilenceSplitForm";
import { FAQSection } from "@/components/faq/FAQSection";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";

const PAGE_TITLE = "Free Silence Splitter Online — Split Audio by Silence";
const PAGE_DESCRIPTION =
  "Automatically split one long recording into separate audio tracks at silent gaps. Adjustable threshold and gap length. Free, no sign-up.";

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
    "Splits one file into up to 50 separate tracks",
    "Choice of output format",
    "No sign-up required",
    "No watermark",
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Silence Splitter", item: `${SITE_URL}/silence-split` },
  ],
};
// NOTE: No HowTo schema (deprecated by Google, desktop since Sept 2023 — no
// benefit remains). No separate FAQ schema added here either — check
// whether <FAQSection> already emits its own structured data before adding
// a second FAQPage block, to avoid duplicate schema on the page.

const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF"];

/** Same style as the convert/stems/fade/mono-stereo pages — clean mono
 *  badges, no check icons. Check icons are reserved for comparison tables. */
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

const faqs = [
  {
    question: "What is a silence splitter?",
    answer:
      "A silence splitter scans a recording for quiet gaps and uses qualifying gaps as cut points, turning one long file into several separate track files without deleting or altering any audio.",
  },
  {
    question: "How does splitting audio by silence actually work?",
    answer:
      "The tool measures loudness across the whole file. Any stretch that stays below your silence threshold for at least your minimum gap length becomes a split point. Everything between two split points — or between a split point and the start or end of the file — becomes its own output track.",
  },
  {
    question: "Can I split an MP3, WAV, or other format by silence?",
    answer:
      "Yes — MP3, WAV, FLAC, M4A, AAC, OGG, and AIFF are all supported as input, up to 80MB per upload.",
  },
  {
    question: "Can I split a DJ mix into individual tracks?",
    answer:
      "If the mix has genuine quiet gaps between songs, yes. Mixes that crossfade continuously from one track into the next often have no real silence to detect, so some manual adjustment — or a different tool entirely — may be needed for those.",
  },
  {
    question: "Can I split a vinyl rip into separate songs?",
    answer:
      "Yes, when there are quiet gaps between tracks on the recording — common on vinyl rips digitized with the natural pauses between songs intact.",
  },
  {
    question: "Can I split a podcast or interview by silence?",
    answer:
      "Yes, if there are long enough pauses at the points you want as boundaries. Ordinary pauses between sentences are usually much shorter than a real segment break, so a longer minimum gap length keeps normal speech from being split up unintentionally.",
  },
  {
    question: "What is the silence threshold?",
    answer:
      "It's the loudness level, in decibels, below which audio counts as \"quiet enough\" to potentially be silence. A more negative number (like -50dB) requires the audio to be quieter before it qualifies; a less negative number (like -20dB) is more lenient. The default is -30dB.",
  },
  {
    question: "What does minimum gap length control?",
    answer:
      "How long a quiet stretch has to last before it's treated as a real split point rather than a brief pause. The default is 0.5 seconds — a short breath or pause won't trigger a split, but a longer quiet stretch will.",
  },
  {
    question: "What should I do if it creates too many splits?",
    answer:
      "Try increasing the minimum gap length so only longer silences count, and check whether background noise in the recording is preventing genuinely quiet moments from being detected as silence.",
  },
  {
    question: "What should I do if it misses gaps I expected?",
    answer:
      "Try lowering the threshold (toward something like -50dB) so quieter transitions are caught, or shortening the minimum gap length if the pauses in your recording are brief.",
  },
  {
    question: "What happens if no silence is detected at all?",
    answer:
      "If nothing in the file meets your threshold and minimum-gap settings, there's nothing to split. This is common with continuously crossfaded music or recordings with constant background noise — try adjusting the settings, or use a different tool if the source genuinely has no quiet points.",
  },
  {
    question: "How many tracks can one upload produce?",
    answer:
      "Up to 50 segments per upload. Any segment shorter than 1 second is dropped automatically rather than kept as a near-empty fragment.",
  },
  {
    question: "Does splitting reduce audio quality?",
    answer:
      "Splitting itself doesn't alter the audio content — it only cuts at the points you specify. The resulting files go through the encoding process for whichever output format you choose, the same as any format conversion.",
  },
  {
    question: "Can I choose the output format?",
    answer:
      "Yes — pick one output format and every resulting segment is saved in that format, regardless of what you uploaded.",
  },
  {
    question: "Is this free, and do I need to sign up?",
    answer: "Yes, completely free, with no sign-up and no watermark on any resulting file.",
  },
];

export default function SilenceSplitPage() {
  const relatedTools = getRelatedTools("silence-split", 5);

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
            control exactly where it cuts — free, no sign-up, no watermark.
          </p>
        </header>

        {/* Tool stays first — SEO content supports it, doesn't bury it */}
        <SilenceSplitForm />

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "Automatic silence detection", desc: "Finds quiet gaps across the whole file instead of you scrubbing through it by hand." },
            { title: "Adjustable detection", desc: "Control the silence threshold and minimum gap length to decide what counts as a split point." },
            { title: "Up to 50 tracks", desc: "One long recording becomes as many separate, individually downloadable files as it has real gaps." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="text-sm text-text-muted">{f.desc}</p>
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
          <h2 className="text-2xl font-bold text-text-primary">How silence detection works</h2>
          <p className="text-text-muted leading-relaxed">
            The tool measures loudness continuously across the uploaded file.
            Any stretch that stays below your chosen silence threshold — a
            decibel level — for at least your minimum gap length is treated
            as a genuine split point. Everything between two split points (or
            between a split point and the start or end of the file) becomes
            its own separate output track. A quiet moment that&apos;s brief but
            doesn&apos;t last as long as the minimum gap length is left alone
            and doesn&apos;t create a split — this keeps a short breath or a
            quick transition from fragmenting the recording unnecessarily.
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
          <h2 className="text-2xl font-bold text-text-primary">Silence threshold and minimum gap length</h2>
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
              These two settings work together, and there&apos;s no single
              correct combination — it depends entirely on how the original
              recording was made. A podcast with long pauses between segments
              might need a longer minimum gap length than a DJ mix with
              shorter breaks between songs; a noisy field recording might need
              a less negative threshold than a clean studio take. The defaults
              above are a reasonable starting point, not a universal
              recommendation — previewing the result and adjusting from there
              is the most reliable approach.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">How to split audio by silence</h2>
          <ol className="list-decimal list-inside space-y-2 text-text-muted leading-relaxed">
            <li>Upload an MP3, WAV, FLAC, M4A, AAC, OGG, or AIFF file.</li>
            <li>Choose the output format for the resulting tracks.</li>
            <li>Set the silence threshold, or leave it at the -30dB default.</li>
            <li>Set the minimum gap length, or leave it at the 0.5 second default.</li>
            <li>Run the split.</li>
            <li>Preview and download each resulting track individually.</li>
          </ol>
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

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Silence Splitter vs. manual cutting</h2>
          <p className="text-text-muted leading-relaxed">
            If your recording doesn&apos;t have real silence at the points you
            want to cut — a continuous crossfaded mix, for example — automatic
            silence detection won&apos;t find those boundaries, because
            there&apos;s no acoustic gap for it to detect. In that case, manually
            marking exact start and end points with the{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>{" "}
            is the more reliable option — slower than automatic detection, but
            it works regardless of whether the source has any silence in it
            at all.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Silence Splitter vs. Silence Remover</h2>
          <div className="overflow-x-auto rounded-xl border border-graphite-800">
            <table className="w-full text-sm text-left text-text-muted">
              <thead className="bg-graphite-900 text-text-primary">
                <tr>
                  <th className="px-4 py-3 font-semibold">&nbsp;</th>
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
          <p className="text-text-muted leading-relaxed">
            Want to tighten a recording instead of dividing it up? The{" "}
            <Link href="/silence-remove" className="text-amber-400 hover:underline">
              Silence Remover
            </Link>{" "}
            deletes the same kind of gaps this tool detects, rather than
            cutting at them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Troubleshooting</h2>
          <div className="space-y-4 text-text-muted leading-relaxed">
            <div>
              <h3 className="font-semibold text-text-primary">Too many splits</h3>
              <p>
                Increase the minimum gap length so only longer silences
                count, and check whether background noise in the recording is
                keeping otherwise-quiet moments from registering as silence.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">Missing gaps you expected</h3>
              <p>
                Lower the threshold (toward something like -50dB) to catch
                quieter transitions, or shorten the minimum gap length if the
                pauses in your recording are brief.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">No silence detected at all</h3>
              <p>
                If nothing in the file meets your current settings,
                there&apos;s nothing to split — this is common on continuously
                crossfaded music or recordings with constant background
                noise. Try adjusting threshold and minimum gap length; if the
                source genuinely never goes quiet, silence-based splitting
                isn&apos;t the right tool for it.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Limitations</h2>
          <p className="text-text-muted leading-relaxed">
            Silence detection identifies quiet gaps based on your threshold
            and minimum gap settings — it doesn&apos;t recognize song titles,
            artists, chapter markers, or musical structure. It can&apos;t tell
            that a section is "the end of a song" except by measuring that the
            audio genuinely went quiet at that point. Continuous mixes without
            real silence, recordings with constant background noise, and
            transitions that fade directly from one section into the next
            without a true gap are all cases where this approach won&apos;t
            find a clean boundary, because there isn&apos;t an acoustic one to
            find.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Supported formats</h2>
          <FormatBadges />
          <p className="text-text-muted leading-relaxed">
            Upload any of the formats above, up to 80MB per file. Choose one
            output format and every resulting track is saved in that format.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Is silence splitting right for you?</h2>
          <p className="text-text-muted leading-relaxed">
            Use Silence Splitter when your recording has genuine quiet gaps at
            the points you want to divide it, and you&apos;d rather have those
            boundaries found automatically than mark them by hand. Reach for
            the{" "}
            <Link href="/trim" className="text-amber-400 hover:underline">
              Audio Trimmer
            </Link>{" "}
            instead if the source has no real silence to detect and you need
            exact manual cut points, or the{" "}
            <Link href="/silence-remove" className="text-amber-400 hover:underline">
              Silence Remover
            </Link>{" "}
            if you want those same gaps deleted rather than used as
            boundaries. Need the resulting tracks transcribed afterward? Each
            one works directly with{" "}
            <Link href="/speech-to-text" className="text-amber-400 hover:underline">
              Speech to Text
            </Link>
            .
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