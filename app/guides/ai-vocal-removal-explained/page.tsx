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
  publisher: { "@type": "Organization", name: "AudioForges" },
  image: `${SITE_URL}/images/og-default.png`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
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
            Older &quot;vocal remover&quot; tools work by cutting whatever&apos;s
            panned dead-center in a stereo mix. AI vocal removal does something
            different: it separates a track into vocals and instrumental based on
            what the audio actually sounds like, not where it sits in the stereo
            field. That distinction is why the two approaches produce very
            different results.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Why a center-channel filter falls short
            </h2>
            <p>
              A center-channel filter removes anything panned to the middle of the
              stereo image — in many commercial mixes, that catches the lead
              vocal. But it&apos;s an indiscriminate cut: kick drum, bass, and
              snare are also frequently centered, so they get damaged along with
              the vocal. And any vocal element that isn&apos;t perfectly centered
              — a doubled vocal, a wide harmony, reverb tails — passes straight
              through untouched. The result is a mix that&apos;s missing pieces it
              shouldn&apos;t be missing, while still carrying vocal bleed it was
              supposed to remove.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What AI source separation does instead
            </h2>
            <p>
              An AI separation model is trained on the learned characteristics of
              what a human voice sounds like versus an instrument — harmonic
              structure, formants, the way pitch and timbre move over time. It
              uses that to isolate the vocal regardless of where it&apos;s placed
              in the stereo field, and it processes the full stereo signal rather
              than collapsing anything to mono in the process. That&apos;s what
              lets it produce a genuinely cleaner instrumental instead of one with
              chunks of the rhythm section carved out.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Instrumental vs. acapella
            </h2>
            <p>
              The separation produces two stems from the same process:{" "}
              <strong className="text-text-primary">instrumental</strong> is
              everything except the vocal, and{" "}
              <strong className="text-text-primary">acapella</strong> is the
              isolated vocal on its own. Karaoke and remixing usually call for the
              instrumental; sampling a vocal hook or building a mashup usually
              calls for the acapella. Since both come from a single separation
              pass, you get both stems back regardless of which one you actually
              need.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Where separation still struggles
            </h2>
            <p>
              AI separation isn&apos;t flawless on every track. Choir or group
              vocals give the model multiple overlapping voice-like sources to
              untangle instead of one, which tends to leave more audible traces
              behind. Heavy distortion or screamed vocals can share enough
              spectral character with distorted instruments that the two separate
              less cleanly. Live recordings add crowd noise and stage bleed, a
              messier signal than a controlled studio mix. None of these make
              separation fail outright — a simpler, cleanly recorded studio track
              will still separate more completely than any of the cases above.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Vocal removal vs. full stem separation
            </h2>
            <p>
              If all you need is vocals removed, a 2-stem vocal/instrumental split
              is the right tool for the job — it&apos;s a narrower separation than
              splitting a full mix into four stems, so there&apos;s nothing extra
              to sort through afterward. Reach for full stem separation instead
              when you need to isolate or rebuild around drums, bass, or another
              instrument specifically, not just the vocal.
            </p>
            <p>
              Our{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:underline">
                AI Vocal Remover
              </Link>{" "}
              runs this exact process — upload a track and get back both the
              instrumental and the acapella, no account or software install
              needed.
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