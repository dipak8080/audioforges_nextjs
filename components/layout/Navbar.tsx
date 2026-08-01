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
  // Wraps BOTH the trigger and the panel, since the panel now lives
  // outside the button's own positioning context.
  const megaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setIsToolsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsToolsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    setIsToolsOpen(false);
    setIsMenuOpen(false);
  }, [pathname]);

  const isToolPageActive = TOOLS.some((t) => pathname === `/${t.slug}`);
  const liveToolCount = TOOLS.filter((t) => t.status === "live").length;

  return (
    <header className="sticky top-0 z-50 border-b border-graphite-800 bg-graphite-950/80 backdrop-blur-md">
      <div ref={megaRef} className="relative">
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
            <button
              type="button"
              onClick={() => setIsToolsOpen((open) => !open)}
              aria-expanded={isToolsOpen}
              aria-haspopup="true"
              className={cn(
                "relative flex items-center gap-1 px-4 py-2 text-sm font-medium transition-all duration-300 rounded-md",
                isToolPageActive || isToolsOpen
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

        {/* Mega panel: spans the nav container instead of floating off the
            button, so it reads as part of the header rather than a stray box. */}
        <div
          className={cn(
            "absolute inset-x-0 top-full hidden sm:block transition-all duration-200",
            isToolsOpen
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-1 pointer-events-none"
          )}
        >
          <div className="mx-auto max-w-6xl px-4">
            <div className="overflow-hidden rounded-b-xl border border-t-0 border-graphite-800 bg-graphite-900 shadow-2xl">
              {/* CSS multi-column, NOT grid. Grid forces every row to the
                  height of its tallest cell, which is what created the dead
                  space under the short categories. Columns let each block
                  flow into whatever space is free. */}
              <div className="columns-4 gap-x-8 p-6 [column-fill:balance]">
                {CATEGORY_ORDER.map((category) => {
                  const tools = getToolsByCategory(category);
                  if (tools.length === 0) return null;
                  return (
                    <div key={category} className="mb-6 break-inside-avoid">
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="h-3 w-[2px] rounded-full bg-amber-500" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                          {CATEGORY_LABELS[category]}
                        </p>
                      </div>
                      <div className="space-y-px">
                        {tools.map((tool) => {
                          const isActive = pathname === `/${tool.slug}`;
                          return tool.status === "live" ? (
                            <Link
                              key={tool.slug}
                              href={`/${tool.slug}`}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "block rounded-md px-2 py-[5px] text-[13px] leading-snug transition-colors",
                                isActive
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "text-text-muted hover:bg-graphite-850 hover:text-text-primary"
                              )}
                            >
                              {tool.name}
                            </Link>
                          ) : (
                            <div
                              key={tool.slug}
                              className="flex items-center justify-between gap-2 rounded-md px-2 py-[5px] text-[13px] text-text-subtle/70 cursor-default"
                            >
                              <span>{tool.name}</span>
                              <span className="shrink-0 rounded-full border border-graphite-700 px-1.5 text-[9px] font-medium uppercase tracking-wide text-text-subtle">
                                Soon
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-graphite-800 bg-graphite-950/40 px-6 py-3">
                <p className="text-xs text-text-subtle">
                  {liveToolCount} free tools — no sign-up, no watermark
                </p>
                <Link
                  href="/tools"
                  className="text-[13px] font-medium text-amber-400 transition-colors hover:text-amber-300"
                >
                  View all tools →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out sm:hidden",
          isMenuOpen ? "max-h-[75vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0",
          // Thin, theme-matched scrollbar instead of the browser default.
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:bg-graphite-700",
          "hover:[&::-webkit-scrollbar-thumb]:bg-graphite-600"
        )}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 transparent" }}
      >
        <div className="border-t border-graphite-800 bg-graphite-950 px-4 py-4 space-y-5">
          {CATEGORY_ORDER.map((category) => {
            const tools = getToolsByCategory(category);
            if (tools.length === 0) return null;
            return (
              <div key={category}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="h-3 w-[2px] rounded-full bg-amber-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    {CATEGORY_LABELS[category]}
                  </p>
                </div>
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
                        className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-text-subtle/70"
                      >
                        <span>{tool.name}</span>
                        <span className="rounded-full border border-graphite-700 px-1.5 text-[9px] font-medium uppercase tracking-wide text-text-subtle">
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