import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AudioWaveform, Music4, Zap } from "lucide-react";

const SITE_URL = "https://audioforges.com";

export const metadata: Metadata = {
  title: "AudioForges — Free Audio Tools for Music Producers & DJs",
  description:
    "Free, fast audio tools built for producers and DJs. Convert YouTube to WAV/MP3, detect key & BPM, and more — no sign-up required.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "AudioForges — Free Audio Tools for Music Producers & DJs",
    description:
      "Free, fast audio tools built for producers and DJs. No sign-up required.",
    url: SITE_URL,
    siteName: "AudioForges",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24 space-y-20">
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-graphite-700 bg-graphite-900 px-4 py-1.5 text-sm text-amber-400">
          <AudioWaveform className="h-4 w-4" />
          <span>Built for producers and DJs</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-text-primary">
          Free audio tools that
          <br className="hidden sm:block" /> respect your workflow
        </h1>
        <p className="text-lg text-text-muted max-w-2xl mx-auto">
          No sign-up, no watermark, no artificial limits. Just fast, high-quality
          tools for extracting and analyzing audio.
        </p>
        <div>
          <Link
            href="/youtube-to-wav"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors shadow-[0_0_0_1px_rgba(232,162,61,0.3)] hover:shadow-[0_0_24px_-4px_rgba(232,162,61,0.5)]"
          >
            Try YouTube to WAV converter
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Zap,
            title: "Fast",
            desc: "Most conversions finish in 20–40 seconds, no queue.",
          },
          {
            icon: Music4,
            title: "High quality",
            desc: "Lossless WAV or 320kbps MP3 — your choice, every time.",
          },
          {
            icon: AudioWaveform,
            title: "No sign-up",
            desc: "No account, no email, no watermark on your files.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 space-y-2"
          >
            <f.icon className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-text-primary">{f.title}</h3>
            <p className="text-sm text-text-muted">{f.desc}</p>
          </div>
        ))}
      </section>

<section className="space-y-4">
        <h2 className="text-2xl font-bold text-text-primary">Available tools</h2>
        <Link
          href="/youtube-to-wav"
          className="group block rounded-xl border border-graphite-800 bg-graphite-900 p-5 hover:border-amber-500/40 transition-colors"
        >
          <h3 className="font-semibold text-text-primary group-hover:text-amber-400 transition-colors">
            YouTube to WAV &amp; MP3 Converter →
          </h3>
          <p className="text-sm text-text-muted mt-1">
            Paste any YouTube link and download high-quality WAV or MP3 audio —
            works with standard videos and Shorts.
          </p>
        </Link>

        <Link
          href="/key-finder"
          className="group block rounded-xl border border-graphite-800 bg-graphite-900 p-5 hover:border-amber-500/40 transition-colors"
        >
          <h3 className="font-semibold text-text-primary group-hover:text-amber-400 transition-colors">
            Song Key &amp; BPM Finder →
          </h3>
          <p className="text-sm text-text-muted mt-1">
            Upload a track and instantly detect its musical key and tempo for
            mixing and production.
          </p>
        </Link>

<div className="rounded-xl border border-graphite-800 bg-graphite-900 p-5 hover:border-amber-500/40 transition-colors">
          <Link href="/vocal-remover" className="group block">
            <h3 className="font-semibold text-text-primary group-hover:text-amber-400 transition-colors">
              Vocal Remover →
            </h3>
            <p className="text-sm text-text-muted mt-1">
              Strip vocals from any track to get a clean instrumental — great for
              karaoke, practice, or remixing.
            </p>
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-text-primary">Why AudioForges</h2>
        <div className="space-y-3 text-text-muted leading-relaxed max-w-3xl">
          <p>
            AudioForges started as a set of tools built for a producer&apos;s own
            workflow — pulling reference audio, checking key and tempo before a
            session, and getting clean files without wading through ad-heavy
            downloader sites or signing up for yet another account.
          </p>
          <p>
            Every tool here is built to do one job well: convert, analyze, or
            extract audio quickly and accurately, then get out of your way.
          </p>
        </div>
      </section>
    </main>
  );
}