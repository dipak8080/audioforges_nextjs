import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

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
};

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
            Speech-to-text accuracy isn&apos;t just a property of the model
            you&apos;re using — it&apos;s heavily shaped by the audio you feed
            it. The same transcription engine can produce a near-perfect
            transcript from a clean recording and a noticeably rougher one from
            a noisy or poorly recorded file, without anything about the
            underlying model changing at all.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What actually degrades accuracy
            </h2>
            <p>
              A few specific conditions reliably cause more transcription
              errors, regardless of which engine is doing the work:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-text-primary">Background noise</strong>{" "}
                — hiss, hum, or ambient sound competing with the voice makes it
                harder for the model to isolate speech from everything else in
                the signal.
              </li>
              <li>
                <strong className="text-text-primary">Overlapping speech</strong>{" "}
                — two people talking at once is genuinely difficult for any
                transcription system, since it has to separate simultaneous
                voices rather than just recognize one continuous stream.
              </li>
              <li>
                <strong className="text-text-primary">Low recording volume or clipping</strong>{" "}
                — audio that&apos;s too quiet or distorted from being too loud
                both reduce the clarity a model has to work with.
              </li>
              <li>
                <strong className="text-text-primary">Heavy accents or unclear speech</strong>{" "}
                — models trained on typical speech patterns can struggle more
                with mumbled, fast, or heavily accented delivery.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why cleaning up audio first improves the transcript
            </h2>
            <p>
              Since background noise is one of the most common and most fixable
              causes of transcription errors, running a noisy recording through
              a cleanup step before transcribing it directly addresses the
              biggest lever you actually control. This matters most for
              recordings made outside a controlled environment — phone
              recordings, field interviews, voice memos picked up in a noisy
              room — where the source audio itself, not the transcription
              engine, is the limiting factor on accuracy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Timestamps and export formats
            </h2>
            <p>
              A transcript with per-segment timestamps is useful for more than
              just reading text back — it&apos;s what makes an SRT caption
              export possible, since captions need to know exactly when each
              line of text should appear and disappear on screen. If your goal
              is captions for a video, make sure you&apos;re exporting to SRT
              rather than plain text; if you just need searchable text to pull
              quotes from, plain text is simpler to work with.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Setting realistic expectations on speed
            </h2>
            <p>
              Transcription is meaningfully slower than most other audio
              processing tasks, because CPU-based transcription models process
              a file sequentially rather than in the near-instant way a format
              conversion or a simple effect can run. A longer file taking
              several minutes to transcribe is expected behavior for this kind
              of tool, not a sign something&apos;s wrong — budget for that wait
              time rather than expecting the same near-instant turnaround as
              trimming or converting a file.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A practical workflow
            </h2>
            <p>
              If your source recording has noticeable background noise, run it
              through cleanup before transcribing rather than after — you want
              the transcription model working from the cleanest version of the
              audio available. Our{" "}
              <Link href="/speech-to-text" className="text-amber-400 hover:underline">
                Speech to Text
              </Link>{" "}
              tool auto-detects language and exports as plain text or SRT
              captions. For noisy speech recordings, running the file through
              the{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:underline">
                Voice Cleaner
              </Link>{" "}
              first is a straightforward way to improve transcription accuracy
              before you start.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/speech-to-text"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try Speech to Text
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