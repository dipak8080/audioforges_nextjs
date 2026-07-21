import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About AudioForges",
  description:
    "Why AudioForges exists, who builds it, and how each tool works under the hood.",
  alternates: { canonical: `${SITE_URL}/about` },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16 space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-text-primary">About AudioForges</h1>
        <p className="text-lg text-text-muted">
          A small set of audio tools, built by one producer for the workflow problems
          that kept coming up in their own sessions.
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
          converter, a key and BPM detector, and a vocal remover — and put them
          somewhere free for anyone else running into the same problem.
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
          vocals and often damages the mix. Because this runs on CPU rather than
          paid GPU infrastructure, it&apos;s limited to one separation per hour per
          person so it stays free and available for everyone.
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
