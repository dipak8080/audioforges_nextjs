import type { Metadata } from "next";
import Link from "next/link";
import { AudioToMidiForm } from "@/components/converter/AudioToMidiForm";
import { MidiCompare } from "@/components/credits/MidiCompare";
import { FAQSection, type FAQItem } from "@/components/faq/FAQSection";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { RelatedToolsGrid } from "@/components/tools/RelatedToolsGrid";
import { ProofStrip } from "@/components/tools/ProofStrip";
import { PianoRollCard } from "@/components/tools/PianoRollCard";
import { CompareTable } from "@/components/tools/CompareTable";
import { PageByline } from "@/components/tools/PageByline";
import { ToolVideo } from "@/components/media/ToolVideo";
import { SITE_URL, SITE_NAME } from "@/lib/constants";
import { getRelatedTools } from "@/lib/data/tools";
import { getFeatureFlags } from "@/lib/api/railway";
import { ogForTool } from "@/lib/og";

const UPDATED = "2026-09-10";

const PAGE_TITLE = "Audio to MIDI Converter – Free MP3 & WAV to MIDI Online";
const PAGE_DESCRIPTION =
  "Free audio to MIDI converter with interactive piano roll preview. Convert MP3, WAV & FLAC, hear your MIDI before downloading, solo each stem. No sign-up.";

const OG_IMAGE = ogForTool("audio-to-midi", "Audio to MIDI Converter");

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/audio-to-midi` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/audio-to-midi`,
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
  name: "Audio to MIDI Converter",
  alternateName: [
    "Audio to MIDI Converter",
    "MP3 to MIDI Converter",
    "WAV to MIDI Converter",
    "Vocal to MIDI",
    "Music Transcription Tool",
  ],
  url: `${SITE_URL}/audio-to-midi`,
  dateModified: UPDATED,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Automatic note transcription from MP3, WAV, FLAC, M4A, AAC, OGG, AIFF, Opus, and WebM",
    "Forge Roll: DAW-style piano roll with sampled piano playback and five switchable sounds",
    "Compare the MIDI against your original audio with a synced crossfade",
    "Edit notes in the browser — move, resize, add, delete — with 60 levels of undo",
    "Quantize, transpose, and velocity tools; key detection with scale highlighting",
    "Export the edited MIDI with tempo and track names preserved",
    "A–B loop, metronome, scrubbing, and a 50–150% tempo slider",
    "Per-stem solo and mute on full-mix transcriptions",
    "Transcription presets for piano, vocal, bass, guitar, and fast passages",
    "No sign-up required",
    "Downloads as a standard .mid file for any DAW",
  ],
};

const FORMATS = ["MP3", "WAV", "FLAC", "M4A", "AAC", "OGG", "AIFF", "OPUS", "WEBM"];

// Keep these in step with the preset copy in AudioToMidiForm.tsx.
const PRESETS = [
  ["Balanced", "General starting point before you tune anything."],
  ["Piano & keys", "Full keyboard range, settings suited to faster passages."],
  ["Vocal & lead", "One sung or played line. Favours sustained notes."],
  ["Bass", "Low register only, so higher instruments interfere less."],
  ["Guitar", "Single-note lines across the instrument's usual range."],
  ["Arps & fast runs", "More sensitive onsets for short notes. Catches more, invents more."],
];

const DAW_IMPORTS = [
  [
    "FL Studio",
    "Drag the .mid onto the playlist, or File → Import → MIDI file. Each track lands on its own pattern.",
  ],
  [
    "Ableton Live",
    "Drag into a MIDI track in Session or Arrangement view. One clip per track, tempo mapping kept.",
  ],
  ["Logic Pro", "File → Import → MIDI File, or drag into the tracks area. Offers an instrument track per MIDI track."],
  [
    "GarageBand, Cubase, Studio One, Reaper",
    "All take a standard .mid by drag and drop. Note, timing and program data travel with the file.",
  ],
];

export default async function AudioToMidiPage() {
  const relatedTools = getRelatedTools("audio-to-midi", 5);
  const { midiHqEnabled } = await getFeatureFlags();

  const faqs: FAQItem[] = [
    {
      question: "How do I convert an MP3 or WAV to MIDI?",
      answer: `Upload the file, pick the preset closest to what you recorded, and the notes come back as a standard .mid. ${FORMATS.join(", ")} are all accepted, from 1 second to 10 minutes. Nothing to install and no account.`,
    },
    {
      question: "Which preset should I use?",
      answer:
        "Match it to the source, not the genre. One sung or played line goes to Vocal & lead, a keyboard part to Piano & keys, a bassline to Bass, a riff to Guitar, and anything with fast repeated notes to Arps & fast runs. Balanced is the safe default when the recording is none of those.",
    },
    {
      question: "Why does my MIDI have missing or extra notes?",
      answer:
        "Automatic transcription infers notes from a waveform; it does not read a score. Reverb, overlapping instruments, string harmonics and distortion all produce attacks that look like notes and notes that look like noise. A cleaner, more isolated source is the single biggest improvement you can make, followed by picking the right preset.",
    },
    {
      question: "Can I convert a full song to MIDI?",
      answer:
        "You can upload one, but a dense mix is the hardest case for any transcription model. Isolating the part you want first gives a far better result.",
      answerNode: (
        <>
          You can upload one, but a dense mix is the hardest case for any transcription model. Isolating the part you
          want with the{" "}
          <Link href="/stems" prefetch={false} className="text-amber-400 hover:underline">
            Stem Splitter
          </Link>{" "}
          first gives a far better result.
        </>
      ),
    },
    {
      question: "Can I convert drums to MIDI?",
      answer:
        "No. Detection works on pitch, and unpitched percussion has none to track. Drums, claps and most percussion are not a fit for this tool.",
    },
    {
      question: "Can I play the MIDI before downloading it?",
      answer:
        "Yes, and that is the point of Forge Roll. Every result opens in a piano roll with sampled playback, plays against your original audio on a crossfade, and lets you fix wrong notes before you export.",
    },
    {
      question: "Can I use the file in Ableton, FL Studio or Logic?",
      answer:
        "Yes. The download is a standard .mid, carrying note, timing, tempo and General MIDI program data, so it drags straight into any DAW without converting anything first.",
    },
    ...(midiHqEnabled
      ? [
          {
            question: "What does high accuracy do differently?",
            answer:
              "It runs a model built for the specific instrument rather than one general-purpose detector. Piano goes to a piano model, guitar to an engine that strips string harmonics and doubled attacks, and full mix splits the song into stems first and transcribes each with the model best at it, returning one named MIDI track per instrument with the detected BPM written in as the tempo. Piano and guitar cost one credit; a full mix costs three, since it is one separation plus up to four transcriptions.",
          },
        ]
      : []),
    {
      question: "Is it really free?",
      answer:
        "Standard transcription is free and unlimited, with no account, no watermark and no length trick. Credits exist only for the GPU-heavy high-accuracy modes, they are priced per job rather than by subscription, and they never expire.",
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }} />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Tools", href: "/tools" }, { name: "Audio to MIDI" }]} />}
        meta={["No account", "Hear it before you download", "Standard .mid"]}
        title="Free Audio to MIDI Converter"
        lede="Turn a recording into notes. Hear the result in a piano roll, fix what the model got wrong, then download a standard .mid."
        tool={<AudioToMidiForm hqAvailable={midiHqEnabled} />}
      >
        <ProofStrip
          proofs={[
            {
              label: "Check before you download",
              value: "Forge Roll piano roll",
              note: "Play the MIDI against your original audio and edit notes in the browser. Most converters hand you a file and wish you luck.",
            },
            {
              label: "Output",
              value: "Standard .mid, any DAW",
              note: "Note, timing, tempo and program data included. Nothing to convert on the other end.",
            },
            {
              label: "Price",
              value: "Standard is free and unlimited",
              note: "No account, no watermark. Credits only for the GPU-heavy per-instrument models.",
            },
          ]}
        />

        {/* Returns null until all three clips exist, so it is safe ahead of them. */}
        <MidiCompare
          originalSrc="/demo/midi/melody-original.mp3"
          standardSrc="/demo/midi/melody-standard.mp3"
          hqSrc="/demo/midi/melody-hq.mp3"
          sourceLabel="Sung melody"
          trackLabel="One vocal line, transcribed both ways"
          cues={[
            { at: 3, label: "fast run" },
            { at: 7, label: "sustained note" },
          ]}
        />

        <ToolSection id="forge-roll" title="Hear it, fix it, then download it" bleed>
          <Prose className="mb-5">
            <p>
              Every transcription opens in Forge Roll, a piano roll built into this page. The keyboard lights up as
              notes play, the grid is marked in bars and sixteenths, and the velocity lane shows the dynamics the
              model detected. Out-of-key notes are flagged in red, so a stray wrong note is visible without hunting
              for it.
            </p>
          </Prose>
          <PianoRollCard
            points={[
              "Crossfade between the MIDI and your original audio, in sync.",
              "Drag notes to move or resize, double-click to add, 60 levels of undo.",
              "Quantize to any grid, transpose, flatten or humanize velocities.",
              "Key detection tints in-key rows and flags the rest in red.",
              "A–B loop, metronome, and tempo from 50 to 150% with pitch preserved.",
              "Export the corrected MIDI with tempo and track names intact.",
            ]}
          />
          <Prose className="mt-5">
            <p>
              Most free converters are download-only: you find out what the transcription sounds like once it is
              already in your DAW. Here you hear it first, and the file you download is the one you fixed.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="what-works" title="What transcribes well, and what does not" bleed>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Cleanest results", ["A single sung or played melody", "A lead line on its own", "An isolated bassline", "One instrument, no backing"], "yes"],
              ["Harder, still usable", ["Piano or guitar chords", "Layered arrangements", "A full song without isolating first", "Two instruments at once"], "partial"],
              ["Not a fit", ["Drums and percussion", "Anything unpitched", "Heavily distorted or noisy recordings"], "no"],
            ].map(([title, items, tone]) => (
              <div
                key={title as string}
                className={
                  tone === "yes"
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
              Detection works on pitch, which is why drums have no path through it at all, and why a dense mix reads
              worse than the same part on its own. If your source is a full song, run it through the{" "}
              <Link href="/stems">Stem Splitter</Link> first and transcribe one stem.
            </p>
          </Prose>
        </ToolSection>

        <ToolSection id="presets" title="Pick the preset that matches the source" bleed>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map(([name, desc]) => (
              <div key={name} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{name}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
              </div>
            ))}
          </div>
          <Prose className="mt-5">
            <p>
              Presets set onset sensitivity, frame sensitivity, minimum note length and frequency range. All four are
              exposed under Advanced if you want to tune them by hand: raise onset sensitivity to catch more attacks
              and more noise with them, raise minimum note length to drop stray short notes, and narrow the frequency
              range when you are chasing one instrument out of a mix.
            </p>
          </Prose>
        </ToolSection>

        {midiHqEnabled && (
          <ToolSection id="high-accuracy" title="Standard vs. high accuracy" bleed>
            <CompareTable
              columns={["Standard", "High accuracy"]}
              highlight={1}
              rows={[
                {
                  label: "Approach",
                  cells: [
                    { text: "One general detector, one MIDI track" },
                    { text: "A model per instrument, one track each" },
                  ],
                },
                {
                  label: "Piano and bass",
                  cells: [
                    { state: "partial", text: "Usable, some stray notes" },
                    { state: "yes", text: "Cleanest results of anything here" },
                  ],
                },
                {
                  label: "Guitar",
                  cells: [
                    { state: "partial", text: "String harmonics read as extra notes" },
                    { state: "yes", text: "Harmonics and doubled attacks stripped" },
                  ],
                },
                {
                  label: "Synths, pads, the rest",
                  cells: [
                    { state: "partial", text: "Roughest case" },
                    { state: "partial", text: "Still the roughest case. Expect editing" },
                  ],
                },
                {
                  label: "Full mix",
                  cells: [
                    { state: "no", text: "One track, everything merged" },
                    { state: "yes", text: "Split into stems first, one named track per instrument, BPM written in as tempo" },
                  ],
                },
                {
                  label: "Cost",
                  cells: [
                    { text: "Free, unlimited" },
                    { text: "1 credit for piano or guitar, 3 for a full mix", sub: "free runs each month, credits never expire" },
                  ],
                },
              ]}
              footnote="If your source is one instrument, pick that instrument rather than full mix. If it is a simple melody, standard is usually enough and costs nothing."
            />
          </ToolSection>
        )}

        <ToolSection id="daws" title="Getting the file into your DAW" bleed>
          <div className="grid gap-3 sm:grid-cols-2">
            {DAW_IMPORTS.map(([name, desc]) => (
              <div key={name} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
                <p className="font-medium text-text-primary">{name}</p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <span
                key={f}
                className="rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-1.5 font-mono text-sm font-semibold text-amber-400"
              >
                {f}
              </span>
            ))}
          </div>
          <Prose className="mt-4">
            <p>
              Upload any of these, from 1 second to 10 minutes. The download is a standard .mid with the same
              filename as your upload.
            </p>
          </Prose>
        </ToolSection>

        <ToolVideo slug="audio-to-midi" />

        <FAQSection faqs={faqs} />

        <RelatedToolsGrid tools={relatedTools} />

        <PageByline
          updated={UPDATED}
          note="High accuracy now routes each stem to the model best at it"
          legal="You are responsible for having the right to process any track you upload. AudioForges does not host or distribute the tracks processed here."
        />
      </ToolPageShell>
    </>
  );
}