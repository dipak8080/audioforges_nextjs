"use client";

import { useCallback, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useCredits } from "./CreditProvider";
import { CreditGateModal } from "./CreditGateModal";
import { PackRail, defaultPackKey } from "./PackRail";
import { trackCredits } from "@/lib/analytics";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";

/**
 * The pack selector on /pricing.
 *
 * Packs come from /credits/me via the provider — never hardcoded. Change a
 * price in the backend config and this reflects it with no deploy.
 *
 * The rail itself is PackRail, shared with the gate modal, so /pricing and
 * the paywall cannot drift into badging different packs as best value or
 * doing the per-run maths differently.
 *
 * Buying reuses CreditGateModal with a SYNTHESIZED payload rather than
 * duplicating the email step and the trust copy. There is exactly one
 * checkout flow in this product and it lives in one file.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE PAYLOAD WAS BUILT TWICE, FIELD FOR FIELD. Two functions, eight
 *    identical lines each. A field added to the type would have been added to
 *    one of them, and the bug would have shown up only on the recovery path —
 *    the one nobody tests, used by the person who has already paid.
 *
 * 2. THE SIGN-IN CONTROL WAS A BUTTON WEARING A SECTION DIVIDER. It carried
 *    `border-t` and the padding above the rule, so the top edge of the divider
 *    was inside the click target: a click in the whitespace under the fine
 *    print opened a sign-in dialog. Divider and control are separate elements
 *    now.
 *
 * 3. THE TRUST-CLAIMS COMMENT SAT ON THE WRONG ELEMENT — attached to the
 *    sign-in button rather than the list it describes, which is exactly how a
 *    later edit deletes the wrong thing.
 *
 * 4. THE LOADING STATE WAS A SPINNER IN AN EMPTY BOX. This page is the whole
 *    reason someone navigated here, and it opened as a blank panel of
 *    indeterminate height that then jumped to full content. A skeleton in the
 *    shape of the rail holds the layout still.
 *
 * 5. BOTH AMBER BUTTONS ARE `buttonStyles`. The Continue button had drifted
 *    into its own radius, its own focus ring offset, and no press state — on
 *    the primary conversion control of the pricing page.
 */
export function PricingTable() {
  const { me, loading, balance, freeRemaining } = useCredits();
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [openPayload, setOpenPayload] = useState<InsufficientCreditsPayload | null>(null);
  /** Which step the modal opens on — "signin" for someone recovering a purchase. */
  const [openStep, setOpenStep] = useState<"packs" | "signin">("packs");

  // Memoized rather than `me?.packs ?? []` inline: the `?? []` allocates a
  // fresh array on every render, invalidating every downstream useMemo.
  const packs = useMemo(() => me?.packs ?? [], [me]);

  // Derived, not set in an effect, so there is no flash of an unselected rail.
  const selectedKey =
    chosenKey && packs.some((p) => p.key === chosenKey) ? chosenKey : defaultPackKey(packs);
  const selected = packs.find((p) => p.key === selectedKey) ?? null;

  /**
   * ONE builder, for both entry points.
   *
   * Synthesized, not received from a 402 — this user came here deliberately
   * rather than by hitting a limit. Same shape, so the modal neither knows nor
   * cares which path opened it.
   *
   * `tool` is the flagship key because the modal keys its spec copy off it and
   * there is no specific tool in play here. (Worth revisiting: that copy reads
   * "one run of this track", and on /pricing there is no track.)
   */
  const buildPayload = useCallback((): InsufficientCreditsPayload | null => {
    if (!me) return null;
    return {
      error: "insufficient_credits",
      message: "",
      tool: "separate-hq",
      credits_needed: 1,
      balance: me.balance,
      free_remaining: me.free_remaining,
      free_resets_at: me.free_resets_at,
      packs: me.packs,
    };
  }, [me]);

  /**
   * Recovery, reachable WITHOUT starting a purchase.
   *
   * Credits live on a browser cookie, so someone who paid on a laptop and then
   * opens the site on their phone sees a balance of zero and a pricing page —
   * which reads as being asked to pay a second time. The sign-in link existed,
   * but only inside the checkout flow, two clicks deep behind a buy button. The
   * one person who must never be asked to buy again was the one who had to
   * start buying again to find the way out.
   */
  function openSignIn() {
    const payload = buildPayload();
    if (!payload) return;
    setOpenStep("signin");
    setOpenPayload(payload);
  }

  function openCheckout(pack: CreditPack) {
    const payload = buildPayload();
    if (!payload) return;
    setOpenStep("packs");
    trackCredits("credits_pack_selected", {
      pack: pack.key,
      credits: pack.credits,
      value: pack.price_usd,
      currency: "USD",
      source: "pricing_page",
    });
    setOpenPayload(payload);
  }

  /* The shape of what's coming, rather than a spinner in a void. This panel is
     the reason the visit happened; opening as an empty box of indeterminate
     height and then jumping to full content is the worst first impression it
     can make. */
  if (loading) {
    return (
      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-4 sm:p-5" aria-hidden>
        <div className="mb-2.5 h-3 w-20 animate-pulse rounded bg-graphite-800 motion-reduce:animate-none" />
        <div className="h-[86px] animate-pulse rounded-lg border border-graphite-700 bg-graphite-850/40 motion-reduce:animate-none" />
        <div className="mt-3 h-[74px] animate-pulse rounded-lg border border-graphite-800 bg-graphite-850/40 motion-reduce:animate-none" />
        <div className="mt-4 h-12 animate-pulse rounded-lg bg-graphite-800 motion-reduce:animate-none" />
      </div>
    );
  }

  // Empty state says what happened and what to do, in the interface's voice.
  if (!selected) {
    return (
      <div className="rounded-xl border border-graphite-800 bg-graphite-900 p-6">
        <p className="text-sm leading-relaxed text-text-muted">
          Prices aren&apos;t loading right now. Reload the page — nothing has been charged and no
          purchase was started.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* What you already have, before what you could buy. Someone arriving
          with unspent credits or free runs should see that first, or the page
          is selling them something they're holding. */}
      {(balance > 0 || freeRemaining > 0) && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <span className="text-text-muted">
            {balance > 0 ? (
              <>
                You have{" "}
                <span className="font-medium text-amber-400">
                  {balance} {balance === 1 ? "credit" : "credits"}
                </span>{" "}
                already.
              </>
            ) : (
              <>
                You have{" "}
                <span className="font-medium text-amber-400">
                  {freeRemaining} free {freeRemaining === 1 ? "run" : "runs"}
                </span>{" "}
                left this month — no need to buy yet.
              </>
            )}
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 p-4 sm:p-5">
        <PackRail packs={packs} selectedKey={selectedKey} onSelect={(p) => setChosenKey(p.key)} />

        <Button
          variant="primary"
          size="lg"
          onClick={() => openCheckout(selected)}
          className="mt-4 w-full"
        >
          Continue — {selected.credits} credits for ${selected.price_usd.toFixed(2)}
        </Button>

        <p className="mt-3 text-center text-xs leading-relaxed text-text-subtle">
          Next you&apos;ll enter an email, then pay on Ko-fi. The email is how we match the payment
          back to this browser — there&apos;s no account to create and no password.
        </p>

        {/* The rule is a rule, not part of the control. It used to be a border
            on the button itself, so a click in the whitespace under the fine
            print above opened a sign-in dialog. */}
        <div className="mt-4 border-t border-graphite-800 pt-4">
          <button
            type="button"
            onClick={openSignIn}
            className={buttonStyles({
              variant: "ghost",
              size: "sm",
              className: "w-full text-text-muted hover:text-amber-400",
            })}
          >
            Already bought? Sign in to use your credits here
          </button>
        </div>

        {/* The three claims a subscription competitor structurally cannot
            print, at the moment of decision rather than in a footnote. */}
        <ul
          className={cn(
            "mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-graphite-800 pt-4",
            "font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle"
          )}
        >
          <li>No subscription</li>
          <li aria-hidden className="text-graphite-700">
            /
          </li>
          <li>Never expires</li>
          <li aria-hidden className="text-graphite-700">
            /
          </li>
          <li>Failed run refunded</li>
        </ul>
      </div>

      {openPayload && (
        <CreditGateModal
          payload={openPayload}
          open
          initialStep={openStep}
          onClose={() => setOpenPayload(null)}
        />
      )}
    </>
  );
}