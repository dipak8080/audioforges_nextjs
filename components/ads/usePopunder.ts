"use client";

import { useEffect } from "react";
import { useAdFree } from "@/components/ads/AdsterraBanner";

const SRC = "https://pl31513082.profitableratecpmnetwork.com/85/58/48/8558486e0f80efb3fe66edffb3463de2.js";
const STORE_KEY = "af_pop_at";
const EVERY_MS = 24 * 60 * 60 * 1000;

let loaded = false;

function recentlyShown() {
  try {
    const at = Number(window.localStorage.getItem(STORE_KEY) ?? 0);
    return Date.now() - at < EVERY_MS;
  } catch {
    return false;
  }
}

// Loads once the result is ready, so the Download click is the one that opens it.
export function usePopunder(ready: boolean, enabled = true) {
  const adFree = useAdFree();

  useEffect(() => {
    if (!ready || !enabled || adFree || loaded || recentlyShown()) return;
    loaded = true;
    try {
      window.localStorage.setItem(STORE_KEY, String(Date.now()));
    } catch {}
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    document.body.appendChild(script);
  }, [ready, enabled, adFree]);
}