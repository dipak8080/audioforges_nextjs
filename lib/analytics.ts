/**
 * Thin typed wrapper over the gtag that app/layout.tsx already loads
 * (G-4MW6XTR9XM). No new dependency, no new script, no consent surface
 * that doesn't already exist.
 *
 * Why this file exists at all: once the paywall is live, the only
 * question that matters is "how many people saw the gate and didn't buy",
 * and that is unanswerable after the fact. The funnel below is the
 * minimum set of events that makes it answerable.
 *
 * Every call is a no-op when gtag hasn't loaded (ad blocker, SSR, a
 * consent tool that defers it), so no call site needs to guard.
 */

type GtagFn = (command: "event", name: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

/**
 * The credits funnel, in order. Keeping these as a union rather than
 * free-form strings means a typo is a build error instead of a silently
 * missing row in GA four weeks later.
 */
export type CreditsEvent =
  /** Gate modal rendered. The denominator for everything below. */
  | "credits_gate_shown"
  /** A pack was clicked in the gate or on /pricing. */
  | "credits_pack_selected"
  /** Email submitted, claim recorded, about to redirect to Ko-fi. */
  | "credits_claim_submitted"
  /** Redirect to Ko-fi actually fired. */
  | "credits_checkout_started"
  /**
   * The browser blocked the Ko-fi tab, so the buyer had to press a second
   * link to get there. Worth a row of its own: it fires for in-app browsers
   * (Instagram, TikTok, Facebook), which is most social traffic, and it sits
   * between checkout_started and checkout_returned — so a gap between those
   * two is explained by this rather than by people changing their minds.
   */
  | "credits_checkout_popup_blocked"
  /** Landed back on /checkout/success. */
  | "credits_checkout_returned"
  /** Balance observed to increase after returning — the actual conversion. */
  | "credits_purchase_confirmed"
  /** Polling on /checkout/success hit its ceiling without a balance change. */
  | "credits_checkout_timeout"
  /** The upgrade-to-HQ CTA was rendered on a finished standard result. */
  | "credits_upgrade_offered"
  /** The upgrade CTA was clicked. */
  | "credits_upgrade_clicked"
  /** An upgrade completed and was charged. */
  | "credits_upgrade_charged"
  /** A free-tier run of a metered tool was consumed. */
  | "credits_free_run_used"
  /** A metered route rate-limited a free-tier caller. */
  | "credits_rate_limited"
  /** Magic link requested. */
  | "credits_magic_link_requested";

export function trackCredits(event: CreditsEvent, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event, params);
  } catch {
    // Analytics must never break a payment flow. Swallow deliberately.
  }
}