import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("ai-stem-separation-explained")!;

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
  publisher: { "@type": "Organization", name: "AudioForges" },
  image: `${SITE_URL}/images/og-default.png`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
};

export default function AiStemSeparationGuidePage() {
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
            Splitting a song into vocals and instrumental is a 2-way split.
            Stem separation goes further — it pulls a full mix apart into{" "}
            <strong className="text-text-primary">four</strong> independent
            parts: vocals, drums, bass, and everything else. Same underlying
            idea as vocal removal, but a meaningfully harder problem, and one
            that opens up a different set of uses.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              From 2 stems to 4 stems
            </h2>
            <p>
              A vocal remover only has to decide what&apos;s voice and what
              isn&apos;t — everything non-vocal gets lumped into one
              instrumental track. A stem splitter has to make that same
              vocal/non-vocal distinction, and then keep subdividing the
              non-vocal portion into drums, bass, and other. That&apos;s a
              harder task for the model: instead of one boundary to draw, it&apos;s
              drawing three, and some instruments sit closer to each other in
              character than a voice does to any of them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why bass and drums are the tricky pair
            </h2>
            <p>
              Vocals tend to separate cleanly regardless of stem count,
              because a voice has a distinctive harmonic and formant structure
              that doesn&apos;t closely resemble any instrument. Bass and low
              guitar are a different story — they often occupy an overlapping
              low-frequency range, so the model has less to distinguish them
              by. Programmed or heavily processed drums can also separate less
              cleanly than an acoustic kit, since processing can blur the
              transient characteristics the model relies on to identify a hit
              as &quot;drums&quot; rather than part of the other stem.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What &quot;other&quot; actually contains
            </h2>
            <p>
              The fourth stem isn&apos;t a leftover bucket for separation
              failures — it&apos;s a genuine category: guitars, keys, pads,
              synths, strings, anything that isn&apos;t vocals, drums, or bass.
              In a guitar-driven rock track, &quot;other&quot; might carry most
              of the melodic content. In an electronic track built around
              synth bass and drum programming, &quot;other&quot; might be
              comparatively sparse. What ends up in it depends entirely on how
              the source track is arranged.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Standard vs. Studio Quality
            </h2>
            <p>
              Standard mode runs a single pass of the separation model and
              finishes in a few minutes — good for a quick check or casual
              use. Studio Quality runs a larger, ensembled model instead of a
              single pass, which produces noticeably cleaner separation across
              all four stems, at the cost of 10–20 minutes instead of a few.
              The extra time buys real improvement specifically on the
              harder cases — bass/guitar overlap and busy drum programming —
              which is why it&apos;s worth it when a stem is headed into an
              actual mix rather than just a preview.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Stems vs. a plain instrumental
            </h2>
            <p>
              If all you need is vocals removed, a full 4-stem split is more
              than the job requires — a{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:underline">
                Vocal Remover
              </Link>{" "}
              does the same underlying separation and hands back one
              instrumental instead of three additional stems to sort through.
              Reach for stem separation specifically when you need to isolate
              or rebuild around drums, bass, or another instrument on its own —
              sampling a bassline, remixing with someone else&apos;s drum
              pattern, or studying a part note-for-note without the rest of
              the mix in the way.
            </p>
            <p>
              Our{" "}
              <Link href="/stems" className="text-amber-400 hover:underline">
                AI Stem Splitter
              </Link>{" "}
              runs this exact process — upload a track and get back all four
              stems individually, no account or software install needed.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800">
          <Link
            href="/stems"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the AI Stem Splitter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}