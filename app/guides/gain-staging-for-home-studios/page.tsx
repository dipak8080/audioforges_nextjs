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

const guide = getGuideBySlug("gain-staging-for-home-studios")!;

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

export default function GainStagingGuidePage() {
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
            &quot;Just turn it up&quot; is the most common gain-staging mistake in
            a home studio. Volume isn&apos;t a single knob you crank until
            something sounds loud enough — it&apos;s a budget you spend across
            every stage of a recording, and running out of it at the wrong point
            is what causes distortion, not the loudness itself.
          </p>

          <h2 id="what-is-a-decibel">What a decibel actually represents</h2>
          <p>
            Digital audio has a hard ceiling — 0dBFS (decibels relative to full
            scale) — above which a format simply cannot represent a louder sample.
            Every gain adjustment is measured relative to that ceiling or relative
            to the file&apos;s current level, not as an absolute loudness value. A
            +6dB boost roughly doubles perceived loudness; a +10dB boost is a
            clear, obvious jump. That&apos;s why small moves near the top of a
            gain range go a long way, and why pushing toward the extreme end of
            the range compounds fast.
          </p>

          <h2 id="clipping">Why clipping happens at the top of the range</h2>
          <p>
            Clipping isn&apos;t a separate bug you can avoid with a setting —
            it&apos;s what happens whenever a boosted sample tries to exceed 0dBFS
            and gets flattened at the ceiling instead. The louder your source
            material already is, the less headroom you have before a boost pushes
            peaks past that ceiling. A quiet recording with a lot of headroom can
            take a large boost cleanly; a recording that&apos;s already close to
            peaking will clip at a much smaller boost. This is why the same gain
            value can sound perfectly clean on one recording and distorted on
            another — it depends entirely on how much headroom the source had to
            begin with.
          </p>

          <h2 id="ranges">Reasonable ranges to start from</h2>
          <p>
            As a starting point rather than a hard rule: a boost of{" "}
            <strong>+6dB to +10dB</strong> is usually enough to noticeably lift a
            quiet recording without heavy clipping risk on typical source
            material. On the reduction side, <strong>-6dB to -10dB</strong> is
            enough to bring a too-loud recording down to a comfortable level while
            keeping it clearly audible. Anything pushed much further toward either
            extreme starts trading audibility for distortion or near-silence —
            that&apos;s the physical tradeoff of gain, not a limitation of a
            specific tool.
          </p>

          <h2 id="workflow">Where gain staging fits in your workflow</h2>
          <p>
            Set your overall gain level early, before other processing — EQ,
            compression, and effects all respond differently depending on how hot
            the signal coming into them already is. Boosting gain after heavy
            processing means you&apos;re also boosting whatever artifacts that
            processing introduced. If you&apos;re not sure whether a recording
            needs a level fix, that&apos;s usually the first thing to check before
            reaching for any other tool — a recording that&apos;s too quiet or too
            hot will make every later step harder to judge accurately.
          </p>
          <p>
            Our <Link href="/volume">Volume Booster</Link> gives you the full
            -30dB to +30dB range on any upload, so you can set a clean starting
            level before doing anything else to a recording.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/volume" className={buttonStyles({ size: "lg" })}>
            Try the Volume Booster
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/trim"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Try the Audio Trimmer
          </Link>
        </div>
      </main>
    </>
  );
}