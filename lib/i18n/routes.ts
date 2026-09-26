import { SITE_URL } from "@/lib/constants";
import { DEFAULT_LOCALE, LOCALES, LOCALE_INFO, type Locale } from "./locales";

type LocalizedPaths = { en: string } & Partial<Record<Exclude<Locale, "en">, string>>;

export const LOCALIZED_ROUTES = {
  vocalRemover: {
    en: "/vocal-remover",
    es: "/es/quitar-voz-de-una-cancion",
    pt: "/pt/remover-vocal",
    id: "/id/penghilang-vokal",
  },
} satisfies Record<string, LocalizedPaths>;

export type RouteKey = keyof typeof LOCALIZED_ROUTES;

const ROUTES: Record<string, LocalizedPaths> = LOCALIZED_ROUTES;

function clean(pathname: string): string {
  const p = pathname.split(/[?#]/)[0] || "/";
  return p.length > 1 ? p.replace(/\/+$/, "") : p;
}

export function localePath(key: RouteKey, locale: Locale): string | null {
  return ROUTES[key][locale] ?? null;
}

export function routeKeyForPath(pathname: string): RouteKey | null {
  const p = clean(pathname);
  for (const [key, paths] of Object.entries(ROUTES)) {
    if (Object.values(paths).includes(p)) return key as RouteKey;
  }
  return null;
}

export function localeForPath(pathname: string): Locale {
  const first = clean(pathname).split("/")[1];
  return LOCALES.find((l) => l !== DEFAULT_LOCALE && l === first) ?? DEFAULT_LOCALE;
}

export interface LanguageOption {
  locale: Locale;
  label: string;
  href: string;
}

export function languagesForPath(pathname: string): LanguageOption[] {
  const key = routeKeyForPath(pathname);
  if (!key) return [];
  return LOCALES.flatMap((locale) => {
    const href = ROUTES[key][locale];
    return href ? [{ locale, label: LOCALE_INFO[locale].label, href }] : [];
  });
}

export function alternatesFor(key: RouteKey): Record<string, string> {
  const paths = ROUTES[key];
  const entries = LOCALES.flatMap((l) => (paths[l] ? [[l, `${SITE_URL}${paths[l]}`]] : []));
  return Object.fromEntries([...entries, ["x-default", `${SITE_URL}${paths.en}`]]);
}
const PRIVATE_PATHS = ["/account"];

export function isPrivatePath(pathname: string): boolean {
  const p = clean(pathname);
  return PRIVATE_PATHS.some((x) => p === x || p.startsWith(`${x}/`));
}