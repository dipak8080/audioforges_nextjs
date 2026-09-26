"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n/locales";
import type { StudioStrings } from "@/lib/i18n/studio/en";
import { loadStudioStrings } from "@/lib/i18n/studio/load";
import { usePreferredLocale } from "@/lib/i18n/preference";
import { isPrivatePath } from "@/lib/i18n/routes";
import { fill, formatCents, formatNumber, formatUsd, plural, type Plural } from "@/lib/i18n/format";

interface I18nValue {
  locale: Locale;
  t: StudioStrings;
  fill: typeof fill;
  plural: (n: number, forms: Plural) => string;
  number: (n: number) => string;
  usd: (usd: number) => string;
  cents: (usd: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  strings,
  children,
}: {
  locale: Locale;
  strings: StudioStrings;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const preferred = usePreferredLocale();
  const want: Locale = isPrivatePath(pathname) && preferred ? preferred : locale;
  const [loaded, setLoaded] = useState<{ locale: Locale; strings: StudioStrings } | null>(null);

  useEffect(() => {
    if (want === locale) return;
    let alive = true;
    void loadStudioStrings(want).then((s) => {
      if (alive) setLoaded({ locale: want, strings: s });
    });
    return () => {
      alive = false;
    };
  }, [want, locale]);

  const active = want !== locale && loaded?.locale === want ? loaded : { locale, strings };

  useEffect(() => {
    document.documentElement.lang = active.locale;
  }, [active.locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale: active.locale,
      t: active.strings,
      fill,
      plural: (n, forms) => plural(active.locale, n, forms),
      number: (n) => formatNumber(active.locale, n),
      usd: (v) => formatUsd(active.locale, v),
      cents: (v) => formatCents(active.locale, v),
    }),
    [active.locale, active.strings]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}