"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AudioWaveform, Coffee, Menu, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TOOLS, CATEGORY_ORDER, CATEGORY_LABELS, getToolsByCategory } from "@/lib/data/tools";
import { CreditMenu, CreditChipMobile } from "@/components/credits/CreditMenu";
import { CreditAccountPanel } from "@/components/credits/CreditAccountPanel";
import { useCredits } from "@/components/credits/CreditProvider";

/**
 * PREFETCH IS DISABLED ON THE BULK TOOL LINKS BELOW (2026-08-16).
 *
 * Next <Link> prefetches whenever a link enters the viewport via
 * IntersectionObserver, which does not care about `opacity: 0` or
 * `pointer-events: none` — a hidden-but-laid-out element still intersects.
 * The mega panel renders on every page, so every tool link was prefetched on
 * every page load whether or not the menu was opened. Each prefetched App
 * Router route costs FOUR edge requests, so one visitor fired ~120 before
 * clicking anything. Still prefetched on purpose: the logo, Guides, and View
 * all tools — three links, genuinely likely to be clicked.
 *
 * OUTSIDE-CLICK (2026-08-17): anchored to the panel CARD, not its full-width
 * wrapper. The wrapper spans `inset-x-0` while the card is `max-w-6xl`, so
 * anchoring to the wrapper made gutter clicks count as "inside".
 *
 * HOVER SCOPE (2026-08-17): open-on-hover handlers sit on a wrapper around
 * the trigger ALONE. Wrapping the whole link group made Guides open Tools.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * INERT WHEN CLOSED. Both the mega panel and the mobile sheet stay mounted
 * (that's what the prefetch note above is about), and `opacity-0` /
 * `pointer-events-none` / `max-h-0` hide them from the mouse but NOT from
 * the keyboard. Tab from the Tools button walked into ~40 invisible tool
 * links, and on mobile every closed sheet link was still focusable. `inert`
 * removes them from the tab order and the accessibility tree without
 * unmounting them, so the prefetch behaviour is unchanged.
 *
 * COLUMN COUNT IS RESPONSIVE. `columns-4` at a 640px breakpoint gave each
 * column ~100px, so most tool names truncated. Now 2 → 3 → 4.
 *
 * THE DESKTOP SPLIT MOVED FROM 640px TO 768px. Tools + Guides + credits +
 * Donate does not fit a 640px header; it fits at 768. CreditMenu and
 * CreditChipMobile use the same breakpoint.
 *
 * SCROLL IS rAF-THROTTLED and compares against a ref, so a scroll gesture
 * no longer calls setState on every frame it fires.
 *
 * NO SEARCH FIELD (2026-08-17): every tool is on screen here, unscrolled.
 * Filtering a list you can see is work without a payoff. Search lives on
 * /tools, which has descriptions and real scroll.
 */
export function Navbar() {
  const pathname = usePathname();

  /**
   * Asking a paying customer for a tip, in the same row as the balance they
   * paid for, reads badly. Donate steps aside once there IS a balance — and
   * only on desktop, where two amber pills would sit side by side and
   * compete. It stays in the mobile sheet and the footer for everyone, so
   * the Ko-fi link is never unreachable.
   */
  const { balance } = useCredits();
  const hideDonate = balance > 0;

  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolsOpenRef = useRef(false);

  useEffect(() => {
    toolsOpenRef.current = isToolsOpen;
  }, [isToolsOpen]);

  // --- open/close helpers -------------------------------------------------
  // Hover opens; a short close delay means a diagonal mouse path from the
  // trigger to the panel doesn't slam it shut mid-move.
  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function openTools() {
    cancelClose();
    setIsToolsOpen(true);
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setIsToolsOpen(false), 140);
  }

  // --- outside click + escape --------------------------------------------
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setIsToolsOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (toolsOpenRef.current) triggerRef.current?.focus();
      setIsToolsOpen(false);
      setIsMobileOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
      cancelClose();
    };
  }, []);

  // Close everything on navigation.
  useEffect(() => {
    setIsToolsOpen(false);
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock the page behind the mobile sheet so the body doesn't scroll under it.
  useEffect(() => {
    if (!isMobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobileOpen]);

  // Border/shadow only once the page has moved — flat at rest, defined in use.
  useEffect(() => {
    let raf = 0;
    let last = window.scrollY > 8;
    setIsScrolled(last);

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const next = window.scrollY > 8;
        if (next !== last) {
          last = next;
          setIsScrolled(next);
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const isToolPageActive = TOOLS.some((t) => pathname === `/${t.slug}`);
  const liveToolCount = TOOLS.filter((t) => t.status === "live").length;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-graphite-950/80 backdrop-blur-md transition-shadow duration-300",
        isScrolled || isToolsOpen || isMobileOpen
          ? "border-graphite-800 shadow-[0_1px_0_0_rgba(0,0,0,0.4)]"
          : "border-transparent"
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-graphite-900 focus:px-3 focus:py-2 focus:text-sm focus:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
      >
        Skip to content
      </a>

      {/* Backdrop for the mobile sheet. z-0, under the nav (z-10), so it dims
          the page rather than the header's own contents. */}
      <div
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-0 bg-graphite-950/70 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <div className="relative z-10">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            onClick={() => setIsMobileOpen(false)}
          >
            <AudioWaveform className="h-5 w-5 text-amber-500" />
            <span className="font-mono font-semibold tracking-tight text-text-primary">
              AudioForges
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {/* Hover scope is this wrapper only — see the note up top. */}
            <div className="flex" onMouseEnter={openTools} onMouseLeave={scheduleClose}>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => (isToolsOpen ? setIsToolsOpen(false) : openTools())}
                aria-expanded={isToolsOpen}
                aria-controls="nav-tools-panel"
                className={cn(
                  "relative flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium outline-none transition-colors duration-200",
                  "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                  isToolPageActive || isToolsOpen
                    ? "text-amber-400"
                    : "text-text-muted hover:bg-graphite-900 hover:text-text-primary"
                )}
              >
                Tools
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none",
                    isToolsOpen && "rotate-180"
                  )}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1.5 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-amber-500 transition-all duration-300",
                    isToolPageActive && "w-4/5"
                  )}
                />
              </button>
            </div>

            <Link
              href="/guides"
              aria-current={pathname === "/guides" ? "page" : undefined}
              className={cn(
                "relative rounded-md px-4 py-2 text-sm font-medium outline-none transition-colors duration-200",
                "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                pathname === "/guides"
                  ? "text-amber-400"
                  : "text-text-muted hover:bg-graphite-900 hover:text-text-primary"
              )}
            >
              Guides
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-1.5 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-amber-500 transition-all duration-300",
                  pathname === "/guides" && "w-4/5"
                )}
              />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <CreditMenu />

            <a
              href="https://ko-fi.com/audioforges"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium",
                hideDonate ? "hidden" : "hidden md:flex",
                "border-amber-500/25 bg-amber-500/5 text-amber-400/90",
                "transition-colors duration-200 hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-300",
                "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
              )}
            >
              <Coffee className="h-4 w-4" />
              <span>Donate</span>
            </a>

            {/* Mobile: icon + number only. "48 credits" is what makes the
                desktop pill too wide for a phone header, and the number is
                the part people check. Signed in, it opens the sheet where
                the account block lives; anonymous, it goes to /pricing,
                because a sheet with no account block answers nothing. */}
            <CreditChipMobile onOpenSheet={() => setIsMobileOpen(true)} />

            <button
              type="button"
              onClick={() => setIsMobileOpen((open) => !open)}
              aria-label={isMobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileOpen}
              aria-controls="nav-mobile-sheet"
              className="inline-flex items-center justify-center rounded-md p-2 text-text-muted outline-none transition-colors duration-200 hover:bg-graphite-900 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70 md:hidden"
            >
              {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Mega panel wrapper: full-bleed for positioning only, never
            clickable itself, so clicks beside the card fall through to the
            page and close the panel. `inert` when closed keeps ~40 invisible
            links out of the tab order without unmounting them. */}
        <div
          id="nav-tools-panel"
          inert={!isToolsOpen}
          className={cn(
            "pointer-events-none absolute inset-x-0 top-full hidden md:block",
            "transition-all duration-200 ease-out motion-reduce:transition-none",
            isToolsOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          )}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="mx-auto max-w-6xl px-4">
            <div
              ref={panelRef}
              className={cn(
                "overflow-hidden rounded-b-xl border border-t-0 border-graphite-800 bg-graphite-900 shadow-2xl",
                isToolsOpen ? "pointer-events-auto" : "pointer-events-none"
              )}
            >
              {/* CSS multi-column, NOT grid. Grid forces every row to the
                  height of its tallest cell, which is what created the dead
                  space under short categories. Columns let each block flow
                  into whatever space is free. */}
              <div className="columns-2 gap-x-8 p-6 [column-fill:balance] md:columns-3 lg:columns-4">
                {CATEGORY_ORDER.map((category) => {
                  const tools = getToolsByCategory(category);
                  if (tools.length === 0) return null;
                  return (
                    <div key={category} className="mb-6 break-inside-avoid">
                      <div className="mb-2.5 flex items-center gap-2">
                        <span aria-hidden className="h-3 w-[2px] rounded-full bg-amber-500" />
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                          {CATEGORY_LABELS[category]}
                        </p>
                      </div>
                      <div className="space-y-px">
                        {tools.map((tool) => (
                          <ToolRow key={tool.slug} tool={tool} pathname={pathname} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-graphite-800 bg-graphite-950/40 px-6 py-3">
                <p className="text-xs text-text-subtle">
                  {liveToolCount} free tools — no sign-up, no watermark
                </p>
                <Link
                  href="/tools"
                  className="shrink-0 rounded-md text-[13px] font-medium text-amber-400 outline-none transition-colors hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  Browse with descriptions →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sheet. The backdrop above is what makes "tap anywhere to
          close" work on touch, where there is no mousedown to rely on.
          `inert` when closed: max-h-0 clips these links visually but leaves
          every one of them focusable, so Tab used to walk the whole tool
          list behind a closed menu. */}
      <div
        id="nav-mobile-sheet"
        inert={!isMobileOpen}
        className={cn(
          "relative z-10 origin-top overflow-y-auto border-b border-graphite-800 bg-graphite-950 transition-all duration-300 ease-out motion-reduce:transition-none md:hidden",
          isMobileOpen
            ? "max-h-[calc(100dvh-4rem)] opacity-100"
            : "pointer-events-none max-h-0 opacity-0",
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full",
          "[&::-webkit-scrollbar-thumb]:bg-graphite-700",
          "hover:[&::-webkit-scrollbar-thumb]:bg-graphite-600"
        )}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 transparent" }}
      >
        <div className="space-y-5 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {/* Top of the sheet, above the tool list. Someone who opened this
              after tapping their balance expects to land on their account,
              not scroll past forty tools to find it. */}
          <CreditAccountPanel variant="mobile" onNavigate={() => setIsMobileOpen(false)} />

          {CATEGORY_ORDER.map((category) => {
            const tools = getToolsByCategory(category);
            if (tools.length === 0) return null;
            return (
              <div key={category}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span aria-hidden className="h-3 w-[2px] rounded-full bg-amber-500" />
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
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
                        // Set explicitly rather than relying on clipping to
                        // keep these out of the viewport. Once the sheet IS
                        // open they are all on screen at once, which is
                        // exactly the case worth not prefetching.
                        prefetch={false}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium outline-none transition-colors duration-200",
                          "focus-visible:ring-2 focus-visible:ring-amber-400/70",
                          isActive
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-text-muted hover:bg-graphite-900 hover:text-text-primary"
                        )}
                      >
                        {tool.name}
                        {isActive && (
                          <span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" />
                        )}
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

          <div className="space-y-1 border-t border-graphite-800 pt-4">
            <Link
              href="/tools"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-text-muted outline-none transition-colors duration-200 hover:bg-graphite-900 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              Browse with descriptions
              <ChevronRight className="h-4 w-4 text-amber-500/70" />
            </Link>

            <Link
              href="/guides"
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium outline-none transition-colors duration-200",
                "focus-visible:ring-2 focus-visible:ring-amber-400/70",
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
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm font-medium text-amber-400/90 outline-none transition-colors duration-200 hover:bg-amber-500/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              <Coffee className="h-4 w-4" />
              Donate
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}

/** One row in the mega panel. */
function ToolRow({ tool, pathname }: { tool: (typeof TOOLS)[number]; pathname: string }) {
  const isActive = pathname === `/${tool.slug}`;

  if (tool.status !== "live") {
    return (
      <div className="flex cursor-default items-center justify-between gap-2 rounded-md px-2 py-[5px] text-[13px] text-text-subtle/70">
        <span className="truncate">{tool.name}</span>
        <span className="shrink-0 rounded-full border border-graphite-700 px-1.5 text-[9px] font-medium uppercase tracking-wide text-text-subtle">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/${tool.slug}`}
      // See the note at the top of this file.
      prefetch={false}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center justify-between gap-2 rounded-md px-2 py-[5px] text-[13px] leading-snug outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-amber-400/70",
        isActive
          ? "bg-amber-500/10 text-amber-400"
          : "text-text-muted hover:bg-graphite-850 hover:text-text-primary"
      )}
    >
      <span className="truncate">{tool.name}</span>
      <ChevronRight
        aria-hidden
        className="h-3 w-3 shrink-0 -translate-x-1 text-amber-500/70 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none"
      />
    </Link>
  );
}