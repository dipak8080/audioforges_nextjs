import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { getRateLimitLabel } from "@/lib/data/rate-limits";

/**
 * Read, never written as a literal. This page said "3 separations per hour"
 * long after the backend moved to 6, and "1 per hour at Studio Quality"
 * after that became a tiered 2/30. A page whose whole argument is that it
 * states real numbers cannot be the page carrying stale ones.
 */
const STANDARD_SEPARATION_LIMIT = getRateLimitLabel("separate") ?? "a few per hour";

const PAGE_TITLE = "About AudioForges — Free Online Audio Tools";
const PAGE_DESCRIPTION =
  "Who builds AudioForges, how each tool works, and how a free audio toolkit with no ads and no accounts pays for its own servers.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/about`,
    siteName: "AudioForges",
    type: "website",
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
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

/**
 * AboutPage + Organization, which the homepage's Organization block can't
 * do on its own: this is the page that states who runs the site and how
 * it's funded, so it's the one worth marking up as the authoritative
 * description of the operator.
 *
 * No `founder` entry — add one only alongside a real name on the page.
 * Structured data asserting a person the page never names is worse than
 * omitting it.
 */
const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: PAGE_TITLE,
  url: `${SITE_URL}/about`,
  description: PAGE_DESCRIPTION,
  mainEntity: {
    "@type": "Organization",
    name: "AudioForges",
    url: SITE_URL,
    description:
      "Free audio tools for music producers, DJs, musicians and creators — conversion, editing, cleanup, analysis, practice and transcription. No accounts, no ads.",
    foundingDate: "2025",
  },
};

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold text-text-primary">About AudioForges</h1>
          <p className="text-lg text-text-muted">
            A growing set of audio tools, built by one producer for the workflow
            problems that kept coming up in their own sessions.
          </p>
        </header>

        <section className="space-y-3 text-text-muted leading-relaxed">
          <h2 className="text-xl font-semibold text-text-primary">Why this exists</h2>
          <p>
            AudioForges started from a simple frustration: every time I needed to pull a
            reference track, check its key before sampling it, or get a clean
            instrumental to practice over, I ended up on some ad-plastered downloader
            site, or paying for a tool that did one thing I needed buried inside ten I
            didn&apos;t. So I built the pieces I actually use — a YouTube-to-audio
            converter first, then a key and BPM detector, then a vocal remover — and
            put them somewhere free for anyone else running into the same problem. The
            site has since grown into a full set of{" "}
            <Link href="/tools" className="text-amber-400 hover:underline">
              free audio tools
            </Link>{" "}
            covering conversion, editing, pitch and tempo, tuning, BPM, metronome
            practice, cleanup, separation and transcription — but the bar for adding
            anything new stays the same as day one.
          </p>
        </section>

        <section className="space-y-3 text-text-muted leading-relaxed">
          <h2 className="text-xl font-semibold text-text-primary">How the tools work</h2>
          <p>
            <strong className="text-text-primary">YouTube to WAV/MP3</strong> extracts
            the audio track from a video URL server-side and hands you back a WAV
            (lossless, 44.1kHz) or MP3 (320kbps) file.
          </p>
          <p>
            <strong className="text-text-primary">Key &amp; BPM Finder</strong> runs
            uploaded audio through key-detection and beat-tracking models to identify
            musical key, tempo, and Camelot notation for harmonic mixing.
          </p>
          <p>
            <strong className="text-text-primary">Vocal Remover</strong> uses real
            source-separation processing to split a track into vocal and instrumental
            stems — not a simple center-channel filter, which only partially removes
            vocals and often damages the mix. Separation runs on GPU-accelerated
            infrastructure, so it&apos;s rate-limited per person to keep it
            available for everyone — {STANDARD_SEPARATION_LIMIT} at standard
            quality, which is free with no account. Studio Quality runs a
            heavier model that costs real money per run; everyone gets free runs
            of it each month, and beyond that it takes{" "}
            <Link href="/pricing" className="text-amber-400 hover:underline">
              a credit
            </Link>
            .
          </p>
          <p>
            {/* Names the model rather than saying "AI-powered". Every
                competitor on this SERP says "advanced AI engine" and
                declines to say which one — usually because it's a smaller
                model than they'd like to admit. Stating it is checkable,
                and being checkable is the whole position. */}
            <strong className="text-text-primary">Transcription</strong> runs on
            Whisper large-v3, the largest model in that family, on a GPU worker.
            Three routes into it:{" "}
            <Link href="/audio-to-text" className="text-amber-400 hover:underline">
              Audio to Text
            </Link>{" "}
            for a file you already have,{" "}
            <Link href="/youtube-to-text" className="text-amber-400 hover:underline">
              YouTube to Text
            </Link>{" "}
            for a link, and{" "}
            <Link href="/video-to-text" className="text-amber-400 hover:underline">
              Video to Text
            </Link>{" "}
            for an MP4 or MOV without extracting the audio first. All three detect the
            spoken language or let you set it, translate to English on request, and
            export plain text, SRT or VTT.
          </p>
          <p>
            <Link href="/bpm-tapper" className="text-amber-400 hover:underline">
              <strong>BPM Tapper</strong>
            </Link>{" "}
            lets you tap along to a beat and calculates its tempo from the intervals
            between taps.{" "}
            <Link href="/metronome" className="text-amber-400 hover:underline">
              <strong>Online Metronome</strong>
            </Link>{" "}
            provides adjustable BPM and time signature controls for practice, while
            its scheduler uses the browser&apos;s audio clock to keep clicks precise.{" "}
            <Link href="/tuner" className="text-amber-400 hover:underline">
              <strong>Instrument Tuner</strong>
            </Link>{" "}
            uses your microphone to detect the pitch of a played note and shows the
            nearest note, octave, and cents sharp or flat directly in the browser.
          </p>
          <p>
            Beyond these, the toolset covers everyday editing tasks — format
            conversion, trimming, volume adjustment, reversing, pitch shifting, and
            tempo changes — plus cleanup tools purpose-built for different jobs: a
            general-purpose noise remover with adjustable strength, a one-click
            Voice Cleaner tuned specifically for speech, an echo remover for mild
            room echo, and a silence remover that strips dead air throughout a whole
            recording. Every tool follows the same rule as the original three: it
            exists because it solved a real problem in an actual production or
            editing session, not because it filled a gap in a feature list.
          </p>
        </section>

        <section className="space-y-3 text-text-muted leading-relaxed">
          <h2 className="text-xl font-semibold text-text-primary">Who&apos;s behind it</h2>
          <p>
            AudioForges is built and maintained by a solo developer who is also a
            music producer working in melodic house and electronic styles. Every tool
            here exists because I needed it myself first — that&apos;s the bar for
            adding anything new to the site.
          </p>
        </section>

        <section className="space-y-3 text-text-muted leading-relaxed">
          <h2 className="text-xl font-semibold text-text-primary">Keeping it free</h2>
          {/* Was "runs on ad revenue". There are no ads on the site, and
              the footer already said costs come out of pocket — so the two
              pages contradicted each other, on the page a reviewer is most
              likely to read. Revisit this wording if ads are ever added. */}
          {/*
            REWRITTEN 2026-08-28. This said "no paid tier" and closed with
            "there isn't anything to pay for". Both stopped being true when
            Studio Quality separation started charging credits. This page is
            the one a reviewer, a journalist or a suspicious user reads to
            decide whether the site is honest — being caught overstating here
            costs far more than the paid tier earns.

            The fix is not to bury it. Naming the one thing that costs money,
            and saying plainly why, is a stronger position than an absolute
            that can be disproved in one click.
          */}
          <p>
            There are no ads on this site and no accounts. Servers, GPU time and
            bandwidth come out of my own pocket, offset by voluntary support
            via{" "}
            <a
              href="https://ko-fi.com/audioforges"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline"
            >
              Ko-fi
            </a>
            .
          </p>
          <p>
            Almost everything here is free and stays that way — conversion,
            editing, cleanup, analysis, practice tools, transcription, and
            standard vocal removal and stem splitting, all with full-quality
            downloads and no watermark. The tools that run on GPU time carry
            fair-use caps per person rather than an account, so one person
            can&apos;t tie up a shared machine.
          </p>
          <p>
            The single exception is Studio Quality separation. It runs a much
            heavier model, it costs real money every time it runs, and giving it
            away without limit isn&apos;t something one person paying out of
            pocket can sustain. So everyone gets free runs of it each month, and
            past that it takes{" "}
            <Link href="/pricing" className="text-amber-400 hover:underline">
              a credit
            </Link>{" "}
            — bought once, never expiring, with nothing recurring to cancel. If
            a run fails, the credit comes back automatically. Nothing else on
            the site is limited to push you toward it.
          </p>
          <p>
            Questions, feedback, or a tool you wish existed?{" "}
            <Link href="/contact" className="text-amber-400 hover:underline">
              Get in touch
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}