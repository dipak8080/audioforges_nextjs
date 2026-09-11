"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MIN_SPIN_MS = 700;

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function RefreshControl({
  busy,
  lastUpdated,
  onRefresh,
  auto,
  onAutoChange,
  autoEveryMs = 30_000,
  className,
}: {
  busy: boolean;
  lastUpdated: number | null;
  onRefresh: () => void;
  auto?: boolean;
  onAutoChange?: (next: boolean) => void;
  autoEveryMs?: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [holdSpin, setHoldSpin] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const click = () => {
    setHoldSpin(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHoldSpin(false), MIN_SPIN_MS);
    onRefresh();
  };

  const spinning = busy || holdSpin;
  const nextIn =
    auto && lastUpdated ? Math.max(0, Math.ceil((lastUpdated + autoEveryMs - now) / 1000)) : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="hidden min-w-[7.5rem] text-right text-[12px] tabular-nums text-text-subtle sm:inline"
        aria-live="polite"
      >
        {spinning ? "Updating…" : lastUpdated ? `Updated ${ago(lastUpdated, now)}` : ""}
      </span>

      {onAutoChange && (
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(auto)}
          onClick={() => onAutoChange(!auto)}
          title={`Reload every ${Math.round(autoEveryMs / 1000)} seconds`}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70",
            auto
              ? "border-teal-500/40 bg-teal-500/10 text-teal-300"
              : "border-graphite-700 bg-graphite-850/80 text-text-muted hover:text-text-primary"
          )}
        >
          <span
            aria-hidden
            className={cn(
              "relative h-4 w-7 rounded-full transition-colors",
              auto ? "bg-teal-500/70" : "bg-graphite-700"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-text-primary transition-[left]",
                auto ? "left-3.5" : "left-0.5"
              )}
            />
          </span>
          <span className="whitespace-nowrap">
            Auto-refresh
            {auto && nextIn !== null && (
              <span className="ml-1 tabular-nums text-teal-400/80">{nextIn}s</span>
            )}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={click}
        disabled={busy}
        aria-busy={spinning}
        title="Refresh (r)"
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-850/80 px-3 text-[13px] font-medium text-text-muted outline-none transition-colors",
          "hover:border-graphite-600 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70",
          "disabled:cursor-progress",
          spinning && "text-text-primary"
        )}
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", spinning && "animate-spin text-amber-400 motion-reduce:animate-none")}
          aria-hidden
        />
        Refresh
      </button>
    </div>
  );
}