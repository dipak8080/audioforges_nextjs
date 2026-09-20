"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Check, ArrowLeft, Mail } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, buttonStyles } from "@/components/ui/Button";
import { CheckoutStep } from "./CheckoutStep";
import { PackRail, defaultPackKey } from "./PackRail";
import { PackCoverage } from "./PackCoverage";
import { requestMagicLink } from "@/lib/api/credits";
import { preloadPayPal } from "@/lib/api/paypal";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";
import type { CreditPack, InsufficientCreditsPayload } from "@/lib/types/credits";
import { TRANSCRIPTION_LIMITS } from "@/lib/api/transcription";
import { TOOL_LIMITS } from "@/lib/data/tool-limits";

type Step = "packs" | "email" | "signin";

function parseServerTime(iso: string): Date {
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
}

interface ToolCopy {
  title: string;
  unit: [string, string];
  creditDetail: string;
  spec: Array<[string, string]>;
  closing: string;
}

const SEPARATION_CLOSING =
  "Standard separation stays free and unlimited, with full downloads and no watermark.";

const SEPARATE_HQ: ToolCopy = {
  title: "Studio Quality",
  unit: ["separation", "separations"],
  creditDetail: "One run of this track through the heavier model",
  spec: [
    ["You get", "Vocals and instrumental, with much less bleed between them"],
    ["Files back", "WAV, full quality, no watermark"],
  ],
  closing: SEPARATION_CLOSING,
};

const STEMS_HQ: ToolCopy = {
  title: "Studio Quality",
  unit: ["separation", "separations"],
  creditDetail: "One run of this track through the heavier model",
  spec: [
    ["You get", "Vocals, drums, bass and other, with much less bleed"],
    ["Files back", "WAV, full quality, no watermark"],
  ],
  closing: SEPARATION_CLOSING,
};

const TOOL_COPY: Record<string, ToolCopy> = {
  "separate-hq": SEPARATE_HQ,
  "stems-hq": STEMS_HQ,
  "youtube/separate-hq": SEPARATE_HQ,
  "youtube/stems-hq": STEMS_HQ,
  transcribe: {
    title: "Transcription",
    unit: ["transcript", "transcripts"],
    creditDetail: `One transcript, up to ${TRANSCRIPTION_LIMITS.durationSeconds / 60} minutes of audio`,
    spec: [
      ["You get", "Full text with timestamps, language detected automatically"],
      ["Shared", "One allowance across audio, video and YouTube transcription"],
    ],
    closing:
      "Your free runs reset every month, and every tool that doesn't need a GPU stays free.",
  },
  "audio-to-midi-hq": {
    title: "High-accuracy MIDI",
    unit: ["MIDI file", "MIDI files"],
    creditDetail: `One transcription of this file, up to ${
      (TOOL_LIMITS["audio-to-midi-hq"]?.maxTotalDurationSeconds ?? 600) / 60
    } minutes`,
    spec: [
      ["You get", "Separate MIDI tracks for bass, piano, guitar, vocals and other, with the real BPM and key from your audio written in"],
      ["Works on", "Whole songs and single sounds alike: the track is split into stems first, then each part goes to the model best at it"],
    ],
    closing:
      "Single-track MIDI stays free and unlimited, with the same formats and the same .mid download.",
  },
  "audio-to-midi-hq-mix": {
    title: "High-accuracy MIDI",
    unit: ["song", "songs"],
    creditDetail: `One full track split and transcribed, up to ${
      (TOOL_LIMITS["audio-to-midi-hq"]?.maxTotalDurationSeconds ?? 600) / 60
    } minutes`,
    spec: [
      ["You get", "Separate MIDI tracks for bass, piano, guitar, vocals and other, with the real BPM and key from your audio written in"],
      ["Works on", "Whole songs and single sounds alike: the track is split into stems first, then each part goes to the model best at it"],
    ],
    closing:
      "Single-track MIDI stays free and unlimited, with the same formats and the same .mid download.",
  },
  "audio-to-sheet": {
    title: "Audio to Sheet Music",
    unit: ["song", "songs"],
    creditDetail: "One song transcribed and engraved into notation",
    spec: [
      ["You get", "An engraved score as PDF, MusicXML, MIDI and SVG. Piano is split into a two-hand grand staff"],
      ["Best on", "Solo piano and clean single-instrument recordings"],
    ],
    closing:
      "Clips of 30 seconds or less stay free, and every tool that doesn't need a GPU stays free too.",
  },
};

const FALLBACK_COPY: ToolCopy = {
  title: "This run uses credits",
  unit: ["run", "runs"],
  creditDetail: "One run of this job on a GPU",
  spec: [],
  closing: "Everything on the site that doesn't need a GPU stays free and unlimited.",
};

const TOOL_LABELS: Record<string, string> = {
  "separate-hq": "Vocal Remover",
  "stems-hq": "Stem Splitter",
  "youtube/separate-hq": "Vocal Remover",
  "youtube/stems-hq": "Stem Splitter",
  transcribe: "your transcript",
  "audio-to-midi-hq": "High-accuracy MIDI",
  "audio-to-midi-hq-mix": "High-accuracy MIDI",
  "audio-to-sheet": "your sheet music",
};

function rememberReturnPath(tool: string | null) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/pricing" || path.startsWith("/checkout")) return;
  try {
    window.localStorage.setItem(
      "af_return_to",
      JSON.stringify({ path, label: (tool && TOOL_LABELS[tool]) || null })
    );
  } catch {
    return;
  }
}

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
  initialPackKey,
}: {
  payload: InsufficientCreditsPayload;
  open: boolean;
  onClose: () => void;
  initialPackKey?: string;
  initialStep?: Step;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [selectedKey, setSelectedKey] = useState<string | null>(initialPackKey ?? null);
  const [chosen, setChosen] = useState<CreditPack | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setStep(initialStep);
      setChosen(null);
      setSelectedKey(null);
    }
  }

  // Warm PayPal while the buyer is still reading the packs, so the
  // checkout step renders its buttons instantly.
  useEffect(() => {
    if (open) preloadPayPal();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
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

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 sm:px-6 sm:pt-6",
            step === "packs" ? "pb-5" : "pb-6",
            "[&::-webkit-scrollbar]:w-1.5",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-graphite-700",
            "hover:[&::-webkit-scrollbar-thumb]:bg-graphite-600"
          )}
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
            <CheckoutStep pack={chosen} onBack={() => setStep("packs")} onPurchased={onClose} />
          )}

          {step === "signin" && <SignInStep onBack={() => setStep("packs")} />}
        </div>

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

function PacksUnavailable({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4 pb-4">
      <h2 id="credit-gate-title" className="pr-8 text-lg font-semibold text-text-primary">
        Prices aren&apos;t loading
      </h2>
      <p className="text-sm leading-relaxed text-text-muted">
        We couldn&apos;t fetch the credit packs just now. Nothing has been charged and no purchase
        was started. Close this and try again in a moment.
      </p>
      <Button variant="outline" size="md" onClick={onClose} className="w-full">
        Close
      </Button>
    </div>
  );
}


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
  const copy = TOOL_COPY[payload.tool] ?? FALLBACK_COPY;
  const selectedPack = payload.packs.find((p) => p.key === activeKey) ?? null;
  const cost = payload.credits_needed;

  return (
    <>
      <h2 id="credit-gate-title" className="pr-8 text-lg font-semibold text-text-primary">
        {copy.title}
      </h2>
      <p className="mt-0.5 text-sm text-text-muted">
        {copy.creditDetail}.{" "}
        <span className="text-text-subtle">
          {cost} {cost === 1 ? "credit" : "credits"} per {copy.unit[0]}.
        </span>
      </p>

      {copy.spec.length > 0 && (
        <dl className="mt-3 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-950/40 text-sm">
          {copy.spec.map(([term, detail]) => (
            <SpecRow key={term} label={term}>
              {detail}
            </SpecRow>
          ))}
        </dl>
      )}

      {payload.free_remaining > 0 && (
        <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-sm text-text-muted">
          You still have{" "}
          <span className="font-medium text-amber-400">
            {payload.free_remaining} free {payload.free_remaining === 1 ? "run" : "runs"}
          </span>{" "}
          this month. Close this and use one first.
        </p>
      )}

      <div className="mt-5">
        <PackRail
          packs={payload.packs}
          selectedKey={activeKey}
          onSelect={onSelect}
          creditsPerRun={cost}
          unit={copy.unit}
        />
      </div>

      {selectedPack && (
        <PackCoverage credits={selectedPack.credits} activeTool={payload.tool} className="mt-3" />
      )}

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

      <div className="mt-3 space-y-2">
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

        <p className="text-center text-xs leading-relaxed text-text-subtle">
          {copy.closing}
          {resetsOn && payload.free_remaining === 0 ? ` Free runs come back on ${resetsOn}.` : ""}
        </p>
      </div>
    </>
  );
}

export function PackStepAction({
  activePack,
  onContinue,
}: {
  activePack: CreditPack;
  toolLabel?: string;
  onContinue: () => void;
}) {
  return (
    <div className="relative shrink-0 border-t border-graphite-800 bg-graphite-950/40 px-5 py-4 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-graphite-900 to-transparent"
      />
      <Button variant="primary" size="lg" onClick={onContinue} className="w-full">
        Continue: {activePack.credits} credits for ${activePack.price_usd.toFixed(2)}
      </Button>
      <p className="mt-2 text-center text-xs text-text-subtle">
        Pay on the next screen. Your track stays open here.
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
      setError("That email doesn't look right. Check it and try again.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
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
        <p className="text-sm leading-relaxed text-text-muted">
          A sign-in link is on its way to <span className="text-text-primary">{email.trim()}</span>.
          It expires in 30 minutes. Not there? Check spam, or use the email you paid with.
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