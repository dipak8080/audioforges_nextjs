import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getLiveTools, type Tool } from "@/lib/data/tools";
import { HeroConverter } from "@/components/home/HeroConverter";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Prose } from "@/components/ui/Prose";
import { ogImage } from "@/lib/og";

const TOOL_COUNT = getLiveTools().length;

const PAGE_TITLE = "AudioForges — Free Online Audio Tools: Stems, Key, BPM & Converter";
const PAGE_DESCRIPTION =
  "Free online audio tools for producers and DJs. Convert, edit, analyze, transcribe, find BPM and tune your instrument. No sign-up required.";

const OG_IMAGE = ogImage(
  "Free audio tools for producers",
  "Convert, analyse, clean up and take apart audio in the browser.",
  `${TOOL_COUNT} tools · No sign-up`
);

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
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

/**
 * PREFETCH IS SELECTIVE HERE, not blanket-disabled. The hero routes to
 * /youtube-to-wav on submit — the one route worth having ready. Everything
 * below is a menu for someone still deciding, and stays off: ~20 routes,
 * ~80 requests, not spent.
 */

/** EDIT FROM ANALYTICS every month or two. Unresolvable slugs are dropped
 *  and the list is topped up from the live catalogue, so the grid can never
 *  render with a hole in it. */
const POPULAR_SLUGS = [
  "youtube-to-wav",
  "vocal-remover",
  "audio-to-midi",
  "key-finder",
  "convert",
  "audio-to-text",
];

/** The producer workflow, in the order the steps happen. Step 04 carries
 *  three links: the transcription tools are new, and the homepage is the
 *  strongest internal signal a new page can get. */
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
    body: "Split out an instrumental, an acapella, or a written transcript.",
    links: [
      { href: "/vocal-remover", label: "Vocal Remover" },
      { href: "/audio-to-text", label: "Audio to Text" },
      { href: "/youtube-to-text", label: "YouTube to Text" },
    ],
  },
];

export default function HomePage() {
  const liveTools = getLiveTools();
  const toolCount = liveTools.length;

  const picked = POPULAR_SLUGS.map((slug) => liveTools.find((t) => t.slug === slug)).filter(
    (t): t is Tool => Boolean(t)
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

  const faqs: FAQItem[] = [
    {
      question: "What tools does AudioForges offer?",
      answer: `${toolCount} free audio tools covering conversion, trimming, volume, pitch and tempo, noise/echo/silence cleanup, vocal removal, key/BPM detection, instrument tuning, metronome practice, BPM tapping, and transcription with subtitle export — all with no sign-up required.`,
      answerNode: (
        <>
          {toolCount} free audio tools covering conversion, trimming, volume, pitch and tempo,
          noise/echo/silence cleanup, vocal removal, key/BPM detection, instrument tuning,
          metronome practice, BPM tapping, and transcription with subtitle export — all with no
          sign-up required.{" "}
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
        "Almost entirely. Every tool works free with no watermark, no sign-up and full-quality downloads — including vocal removal and stem splitting. The one exception is Studio Quality separation, a heavier model that costs real money per run on a GPU; everyone gets free runs of it each month, and after that it's a credit. Nothing recurring, and credits never expire. Fair-use limits apply so one person can't tie up the servers.",
      answerNode: (
        <>
          Almost entirely. Every tool works free with no watermark, no sign-up
          and full-quality downloads — including vocal removal and stem
          splitting. The one exception is Studio Quality separation, a heavier
          model that costs real money per run on a GPU: everyone gets free runs
          of it each month, and after that it&apos;s{" "}
          <Link
            href="/pricing"
            prefetch={false}
            className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            a credit
          </Link>
          . Nothing recurring, and credits never expire. Fair-use limits apply
          so one person can&apos;t tie up the servers. More on{" "}
          <Link
            href="/free-transcription-no-sign-up"
            prefetch={false}
            className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            what &quot;free&quot; usually means elsewhere
          </Link>
          .
        </>
      ),
    },
    {
      question: "What happens to the files I upload?",
      // DRAFT — CHECK AGAINST THE CACHE BEFORE DEPLOY. Replace "a short
      // period" with the real eviction window, and make the footer line agree.
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

      {/* max-w-6xl matches the nav and footer. */}
      <main id="main" className="mx-auto max-w-6xl px-4">
        {/* The hero stays CENTRED while tool pages are left-aligned. It's the
            one page with a single primary action and no breadcrumb, so
            centring puts the input where the eye already is. The type scale
            is shared with ToolPageShell so the system still reads as one. */}
        <section className="pt-16 text-center sm:pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            {toolCount} tools · no sign-up
          </p>
          <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-text-primary sm:text-6xl">
            Free audio tools for producers, DJs and musicians
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-text-muted sm:text-xl">
            Convert, analyse, clean up and take apart audio in the browser. Start by pasting a link.
          </p>

          <div className="mt-9">
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
        </section>

        <section className="mt-20 border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="How it fits together"
            title="Built around how the work actually goes"
            description="Prepping a DJ set, sampling for a beat, editing a podcast — the same few steps come up every time. Each is its own focused tool here rather than one bloated app."
          />

          {/* items-start, or a column with three links stretches the two-link
              columns beside it and leaves dead space under the last one. */}
          <ol className="mt-10 grid items-start gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
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

        <section className="border-t border-graphite-800 py-14">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow="Start here" title="Most used" />
            <Link
              href="/tools"
              prefetch={false}
              className="group flex shrink-0 items-center gap-1 pb-1 text-sm text-amber-400 transition-colors hover:text-amber-300"
            >
              All {toolCount} tools
              <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
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

        <section className="grid gap-10 border-t border-graphite-800 py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading eyebrow="Background" title="Why AudioForges" />
            <Prose className="mt-5">
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
            </Prose>
          </div>

          {/* self-start, or the grid stretches this to match the prose column
              and leaves the closing border floating below the last item. */}
          <dl className="divide-y divide-graphite-800 border-y border-graphite-800 lg:col-span-5 lg:self-start">
            {[
              ["No account", "No sign-up, no email, nothing to install."],
              ["No paywall", "No watermark, no premium tier, no artificial limits."],
              // "No queue" was wrong: transcription runs on a GPU worker that
              // spins down when idle, so the first run of the day waits ~a
              // minute — and it's the tool this claim gets tested against.
              ["No waiting around", "Most tools finish in seconds; transcription can take a minute."],
            ].map(([term, description]) => (
              <div key={term} className="py-4">
                <dt className="font-medium text-text-primary">{term}</dt>
                <dd className="mt-0.5 text-sm text-text-muted">{description}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="border-t border-graphite-800 py-14">
          <FAQSection eyebrow="Questions" faqs={faqs} />
        </div>
      </main>
    </>
  );
}