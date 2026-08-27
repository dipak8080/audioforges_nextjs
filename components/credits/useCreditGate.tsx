"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreditGateModal } from "./CreditGateModal";
import { useCredits } from "./CreditProvider";
import { isInsufficientCredits } from "@/lib/api/credits";
import type { InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * The whole per-form cost of the paywall.
 *
 * Four separation forms need identical behaviour: catch a 402, open the gate,
 * don't render a scary red error card for something that isn't an error. Doing
 * that inline in each form would be four copies of the same logic drifting
 * apart — and the fourth one would be the one that forgets to reset the busy
 * state, leaving a permanent spinner.
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
 * machine. This hook knows nothing about `status`, `uploading`, or cooldowns,
 * and shouldn't — it only answers "was this a credits problem, and did I handle
 * it?"
 *
 * ── THE DEAD END THIS PASS CLOSES ──────────────────────────────────────
 *
 * The gate handled the 402 and then dropped the user. They bought credits, the
 * modal closed, and they were returned to a form sitting at idle with their
 * file still attached and no indication that the thing they were trying to do
 * is now possible. The most motivated user in the funnel — one who has just
 * paid, mid-task — had to work out for themselves that they should press the
 * button again.
 *
 * `onCredited` is the fix, and it is OPT-IN and fires ON CLOSE, not on
 * purchase. Both of those matter:
 *
 *  - opt-in, because auto-spending a credit the user bought four seconds ago is
 *    something a form should choose deliberately, not inherit from a hook;
 *  - on close, because firing the moment the balance rises would start a run
 *    behind a modal the user is still reading.
 *
 * The baseline comes from the 402 payload — the server's own number at the
 * moment it refused — rather than from provider state, which may not have
 * caught up yet.
 */
export function useCreditGate(options?: {
  /**
   * Called once, after the gate closes, if the balance rose while it was open.
   * Wire it to a re-submit when the form can safely repeat the action:
   *
   *   const { catchCreditError, gate } = useCreditGate({
   *     onCredited: () => void handleSubmit(),
   *   });
   */
  onCredited?: () => void;
}) {
  const { balance } = useCredits();
  const [payload, setPayload] = useState<InsufficientCreditsPayload | null>(null);

  /** Balance the server reported when it refused. Null when the gate is shut. */
  const baseline = useRef<number | null>(null);
  const purchased = useRef(false);
  // Read through a ref so a caller passing an inline arrow doesn't change this
  // hook's behaviour on every render.
  const onCredited = useRef(options?.onCredited);
  onCredited.current = options?.onCredited;

  /**
   * Returns true when the error was an insufficient-credits 402 and the gate
   * has been opened. Returns false for everything else, so the caller's
   * existing error handling runs unchanged.
   */
  const catchCreditError = useCallback((err: unknown): boolean => {
    if (!isInsufficientCredits(err) || !err.insufficientCredits) return false;
    baseline.current = err.insufficientCredits.balance;
    purchased.current = false;
    setPayload(err.insufficientCredits);
    return true;
  }, []);

  // Watch, but don't act. Acting happens on close.
  useEffect(() => {
    if (!payload || baseline.current === null) return;
    if (balance > baseline.current) purchased.current = true;
  }, [balance, payload]);

  const close = useCallback(() => {
    setPayload(null);
    baseline.current = null;
    if (purchased.current) {
      purchased.current = false;
      onCredited.current?.();
    }
  }, []);

  const gate = payload ? (
    <CreditGateModal payload={payload} open onClose={close} />
  ) : null;

  return { catchCreditError, gate };
}