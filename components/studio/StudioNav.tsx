"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  FileMusic,
  Gauge,
  Layers,
  LogOut,
  Menu,
  Mic2,
  Piano,
  SplitSquareVertical,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { cn } from "@/lib/utils/cn";
import { readPass, signOut } from "@/lib/studio/account";
import { STUDIO_MENU, type NavIcon, type NavItem } from "@/lib/studio/nav";
import { useStudioConfig } from "@/lib/studio/use-studio-config";

const ICONS: Record<NavIcon, LucideIcon> = {
  mic: Mic2,
  layers: Layers,
  waves: Waves,
  split: SplitSquareVertical,
  piano: Piano,
  score: FileMusic,
  gauge: Gauge,
};

const LOW_BALANCE = 2;

function useClickAway(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Wordmark() {
  return (
    <Link href="/" prefetch={false} className="inline-flex items-center gap-2">
      <BrandMark className="h-5 w-5 text-amber-500" />
      <span className="font-mono tracking-tight">
        <span className="font-normal text-text-body">Audio</span>
        <span className="font-semibold text-text-primary">Forges</span>
      </span>
    </Link>
  );
}

function useItemText() {
  const { t } = useI18n();
  const n = t.nav;
  return (item: NavItem) => {
    switch (item.key) {
      case "forgeClean":
        return { name: "Forge Clean", desc: n.forgeCleanDesc };
      case "forgeSplit":
        return { name: "Forge Split", desc: n.forgeSplitDesc };
      default:
        return { name: n[item.key], desc: n[`${item.key}Desc` as const] };
    }
  };
}

function MenuItemLink({ item, onPick }: { item: NavItem; onPick: () => void }) {
  const text = useItemText()(item);
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onPick}
      className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-graphite-800/70"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-graphite-700 text-text-muted group-hover:border-amber-500/40 group-hover:text-amber-400">
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm text-text-primary">{text.name}</span>
        <span className="block text-xs text-text-muted">{text.desc}</span>
      </span>
    </Link>
  );
}

function StudioMenu({ onPick }: { onPick: () => void }) {
  const { t } = useI18n();
  return (
    <div className="surface grain rounded-2xl border border-graphite-700 bg-graphite-900/95 p-3 shadow-2xl backdrop-blur">
      <div className="grid gap-2 md:grid-cols-3">
        {STUDIO_MENU.map((group) => (
          <div key={group.key}>
            <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{t.nav[group.key]}</p>
            {group.items.map((item) => (
              <MenuItemLink key={item.key} item={item} onPick={onPick} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-graphite-800 px-3 pt-3 text-xs text-text-muted">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">NEW</span>
        {t.nav.newEngine}
      </div>
    </div>
  );
}

function SongsChip() {
  const { t, plural, fill } = useI18n();
  const { balance, me } = useCredits();
  const pass = readPass((me as unknown as { studio_pass?: unknown } | null)?.studio_pass);
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const low = balance <= LOW_BALANCE;

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="gap-1.5">
        <Zap className="text-amber-400" />
        <span className="font-mono text-xs">{plural(balance, t.songs.count)}</span>
        {low && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label={t.songs.lowBalance} />}
      </Button>
      {open && (
        <div className="surface absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-graphite-700 bg-graphite-900/95 p-4 shadow-xl backdrop-blur">
          <p className="display text-3xl text-text-primary">{plural(balance, t.songs.count)}</p>
          {low && <p className="mt-0.5 text-xs text-amber-400">{t.songs.lowBalance}</p>}
          {pass?.active && (
            <p className="mt-2 font-mono text-[11px] text-text-muted">
              {t.nav.passActive}
              {pass.renewsAt ? ` · ${fill(t.account.passRenews, { date: new Date(pass.renewsAt).toLocaleDateString() })}` : ""}
            </p>
          )}
          <Link
            href="/pricing"
            prefetch={false}
            onClick={() => setOpen(false)}
            className={buttonStyles({ variant: "accent", size: "sm", className: "mt-3 w-full" })}
          >
            {t.nav.getMore}
          </Link>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { t } = useI18n();
  const { me, refresh } = useCredits();
  const { config } = useStudioConfig();
  const pass = readPass((me as unknown as { studio_pass?: unknown } | null)?.studio_pass);
  const [open, setOpen] = useState(false);
  const ref = useClickAway(open, () => setOpen(false));
  const initial = (me?.email ?? "?").charAt(0).toUpperCase();

  const links = [
    { href: "/account", label: t.nav.account, show: true },
    { href: "/account#library", label: t.nav.library, show: config.library.enabled },
    { href: "/account#pass", label: t.nav.pass, show: !!pass?.available || !!pass?.active },
    { href: "/pricing", label: t.nav.buySongs, show: true },
    { href: "/account#invite", label: t.nav.invite, show: config.referral.enabled },
    { href: "/account#email", label: t.nav.emailSettings, show: true },
  ].filter((l) => l.show);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t.nav.account}
        className="flex items-center gap-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-graphite-600 bg-graphite-800 text-sm text-text-primary">
          {initial}
        </span>
        {pass?.active && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">PASS</span>}
      </button>
      {open && (
        <div className="surface absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-graphite-700 bg-graphite-900/95 p-1 shadow-xl backdrop-blur">
          <p className="truncate px-3 py-2 font-mono text-[11px] text-text-muted">{me?.email}</p>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-text-body transition-colors hover:bg-graphite-800 hover:text-text-primary"
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut().then(() => refresh({ reset: true }));
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-text-muted transition-colors hover:bg-graphite-800 hover:text-text-primary"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t.nav.signOut}
          </button>
        </div>
      )}
    </div>
  );
}

export function StudioNav() {
  const { t } = useI18n();
  const { me, balance, freeRemaining } = useCredits();
  const signedIn = !!me?.authenticated;
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const menuRef = useClickAway(menu, () => setMenu(false));
  const close = () => {
    setMenu(false);
    setMobile(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-graphite-800 bg-graphite-950/85 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Wordmark />

        <div ref={menuRef} className="relative hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
            {t.nav.studio}
            <ChevronDown className={cn("transition-transform", menu && "rotate-180")} />
          </Button>
          <Link href="/pricing" prefetch={false} className={buttonStyles({ variant: "ghost", size: "sm" })}>
            {t.nav.pricing}
          </Link>
          <Link href="/guides" prefetch={false} className={buttonStyles({ variant: "ghost", size: "sm" })}>
            {t.nav.guides}
          </Link>
          {menu && (
            <div className="absolute left-1/2 top-full mt-3 w-[min(46rem,92vw)] -translate-x-1/2">
              <StudioMenu onPick={close} />
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          {(signedIn || balance > 0) && <SongsChip />}
          {!signedIn && balance === 0 && freeRemaining > 0 && (
            <span className="font-mono text-[11px] text-teal-400">{t.nav.freeSong}</span>
          )}
          {signedIn ? (
            <AccountMenu />
          ) : (
            <Link href="/account" prefetch={false} className={buttonStyles({ variant: "ghost", size: "sm" })}>
              {t.nav.signIn}
            </Link>
          )}
          <Link href="/pricing" prefetch={false} className={buttonStyles({ variant: "accent", size: "sm" })}>
            {t.nav.getStudio}
          </Link>
        </div>

        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t.nav.menu} onClick={() => setMobile(true)}>
          <Menu />
        </Button>
      </nav>

      {mobile && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-graphite-950 md:hidden" role="dialog" aria-modal="true" aria-label={t.nav.menu}>
          <div className="flex h-14 items-center justify-between border-b border-graphite-800 px-4">
            <Wordmark />
            <Button variant="ghost" size="icon" aria-label={t.unlock.close} onClick={() => setMobile(false)}>
              <X />
            </Button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
            {STUDIO_MENU.map((group) => (
              <div key={group.key}>
                <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">{t.nav[group.key]}</p>
                {group.items.map((item) => (
                  <MenuItemLink key={item.key} item={item} onPick={close} />
                ))}
              </div>
            ))}
            <div className="space-y-1 border-t border-graphite-800 px-1 pt-4">
              {[
                { href: "/pricing", label: t.nav.pricing },
                { href: "/guides", label: t.nav.guides },
                { href: "/account", label: signedIn ? t.nav.account : t.nav.signIn },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  prefetch={false}
                  onClick={close}
                  className="block rounded-md px-3 py-2.5 text-text-body hover:bg-graphite-800 hover:text-text-primary"
                >
                  {l.label}
                </Link>
              ))}
              <div className="px-2 pt-2">
                <LanguageSwitcher align="left" direction="up" />
              </div>
            </div>
          </div>
          <div className="border-t border-graphite-800 p-4">
            <Link href="/pricing" prefetch={false} onClick={close} className={buttonStyles({ variant: "accent", size: "lg", className: "w-full" })}>
              {t.nav.getStudio}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}