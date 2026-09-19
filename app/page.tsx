import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE_URL } from "@/lib/constants";
import { getLiveTools } from "@/lib/data/tools";
import { HeroConverter } from "@/components/home/HeroConverter";
import { HeroForgePanel } from "@/components/home/HeroForgePanel";
import { FlagshipTools } from "@/components/home/FlagshipTools";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Prose } from "@/components/ui/Prose";
import { SpecSheet } from "@/components/home/SpecSheet";
import { ForgeMixerCard, shape } from "@/components/tools/ForgeMixerCard";
import { PianoRollCard } from "@/components/tools/PianoRollCard";
import { EngravedScore } from "@/components/ui/EngravedScore";
import { PageByline } from "@/components/tools/PageByline";
import { FeaturedOn } from "@/components/home/FeaturedOn";
import { ClosingCta } from "@/components/home/ClosingCta";
import { ogImage } from "@/lib/og";

const TOOL_COUNT = getLiveTools().length;

const PAGE_TITLE = "AudioForges: Free Audio Tools for Producers, DJs, Musicians";
const PAGE_DESCRIPTION =
  "Free browser audio tools for producers, DJs and musicians. Every model is named, every limit is published, and results play back before you download.";

const OG_IMAGE = ogImage(
  "Free audio tools for producers, DJs and musicians",
  "Every model named. Every limit published. Results play back before you download.",
  `${TOOL_COUNT} tools · No sign-up`
);

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
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
 * /youtube-to-wav on submit, the one route worth having ready. Everything
 * below is a menu for someone still deciding, and stays off: ~20 routes,
 * ~80 requests, not spent.
 */


/** The producer workflow, in the order the steps happen. Step 04 carries
 *  three links: the transcription tools are new, and the homepage is the
 *  strongest internal signal a new page can get. */
const WORKFLOW = [
  {
    step: "01",
    title: "Get the audio",
    body: "Pull a reference track, or convert what you already have.",
    links: [
      { href: "/youtube-to-wav", label: "YouTube to WAV" },
      { href: "/youtube-to-mp3", label: "YouTube to MP3" },
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

const STATS_API =
  process.env.NEXT_PUBLIC_RAILWAY_API_BASE || "https://api.audioforges.com";

async function getProcessedTotal(): Promise<number | null> {
  try {
    const res = await fetch(`${STATS_API}/stats/public`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { total_jobs?: number };
    return typeof data.total_jobs === "number" && data.total_jobs > 0 ? data.total_jobs : null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const processedTotal = await getProcessedTotal();
  const liveTools = getLiveTools();
  const toolCount = liveTools.length;


  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AudioForges",
    url: SITE_URL,
    description:
      "Free browser audio tools for producers, DJs and musicians. Every model is named, every limit is published, and results play back before you download.",
    sameAs: [],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AudioForges",
    url: SITE_URL,
    description:
      "Free browser audio tools for producers, DJs and musicians. Every model is named, every limit is published, and results play back before you download.",
  };

  const faqs: FAQItem[] = [
    {
      question: "What tools does AudioForges offer?",
      answer: `${toolCount} free audio tools covering conversion, trimming, volume, pitch and tempo, noise/echo/silence cleanup, vocal removal, key/BPM detection, instrument tuning, metronome practice, BPM tapping, and transcription with subtitle export.`,
      answerNode: (
        <>
          {toolCount} free audio tools covering conversion, trimming, volume, pitch and tempo,
          noise/echo/silence cleanup, vocal removal, key/BPM detection, instrument tuning,
          metronome practice, BPM tapping, and transcription with subtitle export.{" "}
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
        "Almost entirely. Every tool works free with no watermark and full-quality downloads, including standard vocal removal and stem splitting. The exceptions are the jobs that need a GPU: Studio Quality separation, high-accuracy MIDI, transcription and sheet music. Everyone gets free runs of those each month, and after that they take credits: bought once, never expiring, refunded if a run fails. Fair-use limits apply so one person cannot tie up the servers.",
      answerNode: (
        <>
          Almost entirely. Every tool works free with no watermark and full-quality downloads,
          including standard vocal removal and stem splitting. The exceptions are the jobs that need a GPU:
          Studio Quality separation, high-accuracy MIDI, transcription and sheet music. Everyone gets free runs
          of those each month, and after that they take{" "}
          <Link href="/pricing" prefetch={false} className="text-amber-400 underline underline-offset-2 hover:text-amber-300">
            credits
          </Link>
          : bought once, never expiring, refunded if a run fails. Fair-use limits apply so one person cannot tie
          up the servers.
        </>
      ),
    },
    {
      question: "Can I hear my MIDI or sheet music before downloading it?",
      answer:
        "Yes. The Audio to MIDI converter opens every transcription in an interactive DAW-style piano roll, play it in the browser, slow it down to 50%, and on full-mix HQ runs solo or mute each stem. The Audio to Sheet Music tool renders a live engraved score with synced playback: a cursor follows the staff and each note lights up as it sounds, so you can verify the transcription before downloading the PDF, MusicXML, or MIDI.",
      answerNode: (
        <>
          Yes. The{" "}
          <Link
            href="/audio-to-midi"
            prefetch={false}
            className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            Audio to MIDI converter
          </Link>{" "}
          opens every transcription in an interactive DAW-style piano roll, play it in the
          browser, slow it down to 50%, and on full-mix HQ runs solo or mute each stem. The{" "}
          <Link
            href="/audio-to-sheet-music"
            prefetch={false}
            className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
          >
            Audio to Sheet Music
          </Link>{" "}
          tool renders a live engraved score with synced playback: a cursor follows the staff and
          each note lights up as it sounds, so you can verify the transcription before
          downloading the PDF, MusicXML, or MIDI.
        </>
      ),
    },
    {
      question: "What happens to the files I upload?",
      // DRAFT, CHECK AGAINST THE CACHE BEFORE DEPLOY. Replace "a short
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
        <section className="pt-14 sm:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
                {toolCount} tools · no sign-up
              </p>
              <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-text-primary sm:text-5xl">
                Studio-grade audio tools that run in your browser
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
                Split stems, find key and BPM, convert formats and clean up takes, free in the
                browser. Every result plays back before you download it.
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
                </Link>
                . Every one takes an uploaded file too.
              </p>

              <p className="mt-7 text-sm text-text-subtle">
                <span className="font-medium text-text-secondary">55,000+</span> producers, DJs and
                musicians use AudioForges every month.
                {processedTotal !== null && (
                  <>
                    {" "}
                    <span className="font-medium text-text-secondary">
                      {processedTotal.toLocaleString("en-US")}
                    </span>{" "}
                    jobs processed so far.
                  </>
                )}
              </p>
            </div>

            <HeroForgePanel />
          </div>
        </section>

        <section className="mt-14">
          <SpecSheet />
        </section>

        <section className="mt-14 border-t border-graphite-800 py-14">
          <SectionHeading
            eyebrow="How it fits together"
            title="Built around how the work actually goes"
            description="Prepping a DJ set, sampling for a beat, editing a podcast, the same few steps come up every time. Each is its own focused tool here rather than one bloated app."
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
          <SectionHeading
            eyebrow="The Forge"
            title="Hear it before you download it"
            description="Every heavy job opens in a player built for that output: a stem mixer, a piano roll, an engraved score. You hear or read what the model produced, fix what needs fixing, and only then take the file."
          />
          <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
            <div className="flex flex-col">
              <Link href="/vocal-remover" prefetch={false} className="group mb-3 block">
                <span className="font-semibold text-text-primary group-hover:text-amber-400">Forge Mixer</span>
              </Link>
              <ForgeMixerCard
                compact
                stackPoints
                className="flex flex-1 flex-col"
                lanes={[
                  { name: "Vocals", peaks: shape(3, 0.9), active: true },
                  { name: "Drums", peaks: shape(5, 1.1) },
                  { name: "Bass", peaks: shape(9, 0.7) },
                  { name: "Other", peaks: shape(13, 0.95) },
                ]}
                points={[
                  "Mute, solo, volume and pan per stem.",
                  "Loop a section, export the balance as WAV.",
                ]}
              />
            </div>
            <div className="flex flex-col">
              <Link href="/audio-to-midi" prefetch={false} className="group mb-3 block">
                <span className="font-semibold text-text-primary group-hover:text-amber-400">Forge Roll</span>
              </Link>
              <PianoRollCard
                stackPoints
                className="flex flex-1 flex-col"
                points={[
                  "Crossfade against the original, in sync.",
                  "Move, resize and add notes, then export.",
                ]}
              />
            </div>
            <div className="flex flex-col">
              <Link href="/audio-to-sheet-music" prefetch={false} className="group mb-3 block">
                <span className="font-semibold text-text-primary group-hover:text-amber-400">Forge Score</span>
              </Link>
              <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
                <div className="flex flex-1 items-center p-4">
                  <EngravedScore glow className="w-full px-4 py-4 sm:px-5 sm:py-5" />
                </div>
                <ul className="mt-auto grid gap-y-3 border-t border-graphite-800 p-5 text-sm leading-relaxed text-text-muted">
                  {["Cursor follows the sound, bar by bar.", "Transpose, then print or export MusicXML."].map((pt) => (
                    <li key={pt} className="flex gap-2.5">
                      <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-amber-400" aria-hidden />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-text-muted">
            <Link
              href="/forge"
              prefetch={false}
              className="text-amber-400 underline-offset-4 hover:underline"
            >
              See what all three players do
            </Link>
            , with the controls and export formats for each.
          </p>
        </section>

        <FlagshipTools toolCount={toolCount} />

        <section className="grid gap-10 border-t border-graphite-800 py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeading eyebrow="Background" title="Why AudioForges" />
            <Prose className="mt-5">
              <p>
                AudioForges is built by Dipak, a producer in Kathmandu, for his own sessions first:
                pulling reference audio, checking key and tempo before a session, getting clean files
                without an ad-heavy downloader or another account. It has grown into a full toolkit
                for conversion, editing, cleanup, analysis, tuning, tempo, practice and transcription.
              </p>
              <p>
                Each tool does one job, names what it runs, and says where it fails, before you
                upload.
              </p>
            </Prose>
          </div>

          {/* self-start, or the grid stretches this to match the prose column
              and leaves the closing border floating below the last item. */}
          <dl className="divide-y divide-graphite-800 border-y border-graphite-800 lg:col-span-5 lg:self-start">
            {[
              ["No account", "No sign-up, no email, nothing to install."],
              ["Free core", "Standard separation, every converter and editor, no watermark. GPU jobs take credits after free runs."],
              ["Honest about limits", "Rate limits, retention windows and failure cases are printed on every tool page, read live from the backend."],
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
          <div className="mt-12">
            <PageByline updated="2026-09-16" note="Homepage rebuilt around the Forge players; every tool page has named models, published limits and playable results" />
          </div>
        </div>

        <ClosingCta toolCount={toolCount} />

        <FeaturedOn />
      </main>
    </>
  );
}