"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, ArrowRight, Layers, Piano, FileMusic, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { buttonStyles } from "@/components/ui/Button";
import { TOOLS } from "@/lib/data/tools";
import { BrandMark } from "@/components/brand/BrandMark";
import { CreditMenu, CreditChipMobile } from "@/components/credits/CreditMenu";
import { CreditAccountPanel } from "@/components/credits/CreditAccountPanel";
import { DEMO_PEAKS_STUDIO } from "@/lib/data/demo-peaks";
import { useCredits } from "@/components/credits/CreditProvider";

type Product = { href: string; name: string; desc: string; player: string; icon: LucideIcon };

const FLAGSHIP = {
  href: "/vocal-remover",
  name: "Vocal Remover",
  desc: "Vocals and instrumental as WAV or MP3. Free, or Studio Quality for the cleanest split.",
};

const PRODUCTS: Product[] = [
  { href: "/stems", name: "Stem Splitter", desc: "Vocals, drums, bass and other", player: "Forge Mixer", icon: Layers },
  { href: "/audio-to-midi", name: "Audio to MIDI", desc: "Edit the notes before you download", player: "Forge Roll", icon: Piano },
  { href: "/audio-to-sheet-music", name: "Audio to Sheet Music", desc: "A printable score that plays along", player: "Forge Score", icon: FileMusic },
];

const PRODUCT_HREFS = new Set([FLAGSHIP.href, ...PRODUCTS.map((p) => p.href)]);

const PEAK_MAX = Math.max(...DEMO_PEAKS_STUDIO);
const FLAGSHIP_PEAKS = DEMO_PEAKS_STUDIO.filter((_, i) => i % 3 === 0).map((p) => p / PEAK_MAX);

export function Navbar({ paywallEnabled = false }: { paywallEnabled?: boolean }) {
  const pathname = usePathname();
  const { me } = useCredits();

  const [isProductOpen, setIsProductOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function openProduct() {
    cancelClose();
    setIsProductOpen(true);
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setIsProductOpen(false), 140);
  }
  const isMouse = (e: React.PointerEvent) => e.pointerType === "mouse";

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setIsProductOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setIsProductOpen(false);
      setIsMobileOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      cancelClose();
    };
  }, []);

  useEffect(() => {
    setIsProductOpen(false);
    setIsMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previous;
      if (sheetRef.current?.contains(document.activeElement)) mobileToggleRef.current?.focus();
    };
  }, [isMobileOpen]);

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

  const isProductActive =
    PRODUCT_HREFS.has(pathname) || pathname === "/tools" || pathname === "/forge" ||
    TOOLS.some((t) => pathname === `/${t.slug}`);
  const isPricingActive = pathname === "/pricing";
  const isGuidesActive = pathname.startsWith("/guides");
  const toolCount = TOOLS.filter((t) => t.status === "live").length;

  const navLink = (active: boolean) =>
    cn(
      "relative rounded-md px-3 py-1.5 text-[13.5px] font-medium outline-none transition-colors duration-150",
      "focus-visible:ring-2 focus-visible:ring-amber-400/70",
      active ? "text-text-primary" : "text-text-muted hover:text-text-primary"
    );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-graphite-950/85 backdrop-blur-md transition-colors duration-300",
        isScrolled || isProductOpen || isMobileOpen ? "border-graphite-800" : "border-transparent"
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-graphite-900 focus:px-3 focus:py-2 focus:text-sm focus:text-amber-400"
      >
        Skip to content
      </a>

      <div
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-0 bg-graphite-950/70 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      <div className="relative z-10">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            aria-label="AudioForges home"
            className="flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            onClick={() => setIsMobileOpen(false)}
          >
            <BrandMark className="h-[18px] w-[18px] text-amber-500" />
            <span className="font-mono text-[15px] tracking-tight">
              <span className="text-text-secondary">Audio</span>
              <span className="font-semibold text-text-primary">Forges</span>
            </span>
          </Link>

          <div className="hidden items-center gap-0.5 md:flex">
            <div
              className="flex"
              onPointerEnter={(e) => isMouse(e) && openProduct()}
              onPointerLeave={(e) => isMouse(e) && scheduleClose()}
            >
              <button
                ref={triggerRef}
                type="button"
                onClick={() => (isProductOpen ? setIsProductOpen(false) : openProduct())}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    openProduct();
                    panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
                  }
                }}
                aria-expanded={isProductOpen}
                aria-controls="nav-product-panel"
                className={cn(navLink(isProductActive || isProductOpen), "flex items-center gap-1")}
              >
                Product
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-text-subtle transition-transform duration-200",
                    isProductOpen && "rotate-180"
                  )}
                />
              </button>
            </div>
            <Link href="/pricing" prefetch={false} aria-current={isPricingActive ? "page" : undefined} className={navLink(isPricingActive)}>
              Pricing
            </Link>
            <Link href="/guides" aria-current={isGuidesActive ? "page" : undefined} className={navLink(isGuidesActive)}>
              Guides
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {!me?.authenticated && (
              <Link
                href="/signin"
                className={buttonStyles({ variant: "ghost", size: "sm", className: "hidden text-text-muted md:inline-flex" })}
              >
                Sign in
              </Link>
            )}
            <CreditMenu hidePricingLink={paywallEnabled} />
            {pathname !== "/pricing" && (
              <Link
                href="/pricing"
                prefetch={false}
                className={buttonStyles({ size: "sm", className: "hidden rounded-full px-4 md:inline-flex" })}
              >
                Get credits
              </Link>
            )}
            <CreditChipMobile onOpenSheet={() => setIsMobileOpen(true)} />
            <button
              ref={mobileToggleRef}
              type="button"
              onClick={() => setIsMobileOpen((v) => !v)}
              aria-label={isMobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileOpen}
              aria-controls="nav-mobile-sheet"
              className={buttonStyles({ variant: "ghost", size: "icon", className: "md:hidden" })}
            >
              {isMobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>

        <div
          id="nav-product-panel"
          inert={!isProductOpen}
          className={cn(
            "pointer-events-none absolute inset-x-0 top-full hidden md:block",
            "transition-all duration-150 ease-out motion-reduce:transition-none",
            isProductOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
          )}
          onPointerEnter={(e) => isMouse(e) && cancelClose()}
          onPointerLeave={(e) => isMouse(e) && scheduleClose()}
        >
          <div className="mx-auto flex max-w-6xl justify-center px-4">
            <div
              ref={panelRef}
              role="navigation"
              aria-label="Product"
              className={cn(
                "surface grain w-[46rem] overflow-hidden rounded-xl border border-graphite-800 shadow-2xl shadow-black/50",
                isProductOpen ? "pointer-events-auto" : "pointer-events-none"
              )}
            >
              <div className="grid grid-cols-[1.05fr_1fr]">
                <Link
                  href={FLAGSHIP.href}
                  prefetch={false}
                  aria-current={pathname === FLAGSHIP.href ? "page" : undefined}
                  className={cn(
                    "group flex flex-col border-r border-graphite-800 p-6 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/70",
                    pathname === FLAGSHIP.href ? "bg-amber-500/[0.06]" : "hover:bg-graphite-850/60"
                  )}
                >
                  <span className="inline-flex w-fit items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                    Studio Quality
                  </span>
                  <span className="display mt-4 text-[28px] leading-none text-text-primary">{FLAGSHIP.name}</span>
                  <span className="mt-2.5 text-[13px] leading-relaxed text-text-muted">{FLAGSHIP.desc}</span>
                  <span className="mt-6 flex h-12 items-center gap-px" aria-hidden>
                    {FLAGSHIP_PEAKS.map((peak, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-full bg-graphite-600 transition-colors duration-300 group-hover:bg-amber-500/70"
                        style={{ height: `${Math.max(6, peak * 100)}%`, transitionDelay: `${i * 4}ms` }}
                      />
                    ))}
                  </span>
                  <span className="mt-4 flex items-center justify-between text-[12px] text-text-subtle">
                    Opens in Forge Mixer
                    <ArrowRight className="h-3.5 w-3.5 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
                  </span>
                </Link>

                <div className="flex flex-col divide-y divide-graphite-800">
                  {PRODUCTS.map((p) => {
                    const active = pathname === p.href;
                    const Icon = p.icon;
                    return (
                      <Link
                        key={p.href}
                        href={p.href}
                        prefetch={false}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex flex-1 items-center gap-3.5 px-5 py-4 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/70",
                          active ? "bg-amber-500/[0.06]" : "hover:bg-graphite-850/60"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-graphite-900 transition-colors",
                            active
                              ? "border-amber-500/40 text-amber-400"
                              : "border-graphite-800 text-text-muted group-hover:border-graphite-700 group-hover:text-text-primary"
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[13.5px] font-medium", active ? "text-amber-400" : "text-text-primary")}>
                            {p.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-text-subtle">{p.desc}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-text-subtle transition-colors group-hover:text-text-muted">
                          {p.player}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-graphite-800 bg-graphite-950/40 px-6 py-3 text-[13px]">
                <Link href="/forge" prefetch={false} className="text-text-muted transition-colors hover:text-text-primary">
                  How the Forge players work
                </Link>
                <Link
                  href="/tools"
                  className="group flex items-center gap-1 font-medium text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  All {toolCount} tools
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={sheetRef}
        id="nav-mobile-sheet"
        inert={!isMobileOpen}
        className={cn(
          "relative z-10 origin-top overflow-y-auto border-b border-graphite-800 bg-graphite-950 transition-all duration-300 ease-out motion-reduce:transition-none md:hidden",
          isMobileOpen ? "max-h-[calc(100dvh-3.5rem)] opacity-100" : "pointer-events-none max-h-0 opacity-0"
        )}
      >
        <div className="space-y-6 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <CreditAccountPanel variant="mobile" onNavigate={() => setIsMobileOpen(false)} />

          <div>
            <p className="px-3 text-[12px] text-text-subtle">Studio tools</p>
            <div className="mt-1.5 space-y-0.5">
              {[{ ...FLAGSHIP, player: "Forge Mixer" }, ...PRODUCTS].map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                      active ? "bg-amber-500/10 text-amber-400" : "text-text-primary hover:bg-graphite-900"
                    )}
                  >
                    {l.name}
                    <span className="text-[12px] font-normal text-text-subtle">{l.player}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-0.5 border-t border-graphite-800 pt-4">
            {[
              { href: "/tools", label: `All ${toolCount} tools` },
              { href: "/forge", label: "The Forge players" },
              { href: "/pricing", label: "Pricing" },
              { href: "/guides", label: "Guides" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                prefetch={false}
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] text-text-muted outline-none hover:bg-graphite-900 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <Link
            href="/pricing"
            prefetch={false}
            onClick={() => setIsMobileOpen(false)}
            className={buttonStyles({ size: "lg", className: "w-full rounded-xl" })}
          >
            Get credits
          </Link>
        </div>
      </div>
    </header>
  );
}