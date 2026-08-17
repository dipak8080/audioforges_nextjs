import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { TOOLS, getLiveTools } from "@/lib/data/tools";
import { HeroConverter } from "@/components/home/HeroConverter";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";

const PAGE_TITLE = "Free Audio Tools for Music Producers, DJs & Musicians";
const PAGE_DESCRIPTION =
  "Free online audio tools for producers and DJs. Convert, edit, analyze, tune instruments, find BPM, and practice with a metronome. No sign-up required.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: SITE_URL,
    siteName: "AudioForges",
    type: "website",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630, alt: "AudioForges" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/images/og-default.png"],
  },
};

/**
 * PREFETCH IS SELECTIVE HERE (2026-08-16), not blanket-disabled.
 *
 * Highest-traffic page, so a needless prefetch costs the most - four App
 * Router segments per route, every visit - and a useful one earns the
 * most. The hero converter routes to /youtube-to-wav on submit, which is
 * the one route worth having ready. Everything below is a menu of options
 * for someone still deciding, and stays off: ~20 routes, ~80 requests,
 * not spent. Navigation is unaffected either way.
 */

/**
 * EDIT THIS from Analytics every month or two. Unresolvable slugs are
 * dropped and the list is topped up from the live catalogue, so the grid
 * can never render with a hole in it.
 */
const POPULAR_SLUGS = [
  "youtube-to-wav",
  "vocal-remover",
  "audio-to-midi",
  "key-finder",
  "convert",
  "speech-to-text",
];

/**
 * Deterministic bar heights - NOT Math.random(). This renders on the
 * server, so a random array would produce different markup on the client
 * and throw a hydration mismatch.
 */
const WAVE = [
  8, 14, 22, 36, 52, 40, 28, 44, 64, 48, 30, 20, 34, 56, 72, 54, 38, 26, 18, 30, 46, 62, 44, 32,
  22, 14, 26, 42, 58, 40, 28, 18, 12, 20, 34, 24, 16, 10, 14, 8,
];

/**
 * The producer workflow, in the order the steps happen. Every internal
 * link that used to live in the eleven-link prose paragraph is here
 * instead - same link equity and keywords, scannable rather than buried.
 */
const WORKFLOW = [
  {
    step: "01",
    title: "Get the audio",
    body: "Pull a reference track, or convert what you already have.",
    links: [
      { href: "/youtube-to-wav", label: "YouTube to WAV / MP3" },
      { href: "/convert", label: "Format Converter" },
    ],
  },
  {
    step: "02",
    title: "Know what you have",
    body: "Key and tempo, before it goes into a session or a set.",
    links: [
      { href: "/key-finder", label: "Key & BPM Finder" },
      { href: "/bpm-tapper", label: "BPM Tapper" },
    ],
  },
  {
    step: "03",
    title: "Clean it up",
    body: "Strip noise, room echo and background off a usable take.",
    links: [
      { href: "/noise-remove", label: "Noise Remover" },
      { href: "/voice-clean", label: "Voice Cleaner" },
    ],
  },
  {
    step: "04",
    title: "Take it apart",
    body: "Split out an instrumental, an acapella, or a transcript.",
    links: [
      { href: "/vocal-remover", label: "Vocal Remover" },
      { href: "/speech-to-text", label: "Speech to Text" },
    ],
  },
];

export default function HomePage() {
  const liveTools = getLiveTools();
  const toolCount = liveTools.length;

  const picked = POPULAR_SLUGS.map((slug) => liveTools.find((t) => t.slug === slug)).filter(
    (t): t is (typeof TOOLS)[number] => Boolean(t)
  );
  const popular = [
    ...picked,
    ...liveTools.filter((t) => !picked.some((p) => p.slug === t.slug)),
  ].slice(0, 6);

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
    description: "Free, fast audio tools built for producers and DJs — no sign-up required.",
  };

  // FAQSection emits the FAQPage schema from this same array, so there is
  // no hand-written faqJsonLd on this page - the visible answers and the
  // schema can't drift apart.
  const faqs: FAQItem[] = [
    {
      question: "What tools does AudioForges offer?",
      answer: `${toolCount} free audio tools covering conversion, trimming, volume, pitch and tempo, noise/echo/silence cleanup, vocal removal, key/BPM detection, instrument tuning, metronome practice, BPM tapping, and speech-to-text transcription — all with no sign-up required.`,
      answerNode: (
        <>
          {toolCount} free audio tools covering conversion, trimming, volume, pitch and tempo,
          noise/echo/silence cleanup, vocal removal, key/BPM detection, instrument tuning,
          metronome practice, BPM tapping, and speech-to-text transcription — all with no sign-up
          required.{" "}
          <Link
            href="/tools"
            prefetch={false}
            className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            See the full list
          </Link>
          .
        </>
      ),
    },
    {
      question: "Do I need an account to use AudioForges?",
      answer:
        "No. Every tool works without creating an account, entering an email, or installing anything.",
    },
    {
      question: "Are the tools actually free?",
      answer:
        "Yes. There's no watermark, no paywall, and no hidden tier — the free tools are the only tools.",
    },
    {
      question: "What happens to the files I upload?",
      // DRAFT - CHECK THIS AGAINST THE CACHE BEFORE DEPLOY. It is written
      // to be true of an LRU result cache rather than claiming nothing is
      // ever stored, which the old footer copy did and which isn't
      // accurate. Add the real eviction window in place of "a short
      // period", and make the footer line agree with whatever you settle
      // on here.
      answer:
        "Uploads are processed and not kept as personal files. Converted results are held in a temporary cache for a short period so repeat requests for the same source don't have to be processed twice, then evicted automatically. No account is attached to anything you convert.",
    },
    {
      question: "Who is AudioForges built for?",
      answer:
        "Music producers, DJs, remixers, musicians, podcasters, and content creators who need quick, accurate audio utilities without the friction of ad-heavy or sign-up-gated tools.",
    },
  ];

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

      {/* max-w-6xl matches the nav and footer; the page was max-w-5xl, so
          every section sat 64px inside the header above it. */}
      <main id="main" className="mx-auto max-w-6xl px-4">
        <section className="pt-16 text-center sm:pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            {toolCount} tools · no sign-up
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Free audio tools for producers, DJs and musicians
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-muted">
            Convert, analyse, clean up and take apart audio in the browser. Start by pasting a link.
          </p>

          <div className="mt-8">
            <HeroConverter />
          </div>

          <p className="text-sm text-text-subtle">
            Or{" "}
            <Link
              href="/tools"
              prefetch={false}
              className="text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
            >
              browse all {toolCount} tools
            </Link>{" "}
            — every one takes an uploaded file too.
          </p>

          {/* The one piece of decoration on the page, and it's the site's
              own subject matter. Static: an animated waveform on a page
              where nothing is playing is a lie about what's happening.
              mt-10 keeps it tied to the hero - at mt-14 it floated closer
              to the divider below than to the block it belongs to. */}
          <div
            aria-hidden="true"
            className="mt-10 flex h-20 items-center justify-center gap-[3px] [mask-image:linear-gradient(to_right,transparent,black_25%,black_75%,transparent)]"
          >
            {WAVE.map((height, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-amber-500/25"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
        </section>

        {/* WORKFLOW - replaces the three feature cards ("Fast", "High
            quality", "No sign-up"): claims every tool site makes, none a
            visitor can check before trying something. This says what the
            site is FOR instead. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <SectionHeading
            eyebrow="How it fits together"
            title="Built around how the work actually goes"
            description="Prepping a DJ set, sampling for a beat, editing a podcast — the same few steps come up every time. Each is its own focused tool here rather than one bloated app."
          />

          <ol className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW.map((stage) => (
              <li key={stage.step} className="border-t border-graphite-800 pt-4">
                <p className="font-mono text-xs text-amber-500">{stage.step}</p>
                <h3 className="mt-2 font-semibold text-text-primary">{stage.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{stage.body}</p>
                <div className="mt-3.5 flex flex-col gap-1.5">
                  {stage.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={false}
                      className="group flex w-fit items-center gap-1 text-sm text-amber-400 transition-colors hover:text-amber-300"
                    >
                      {link.label}
                      <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* MOST USED - card treatment matches /tools so the two pages read
            as one system rather than two designs. */}
        <section className="border-t border-graphite-800 py-12 sm:py-14">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow="Start here" title="Most used" />
            <Link
              href="/tools"
              prefetch={false}
              className="shrink-0 pb-1 text-sm text-amber-400 transition-colors hover:text-amber-300"
            >
              All {toolCount} tools →
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popular.map((tool) => (
              <Link
                key={tool.slug}
                href={`/${tool.slug}`}
                prefetch={false}
                className="group relative block overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-5 transition-colors duration-200 hover:border-amber-500/40 hover:bg-graphite-850 focus:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-5 left-0 w-[2px] origin-center scale-y-0 rounded-full bg-amber-500 transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100 motion-reduce:transition-none"
                />
                <h3 className="font-semibold text-text-primary transition-colors group-hover:text-amber-400">
                  {tool.name}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  {tool.shortDescription}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* WHY - the old page ran three near-identical prose sections
            ("Why AudioForges", "Audio tools for...", "Why trust...") at
            ~600 words of grey text under identical headings. Same
            substance and keywords, a third of the length. */}
        <section className="grid gap-10 border-t border-graphite-800 py-12 sm:py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading eyebrow="Background" title="Why AudioForges" />
            <div className="mt-5 space-y-3 leading-relaxed text-text-muted">
              <p>
                AudioForges started as a set of tools built for one producer&apos;s own workflow —
                pulling reference audio, checking key and tempo before a session, getting clean
                files without wading through ad-heavy downloader sites or signing up for another
                account. It&apos;s grown into a full toolkit for conversion, editing, cleanup,
                analysis, tuning, tempo, practice and transcription.
              </p>
              <p>
                Each tool does one job: convert, analyse, clean up, tune or extract — accurately,
                then get out of the way. If one stops meeting that bar it gets fixed or rebuilt
                rather than left to quietly degrade.
              </p>
            </div>
          </div>

          {/* self-start, or the grid stretches this to match the prose
              column and leaves the closing border floating ~110px below
              the last item. */}
          <dl className="divide-y divide-graphite-800 border-y border-graphite-800 lg:col-span-5 lg:self-start">
            {[
              ["No account", "No sign-up, no email, nothing to install."],
              ["No paywall", "No watermark, no premium tier, no artificial limits."],
              ["No queue", "Most tools finish in seconds."],
            ].map(([term, description]) => (
              <div key={term} className="py-4">
                <dt className="font-medium text-text-primary">{term}</dt>
                <dd className="mt-0.5 text-sm text-text-muted">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="border-t border-graphite-800 py-12 sm:py-14">
          <FAQSection eyebrow="Questions" faqs={faqs} />
        </div>
      </main>
    </>
  );
}

/**
 * One heading treatment for every section: mono eyebrow, then the h2.
 * The old page gave five sections the identical bare `text-2xl font-bold`
 * with nothing to separate or rank them, which is most of why it scanned
 * as an undifferentiated column of text.
 */
function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
        {title}
      </h2>
      {description && <p className="mt-3 leading-relaxed text-text-muted">{description}</p>}
    </div>
  );
}