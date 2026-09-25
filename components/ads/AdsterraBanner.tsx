"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";

const KEY = "d7dcd6f0f39891584d1480b952d2daa0";

export function AdsterraBanner({ className }: { className?: string }) {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const conf = document.createElement("script");
    conf.text = `atOptions = {'key':'${KEY}','format':'iframe','height':250,'width':300,'params':{}};`;
    const invoke = document.createElement("script");
    invoke.src = `https://www.highrevenueformat.com/${KEY}/invoke.js`;
    invoke.async = true;

    slot.appendChild(conf);
    slot.appendChild(invoke);

    return () => {
      slot.replaceChildren();
    };
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
        Advertisement
      </span>
      <div
        ref={slotRef}
        aria-label="Advertisement"
        className="flex h-[250px] w-[300px] max-w-full items-center justify-center overflow-hidden rounded-md"
      />
    </div>
  );
}