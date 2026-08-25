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
 * `paywallEnabled` arrives as a PROP, resolved server-side in the root
 * layout from `GET /` via getFeatureFlags(), which Next caches for 60s
 * and which fails closed. It is NOT fetched from the browser.
 *
 * That matters because this provider wraps every page on the site — ~90
 * of them, nearly all static. If it called /credits/me on mount to find
 * out whether the paywall was even on, that would be one client request
 * per page view, sitewide, for a feature that is currently OFF. This
 * codebase has already had a Vercel Edge Request consumption incident
 * caused by exactly that shape of problem (navbar prefetching, see
 * Navbar.tsx's header comment), and repeating it to power a hidden
 * feature would be hard to defend.
 *
 * So: paywall off → zero client requests, ever. The provider still
 * mounts and still supplies a valid (inert) context, so no consumer
 * needs a null check and no component has to know why it's empty.
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

  /* Derived conveniences — these are read in enough places that
     recomputing them per component invites drift. */
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
 * Refocus revalidation is throttled rather than fired on every focus
 * event. Tab-switching is constant during a purchase flow (site → Ko-fi →
 * site), and an unthrottled refetch would hammer /credits/me at exactly
 * the moment the user is most likely to be watching for it to change.
 * 20s is short enough that a balance change is noticed almost
 * immediately, long enough that alt-tabbing costs nothing.
 */
const REFOCUS_THROTTLE_MS = 20_000;

export function CreditProvider({
  flags,
  children,
}: {
  flags: PaywallFlags;
  children: React.ReactNode;
}) {
  const enabled = flags.paywallEnabled;

  const [me, setMe] = useState<CreditsMe | null>(null);
  const [loading, setLoading] = useState(enabled);
  const lastFetchedAt = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async (): Promise<CreditsMe | null> => {
    if (!enabled) return null;
    // A second caller during an in-flight request would double the load on
    // the one endpoint we're trying to keep cheap, and the loser's result
    // would just overwrite the winner's with the same data.
    if (inFlight.current) return me;

    inFlight.current = true;
    try {
      const next = await getCreditsMe();
      lastFetchedAt.current = Date.now();
      // The provider unmounts on navigation away in some layouts; setting
      // state after that is a React warning and a memory leak.
      if (mounted.current) {
        setMe(next);
        setLoading(false);
      }
      return next;
    } finally {
      inFlight.current = false;
    }
  }, [enabled, me]);

  // Initial load. Guarded on `enabled`, which is the whole point of the file.
  //
  // The disabled branch deliberately does NOT reset state. `me` starts null
  // and `loading` starts as `enabled`, so the off case is already correct
  // from first render — and if the flag ever flipped true→false mid-session,
  // the memo below returns InertContext regardless, so stale `me` is
  // unreachable. Resetting here would be a synchronous setState in an
  // effect, which the React compiler lint correctly rejects.
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    // `refresh` intentionally omitted: it closes over `me`, so including it
    // would re-run this effect on every balance change and refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Revalidate when the user comes back to the tab. This is what makes
  // credits appear "automatically" after a Ko-fi purchase completes in the
  // same tab — the pending_claims match has usually landed by the time
  // they're looking at the page again.
  useEffect(() => {
    if (!enabled) return;

    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetchedAt.current < REFOCUS_THROTTLE_MS) return;
      void refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /**
   * Routes that charge hand back fresh billing data in their own response
   * (`billing: {charged, balance, free_remaining}`). Using it directly
   * avoids a redundant /credits/me round-trip at the exact moment the user
   * is watching the number, which would otherwise show a stale balance for
   * a beat and then jump.
   */
  const applyBalance = useCallback((balance: number, freeRemaining?: number) => {
    setMe((prev) =>
      prev
        ? {
            ...prev,
            balance,
            free_remaining: freeRemaining ?? prev.free_remaining,
          }
        : prev
    );
  }, []);

  const value = useMemo<CreditContextValue>(() => {
    if (!enabled) return InertContext;

    const balance = me?.balance ?? 0;
    const isCredited = me?.rate_limit.tier === "credited";

    return {
      enabled: true,
      me,
      loading,
      refresh,
      applyBalance,
      balance,
      freeRemaining: me?.free_remaining ?? 0,
      heldCredits: me?.held_credits ?? 0,
      isCredited,
      // `paywall.tools[k].enabled` is the EFFECTIVE state — global AND
      // per-tool, already resolved server-side. Do not AND it with
      // `paywall.enabled` again here; that's how a tool ends up looking
      // free because two sources of truth disagreed.
      isToolMetered: (tool) => Boolean(me?.paywall.tools?.[tool]?.enabled),
      rateLimitFor: (tool) => me?.rate_limit.tools?.[tool] ?? null,
    };
  }, [enabled, me, loading, refresh, applyBalance]);

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>;
}