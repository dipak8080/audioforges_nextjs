import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("ai-vocal-removal-explained")!;

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

export default function AiVocalRemovalGuidePage() {
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
            &quot;Vocal remover&quot; covers two genuinely different technologies
            that happen to share a name. One is a decades-old trick that works on
            a narrow assumption about how a mix is built; the other is a learned
            model that actually recognizes what a voice sounds like. Knowing which
            one you&apos;re using changes what result you should expect.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The old method: center-channel filtering
            </h2>
            <p>
              A center-channel filter works on one assumption: in a typical
              stereo mix, the lead vocal is panned dead-center, while other
              elements are spread left and right. The filter cancels out
              whatever&apos;s identical in both channels — which, if the vocal
              really is centered, removes it. The catch is that other things are
              often centered too: kick drum, bass, snare. Cancel the center
              channel and you don&apos;t just lose the vocal, you lose or thin
              out everything else sitting there with it. And if the vocal
              isn&apos;t perfectly centered — doubled vocals, wide harmonies,
              certain mix styles — a meaningful amount of it survives as
              audible bleed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The newer method: AI source separation
            </h2>
            <p>
              AI source separation doesn&apos;t rely on stereo positioning at
              all. A model trained on large amounts of mixed and unmixed audio
              learns the general characteristics that distinguish a human voice
              from other instruments — timbre, harmonic structure, the way pitch
              and formants move over time — and uses that learned pattern to
              separate a track into stems regardless of where anything sits in
              the stereo field. This is why it works on mixes a center-channel
              filter would fail on entirely, and why it produces a cleaner
              instrumental with far less bleed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Where separation still struggles
            </h2>
            <p>
              AI separation is much better than center-channel filtering, but
              it&apos;s not flawless on every source. Dense mixes with many
              overlapping instruments give the model less clear signal to work
              from. Heavy reverb or delay on a vocal blurs the boundary between
              voice and the rest of the mix, since some of that trailing sound
              genuinely resembles other instrumentation. Doubled or heavily
              harmonized vocals can also leave faint traces in the instrumental,
              since the model has more vocal-like content to separate out
              cleanly. Simpler mixes — a clear lead vocal over a straightforward
              band arrangement — tend to separate the most cleanly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Instrumental vs. acapella: same process, opposite stem
            </h2>
            <p>
              Both outputs come from the same separation pass — an{" "}
              <strong className="text-text-primary">instrumental</strong> keeps
              everything except the vocal, and an{" "}
              <strong className="text-text-primary">acapella</strong> keeps only
              the vocal and discards the rest. Which one you want depends on
              what you&apos;re building: karaoke and cover practice call for the
              instrumental, while sampling a vocal hook or building a mashup
              usually calls for the acapella.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why it's slower than other audio tools
            </h2>
            <p>
              Source separation is genuinely more computationally demanding than
              a format conversion or a simple filter — it&apos;s running a full
              model over the entire track rather than applying a fixed
              transformation. That&apos;s why a separation tool typically takes
              longer and is rate-limited more strictly than something like a
              converter or a trimmer; it&apos;s solving a fundamentally harder
              problem.
            </p>
            <p>
              Our{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:underline">
                AI Vocal Remover
              </Link>{" "}
              runs this exact process — upload a track and get back a separated
              instrumental or acapella, no account or software install needed.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/vocal-remover"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the AI Vocal Remover
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}