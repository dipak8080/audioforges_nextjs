"use client";

import { useState } from "react";
import Link from "next/link";
import { AudioWaveform, Heart, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/youtube-to-wav", label: "YouTube to WAV" },
  { href: "/key-finder", label: "Key & BPM Finder" },
  { href: "/vocal-remover", label: "Vocal Remover" },
  { href: "/guides", label: "Guides" },
];

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-graphite-800 bg-graphite-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
          onClick={() => setIsMenuOpen(false)}
        >
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

        <div className="flex items-center gap-2">
          <a
            href="https://ko-fi.com/audioforges"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-graphite-700 px-3 py-1.5 text-sm text-text-muted hover:text-amber-400 hover:border-amber-500/40 transition-colors"
          >
            <Heart className="h-3.5 w-3.5" />
            <span>Support</span>
          </a>

          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors"
          >
            {isMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div className="sm:hidden border-t border-graphite-800 bg-graphite-950 px-4 py-3 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-colors"
            >
              {link.label}
            </Link>
          ))}

          <a
            href="https://ko-fi.com/audioforges"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm text-text-muted hover:text-amber-400 transition-colors"
          >
            <Heart className="h-3.5 w-3.5" />
            <span>Support</span>
          </a>
        </div>
      )}
    </header>
  );
}