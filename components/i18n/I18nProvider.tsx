"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/locales";
import type { StudioStrings } from "@/lib/i18n/studio/en";
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
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: strings,
      fill,
      plural: (n, forms) => plural(locale, n, forms),
      number: (n) => formatNumber(locale, n),
      usd: (v) => formatUsd(locale, v),
      cents: (v) => formatCents(locale, v),
    }),
    [locale, strings]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}