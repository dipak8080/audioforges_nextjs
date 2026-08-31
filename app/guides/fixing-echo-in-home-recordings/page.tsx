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

const guide = getGuideBySlug("fixing-echo-in-home-recordings")!;

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

export default function FixingEchoGuidePage() {
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
            &quot;Remove the echo&quot; is a reasonable thing to ask for, but it
            hides an important distinction: not all echo is the same problem, and
            not all of it can be undone the same way. Knowing which kind
            you&apos;re dealing with sets your expectations correctly before you
            even try a fix.
          </p>

          <h2 id="slapback-vs-reverb">Slap-back echo vs. room reverb</h2>
          <dl>
            <dt>Slap-back echo</dt>
            <dd>
              A distinct, repeated reflection — a single clear bounce off a hard
              surface, close enough that you hear it as a separate quiet repeat
              rather than a blur. Common in small hard-surfaced spaces: a tiled
              bathroom, a hallway, an empty room with bare walls.
            </dd>

            <dt>Room reverb</dt>
            <dd>
              The accumulated effect of countless overlapping reflections bouncing
              around a larger space — not a single distinct repeat, but a wash of
              trailing sound that blurs into the original. A cathedral or an empty
              concert hall produces reverb, not a single slap-back.
            </dd>
          </dl>

          <h2 id="why-gating-works">
            Why one can be gated out and the other can&apos;t
          </h2>
          <p>
            Slap-back echo responds well to gating — the technique of detecting
            and suppressing the quiet trailing reflections that create the echo
            sensation, since they sit clearly below the level of the direct sound.
            Because it&apos;s a distinct, separable repeat, a gate can target it
            specifically.
          </p>
          <p>
            Room reverb doesn&apos;t offer that same separation. Its reflections
            are so numerous and overlapping that there&apos;s no clean boundary
            between &quot;direct sound&quot; and &quot;reflection&quot; to gate
            against — the reverb is woven into the sound itself, not sitting
            quietly underneath it. Fully removing that requires acoustic
            dereverberation, a fundamentally different and far more
            computationally demanding process than gating, and even then it
            typically only reduces reverb rather than eliminating it entirely.
          </p>

          <h2 id="realistic-result">What a realistic result looks like</h2>
          <p>
            For a phone recording made in a tiled bathroom, a voice memo with a
            faint repeat, or an interview recorded in a slightly echoey room,
            expect a genuinely cleaner, tighter-sounding result — the gating
            approach handles exactly that kind of problem well. For a recording
            made in a large or empty room with heavy, washy reverb, expect
            improvement, not elimination. That&apos;s a limitation of what&apos;s
            mechanically possible with this approach, not a sign the tool
            didn&apos;t work.
          </p>

          {/* "highest-leverage" and "post-processing" were wrapped mid-hyphen in
              the source. JSX joins wrapped lines with a space, so they rendered
              as "highest- leverage" and "post- processing" on the page. */}
          <h2 id="prevention">Preventing it beats fixing it</h2>
          <p>
            Since heavy reverb is hard to remove after the fact, the
            highest-leverage fix is recording in a less reflective space in the
            first place: a smaller room, soft furnishings or fabric on hard
            surfaces, or simply moving the mic closer to the source so the direct
            sound dominates over the room&apos;s reflections. No amount of
            post-processing recovers the clarity of a recording made somewhere
            with less echo to begin with.
          </p>

          <h2 id="other-problems">Handling echo alongside other problems</h2>
          <p>
            If your recording has echo along with background noise or inconsistent
            loudness, tackle those together rather than in isolation. Our{" "}
            <Link href="/echo-remove">Echo Remover</Link> targets mild room echo
            and slap-back specifically. If your recording is speech with noise or
            level problems on top of the echo, running it through the{" "}
            <Link href="/voice-clean">Voice Cleaner</Link> first handles the
            denoising and normalization in the same pass.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/echo-remove" className={buttonStyles({ size: "lg" })}>
            Try the Echo Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/voice-clean"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Try the Voice Cleaner
          </Link>
        </div>
      </main>
    </>
  );
}