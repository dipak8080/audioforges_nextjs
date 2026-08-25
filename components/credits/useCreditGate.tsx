"use client";

import { useCallback, useState } from "react";
import { CreditGateModal } from "./CreditGateModal";
import { isInsufficientCredits } from "@/lib/api/credits";
import type { InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * The whole per-form cost of the paywall.
 *
 * Four separation forms need identical behaviour: catch a 402, open the
 * gate, don't render a scary red error card for something that isn't an
 * error. Doing that inline in each form would be four copies of the same
 * logic drifting apart — and the fourth one would be the one that
 * forgets to reset the busy state, leaving a permanent spinner.
 *
 * Usage in a form:
 *
 *   const { catchCreditError, gate } = useCreditGate();
 *
 *   } catch (err) {
 *     if (catchCreditError(err)) { setStatus("idle"); return; }
 *     ...existing error handling, untouched...
 *   }
 *
 *   {gate}
 *
 * That's it. Adding a fifth metered tool later is the same five lines.
 *
 * WHY IT RETURNS A BOOLEAN: the caller stays in charge of its own state
 * machine. This hook knows nothing about `status`, `uploading`, or
 * cooldowns, and shouldn't — it only answers "was this a credits
 * problem, and did I handle it?"
 */
export function useCreditGate() {
  const [payload, setPayload] = useState<InsufficientCreditsPayload | null>(null);

  /**
   * Returns true when the error was an insufficient-credits 402 and the
   * gate has been opened. Returns false for everything else, so the
   * caller's existing error handling runs unchanged.
   */
  const catchCreditError = useCallback((err: unknown): boolean => {
    if (!isInsufficientCredits(err) || !err.insufficientCredits) return false;
    setPayload(err.insufficientCredits);
    return true;
  }, []);

  const close = useCallback(() => setPayload(null), []);

  const gate = payload ? (
    <CreditGateModal payload={payload} open onClose={close} />
  ) : null;

  return { catchCreditError, gate };
}