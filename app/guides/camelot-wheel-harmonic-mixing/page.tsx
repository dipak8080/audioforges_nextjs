import { buttonStyles } from "@/components/ui/Button";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("camelot-wheel-harmonic-mixing")!;

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
};

export default function CamelotWheelGuidePage() {
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
            Every track has a key, and not every key sits well next to another. Play
            two harmonically distant tracks back to back and you&apos;ll hear it —
            a faint clash under the transition, even if the beatmatching is perfect.
            The Camelot Wheel exists to solve exactly that problem: it gives you a
            fast way to see which tracks will blend cleanly before you ever drop them
            into a set.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What the Camelot Wheel actually is
            </h2>
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
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The compatible-move rules
            </h2>
            <p>From any track&apos;s Camelot code, there are four safe moves:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-text-primary">Same number, same letter</strong>{" "}
                — identical key. Always compatible.
              </li>
              <li>
                <strong className="text-text-primary">Same number, other letter</strong>{" "}
                — the relative major/minor. Compatible, and often the most interesting
                move because the mood shifts while the notes stay related.
              </li>
              <li>
                <strong className="text-text-primary">One number up, same letter</strong>{" "}
                — moves the energy up slightly.
              </li>
              <li>
                <strong className="text-text-primary">One number down, same letter</strong>{" "}
                — moves the energy down slightly.
              </li>
            </ul>
            <p>
              Jump more than one number away and you&apos;re outside the safe zone —
              it can still work with the right transition technique (a long blend, a
              breakdown, a key-shifted loop), but it&apos;s no longer a &quot;just mix
              it&quot; situation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A worked example
            </h2>
            <p>
              Say your current track comes back as{" "}
              <strong className="text-text-primary">8A</strong> (A minor). Your safe
              next moves are:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>
                <strong className="text-text-primary">8A</strong> — another A minor
                track. Safest possible blend, but can feel static if you stay there
                too long.
              </li>
              <li>
                <strong className="text-text-primary">8B</strong> (C major) — same
                notes, brighter mood. Great for lifting energy without a key clash.
              </li>
              <li>
                <strong className="text-text-primary">9A</strong> (E minor) — a fifth
                up. Subtle energy lift, still clearly related.
              </li>
              <li>
                <strong className="text-text-primary">7A</strong> (D minor) — a fifth
                down. Slight energy drop, useful heading into a breakdown.
              </li>
            </ul>
            <p>
              Anything else — say jumping from 8A to 2A — puts you five steps around
              the wheel, which is where the audible clash lives. Not forbidden, just
              not a blend you can do on autopilot.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Where it actually matters vs. where it doesn&apos;t
            </h2>
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
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              A note on detection accuracy
            </h2>
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
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Using it in practice
            </h2>
            <p>
              Run your crate through a key detector, tag everything with its Camelot
              code, then sort by key when you&apos;re building a set instead of
              working purely off genre or energy. You&apos;ll start seeing clusters —
              tracks that were never in the same playlist together suddenly line up
              because they share a key family.
            </p>
            <p>
              If you don&apos;t already have Camelot codes for your library, our{" "}
              <Link href="/key-finder" className="text-amber-400 hover:underline">
                Key &amp; BPM Finder
              </Link>{" "}
              tags a track&apos;s key, tempo, and Camelot notation in one pass — useful
              for going through a folder of untagged files before a session.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/key-finder"
            className={buttonStyles({ size: "lg" })}
          >
            Try the Key &amp; BPM Finder
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}