"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Check, ArrowLeft, Mail } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, buttonStyles } from "@/components/ui/Button";
import { EmailCaptureStep } from "./EmailCaptureStep";
import { PackRail, defaultPackKey } from "./PackRail";
import { requestMagicLink } from "@/lib/api/credits";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";
import { TRANSCRIPTION_LIMITS } from "@/lib/api/transcription";
import { TOOL_LIMITS } from "@/lib/data/tool-limits";

/**
 * THE GATE.
 *
 * Everything renders from the 402 payload the server just sent. No pack,
 * price, or buy URL is hardcoded — change a price in the backend config and
 * this reflects it with no deploy.
 *
 * WHAT THIS SCREEN HAS TO DO, IN ORDER:
 *
 *   1. Say what a credit gets you. The old version said "cleaner separation
 *      with less bleed" and nothing else — an adjective, not an answer. One
 *      line of spec does more work than a paragraph of pitch.
 *   2. Price it, using the same control as /pricing so the two surfaces
 *      teach one vocabulary.
 *   3. Print the three facts a subscription competitor structurally cannot:
 *      no subscription, never expires, failed run refunds.
 *   4. Promise the return trip. The user has a track loaded and is being
 *      asked to leave the page.
 *   5. Never imply the free tool got worse. They reached here by choosing
 *      the better model; standard separation is untouched and the closing
 *      line says so. A paywall that makes people doubt the free tier costs
 *      more traffic than it earns revenue.
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. THE ACTION BAR DESCRIBED A FLOW THAT NO LONGER EXISTS. It promised
 *    "you'll pay on Ko-fi and come straight back", which was true when
 *    checkout navigated this tab away. EmailCaptureStep opens Ko-fi in a NEW
 *    tab now — precisely so the page and the loaded track survive — and says
 *    so one step later. So the last thing someone read before committing was
 *    the old behaviour, contradicted by the next screen. The reassurance is
 *    stronger the true way round: nothing is being left.
 *
 * 2. AN EMPTY PACK LIST RENDERED AN EMPTY DIALOG. `activePack` gates the
 *    entire packs step AND the action bar, so a payload whose `packs` array
 *    came back empty produced a modal containing one close button and no
 *    labelled title — with `aria-labelledby` pointing at an element that was
 *    never rendered. It now says what happened.
 *
 * 3. `free_resets_at` WAS PARSED AS LOCAL TIME. The backend sends naive UTC
 *    and `new Date()` reads a date-time with no offset as local, so the reset
 *    date could land on the wrong day for anyone far enough east — the same
 *    trap the logs dashboard carries a helper for.
 *
 * 4. THE SCROLLBAR COLOUR WASN'T FROM THE PALETTE. `#374151` is a Tailwind
 *    default grey; the mobile nav sheet this was meant to match has the same
 *    stray value. Now `--graphite-700`.
 *
 * 5. EVERY BUTTON IS `buttonStyles`. The Continue bar, the close X, both
 *    Back links and the sign-in link were five hand-rolled surfaces — and the
 *    Continue button had already drifted into its own amber, radius and press
 *    behaviour, on the single most important control in the product.
 */

type Step = "packs" | "email" | "signin";

/**
 * The backend writes naive UTC timestamps. `new Date(iso)` reads a date-time
 * with no offset as LOCAL, which shifts the rendered date by the user's offset
 * and can land it on the wrong day.
 */
function parseServerTime(iso: string): Date {
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}

/**
 * WHAT THIS TOOL ACTUALLY GIVES YOU, PER TOOL.
 *
 * This screen used to hardcode the Studio Quality separation spec — "vocal and
 * instrumental", "WAV, full quality, no watermark" — no matter which route
 * sent the 402. The moment transcription became metered, someone on
 * /audio-to-text asking for a transcript was shown a spec sheet for audio
 * stems. Wrong on the one screen that has to say what a credit buys.
 *
 * Keyed by `payload.tool`, which is the backend's own rule key, so a new
 * metered tool either appears here or falls back to copy that claims nothing.
 */
interface ToolCopy {
  title: string;
  /**
   * The detail that pairs with the credit COUNT row. The count itself is NOT
   * typed here — it's derived from payload.credits_needed at render, so a tool
   * that costs more than one credit (audio-to-sheet is three) can never be
   * shown as "1 credit" the way a hardcoded literal would. Same derive-don't-
   * type rule the duration lines below already follow.
   */
  creditDetail: string;
  spec: Array<[string, string]>;
  /** The reassurance on the way out. Must be TRUE for this tool. */
  closing: string;
}

const SEPARATION_CLOSING =
  "Standard separation stays free and unlimited, with full downloads and no watermark.";

const SEPARATE_HQ: ToolCopy = {
  title: "Studio Quality",
  creditDetail: "One run of this track through the heavier model",
  spec: [
    ["You get", "Vocals and instrumental, with much less bleed between them"],
    ["Files back", "WAV, full quality, no watermark"],
  ],
  closing: SEPARATION_CLOSING,
};

const STEMS_HQ: ToolCopy = {
  title: "Studio Quality",
  creditDetail: "One run of this track through the heavier model",
  spec: [
    ["You get", "Vocals, drums, bass and other — much less bleed"],
    ["Files back", "WAV, full quality, no watermark"],
  ],
  closing: SEPARATION_CLOSING,
};

/* One literal. The YouTube aliases and the MIDI entry used to be assigned
   after the fact, which meant the map's real contents weren't visible in one
   place — and a reader could reasonably miss that four keys share two objects. */
const TOOL_COPY: Record<string, ToolCopy> = {
  "separate-hq": SEPARATE_HQ,
  "stems-hq": STEMS_HQ,
  // The YouTube variants run the same model on the same audio — same promise.
  "youtube/separate-hq": SEPARATE_HQ,
  "youtube/stems-hq": STEMS_HQ,
  transcribe: {
    title: "Transcription",
    // Derived, not typed. This read "up to 20 minutes" while the backend cap
    // was 600 seconds — on the one screen where somebody decides to pay,
    // promising twice the length they can actually upload. Exactly the
    // literal-in-JSX class of bug that has already shipped wrong numbers here.
    creditDetail: `One transcript, up to ${TRANSCRIPTION_LIMITS.durationSeconds / 60} minutes of audio`,
    spec: [
      ["You get", "Full text with timestamps, language detected automatically"],
      // Stated HERE because this is where someone decides. All three
      // transcription tools draw on one "transcribe" allowance, and finding
      // that out after spending a run reads as being short-changed.
      ["Shared", "One allowance across audio, video and YouTube transcription"],
    ],
    closing:
      "Your free runs reset every month, and every tool that doesn't need a GPU stays free.",
  },
  // Piano & keys and Guitar presets. Full mix / Let it decide use the
  // 3-credit "audio-to-midi-hq-mix" key below.
  "audio-to-midi-hq": {
    title: "Instrument MIDI",
    creditDetail: `One transcription of this file, up to ${
      (TOOL_LIMITS["audio-to-midi-hq"]?.maxTotalDurationSeconds ?? 600) / 60
    } minutes`,
    spec: [
      ["You get", "One MIDI track from a model trained for that instrument — piano (Transkun) or guitar"],
      ["Best on", "A solo recording or an isolated stem. A full mix will bleed other instruments into the notes"],
    ],
    closing:
      "Single-track MIDI stays free and unlimited, with the same formats and the same .mid download.",
  },
  // 3 credits — the credit row derives that from the payload. One Demucs
  // split plus up to four transcriptions is why.
  "audio-to-midi-hq-mix": {
    title: "Full-mix MIDI",
    creditDetail: `One full track split and transcribed, up to ${
      (TOOL_LIMITS["audio-to-midi-hq"]?.maxTotalDurationSeconds ?? 600) / 60
    } minutes`,
    spec: [
      ["You get", "Separate MIDI tracks for bass, piano, guitar, vocals and other, with the detected BPM set as the tempo"],
      ["Honest limit", "Bass, piano and vocal lines come back cleanest. Synth leads and pads (“other”) are still the hardest part for any model"],
    ],
    closing:
      "Single-track MIDI stays free and unlimited, with the same formats and the same .mid download.",
  },
  // Costs THREE credits, not one — the credit row derives that from the payload
  // so this entry doesn't restate it. The multi-stage job (GPU transcription →
  // analysis → engraving) is why; the closing keeps the free lane honest.
  "audio-to-sheet": {
    title: "Audio to Sheet Music",
    creditDetail: "One song transcribed and engraved into notation",
    spec: [
      ["You get", "An engraved score — PDF, MusicXML, MIDI and SVG; piano split into a two-hand grand staff"],
      // The honest limit, stated before payment for the same reason as the MIDI
      // "Best on" above: a dense full mix comes back rougher than a clean solo.
      ["Best on", "Solo piano and clean single-instrument recordings"],
    ],
    closing:
      "Clips of 30 seconds or less stay free, and every tool that doesn't need a GPU stays free too.",
  },
};

/** Claims nothing specific, so an unmapped tool key can't lie. */
const FALLBACK_COPY: ToolCopy = {
  title: "This run needs a credit",
  creditDetail: "One run of this job on a GPU",
  spec: [],
  closing: "Everything on the site that doesn't need a GPU stays free and unlimited.",
};

/** Route keys → what the user calls the tool, for the return-trip line. */
const TOOL_LABELS: Record<string, string> = {
  "separate-hq": "Vocal Remover",
  "stems-hq": "Stem Splitter",
  "youtube/separate-hq": "Vocal Remover",
  "youtube/stems-hq": "Stem Splitter",
  // Were missing, so the two newest metered tools fell through to the generic
  // line on the screen where naming the thing they were mid-way through is
  // most reassuring.
  transcribe: "your transcript",
  "audio-to-midi-hq": "Instrument MIDI",
  "audio-to-midi-hq-mix": "Full-mix MIDI",
  "audio-to-sheet": "your sheet music",
};

/**
 * Checkout normally opens Ko-fi in a NEW tab, so this page survives — but if
 * the popup is blocked, EmailCaptureStep falls back to a same-tab jump and the
 * tool page is destroyed. This is what /checkout/success reads to get the user
 * back where they were in that case.
 *
 * Recorded from the live pathname rather than mapped from the tool key, so
 * this needs no knowledge of the route table and cannot go stale.
 */
function rememberReturnPath(tool: string | null) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  // /pricing and /checkout are not places to send someone back to.
  if (path === "/pricing" || path.startsWith("/checkout")) return;
  try {
    window.localStorage.setItem(
      "af_return_to",
      JSON.stringify({ path, label: (tool && TOOL_LABELS[tool]) || null })
    );
  } catch {
    /* storage disabled — the success page falls back to a default route */
  }
}

/** Shared by both email fields in this file, so the recovery form and the
 *  checkout form can't end up different shapes. */
const inputClass = cn(
  "w-full rounded-lg border border-graphite-700 bg-graphite-950 px-3 py-2.5 text-text-primary",
  "outline-none transition-colors placeholder:text-text-subtle/60",
  "hover:border-graphite-600 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20",
  "disabled:opacity-50"
);

export function CreditGateModal({
  payload,
  open,
  onClose,
  initialStep = "packs",
}: {
  payload: InsufficientCreditsPayload;
  open: boolean;
  onClose: () => void;
  /**
   * Opens straight onto a step. "signin" exists because recovering an existing
   * purchase was buried: the only route to it was to start a NEW checkout and
   * spot a link inside it. Someone who bought on a laptop and opened the site
   * on their phone was shown a page that looked like they had to pay twice.
   */
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [chosen, setChosen] = useState<CreditPack | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  // Whatever had focus when the modal opened. Returning focus there on close
  // is what keeps keyboard users from being dumped at the top of the document
  // after dismissing a dialog.
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  // Reset to the first step whenever the modal is dismissed, so reopening
  // never lands mid-flow on a stale selection.
  //
  // Adjusted DURING RENDER rather than in an effect. React documents this
  // pattern for "reset state when a prop changes": it re-renders once before
  // painting, so nobody sees the stale step — whereas an effect would paint
  // the old step for a frame, and the compiler lint rejects setState in an
  // effect outright.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setStep(initialStep);
      setChosen(null);
      setSelectedKey(null);
    }
  }

  /**
   * FIXED (2026-08-21): focus restore used to share an effect with the
   * analytics call, whose deps included payload.balance and
   * payload.free_remaining. Any new 402 re-ran the cleanup and yanked focus
   * back to the trigger button while the dialog was still open. Focus
   * management depends on `open` alone.
   */
  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    // Focus the dialog itself, not the close button. Opening a payment dialog
    // with "dismiss" pre-focused is a strange first offer, and focusing the
    // container is what gets the title announced.
    dialogRef.current?.focus();
    return () => {
      restoreFocusTo.current?.focus?.();
    };
  }, [open]);

  const firedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      firedFor.current = null;
      return;
    }
    // Once per opening, not once per payload identity change.
    if (firedFor.current === payload.tool) return;
    firedFor.current = payload.tool;
    trackCredits("credits_gate_shown", {
      tool: payload.tool,
      balance: payload.balance,
      free_remaining: payload.free_remaining,
    });
  }, [open, payload.tool, payload.balance, payload.free_remaining]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes, Tab cycles inside. Without the trap, Tab walks into the
  // page behind an open modal — for a payment dialog that means focusing a
  // "Remove vocals" button the user cannot see.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  const resetsOn = useMemo(() => {
    const d = parseServerTime(payload.free_resets_at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  }, [payload.free_resets_at]);

  if (!open) return null;

  const activeKey = selectedKey ?? defaultPackKey(payload.packs);
  const activePack = payload.packs.find((p) => p.key === activeKey) ?? null;
  /* Both the packs step and the action bar are gated on a pack existing, so an
     empty list produced a dialog with a close button and nothing else — and an
     aria-labelledby pointing at an element that never rendered. */
  const packsUnavailable = step === "packs" && !activePack;

  function handleContinue() {
    if (!activePack) return;
    trackCredits("credits_pack_selected", {
      pack: activePack.key,
      credits: activePack.credits,
      value: activePack.price_usd,
      currency: "USD",
    });
    rememberReturnPath(payload.tool);
    setChosen(activePack);
    setStep("email");
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-graphite-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // mousedown, not click: a drag that STARTS inside the dialog and ends
        // on the backdrop — selecting text, say — would otherwise dismiss a
        // payment dialog mid-purchase.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-gate-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden outline-none",
          "rounded-t-2xl border border-graphite-800 bg-graphite-900 shadow-2xl shadow-graphite-950/70 sm:rounded-2xl",
          "pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-0"
        )}
      >
        {/* Sheet grabber. Mobile only — it's a signal that this drags/dismisses,
            which is meaningless on a centred desktop dialog. */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-graphite-700" />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={buttonStyles({
            variant: "ghost",
            size: "icon-sm",
            className: "absolute right-3 top-3 z-10 text-text-subtle",
          })}
        >
          <X />
        </button>

        {/*
          SCROLLS THE BODY, NOT THE DIALOG.
          The whole panel used to be one overflow-y-auto box, so on a short
          window the title scrolled away and — worse — the buy button sat below
          the fold behind a full-height native scrollbar. Now the dialog is a
          column, this is the only part that moves, and the action bar pins
          itself underneath.

          The scrollbar is styled to match the mobile nav sheet. An unstyled one
          renders as a wide light-grey track on Windows Chrome: the brightest
          object on a dark modal.

          overscroll-contain stops a flick at the end of this list from
          scrolling the page behind the dialog.
        */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 sm:px-6 sm:pt-6",
            step === "packs" ? "pb-2" : "pb-6",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-graphite-700",
            "hover:[&::-webkit-scrollbar-thumb]:bg-graphite-600"
          )}
          /* Was #374151 — a Tailwind default grey that isn't in this palette. */
          style={{ scrollbarWidth: "thin", scrollbarColor: "#34343a transparent" }}
        >
          {packsUnavailable && <PacksUnavailable onClose={onClose} />}

          {step === "packs" && activePack && (
            <PackStep
              payload={payload}
              activeKey={activeKey}
              resetsOn={resetsOn}
              onSelect={(p) => setSelectedKey(p.key)}
              onSignIn={() => setStep("signin")}
            />
          )}

          {step === "email" && chosen && (
            <>
              <h2 id="credit-gate-title" className="mb-1 text-lg font-semibold text-text-primary">
                One detail before Ko-fi
              </h2>
              <p className="mb-5 text-sm leading-relaxed text-text-muted">
                Ko-fi doesn&apos;t tell us who paid, so we use your email to match the payment to
                this browser. No account, no password.
              </p>
              {/* onPurchased closes the modal outright. With Ko-fi in a new tab
                  the tool page behind this is still intact, file and all, so
                  "Back to your track" has somewhere real to land. */}
              <EmailCaptureStep pack={chosen} onBack={() => setStep("packs")} onPurchased={onClose} />
            </>
          )}

          {step === "signin" && <SignInStep onBack={() => setStep("packs")} />}
        </div>

        {/* Outside the scroll region: always visible, never chased. */}
        {step === "packs" && activePack && (
          <PackStepAction
            activePack={activePack}
            toolLabel={TOOL_LABELS[payload.tool]}
            onContinue={handleContinue}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The packs array came back empty. Rare, but the old behaviour was an unnamed
 * dialog containing a single X — which reads as the site being broken at the
 * exact moment someone decided to pay.
 */
function PacksUnavailable({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4 pb-4">
      <h2 id="credit-gate-title" className="pr-8 text-lg font-semibold text-text-primary">
        Prices aren&apos;t loading
      </h2>
      <p className="text-sm leading-relaxed text-text-muted">
        We couldn&apos;t fetch the credit packs just now. Nothing has been charged and no purchase
        was started — close this and try again in a moment.
      </p>
      <Button variant="outline" size="md" onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — packs                                                      */
/* ------------------------------------------------------------------ */

function PackStep({
  payload,
  activeKey,
  resetsOn,
  onSelect,
  onSignIn,
}: {
  payload: InsufficientCreditsPayload;
  activeKey: string | null;
  resetsOn: string | null;
  onSelect: (pack: CreditPack) => void;
  onSignIn: () => void;
}) {
  // TOOL_LABELS is read by the action bar for the return-trip line, not here.
  const copy = TOOL_COPY[payload.tool] ?? FALLBACK_COPY;

  // The count is the backend's, never a literal — so a 3-credit job reads
  // "3 credits", not the "1 credit" a hardcoded spec row would have shown.
  const creditLabel = `${payload.credits_needed} ${
    payload.credits_needed === 1 ? "credit" : "credits"
  }`;

  return (
    <>
      {/*
        NOT "You're out of credits." That frames the product as something that
        ran out on you. The user got here by choosing the better tool, so the
        heading names what they're buying — and it names the RIGHT one, which
        it did not before: every tool got the separation title.
      */}
      <h2 id="credit-gate-title" className="pr-8 text-lg font-semibold text-text-primary">
        {copy.title}
      </h2>

      {/*
        THE ANSWER TO "WHAT AM I ACTUALLY GETTING". Plain spec, in the register
        of a plugin readout rather than a sales page — and drawn from the tool
        that actually 402'd, so a transcription user is no longer shown a spec
        sheet for audio stems.
      */}
      <dl className="mt-3 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950/40 text-sm">
        <SpecRow label={creditLabel}>{copy.creditDetail}</SpecRow>
        {copy.spec.map(([term, detail]) => (
          <SpecRow key={term} label={term}>
            {detail}
          </SpecRow>
        ))}
      </dl>

      {/* Someone with free runs left should not be sold to. Only reachable
          from /pricing, since a 402 means the allowance is already spent. */}
      {payload.free_remaining > 0 && (
        <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-sm text-text-muted">
          You still have{" "}
          <span className="font-medium text-amber-400">
            {payload.free_remaining} free {payload.free_remaining === 1 ? "run" : "runs"}
          </span>{" "}
          this month. Close this and use one first.
        </p>
      )}

      {resetsOn && payload.free_remaining === 0 && (
        <p className="mt-4 text-sm leading-relaxed text-text-muted">
          Your free monthly runs reset on <span className="text-text-primary">{resetsOn}</span>.
          Credits are for when you don&apos;t want to wait.
        </p>
      )}

      <div className="mt-5">
        <PackRail
          packs={payload.packs}
          selectedKey={activeKey}
          onSelect={onSelect}
          creditsPerRun={payload.credits_needed}
        />
      </div>

      {/* The three claims the competition structurally cannot print. One
          hairline strip rather than three icon rows: same information, far
          less of a modal that has to fit a phone. */}
      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 border-t border-graphite-800 pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-text-subtle">
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

      <div className="mt-4 space-y-3 pt-1">
        <button
          type="button"
          onClick={onSignIn}
          className={buttonStyles({
            variant: "ghost",
            size: "sm",
            className: "w-full text-text-muted underline-offset-4 hover:text-amber-400 hover:underline",
          })}
        >
          <Mail />
          Already bought? Sign in
        </button>

        {/*
          The closing reassurance, per tool. Someone who decides not to pay must
          leave knowing what's still free — otherwise this modal costs the visit
          AND the return visit. It said "standard separation stays free" to
          everyone, which is not the relevant promise on a transcription page.
        */}
        <p className="text-center text-xs leading-relaxed text-text-subtle">{copy.closing}</p>
      </div>
    </>
  );
}

/**
 * The action bar. Pinned OUTSIDE the scroll region, so the one control this
 * screen exists for is never below the fold — which is exactly where it ended
 * up on a short window when the whole dialog scrolled as one box.
 */
export function PackStepAction({
  activePack,
  toolLabel,
  onContinue,
}: {
  activePack: CreditPack;
  toolLabel?: string;
  onContinue: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-graphite-800 bg-graphite-950/40 px-5 py-4 sm:px-6">
      <Button variant="primary" size="lg" onClick={onContinue} className="w-full">
        Continue — {activePack.credits} credits for ${activePack.price_usd.toFixed(2)}
      </Button>

      {/*
        The live worry here is "do I lose what I'm doing", and it outranks any
        trust badge we could put in this space.

        This used to say "you'll pay on Ko-fi and come straight back", which
        described the old same-tab redirect. Checkout opens a new tab now
        precisely so nothing is left behind — and the very next screen says so.
        Two screens describing one flow differently is worse than either
        description alone.
      */}
      <p className="mt-2.5 text-center text-xs leading-relaxed text-text-subtle">
        Ko-fi opens in a new tab, so this page
        {toolLabel ? ` and your ${toolLabel} run` : " and your track"} stay exactly as they are.
        Credits land on this browser automatically — nothing to type.
      </p>
    </div>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-graphite-800 px-3.5 py-2.5 last:border-b-0">
      <dt className="w-[4.5rem] shrink-0 pt-px font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </dt>
      <dd className="text-[13px] leading-relaxed text-text-primary">{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — sign in (recovery)                                         */
/* ------------------------------------------------------------------ */

/**
 * The cross-device path. Someone buys on their phone, then opens the site on
 * a laptop — different browser, different subject id, invisible balance.
 * Without this they're stuck with credits they paid for, which is the single
 * worst support ticket this system can generate.
 */
function SignInStep({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("That email doesn't look right — check it and try again.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // Was checkout-only, so a magic-link sign-in reused whatever path an
      // EARLIER checkout had written — "Back to your track" sent everyone to
      // the same stale page forever. The recovery flow leaves the tab open
      // too, but the link is often opened on another device where this is the
      // only record of where they started.
      rememberReturnPath(null);
      await requestMagicLink(trimmed);
      trackCredits("credits_magic_link_requested");
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many sign-in emails from here. Try again in an hour.");
      } else {
        setError("That didn't send. Try again in a moment.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 py-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10">
          <Check className="h-5 w-5 text-amber-400" />
        </div>
        <h2 id="credit-gate-title" className="text-lg font-semibold text-text-primary">
          Check your email
        </h2>
        {/*
          Conditional voice, deliberately. The backend returns 200 whether or
          not the account exists, so an attacker can't use this to discover
          which emails have accounts. Copy has to match — "we sent it" would be
          a lie half the time.
        */}
        <p className="text-sm leading-relaxed text-text-muted">
          If <span className="text-text-primary">{email.trim()}</span> has credits, a sign-in link
          is on its way. It expires in 30 minutes.
        </p>
        <Button variant="outline" size="md" onClick={onBack} className="w-full">
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className={buttonStyles({
          variant: "ghost",
          size: "sm",
          className: "-ml-2 text-text-muted",
        })}
      >
        <ArrowLeft />
        Back
      </button>

      <div>
        <h2 id="credit-gate-title" className="text-lg font-semibold text-text-primary">
          Sign in
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          Bought credits on another device or browser? Enter the email you paid with and
          we&apos;ll send a sign-in link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-label="Email address"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          disabled={submitting}
          placeholder="you@example.com"
          aria-invalid={!!error}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
          Send sign-in link
        </Button>
      </form>
    </div>
  );
}