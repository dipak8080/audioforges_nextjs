"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { isPrivatePath, languagesForPath, type LanguageOption } from "@/lib/i18n/routes";
import { LOCALES, LOCALE_INFO } from "@/lib/i18n/locales";
import { setPreferredLocale } from "@/lib/i18n/preference";
import { useI18n } from "./I18nProvider";

export function LanguageSwitcher({
  align = "right",
  direction = "down",
  className,
}: {
  align?: "left" | "right";
  direction?: "up" | "down";
  className?: string;
}) {
  const pathname = usePathname() ?? "/";
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const priv = isPrivatePath(pathname);
  const options: LanguageOption[] = priv
    ? LOCALES.map((l) => ({ locale: l, label: LOCALE_INFO[l].label, href: pathname }))
    : languagesForPath(pathname);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (options.length < 2) return null;

  const itemClass = (on: boolean) =>
    cn(
      "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
      on ? "text-text-primary" : "text-text-body hover:bg-graphite-800 hover:text-text-primary"
    );

  const inner = (o: LanguageOption) => (
    <>
      <span>
        {o.label}
        {o.locale !== "en" && <span className="ml-2 text-xs text-text-subtle">{LOCALE_INFO[o.locale].english}</span>}
      </span>
      {o.locale === locale && <Check className="h-3.5 w-3.5 text-amber-400" />}
    </>
  );

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t.nav.language}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5 font-mono text-[11px] uppercase tracking-wider"
      >
        <Globe />
        {locale}
      </Button>
      {open && (
        <ul
          role="menu"
          className={cn(
            "surface absolute z-50 min-w-48 rounded-lg border border-graphite-700 bg-graphite-900/95 p-1 shadow-xl backdrop-blur",
            align === "right" ? "right-0" : "left-0",
            direction === "down" ? "top-full mt-2" : "bottom-full mb-2"
          )}
        >
          {options.map((o) => (
            <li key={o.locale} role="none">
              {priv ? (
                <button
                  type="button"
                  role="menuitem"
                  lang={o.locale}
                  className={itemClass(o.locale === locale)}
                  onClick={() => {
                    setPreferredLocale(o.locale);
                    setOpen(false);
                  }}
                >
                  {inner(o)}
                </button>
              ) : (
                <Link
                  role="menuitem"
                  href={o.href}
                  hrefLang={o.locale}
                  lang={o.locale}
                  prefetch={false}
                  onClick={() => {
                    setPreferredLocale(o.locale);
                    setOpen(false);
                  }}
                  className={itemClass(o.locale === locale)}
                >
                  {inner(o)}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}