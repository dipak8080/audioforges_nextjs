"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "audioforges_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  const accept = () => {
    window.localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] border-t border-graphite-800 bg-graphite-900/95 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <p className="text-sm text-text-muted text-center sm:text-left flex-1">
          We use cookies for analytics and to show relevant ads. See our{" "}
          <Link href="/privacy" className="text-amber-400 hover:underline">
            Privacy Policy
          </Link>{" "}
          for details.
        </p>
        <button
          onClick={accept}
          className="shrink-0 rounded-lg bg-amber-500 text-graphite-950 font-medium text-sm px-4 py-2 hover:bg-amber-400 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}