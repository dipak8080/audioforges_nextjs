import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AudioWaveform, Music4, Zap, LayoutGrid } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { CATEGORY_ORDER, getToolsByCategory, getLiveTools } from "@/lib/data/tools";

export const metadata: Metadata = {
  title: "Free Audio Tools for Music Producers, DJs & Musicians",
description:
  "Free online audio tools for producers, DJs, and musicians - convert, edit, clean, analyze, tune, find BPM, and practice with a metronome.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "Free Audio Tools for Music Producers, DJs & Musicians",
    description:
      "Free online audio tools for producers, DJs, and musicians — convert, edit, clean, analyze, tune instruments, find BPM, and practice with a metronome. No sign-up required.",
    url: SITE_URL,
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
    title: "Free Audio Tools for Music Producers, DJs & Musicians",
    description:
      "Free online audio tools for producers, DJs, and musicians — convert, edit, clean, analyze, tune instruments, find BPM, and practice with a metronome. No sign-up required.",
    images: ["/images/og-default.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AudioForges",
  url: SITE_URL,
  description:
    "Free audio tools for music producers, DJs, musicians, and creators — conversion, editing, cleanup, pitch, tempo, tuning, metronome, BPM, and transcription tools.",
  sameAs: [],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AudioForges",
  url: SITE_URL,
  description:
    "Free, fast audio tools built for producers and DJs — no sign-up required.",
};

export default function HomePage() {
  const liveTools = getLiveTools();

  const featured = CATEGORY_ORDER.map((category) =>
    getToolsByCategory(category).find((t) => t.status === "live")
  ).filter((t): t is NonNullable<typeof t> => Boolean(t));

  // Built inside the component (rather than as a module-level constant) so
  // the tool count and description can never go stale the way the old
  // hardcoded "14 free audio tools" text did as new tools got added.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What tools does AudioForges offer?",
        acceptedAnswer: {
          "@type": "Answer",
          text: `${liveTools.length} free audio tools covering conversion, trimming, volume, pitch and tempo, noise/echo/silence cleanup, vocal removal, key/BPM detection, instrument tuning, metronome practice, BPM tapping, and speech-to-text transcription — all with no sign-up required.`,
        },
      },
      {
        "@type": "Question",
        name: "Do I need an account to use AudioForges?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. Every tool works without creating an account, entering an email, or installing anything.",
        },
      },
      {
        "@type": "Question",
        name: "Are the tools actually free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. There's no watermark, no paywall, and no hidden tier — the free tools are the only tools.",
        },
      },
      {
        "@type": "Question",
        name: "Who is AudioForges built for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Music producers, DJs, remixers, musicians, podcasters, and content creators who need quick, accurate audio utilities without the friction of ad-heavy or sign-up-gated tools.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24 space-y-20">
        <section className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-graphite-700 bg-graphite-900 px-4 py-1.5 text-sm text-amber-400">
            <AudioWaveform className="h-4 w-4" />
            <span>{liveTools.length} free tools for producers and DJs</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-text-primary">
            Free audio tools that
            <br className="hidden sm:block" /> respect your workflow
          </h1>
          <p className="text-lg text-text-muted max-w-2xl mx-auto">
            No sign-up, no watermark, no artificial limits. Convert, edit,
            clean up, analyze, tune, and practice — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/youtube-to-wav"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 text-graphite-950 font-medium px-6 py-3 hover:bg-amber-400 transition-colors shadow-[0_0_0_1px_rgba(232,162,61,0.3)] hover:shadow-[0_0_24px_-4px_rgba(232,162,61,0.5)]"
            >
              Try YouTube to WAV converter
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 rounded-lg border border-graphite-700 text-text-primary font-medium px-6 py-3 hover:border-amber-500/40 hover:text-amber-400 transition-colors"
            >
              <LayoutGrid className="h-4 w-4" />
              Browse all {liveTools.length} tools
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Zap,
              title: "Fast",
              desc: "Most tools finish in seconds, no queue.",
            },
            {
              icon: Music4,
              title: "High quality",
              desc: "Lossless output where it matters, every time.",
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
              <p className="font-semibold text-text-primary">{f.title}</p>
              <p className="text-sm text-text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-primary">Popular tools</h2>
            <Link
              href="/tools"
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {featured.map((tool) => (
              <Link
                key={tool.slug}
                href={`/${tool.slug}`}
                className="group block rounded-xl border border-graphite-800 bg-graphite-900 p-5 hover:border-amber-500/40 transition-colors"
              >
                <h3 className="font-semibold text-text-primary group-hover:text-amber-400 transition-colors">
                  {tool.name} →
                </h3>
                <p className="text-sm text-text-muted mt-1">{tool.shortDescription}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why AudioForges</h2>
          <div className="space-y-3 text-text-muted leading-relaxed max-w-3xl">
            <p>
              AudioForges started as a set of tools built for a producer&apos;s own
              workflow — pulling reference audio, checking key and tempo before a
              session, and getting clean files without wading through ad-heavy
              downloader sites or signing up for yet another account. It&apos;s since
              grown into a full toolkit covering conversion, editing, cleanup,
              analysis, tuning, tempo, practice, and transcription.
            </p>
            <p>
              Every tool here is built to do one job well: convert, analyze, clean
              up, tune, or extract audio quickly and accurately, then get out of your way.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Audio tools for producers, DJs, and creators
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed max-w-3xl">
            <p>
              Whether you&apos;re prepping a DJ set, sampling for a beat, editing a
              podcast, or pulling reference audio for a mix, the same few steps come
              up again and again: get a clean audio file, know its key and tempo,
              trim or adjust it, and sometimes strip the vocals out entirely.
              AudioForges handles each of those steps as its own focused tool
              instead of one bloated app.
            </p>
            <p>
              Start with{" "}
              <Link href="/youtube-to-wav" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                YouTube to WAV / MP3
              </Link>{" "}
              or the{" "}
              <Link href="/convert" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Format Converter
              </Link>{" "}
              to get a source file. From there, check its{" "}
              <Link href="/key-finder" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                key and BPM
              </Link>
              , use the{" "}
              <Link href="/bpm-tapper" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                BPM Tapper
              </Link>{" "}
              to tap along and find a song&apos;s tempo, set that BPM in the{" "}
              <Link href="/metronome" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Online Metronome
              </Link>
              , or tune an instrument with the{" "}
              <Link href="/tuner" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Online Instrument Tuner
              </Link>
              . Pull out an{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                instrumental or acapella
              </Link>
              , clean up noise with the{" "}
              <Link href="/noise-remove" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Noise Remover
              </Link>{" "}
              or{" "}
              <Link href="/voice-clean" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Voice Cleaner
              </Link>
              , or get a full transcript with{" "}
              <Link href="/speech-to-text" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                Speech to Text
              </Link>
              . Every tool is built to be used together, in whatever order your
              workflow needs — browse the{" "}
              <Link href="/tools" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                full list
              </Link>{" "}
              to see everything available.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Why trust AudioForges</h2>
          <div className="space-y-3 text-text-muted leading-relaxed max-w-3xl">
            <p>
              AudioForges doesn&apos;t require an account, doesn&apos;t store the
              files you upload or convert, and doesn&apos;t bury tools behind paywalls
              or fake &quot;premium&quot; tiers. What you see is what runs — no
              artificial limits designed to push you toward a paid plan.
            </p>
            <p>
              Each tool is built and maintained around one job: reliable, accurate
              output, quickly. If a tool stops meeting that bar, it gets fixed or
              rebuilt rather than left to quietly degrade.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">Frequently asked questions</h2>
          <div className="space-y-5 text-text-muted leading-relaxed max-w-3xl">
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                What tools does AudioForges offer?
              </h3>
              <p>
                {liveTools.length} free audio tools covering conversion, trimming,
                volume, pitch and tempo, noise/echo/silence cleanup, vocal removal,
                key/BPM detection, instrument tuning, metronome practice, BPM
                tapping, and speech-to-text transcription — all with no sign-up
                required.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Do I need an account to use AudioForges?
              </h3>
              <p>
                No. Every tool works without creating an account, entering an email,
                or installing anything.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Are the tools actually free?
              </h3>
              <p>
                Yes. There&apos;s no watermark, no paywall, and no hidden tier — the
                free tools are the only tools.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-text-primary mb-1">
                Who is AudioForges built for?
              </h3>
              <p>
                Music producers, DJs, remixers, musicians, podcasters, and content
                creators who need quick, accurate audio utilities without the
                friction of ad-heavy or sign-up-gated tools.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}