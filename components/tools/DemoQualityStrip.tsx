"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tier = "standard" | "studio";

export function DemoQualityStrip({
  standardSrc,
  studioSrc,
}: {
  standardSrc: string;
  studioSrc: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<Tier | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    return () => el?.pause();
  }, []);

  function toggle(tier: Tier) {
    const el = audioRef.current;
    if (!el) return;
    if (playing === tier) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = tier === "standard" ? standardSrc : studioSrc;
    el.currentTime = 0;
    void el
      .play()
      .then(() => setPlaying(tier))
      .catch(() => setPlaying(null));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-graphite-800 bg-graphite-950/40 px-3.5 py-2.5">
      <audio ref={audioRef} preload="none" onEnded={() => setPlaying(null)} />

      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500/90">
        Hear the difference
      </span>

      <div className="flex items-center gap-1.5">
        <TierButton
          label="Standard"
          active={playing === "standard"}
          onClick={() => toggle("standard")}
        />
        <TierButton
          label="Studio Quality"
          premium
          active={playing === "studio"}
          onClick={() => toggle("studio")}
        />
      </div>

      <span className="text-xs text-text-subtle">Same clip through both tiers.</span>
    </div>
  );
}

function TierButton({
  label,
  active,
  premium = false,
  onClick,
}: {
  label: string;
  active: boolean;
  premium?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
        active
          ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
          : premium
            ? "border-amber-500/35 text-amber-400/90 hover:border-amber-500/60 hover:text-amber-300"
            : "border-graphite-700 text-text-muted hover:border-graphite-600 hover:text-text-primary"
      )}
    >
      {active ? (
        <Pause className="h-3 w-3" aria-hidden />
      ) : (
        <Play className="h-3 w-3" aria-hidden />
      )}
      {label}
      {active && (
        <span className="flex h-3 items-end gap-[2px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-amber-400 animate-waveform"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      )}
    </button>
  );
}