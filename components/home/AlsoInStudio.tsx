import Link from "next/link";
import { ArrowRight } from "lucide-react";

const ITEMS = [
  { href: "/audio-to-midi", name: "Audio to MIDI", desc: "Transcribe melodies, chords and full mixes, then edit the notes in Forge Roll." },
  { href: "/audio-to-sheet-music", name: "Audio to Sheet Music", desc: "Engraved notation with synced playback. PDF, MusicXML and MIDI out." },
  { href: "/key-finder", name: "Key & BPM Finder", desc: "Key, tempo and Camelot code, single track or a whole crate with CSV export." },
];

export function AlsoInStudio({ toolCount }: { toolCount: number }) {
  return (
    <section className="border-t border-graphite-800 py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">Also in the studio</p>
        <Link
          href="/tools"
          prefetch={false}
          className="group flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-amber-400"
        >
          All {toolCount} tools
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      </div>
      <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-graphite-800 bg-graphite-800 sm:grid-cols-3">
        {ITEMS.map((t) => (
          <li key={t.href} className="bg-graphite-900">
            <Link
              href={t.href}
              prefetch={false}
              className="group flex h-full flex-col p-5 transition-colors hover:bg-graphite-850 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/30"
            >
              <span className="font-semibold text-text-primary group-hover:text-amber-400">{t.name}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-text-muted">{t.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}