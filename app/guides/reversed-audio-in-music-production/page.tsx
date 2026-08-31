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

const guide = getGuideBySlug("reversed-audio-in-music-production")!;

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
  // Organization, not Person — AudioForges is a brand, not an individual.
  author: { "@type": "Organization", name: "AudioForges" },
  url: `${SITE_URL}/guides/${guide.slug}`,
  mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
  image: `${SITE_URL}${OG_IMAGE.url}`,
  publisher: { "@type": "Organization", name: "AudioForges" },
};

export default function ReversedAudioGuidePage() {
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
            Reversing audio is one of the oldest tricks in production, and
            it&apos;s stayed relevant precisely because reversed sound
            doesn&apos;t just sound &quot;backwards&quot; — it changes the shape
            of how a sound builds and decays, which is genuinely useful, not just
            a novelty.
          </p>

          <h2 id="waveform">What reversing actually does to a waveform</h2>
          <p>
            A normal sound — a cymbal hit, a plucked string, a spoken word — has a
            sharp attack followed by a decay: loud at the start, fading out.
            Reverse that same waveform and the shape flips entirely: it now builds
            slowly from silence into a sudden stop. That build shape is the whole
            reason reversed audio is useful in production — it creates
            anticipation and momentum that a normal decay can&apos;t.
          </p>

          <h2 id="risers">The reversed swell: risers and transitions</h2>
          <p>
            This is the most common practical use in melodic house and cinematic
            production. Take a cymbal crash, a reverb tail, or a white-noise
            sweep, reverse it, and place it right before a drop or section change.
            Because the reversed sound builds rather than decays, it creates a
            natural sense of rising tension that resolves exactly on the downbeat
            where the next section begins — that&apos;s the mechanism behind most
            &quot;riser&quot; effects, whether they&apos;re built from a sample
            pack or made from scratch by reversing something you already have.
          </p>

          <h2 id="vocal-chops">Reversed vocal chops</h2>
          <p>
            Reversing a short vocal phrase or chop before it plays forward — or
            blending a reversed lead-in with the forward version — gives a vocal a
            distinctive, slightly otherworldly texture that&apos;s become a
            signature sound in melodic house and future bass. The technique works
            because a reversed vocal onset doesn&apos;t match how speech normally
            attacks and decays, so it reads as processed and intentional rather
            than like a simple pitch or EQ change.
          </p>

          <h2 id="backmasking">Backmasking: the reason reversing became famous</h2>
          <p>
            Reversing audio to check for hidden or unintentional content — often
            called backmasking — is where a lot of people first encounter the
            idea, thanks to decades of claims about hidden messages in recordings
            played backward. Most of what gets &quot;found&quot; this way is
            pareidolia — the brain finding speech-like patterns in essentially
            random reversed sound — but reversing a track to listen through it is
            a real and easy way to satisfy that curiosity yourself.
          </p>

          <h2 id="practice">Putting it into practice</h2>
          <p>
            Reverse a full track if you want to build a riser or transition
            element from an existing sound, or reverse a short chop if you&apos;re
            working on a vocal texture. Since the output keeps your original file
            format, you can drop a reversed WAV stem straight back into your DAW
            without an extra conversion step. Our{" "}
            <Link href="/reverse">Audio Reverser</Link> flips any upload with one
            click — no settings, just upload and download the reversed file.
          </p>
        </Prose>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-graphite-800 pt-8">
          <Link href="/reverse" className={buttonStyles({ size: "lg" })}>
            Try the Audio Reverser
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pitch"
            className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 px-6 py-3 font-medium text-text-primary transition-colors hover:border-amber-500/40"
          >
            Try the Pitch Shifter
          </Link>
        </div>
      </main>
    </>
  );
}