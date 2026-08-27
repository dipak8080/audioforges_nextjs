"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The proof. "Studio Quality" is an adjective until someone hears it.
 *
 * Two clips of the SAME section of the SAME track, level-matched, swapped
 * instantly at the same playhead position. Restarting on switch would be
 * useless — the whole point is hearing the same bar twice back to back.
 *
 * Renders NOTHING until both sources are set, so it can be dropped into the
 * page today and lights up the moment the clips land in /public.
 *
 * Cost: zero. It's two static files, not a live per-user preview — RunPod
 * bills full worker-active time including cold start, so a 30s preview is
 * about half a real job.
 */

type Variant = "standard" | "studio";

export function StemCompare({
  standardSrc,
  studioSrc,
  trackLabel,
  stemLabel = "Vocals",
}: {
  standardSrc?: string;
  studioSrc?: string;
  /** e.g. "Dense mix, heavy reverb tail" — say why this clip is a fair test. */
  trackLabel?: string;
  stemLabel?: string;
}) {
  const stdRef = useRef<HTMLAudioElement | null>(null);
  const hqRef = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState<Variant>("standard");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const refFor = useCallback(
    (v: Variant) => (v === "standard" ? stdRef.current : hqRef.current),
    []
  );

  // Pause both on unmount — a bare <audio> keeps playing through a route change.
  useEffect(() => {
    return () => {
      stdRef.current?.pause();
      hqRef.current?.pause();
    };
  }, []);

  if (!standardSrc || !studioSrc) return null;

  function toggle() {
    const el = refFor(active);
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function switchTo(next: Variant) {
    if (next === active) return;
    const from = refFor(active);
    const to = refFor(next);
    if (!from || !to) return;
    const at = from.currentTime;
    const wasPlaying = !from.paused;
    from.pause();
    to.currentTime = at;
    if (wasPlaying) void to.play();
    setActive(next);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = refFor(active);
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const at = ratio * duration;
    if (stdRef.current) stdRef.current.currentTime = at;
    if (hqRef.current) hqRef.current.currentTime = at;
    setTime(at);
  }

  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <figure className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
      <audio
        ref={stdRef}
        src={standardSrc}
        preload="auto"
        onTimeUpdate={(e) => active === "standard" && setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <audio
        ref={hqRef}
        src={studioSrc}
        preload="auto"
        onTimeUpdate={(e) => active === "studio" && setTime(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />

      <div className="flex items-center justify-between border-b border-graphite-800 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
          {stemLabel} stem
        </span>
        {trackLabel && (
          <span className="truncate pl-3 text-xs text-text-subtle">{trackLabel}</span>
        )}
      </div>

      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 outline-none",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-amber-400",
            "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-900"
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>

        <div
          role="presentation"
          onClick={seek}
          className="group h-11 flex-1 cursor-pointer"
        >
          <div className="relative top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-graphite-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-100 ease-linear motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
          {fmt(time)} / {fmt(duration)}
        </span>
      </div>

      {/* Same segmented language as the pack rail — one control vocabulary. */}
      <div className="px-4 pb-4">
        <div
          role="radiogroup"
          aria-label="Separation quality"
          className="flex rounded-lg border border-graphite-700 bg-graphite-950 p-1"
        >
          <VariantButton
            selected={active === "standard"}
            onSelect={() => switchTo("standard")}
            title="Standard"
            note="Free, unlimited"
          />
          <VariantButton
            selected={active === "studio"}
            onSelect={() => switchTo("studio")}
            title="Studio Quality"
            note="1 credit"
          />
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-text-subtle">
          Same track, same bar, matched levels. Switch while it&apos;s playing —
          it stays at the same point.
        </p>
      </div>
    </figure>
  );
}

function VariantButton({
  selected,
  onSelect,
  title,
  note,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  note: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex-1 rounded-md px-3 py-2 text-center outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-graphite-950",
        selected
          ? "bg-amber-500 text-graphite-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
          : "text-text-muted hover:text-text-primary"
      )}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span
        className={cn(
          "mt-0.5 block text-[11px]",
          selected ? "text-graphite-950/70" : "text-text-subtle"
        )}
      >
        {note}
      </span>
    </button>
  );
}

function fmt(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}