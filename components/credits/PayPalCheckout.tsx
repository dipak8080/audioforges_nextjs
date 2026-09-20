"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ApiError } from "@/lib/api/railway";
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalConfig,
  loadPayPalSdk,
} from "@/lib/api/paypal";
import { useCredits } from "./CreditProvider";
import type { CreditPack } from "@/lib/types/credits";

const EMAIL_STORAGE_KEY = "af_claim_email";

type Phase = "loading" | "ready" | "paying" | "pending" | "done" | "unavailable";

interface Props {
  pack: CreditPack;
  onComplete?: (balance: number) => void;
  /** Fires when PayPal cannot render at all (SDK blocked or config off),
   *  so the parent can fall back to the Ko-fi flow. */
  onUnavailable?: () => void;
  className?: string;
}

/**
 * Pays for one pack without leaving the page. The email is collected first
 * because the backend records a claim against it before creating the order,
 * which is what puts the credits in this browser rather than only behind a
 * magic link.
 */
export function PayPalCheckout({ pack, onComplete, onUnavailable, className }: Props) {
  const { refresh, applyBalance } = useCredits();

  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef("");
  const emailValidRef = useRef(false);
  const renderedRef = useRef(false);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  // Read after mount rather than in an initialiser: this component is
  // server-rendered, and a localStorage value at first paint would not
  // match the server's empty string.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setEmail(saved);
    } catch {
      /* private mode */
    }
  }, []);

  // The PayPal buttons are rendered once and keep their original closures,
  // so the live email reaches them through refs rather than props.
  useEffect(() => {
    emailRef.current = email;
    emailValidRef.current = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleApproved = useCallback(
    async (orderId: string) => {
      setPhase("paying");
      setError(null);
      try {
        const result = await capturePayPalOrder(orderId);
        setGranted(result.credits);
        applyBalance(result.balance);
        setPhase("done");
        onComplete?.(result.balance);
        void refresh();
      } catch (err) {
        // The buyer has already approved the payment in the PayPal popup.
        // Unless the backend SAID nothing was charged, do not put the pay
        // buttons back - that is how one purchase becomes two. The webhook
        // is the backstop and grants the same capture id exactly once.
        const api = err instanceof ApiError ? err : null;

        if (api?.kind === "not_completed") {
          setPhase("ready");
          setError("The payment was not completed. Nothing was charged.");
          return;
        }
        if (api?.kind === "capture_failed") {
          setPhase("ready");
          setError(
            "PayPal could not confirm that payment. If you were charged, your credits will arrive automatically within a few minutes."
          );
          return;
        }
        if (api && api.status === 400) {
          setPhase("ready");
          setError(api.message);
          return;
        }

        setPhase("pending");
        setError(null);
      }
    },
    [applyBalance, onComplete, refresh]
  );

  useEffect(() => {
    let cancelled = false;

    const unavailable = () => {
      setPhase("unavailable");
      onUnavailableRef.current?.();
    };

    (async () => {
      const config = await getPayPalConfig();
      if (cancelled) return;

      if (!config || !config.enabled || !config.client_id) {
        unavailable();
        return;
      }

      try {
        await loadPayPalSdk(config.client_id, config.currency);
      } catch {
        if (!cancelled) unavailable();
        return;
      }

      if (cancelled || renderedRef.current || !containerRef.current) return;

      const paypal = (window as unknown as { paypal?: Record<string, unknown> }).paypal;
      const Buttons = paypal?.Buttons as
        | ((opts: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void> })
        | undefined;
      if (!Buttons) {
        unavailable();
        return;
      }

      renderedRef.current = true;

      Buttons({
        style: { layout: "vertical", shape: "rect", label: "pay", height: 44 },
        onClick: (_data: unknown, actions: { reject: () => unknown; resolve: () => unknown }) => {
          if (!emailValidRef.current) {
            setError("Enter your email first so the credits reach you.");
            return actions.reject();
          }
          setError(null);
          try {
            window.localStorage.setItem(EMAIL_STORAGE_KEY, emailRef.current.trim());
          } catch {
            /* private mode */
          }
          return actions.resolve();
        },
        createOrder: async () => createPayPalOrder(pack.key, emailRef.current.trim()),
        onApprove: async (data: { orderID: string }) => {
          await handleApproved(data.orderID);
        },
        onCancel: () => setError(null),
        onError: () =>
          setError("PayPal could not complete that. Nothing was charged. Please try again."),
      })
        .render(containerRef.current)
        .then(() => {
          if (!cancelled) setPhase("ready");
        })
        .catch(() => {
          if (!cancelled) unavailable();
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [pack.key, handleApproved]);

  // PayPal sometimes injects its card form inline instead of opening a
  // popup. It grows the container well past the button height, and inside
  // a scrolling modal that leaves the buyer looking at the top of a form
  // they cannot see the rest of.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || phase !== "ready" || typeof ResizeObserver === "undefined") return;

    let base = el.getBoundingClientRect().height;
    let scrolled = false;

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      if (!scrolled && h > base + 120) {
        scrolled = true;
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      } else if (h <= base + 40) {
        scrolled = false;
        base = h;
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

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
        <p className="mt-1 text-sm text-neutral-400">
          A receipt is on its way to {email.trim()}.
        </p>
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
        <p className="mt-1 text-sm leading-relaxed text-neutral-400">
          Your credits and receipt will land at {email.trim()} automatically. Do not pay again. If
          nothing arrives within 10 minutes, email contact@audioforges.com and we will sort it out.
        </p>
      </div>
    );
  }

  if (phase === "unavailable") {
    return (
      <p className={cn("text-sm text-neutral-400", className)}>
        Card checkout is unavailable right now.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <label className="block">
        <span className="mb-1.5 block text-sm text-neutral-300">Email for your receipt</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-invalid={email.length > 0 && !emailValid}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-500"
        />
      </label>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className={cn("relative", phase === "paying" && "pointer-events-none opacity-50")}>
        <div ref={containerRef} className={cn(phase === "loading" && "min-h-[101px]")} />
        {phase === "loading" && (
          <div className="absolute inset-x-0 top-0 space-y-[13px]" aria-hidden>
            <div className="h-11 animate-pulse rounded bg-neutral-800" />
            <div className="h-11 animate-pulse rounded bg-neutral-800/70" />
          </div>
        )}
      </div>

      {phase === "paying" && (
        <p className="flex items-center gap-2 text-sm text-neutral-300" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Confirming your payment
        </p>
      )}
    </div>
  );
}