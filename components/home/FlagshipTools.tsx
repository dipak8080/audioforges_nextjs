import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

function wave(seed: number, n = 44): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const env = 0.4 + 0.6 * Math.pow(Math.sin(t * Math.PI), 0.7);
    return Math.max(0.14, env * Math.abs(Math.sin(i * 0.9 * seed + seed)));
  });
}

function StemsVisual() {
  const lanes = [
    { peaks: wave(3), amber: true },
    { peaks: wave(7), amber: false },
    { peaks: wave(11), amber: false },
  ];
  return (
    <div aria-hidden className="w-full space-y-1.5">
      {lanes.map((lane, li) => (
        <div key={li} className="flex h-5 items-center gap-[2px]">
          {lane.peaks.map((h, i) => (
            <span
              key={i}
              className={lane.amber ? "w-full rounded-[1px] bg-amber-400/80" : "w-full rounded-[1px] bg-graphite-600"}
              style={{ height: `${Math.max(10, h * 100)}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MidiVisual() {
  const notes = [
    [2, 12, 12], [16, 34, 9], [27, 56, 13], [42, 22, 10], [54, 44, 12],
    [68, 12, 9], [78, 66, 14], [88, 34, 10],
  ];
  return (
    <div aria-hidden className="relative h-[4.5rem] w-full overflow-hidden rounded-md border border-graphite-800 bg-graphite-950/60">
      {[20, 40, 60, 80].map((t) => (
        <span key={t} className="absolute inset-x-0 h-px bg-graphite-800" style={{ top: `${t}%` }} />
      ))}
      {[25, 50, 75].map((l) => (
        <span key={l} className="absolute inset-y-0 w-px bg-graphite-800/70" style={{ left: `${l}%` }} />
      ))}
      {notes.map(([x, y, w], i) => (
        <span
          key={i}
          className="absolute h-1.5 rounded-[2px] bg-amber-400"
          style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, opacity: 0.55 + (i % 3) * 0.15 }}
        />
      ))}
      <span className="absolute inset-y-0 left-[58%] w-px bg-text-primary/70" />
    </div>
  );
}

function ScoreVisual() {
  return (
    <svg aria-hidden viewBox="0 0 220 56" className="h-[4.5rem] w-full max-w-[300px] text-graphite-500" preserveAspectRatio="xMinYMid meet">
      {[10, 19, 28, 37, 46].map((y) => (
        <line key={y} x1="4" y1={y} x2="216" y2={y} stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" />
      ))}
      <line x1="4" y1="10" x2="4" y2="46" stroke="currentColor" />
      <line x1="120" y1="10" x2="120" y2="46" stroke="currentColor" strokeOpacity="0.7" />
      <line x1="216" y1="10" x2="216" y2="46" stroke="currentColor" strokeWidth="2" />
      {[
        [40, 28], [64, 19], [88, 24], [140, 33], [164, 24], [188, 19],
      ].map(([x, y], i) => (
        <g key={i} className="text-amber-400">
          <ellipse cx={x} cy={y} rx="5" ry="3.6" fill="currentColor" transform={`rotate(-18 ${x} ${y})`} />
          <line x1={x + 4.4} y1={y - 1} x2={x + 4.4} y2={y - 18} stroke="currentColor" strokeWidth="1.4" />
        </g>
      ))}
    </svg>
  );
}

function KeyVisual() {
  return (
    <div aria-hidden className="flex items-center gap-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-amber-500/70 bg-amber-500/10 font-mono text-lg font-semibold text-amber-400">
        8A
      </span>
      <div className="font-mono text-[11px] leading-5 text-text-muted">
        <p>A minor</p>
        <p>96.0 BPM</p>
        <p className="text-text-subtle">Camelot 8A</p>
      </div>
    </div>
  );
}

const FLAGSHIPS = [
  {
    href: "/vocal-remover",
    name: "Vocal Remover & Stem Splitter",
    blurb: "Split any track into vocals, drums, bass and more, then remix the stems in Forge Mixer.",
    chip: "Studio Quality",
    visual: <StemsVisual />,
  },
  {
    href: "/audio-to-midi",
    name: "Audio to MIDI",
    blurb: "Transcribe melodies, chords and full mixes to MIDI, then edit the notes in Forge Roll.",
    chip: "Opens in Forge Roll",
    visual: <MidiVisual />,
  },
  {
    href: "/audio-to-sheet-music",
    name: "Audio to Sheet Music",
    blurb: "Turn a recording into engraved notation with synced playback: PDF, MusicXML and MIDI.",
    chip: "Opens in Forge Score",
    visual: <ScoreVisual />,
  },
  {
    href: "/key-finder",
    name: "Key & BPM Finder",
    blurb: "Key, tempo and Camelot code for any track or a whole batch, with CSV export.",
    chip: "75% exact BPM",
    visual: <KeyVisual />,
  },
];

const QUICK_LINKS = [
  { href: "/youtube-to-wav", label: "YouTube to WAV" },
  { href: "/youtube-to-mp3", label: "YouTube to MP3" },
  { href: "/audio-to-text", label: "Audio to Text" },
  { href: "/convert", label: "Format Converter" },
];

export function FlagshipTools({ toolCount }: { toolCount: number }) {
  return (
    <section className="border-t border-graphite-800 py-14">
      <SectionHeading
        eyebrow="Start here"
        title="The flagship tools"
        description="The four jobs AudioForges is built around, each with its own player to check the result before you download."
      />

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {FLAGSHIPS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            prefetch={false}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-6 transition-colors duration-200 hover:border-amber-500/40 hover:bg-graphite-850 focus:outline-none focus-visible:border-amber-500/50 focus-visible:ring-2 focus-visible:ring-amber-500/30"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold text-text-primary transition-colors group-hover:text-amber-400">
                {tool.name}
              </h3>
              <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                {tool.chip}
              </span>
            </div>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-text-muted">{tool.blurb}</p>
            <div className="mt-5 flex min-h-[4.5rem] flex-1 items-center">{tool.visual}</div>
            <span className="mt-5 flex items-center gap-1 text-sm font-medium text-amber-400">
              Open the tool
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-text-muted">
        <span className="text-text-subtle">Also popular:</span>
        {QUICK_LINKS.map((l, i) => (
          <span key={l.href} className="flex items-center gap-2">
            <Link
              href={l.href}
              prefetch={false}
              className="text-amber-400 transition-colors hover:text-amber-300"
            >
              {l.label}
            </Link>
            {i < QUICK_LINKS.length - 1 && <span aria-hidden className="text-graphite-600">·</span>}
          </span>
        ))}
        <span aria-hidden className="text-graphite-600">·</span>
        <Link
          href="/tools"
          prefetch={false}
          className="text-amber-400 underline underline-offset-2 transition-colors hover:text-amber-300"
        >
          All {toolCount} tools
        </Link>
      </p>
    </section>
  );
}