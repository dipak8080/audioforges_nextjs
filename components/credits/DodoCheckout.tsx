"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, buttonStyles } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/railway";
import { getCreditsMe } from "@/lib/api/credits";
import { trackCredits } from "@/lib/analytics";
import { createDodoCheckout, getDodoConfig } from "@/lib/api/dodo";
import { useCredits } from "./CreditProvider";
import type { CreditPack } from "@/lib/types/credits";

const EMAIL_STORAGE_KEY = "af_claim_email";
const TOOL_TAB_KEY = "af_tool_tab_open";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECK_INTERVAL_MS = 5_000;
const WATCH_CEILING_MS = 15 * 60_000;

type Phase = "loading" | "ready" | "opening" | "waiting" | "blocked" | "done" | "unavailable";

interface Props {
  pack: CreditPack;
  onComplete?: (balance: number) => void;
  className?: string;
}

export function DodoCheckout({ pack, onComplete, className }: Props) {
  const { balance, refresh, applyBalance } = useCredits();

  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(EMAIL_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  const baseline = useRef(0);
  const watchStarted = useRef(0);
  const settled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await getDodoConfig();
      if (cancelled) return;
      if (!config?.enabled) {
        trackCredits("credits_dodo_unavailable", { pack: pack.key, stage: "config" });
        setPhase("unavailable");
        return;
      }
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [pack.key]);

  const land = useCallback(
    (nextBalance: number) => {
      if (settled.current) return;
      settled.current = true;
      setGranted(Math.max(0, nextBalance - baseline.current));
      applyBalance(nextBalance);
      setPhase("done");
      trackCredits("credits_purchase_confirmed", {
        provider: "dodo",
        pack: pack.key,
        balance: nextBalance,
      });
      onComplete?.(nextBalance);
      void refresh();
    },
    [applyBalance, onComplete, refresh, pack.key]
  );

  const checkNow = useCallback(async () => {
    if (settled.current) return;
    try {
      const me = await getCreditsMe();
      if (me && me.balance > baseline.current) land(me.balance);
    } catch {
      /* transient, the interval comes back around */
    }
  }, [land]);

  useEffect(() => {
    if (phase !== "waiting" && phase !== "blocked") return;

    const onReturn = () => {
      if (document.visibilityState === "visible") void checkNow();
    };

    const timer = setInterval(() => {
      if (Date.now() - watchStarted.current > WATCH_CEILING_MS) {
        clearInterval(timer);
        setGaveUp(true);
        return;
      }
      void checkNow();
    }, CHECK_INTERVAL_MS);

    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [phase, checkNow]);

  const emailValid = EMAIL_RE.test(email.trim());

  const pay = async () => {
    if (!emailValid) {
      setError("Enter your email first so the credits reach you.");
      return;
    }
    setError(null);
    const cleanEmail = email.trim();
    try {
      window.localStorage.setItem(EMAIL_STORAGE_KEY, cleanEmail);
    } catch {
      /* private mode */
    }

    // Opened inside the click so popup blockers allow it; filled in once the session exists.
    const tab = window.open("", "_blank");
    if (tab) {
      try {
        tab.document.title = "Opening checkout";
        tab.document.body.style.cssText =
          "background:#151515;color:#bbb;font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0";
        tab.document.body.textContent = "Opening secure checkout...";
      } catch {
        /* cross-origin guard, harmless */
      }
    }

    setPhase("opening");
    trackCredits("credits_checkout_started", { provider: "dodo", pack: pack.key });

    try {
      const url = await createDodoCheckout(pack.key, cleanEmail);
      setCheckoutUrl(url);
      baseline.current = balance;
      watchStarted.current = Date.now();
      settled.current = false;
      setGaveUp(false);
      try {
        window.localStorage.setItem(TOOL_TAB_KEY, String(Date.now()));
      } catch {
        /* storage disabled */
      }

      if (tab && !tab.closed) {
        tab.opener = null;
        tab.location.href = url;
        setPhase("waiting");
      } else {
        trackCredits("credits_checkout_popup_blocked", { provider: "dodo", pack: pack.key });
        setPhase("blocked");
      }
    } catch (err) {
      tab?.close();
      trackCredits("credits_dodo_failed", {
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
          {granted > 0 ? `${granted} credits added` : "Credits added"}
        </p>
        <p className="mt-1 text-sm text-text-muted">A receipt is on its way to {email.trim()}.</p>
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

  if (phase === "waiting" || phase === "blocked") {
    return (
      <div className={cn("space-y-3", className)} role="status" aria-live="polite">
        {phase === "blocked" && checkoutUrl ? (
          <>
            <p className="text-sm leading-relaxed text-text-muted">
              Your browser blocked the checkout tab. Open it here:
            </p>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles({ variant: "primary", size: "lg", className: "w-full" })}
            >
              Open secure checkout
              <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
            </a>
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-text-primary">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
            Finish paying in the checkout tab
          </p>
        )}
        <p className="text-sm leading-relaxed text-text-muted">
          Keep this tab open. Your credits appear here on their own once the payment goes through.
        </p>
        {gaveUp && (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-amber-300">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            If you paid, your credits are safe and attached to {email.trim()}. Do not pay again. If
            nothing shows up, email contact@audioforges.com.
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={() => void checkNow()}>
          I have paid, check now
        </Button>
      </div>
    );
  }

  const busy = phase === "loading" || phase === "opening";

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
          aria-invalid={email.length > 0 && !emailValid}
          className="w-full rounded-lg border border-graphite-700 bg-graphite-900 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-graphite-500 focus:border-amber-500"
        />
      </label>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={pay}
        disabled={busy}
        loading={busy}
        loadingLabel="Opening checkout"
      >
        Pay ${pack.price_usd.toFixed(2)}
      </Button>

      <p className="text-xs leading-relaxed text-text-muted">
        Card and local payment methods, plus local tax where it applies. Checkout opens in a new tab.
        Payments are processed by Dodo Payments, our reseller and merchant of record. By paying you
        agree to the{" "}
        <Link href="/terms" className="underline hover:text-text-primary">Terms</Link> and{" "}
        <Link href="/refunds" className="underline hover:text-text-primary">Refund Policy</Link>.
        Credits from a failed run are returned automatically.
      </p>
    </div>
  );
}