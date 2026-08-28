"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCreditsMe } from "@/lib/api/credits";
import type {
  CreditsMe,
  MeteredToolKey,
  PaywallFlags,
  RateLimitRule,
} from "@/lib/types/credits";

/**
 * THE COST-CONTROL DECISION IN THIS FILE
 *
 * `paywallEnabled` arrives as a PROP, resolved server-side in the root layout
 * from `GET /` via getFeatureFlags(), which Next caches for 60s and which
 * fails closed. It is NOT fetched from the browser.
 *
 * That matters because this provider wraps every page — ~90 of them, nearly
 * all static. Calling /credits/me on mount to find out whether the paywall is
 * even on would be one client request per page view, sitewide, for a feature
 * that is currently OFF. This codebase has already had a Vercel Edge Request
 * incident from exactly that shape of problem (navbar prefetching, see
 * Navbar.tsx), and repeating it to power a hidden feature would be hard to
 * defend.
 *
 * So: paywall off → zero client requests, ever. The provider still mounts and
 * still supplies a valid (inert) context, so no consumer needs a null check
 * and no component has to know why it's empty.
 *
 * ── THIS PASS: THREE FIXES ─────────────────────────────────────────────
 *
 * 1. `refresh` IS NOW STABLE. It used to close over `me` (for the in-flight
 *    early return), so it got a new identity on every balance change. Every
 *    consumer that lists it in useCallback/useEffect deps therefore re-ran on
 *    every refetch. That was not cosmetic: /checkout/success has a poll
 *    effect keyed on a callback that depends on `refresh`, so each refetch
 *    restarted the poll AND reset its baseline balance and its 60-second
 *    deadline — meaning the "balance went up" comparison could never fire and
 *    the timeout state was unreachable. It now returns the in-flight promise
 *    from a ref and depends on `enabled` alone.
 *
 * 2. A FAILED REFETCH NO LONGER WIPES THE BALANCE. getCreditsMe() returns
 *    null on failure by design ("treat as paywall off"), and this used to
 *    write that null straight into state — so one flaky refocus refetch made
 *    a paying customer's credits vanish from the navbar until the next
 *    successful call. Null is now ignored and the last good value stands.
 *
 * 3. DEFENSIVE READS ON `rate_limit` AND `paywall`. These were dotted into
 *    without optional chaining. A payload missing either key threw inside a
 *    useMemo in a provider that wraps the entire site, which is a blank page
 *    on every route rather than one broken pill.
 */

interface CreditContextValue {
  /** Server-resolved. When false, everything below is inert. */
  enabled: boolean;
  /** Null while loading, or whenever the paywall is off. */
  me: CreditsMe | null;
  loading: boolean;
  /** Refetch after a purchase, an upgrade, a login, or a logout. */
  refresh: () => Promise<CreditsMe | null>;
  /** Optimistically overwrite after a route hands back fresh billing data. */
  applyBalance: (balance: number, freeRemaining?: number) => void;

  /* Derived conveniences — read in enough places that recomputing them per
     component invites drift. */
  balance: number;
  freeRemaining: number;
  heldCredits: number;
  /** True when this specific tool is metered right now. */
  isToolMetered: (tool: MeteredToolKey) => boolean;
  /** The rate limit that will actually apply to THIS visitor for this tool. */
  rateLimitFor: (tool: MeteredToolKey) => RateLimitRule | null;
  /** True when the visitor holds credits, so the credited tier applies. */
  isCredited: boolean;
}

const InertContext: CreditContextValue = {
  enabled: false,
  me: null,
  loading: false,
  refresh: async () => null,
  applyBalance: () => {},
  balance: 0,
  freeRemaining: 0,
  heldCredits: 0,
  isToolMetered: () => false,
  rateLimitFor: () => null,
  isCredited: false,
};

const CreditContext = createContext<CreditContextValue>(InertContext);

export function useCredits(): CreditContextValue {
  return useContext(CreditContext);
}

/**
 * Refocus revalidation is throttled rather than fired on every focus event.
 * Tab-switching is constant during a purchase flow (site → Ko-fi → site), and
 * an unthrottled refetch would hammer /credits/me at exactly the moment the
 * user is most likely to be watching it change. 20s is short enough that a
 * balance change is noticed almost immediately, long enough that alt-tabbing
 * costs nothing.
 */
const REFOCUS_THROTTLE_MS = 20_000;

/**
 * MODULE SCOPE, DELIBERATELY — these outlive any single mount.
 *
 * The throttle used to be a `useRef(0)`, and a ref is reborn empty on every
 * mount. So the 20-second window only ever applied WITHIN one provider
 * instance: every fresh page load started with an empty throttle and fired
 * /credits/me immediately, and SiteChrome mounts a second provider on /admin
 * routes with its own refs again. Request logs showed hits one second apart,
 * which no per-instance 20s throttle can produce.
 *
 * At module scope the window survives remounts inside a tab, and `cachedMe`
 * lets a remount paint the balance it already knows instead of flashing empty
 * while it refetches.
 *
 * SAFE UNDER SSR: this is a "use client" module, so the server evaluates it
 * but only ever reads these — `refresh()` runs from an effect, which is
 * client-only. Nothing a server render produces can leak one visitor's
 * balance into another's HTML.
 */
let lastFetchedAt = 0;
let cachedMe: CreditsMe | null = null;

export function CreditProvider({
  flags,
  children,
}: {
  flags: PaywallFlags;
  children: React.ReactNode;
}) {
  const enabled = flags.paywallEnabled;

  // Seeded from the module cache so a remount within the window renders the
  // known balance immediately rather than blanking the navbar pill.
  const [me, setMe] = useState<CreditsMe | null>(cachedMe);
  const [loading, setLoading] = useState(enabled && cachedMe === null);
  const mounted = useRef(true);
  /**
   * The in-flight request itself, not a boolean. A second caller during a
   * request used to get back the CURRENT `me` — so `await refresh()` right
   * after a logout could resolve to the pre-logout account. Returning the
   * promise means every caller awaits the same real answer, and it's what
   * lets this callback stop depending on `me`.
   */
  const pending = useRef<Promise<CreditsMe | null> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<CreditsMe | null> => {
    if (!enabled) return null;
    if (pending.current) return pending.current;

    const request = (async () => {
      try {
        const next = await getCreditsMe();
        lastFetchedAt = Date.now();
        if (next) cachedMe = next;
        if (mounted.current) {
          // getCreditsMe() returns null on failure, meaning "treat as paywall
          // off" — NOT "the balance is now nothing". Writing that null into
          // state made a paying customer's credits disappear on any transient
          // network error. Keep the last good value instead.
          if (next) setMe(next);
          setLoading(false);
        }
        return next;
      } finally {
        pending.current = null;
      }
    })();

    pending.current = request;
    return request;
  }, [enabled]);

  // Initial load. Guarded on `enabled`, which is the whole point of the file.
  //
  // The disabled branch deliberately does NOT reset state. `me` starts null
  // and `loading` starts as `enabled`, so the off case is already correct from
  // first render — and if the flag ever flipped true→false mid-session, the
  // memo below returns InertContext regardless, so a stale `me` is
  // unreachable. Resetting here would be a synchronous setState in an effect,
  // which the React compiler lint correctly rejects.
  useEffect(() => {
    if (!enabled) return;
    // A remount inside the window already has the answer. This is the check
    // that turns "one request per page view" into "one request per 20s of
    // browsing", which on a site of ~90 static pages is most of the traffic
    // this endpoint sees.
    if (cachedMe && Date.now() - lastFetchedAt < REFOCUS_THROTTLE_MS) return;
    void refresh();
  }, [enabled, refresh]);

  // Revalidate when the user comes back to the tab. This is what makes credits
  // appear "automatically" after a Ko-fi purchase completes — by the time
  // they're looking at the page again, the pending_claims match has usually
  // landed.
  useEffect(() => {
    if (!enabled) return;

    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchedAt < REFOCUS_THROTTLE_MS) return;
      void refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [enabled, refresh]);

  /**
   * Routes that charge hand back fresh billing data in their own response
   * (`billing: {charged, balance, free_remaining}`). Using it directly avoids
   * a redundant /credits/me round-trip at the exact moment the user is
   * watching the number, which would otherwise show a stale balance for a beat
   * and then jump.
   */
  const applyBalance = useCallback((balance: number, freeRemaining?: number) => {
    setMe((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        balance,
        free_remaining: freeRemaining ?? prev.free_remaining,
      };
      // Keep the module cache in step. Without this a remount inside the
      // throttle window would restore the PRE-charge balance from cache and
      // silently undo the number the user just watched go down.
      cachedMe = next;
      return next;
    });
  }, []);

  const value = useMemo<CreditContextValue>(() => {
    if (!enabled) return InertContext;

    return {
      enabled: true,
      me,
      loading,
      refresh,
      applyBalance,
      balance: me?.balance ?? 0,
      freeRemaining: me?.free_remaining ?? 0,
      heldCredits: me?.held_credits ?? 0,
      isCredited: me?.rate_limit?.tier === "credited",
      // `paywall.tools[k].enabled` is the EFFECTIVE state — global AND
      // per-tool, already resolved server-side. Do not AND it with
      // `paywall.enabled` again here; that's how a tool ends up looking free
      // because two sources of truth disagreed.
      isToolMetered: (tool) => Boolean(me?.paywall?.tools?.[tool]?.enabled),
      rateLimitFor: (tool) => me?.rate_limit?.tools?.[tool] ?? null,
    };
  }, [enabled, me, loading, refresh, applyBalance]);

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>;
}