export const LOCALES = ["en", "es", "pt", "id"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_INFO: Record<Locale, { label: string; english: string; intl: string; og: string }> = {
  en: { label: "English", english: "English", intl: "en-US", og: "en_US" },
  es: { label: "Español", english: "Spanish", intl: "es-ES", og: "es_ES" },
  pt: { label: "Português", english: "Portuguese", intl: "pt-BR", og: "pt_BR" },
  id: { label: "Bahasa Indonesia", english: "Indonesian", intl: "id-ID", og: "id_ID" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}