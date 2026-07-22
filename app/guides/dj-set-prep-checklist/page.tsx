import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";

const guide = getGuideBySlug("dj-set-prep-checklist")!;

export const metadata: Metadata = {
  title: "DJ Set Prep Checklist",
  description: guide.description,
  alternates: { canonical: `${SITE_URL}/guides/${guide.slug}` },
  openGraph: {
    title: guide.title,
    description: guide.description,
    url: `${SITE_URL}/guides/${guide.slug}`,
    siteName: "AudioForges",
    type: "article",
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

export default function DjSetPrepGuidePage() {
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
          <p className="text-sm text-text-subtle">
            Published {new Date(guide.publishedDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </header>

        <div className="space-y-6 text-text-muted leading-relaxed">
          <p>
            Most set prep problems don&apos;t show up in the studio — they show up
            mid-set, when you&apos;re digging for a track you tagged wrong three
            weeks ago. A little structure up front saves you from thinking on your
            feet later.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              1. Gather wider than you&apos;ll use
            </h2>
            <p>
              Pull in more candidate tracks than you actually need for the set —
              roughly double. Sets get built by cutting, not by finding exactly the
              right number of tracks on the first pass. If you only gather what
              you think you&apos;ll play, you have no room to swap out a track that
              doesn&apos;t fit once you hear it next to the others.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              2. Tag key and BPM before you start ordering
            </h2>
            <p>
              Do this before you try to sequence anything, not while you&apos;re in
              the middle of building the set. Trying to key-match and build the
              energy arc at the same time means you&apos;re solving two problems at
              once and doing both worse. Run untagged tracks through a key/BPM
              detector first so every track already has the data attached when you
              start arranging.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              3. Group by key family, then sort by energy within each group
            </h2>
            <p>
              Once everything&apos;s tagged, cluster tracks by Camelot compatibility
              first — that gives you pockets of tracks that can transition cleanly
              into each other. Within each cluster, order by energy so you&apos;re
              not jumping around once you&apos;re inside a compatible key zone.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              4. Plan two or three deliberate key jumps
            </h2>
            <p>
              Don&apos;t stay inside one key cluster for the whole set — it flattens
              the arc. Pick two or three moments (a breakdown, a big energy shift,
              a genre change) where you intentionally jump outside the safe
              Camelot zone, and plan the transition technique for that specific
              jump ahead of time rather than discovering it live.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              5. Cut ruthlessly to your actual set length
            </h2>
            <p>
              Once the set is roughly sequenced, cut down to your real time slot
              plus a small buffer — not the full pool of tracks you gathered.
              Overpacking a set folder makes it harder to find things quickly if
              you need to improvise mid-set, and most of the value of prep is
              exactly that: giving yourself less to think about while playing.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              6. Do a full run-through before the gig
            </h2>
            <p>
              Play the set in order at least once beforehand, even roughly. This is
              where you catch the transition that looks fine on paper — same
              Camelot number, close BPM — but doesn&apos;t actually feel right once
              you hear it. Tagging data gets you close; your ears make the final
              call.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/key-finder"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Key &amp; BPM Finder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}