"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useCredits } from "@/components/credits/CreditProvider";
import { cn } from "@/lib/utils/cn";

export type AdSize = "300x250" | "728x90";

const UNITS: Record<AdSize, { key: string; width: number; height: number }> = {
  "300x250": { key: "d7dcd6f0f39891584d1480b952d2daa0", width: 300, height: 250 },
  "728x90": { key: "8a3bfa2cff7be6182ff30504927cb0fa", width: 728, height: 90 },
};

// invoke.js reads the global atOptions, so slots load one at a time.
let queue: Promise<void> = Promise.resolve();

function AdSlot({ size }: { size: AdSize }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const unit = UNITS[size];

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    let cancelled = false;

    queue = queue.then(
      () =>
        new Promise<void>((resolve) => {
          if (cancelled || !slot.isConnected) return resolve();
          const conf = document.createElement("script");
          conf.text = `atOptions = {'key':'${unit.key}','format':'iframe','height':${unit.height},'width':${unit.width},'params':{}};`;
          const invoke = document.createElement("script");
          invoke.src = `https://www.highrevenueformat.com/${unit.key}/invoke.js`;
          invoke.async = true;
          const timer = window.setTimeout(resolve, 4000);
          const done = () => {
            window.clearTimeout(timer);
            resolve();
          };
          invoke.onload = done;
          invoke.onerror = done;
          slot.appendChild(conf);
          slot.appendChild(invoke);
        })
    );

    return () => {
      cancelled = true;
      slot.replaceChildren();
    };
  }, [unit]);

  return (
    <div
      ref={slotRef}
      aria-label="Advertisement"
      style={{ width: unit.width, height: unit.height }}
      className="flex max-w-full items-center justify-center overflow-hidden rounded-md"
    />
  );
}

export function useAdFree() {
  const { loading, balance, isCredited } = useCredits();
  return loading || balance > 0 || isCredited;
}

function Frame({ size, className }: { size: AdSize; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-subtle">
        Advertisement
      </span>
      <AdSlot key={size} size={size} />
    </div>
  );
}

// Anyone holding credits never sees an ad.
export function AdsterraBanner({ className, size = "300x250" }: { className?: string; size?: AdSize }) {
  const adFree = useAdFree();
  if (adFree) return null;
  return <Frame size={size} className={className} />;
}

const WIDE = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// 728x90 on wide screens, 300x250 on phones. Only one ever loads.
export function AdsterraTopBanner({ className }: { className?: string }) {
  const adFree = useAdFree();
  const wide = useSyncExternalStore<boolean | null>(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => null
  );

  if (adFree || wide === null) return null;
  return <Frame size={wide ? "728x90" : "300x250"} className={className} />;
}