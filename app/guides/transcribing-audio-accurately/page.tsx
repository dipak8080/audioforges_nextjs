import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";

const guide = getGuideBySlug("transcribing-audio-accurately")!;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${guide.slug}`,
    siteName: "AudioForges",
    type: "article",
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
    title: guide.title,
    description: guide.description,
    images: ["/images/og-default.png"],
  },
};

const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: guide.title,
  description: guide.description,
  datePublished: guide.publishedDate,
  dateModified: guide.updatedDate,
  author: { "@type": "Organization", name: "AudioForges" },
  // Ties the Article to this exact URL. Without it, a syndicated or
  // scraped copy is just as valid a candidate for the schema as the
  // original.
  mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/guides/${guide.slug}` },
};

// FAQSection emits the FAQPage schema from this array, so the visible
// answers and the structured data can't drift apart. These are written
// as standalone answers — a rich result shows them without the
// surrounding page, so each has to make sense cold.
const faqs: FAQItem[] = [
  {
    question: "Why is my transcript inaccurate?",
    answer:
      "In most cases the audio is the limiting factor, not the model. Background noise, two people talking over each other, very quiet or clipped recording levels, and heavy accents all produce more errors. Cleaning up the recording before transcribing usually improves the result more than anything else you can change.",
  },
  {
    question: "Should I pick the language or let it detect automatically?",
    answer:
      "Auto-detection is reliable for a clear recording in a single language. Choose the language yourself for clips under about thirty seconds, heavy accents, or audio that mixes two languages — detection works from the opening seconds, so a short or ambiguous start is where it goes wrong.",
  },
  {
    question: "What's the difference between SRT and VTT?",
    answer:
      "Both are timed caption formats and both carry the same text. SRT numbers each caption block and uses a comma before milliseconds; VTT starts with a WEBVTT header line and uses a period. Use SRT for video editors and most upload forms, VTT for HTML5 video on the web.",
  },
  {
    question: "Can I transcribe a file longer than 20 minutes?",
    answer:
      "Not in one pass — 20 minutes is the per-file limit. Split the recording into sections first and transcribe each one, then join the transcripts. Timestamps restart at zero for each section, so add the offset if you're building captions.",
  },
  {
    question: "Can I get an English transcript from audio in another language?",
    answer:
      "Yes. Choosing English output translates as it transcribes, in a single pass, at no extra cost. English is the only target language available — for any other pairing you'd need to translate the finished transcript separately.",
  },
];

export default function TranscribingAccuratelyGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-10">
        <header className="space-y-3">
          <Link href="/guides" className="text-sm text-amber-400 hover:underline">
            ← All guides
          </Link>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-text-primary">
            {guide.title}
          </h1>
        </header>

        <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />

        <div className="space-y-6 text-text-muted leading-relaxed">
          <p>
            Transcription accuracy isn&apos;t only a property of the model doing
            the work — it&apos;s heavily shaped by the audio you feed it and the
            settings you choose. The same engine can produce a near-perfect
            transcript from a clean recording and a noticeably rougher one from
            a noisy file, with nothing about the model changing at all. Most of
            what separates those two outcomes is under your control.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What actually degrades accuracy
            </h2>
            <p>
              A few specific conditions reliably cause more errors, regardless
              of which engine is doing the work:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-text-primary">Background noise</strong>{" "}
                — hiss, hum, or ambient sound competing with the voice makes it
                harder to isolate speech from everything else in the signal.
              </li>
              <li>
                <strong className="text-text-primary">Overlapping speech</strong>{" "}
                — two people talking at once is genuinely difficult for any
                transcription system, since it has to separate simultaneous
                voices rather than recognize one continuous stream.
              </li>
              <li>
                <strong className="text-text-primary">Low recording volume or clipping</strong>{" "}
                — audio that&apos;s too quiet, or distorted from being too loud,
                both reduce the clarity available to work with.
              </li>
              <li>
                <strong className="text-text-primary">Heavy accents or unclear speech</strong>{" "}
                — mumbled, fast, or heavily accented delivery is harder than
                clearly enunciated speech, though this narrows considerably with
                larger models.
              </li>
              <li>
                <strong className="text-text-primary">Music under the voice</strong>{" "}
                — a podcast intro bed or a busy field recording competes
                directly with the speech you want.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Clean the audio before you transcribe it, not after
            </h2>
            <p>
              Background noise is both the most common cause of transcription
              errors and the most fixable one, which makes it the biggest lever
              you actually control. Running a noisy recording through a cleanup
              step first addresses the problem at source. This matters most for
              audio recorded outside a controlled environment — phone
              recordings, field interviews, voice memos picked up in a busy room
              — where the recording itself, not the transcription engine, is
              what&apos;s limiting the result.
            </p>
            <p>
              If music is the problem rather than noise, separating the vocal
              first is more effective than any denoiser: a{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:underline">
                vocal removal
              </Link>{" "}
              pass gives you a speech-only track to transcribe.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Tell it the language when detection is likely to struggle
            </h2>
            <p>
              Automatic language detection works from the opening seconds of the
              audio, which is exactly why it fails in predictable situations. A
              thirty-second clip gives it very little to go on. A recording that
              opens with English pleasantries before switching to another
              language will be labelled English. Two languages alternating
              throughout will be assigned whichever one happened to come first.
            </p>
            <p>
              Choosing the language yourself removes that guesswork entirely.
              It&apos;s worth doing whenever the clip is short, the speaker has
              a strong accent, or the audio mixes languages — and it costs
              nothing, since the model is the same either way. For clear,
              single-language recordings over a minute or so, auto-detection is
              reliable enough that setting it manually gains you little.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Transcribing versus translating
            </h2>
            <p>
              These are two different operations that people often conflate.
              Transcribing writes down what was said in the language it was
              said in. Translating produces English text from
              non-English speech, in the same single pass — you don&apos;t
              transcribe first and translate afterwards.
            </p>
            <p>
              The practical consequence: English is the only translation target
              available. Spanish audio can become Spanish text or English text,
              but not French text. For any other pairing, transcribe in the
              source language and translate the finished text separately.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              TXT, SRT or VTT: which export to choose
            </h2>
            <p>
              All three carry the same words. What differs is whether timing
              travels with them, and how that timing is written.
            </p>
            <div className="overflow-x-auto rounded-xl border border-graphite-800">
              <table className="w-full text-left text-sm text-text-muted">
                <thead className="bg-graphite-900 text-text-primary">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Format</th>
                    <th className="px-4 py-3 font-semibold">Use it for</th>
                    <th className="px-4 py-3 font-semibold">Timing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800">
                  <tr>
                    <td className="px-4 py-3 font-mono text-text-primary">TXT</td>
                    <td className="px-4 py-3">
                      Reading back, searching for a quote, pasting into notes
                    </td>
                    <td className="px-4 py-3">None</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-text-primary">SRT</td>
                    <td className="px-4 py-3">
                      Video editors, YouTube and most caption upload forms
                    </td>
                    <td className="px-4 py-3">Numbered blocks, comma before milliseconds</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-text-primary">VTT</td>
                    <td className="px-4 py-3">
                      HTML5 video on the web, via a &lt;track&gt; element
                    </td>
                    <td className="px-4 py-3">WEBVTT header, period before milliseconds</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              That comma-versus-period distinction is the single most common
              reason a caption file silently fails to load. If an editor
              accepts your file but shows no captions, that&apos;s the first
              thing to check.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Working with recordings longer than 20 minutes
            </h2>
            <p>
              Twenty minutes is the per-file limit. A longer recording needs
              splitting first — either at a sensible break point with a{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                trim
              </Link>
              , or automatically at the natural pauses using the{" "}
              <Link href="/silence-split" className="text-amber-400 hover:underline">
                silence splitter
              </Link>
              , which tends to produce cleaner boundaries than cutting at a
              fixed time.
            </p>
            <p>
              One thing to watch when reassembling: timestamps restart from zero
              in each section&apos;s transcript. Joining plain text is
              straightforward, but building captions from split sections means
              adding each section&apos;s start offset to its timings first.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What to expect on speed
            </h2>
            <p>
              Transcription runs on a GPU worker that spins down when
              it&apos;s idle. In practice that means the wait is dominated by
              startup rather than by the length of your file: the first run
              after a quiet period takes about a minute to begin, and once
              the worker is warm a ten-minute recording finishes in well under
              a minute.
            </p>
            <p>
              The counterintuitive consequence is that a thirty-second voice
              memo and a ten-minute podcast often take roughly the same wall
              time. If a short clip seems to be taking a while, that&apos;s
              almost always a cold start rather than a problem with your file.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A practical workflow
            </h2>
            <p>
              Put together, the order that gets the best result from the least
              effort:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-2">
              <li>
                Trim to just the part you need — shorter audio means less to go
                wrong, and it keeps you under the length limit.
              </li>
              <li>
                Clean up noticeable noise with the{" "}
                <Link href="/voice-clean" className="text-amber-400 hover:underline">
                  Voice Cleaner
                </Link>
                , or the{" "}
                <Link href="/noise-remove" className="text-amber-400 hover:underline">
                  Noise Remover
                </Link>{" "}
                when you want manual control over how aggressive it is.
              </li>
              <li>
                Set the language if the clip is short, accented, or mixes
                languages.
              </li>
              <li>
                Transcribe with{" "}
                <Link href="/audio-to-text" className="text-amber-400 hover:underline">
                  Audio to Text
                </Link>
                , or paste a link into{" "}
                <Link href="/youtube-to-text" className="text-amber-400 hover:underline">
                  YouTube to Text
                </Link>{" "}
                to skip the download step entirely.
              </li>
              <li>
                Export TXT to read, SRT or VTT to caption — and check the
                transcript against the audio before you publish it.
              </li>
            </ol>
            <p>
              Working from video rather than audio?{" "}
              <Link href="/video-to-text" className="text-amber-400 hover:underline">
                Video to Text
              </Link>{" "}
              takes MP4, MOV, MKV and WEBM directly, so there&apos;s no need to
              extract the audio track first.
            </p>
          </section>
        </div>

        <FAQSection eyebrow="Questions" faqs={faqs} />

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link href="/audio-to-text" className={buttonStyles({ size: "lg" })}>
            Try Audio to Text
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/voice-clean"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Voice Cleaner
          </Link>
        </div>
      </main>
    </>
  );
}