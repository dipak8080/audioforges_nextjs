import { LOCALE_INFO, type Locale } from "./locales";

export type Plural = { one: string; other: string };

export function fill(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const pluralRules = new Map<Locale, Intl.PluralRules>();

export function plural(locale: Locale, n: number, forms: Plural): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_INFO[locale].intl);
    pluralRules.set(locale, rules);
  }
  const form = rules.select(n) === "one" ? forms.one : forms.other;
  return fill(form, { n: formatNumber(locale, n) });
}

export function formatNumber(locale: Locale, n: number): string {
  return new Intl.NumberFormat(LOCALE_INFO[locale].intl).format(n);
}

export function formatUsd(locale: Locale, usd: number): string {
  return new Intl.NumberFormat(LOCALE_INFO[locale].intl, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: usd % 1 === 0 ? 0 : 2,
  }).format(usd);
}

export function formatCents(locale: Locale, usd: number): string {
  const cents = Math.round(usd * 100);
  return locale === "en" ? `${cents}¢` : formatUsd(locale, cents / 100);
}