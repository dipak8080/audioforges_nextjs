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

const guide = getGuideBySlug("dj-set-prep-checklist")!;

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

export default function DjSetPrepGuidePage() {
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

        {/* The step numbers stay in the heading text rather than becoming an
            <ol>. They're section-length steps with their own anchors, and a
            reader linking to "step 4" wants a heading to land on. */}
        <Prose className="mt-10">
          <p>
            Most set prep problems don&apos;t show up in the studio — they show up
            mid-set, when you&apos;re digging for a track you tagged wrong three
            weeks ago. A little structure up front saves you from thinking on your
            feet later.
          </p>

          <h2 id="step-1">1. Gather wider than you&apos;ll use</h2>
          <p>
            Pull in more candidate tracks than you actually need for the set —
            roughly double. Sets get built by cutting, not by finding exactly the
            right number of tracks on the first pass. If you only gather what you
            think you&apos;ll play, you have no room to swap out a track that
            doesn&apos;t fit once you hear it next to the others.
          </p>

          <h2 id="step-2">2. Tag key and BPM before you start ordering</h2>
          <p>
            Do this before you try to sequence anything, not while you&apos;re in
            the middle of building the set. Trying to key-match and build the
            energy arc at the same time means you&apos;re solving two problems at
            once and doing both worse. Run untagged tracks through a key/BPM
            detector first so every track already has the data attached when you
            start arranging.
          </p>

          <h2 id="step-3">
            3. Group by key family, then sort by energy within each group
          </h2>
          <p>
            Once everything&apos;s tagged, cluster tracks by Camelot compatibility
            first — that gives you pockets of tracks that can transition cleanly
            into each other. Within each cluster, order by energy so you&apos;re
            not jumping around once you&apos;re inside a compatible key zone.
          </p>

          <h2 id="step-4">4. Plan two or three deliberate key jumps</h2>
          <p>
            Don&apos;t stay inside one key cluster for the whole set — it flattens
            the arc. Pick two or three moments (a breakdown, a big energy shift, a
            genre change) where you intentionally jump outside the safe Camelot
            zone, and plan the transition technique for that specific jump ahead
            of time rather than discovering it live.
          </p>

          <h2 id="step-5">5. Cut ruthlessly to your actual set length</h2>
          <p>
            Once the set is roughly sequenced, cut down to your real time slot plus
            a small buffer — not the full pool of tracks you gathered. Overpacking
            a set folder makes it harder to find things quickly if you need to
            improvise mid-set, and most of the value of prep is exactly that:
            giving yourself less to think about while playing.
          </p>

          <h2 id="step-6">6. Do a full run-through before the gig</h2>
          <p>
            Play the set in order at least once beforehand, even roughly. This is
            where you catch the transition that looks fine on paper — same Camelot
            number, close BPM — but doesn&apos;t actually feel right once you hear
            it. Tagging data gets you close; your ears make the final call.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/key-finder" className={buttonStyles({ size: "lg" })}>
            Try the Key &amp; BPM Finder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}