"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

export function PeaksBars({
  peaks,
  className,
  tone = "neutral",
  animate = true,
}: {
  peaks: number[];
  className?: string;
  tone?: "neutral" | "amber";
  animate?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const count = peaks.length;

  useEffect(() => {
    const el = ref.current;
    if (!el || !animate || count === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }], {
      duration: 700,
      easing: "cubic-bezier(.2,.7,.2,1)",
    });
  }, [animate, count, peaks]);

  if (count === 0) return null;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${count * 3} 100`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn("block h-full w-full", tone === "amber" ? "text-amber-500" : "text-text-muted", className)}
    >
      {peaks.map((p, i) => {
        const h = Math.max(2, p * 96);
        return <rect key={i} x={i * 3} y={50 - h / 2} width={2} height={h} rx={1} fill="currentColor" />;
      })}
    </svg>
  );
}