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

const guide = getGuideBySlug("finding-reference-tracks")!;

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

export default function FindingReferenceTracksGuidePage() {
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
            A reference track only helps if it&apos;s actually comparable to what
            you&apos;re making. A vague &quot;I like the vibe of this&quot; pick
            rarely holds up once you&apos;re deep into a session — the useful
            references are the ones you chose for specific, nameable reasons.
          </p>

          <h2 id="specific-reason">
            Pick references for a specific reason, not a general one
          </h2>
          <p>
            &quot;I like this track&quot; isn&apos;t a reference criterion —
            it&apos;s a mood. A useful reference is chosen for something you can
            point to: the low-end weight, the vocal chain, the arrangement pacing,
            the way a specific transition is built. If you can&apos;t name what
            you want to borrow from it, it&apos;ll sit in the folder unused.
          </p>

          <h2 id="role-not-genre">Match the track&apos;s role, not just its genre</h2>
          <p>
            Two tracks in the same genre can serve completely different reference
            purposes. Before you grab something, decide what role it&apos;s
            filling: mix reference (level balance, low-end, stereo width),
            arrangement reference (structure, energy pacing, section lengths), or
            sound-design reference (a specific synth patch, a drum processing
            style). Grabbing a track without knowing its role is how reference
            folders turn into unused clutter.
          </p>

          <h2 id="usable-format">Get it into a format you can actually use</h2>
          <p>
            A reference track you can only stream isn&apos;t much use in a session
            — you want it sitting in your DAW next to your project, switchable
            with one click for A/B comparison. That means having a local WAV or
            high-bitrate MP3, not a browser tab. For anything you have the rights
            to pull locally — your own uploads, Creative Commons tracks,
            royalty-free material — our{" "}
            <Link href="/youtube-to-wav">YouTube to WAV converter</Link> gets you
            a usable local file in seconds instead of digging through an ad-heavy
            downloader site.
          </p>

          <h2 id="key-and-tempo">Know its key and tempo before you build around it</h2>
          <p>
            If you&apos;re building a track around a reference&apos;s energy or
            arrangement, knowing its key and BPM up front saves you from
            discovering a clash halfway through the session. Run it through a{" "}
            <Link href="/key-finder">key and BPM detector</Link> before you start
            layering your own elements against it, especially if you&apos;re
            sampling directly from it.
          </p>

          <h2 id="keep-it-small">Keep the reference folder small and current</h2>
          <p>
            A reference folder with 200 tracks in it isn&apos;t a reference folder
            — it&apos;s a graveyard. Keep it to what&apos;s actually relevant to
            your current session or project phase, and clear it out between
            projects. A handful of tracks you actually revisit is more useful than
            a huge archive you never open.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/youtube-to-wav" className={buttonStyles({ size: "lg" })}>
            Try the YouTube to WAV Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/key-finder"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Try the Key &amp; BPM Finder
          </Link>
        </div>
      </main>
    </>
  );
}