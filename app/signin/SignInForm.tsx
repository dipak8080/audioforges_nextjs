"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Mail } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { requestMagicLink } from "@/lib/api/credits";
import { trackCredits } from "@/lib/analytics";
import { ApiError } from "@/lib/api/railway";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = useCallback(async () => {
    if (sending) return;
    if (!valid) {
      setError("Enter the email address you used when you bought credits.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await requestMagicLink(email.trim());
      trackCredits("credits_magic_link_requested", { source: "signin_page" });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? "Too many sign-in emails. Try again in an hour."
          : "That didn't send. Try again in a moment."
      );
    } finally {
      setSending(false);
    }
  }, [sending, valid, email]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-20 sm:py-28">
      <h1 className="text-3xl font-bold tracking-[-0.02em] text-text-primary">Sign in</h1>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        Credits live with your email, not with this device. Enter the address you used at checkout
        and we will send a link that brings your balance here.
      </p>

      {sent ? (
        <div
          role="status"
          className="mt-8 flex items-start gap-2.5 rounded-xl border border-graphite-800 bg-graphite-900 p-4"
        >
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <p className="text-sm leading-relaxed text-text-muted">
            Link sent to <span className="text-text-primary">{email.trim()}</span>. Open it on this
            device. It works once and expires in 30 minutes.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <label htmlFor="signin-email" className="block text-sm text-text-primary">
            Email address
          </label>
          <input
            id="signin-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="you@example.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signin-error" : undefined}
            className="w-full rounded-lg border border-graphite-800 bg-graphite-900 px-3.5 py-2.5 text-text-primary outline-none placeholder:text-text-subtle focus-visible:border-amber-500/60 focus-visible:ring-2 focus-visible:ring-amber-400/40"
          />
          {error ? (
            <p id="signin-error" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className={buttonStyles({ variant: "primary", size: "md", className: "w-full" })}
          >
            {sending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Mail />}
            {sending ? "Sending" : "Email me a sign-in link"}
          </button>
        </div>
      )}

      <p className="mt-8 text-sm leading-relaxed text-text-muted">
        No account yet? Every free tool works without one.{" "}
        <Link href="/pricing" className="text-amber-400 hover:underline">
          See credit packs
        </Link>
        .
      </p>
    </main>
  );
}