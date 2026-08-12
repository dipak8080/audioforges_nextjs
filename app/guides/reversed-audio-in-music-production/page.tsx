import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getGuideBySlug } from "@/lib/guides";
import { GuideByline } from "@/components/guides/GuideByline";

const guide = getGuideBySlug("reversed-audio-in-music-production")!;

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

export default function ReversedAudioGuidePage() {
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
            Reversing audio is one of the oldest tricks in production, and it&apos;s
            stayed relevant precisely because reversed sound doesn&apos;t just
            sound &quot;backwards&quot; — it changes the shape of how a sound
            builds and decays, which is genuinely useful, not just a novelty.
          </p>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              What reversing actually does to a waveform
            </h2>
            <p>
              A normal sound — a cymbal hit, a plucked string, a spoken word —
              has a sharp attack followed by a decay: loud at the start, fading
              out. Reverse that same waveform and the shape flips entirely: it
              now builds slowly from silence into a sudden stop. That build
              shape is the whole reason reversed audio is useful in production —
              it creates anticipation and momentum that a normal decay can&apos;t.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              The reversed swell: risers and transitions
            </h2>
            <p>
              This is the most common practical use in melodic house and
              cinematic production. Take a cymbal crash, a reverb tail, or a
              white-noise sweep, reverse it, and place it right before a drop or
              section change. Because the reversed sound builds rather than
              decays, it creates a natural sense of rising tension that resolves
              exactly on the downbeat where the next section begins — that&apos;s
              the mechanism behind most &quot;riser&quot; effects, whether
              they&apos;re built from a sample pack or made from scratch by
              reversing something you already have.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Reversed vocal chops
            </h2>
            <p>
              Reversing a short vocal phrase or chop before it plays forward —
              or blending a reversed lead-in with the forward version — gives a
              vocal a distinctive, slightly otherworldly texture that&apos;s
              become a signature sound in melodic house and future bass. The
              technique works because a reversed vocal onset doesn&apos;t match
              how speech normally attacks and decays, so it reads as processed
              and intentional rather than like a simple pitch or EQ change.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Backmasking: the reason reversing became famous
            </h2>
            <p>
              Reversing audio to check for hidden or unintentional content — often
              called backmasking — is where a lot of people first encounter the
              idea, thanks to decades of claims about hidden messages in
              recordings played backward. Most of what gets &quot;found&quot; this
              way is pareidolia — the brain finding speech-like patterns in
              essentially random reversed sound — but reversing a track to listen
              through it is a real and easy way to satisfy that curiosity
              yourself.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold text-text-primary">
              Putting it into practice
            </h2>
            <p>
              Reverse a full track if you want to build a riser or transition
              element from an existing sound, or reverse a short chop if
              you&apos;re working on a vocal texture. Since the output keeps your
              original file format, you can drop a reversed WAV stem straight
              back into your DAW without an extra conversion step. Our{" "}
              <Link href="/reverse" className="text-amber-400 hover:underline">
                Audio Reverser
              </Link>{" "}
              flips any upload with one click — no settings, just upload and
              download the reversed file.
            </p>
          </section>
        </div>

        <div className="pt-6 border-t border-graphite-800 flex flex-wrap gap-3">
          <Link
            href="/reverse"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors"
          >
            Try the Audio Reverser
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pitch"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 transition-colors"
          >
            Try the Pitch Shifter
          </Link>
        </div>
      </main>
    </>
  );
}