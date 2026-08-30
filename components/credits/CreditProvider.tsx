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
 * FIXED IN AN EARLIER PASS, still true:
 *  1. `refresh` is stable — it returns the in-flight promise from a ref and
 *     depends on `enabled` alone, so consumers listing it in deps don't re-run
 *     on every balance change.
 *  2. A failed refetch doesn't wipe the balance. getCreditsMe() returns null on
 *     failure by design ("treat as paywall off"), and writing that into state
 *     made a paying customer's credits vanish on one flaky refocus.
 *  3. `rate_limit` and `paywall` are read defensively — a payload missing
 *     either key used to throw inside a useMemo in a provider that wraps the
 *     entire site, which is a blank page on every route.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE MODULE CACHE WAS READ DURING SERVER RENDER. `useState(cachedMe)`
 *    evaluates on the server too, and module scope on a server is shared by
 *    every request that process handles. The note below argued this was safe
 *    because nothing WRITES the cache server-side — which is true today and is
 *    a convention, not a guarantee. One future `await refresh()` in a server
 *    component, or a `applyBalance` call that isn't client-only, and one
 *    visitor's balance and email render into another visitor's HTML. The read
 *    is now gated on `typeof window`, so the guarantee is structural.
 *
 * 2. `applyBalance` SILENTLY DROPPED THE UPDATE WHEN `me` WAS NULL. It bails on
 *    `!prev`, which is the state during the very first /credits/me — and a
 *    metered submit can resolve before that does. The charge landed, the server
 *    reported the new balance, and the navbar kept showing nothing until some
 *    later refetch. It can't fabricate a whole CreditsMe from two numbers, so
 *    it asks for one instead.
 *
 * 3. SIGN-OUT LEFT THE PREVIOUS ACCOUNT IN THE MODULE CACHE. `refresh()` only
 *    overwrites `cachedMe` when the fetch succeeds — correct for a network
 *    blip, wrong immediately after a logout, where a failed refetch leaves the
 *    signed-out user's balance and email to be repainted by the next remount.
 *    On the shared machine this button exists for, that's the whole point of
 *    pressing it. `refresh({ reset: true })` clears the cache first.
 *
 *    CreditAccountPanel's sign-out should pass it:
 *        await refresh({ reset: true });
 *
 * 4. A THROWING FETCH REJECTED THE PROMISE. getCreditsMe() is documented to
 *    return null rather than throw, but `await refresh()` sat in a sign-out
 *    handler with no catch — so the day that contract slips, the button stops
 *    completing. It resolves to null now, like the function it wraps.
 */

interface CreditContextValue {
  /** Server-resolved. When false, everything below is inert. */
  enabled: boolean;
  /** Null while loading, or whenever the paywall is off. */
  me: CreditsMe | null;
  loading: boolean;
  /**
   * Refetch after a purchase, an upgrade, a login, or a logout.
   *
   * Pass `{ reset: true }` when the IDENTITY may have changed — logout, or a
   * magic link that signed a different account in. It drops the cross-mount
   * cache so a failed refetch can't repaint the previous account.
   */
  refresh: (options?: { reset?: boolean }) => Promise<CreditsMe | null>;
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
 * NOT READ DURING SERVER RENDER. On a server, module scope is shared by every
 * request the process handles, so a value written by one visitor is readable by
 * the next. Nothing writes these on the server today — but "nothing writes it"
 * is a convention, and the failure it protects against is one visitor's balance
 * and email rendering into another visitor's HTML. `readCache()` makes the
 * guarantee structural instead.
 */
let lastFetchedAt = 0;
let cachedMe: CreditsMe | null = null;

const isBrowser = () => typeof window !== "undefined";
const readCache = (): CreditsMe | null => (isBrowser() ? cachedMe : null);

export function CreditProvider({
  flags,
  children,
}: {
  flags: PaywallFlags;
  children: React.ReactNode;
}) {
  const enabled = flags.paywallEnabled;

  // Seeded from the module cache so a remount within the window renders the
  // known balance immediately rather than blanking the navbar pill. Lazy
  // initializers, so the browser check runs at mount rather than being
  // evaluated into the server's render output.
  const [me, setMe] = useState<CreditsMe | null>(() => readCache());
  const [loading, setLoading] = useState(() => enabled && readCache() === null);
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

  const refresh = useCallback(
    async (options?: { reset?: boolean }): Promise<CreditsMe | null> => {
      if (!enabled) return null;

      if (options?.reset) {
        // The identity may have changed. Drop the cross-mount cache BEFORE the
        // request, so even a failed refetch can't leave the previous account's
        // balance and email to be repainted on the next mount.
        cachedMe = null;
        lastFetchedAt = 0;
        if (mounted.current) setMe(null);
      }

      // A reset has to reach the server; joining an in-flight request that was
      // issued as the old identity would answer the wrong question.
      if (pending.current && !options?.reset) return pending.current;

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
        } catch {
          // Documented to return null rather than throw, but this promise is
          // awaited in a sign-out handler with no catch of its own — so the day
          // that contract slips, the button would stop completing. Resolve like
          // the function this wraps.
          if (mounted.current) setLoading(false);
          return null;
        } finally {
          pending.current = null;
        }
      })();

      pending.current = request;
      return request;
    },
    [enabled]
  );

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
  const applyBalance = useCallback(
    (balance: number, freeRemaining?: number) => {
      let hadPrevious = true;

      setMe((prev) => {
        if (!prev) {
          // First /credits/me hasn't landed yet — and a metered submit can
          // easily resolve before it does. Two numbers aren't a CreditsMe
          // (packs, rate_limit, paywall all live there), so this can't
          // synthesize one; dropping the update outright is what left the
          // navbar empty after a charge the server had already applied.
          hadPrevious = false;
          return prev;
        }
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

      // Outside the updater: a state updater must be pure, and asking for a
      // network request from inside one isn't.
      if (!hadPrevious) {
        lastFetchedAt = 0; // don't let the throttle swallow it
        void refresh();
      }
    },
    [refresh]
  );

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