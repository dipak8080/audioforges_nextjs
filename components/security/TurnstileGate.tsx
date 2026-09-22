"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import { settleTurnstile, subscribeTurnstile, TURNSTILE_SITE_KEY } from "@/lib/security/turnstile";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Mounted once, sitewide. Shows the challenge only when the API asks for it.
export function TurnstileGate() {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);

  useEffect(
    () =>
      subscribeTurnstile((next) => {
        setOpen(next);
        if (next) setFailed(false);
      }),
    []
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !slotRef.current || !window.turnstile) return;
        widgetRef.current = window.turnstile.render(slotRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => settleTurnstile(token),
          "error-callback": () => setFailed(true),
          "expired-callback": () => setFailed(true),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetRef.current);
        } catch {
          // widget already gone
        }
      }
      widgetRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settleTurnstile(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="turnstile-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-graphite-950/80 p-4 backdrop-blur-sm"
    >
      <div className="surface grain w-full max-w-sm overflow-hidden rounded-2xl border border-graphite-800 shadow-2xl">
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p id="turnstile-title" className="text-sm font-semibold text-text-primary">
              Quick check
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
              Free runs are open to everyone, so after a few in a day we confirm you&apos;re a person. Once is enough.
            </p>
          </div>
          <button
            type="button"
            onClick={() => settleTurnstile(null)}
            aria-label="Close"
            className="rounded-md p-1 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-[90px] items-center justify-center px-5 py-5">
          {failed ? (
            <p className="text-center text-sm text-red-400">
              The check couldn&apos;t load. Close this and try again in a moment.
            </p>
          ) : (
            <div ref={slotRef} />
          )}
        </div>
        <p className="border-t border-graphite-800 bg-graphite-950/40 px-5 py-2.5 text-[11px] text-text-subtle">
          Credits skip this entirely.
        </p>
      </div>
    </div>
  );
}