import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("editing-out-dead-air-podcasts")!;

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

export default function DeadAirGuidePage() {
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
            Cutting dead air sounds like a one-setting job — find the quiet
            parts, remove them — but automatic silence removal actually depends
            on two settings working together, and getting either one wrong
            produces a recognizably bad result: choppy, unnatural pacing where
            pauses used to be.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The two settings that actually matter
            </h2>
            <p>
              <strong className="text-text-primary">Silence threshold</strong>{" "}
              (measured in dB) defines how quiet something has to be to count as
              silence at all. A setting near -10dB only treats near-total
              silence as a gap; a setting near -90dB is much stricter, catching
              even quiet room tone or faint background hum as silence.{" "}
              <strong className="text-text-primary">Minimum gap length</strong>{" "}
              controls how long a quiet stretch has to last before it&apos;s
              actually removed — a short minimum (0.1s) cuts brief conversational
              pauses, while a longer minimum (several seconds) only removes
              genuinely long dead air and leaves natural speech rhythm alone.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why these two settings interact
            </h2>
            <p>
              Threshold decides what counts as quiet enough; minimum gap length
              decides how long that quiet has to persist before it gets treated
              as removable dead air rather than a normal breath or pause. A
              strict threshold with a short minimum gap will cut aggressively —
              catching quiet room tone and even brief pauses between words. A
              relaxed threshold with a long minimum gap will barely cut
              anything, only removing stretches that are both very quiet and
              very long. Most real recordings need something in between, which
              is exactly why sensible defaults exist rather than a single fixed
              value.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What happens when you cut too aggressively
            </h2>
            <p>
              Push the threshold too strict and the minimum gap too short, and
              you start removing the natural breathing room in speech — the
              small pauses between sentences that give a listener a moment to
              process what was just said. The result sounds rushed and slightly
              unnatural, even though technically nothing except silence was
              removed. This is the most common failure mode: treating
              &quot;more cutting&quot; as automatically better, when the goal is
              removing genuinely dead air, not compressing every pause out of
              natural speech.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              When to actually adjust the defaults
            </h2>
            <p>
              Lower the threshold toward a stricter value (closer to -90dB) if
              your recording has persistent quiet background noise you want
              caught as silence too, not just true dead air. Raise it toward a
              looser value (closer to -10dB) if the defaults are cutting
              content you actually want to keep, like quiet asides or soft
              spoken moments. Shorten the minimum gap if you specifically want
              brief pauses trimmed for a tighter pace; lengthen it if you want
              to preserve natural conversational rhythm and only remove
              stretches of genuinely long dead air.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Getting started
            </h2>
            <p>
              For most podcast and voice-memo editing, the default threshold and
              minimum gap length are a solid starting point — try them
              unadjusted first and only tune from there if the result cuts too
              much or too little. Our{" "}
              <Link href="/silence-remove" className="text-amber-400 hover:underline">
                Silence Remover
              </Link>{" "}
              strips gaps throughout the entire recording, not just the leading
              and trailing edges, with both settings adjustable if the defaults
              don&apos;t fit your material.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/silence-remove"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Silence Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/voice-clean"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Voice Cleaner
          </Link>
        </div>
      </main>
    </>
  );
}