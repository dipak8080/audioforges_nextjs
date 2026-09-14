export const CONSENT_STORAGE_KEY = "af-consent-v1";
export const CONSENT_EVENT = "af:open-consent";
export const GEO_COOKIE = "af-geo";

export type ConsentChoice = "granted" | "denied";

type GtagConsentFn = (command: "consent", action: "update", params: Record<string, string>) => void;

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Fails closed: anything other than an explicit "0" means ask first.
export function requiresConsent(): boolean {
  return readCookie(GEO_COOKIE) !== "0";
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Private mode or blocked storage. The choice still applies to this
    // page view, it just will not survive a reload.
  }
}

export function applyConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  const value = choice === "granted" ? "granted" : "denied";
  const gtag = (window as unknown as { gtag?: GtagConsentFn }).gtag;
  try {
    gtag?.("consent", "update", {
      analytics_storage: value,
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
    });
  } catch {
    // An ad blocker removed gtag. Nothing to update.
  }
}

export function openConsentSettings(): void {
  window.dispatchEvent(new Event(CONSENT_EVENT));
}