"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_EVENT,
  applyConsent,
  readConsent,
  writeConsent,
  type ConsentChoice,
} from "@/lib/consent";

const AHREFS_SRC = "https://analytics.ahrefs.com/analytics.js";
const AHREFS_KEY = "QkVPNT1O6u+JbZ5njmaMTw";

function loadAhrefs() {
  if (document.querySelector(`script[src="${AHREFS_SRC}"]`)) return;
  const script = document.createElement("script");
  script.src = AHREFS_SRC;
  script.async = true;
  script.setAttribute("data-key", AHREFS_KEY);
  document.head.appendChild(script);
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  const decide = useCallback((choice: ConsentChoice) => {
    writeConsent(choice);
    applyConsent(choice);
    if (choice === "granted") loadAhrefs();
    setOpen(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const stored = readConsent();
    if (stored) {
      applyConsent(stored);
      if (stored === "granted") loadAhrefs();
      return;
    }

    fetch("/api/geo")
      .then((res) => (res.ok ? res.json() : { requiresConsent: true }))
      .then((data: { requiresConsent?: boolean }) => {
        if (cancelled) return;
        if (data.requiresConsent === false) {
          applyConsent("granted");
          loadAhrefs();
          return;
        }
        setOpen(true);
      })
      .catch(() => {
        if (!cancelled) setOpen(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-graphite-700 bg-graphite-900/95 px-4 py-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-muted">
          We use analytics cookies to see which tools get used and what breaks. Nothing is sold
          and nothing is shared with advertisers. Read the{" "}
          <Link href="/privacy" className="text-amber-400 underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide("denied")}
            className="rounded-lg border border-graphite-700 px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-graphite-600 hover:bg-graphite-850"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => decide("granted")}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-graphite-950 transition-colors hover:bg-amber-400"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}