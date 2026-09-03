import type { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  Minus,
  AudioWaveform,
  Music2,
  ScrollText,
  FileText,
  Music4,
  FileAudio,
  Piano,
  Guitar,
  Sparkles,
  Layers,
} from "lucide-react";
import { AudioToSheetForm } from "@/components/converter/AudioToSheetForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { FeatureStrip } from "@/components/ui/FeatureStrip";
import { EngravedScore } from "@/components/ui/EngravedScore";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";
import { ogImage } from "@/lib/og";
import { cn } from "@/lib/utils/cn";

const PAGE_TITLE = "Audio to Sheet Music — Convert MP3 to Notation (PDF, MusicXML)";
const PAGE_DESCRIPTION =
  "Turn any recording into sheet music online. Upload MP3, WAV or a piano recording and get engraved notation as PDF, MusicXML and MIDI. Free preview, no sign-up, no subscription.";

const OG_IMAGE = ogImage("Audio to Sheet Music", "MP3 to notation — PDF, MusicXML & MIDI", "New");

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/audio-to-sheet-music` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/audio-to-sheet-music`,
    siteName: SITE_NAME,
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

const webAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Audio to Sheet Music",
  url: `${SITE_URL}/audio-to-sheet-music`,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Convert MP3, WAV, FLAC and more into engraved sheet music",
    "Piano transcription powered by a solo-piano specialist AI (Transkun)",
    "Two-hand grand-staff notation for piano",
    "Download as PDF, MusicXML, MIDI, and SVG",
    "Free 30-second preview — see the score before you pay",
    "No sign-up, no subscription, no software to install",
  ],
};

const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF", "OPUS", "WEBM"];

// The four-stage pipeline, drawn instead of described. Mirrors the backend
// pipeline in the handoff: transcribe → analyze → notate → engrave.
const PIPELINE = [
  { icon: AudioWaveform, title: "Transcribe", desc: "An AI model listens to the recording and detects every note — pitch and timing. Piano goes to a solo-piano specialist." },
  { icon: Music2, title: "Analyze", desc: "Tempo and key are detected so the notes can be quantized onto a real beat grid instead of floating in time." },
  { icon: ScrollText, title: "Notate", desc: "Notes snap to the grid, the key and time signature go in, and piano is split across two hands into a grand staff." },
  { icon: FileText, title: "Engrave", desc: "The notation is typeset into a clean, readable score — the same engraving you see in the free preview." },
];

const INSTRUMENTS = [
  { icon: Piano, name: "Piano", best: true, desc: "The best-supported case. Routed to Transkun, a model trained on solo piano, and split into a two-hand grand staff the way piano music is normally written." },
  { icon: Guitar, name: "Guitar", desc: "Clean single-note lines transcribe well. Heavily distorted or chord-dense parts are a harder detection problem for any automatic tool." },
  { icon: Sparkles, name: "Vocal & melody", desc: "A single sung or played melody is one of the easier cases. Use Auto for a lead line or an unknown source." },
  { icon: Layers, name: "Full song", desc: "You can upload one, but dense arrangements with many overlapping notes give a rougher draft. Isolating the part first gives a cleaner result." },
];

// level: 3 = clean (teal), 2 = rough (amber), 1 = poor (muted)
const DIFFICULTY_TIERS: { title: string; level: 1 | 2 | 3; items: string[] }[] = [
  { title: "Transcribes cleanly", level: 3, items: ["Solo piano", "A single melody or vocal line", "Clean single-note guitar", "One instrument on its own"] },
  { title: "Rougher, but usable", level: 2, items: ["Dense piano chords", "Full-band arrangements", "Busy, fast passages", "Multiple instruments at once"] },
  { title: "Not a good fit", level: 1, items: ["Drums & percussion", "Heavily distorted recordings", "Very noisy or low-quality audio"] },
];

const OUTPUT_FORMATS = [
  { icon: FileText, name: "PDF", desc: "Print-ready engraved score. The one most people want — open it, print it, play from it." },
  { icon: Music4, name: "MusicXML", desc: "The universal notation format. Open it in MuseScore, Sibelius or Finale to fine-tune every note." },
  { icon: FileAudio, name: "MIDI", desc: "Load it into any DAW — Ableton, FL Studio, Logic — to reassign instruments or keep arranging." },
  { icon: FileText, name: "SVG", desc: "The score as a crisp vector image, handy for embedding or quick sharing." },
];

// Rows are the axes AudioForges genuinely wins on. Honest, not inflated.
const COMPARE_ROWS: { label: string; us: boolean; anthem: boolean; klangio: boolean }[] = [
  { label: "Free preview before you pay", us: true, anthem: false, klangio: false },
  { label: "No sign-up to try", us: true, anthem: true, klangio: false },
  { label: "No subscription", us: true, anthem: true, klangio: false },
  { label: "Pay per song (not monthly)", us: true, anthem: false, klangio: false },
  { label: "Runs in the browser (no install)", us: true, anthem: false, klangio: true },
  { label: "PDF + MusicXML + MIDI export", us: true, anthem: true, klangio: true },
];

export default async function AudioToSheetMusicPage() {
  const relatedTools = getRelatedTools("audio-to-sheet-music", 5);

  /**
   * Read server-side and cached (see getFeatureFlags), never from the browser.
   * sheetMusicEnabled answers CAN this tool run — false means a 503, so the
   * interactive tool must not be offered. Visibility comes from here; whether
   * it costs a credit is resolved per visitor inside the form.
   */
  const { sheetMusicEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "How do I convert audio to sheet music?",
      answer:
        "Upload an MP3, WAV or other recording above, pick the instrument, and it's transcribed into engraved notation. You get a free preview of the score, then can download it as PDF, MusicXML, MIDI or SVG.",
    },
    {
      question: "Can I turn an MP3 into sheet music for free?",
      answer:
        "Clips of 30 seconds or less are always free with no sign-up, so you can test the quality on your own audio before anything is charged. Longer songs include a couple of free runs each month, then cost 3 credits per song — no subscription.",
    },
    {
      question: "Is the piano transcription accurate?",
      answer:
        "Piano is the best-supported case. It's transcribed by Transkun, a model that specializes in solo piano, and laid out as a two-hand grand staff. Like every automatic transcription it's an accurate first draft rather than a hand-engraved final — download the MusicXML to fine-tune it in a free editor like MuseScore.",
    },
    {
      question: "What formats can I download the sheet music in?",
      answer:
        "PDF for printing and playing from, MusicXML for editing in MuseScore, Sibelius or Finale, MIDI for any DAW, and SVG as a vector image. Every successful transcription produces all four.",
    },
    {
      question: "What audio formats are supported?",
      answer:
        "MP3, WAV, FLAC, M4A, AAC, OGG, AIFF, Opus and WebM. There's no need to convert to a different format first.",
    },
    {
      question: "Do I need to sign up or install anything?",
      answer:
        "No. Everything runs in your browser — upload, preview the score, download. No account, no plugin, no desktop software.",
    },
    {
      question: "How is this different from AnthemScore, Klangio or Songscription?",
      answer:
        "Those are paid desktop software or monthly subscriptions. AudioForges runs in the browser with no install, shows you the engraved score for free before you pay, and charges per song instead of a subscription — so you only pay for the transcriptions you actually keep.",
    },
    {
      question: "Can I get sheet music for a song that has no published score?",
      answer:
        "That's exactly what this is for. If a piece was never printed, there's nowhere to buy the sheet music — this transcribes it directly from the recording so you have something to read, play and edit.",
    },
    {
      question: "Why does the score have wrong or extra notes?",
      answer:
        "Automatic transcription detects notes from audio rather than reading them directly, so quiet, overlapping or heavily-pedaled notes can be missed or misjudged. Cleaner, more isolated recordings transcribe best. The MusicXML export lets you correct anything by hand in a notation editor.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio to Sheet Music" }]} />}
        title="Audio to Sheet Music"
        lede="Turn any recording into printable sheet music. Upload an MP3, WAV or piano track and get engraved notation as PDF, MusicXML and MIDI — with a free preview so you see the score before you pay."
        tool={
          sheetMusicEnabled ? (
            <AudioToSheetForm />
          ) : (
            <div className="rounded-xl border border-graphite-700 bg-graphite-850 p-6 text-center text-text-muted">
              The sheet-music tool is temporarily unavailable. Please check back shortly.
            </div>
          )
        }
      >
        <FeatureStrip
          features={[
            { title: "Free preview", desc: "See the engraved score before you pay a thing." },
            { title: "PDF · MusicXML · MIDI", desc: "Print it, edit it in MuseScore, or open it in your DAW." },
            { title: "No subscription", desc: "Pay per song, not per month. No sign-up." },
          ]}
        />

        {/* ── THE PROOF ── the actual output, up front, the way the paid
            competitors show a screenshot — except rendered in-brand. */}
        <section id="preview" className="space-y-4">
          <div className="space-y-1.5">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">The output</p>
            <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              A real recording, engraved into a readable score
            </h2>
          </div>

          <EngravedScore glow />

          {/* Stat strip in the same mono/amber voice as the result panel. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-text-muted">
            <Stat value="1,346" label="notes" />
            <Dot />
            <Stat value="3" label="pages" />
            <Dot />
            <Stat value="G major" label="" />
            <Dot />
            <Stat value="108" label="BPM" />
            <Dot />
            <span className="uppercase tracking-wide text-text-subtle">Transkun AI</span>
            <span className="ml-auto text-[11px] text-text-subtle">
              Example: a solo-piano recording, transcribed &amp; engraved
            </span>
          </div>
        </section>

        {/* ── HOW IT WORKS ── drawn as a pipeline, not a paragraph. */}
        <ToolSection id="how-it-works" title="From a recording to a score, in four stages" bleed>
          <p className="measure mb-6 leading-relaxed text-text-body">
            Nothing to configure and nothing to install. Upload a file and it moves through the same
            pipeline every time — the last stage is exactly the engraving you preview for free.
          </p>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((stage, i) => (
              <li
                key={stage.title}
                className="relative rounded-xl border border-graphite-800 bg-graphite-900 p-5"
              >
                <div className="mb-3 flex items-center justify-between">
                  <stage.icon className="h-5 w-5 text-amber-400" aria-hidden />
                  <span className="font-mono text-[11px] text-text-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-text-primary">{stage.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{stage.desc}</p>
              </li>
            ))}
          </ol>
        </ToolSection>

        {/* ── POSITIONING ── ranks for "anthemscore alternative" etc. */}
        <ToolSection id="compare" title="How it compares to AnthemScore, Klangio & Songscription" bleed>
          <p className="measure mb-5 leading-relaxed text-text-body">
            The other audio-to-notation tools are either paid desktop software you have to install,
            or monthly subscriptions. Here&apos;s where a free, browser-based, pay-per-song tool differs:
          </p>
          <div className="overflow-hidden rounded-xl border border-graphite-800">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-graphite-700 bg-graphite-900 text-left">
                  <th className="py-3 pl-4 pr-4 font-medium text-text-muted"> </th>
                  <th className="border-x border-amber-500/20 bg-amber-500/[0.06] px-3 py-3 text-center font-semibold text-amber-400">
                    AudioForges
                  </th>
                  <th className="px-3 py-3 text-center font-medium text-text-muted">AnthemScore</th>
                  <th className="px-3 py-3 text-center font-medium text-text-muted">Klangio</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-graphite-800 last:border-0">
                    <td className="py-3 pl-4 pr-4 text-text-body">{row.label}</td>
                    <td className="border-x border-amber-500/20 bg-amber-500/[0.04] px-3 py-3 text-center">
                      <CompareMark on={row.us} highlight />
                    </td>
                    <td className="px-3 py-3 text-center"><CompareMark on={row.anthem} /></td>
                    <td className="px-3 py-3 text-center"><CompareMark on={row.klangio} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-text-subtle">
            Comparison reflects each tool&apos;s standard offering at time of writing; competitors change
            their plans, so check their current pricing before deciding.
          </p>
        </ToolSection>

        {/* ── INSTRUMENTS ── */}
        <ToolSection id="instruments" title="What you can transcribe" bleed>
          <div className="grid gap-3 sm:grid-cols-2">
            {INSTRUMENTS.map((inst) => (
              <div
                key={inst.name}
                className={cn(
                  "rounded-xl border p-5",
                  inst.best
                    ? "border-amber-500/40 bg-amber-500/[0.05]"
                    : "border-graphite-800 bg-graphite-900"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <inst.icon className={cn("h-4 w-4", inst.best ? "text-amber-400" : "text-text-muted")} aria-hidden />
                  <h3 className="text-sm font-semibold text-text-primary">{inst.name}</h3>
                  {inst.best && (
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-amber-500/80">
                      Best quality
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{inst.desc}</p>
              </div>
            ))}
          </div>
        </ToolSection>

        {/* ── WHAT WORKS ── difficulty as signal meters, in the site's meter voice. */}
        <ToolSection id="what-works" title="What transcribes well — and what doesn't" bleed>
          <p className="measure mb-6 leading-relaxed text-text-body">
            Automatic transcription is only as good as the audio you feed it. One clean instrument
            on its own is a very different problem from a dense full mix. Roughly:
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {DIFFICULTY_TIERS.map((tier) => (
              <div key={tier.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-text-primary">{tier.title}</h3>
                  <SignalMeter level={tier.level} />
                </div>
                <ul className="space-y-1.5 text-[13px] text-text-muted">
                  {tier.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className={cn("mt-2 h-1 w-1 shrink-0 rounded-full", meterColor(tier.level))} aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ToolSection>

        {/* ── FORMATS ── */}
        <ToolSection id="formats" title="Every format you might need" bleed>
          <div className="grid gap-3 sm:grid-cols-2">
            {OUTPUT_FORMATS.map((f) => (
              <div key={f.name} className="flex gap-3.5 rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
                <div>
                  <h3 className="font-mono text-sm font-semibold uppercase tracking-tight text-text-primary">{f.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-text-subtle">Accepted inputs: {SUPPORTED_FORMATS.join(", ")}.</p>
        </ToolSection>

        {/* ── EDIT ── */}
        <ToolSection id="edit" title="Fine-tune it in a notation editor">
          <p>
            An automatic transcription gets you most of the way in seconds — the notes, the timing,
            the key, laid out on the staff. For the last few percent, download the{" "}
            <span className="text-text-body">MusicXML</span> and open it in{" "}
            <Link href="https://musescore.org" className="text-amber-400 hover:underline" rel="nofollow noopener" target="_blank">
              MuseScore
            </Link>
            , which is free, or any editor that reads MusicXML. Fix a wrong note, adjust a rhythm,
            add dynamics, then export a clean final score.
          </p>
        </ToolSection>

        <FAQSection faqs={faqs} eyebrow="Questions" />

        <RelatedToolsGrid tools={relatedTools} />
      </ToolPageShell>
    </>
  );
}

/* ---------------- local presentational helpers ---------------- */

function CompareMark({ on, highlight = false }: { on: boolean; highlight?: boolean }) {
  return on ? (
    <Check className={cn("mx-auto h-4 w-4", highlight ? "text-amber-400" : "text-teal-400")} aria-label="Yes" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-graphite-500" aria-label="No" />
  );
}

function meterColor(level: 1 | 2 | 3): string {
  return level === 3 ? "bg-teal-400" : level === 2 ? "bg-amber-400" : "bg-graphite-500";
}

function SignalMeter({ level }: { level: 1 | 2 | 3 }) {
  const label = level === 3 ? "Clean" : level === 2 ? "Rough" : "Poor";
  const fill = meterColor(level);
  return (
    <span className="flex items-center gap-1.5" title={`Transcription quality: ${label}`}>
      <span className="flex items-end gap-[3px]" aria-hidden>
        {[8, 12, 16].map((h, i) => (
          <span
            key={h}
            className={cn("w-[3px] rounded-[1px]", i < level ? fill : "bg-graphite-700")}
            style={{ height: h }}
          />
        ))}
      </span>
      <span className="sr-only">Transcription quality: {label}</span>
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="text-text-body">
      <span className="font-medium text-text-primary">{value}</span>
      {label && <span className="ml-1 text-text-muted">{label}</span>}
    </span>
  );
}

function Dot() {
  return <span className="text-graphite-600" aria-hidden>·</span>;
}