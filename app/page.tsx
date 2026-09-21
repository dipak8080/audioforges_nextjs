import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/lib/constants";
import { getLiveTools } from "@/lib/data/tools";
import { HeroForgePanel } from "@/components/home/HeroForgePanel";
import { buttonStyles } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";
import { SpecSheet } from "@/components/home/SpecSheet";
import { StudioTier } from "@/components/home/StudioTier";
import { UseCases } from "@/components/home/UseCases";
import { AlsoInStudio } from "@/components/home/AlsoInStudio";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ForgeMixerCard, shape } from "@/components/tools/ForgeMixerCard";
import { PianoRollCard } from "@/components/tools/PianoRollCard";
import { EngravedScore } from "@/components/ui/EngravedScore";
import { PageByline } from "@/components/tools/PageByline";
import { FeaturedOn } from "@/components/home/FeaturedOn";
import { ClosingCta } from "@/components/home/ClosingCta";
import { ogImage } from "@/lib/og";

const DEMO_STANDARD = "/audio/demo-vocals-standard.mp3";
const DEMO_STUDIO = "/audio/demo-vocals-studio.mp3";
const UPDATED = "2026-09-21";

const PAGE_TITLE = "AudioForges: AI Vocal Remover and Stem Splitter for Producers and DJs";
const PAGE_DESCRIPTION =
  "Separate any track into clean stems with named models, htdemucs and MelBand RoFormer. Full length WAV, an in browser stem mixer, and a Studio Quality tier for the cleanest result.";

const OG_IMAGE = ogImage(
  "Separate any track into clean stems",
  "Named models. Full length WAV. Mix the stems in the browser before you download.",
  "AudioForges Studio"
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

const FORGE = [
  { href: "/vocal-remover", name: "Forge Mixer", desc: "Mute, solo, volume and pan per stem. Loop a section, export the balance as WAV." },
  { href: "/audio-to-midi", name: "Forge Roll", desc: "Crossfade against the original, in sync. Move, resize and add notes, then export." },
  { href: "/audio-to-sheet-music", name: "Forge Score", desc: "Cursor follows the sound, bar by bar. Transpose, then print or export MusicXML." },
];

export default async function HomePage() {
  const processedTotal = await getProcessedTotal();
  const toolCount = getLiveTools().length;

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AudioForges",
    url: SITE_URL,
    description: PAGE_DESCRIPTION,
    sameAs: [],
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AudioForges",
    url: SITE_URL,
    description: PAGE_DESCRIPTION,
  };

  const faqs: FAQItem[] = [
    {
      question: "What is the difference between Standard and Studio Quality?",
      answer:
        "Standard runs htdemucs and costs nothing. Studio Quality runs MelBand RoFormer, a different architecture that leaves far less vocal bleed in the instrumental and fewer watery artifacts on cymbals and breaths. Studio Quality is one credit per track after the monthly free runs.",
      answerNode: (
        <>
          Standard runs htdemucs and costs nothing. Studio Quality runs MelBand RoFormer, a different
          architecture that leaves far less vocal bleed in the instrumental and fewer watery artifacts
          on cymbals and breaths. Studio Quality is one credit per track after the monthly free runs.{" "}
          <Link href="/pricing" prefetch={false} className="text-amber-400 underline underline-offset-2 hover:text-amber-300">
            See the packs
          </Link>
          .
        </>
      ),
    },
    {
      question: "Do I need an account?",
      answer:
        "No. Standard separation and every converter and editor work without an account, an email or an install. Credits attach to an email so they follow you between devices, and they never expire.",
    },
    {
      question: "Can I hear the result before downloading?",
      answer:
        "Yes. Separation opens in Forge Mixer, MIDI opens in Forge Roll, and sheet music opens in Forge Score. You hear or read what the model produced, fix what needs fixing, and only then take the file.",
    },
    {
      question: "What happens to the files I upload?",
      answer:
        "Uploads are processed and not kept as personal files. Results are held in a short temporary cache so a repeat request for the same source is not processed twice, then evicted automatically. Nothing is attached to an account.",
    },
    {
      question: "What else is in the studio?",
      answer: `${toolCount} tools in total: the separation engine, audio to MIDI, audio to sheet music, key and BPM detection, transcription, and a full set of converters and editors. Each one names the model it runs and prints its limits.`,
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />

      <main id="main">
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60rem 28rem at 78% 0%, rgba(232,162,61,0.10), transparent 60%), radial-gradient(40rem 20rem at 10% 100%, rgba(232,162,61,0.04), transparent 60%)",
            }}
          />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-12 lg:pb-20">
            <div className="lg:col-span-5">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
                AI stem separation
              </p>
              <h1 className="display mt-5 text-balance text-5xl text-text-primary sm:text-6xl lg:text-7xl">
                Separate any track into clean stems
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-text-muted">
                Vocals, drums, bass and the rest, back as full length WAV. Mix them in the browser
                before you download a single file.
              </p>

              <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-graphite-800 pt-6">
                {[
                  ["Models", "htdemucs, MelBand RoFormer"],
                  ["Output", "WAV 16-bit 44.1 kHz"],
                  ["Every month", processedTotal ? `${Math.round(processedTotal / 1000)}k tracks` : "55,000+ people"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">{k}</dt>
                    <dd className="mt-1 text-sm font-medium text-text-primary">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="lg:col-span-7">
              <div className="surface grain overflow-hidden rounded-xl border border-graphite-800">
                <HeroForgePanel />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Link href="/vocal-remover" prefetch={false} className={buttonStyles({ size: "lg" })}>
                  Drop your own track
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-sm text-text-subtle">No account. Full length WAV back.</p>
              </div>
            </div>
          </div>
        </section>

        <StudioTier standardSrc={DEMO_STANDARD} studioSrc={DEMO_STUDIO} />

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">The Forge</p>
              <h2 className="display mt-3 text-4xl text-text-primary sm:text-5xl">
                Hear it before you download it
              </h2>
            </div>
            <Link href="/forge" prefetch={false} className="text-sm text-text-muted transition-colors hover:text-amber-400">
              All three players
            </Link>
          </div>

          <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-3">
            <div className="flex flex-col">
              <ForgeMixerCard
                compact
                className="flex flex-1 flex-col"
                lanes={[
                  { name: "Vocals", peaks: shape(3, 0.9), active: true },
                  { name: "Drums", peaks: shape(5, 1.1) },
                  { name: "Bass", peaks: shape(9, 0.7) },
                  { name: "Other", peaks: shape(13, 0.95) },
                ]}
                points={[]}
              />
            </div>
            <div className="flex flex-col">
              <PianoRollCard className="flex flex-1 flex-col" points={[]} />
            </div>
            <div className="surface grain flex flex-1 flex-col overflow-hidden rounded-xl border border-graphite-800">
              <div className="flex items-center gap-3 px-4 pb-4 pt-4" aria-hidden>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-graphite-950">
                  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current">
                    <path d="M2.5 2h2.5v8H2.5zM7 2h2.5v8H7z" />
                  </svg>
                </span>
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-subtle">
                    Forge Score
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                    Piano · grand staff
                  </p>
                </div>
              </div>
              <div className="mx-3 mb-3 flex flex-1 items-center justify-center rounded-lg bg-graphite-950/70 p-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <EngravedScore glow className="w-full px-4 py-4 sm:px-5 sm:py-5" />
              </div>
              <p
                className="px-4 pb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle"
                aria-hidden
              >
                PDF · MusicXML · MIDI · SVG
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {FORGE.map((f) => (
              <Link key={f.href} href={f.href} prefetch={false} className="group px-1">
                <span className="font-semibold text-text-primary group-hover:text-amber-400">{f.name}</span>
                <span className="mt-1 block text-sm leading-relaxed text-text-muted">{f.desc}</span>
              </Link>
            ))}
          </div>
        </section>

        <UseCases />

        <section className="border-y border-graphite-800 bg-graphite-900/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">Checkable claims</p>
            <div className="mt-6">
              <SpecSheet />
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-4">
          <AlsoInStudio toolCount={toolCount} />

          <div className="border-t border-graphite-800 py-16">
            <FAQSection eyebrow="Questions" faqs={faqs} />
            <div className="mt-12">
              <PageByline
                updated={UPDATED}
                note="Homepage rebuilt around the separation engine and the Studio Quality tier"
              />
            </div>
          </div>

          <ClosingCta />
          <FeaturedOn />
        </div>
      </main>
    </>
  );
}