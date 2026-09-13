"use client";

import { useMemo } from "react";
import { useCredits } from "@/components/credits/CreditProvider";
import type { ApiError } from "@/lib/api/railway";
import {
  SHARED_ALLOWANCES,
  findSharedAllowance,
  rateLimitLabel,
  sharedAllowanceLabel,
  type SharedAllowanceSpec,
} from "@/lib/data/rate-limits";

/**
 * The shared allowance for one separation route, and the copy that goes with
 * it.
 *
 * Four routes spend from one bucket over two windows, so every form that
 * submits to one of them needs the same three answers: what to show in the
 * picker, what to show in prose, and which cap a 429 just hit. Resolved here
 * once rather than four times.
 */
export interface SharedLimit {
  allowance: SharedAllowanceSpec | null;
  /** Shortest window only. For a picker slot where one figure has to fit. */
  shortLabel?: string;
  /** Every window, shortest first. For prose and FAQ answers. */
  fullLabel?: string;
  /** The 429 hint, naming the window that actually fired. */
  hintFor: (err: ApiError) => string;
}

const GENERIC_HINT = "Wait for the timer, then run it again.";

/**
 * Resolution order: this visitor's own numbers, then the server-rendered ones,
 * then the build-time table.
 *
 * `serverAllowance` is not a nicety. CreditProvider makes no request at all
 * while the paywall is off, so `sharedLimitFor` returns null in production
 * today and the prop is what the form actually renders from. Reading context
 * alone would show nothing. The standard pool is unmetered and tier
 * independent, so the /limits copy is equally correct.
 */
export function useSharedLimit(
  route: string,
  serverAllowance?: SharedAllowanceSpec | null
): SharedLimit {
  const { sharedLimitFor } = useCredits();
  const live = sharedLimitFor(route);

  return useMemo(() => {
    const allowance =
      live ?? serverAllowance ?? findSharedAllowance(SHARED_ALLOWANCES, route);

    if (!allowance) {
      return { allowance: null, hintFor: () => GENERIC_HINT };
    }

    const shortest = allowance.windows[0];
    const toolCount = allowance.routes.length;

    return {
      allowance,
      shortLabel: shortest
        ? rateLimitLabel(shortest.maxRequests, shortest.windowSeconds)
        : undefined,
      fullLabel: sharedAllowanceLabel(allowance),
      hintFor: (err: ApiError) => {
        const scope = `shared across all ${toolCount} separation tools`;

        // THE ERROR'S NUMBERS, NOT THE ALLOWANCE'S. The server is describing
        // the window it just enforced, so it is right even when `allowance` is
        // a stale build-time fallback. Reading the cap from the table instead
        // would put the old figure in the message the moment an operator
        // retunes one, which is the drift this whole path exists to remove.
        const max = err.limitMax;
        const window = err.limitWindowSeconds;

        // No numbers means the 429 came from outside this pool, or the message
        // shape changed. State the windows we know rather than guess at one:
        // naming the wrong cap is worse than naming neither.
        if (!max || !window) {
          return `The limit is ${sharedAllowanceLabel(allowance)}, ${scope}.`;
        }

        const label = rateLimitLabel(max, window);

        // A daily block is the one people cannot guess at. Say the window is a
        // day and that it frees up gradually, because "try again later" reads
        // as minutes and means hours here.
        if (window >= 86400) {
          return `That is the daily cap of ${label}, ${scope}. It frees up gradually as your earlier runs age out.`;
        }
        return `That is the ${label} limit, ${scope}.`;
      },
    };
  }, [live, serverAllowance, route]);
}