import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AudioWaveform, Music4, Zap } from "lucide-react";
import { SITE_URL } from "@/lib/constants";

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
    title: "AudioForges — Free Audio Tools for Music Producers & DJs",
    description:
      "Free, fast audio tools built for producers and DJs. No sign-up required.",
    images: ["/images/og-default.png"],
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "AudioForges",
  url: SITE_URL,
  description:
    "Free audio tools for music producers, DJs, and creators — YouTube to WAV/MP3 conversion, key & BPM detection, and vocal removal.",
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

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What tools does AudioForges offer?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A YouTube to WAV/MP3 converter, a song key & BPM finder, and a vocal remover — all free, with no sign-up required.",
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
        text: "Music producers, DJs, remixers, and content creators who need quick, accurate audio utilities without the friction of ad-heavy or sign-up-gated tools.",
      },
    },
  ],
};

export default function HomePage() {
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

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-text-primary">
            Audio tools for producers, DJs, and creators
          </h2>
          <div className="space-y-3 text-text-muted leading-relaxed max-w-3xl">
            <p>
              Whether you&apos;re prepping a DJ set, sampling for a beat, editing a
              podcast, or pulling reference audio for a mix, the same few steps come
              up again and again: get a clean audio file, know its key and tempo,
              and sometimes strip the vocals out entirely. AudioForges handles each
              of those steps as its own focused tool instead of one bloated app.
            </p>
            <p>
              Use <Link href="/youtube-to-wav" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">YouTube to WAV / MP3</Link>{" "}
              when you need a source file to work with — reference tracks, your own
              uploaded content, or royalty-free audio. Once you have a file, run it
              through the{" "}
              <Link href="/key-finder" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">Key &amp; BPM Finder</Link>{" "}
              to get the numbers you need for harmonic mixing, or the{" "}
              <Link href="/vocal-remover" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">Vocal Remover</Link>{" "}
              if you need an instrumental or acapella. All three are built to be
              used together, in whatever order your workflow needs.
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
                A YouTube to WAV/MP3 converter, a song key &amp; BPM finder, and a
                vocal remover — all free, with no sign-up required.
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
                Music producers, DJs, remixers, and content creators who need quick,
                accurate audio utilities without the friction of ad-heavy or
                sign-up-gated tools.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}