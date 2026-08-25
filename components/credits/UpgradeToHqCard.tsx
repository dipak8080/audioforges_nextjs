"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getUpgradeInfo, upgradeToHq, type UpgradeFamily } from "@/lib/api/credits";
import { useCredits } from "./CreditProvider";
import { useCreditGate } from "./useCreditGate";
import { trackCredits } from "@/lib/analytics";
import type { UpgradeInfo } from "@/lib/types/credits";

/**
 * THE CONVERSION SURFACE.
 *
 * Everything else in this system is plumbing for this component.
 *
 * WHY IT GOES UNDER THE VOCALS PLAYER, NOT IN A BANNER AT THE TOP
 *
 * The pitch for Studio Quality is not copy — it's the artifact the user
 * can hear in their own track, right now, in the stem they just played.
 * Standard separation leaves audible bleed on vocals. A person who has
 * just listened to it does not need to be told the better model is
 * better; they need to be told they can have it in one click without
 * re-uploading anything.
 *
 * That is the entire reason the backend keeps the source file for two
 * hours and exposes an upgrade route. A banner above the result, before
 * they've listened, is the same offer at the moment of least intent.
 *
 * WHAT THIS COMPONENT NEVER DOES
 *
 * It never renders when the server says ineligible. Ten `reason` values
 * come back and every one of them means "don't ask" — expired input,
 * over the 6-minute cap, paywall off, tool not metered, already
 * upgraded. A CTA that appears and then fails is worse than no CTA, so
 * eligibility is the server's call and the card is silent by default.
 *
 * It also never appears while the paywall is off. During metering-only,
 * `/separate/upgrade/` would run HQ for free, and free GPU-heavy runs for
 * anyone who clicks twice is a real cost. The server returns
 * `paywall_disabled` and this stays hidden — so there's also no free
 * upgrade path to take away from users later.
 */

/** Below this, the source file's remaining life is worth stating. */
const EXPIRY_NOTICE_THRESHOLD_MS = 30 * 60_000;

export function UpgradeToHqCard({
  family,
  jobId,
  onUpgraded,
}: {
  family: UpgradeFamily;
  jobId: string;
  /** Hand the NEW job id back so the form polls it with its existing loop. */
  onUpgraded: (newJobId: string) => void;
}) {
  const { enabled, applyBalance, refresh } = useCredits();
  const { catchCreditError, gate } = useCreditGate();

  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ticking clock. Kept in state rather than calling Date.now() at render
  // time: render must be pure, and an impure clock read makes the
  // countdown shift on any unrelated re-render. 0 means "not yet ticked",
  // which is only true for the first frame.
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const next = await getUpgradeInfo(family, jobId);
      if (cancelled) return;
      setInfo(next);
      if (next?.eligible) {
        trackCredits("credits_upgrade_offered", {
          tool: next.tool,
          will_use: next.will_use,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, family, jobId]);

  /**
   * The source file is swept at its 2h TTL. `input_expires_at` lets us
   * hide the button at exactly the right moment instead of polling, or
   * worse, letting someone click a button that will 410 — which after a
   * successful free run reads as the product breaking.
   */
  useEffect(() => {
    if (!info?.eligible) return;

    const tick = () => setNow(Date.now());
    // First tick via a 0ms timeout rather than calling setNow() directly
    // in the effect body — a synchronous setState there triggers a
    // cascading render and the React compiler lint rejects it.
    const first = setTimeout(tick, 0);
    // 30s is fine: the only thing this drives is a minutes-remaining
    // notice and the moment the button disappears.
    const interval = setInterval(tick, 30_000);

    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [info]);

  const handleUpgrade = useCallback(async () => {
    if (submitting || !info?.eligible) return;

    setSubmitting(true);
    setError(null);
    trackCredits("credits_upgrade_clicked", { tool: info.tool, will_use: info.will_use });

    try {
      const res = await upgradeToHq(family, jobId);

      if (res.billing) {
        trackCredits("credits_upgrade_charged", {
          tool: info.tool,
          charged: res.billing.charged,
        });
        // Use the balance the route just returned rather than refetching.
        // The number is on screen in the navbar and the user is watching
        // it — a round trip would show a stale value for a beat, then jump.
        applyBalance(res.billing.balance, res.billing.free_remaining);
      } else {
        // already_upgraded — a 200, not an error. The server is idempotent
        // per source job, so a double-click hands back the first call's
        // child instead of charging twice. Nothing to bill, so just resync.
        void refresh();
      }

      onUpgraded(res.job_id);
    } catch (err) {
      // 402 opens the gate rather than rendering an error. Out of credits
      // is a decision point, not a failure.
      if (catchCreditError(err)) {
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
      setError(
        err instanceof Error
          ? err.message
          : "That didn't go through. Nothing was charged — please try again."
      );
    }
  }, [
    submitting,
    info,
    family,
    jobId,
    applyBalance,
    refresh,
    onUpgraded,
    catchCreditError,
  ]);

  // All derived from `now`, so this stays a pure render.
  const deadline = info?.eligible ? Date.parse(info.input_expires_at) : Number.NaN;
  const remainingMs = deadline - now;
  const expired = now > 0 && !Number.isNaN(deadline) && remainingMs <= 0;

  if (!enabled || !info?.eligible || expired) return null;

  const showExpiry =
    now > 0 &&
    !Number.isNaN(remainingMs) &&
    remainingMs > 0 &&
    remainingMs < EXPIRY_NOTICE_THRESHOLD_MS;
  const remainingMinutes = Math.max(1, Math.round(remainingMs / 60_000));

  const isFree = info.will_use === "free";

  return (
    <>
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-4">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1">
            {/*
              Names the thing they can hear. "Upgrade to HQ" describes a
              transaction; "hear it cleaner" describes the result, and the
              result is what they were just listening to.
            */}
            <p className="text-sm font-medium text-text-primary">
              Hear this cleaner
            </p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Studio Quality runs a heavier model on the same file — noticeably
              less bleed between the stems. No re-upload, no waiting for another
              conversion.
            </p>

            {showExpiry && (
              /*
                Stated because it's true, not to pressure. The source file
                really is deleted on a 2h TTL, and someone who leaves the
                tab open should know the one-click path has a deadline
                before it silently disappears.
              */
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-subtle">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                One-click re-run available for another {remainingMinutes} min
              </p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-red-400">
            {error}
          </p>
        )}

        <Button
          variant="primary"
          size="md"
          loading={submitting}
          onClick={handleUpgrade}
          className="mt-3.5 w-full"
        >
          {submitting
            ? "Starting Studio Quality…"
            : isFree
              ? "Run at Studio Quality — free"
              : "Run at Studio Quality — 1 credit"}
        </Button>

        {isFree && (
          <p className="mt-2 text-center text-[11px] text-text-subtle">
            Uses one of your {info.free_remaining} free runs this month
          </p>
        )}
      </div>

      {gate}
    </>
  );
}