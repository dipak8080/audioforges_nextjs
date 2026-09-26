import type { Locale } from "../locales";
import en, { type StudioStrings } from "./en";
import es from "./es";
import pt from "./pt";
import id from "./id";

const DICTS: Record<Locale, StudioStrings> = { en, es, pt, id };

export function getStudioStrings(locale: Locale): StudioStrings {
  return DICTS[locale];
}

export type { StudioStrings };