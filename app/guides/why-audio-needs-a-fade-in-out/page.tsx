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

const guide = getGuideBySlug("why-audio-needs-a-fade-in-out")!;

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

export default function FadeGuidePage() {
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
            Trim a clip, export a loop, or cut a voice-over recording at the wrong
            spot, and you&apos;ll often hear it before you can explain why: a
            small click or pop right at the cut, even though nothing about the
            actual content changed. It&apos;s not a bug in the file — it&apos;s a
            property of how a cut point interacts with the waveform, and it&apos;s
            exactly what a fade is built to fix.
          </p>

          <h2 id="why-clicks">Why a hard cut causes a click</h2>
          <p>
            An audio waveform is a continuous line that oscillates above and below
            zero. When you cut a clip at a random point, there&apos;s no guarantee
            the waveform happens to be sitting at zero right there — more often,
            it&apos;s somewhere mid-swing. Starting or ending playback abruptly at
            a non-zero point creates a sudden jump in amplitude, and your speakers
            reproduce that jump as a short, audible transient: a click or pop. The
            louder and more abrupt the jump, the more noticeable it is.
          </p>

          <h2 id="how-fades-fix-it">How a fade fixes it</h2>
          <p>
            A fade ramps the volume smoothly from silence up to full level (fade
            in) or from full level down to silence (fade out) over a short span,
            instead of jumping instantly. That ramp is what removes the
            discontinuity — even if the waveform isn&apos;t at zero the instant
            the clip starts or ends, the volume is already at (or heading toward)
            zero by that point, so there&apos;s nothing abrupt left for your
            speakers to reproduce.
          </p>

          <h2 id="in-vs-out">Fade in vs. fade out</h2>
          <p>
            A <strong>fade in</strong> ramps up from silence at the start of a
            clip — useful whenever a track begins mid-waveform rather than at a
            natural silent intro, or when you want a gentler entrance than an
            instant full-volume start. A <strong>fade out</strong> does the same
            in reverse at the end. They&apos;re independent of each other: plenty
            of clips only need one, not both — a recording that already starts
            cleanly from silence might only need a fade out at the cut point where
            it was trimmed.
          </p>

          <h2 id="how-long">How long should a fade be?</h2>
          <p>
            There&apos;s no single correct length — it depends on what the fade is
            covering for. A loop point generally wants a very short fade, since
            anything long enough to be noticeable also changes how the loop sounds
            each time it repeats. A podcast outro or the end of a voice-over
            recording can usually take a longer, more deliberate fade without it
            feeling abrupt or drawing attention to itself. The general trade-off:
            too short and a loud, sudden waveform might still produce an audible
            click; too long and the fade itself becomes an obvious part of the
            audio rather than an invisible fix.
          </p>

          <h2 id="in-practice">Where fades come up in practice</h2>
          <p>
            Smoothing the start and end of a clip you&apos;ve trimmed out of a
            longer recording, giving a podcast intro or outro a clean finish
            instead of an abrupt stop, avoiding an audible click at the loop point
            of a sample, softening the end of a ringtone or notification sound,
            and easing into or out of a voice-over take are all the same
            underlying fix applied to different situations.
          </p>
          <p>
            If you&apos;re trimming a clip out of a longer file first, the{" "}
            <Link href="/trim">Audio Trimmer</Link> handles that step — then a
            fade on the trimmed result smooths out whatever click the cut points
            introduced.
          </p>

          <h2 id="format">Adding a fade without changing the format</h2>
          <p>
            Adding a fade only touches the volume envelope at the start and/or end
            of the file — it doesn&apos;t require converting to a different
            format, and the output keeps whatever format you uploaded.
          </p>
          <p>
            Our <Link href="/fade">Audio Fade In/Out</Link> tool runs this exact
            process — turn on a fade in and/or fade out, set how long each should
            last (up to 30 seconds), and download the result, no account or
            software install needed.
          </p>
        </Prose>

        <div className="mt-10 border-t border-graphite-800 pt-8">
          <Link href="/fade" className={buttonStyles({ size: "lg" })}>
            Try the Audio Fade In/Out Tool
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </>
  );
}