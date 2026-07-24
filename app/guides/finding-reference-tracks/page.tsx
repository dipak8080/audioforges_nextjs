import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("finding-reference-tracks")!;

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
  author: { "@type": "Person", name: "AudioForges" },
};

export default function FindingReferenceTracksGuidePage() {
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
            A reference track only helps if it&apos;s actually comparable to what
            you&apos;re making. A vague &quot;I like the vibe of this&quot; pick
            rarely holds up once you&apos;re deep into a session — the useful
            references are the ones you chose for specific, nameable reasons.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Pick references for a specific reason, not a general one
            </h2>
            <p>
              &quot;I like this track&quot; isn&apos;t a reference criterion —
              it&apos;s a mood. A useful reference is chosen for something you can
              point to: the low-end weight, the vocal chain, the arrangement pacing,
              the way a specific transition is built. If you can&apos;t name what
              you want to borrow from it, it&apos;ll sit in the folder unused.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Match the track&apos;s role, not just its genre
            </h2>
            <p>
              Two tracks in the same genre can serve completely different reference
              purposes. Before you grab something, decide what role it&apos;s
              filling: mix reference (level balance, low-end, stereo width),
              arrangement reference (structure, energy pacing, section lengths), or
              sound-design reference (a specific synth patch, a drum processing
              style). Grabbing a track without knowing its role is how reference
              folders turn into unused clutter.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Get it into a format you can actually use
            </h2>
            <p>
              A reference track you can only stream isn&apos;t much use in a
              session — you want it sitting in your DAW next to your project,
              switchable with one click for A/B comparison. That means having a
              local WAV or high-bitrate MP3, not a browser tab. For anything you
              have the rights to pull locally — your own uploads, Creative Commons
              tracks, royalty-free material — our{" "}
              <Link href="/youtube-to-wav" className="text-amber-400 hover:underline">
                YouTube to WAV converter
              </Link>{" "}
              gets you a usable local file in seconds instead of digging through an
              ad-heavy downloader site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Know its key and tempo before you build around it
            </h2>
            <p>
              If you&apos;re building a track around a reference&apos;s energy or
              arrangement, knowing its key and BPM up front saves you from
              discovering a clash halfway through the session. Run it through a{" "}
              <Link href="/key-finder" className="text-amber-400 hover:underline">
                key and BPM detector
              </Link>{" "}
              before you start layering your own elements against it, especially if
              you&apos;re sampling directly from it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Keep the reference folder small and current
            </h2>
            <p>
              A reference folder with 200 tracks in it isn&apos;t a reference
              folder — it&apos;s a graveyard. Keep it to what&apos;s actually
              relevant to your current session or project phase, and clear it out
              between projects. A handful of tracks you actually revisit is more
              useful than a huge archive you never open.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/youtube-to-wav"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the YouTube to WAV Converter
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/key-finder"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Key &amp; BPM Finder
          </Link>
        </div>
      </main>
    </>
  );
}