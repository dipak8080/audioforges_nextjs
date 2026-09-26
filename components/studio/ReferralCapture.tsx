"use client";

import { useEffect } from "react";
import { claimReferral } from "@/lib/studio/account";
import { fetchStudioConfig } from "@/lib/studio/config";

const CODE_RE = /^[A-Za-z0-9]{4,16}$/;

export function ReferralCapture() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("ref");
    if (code === null) return;
    url.searchParams.delete("ref");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (!CODE_RE.test(code)) return;
    void fetchStudioConfig()
      .then((c) => (c.referral.enabled ? claimReferral(code) : null))
      .catch(() => null);
  }, []);
  return null;
}