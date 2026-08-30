"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getUpgradeInfo, upgradeToHq, type UpgradeFamily } from "@/lib/api/credits";
import { ApiError } from "@/lib/api/railway";
import { useCredits } from "./CreditProvider";
import { useCreditGate } from "./useCreditGate";
import { trackCredits } from "@/lib/analytics";
import type { UpgradeInfo } from "@/lib/types/credits";
import type { SubmitBilling } from "@/lib/types/converter";

/**
 * THE CONVERSION SURFACE.
 *
 * Everything else in this system is plumbing for this component.
 *
 * WHY IT GOES UNDER THE VOCALS PLAYER, NOT IN A BANNER AT THE TOP
 *
 * The pitch for Studio Quality is not copy — it's the artifact the user can
 * hear in their own track, right now, in the stem they just played. Standard
 * separation leaves audible bleed on vocals. A person who has just listened to
 * it does not need to be told the better model is better; they need to be told
 * they can have it in one click without re-uploading anything.
 *
 * That is the entire reason the backend keeps the source file for two hours and
 * exposes an upgrade route. A banner above the result, before they've listened,
 * is the same offer at the moment of least intent.
 *
 * WHAT THIS COMPONENT NEVER DOES
 *
 * It never renders when the server says ineligible. Ten `reason` values come
 * back and every one of them means "don't ask" — expired input, over the cap,
 * paywall off, tool not metered, already upgraded. A CTA that appears and then
 * fails is worse than no CTA, so eligibility is the server's call and the card
 * is silent by default.
 *
 * It also never appears while the paywall is off. During metering-only,
 * `/separate/upgrade/` would run HQ for free, and free GPU-heavy runs for
 * anyone who clicks twice is a real cost. The server returns `paywall_disabled`
 * and this stays hidden — so there's also no free upgrade path to take away
 * from users later.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. A DOUBLE-CLICK WIPED THE RECEIPT FOR THE CHARGE THAT DID HAPPEN.
 *    `already_upgraded` is a 200 with no billing block, and `res.billing ??
 *    null` turned that absence into an explicit null. The parent's guard is
 *    `if (billing !== undefined)`, so null passed it and overwrote the billing
 *    from the FIRST click: CreditReceipt went blank and SupportBlock came back
 *    on a run someone had just paid a credit for. `undefined` is the sentinel
 *    the guard was written for.
 *
 * 2. `submitting` WAS NEVER CLEARED ON SUCCESS. Every failure path resets it;
 *    the success path relied on all three callers flipping to "processing" and
 *    unmounting this card. That's a load-bearing assumption living in three
 *    other files, and the failure mode is a permanently spinning button on the
 *    component that takes money.
 *
 * KEPT FROM THE PREVIOUS PASS
 *
 * 3. THE EXPIRY CLOCK WAS OFF BY THE USER'S UTC OFFSET, AND IN NEPAL THAT
 *    HID THE CARD ENTIRELY. `Date.parse` treats an ISO string with no zone
 *    suffix as LOCAL time, and the backend sends naive UTC — the same trap the
 *    logs dashboard already carries a `parseTs` helper for. At UTC+5:45 a
 *    deadline two hours out parsed as three hours and forty-five minutes in the
 *    PAST, so `expired` was true on first tick and the highest-value component
 *    in the product returned null. It only looked like it worked at UTC+0 or
 *    behind it.
 *
 * 4. THE ERROR WAS A BARE RED LINE INSIDE AN AMBER BOX. Every other failure
 *    surface on the site is an icon, a statement and a next step; this one was
 *    a sentence in red with nothing marking it as different from the copy above
 *    it — on the one card where the user has just been told nothing was
 *    charged.
 *
 * 5. THE SUBMITTING LABEL FOUGHT THE SPINNER. `loading` already overlays a
 *    spinner on the existing label, so swapping the text to "Starting Studio
 *    Quality…" underneath it changed a string nobody can see, and made the
 *    button briefly wider on release.
 *
 *  · The billing block travels back with the new job id, so an upgraded run
 *    shows its Studio Quality tag and its receipt.
 *  · The eligibility fetch catches, rather than becoming an unhandled rejection
 *    that hides a real backend fault behind "the card just doesn't show up".
 *  · A 410 replaces the card instead of colouring it red.
 */

/** Below this, the source file's remaining life is worth stating. */
const EXPIRY_NOTICE_THRESHOLD_MS = 30 * 60_000;

/**
 * The backend writes naive UTC timestamps. `Date.parse` reads a date-time with
 * no offset as LOCAL time, so every user east of Greenwich saw a deadline
 * shifted into their own past — and this card hides itself once the deadline
 * passes. Same helper, same reason, as the one in the logs dashboard.
 */
function parseServerTime(iso: string): number {
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return Date.parse(hasZone ? iso : `${iso}Z`);
}

export function UpgradeToHqCard({
  family,
  jobId,
  onUpgraded,
}: {
  family: UpgradeFamily;
  jobId: string;
  /**
   * Hand the NEW job id back so the form polls it with its existing loop, and
   * the billing block so the finished result can show what it cost. The second
   * argument is what makes CreditReceipt and StudioQualityTag appear on an
   * upgraded job.
   */
  onUpgraded: (newJobId: string, billing?: SubmitBilling | null) => void;
}) {
  const { enabled, applyBalance, refresh } = useCredits();
  // Buying FROM this card and then having to find and press it again is the
  // same dead end the forms had. Routed through a ref because handleUpgrade is
  // declared below.
  const upgradeRef = useRef<() => void>(() => {});
  const { catchCreditError, gate } = useCreditGate({
    onCredited: () => upgradeRef.current(),
  });

  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The server said the source file is gone. Different from a failure. */
  const [sourceGone, setSourceGone] = useState(false);
  // Ticking clock. Kept in state rather than calling Date.now() at render time:
  // render must be pure, and an impure clock read makes the countdown shift on
  // any unrelated re-render. 0 means "not yet ticked", which is only true for
  // the first frame.
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const next = await getUpgradeInfo(family, jobId);
        if (cancelled) return;
        setInfo(next);
        if (next?.eligible) {
          trackCredits("credits_upgrade_offered", {
            tool: next.tool,
            will_use: next.will_use,
          });
        }
      } catch (err) {
        // Stay silent on screen — an upsell that can't confirm it's allowed
        // must not render — but do not swallow it into an unhandled rejection
        // either.
        if (!cancelled) console.error("Upgrade eligibility check failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, family, jobId]);

  /**
   * The source file is swept at its 2h TTL. `input_expires_at` lets us hide the
   * button at exactly the right moment instead of polling, or worse, letting
   * someone click a button that will 410 — which after a successful free run
   * reads as the product breaking.
   */
  useEffect(() => {
    if (!info?.eligible) return;

    const tick = () => setNow(Date.now());
    // First tick via a 0ms timeout rather than calling setNow() directly in the
    // effect body — a synchronous setState there triggers a cascading render
    // and the React compiler lint rejects it.
    const first = setTimeout(tick, 0);
    // 30s is fine: the only thing this drives is a minutes-remaining notice and
    // the moment the button disappears.
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
        // Use the balance the route just returned rather than refetching. The
        // number is on screen in the navbar and the user is watching it — a
        // round trip would show a stale value for a beat, then jump.
        applyBalance(res.billing.balance, res.billing.free_remaining);
      } else {
        // already_upgraded — a 200, not an error. The server is idempotent per
        // source job, so a double-click hands back the first call's child
        // instead of charging twice. Nothing to bill, so just resync.
        void refresh();
      }

      /*
        The billing block travels with the job id — without it the parent has no
        way to know this run was paid for.

        `undefined`, NOT null, when the route sends no block. That happens on
        `already_upgraded`, which is a 200: the server is idempotent per source
        job, so a double-click returns the first call's child rather than
        charging again. The parent's guard is `if (billing !== undefined)`, so
        null would pass it and erase the receipt from the click that DID spend a
        credit — blanking CreditReceipt and bringing the tip jar back on a paid
        run. undefined means "nothing to report, keep what you have".
      */
      onUpgraded(res.job_id, res.billing ?? undefined);
      // Callers currently unmount this card by switching to "processing", so
      // this is belt-and-braces — but "the parent will unmount me" is an
      // assumption living in three other files, and a spinning button that
      // never stops is a bad way to find out one of them changed.
      setSubmitting(false);
    } catch (err) {
      // 402 opens the gate rather than rendering an error. Out of credits is a
      // decision point, not a failure.
      if (catchCreditError(err)) {
        setSubmitting(false);
        return;
      }

      setSubmitting(false);

      // The source file was swept between render and click. Not a failure of
      // anything the user did, and the fix is a re-upload — so it replaces the
      // card rather than colouring it red.
      if (err instanceof ApiError && err.status === 410) {
        setSourceGone(true);
        return;
      }

      setError(
        err instanceof ApiError
          ? err.message
          : "That didn't go through. Nothing was charged — try again."
      );
    }
  }, [submitting, info, family, jobId, applyBalance, refresh, onUpgraded, catchCreditError]);

  // Synced after every render, so onCredited calls the CURRENT handleUpgrade.
  // In an effect rather than during render: a render-phase ref write is what
  // the React Compiler is free to skip, and the same note is on the notify refs
  // in the separation forms.
  useEffect(() => {
    upgradeRef.current = () => {
      void handleUpgrade();
    };
  });

  // All derived from `now`, so this stays a pure render.
  const deadline = info?.eligible ? parseServerTime(info.input_expires_at) : Number.NaN;
  const remainingMs = deadline - now;
  const expired = now > 0 && !Number.isNaN(deadline) && remainingMs <= 0;

  if (sourceGone) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-graphite-800 bg-graphite-850/40 px-3.5 py-3 text-xs leading-relaxed text-text-subtle">
        <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>
          The source file for this job has expired, so the one-click re-run is gone. Nothing was
          charged. Upload the track again to run it at Studio Quality.
        </span>
      </p>
    );
  }

  /**
   * The ONE ineligible reason worth surfacing.
   *
   * Standard separation accepts 10-minute inputs; Studio Quality caps lower. So
   * a long track separates fine and then the upgrade card renders nothing —
   * which looks like a missing feature rather than a documented limit, and
   * leaves the user wondering why the option they read about didn't appear.
   *
   * Every OTHER reason stays silent: expired input, paywall off, tool not
   * metered, already upgraded. Those are either self-evident or none of the
   * user's business, and a card that explains why it can't help you is worse
   * than no card.
   */
  if (enabled && info && !info.eligible && info.reason === "too_long_for_hq") {
    // Fallback only — the server sends max_seconds with the reason.
    const maxMinutes = info.max_seconds ? Math.floor(info.max_seconds / 60) : 10;
    return (
      <p className="flex items-start gap-2 rounded-xl border border-graphite-800 bg-graphite-850/40 px-3.5 py-3 text-xs leading-relaxed text-text-subtle">
        <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>
          Studio Quality supports tracks up to {maxMinutes} minutes. This one is longer, so the
          standard result above is the full-quality version available for it.
        </span>
      </p>
    );
  }

  if (!enabled || !info?.eligible || expired) return null;

  const showExpiry =
    now > 0 &&
    !Number.isNaN(remainingMs) &&
    remainingMs > 0 &&
    remainingMs < EXPIRY_NOTICE_THRESHOLD_MS;
  const remainingMinutes = Math.max(1, Math.round(remainingMs / 60_000));

  const isFree = info.will_use === "free";
  const freeLeft = info.free_remaining ?? 0;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/[0.05]">
        <div className="flex items-center justify-between border-b border-amber-500/15 px-4 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
            <Sparkles className="h-3 w-3" aria-hidden />
            Studio Quality
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
            {isFree ? "Free run" : "1 credit"}
          </span>
        </div>

        <div className="p-4">
          {/*
            Names the thing they can hear. "Upgrade to HQ" describes a
            transaction; "hear it cleaner" describes the result, and the result
            is what they were just listening to.
          */}
          <p className="text-sm font-medium text-text-primary">Hear this cleaner</p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            Runs a heavier model on the same file — noticeably less bleed between the stems. No
            re-upload, no waiting for another conversion.
          </p>

          {showExpiry && (
            /*
              Stated because it's true, not to pressure. The source file really
              is deleted on a 2h TTL, and someone who leaves the tab open should
              know the one-click path has a deadline before it silently
              disappears.
            */
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-text-subtle">
              <Clock className="h-3 w-3 shrink-0" aria-hidden />
              One-click re-run available for another {remainingMinutes} min
            </p>
          )}

          {error && (
            /* Was a bare red sentence inside an amber box — on the one card
               where the message's whole job is to say nothing was charged. It
               reads as a failure panel now, like every other one on the site. */
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/[0.07] p-2.5 text-xs leading-relaxed text-red-200"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            loading={submitting}
            loadingLabel="Starting Studio Quality"
            onClick={handleUpgrade}
            className="mt-3.5 w-full"
          >
            {/* One label, not two. `loading` overlays a spinner on top of this
                and keeps its width — swapping the text underneath changed a
                string nobody can see and made the button jump on release. */}
            {isFree ? "Run at Studio Quality — free" : "Run at Studio Quality — 1 credit"}
          </Button>

          {isFree && freeLeft > 0 && (
            <p className="mt-2 text-center text-[11px] text-text-subtle">
              {freeLeft === 1
                ? "This is your last free run this month"
                : `Uses one of your ${freeLeft} free runs this month`}
            </p>
          )}
        </div>
      </div>

      {gate}
    </>
  );
}