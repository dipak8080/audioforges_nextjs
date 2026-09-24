import type { Metadata } from "next";
import Link from "next/link";
import { ToolPageShell } from "@/components/layout/ToolPageShell";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ToolSection } from "@/components/ui/ToolSection";
import { Prose } from "@/components/ui/Prose";
import { SITE_URL } from "@/lib/constants";
import { ogImage } from "@/lib/og";

const PAGE_TITLE = "The Forge Players: Hear Your Result Before You Download";
const PAGE_DESCRIPTION =
  "Forge Mixer, Forge Roll and Forge Score are built into AudioForges. Play back stems, MIDI and notation in the browser, fix what needs fixing, then export.";

const OG_IMAGE = ogImage(
  "The Forge players",
  "Hear the result before you download it. Mixer, Roll and Score, in the browser.",
  "Free · No sign-up"
);

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/forge` },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: `${SITE_URL}/forge`,
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

const PLAYERS = [
  {
    id: "mixer",
    name: "Forge Mixer",
    opens: "Separation results",
    what: "A synced multi-track mixer for the stems you just made.",
    points: [
      "Every stem on its own lane, with mute, solo, volume and pan",
      "Mix presets, an A to B loop region, and live meters per lane",
      "Export your mix straight to WAV from the browser, no re-upload",
    ],
    tools: [
      { href: "/vocal-remover", label: "Vocal Remover" },
      { href: "/stems", label: "Stem Splitter" },
    ],
  },
  {
    id: "roll",
    name: "Forge Roll",
    opens: "Audio to MIDI results",
    what: "A piano roll that plays the MIDI back and lets you fix it before export.",
    points: [
      "Sampled piano and an instrument picker, not a buzzing synth",
      "Crossfade against the original audio to check the transcription",
      "Edit notes with undo, quantize, transpose, set velocity, then export the edited MIDI",
      "Key detection with scale highlighting, ruler scrub and an A to B loop",
    ],
    tools: [{ href: "/audio-to-midi", label: "Audio to MIDI" }],
  },
  {
    id: "score",
    name: "Forge Score",
    opens: "Audio to sheet music results",
    what: "Engraved notation that plays, with a cursor that follows the music.",
    points: [
      "The MusicXML renders in the browser, not as a flat image",
      "Playback cursor tracks the score bar by bar",
      "Download as PDF, SVG, MusicXML or MIDI once it looks right",
    ],
    tools: [{ href: "/audio-to-sheet-music", label: "Audio to Sheet Music" }],
  },
];

export default function ForgePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "The Forge players",
    url: `${SITE_URL}/forge`,
    itemListElement: PLAYERS.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      description: p.what,
      url: `${SITE_URL}/forge#${p.id}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ToolPageShell
        breadcrumb={<Breadcrumb items={[{ name: "Forge players" }]} />}
        meta={["Built in", "No sign-up", "Free to use"]}
        title="Hear the result before you download it"
        lede="Most audio tools hand you a file and wish you luck. Every heavy job here opens in a player built for that output, so you check the work first and export second."
      >
        <ToolSection id="why" title="Why this exists">
          <Prose>
            <p>
              A separation model can smear a vocal. A transcription model can miss a chord. You find
              out by listening, and on most sites that means downloading the file, opening a DAW and
              going back to start over if it is wrong. That round trip is the slowest part of the
              job and it happens after you have already paid or spent a run.
            </p>
            <p>
              So the result step here is not a download button. It is a player that matches what was
              produced: lanes for stems, a piano roll for MIDI, engraved staves for notation. You
              hear it, fix what needs fixing, and only then take the file.
            </p>
          </Prose>
        </ToolSection>

        {PLAYERS.map((p) => (
          <ToolSection key={p.id} id={p.id} title={p.name} eyebrow={p.opens} bleed>
            <Prose>
              <p>{p.what}</p>
            </Prose>
            <ul className="mt-4 grid gap-2">
              {p.points.map((point) => (
                <li
                  key={point}
                  className="rounded-xl border border-graphite-800 bg-graphite-900 px-4 py-3 text-sm leading-relaxed text-text-muted"
                >
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-text-muted">
              Opens automatically on{" "}
              {p.tools.map((t, i) => (
                <span key={t.href}>
                  {i > 0 && (i === p.tools.length - 1 ? " and " : ", ")}
                  <Link href={t.href} prefetch={false} className="text-amber-400 hover:underline">
                    {t.label}
                  </Link>
                </span>
              ))}
              .
            </p>
          </ToolSection>
        ))}

        <ToolSection id="cost" title="What it costs">
          <Prose>
            <p>
              Nothing extra. The players are part of the tools, not an upgrade. Where a tool is free
              the player is free with it, and where a tool costs a credit the player is included in
              that credit rather than charged on top.
            </p>
            <p>
              Nothing is uploaded twice either. Playback, editing and export all run in your browser
              against the file the job already produced.
            </p>
          </Prose>
        </ToolSection>
      </ToolPageShell>
    </>
  );
}