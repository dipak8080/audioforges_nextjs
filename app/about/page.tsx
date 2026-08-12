import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";

const PAGE_TITLE = "About AudioForges — Free Online Audio Tools";
const PAGE_DESCRIPTION =
  "Learn about AudioForges and our mission to build free audio tools for producers, DJs, musicians, and creators.";

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

export default function AboutPage() {
  return (
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
          practice, cleanup, and AI-powered processing — but the bar for adding
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
          infrastructure and is rate-limited per person to keep it available for
          everyone: 3 separations per hour at standard quality, 1 per hour at
          Studio Quality.
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
          Beyond these core tools, the toolset also covers everyday editing tasks —
          format conversion, trimming, volume adjustment, reversing, pitch shifting,
          and tempo changes — plus cleanup tools purpose-built for different jobs:
          a general-purpose noise remover with adjustable strength, a one-click
          Voice Cleaner tuned specifically for speech, an echo remover for mild
          room echo, a silence remover that strips dead air throughout a whole
          recording, and a Whisper-based speech-to-text transcriber with
          timestamped SRT export. Every tool follows the same rule as the original
          three: it exists because it solved a real problem in an actual production
          or editing session, not because it filled a gap in a feature list.
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
        <p>
          The site runs on ad revenue and voluntary support via{" "}
          <a
            href="https://ko-fi.com/audioforges"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline"
          >
            Ko-fi
          </a>
          . Server and processing costs (especially for vocal separation) are real,
          which is why that tool has a usage limit — everything else stays as
          unrestricted as the infrastructure allows.
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
  );
}