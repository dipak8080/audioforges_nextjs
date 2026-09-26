"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { openConsentSettings } from "@/lib/consent";
import { FREE_TOOL_LINKS, STUDIO_MENU } from "@/lib/studio/nav";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}

const SOCIAL = [
  { href: "https://www.instagram.com/audioforges/", label: "AudioForges on Instagram", Icon: InstagramIcon },
  { href: "https://www.youtube.com/@audioforges", label: "AudioForges on YouTube", Icon: YoutubeIcon },
];

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <span className="h-3 w-[2px] rounded-full bg-amber-500" aria-hidden />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">{title}</p>
      </div>
      <nav aria-label={title} className="flex flex-col gap-2.5">
        {children}
      </nav>
    </div>
  );
}

function FLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="w-fit rounded text-sm text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/60"
    >
      {children}
    </Link>
  );
}

export function StudioFooter() {
  const { t } = useI18n();
  const f = t.footer;
  const n = t.nav;
  const year = new Date().getFullYear();
  const productName = (key: string) =>
    key === "forgeClean" ? "Forge Clean" : key === "forgeSplit" ? "Forge Split" : n[key as "vocalRemover"];

  return (
    <footer className="border-t border-graphite-800 bg-graphite-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link href="/" prefetch={false} className="inline-flex items-center gap-2">
              <BrandMark className="h-5 w-5 text-amber-500" />
              <span className="font-mono tracking-tight">
                <span className="font-normal text-text-body">Audio</span>
                <span className="font-semibold text-text-primary">Forges</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-text-muted">{t.brand.tagline}</p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIAL.map(({ href, label, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  aria-label={label}
                  title={label}
                  className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-graphite-800 text-text-muted transition-colors hover:border-amber-500/60 hover:text-amber-400"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            <Column title={f.product}>
              {STUDIO_MENU.flatMap((g) => g.items).map((item) => (
                <FLink key={item.key} href={item.href}>
                  {productName(item.key)}
                </FLink>
              ))}
              <FLink href="/pricing">{n.pricing}</FLink>
            </Column>

            <Column title={f.freeTools}>
              {FREE_TOOL_LINKS.map((l) => (
                <FLink key={l.href} href={l.href}>
                  {l.label}
                </FLink>
              ))}
              <FLink href="/tools">{f.allFreeTools}</FLink>
            </Column>

            <Column title={f.resources}>
              <FLink href="/guides">{n.guides}</FLink>
              <FLink href="/forge">{f.forgePlayers}</FLink>
              <FLink href="/camelot-wheel">{f.camelot}</FLink>
              <FLink href="/vocal-remover-comparison">{f.comparison}</FLink>
              <FLink href="/about">{f.about}</FLink>
              <FLink href="/contact">{f.contact}</FLink>
            </Column>

            <Column title={f.legal}>
              <FLink href="/privacy">{f.privacy}</FLink>
              <FLink href="/terms">{f.terms}</FLink>
              <FLink href="/refunds">{f.refunds}</FLink>
              <FLink href="/dmca">{f.dmca}</FLink>
              <button
                type="button"
                onClick={openConsentSettings}
                className="w-fit rounded text-left text-sm text-text-muted transition-colors hover:text-text-primary"
              >
                {f.cookies}
              </button>
            </Column>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-graphite-800 pt-6 text-xs text-text-subtle sm:flex-row">
          <p>© {year} AudioForges</p>
          <LanguageSwitcher direction="up" />
          <p>{f.builtBy}</p>
        </div>
      </div>
    </footer>
  );
}