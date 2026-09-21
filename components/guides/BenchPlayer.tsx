"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface BenchClip {
  id: string;
  label: string;
  src: string;
  note: string;
  highlight?: boolean;
}

interface Props {
  clips: BenchClip[];
}

export function BenchPlayer({ clips }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    const onTime = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => {
      setActive(null);
      setProgress(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = (clip: BenchClip) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (active === clip.id) {
      audio.pause();
      setActive(null);
      return;
    }
    audio.src = clip.src;
    audio.currentTime = 0;
    setProgress(0);
    void audio.play().catch(() => setActive(null));
    setActive(clip.id);
  };

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
      <ul className="divide-y divide-graphite-800">
        {clips.map((clip) => {
          const playing = active === clip.id;
          return (
            <li key={clip.id}>
              <button
                type="button"
                onClick={() => toggle(clip)}
                aria-pressed={playing}
                aria-label={`${playing ? "Pause" : "Play"} ${clip.label}`}
                className={cn(
                  "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-graphite-800/60",
                  playing && "bg-graphite-800/80"
                )}
              >
                {playing && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-500 transition-[width]"
                    style={{ width: `${progress * 100}%` }}
                  />
                )}
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                    playing
                      ? "border-amber-500 bg-amber-500 text-graphite-950"
                      : "border-graphite-700 text-text-primary"
                  )}
                >
                  {playing ? (
                    <Pause className="h-4 w-4" aria-hidden />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      clip.highlight ? "text-amber-300" : "text-text-primary"
                    )}
                  >
                    {clip.label}
                  </span>
                  <span className="block truncate text-xs text-text-muted">{clip.note}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}