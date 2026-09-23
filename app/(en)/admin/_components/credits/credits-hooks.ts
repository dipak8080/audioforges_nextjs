"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "./credits-net";
import type { Filters, Overview } from "./credits-types";

/**
 * The page fills from wherever it starts to the bottom of the window. Measured
 * rather than hardcoded (`h-screen minus 4rem`) because the admin chrome above
 * this page can change height — and a wrong constant here is exactly what makes
 * the last table row unreachable.
 */
export function useShellHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY - window.scrollY;
      setHeight(Math.max(360, Math.round(window.innerHeight - top)));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && el.parentElement) ro.observe(el.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, []);

  return [ref, height] as const;
}

/** Tool/status/charge options come from the server. Never a constant here. */
export function useJobFilters() {
  const [filters, setFilters] = useState<Filters>({});
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        setFilters(await api<Filters>("/api/admin/credits?view=filters", { signal: c.signal }));
      } catch {
        /* dropdowns fall back to "any" — views still work unfiltered */
      }
    })();
    return () => c.abort();
  }, []);
  return filters;
}

export function useOverview(tick: number) {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        setData(await api<Overview>("/api/admin/credits?view=overview", { signal: c.signal }));
      } catch {
        /* the KPI rail degrades to dashes rather than blocking the page */
      }
    })();
    return () => c.abort();
  }, [tick]);
  return data;
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */