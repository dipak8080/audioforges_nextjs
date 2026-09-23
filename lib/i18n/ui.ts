/** Small UI strings shared by the localized pages and the widgets they render. */
export interface UiStrings {
  perMinute: string;
  perMinutes: string;
  perHour: string;
  perHours: string;
  perDay: string;
  perDays: string;
  alwaysFree: string;
  freeLeft: string;
  credit: string;
  credits: string;
  faqTitle: string;
  updated: string;
  whoBuilds: string;
  englishVersion: string;
}

const EN: UiStrings = {
  perMinute: "per minute",
  perMinutes: "per {n} minutes",
  perHour: "per hour",
  perHours: "per {n} hours",
  perDay: "per day",
  perDays: "per {n} days",
  alwaysFree: "always free",
  freeLeft: "free left",
  credit: "credit",
  credits: "credits",
  faqTitle: "Frequently asked questions",
  updated: "Updated",
  whoBuilds: "Who builds this",
  englishVersion: "English version",
};

const UI: Record<string, UiStrings> = {
  en: EN,
  pt: {
    perMinute: "por minuto",
    perMinutes: "a cada {n} minutos",
    perHour: "por hora",
    perHours: "a cada {n} horas",
    perDay: "por dia",
    perDays: "a cada {n} dias",
    alwaysFree: "sempre grátis",
    freeLeft: "grátis restantes",
    credit: "crédito",
    credits: "créditos",
    faqTitle: "Perguntas frequentes",
    updated: "Atualizado em",
    whoBuilds: "Quem faz isto",
    englishVersion: "Versão em inglês",
  },
  es: {
    perMinute: "por minuto",
    perMinutes: "cada {n} minutos",
    perHour: "por hora",
    perHours: "cada {n} horas",
    perDay: "por día",
    perDays: "cada {n} días",
    alwaysFree: "siempre gratis",
    freeLeft: "gratis restantes",
    credit: "crédito",
    credits: "créditos",
    faqTitle: "Preguntas frecuentes",
    updated: "Actualizado el",
    whoBuilds: "Quién hace esto",
    englishVersion: "Versión en inglés",
  },
  id: {
    perMinute: "per menit",
    perMinutes: "per {n} menit",
    perHour: "per jam",
    perHours: "per {n} jam",
    perDay: "per hari",
    perDays: "per {n} hari",
    alwaysFree: "selalu gratis",
    freeLeft: "gratis tersisa",
    credit: "kredit",
    credits: "kredit",
    faqTitle: "Pertanyaan umum",
    updated: "Diperbarui",
    whoBuilds: "Siapa pembuatnya",
    englishVersion: "Versi bahasa Inggris",
  },
};

export function uiStrings(locale?: string): UiStrings {
  return (locale && UI[locale]) || EN;
}

/**
 * Rewrites the English window words in a limit label ("10 per hour, 15 per
 * day") into the page locale. Limit labels come from several helpers, so this
 * runs on the finished string rather than inside each one.
 */
export function localizeLimit(label: string, locale?: string): string {
  if (!locale || locale === "en" || !UI[locale]) return label;
  const t = UI[locale];
  return label
    .replace(/per (\d+) (?:minutes|min)\b/g, (_, n) => t.perMinutes.replace("{n}", n))
    .replace(/per (\d+) (?:hours|hr)\b/g, (_, n) => t.perHours.replace("{n}", n))
    .replace(/per (\d+) days\b/g, (_, n) => t.perDays.replace("{n}", n))
    .replace(/per (?:minute|min)\b/g, t.perMinute)
    .replace(/per hour\b/g, t.perHour)
    .replace(/per day\b/g, t.perDay);
}