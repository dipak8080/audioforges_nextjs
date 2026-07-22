"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform, Heart, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_LINKS = [
  { href: "/youtube-to-wav", label: "YouTube to WAV" },
  { href: "/key-finder", label: "Key & BPM Finder" },
  { href: "/vocal-remover", label: "Vocal Remover" },
  { href: "/guides", label: "Guides" },
];

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-graphite-800 bg-graphite-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        {/* Logo */}
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

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-md",
                  isActive
                    ? "text-amber-400"
                    : "text-text-muted hover:text-text-primary hover:bg-graphite-900"
                )}
              >
                {link.label}
                {/* Professional Active Underline */}
                <span
                  className={cn(
                    "absolute left-1/2 bottom-1.5 h-[2px] w-0 -translate-x-1/2 rounded-full bg-amber-500 transition-all duration-300",
                    isActive && "w-4/5"
                  )}
                />
              </Link>
            );
          })}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2">
          {/* Support Button */}
          <a
            href="https://ko-fi.com/audioforges"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-graphite-700 px-4 py-2 text-sm text-text-muted hover:text-amber-400 hover:border-amber-500/50 transition-all duration-300"
          >
            <Heart className="h-4 w-4" />
            <span>Support</span>
          </a>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            className="sm:hidden inline-flex items-center justify-center rounded-md p-2 text-text-muted hover:text-text-primary hover:bg-graphite-900 transition-all duration-200"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu with Smooth Animation */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out sm:hidden",
          isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-graphite-800 bg-graphite-950 px-4 py-4 space-y-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-amber-500/10 text-amber-400"
                    : "text-text-muted hover:bg-graphite-900 hover:text-text-primary"
                )}
              >
                {link.label}
                {isActive && (
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                )}
              </Link>
            );
          })}

          {/* Mobile Support Link */}
          <a
            href="https://ko-fi.com/audioforges"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-text-muted hover:bg-graphite-900 hover:text-amber-400 transition-all duration-200"
          >
            <Heart className="h-4 w-4" />
            Support Us
          </a>
        </div>
      </div>
    </header>
  );
}