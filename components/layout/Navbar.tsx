import Link from "next/link";
import { AudioWaveform, Heart } from "lucide-react";

const NAV_LINKS = [
  { href: "/youtube-to-wav", label: "YouTube to WAV" },
  { href: "/key-finder", label: "Key & BPM Finder" },
  { href: "/vocal-remover", label: "Vocal Remover" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-graphite-800 bg-graphite-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <AudioWaveform className="h-5 w-5 text-amber-500" />
          <span className="font-mono font-semibold tracking-tight text-text-primary">
            AudioForges
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <a
          href="https://ko-fi.com/audioforges"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-graphite-700 px-3 py-1.5 text-sm text-text-muted hover:text-amber-400 hover:border-amber-500/40 transition-colors"
        >
          <Heart className="h-3.5 w-3.5" />
          <span>Support</span>
        </a>
      </nav>
    </header>
  );
}