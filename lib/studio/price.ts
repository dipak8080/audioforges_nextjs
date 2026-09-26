"use client";

import { useEffect, useState } from "react";
import { RAILWAY_API_BASE } from "@/lib/api/railway";
import type { MeteredToolKey } from "@/lib/types/credits";

export type WillUse = "none" | "free" | "credit" | "blocked";

export interface StudioPrice {
  billable: boolean;
  songs: number;
  extraSongs: number;
  waivedSongs: number;
  willUse: WillUse;
  balance: number;
  freeRemaining: number;
  canRun: boolean;
}

export interface StudioPriceRequest {
  tool: MeteredToolKey;
  vocalOptions: string[];
  stemCount: 4 | 6;
  inputSeconds?: number | null;
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function fetchStudioPrice(req: StudioPriceRequest, signal?: AbortSignal): Promise<StudioPrice | null> {
  try {
    const res = await fetch(`${RAILWAY_API_BASE}/credits/preview`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: req.tool,
        input_seconds: req.inputSeconds ?? null,
        vocal_options: req.vocalOptions,
        stem_count: req.stemCount,
      }),
      signal,
    });
    if (!res.ok) return null;
    const d = await res.json();
    const willUse: WillUse = ["none", "free", "credit", "blocked"].includes(d?.will_use) ? d.will_use : "none";
    return {
      billable: Boolean(d?.billable),
      songs: n(d?.credits_required),
      extraSongs: n(d?.extra_credits),
      waivedSongs: n(d?.extras_waived),
      willUse,
      balance: n(d?.balance),
      freeRemaining: n(d?.free_remaining),
      canRun: d?.can_run !== false,
    };
  } catch {
    return null;
  }
}

export function useStudioPrice(req: StudioPriceRequest, enabled = true): StudioPrice | null {
  const options = req.vocalOptions.join(",");
  const seconds = req.inputSeconds ? Math.round(req.inputSeconds) : null;
  const key = `${req.tool}|${options}|${req.stemCount}|${seconds ?? ""}`;
  const [result, setResult] = useState<{ key: string; price: StudioPrice | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      void fetchStudioPrice(
        { tool: req.tool, vocalOptions: options ? options.split(",") : [], stemCount: req.stemCount, inputSeconds: seconds },
        ctrl.signal
      ).then((price) => {
        if (!ctrl.signal.aborted) setResult({ key, price });
      });
    }, 150);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [enabled, key, req.tool, options, req.stemCount, seconds]);

  return result?.key === key ? result.price : null;
}