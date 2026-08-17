import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("what-is-lufs-loudness-explained")!;

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

export default function LufsGuidePage() {
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
            Two tracks can both peak at 0dB and still sound noticeably
            different in loudness when you play them back to back. That&apos;s
            the gap LUFS is built to close — it measures how loud something
            actually sounds over time, not just how high its loudest instant
            happens to reach. Understanding that difference explains both why
            streaming platforms normalize playback and why mastering to a
            LUFS target matters more than just watching a peak meter.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              LUFS vs. peak level
            </h2>
            <p>
              Peak level (measured in dBFS) is the highest instantaneous
              point the waveform reaches — a single spike can hit 0dB while
              the rest of the track sits far quieter around it. LUFS
              (Loudness Units relative to Full Scale) instead measures
              perceived loudness across the whole track, weighted to roughly
              match how human hearing responds to different frequencies. A
              densely compressed track and a quieter, more dynamic one can
              share the same peak level and still read completely differently
              in LUFS, because LUFS is measuring the average listening
              experience, not the single loudest moment.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why streaming platforms normalize playback
            </h2>
            <p>
              Spotify, YouTube, and Apple Music don&apos;t play tracks at
              whatever level they were mastered — each platform normalizes
              playback to its own loudness target, turning louder tracks down
              to match it. All three land in the same general neighborhood,
              around -14 LUFS. A track mastered significantly louder than that
              gets turned down on playback, and can end up sounding flatter or
              less punchy next to a track that was already close to the
              platform&apos;s target and needed little or no correction.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Streaming vs. club vs. broadcast targets
            </h2>
            <p>
              Different destinations expect genuinely different loudness
              levels, not just different formats. Streaming platforms target
              around -14 LUFS. Club and DJ material is conventionally
              mastered louder, closer to -9 LUFS, matching what a system built
              for a loud room expects. Broadcast follows the EBU R128 / ATSC
              A/85 standard of -23 LUFS, considerably quieter than either,
              reflecting a different listening environment and regulatory
              standard entirely. None of these is the "correct" loudness in
              any absolute sense — each is calibrated to where the audio is
              actually going to be heard.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why two-pass measurement matters
            </h2>
            <p>
              A single-pass loudness correction estimates the needed
              adjustment in real time as it streams through the file — a
              reasonable approximation, but one that can miss the actual
              target by a noticeable margin on a track with uneven loudness
              throughout, since it never gets a full picture of the whole
              file before adjusting. Two-pass processing measures the
              track&apos;s true integrated loudness, true peak, and loudness
              range first, with the entire file already analyzed, then
              applies the exact correction those measurements call for. The
              output&apos;s true peak is also held below full scale rather
              than right up against it, leaving headroom so the correction
              itself doesn&apos;t introduce clipping on top of the level
              change.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What loudness normalization doesn't fix
            </h2>
            <p>
              Normalizing to a LUFS target adjusts the track&apos;s overall
              level to match a destination's expected loudness — it doesn&apos;t
              rebalance a mix, fix clipping or distortion that&apos;s already
              baked into the source, or add dynamics back into something that
              was over-compressed during mastering. If the underlying mix has
              problems, normalizing it to -14 LUFS will hand you the same
              problems at a different overall volume, not a corrected mix.
            </p>
            <p>
              Our{" "}
              <Link href="/loudness-normalizer" className="text-amber-400 hover:underline">
                LUFS Loudness Normalizer
              </Link>{" "}
              runs this exact two-pass process — upload a track, pick a
              streaming, club, or broadcast target (or set a custom LUFS
              value), and download the result, no account or software install
              needed.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/loudness-normalizer"
            className={buttonStyles({ size: "lg" })}
          >
            Try the LUFS Loudness Normalizer
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}