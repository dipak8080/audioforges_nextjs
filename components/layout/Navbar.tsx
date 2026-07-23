"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform, Heart, Menu, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TOOLS, CATEGORY_ORDER, CATEGORY_LABELS, getToolsByCategory } from "@/lib/data/tools";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const pathname = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsToolsOpen(false);
    setIsMenuOpen(false);
  }, [pathname]);

  const isToolPageActive = TOOLS.some((t) => pathname === `/${t.slug}`);

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
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsToolsOpen((open) => !open)}
              aria-expanded={isToolsOpen}
              className={cn(
                "relative flex items-center gap-1 px-4 py-2 text-sm font-medium transition-all duration-300 rounded-md",
                isToolPageActive
                  ? "text-amber-400"
                  : "text-text-muted hover:text-text-primary hover:bg-graphite-900"
              )}
            >
              Tools
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform duration-200", isToolsOpen && "rotate-180")}
              />
              <span
                className={cn(
                  "absolute left-1/2 bottom-1.5 h-[2px] w-0 -translate-x-1/2 rounded-full bg-amber-500 transition-all duration-300",
                  isToolPageActive && "w-4/5"
                )}
              />
            </button>

            <div
              className={cn(
                "absolute left-0 top-full mt-2 w-[560px] origin-top-left rounded-xl border border-graphite-800 bg-graphite-900 p-4 shadow-2xl transition-all duration-200",
                isToolsOpen
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "opacity-0 scale-95 pointer-events-none"
              )}
            >
              <div className="grid grid-cols-2 gap-4">
                {CATEGORY_ORDER.map((category) => {
                  const tools = getToolsByCategory(category);
                  if (tools.length === 0) return null;
                  return (
                    <div key={category}>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle mb-1.5">
                        {CATEGORY_LABELS[category]}
                      </p>
                      <div className="space-y-0.5">
                        {tools.map((tool) =>
                          tool.status === "live" ? (
                            <Link
                              key={tool.slug}
                              href={`/${tool.slug}`}
                              className="block rounded-md px-2 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-graphite-850 transition-colors"
                            >
                              {tool.name}
                            </Link>
                          ) : (
                            <div
                              key={tool.slug}
                              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-text-subtle opacity-60 cursor-default"
                            >
                              <span>{tool.name}</span>
                              <span className="text-[9px] font-medium uppercase tracking-wide text-text-subtle border border-graphite-700 rounded-full px-1.5 py-0.5">
                                Soon
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link
                href="/tools"
                className="mt-3 flex items-center justify-center rounded-md border-t border-graphite-800 pt-3 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                View all tools →
              </Link>
            </div>
          </div>

          <Link
            href="/guides"
            aria-current={pathname === "/guides" ? "page" : undefined}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition-all duration-300 rounded-md",
              pathname === "/guides"
                ? "text-amber-400"
                : "text-text-muted hover:text-text-primary hover:bg-graphite-900"
            )}
          >
            Guides
            <span
              className={cn(
                "absolute left-1/2 bottom-1.5 h-[2px] w-0 -translate-x-1/2 rounded-full bg-amber-500 transition-all duration-300",
                pathname === "/guides" && "w-4/5"
              )}
            />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Fixed: Added missing <a> tag */}
          <a
            href="https://ko-fi.com/audioforges"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 rounded-md border border-graphite-700 px-4 py-2 text-sm text-text-muted hover:text-amber-400 hover:border-amber-500/50 transition-all duration-300"
          >
            <Heart className="h-4 w-4" />
            <span>Support</span>
          </a>

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

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out sm:hidden",
          isMenuOpen ? "max-h-[32rem] opacity-100 overflow-y-auto" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-graphite-800 bg-graphite-950 px-4 py-4 space-y-4">
          {CATEGORY_ORDER.map((category) => {
            const tools = getToolsByCategory(category);
            if (tools.length === 0) return null;
            return (
              <div key={category}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle mb-1.5 px-1">
                  {CATEGORY_LABELS[category]}
                </p>
                <div className="space-y-1">
                  {tools.map((tool) => {
                    const isActive = pathname === `/${tool.slug}`;
                    return tool.status === "live" ? (
                      <Link
                        key={tool.slug}
                        href={`/${tool.slug}`}
                        onClick={() => setIsMenuOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                          isActive
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-text-muted hover:bg-graphite-900 hover:text-text-primary"
                        )}
                      >
                        {tool.name}
                        {isActive && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                      </Link>
                    ) : (
                      <div
                        key={tool.slug}
                        className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-text-subtle opacity-60"
                      >
                        <span>{tool.name}</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide text-text-subtle border border-graphite-700 rounded-full px-1.5 py-0.5">
                          Soon
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Link
            href="/guides"
            onClick={() => setIsMenuOpen(false)}
            className={cn(
              "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              pathname === "/guides"
                ? "bg-amber-500/10 text-amber-400"
                : "text-text-muted hover:bg-graphite-900 hover:text-text-primary"
            )}
          >
            Guides
          </Link>

          {/* Fixed: Added missing <a> tag */}
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