"use client";

import { useSyncExternalStore } from "react";
import { isLocale, type Locale } from "./locales";

const COOKIE = "af_lang";
let current: Locale | null | undefined;
const listeners = new Set<() => void>();

function read(): Locale | null {
  const m = document.cookie.match(/(?:^|;\s*)af_lang=([a-z]{2})/);
  return m && isLocale(m[1]) ? m[1] : null;
}

export function setPreferredLocale(locale: Locale) {
  document.cookie = `${COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  current = locale;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Locale | null {
  if (current === undefined) current = read();
  return current;
}

export function usePreferredLocale(): Locale | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}