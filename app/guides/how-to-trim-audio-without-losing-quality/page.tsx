import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("how-to-trim-audio-without-losing-quality")!;

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

export default function HowToTrimAudioGuidePage() {
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
            &quot;Trimming loses quality&quot; and &quot;trimming is always safe&quot;
            are both oversimplifications. The real answer depends on what format
            you&apos;re trimming and exactly where you place your cut point — and
            once you know why, it&apos;s easy to avoid the one artifact that
            actually shows up: a click or pop right at the edit.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What &quot;no quality loss&quot; actually means
            </h2>
            <p>
              Trimming isn&apos;t re-encoding — it&apos;s selecting a range and
              discarding everything outside it. That means the audio data inside
              your selected range is untouched; you&apos;re not passing it back
              through a lossy encoder and taking a second hit of compression. Any
              quality &quot;loss&quot; people associate with trimming is really
              about a different problem: a bad cut point, not the trim operation
              itself.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Lossless formats: the cut is bit-perfect
            </h2>
            <p>
              For WAV, FLAC, and AIFF, samples are stored individually with no
              compression, so a trim can land exactly on the sample you want. Cut
              at 12.487 seconds and you get audio starting at exactly 12.487
              seconds — no rounding, no nearby frame standing in for the point you
              actually picked.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Lossy formats: cuts snap to frame boundaries
            </h2>
            <p>
              MP3, AAC, and OGG store audio in compressed frames, each covering a
              small fixed slice of time (for MP3, roughly 26 milliseconds per
              frame). A cut can only land cleanly on a frame boundary — if your
              selected point falls in the middle of a frame, the trim snaps to the
              nearest boundary, which can shift your cut by a few milliseconds.
              For almost every real use case that&apos;s inaudible, but it&apos;s
              why frame-based formats aren&apos;t quite as surgically precise as
              lossless ones.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The artifact that actually matters: the click at your cut point
            </h2>
            <p>
              This is the thing that actually ruins a trimmed clip, and it has
              nothing to do with format. If your cut point lands mid-waveform
              rather than at a zero-crossing (where the waveform crosses silence),
              you get an abrupt jump in amplitude — heard as a click or pop right
              at the start or end of the clip. It&apos;s the single most common
              reason a trimmed file sounds &quot;off&quot; even though no data was
              lost. Picking a cut point right before or after a natural pause in
              the audio — a breath, a beat gap, a moment of near-silence — avoids
              this almost entirely.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A practical workflow
            </h2>
            <p>
              Zoom in on the waveform around your intended start and end points
              rather than trusting a rough timestamp. Look for a spot where the
              waveform is at or near zero amplitude — a pause, a breath, the tail
              of a note decaying — and place your cut there instead of mid-sound.
              If you need the clip in a different format afterward, trim first,
              then convert; trimming a smaller file is faster and keeps the
              original quality intact through the process. Our{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>{" "}
              lets you drag directly on the waveform to find that clean cut point,
              and keeps your file in its original format so there&apos;s no extra
              re-encoding step. If you do need a different format after trimming,
              the{" "}
              <Link href="/convert" className="text-amber-400 hover:underline">
                Format Converter
              </Link>{" "}
              handles that as a separate step.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/trim"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Audio Trimmer
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/convert"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Format Converter
          </Link>
        </div>
      </main>
    </>
  );
}