"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCredits } from "@/components/credits/CreditProvider";

type Tier = "standard" | "studio";

const TIERS: { id: Tier; name: string; model: string; note: string; price: string }[] = [
  { id: "standard", name: "Standard", model: "Forge 1", note: "Bleed audible on dense mixes and long reverb tails.", price: "Costs nothing" },
  { id: "studio", name: "Studio Quality", model: "Forge 2", note: "Bleed gone. Cymbals and consonants intact.", price: "1 credit per track" },
];

export function TierCards({ standardSrc, studioSrc }: { standardSrc: string; studioSrc: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<Tier | null>(null);
  const { enabled, loading, isToolMetered, me } = useCredits();

  const cost = me?.paywall?.tools?.["separate-hq"]?.credits ?? 1;
  const studioPrice =
    enabled && !loading && !isToolMetered("separate-hq")
      ? "Free right now"
      : `${cost} ${cost === 1 ? "credit" : "credits"} per track`;

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
    void el.play().then(() => setPlaying(tier)).catch(() => setPlaying(null));
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <audio ref={audioRef} preload="none" onEnded={() => setPlaying(null)} />
      {TIERS.map((t) => {
        const live = playing === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            aria-pressed={live}
            className={cn(
              "surface grain group flex flex-col rounded-xl border p-6 text-left outline-none transition-colors duration-200",
              "focus-visible:ring-2 focus-visible:ring-amber-400/60",
              live ? "border-amber-500/60" : "border-graphite-800 hover:border-graphite-700"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-text-primary">{t.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-text-subtle">{t.model}</p>
              </div>
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
                  live
                    ? "border-amber-500 bg-amber-500 text-graphite-950"
                    : "border-graphite-700 text-text-primary group-hover:border-graphite-500"
                )}
              >
                {live ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
              </span>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-text-muted">{t.note}</p>
            <p className={cn("mt-5 font-mono text-[11px] uppercase tracking-[0.14em]", live ? "text-amber-400" : "text-text-subtle")}>
              {live ? "Playing" : t.id === "studio" ? studioPrice : t.price}
            </p>
          </button>
        );
      })}
    </div>
  );
}