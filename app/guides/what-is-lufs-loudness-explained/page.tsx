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

const guide = getGuideBySlug("what-is-lufs-loudness-explained")!;

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

export default function LufsGuidePage() {
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
            Two tracks can both peak at 0dB and still sound noticeably different
            in loudness when you play them back to back. That&apos;s the gap LUFS
            is built to close — it measures how loud something actually sounds
            over time, not just how high its loudest instant happens to reach.
            Understanding that difference explains both why streaming platforms
            normalize playback and why mastering to a LUFS target matters more
            than just watching a peak meter.
          </p>

          <h2 id="lufs-vs-peak">LUFS vs. peak level</h2>
          <p>
            Peak level (measured in dBFS) is the highest instantaneous point the
            waveform reaches — a single spike can hit 0dB while the rest of the
            track sits far quieter around it. LUFS (Loudness Units relative to
            Full Scale) instead measures perceived loudness across the whole
            track, weighted to roughly match how human hearing responds to
            different frequencies. A densely compressed track and a quieter, more
            dynamic one can share the same peak level and still read completely
            differently in LUFS, because LUFS is measuring the average listening
            experience, not the single loudest moment.
          </p>

          <h2 id="normalization">Why streaming platforms normalize playback</h2>
          <p>
            Spotify, YouTube, and Apple Music don&apos;t play tracks at whatever
            level they were mastered — each platform normalizes playback to its
            own loudness target, turning louder tracks down to match it. All three
            land in the same general neighborhood, around -14 LUFS. A track
            mastered significantly louder than that gets turned down on playback,
            and can end up sounding flatter or less punchy next to a track that
            was already close to the platform&apos;s target and needed little or
            no correction.
          </p>

          <h2 id="targets">Streaming vs. club vs. broadcast targets</h2>
          <p>
            Different destinations expect genuinely different loudness levels, not
            just different formats. Streaming platforms target around -14 LUFS.
            Club and DJ material is conventionally mastered louder, closer to -9
            LUFS, matching what a system built for a loud room expects. Broadcast
            follows the EBU R128 / ATSC A/85 standard of -23 LUFS, considerably
            quieter than either, reflecting a different listening environment and
            regulatory standard entirely. None of these is the &quot;correct&quot;
            loudness in any absolute sense — each is calibrated to where the audio
            is actually going to be heard.
          </p>

          <h2 id="two-pass">Why two-pass measurement matters</h2>
          <p>
            A single-pass loudness correction estimates the needed adjustment in
            real time as it streams through the file — a reasonable approximation,
            but one that can miss the actual target by a noticeable margin on a
            track with uneven loudness throughout, since it never gets a full
            picture of the whole file before adjusting. Two-pass processing
            measures the track&apos;s true integrated loudness, true peak, and
            loudness range first, with the entire file already analyzed, then
            applies the exact correction those measurements call for. The
            output&apos;s true peak is also held below full scale rather than
            right up against it, leaving headroom so the correction itself
            doesn&apos;t introduce clipping on top of the level change.
          </p>

          <h2 id="what-it-doesnt-fix">
            What loudness normalization doesn&apos;t fix
          </h2>
          <p>
            Normalizing to a LUFS target adjusts the track&apos;s overall level to
            match a destination&apos;s expected loudness — it doesn&apos;t
            rebalance a mix, fix clipping or distortion that&apos;s already baked
            into the source, or add dynamics back into something that was
            over-compressed during mastering. If the underlying mix has problems,
            normalizing it to -14 LUFS will hand you the same problems at a
            different overall volume, not a corrected mix.
          </p>
          <p>
            Our <Link href="/loudness-normalizer">LUFS Loudness Normalizer</Link>{" "}
            runs this exact two-pass process — upload a track, pick a streaming,
            club, or broadcast target (or set a custom LUFS value), and download
            the result, no account or software install needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/loudness-normalizer" className={buttonStyles({ size: "lg" })}>
            Try the LUFS Loudness Normalizer
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}