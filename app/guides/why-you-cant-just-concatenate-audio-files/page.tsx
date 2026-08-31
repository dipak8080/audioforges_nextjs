import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Prose } from "@/components/ui/Prose";
import { ogForGuide } from "@/lib/og";

const guide = getGuideBySlug("why-you-cant-just-concatenate-audio-files")!;

const OG_IMAGE = ogForGuide(guide);

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: guide.title,
    description: guide.description,
    images: [OG_IMAGE.url],
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
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function AudioJoinerGuidePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <Breadcrumb
          items={[{ name: "Guides", href: "/guides" }, { name: guide.title }]}
          className="mb-8"
        />

        <header>
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        <Prose className="mt-10">
          <p>
            Joining audio files sounds like it should be the simplest editing task
            there is — stick file two onto the end of file one, done. But audio
            files aren&apos;t just interchangeable streams of sound; they&apos;re
            a specific number of samples per second, in a specific channel layout,
            and mixing those specifics without correcting for them first is
            exactly how a clean join turns into a file that plays part of itself
            at the wrong speed.
          </p>

          <h2 id="mismatch">What actually happens when formats don&apos;t match</h2>
          <p>
            A digital audio file&apos;s sample rate tells a player how many
            samples to play back per second — 44,100 for a file recorded at
            44.1kHz, 48,000 for one recorded at 48kHz. If two files with different
            sample rates get concatenated at the raw data level without
            correction, the player has no way to know that the second half of the
            file should be interpreted at a different rate than the first.
            Depending on how the join was done, the result is either a section
            that plays at the wrong speed and pitch, or a file that fails to play
            back correctly at the boundary at all. The same kind of problem
            applies to channel layout — joining a mono file directly onto a stereo
            one can produce similarly broken playback.
          </p>

          <h2 id="normalizing">Why normalizing before joining fixes it</h2>
          <p>
            The fix is to resample every input file to one common sample rate and
            match every file to one common channel layout before any joining
            happens — so by the time the actual concatenation occurs, every file
            being combined shares identical technical specifications, and
            there&apos;s nothing left to mismatch at the boundary. Our own Audio
            Joiner resamples every input to 44.1kHz before joining, which is why a
            file recorded at 48kHz and one recorded at 44.1kHz combine into one
            correctly-playing track instead of shifting speed partway through.
          </p>

          <h2 id="no-crossfade">
            What &quot;no gap, no crossfade&quot; actually means
          </h2>
          <p>
            Joining files end-to-end is different from mixing them with a
            transition. No gap is inserted between files, and no crossfade is
            algorithmically applied at the seam — whatever silence, or lack of
            silence, already exists at the very end of one file and the very start
            of the next is exactly what carries over into the joined result. If a
            file has a half-second of dead air trailing off before it ends, that
            dead air is still there in the merged file; if a file cuts off
            abruptly with no silence at all, the next file starts immediately with
            no buffer.
          </p>

          <h2 id="clean-transitions">Getting a clean transition between joined clips</h2>
          <p>
            Since nothing is added automatically at the seams, a clean transition
            is something you control before joining, not after. Trimming off
            unwanted dead air or a stray sound at the very end of one clip and the
            very start of the next, with the{" "}
            <Link href="/trim">Audio Trimmer</Link>, removes anything you
            don&apos;t want carrying over into the join point. Adding a short fade
            out to the end of one clip and a fade in to the start of the next,
            with the <Link href="/fade">Fade In/Out</Link> tool, smooths what
            would otherwise be an abrupt jump right at the seam between two files.
          </p>

          <h2 id="limits">Limits worth knowing</h2>
          <p>
            One join can combine up to 10 files, with a combined total of 150MB
            and up to 30 minutes of audio across all files together — not per
            file, but as a running total, since re-encoding ten four-minute files
            is a forty-minute job regardless of how short each one looks
            individually.
          </p>
          <p>
            Our <Link href="/audio-joiner">Audio Joiner</Link> handles the
            normalization and joining automatically — add your files, set the
            order, choose an output format, and download one merged track, no
            account or software install needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/audio-joiner" className={buttonStyles({ size: "lg" })}>
            Try the Audio Joiner
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}