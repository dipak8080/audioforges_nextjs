import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("why-you-cant-just-concatenate-audio-files")!;

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
  publisher: { "@type": "Organization", name: "AudioForges" },
  image: `${SITE_URL}/images/og-default.png`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
};

export default function AudioJoinerGuidePage() {
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
            Joining audio files sounds like it should be the simplest editing
            task there is — stick file two onto the end of file one, done.
            But audio files aren&apos;t just interchangeable streams of sound;
            they're a specific number of samples per second, in a specific
            channel layout, and mixing those specifics without correcting for
            them first is exactly how a clean join turns into a file that
            plays part of itself at the wrong speed.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What actually happens when formats don't match
            </h2>
            <p>
              A digital audio file's sample rate tells a player how many
              samples to play back per second — 44,100 for a file recorded at
              44.1kHz, 48,000 for one recorded at 48kHz. If two files with
              different sample rates get concatenated at the raw data level
              without correction, the player has no way to know that the
              second half of the file should be interpreted at a different
              rate than the first. Depending on how the join was done, the
              result is either a section that plays at the wrong speed and
              pitch, or a file that fails to play back correctly at the
              boundary at all. The same kind of problem applies to channel
              layout — joining a mono file directly onto a stereo one can
              produce similarly broken playback.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why normalizing before joining fixes it
            </h2>
            <p>
              The fix is to resample every input file to one common sample
              rate and match every file to one common channel layout before
              any joining happens — so by the time the actual concatenation
              occurs, every file being combined shares identical technical
              specifications, and there&apos;s nothing left to mismatch at the
              boundary. Our own Audio Joiner resamples every input to 44.1kHz
              before joining, which is why a file recorded at 48kHz and one
              recorded at 44.1kHz combine into one correctly-playing track
              instead of shifting speed partway through.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What "no gap, no crossfade" actually means
            </h2>
            <p>
              Joining files end-to-end is different from mixing them with a
              transition. No gap is inserted between files, and no crossfade
              is algorithmically applied at the seam — whatever silence, or
              lack of silence, already exists at the very end of one file and
              the very start of the next is exactly what carries over into
              the joined result. If a file has a half-second of dead air
              trailing off before it ends, that dead air is still there in
              the merged file; if a file cuts off abruptly with no silence at
              all, the next file starts immediately with no buffer.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Getting a clean transition between joined clips
            </h2>
            <p>
              Since nothing is added automatically at the seams, a clean
              transition is something you control before joining, not after.
              Trimming off unwanted dead air or a stray sound at the very end
              of one clip and the very start of the next, with the{" "}
              <Link href="/trim" className="text-amber-400 hover:underline">
                Audio Trimmer
              </Link>
              , removes anything you don&apos;t want carrying over into the
              join point. Adding a short fade out to the end of one clip and
              a fade in to the start of the next, with the{" "}
              <Link href="/fade" className="text-amber-400 hover:underline">
                Fade In/Out
              </Link>{" "}
              tool, smooths what would otherwise be an abrupt jump right at
              the seam between two files.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Limits worth knowing
            </h2>
            <p>
              One join can combine up to 10 files, with a combined total of
              150MB and up to 30 minutes of audio across all files together —
              not per file, but as a running total, since re-encoding ten
              four-minute files is a forty-minute job regardless of how short
              each one looks individually.
            </p>
            <p>
              Our{" "}
              <Link href="/audio-joiner" className="text-amber-400 hover:underline">
                Audio Joiner
              </Link>{" "}
              handles the normalization and joining automatically — add your
              files, set the order, choose an output format, and download one
              merged track, no account or software install needed.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/audio-joiner"
            className={buttonStyles({ size: "lg" })}
          >
            Try the Audio Joiner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}