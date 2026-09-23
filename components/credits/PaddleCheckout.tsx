"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/railway";
import { trackCredits } from "@/lib/analytics";
import {
  confirmPaddleTransaction,
  createPaddleTransaction,
  getPaddleConfig,
  loadPaddle,
  setPaddleListener,
  type PaddleEvent,
} from "@/lib/api/paddle";
import { useCredits } from "./CreditProvider";
import type { CreditPack } from "@/lib/types/credits";

const EMAIL_STORAGE_KEY = "af_claim_email";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONFIRM_ATTEMPTS = 10;
const CONFIRM_INTERVAL_MS = 1500;

type Phase = "loading" | "ready" | "opening" | "open" | "confirming" | "done" | "pending" | "unavailable";

interface Props {
  pack: CreditPack;
  onComplete?: (balance: number) => void;
  className?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PaddleCheckout({ pack, onComplete, className }: Props) {
  const { refresh, applyBalance } = useCredits();

  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(0);

  const txnRef = useRef<string | null>(null);
  const paddleRef = useRef<{ Checkout: { close: () => void } } | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setEmail(saved);
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await getPaddleConfig();
      if (cancelled) return;
      if (!config?.enabled || !config.client_token) {
        trackCredits("credits_paddle_unavailable", { pack: pack.key, stage: "config" });
        setPhase("unavailable");
        return;
      }
      try {
        await loadPaddle(config);
        if (!cancelled) setPhase("ready");
      } catch {
        if (cancelled) return;
        trackCredits("credits_paddle_unavailable", { pack: pack.key, stage: "script" });
        setPhase("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pack.key]);

  const confirm = useCallback(
    async (transactionId: string) => {
      setPhase("confirming");
      for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
        try {
          const result = await confirmPaddleTransaction(transactionId);
          if (result.ok) {
            setGranted(result.credits);
            applyBalance(result.balance);
            setPhase("done");
            onComplete?.(result.balance);
            trackCredits("credits_purchase_confirmed", {
              provider: "paddle",
              pack: pack.key,
              balance: result.balance,
            });
            void refresh();
            return;
          }
        } catch (err) {
          trackCredits("credits_paddle_failed", {
            stage: "confirm",
            kind: err instanceof ApiError ? err.kind ?? String(err.status) : "network",
          });
        }
        await sleep(CONFIRM_INTERVAL_MS);
      }
      setPhase("pending");
    },
    [applyBalance, onComplete, refresh, pack.key]
  );

  useEffect(() => {
    const handle = (e: PaddleEvent) => {
      if (e.name === "checkout.completed") {
        completedRef.current = true;
        setTimeout(() => paddleRef.current?.Checkout.close(), 1500);
        const id = e.data?.transaction_id || txnRef.current;
        if (id) void confirm(id);
        return;
      }
      if (e.name === "checkout.closed" && !completedRef.current) {
        setPhase((p) => (p === "open" || p === "opening" ? "ready" : p));
        return;
      }
      if (e.name === "checkout.error") {
        trackCredits("credits_paddle_failed", { stage: "checkout", pack: pack.key });
        setError("Paddle could not complete that. Nothing was charged. Please try again.");
      }
    };
    setPaddleListener(handle);
    return () => setPaddleListener(null);
  }, [confirm, pack.key]);

  const emailValid = EMAIL_RE.test(email.trim());

  const pay = async () => {
    if (!emailValid) {
      setError("Enter your email first so the credits reach you.");
      return;
    }
    setError(null);
    completedRef.current = false;
    const cleanEmail = email.trim();
    try {
      window.localStorage.setItem(EMAIL_STORAGE_KEY, cleanEmail);
    } catch {
      /* private mode */
    }

    setPhase("opening");
    trackCredits("credits_checkout_started", { provider: "paddle", pack: pack.key });

    try {
      const config = await getPaddleConfig();
      if (!config?.enabled) throw new Error("disabled");
      const paddle = await loadPaddle(config);
      paddleRef.current = paddle;
      const transactionId = await createPaddleTransaction(pack.key, cleanEmail);
      txnRef.current = transactionId;
      paddle.Checkout.open({
        transactionId,
        customer: { email: cleanEmail },
        settings: {
          displayMode: "overlay",
          theme: "dark",
          variant: "one-page",
          allowLogout: false,
          showAddDiscounts: false,
        },
      });
      setPhase("open");
    } catch (err) {
      trackCredits("credits_paddle_failed", {
        stage: "open",
        kind: err instanceof ApiError ? err.kind ?? String(err.status) : "network",
      });
      setPhase("ready");
      setError(
        err instanceof ApiError ? err.message : "Checkout could not open. Nothing was charged. Please try again."
      );
    }
  };

  if (phase === "done") {
    return (
      <div
        className={cn("rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4", className)}
        role="status"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
          <Check className="h-4 w-4" aria-hidden />
          {granted} credits added
        </p>
        <p className="mt-1 text-sm text-text-muted">A receipt is on its way to {email.trim()}.</p>
      </div>
    );
  }

  if (phase === "pending") {
    return (
      <div
        className={cn("rounded-xl border border-amber-500/30 bg-amber-500/5 p-4", className)}
        role="status"
      >
        <p className="flex items-center gap-2 text-sm font-medium text-amber-300">
          <Mail className="h-4 w-4" aria-hidden />
          Payment received, crediting is taking a moment
        </p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">
          Your credits and receipt will land at {email.trim()} automatically. Do not pay again. If
          nothing arrives within 10 minutes, email contact@audioforges.com and we will sort it out.
        </p>
      </div>
    );
  }

  if (phase === "unavailable") {
    return (
      <p className={cn("text-sm text-text-muted", className)}>
        Card checkout is unavailable right now. Please try again later.
      </p>
    );
  }

  const busy = phase === "loading" || phase === "opening" || phase === "open" || phase === "confirming";

  return (
    <div className={cn("space-y-3", className)}>
      <label className="block">
        <span className="mb-1.5 block text-sm text-text-muted">Email for your receipt</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={phase === "confirming"}
          aria-invalid={email.length > 0 && !emailValid}
          className="w-full rounded-lg border border-graphite-700 bg-graphite-900 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-graphite-500 focus:border-amber-500"
        />
      </label>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {phase === "confirming" ? (
        <p className="flex items-center gap-2 text-sm text-text-primary" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Confirming your payment
        </p>
      ) : (
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={pay}
          disabled={busy}
          loading={phase === "loading" || phase === "opening"}
          loadingLabel="Opening checkout"
        >
          Pay ${pack.price_usd.toFixed(2)}
        </Button>
      )}

      <p className="text-xs leading-relaxed text-text-muted">
        Card, Apple Pay, Google Pay and PayPal. Payments are processed by Paddle, our reseller and
        merchant of record. By paying you agree to the{" "}
        <Link href="/terms" className="underline hover:text-text-primary">Terms</Link> and{" "}
        <Link href="/refunds" className="underline hover:text-text-primary">Refund Policy</Link>.
        Credits from a failed run are returned automatically.
      </p>
    </div>
  );
}