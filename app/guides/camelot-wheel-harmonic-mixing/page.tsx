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

const guide = getGuideBySlug("camelot-wheel-harmonic-mixing")!;

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
  // ADDED: url, mainEntityOfPage and image. Google wants an image on an
  // Article, and the page previously offered none — the OG card is one.
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function CamelotWheelGuidePage() {
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
          {/* One step down from the 5xl/6xl on tool pages and hubs — this
              heading leads into body text, not into a tool. Same tracking
              and leading, so it reads as a rank in one system. */}
          <h1 className="measure-wide text-4xl font-bold leading-[1.06] tracking-[-0.02em] text-text-primary sm:text-5xl">
            {guide.title}
          </h1>
          <div className="mt-5">
            <GuideByline publishedDate={guide.publishedDate} updatedDate={guide.updatedDate} />
          </div>
        </header>

        {/* ONE Prose wrapper for the whole article. h2/h3 spacing and list
            style come from .prose-af in globals.css, so porting the other
            guides is: delete the per-section classNames, wrap in <Prose>. */}
        <Prose className="mt-10">
          <p>
            Every track has a key, and not every key sits well next to another. Play
            two harmonically distant tracks back to back and you&apos;ll hear it —
            a faint clash under the transition, even if the beatmatching is perfect.
            The Camelot Wheel exists to solve exactly that problem: it gives you a
            fast way to see which tracks will blend cleanly before you ever drop them
            into a set.
          </p>

          <h2 id="what-it-is">What the Camelot Wheel actually is</h2>
          <p>
            Musical keys have names most people don&apos;t think in on the fly —
            F# minor, A♭ major, and so on. The Camelot system renames all 24 keys
            as a number from 1 to 12 followed by A (minor) or B (major). So instead
            of remembering that A minor and C major share the same notes, you just
            see 8A and 8B sitting next to each other on the wheel.
          </p>
          <p>
            The numbers aren&apos;t arbitrary — they&apos;re arranged so that keys
            next to each other on the wheel are harmonically compatible. That&apos;s
            the entire point of the system: it turns music theory into a lookup
            table you can use mid-set.
          </p>

          <h2 id="compatible-moves">The compatible-move rules</h2>
          <p>From any track&apos;s Camelot code, there are four safe moves:</p>
          <dl>
            <dt>Same number, same letter</dt>
            <dd>Identical key. Always compatible.</dd>

            <dt>Same number, other letter</dt>
            <dd>
              The relative major/minor. Compatible, and often the most interesting
              move because the mood shifts while the notes stay related.
            </dd>

            <dt>One number up, same letter</dt>
            <dd>Moves the energy up slightly.</dd>

            <dt>One number down, same letter</dt>
            <dd>Moves the energy down slightly.</dd>
          </dl>
          <p>
            Jump more than one number away and you&apos;re outside the safe zone —
            it can still work with the right transition technique (a long blend, a
            breakdown, a key-shifted loop), but it&apos;s no longer a &quot;just mix
            it&quot; situation.
          </p>

          <h2 id="worked-example">A worked example</h2>
          <p>
            Say your current track comes back as <code>8A</code> (A minor). Your
            safe next moves are:
          </p>
          <dl className="codes">
            <dt>8A — A minor</dt>
            <dd>
              Another A minor track. Safest possible blend, but can feel static if you
              stay there too long.
            </dd>

            <dt>8B — C major</dt>
            <dd>Same notes, brighter mood. Great for lifting energy without a key clash.</dd>

            <dt>9A — E minor</dt>
            <dd>A fifth up. Subtle energy lift, still clearly related.</dd>

            <dt>7A — D minor</dt>
            <dd>A fifth down. Slight energy drop, useful heading into a breakdown.</dd>
          </dl>
          <p>
            Anything else — say jumping from 8A to 2A — puts you five steps around
            the wheel, which is where the audible clash lives. Not forbidden, just
            not a blend you can do on autopilot.
          </p>

          <h2 id="where-it-matters">Where it actually matters vs. where it doesn&apos;t</h2>
          <p>
            Harmonic mixing matters most during long blends, layered intros/outros,
            and anywhere two tracks are audibly playing at once. If you&apos;re
            doing a hard cut on the drop with no overlap, key compatibility barely
            registers — the human ear doesn&apos;t carry pitch memory across a clean
            cut the way it does across a 16- or 32-bar blend.
          </p>
          <p>
            This is also why chasing perfect Camelot matches for every single
            transition in a set can backfire — it flattens the energy arc. Some of
            the best moments in a set come from an intentional key jump timed to a
            breakdown or a vocal drop, not from strict adjacency.
          </p>

          <h2 id="detection-accuracy">A note on detection accuracy</h2>
          <p>
            Automatic key detection — whether from Rekordbox, Mixed In Key, or any
            other tool — is very good but not infallible. It&apos;s most reliable on
            clean, tonal, single-key material and least reliable on tracks with
            mid-song key changes, heavy atonal sound design, or sparse arrangements
            where there simply isn&apos;t much harmonic information to analyze.
          </p>
          <p>
            If a detected key produces a blend that sounds wrong despite being
            &quot;compatible&quot; on paper, trust your ears over the tag. The
            Camelot system is a shortcut for good decisions, not a replacement for
            listening.
          </p>

          <h2 id="in-practice">Using it in practice</h2>
          <p>
            Run your crate through a key detector, tag everything with its Camelot
            code, then sort by key when you&apos;re building a set instead of
            working purely off genre or energy. You&apos;ll start seeing clusters —
            tracks that were never in the same playlist together suddenly line up
            because they share a key family.
          </p>
          <p>
            If you don&apos;t already have Camelot codes for your library, our{" "}
            <Link href="/key-finder">Key &amp; BPM Finder</Link> tags a track&apos;s
            key, tempo, and Camelot notation in one pass — useful for going through a
            folder of untagged files before a session.
          </p>
        </Prose>

        <div className="mt-12 border-t border-graphite-800 pt-8">
          <Link href="/key-finder" className={buttonStyles({ size: "lg" })}>
            Try the Key &amp; BPM Finder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}