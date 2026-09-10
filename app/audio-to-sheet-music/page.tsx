import type { Metadata } from "next";
import Link from "next/link";
import { AudioWaveform, Music2, ScrollText, FileText } from "lucide-react";
import { AudioToSheetForm } from "@/components/converter/AudioToSheetForm";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { EngravedScore } from "@/components/ui/EngravedScore";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";
import { ogImage } from "@/lib/og";

const UPDATED = "2026-09-10";

const PAGE_TITLE = "Audio to Sheet Music Converter – Free, Online";
const PAGE_DESCRIPTION =
  "Convert MP3, WAV or humming to sheet music free. Play the engraved score in your browser to check it, then download PDF, MusicXML & MIDI. No sign-up.";

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
  name: "Audio to Sheet Music Converter",
  alternateName: [
    "MP3 to Sheet Music Converter",
    "Audio to MusicXML Converter",
    "Music Transcription Tool",
    "Piano to Sheet Music",
  ],
  url: `${SITE_URL}/audio-to-sheet-music`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "AI music transcription — convert MP3, WAV, FLAC and more into engraved sheet music",
    "Forge Score: live-engraved playable score with a moving cursor and note highlighting",
    "Compare the score against your original recording with a synced crossfade",
    "Transpose ±12 semitones — re-engraves the notation and shifts playback together",
    "Print, save as PDF, or download a 2× PNG of the engraved score",
    "Loop, metronome, zoom, and a 50–150% tempo slider anchored to the detected BPM",
    "Piano transcription powered by a solo-piano specialist AI (Transkun)",
    "Two-hand grand-staff notation for piano",
    "Download as PDF, MusicXML, MIDI, and SVG",
    "Free 30-second preview — see the score before you pay",
    "No sign-up, no subscription, no software to install",
  ],
};

const SUPPORTED_FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF", "OPUS", "WEBM"];

// Mirrors the backend pipeline: transcribe → analyze → notate → engrave.
const PIPELINE = [
  { icon: AudioWaveform, title: "Transcribe", desc: "A model detects every note, pitch and timing. Piano goes to Transkun, trained on solo piano only." },
  { icon: Music2, title: "Analyze", desc: "Tempo and key are detected so notes can land on a real beat grid instead of floating in time." },
  { icon: ScrollText, title: "Notate", desc: "Notes snap to the grid, key and time signature go in, piano is split across two hands." },
  { icon: FileText, title: "Engrave", desc: "Typeset into a readable score you can play in the browser, cursor following along." },
];

export default async function AudioToSheetMusicPage() {
  const relatedTools = getRelatedTools("audio-to-sheet-music", 5);
  const { sheetMusicEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "Can I turn an MP3 into sheet music for free?",
      answer:
        "Clips of 30 seconds or less are always free with no sign-up, so you can judge the quality on your own recording before anything is charged. Full-length songs include a couple of free runs each month, then cost 3 credits per song. No subscription, and credits never expire.",
    },
    {
      question: "How accurate is it?",
      answer:
        "Piano is the best case: it goes to Transkun, a model trained only on solo piano, and comes back as a two-hand grand staff. Like every automatic transcription it is an accurate first draft rather than a hand-engraved final. Quiet, overlapping or heavily pedalled notes are the ones that get missed or misjudged, and the MusicXML export exists so you can fix them in a free editor.",
    },
    {
      question: "Can I hear the score before downloading it?",
      answer:
        "Yes. The result opens as a live, playable score. Press play and a cursor moves across the staff in sync with the sound while each note lights up, so you can check every bar against the recording before printing the PDF or editing the MusicXML. Tempo runs from 50% to 150% if you want to follow along slowly.",
    },
    {
      question: "What formats do I get?",
      answer:
        "PDF for printing and playing from, MusicXML for editing in MuseScore, Sibelius, Finale or Dorico, MIDI for any DAW, and SVG as a vector image. Every transcription produces all four.",
    },
    {
      question: "Can I convert singing or humming to sheet music?",
      answer:
        "Yes. A single sung melody is one of the easier cases. Record yourself, upload the file, and the melody comes back as notation you can print or edit.",
    },
    {
      question: "Can I convert a YouTube video to sheet music?",
      answer:
        "In two steps. Grab the audio with the YouTube to WAV converter, then upload that file here.",
      answerNode: (
        <>
          In two steps. Grab the audio with the{" "}
          <Link href="/youtube-to-wav" prefetch={false} className="text-amber-400 hover:underline">
            YouTube to WAV converter
          </Link>
          , then upload that file here.
        </>
      ),
    },
    {
      question: "Can I get a score for a song that was never published?",
      answer:
        "That is exactly what this is for. If a piece was never printed there is nowhere to buy it; this transcribes it straight from the recording so you have something to read, play and edit.",
    },
    {
      question: "How is this different from AnthemScore or Klangio?",
      answer:
        "All three let you preview a short clip free. The differences are in what happens after: AudioForges needs no account and charges 3 credits per full song rather than a monthly subscription, and the piano model is named and open-source so you can check it. AnthemScore Web and Klangio both sell full-length transcription by subscription, and AnthemScore also sells a one-time desktop app you install.",
    },
    {
      question: "Do I need to install anything?",
      answer:
        "No. Upload, preview the score, download, all in the browser. No account, no plugin, no desktop software.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio to Sheet Music" }]} />}
        meta={["No account", "30-second clips free", "PDF, MusicXML, MIDI"]}
        title="Audio to Sheet Music Converter"
        lede="Upload a recording and get an engraved score you can play in the browser, check bar by bar, then download as PDF, MusicXML or MIDI."
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
        <ProofStrip
          proofs={[
            {
              label: "Piano model",
              value: "Transkun, open-source",
              note: "Trained on solo piano only. Named so you can check it. Two-hand grand staff, the way piano is written.",
            },
            {
              label: "Before you pay",
              value: "Play the score, bar by bar",
              note: "Synced cursor, note highlighting, crossfade against the recording. Judge it by ear first.",
            },
            {
              label: "Price",
              value: "3 credits per song, no subscription",
              note: "30-second clips are always free. Credits never expire. No account for any of it.",
            },
          ]}
        />

        <section id="preview" className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              A real recording, engraved into a readable score
            </h2>
          </div>
          <EngravedScore glow />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-text-muted">
            <Stat value="1,346" label="notes" />
            <Dot />
            <Stat value="3" label="pages" />
            <Dot />
            <Stat value="G major" label="" />
            <Dot />
            <Stat value="108" label="BPM" />
            <Dot />
            <span className="uppercase tracking-wide text-text-subtle">Transkun</span>
            <span className="ml-auto text-[11px] text-text-subtle">Solo piano recording, transcribed and engraved</span>
          </div>
        </section>

        <ToolSection id="forge-score" title="Play it before you trust it" bleed>
          <Prose className="mb-5">
            <p>
              The result is not a static image. It opens in Forge Score, a live-engraved score with synced playback
              of the kind you would otherwise find in MuseScore or Soundslice. A cursor moves across the staff with
              the music, each note lights up as it sounds, and the page scrolls to follow. Notation and audio run
              from one clock, so the cursor never drifts.
            </p>
          </Prose>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ["Compare against the recording", "Flip between Original, Both and Score, or ride the crossfade, and check the transcription by ear."],
              ["Transpose an octave either way", "The score re-engraves in the new key and playback shifts with it. For a singer's range or a transposing instrument."],
              ["Practice tools", "Loop, metronome, tempo from 50 to 150% anchored to the detected BPM, zoom from 60 to 150%."],
              ["Print or save from the viewer", "PDF, or a PNG of the engraved score at 2× resolution, without leaving the page."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{t}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </ToolSection>

        <ToolSection id="how-it-works" title="From a recording to a score, in four stages" bleed>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((stage, i) => (
              <li key={stage.title} className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <stage.icon className="h-5 w-5 text-amber-400" aria-hidden />
                  <span className="font-mono text-[11px] text-text-subtle">Stage {i + 1}</span>
                </div>
                <p className="font-medium text-text-primary">{stage.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{stage.desc}</p>
              </li>
            ))}
          </ol>
          <Prose className="mt-5">
            <p>
              Nothing to configure. The last stage is the engraving you preview for free, so what you check is
              what you download.{" "}
              <Link href="/guides/how-audio-to-sheet-music-works">The longer walk-through</Link> covers each stage
              and why the rhythm sometimes needs a nudge.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="what-works" title="What transcribes well, and what does not" bleed>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Cleanest results", ["Solo piano", "A single sung or played melody", "Clean single-note guitar", "One instrument on its own"], true],
              ["Rougher, still usable", ["Dense piano chords", "Full-band arrangements", "Busy, fast passages", "Two or more instruments at once"], false],
              ["Not a fit", ["Drums and percussion", "Heavily distorted recordings", "Very noisy or low-quality audio"], false],
            ].map(([title, items, best]) => (
              <div
                key={title as string}
                className={
                  best
                    ? "rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-5"
                    : "rounded-xl border border-graphite-800 bg-graphite-900 p-5"
                }
              >
                <p className="font-medium text-text-primary">{title as string}</p>
                <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-text-muted">
                  {(items as string[]).map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Detection works on pitch, which is why drums have no path through it. A full song can be uploaded, but
              isolating the part first with the <Link href="/stems">Stem Splitter</Link> gives a far cleaner draft.
              For the last few percent, open the MusicXML in{" "}
              <Link href="https://musescore.org" rel="nofollow noopener" target="_blank">
                MuseScore
              </Link>
              , which is free, fix a note or a rhythm, and export the final.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="compare" title="Compared with AnthemScore and Klangio" bleed>
          <Prose className="mb-5">
            <p>
              All three let you try a short clip free. Every cell below is checkable on the other sites&apos; own
              pages; no claim is made that cannot be verified.
            </p>
          </Prose>
          <CompareTable
            columns={["AudioForges", "AnthemScore Web", "Klangio"]}
            highlight={0}
            rows={[
              {
                label: "Free preview",
                cells: [
                  { state: "yes", text: "30-second clips, unlimited" },
                  { state: "yes", text: "30-second clips, unlimited" },
                  { state: "yes", text: "20-second clips, unlimited" },
                ],
              },
              {
                label: "Account needed to try",
                cells: [
                  { state: "yes", text: "No" },
                  { state: "no", text: "Sign up required" },
                  { state: "yes", text: "No" },
                ],
              },
              {
                label: "Full-length songs",
                cells: [
                  { text: "3 credits per song, never expire", sub: "plus free runs each month" },
                  { text: "Subscription, monthly song quota", sub: "or a one-time desktop app you install" },
                  { text: "Subscription, monthly tickets" },
                ],
              },
              {
                label: "Piano model named",
                cells: [
                  { state: "yes", text: "Transkun, open-source" },
                  { state: "unknown", text: "Not stated" },
                  { state: "unknown", text: "Not stated" },
                ],
              },
              {
                label: "Runs in the browser",
                cells: [
                  { state: "yes", text: "Yes" },
                  { state: "yes", text: "Yes" },
                  { state: "yes", text: "Yes" },
                ],
              },
              {
                label: "PDF, MusicXML and MIDI export",
                cells: [
                  { state: "yes", text: "Yes, plus SVG" },
                  { state: "yes", text: "Yes, on paid plans" },
                  { state: "yes", text: "Yes, plus Guitar Pro, on paid plans" },
                ],
              },
            ]}
            footnote={`Checked against their live pages on ${UPDATED}. Details may change.`}
          />
          <Prose className="mt-4">
            <p>
              Klangio transcribes multi-instrument mixes directly and covers more instruments than this tool does.
              If that is the job, it may be the better fit. The{" "}
              <Link href="/guides/songscription-alternatives-free">comparison of free and paid transcription tools</Link>{" "}
              lays out what each one limits, costs and does best.
            </p>
          </Prose>
        </ToolSection>

        <ToolVideo slug="audio-to-sheet-music" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          note={`Accepts ${SUPPORTED_FORMATS.join(", ")}`}
          legal="You are responsible for having the right to process any recording you upload. AudioForges does not host or distribute the audio or scores processed here."
        />
      </ToolPageShell>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span>
      <span className="text-text-primary">{value}</span>
      {label && <span className="ml-1 text-text-subtle">{label}</span>}
    </span>
  );
}

function Dot() {
  return <span className="text-graphite-600" aria-hidden>·</span>;
}