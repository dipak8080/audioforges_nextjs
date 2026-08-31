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

const guide = getGuideBySlug("editing-out-dead-air-podcasts")!;

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

export default function DeadAirGuidePage() {
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
            Cutting dead air sounds like a one-setting job — find the quiet parts,
            remove them — but automatic silence removal actually depends on two
            settings working together, and getting either one wrong produces a
            recognizably bad result: choppy, unnatural pacing where pauses used to
            be.
          </p>

          <h2 id="the-two-settings">The two settings that actually matter</h2>
          <dl>
            <dt>Silence threshold</dt>
            <dd>
              Measured in dB, this defines how quiet something has to be to count
              as silence at all. A setting near -10dB only treats near-total
              silence as a gap; a setting near -90dB is much stricter, catching
              even quiet room tone or faint background hum as silence.
            </dd>

            <dt>Minimum gap length</dt>
            <dd>
              How long a quiet stretch has to last before it&apos;s actually
              removed. A short minimum (0.1s) cuts brief conversational pauses,
              while a longer minimum (several seconds) only removes genuinely long
              dead air and leaves natural speech rhythm alone.
            </dd>
          </dl>

          <h2 id="interaction">Why these two settings interact</h2>
          <p>
            Threshold decides what counts as quiet enough; minimum gap length
            decides how long that quiet has to persist before it gets treated as
            removable dead air rather than a normal breath or pause. A strict
            threshold with a short minimum gap will cut aggressively — catching
            quiet room tone and even brief pauses between words. A relaxed
            threshold with a long minimum gap will barely cut anything, only
            removing stretches that are both very quiet and very long. Most real
            recordings need something in between, which is exactly why sensible
            defaults exist rather than a single fixed value.
          </p>

          <h2 id="too-aggressive">What happens when you cut too aggressively</h2>
          <p>
            Push the threshold too strict and the minimum gap too short, and you
            start removing the natural breathing room in speech — the small pauses
            between sentences that give a listener a moment to process what was
            just said. The result sounds rushed and slightly unnatural, even
            though technically nothing except silence was removed. This is the
            most common failure mode: treating &quot;more cutting&quot; as
            automatically better, when the goal is removing genuinely dead air,
            not compressing every pause out of natural speech.
          </p>

          <h2 id="when-to-adjust">When to actually adjust the defaults</h2>
          <p>
            Lower the threshold toward a stricter value (closer to -90dB) if your
            recording has persistent quiet background noise you want caught as
            silence too, not just true dead air. Raise it toward a looser value
            (closer to -10dB) if the defaults are cutting content you actually
            want to keep, like quiet asides or soft spoken moments. Shorten the
            minimum gap if you specifically want brief pauses trimmed for a
            tighter pace; lengthen it if you want to preserve natural
            conversational rhythm and only remove stretches of genuinely long dead
            air.
          </p>

          <h2 id="getting-started">Getting started</h2>
          <p>
            For most podcast and voice-memo editing, the default threshold and
            minimum gap length are a solid starting point — try them unadjusted
            first and only tune from there if the result cuts too much or too
            little. Our <Link href="/silence-remove">Silence Remover</Link> strips
            gaps throughout the entire recording, not just the leading and
            trailing edges, with both settings adjustable if the defaults
            don&apos;t fit your material.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/silence-remove" className={buttonStyles({ size: "lg" })}>
            Try the Silence Remover
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