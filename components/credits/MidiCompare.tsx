"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * The proof for transcription. "High accuracy" is an adjective until someone
 * hears the model miss a note and the other one catch it.
 *
 * THREE sources, not two, and that is the whole difference from StemCompare.
 * Separation is judged against the other output; transcription is only
 * meaningful against the ORIGINAL. Hearing the melody, then a standard render
 * that drops notes, then a high-accuracy render that follows it, is the entire
 * argument in fifteen seconds with no claim attached to it.
 *
 * Renders NOTHING until all three sources are set, so it can ship today and
 * lights up when the clips land in /public.
 *
 * Cost: zero. Three static files. Render both .mid outputs through one clean
 * patch in a DAW and bounce them — a browser soundfont needs a synth library
 * and a .sf2 download and still sounds worse than the thing being demonstrated.
 *
 * The clips MUST be the same length and level-matched. Instant switching at a
 * shared playhead is the point, and it falls apart if the renders drift.
 */

type Variant = "original" | "standard" | "hq";

const ORDER: Variant[] = ["original", "standard", "hq"];

const LABELS: Record<Variant, { title: string; note: string }> = {
  original: { title: "Original", note: "Source audio" },
  standard: { title: "Standard", note: "Always free" },
  hq: { title: "High accuracy", note: "1 credit" },
};

export function MidiCompare({
  originalSrc,
  standardSrc,
  hqSrc,
  trackLabel,
  sourceLabel = "Melody",
}: {
  originalSrc?: string;
  standardSrc?: string;
  hqSrc?: string;
  /** e.g. "Sung melody, room tone" — say why this clip is a fair test. */
  trackLabel?: string;
  sourceLabel?: string;
}) {
  const originalRef = useRef<HTMLAudioElement | null>(null);
  const standardRef = useRef<HTMLAudioElement | null>(null);
  const hqRef = useRef<HTMLAudioElement | null>(null);

  const [active, setActive] = useState<Variant>("original");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [armed, setArmed] = useState(false);

  const refFor = useCallback((v: Variant) => {
    if (v === "original") return originalRef.current;
    if (v === "standard") return standardRef.current;
    return hqRef.current;
  }, []);

  const allRefs = useCallback(
    () => [originalRef.current, standardRef.current, hqRef.current],
    []
  );

  // A bare <audio> keeps playing through a route change.
  useEffect(() => {
    return () => {
      originalRef.current?.pause();
      standardRef.current?.pause();
      hqRef.current?.pause();
    };
  }, []);

  /**
   * Instant A/B/C is the promise, so the inactive clips have to be buffered
   * before the switch. Deferring to the first press keeps three files off the
   * wire for every visitor who never plays it — most of them.
   */
  const arm = useCallback(() => {
    if (armed) return;
    setArmed(true);
    for (const el of allRefs()) {
      if (!el) continue;
      el.preload = "auto";
      el.load();
    }
  }, [armed, allRefs]);

  if (!originalSrc || !standardSrc || !hqSrc) return null;

  function toggle() {
    const el = refFor(active);
    if (!el) return;
    if (el.paused) {
      arm();
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }

  function switchTo(next: Variant) {
    if (next === active) return;
    const from = refFor(active);
    const to = refFor(next);
    if (!from || !to) return;
    arm();
    const at = from.currentTime;
    const wasPlaying = !from.paused;
    from.pause();
    to.currentTime = at;
    if (wasPlaying) void to.play().catch(() => {});
    setActive(next);
  }

  function seekTo(seconds: number) {
    if (!duration) return;
    const at = Math.min(duration, Math.max(0, seconds));
    // All three, always — an inactive element at a different point makes the
    // next switch jump.
    for (const el of allRefs()) {
      if (el) el.currentTime = at;
    }
    setTime(at);
  }

  function seekFromPointer(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  }

  function cycle(step: number) {
    const i = ORDER.indexOf(active);
    switchTo(ORDER[(i + step + ORDER.length) % ORDER.length]);
  }

  function handleSliderKey(e: React.KeyboardEvent) {
    if (!duration) return;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        seekTo(time - 5);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        seekTo(time + 5);
        break;
      case "Home":
        e.preventDefault();
        seekTo(0);
        break;
      case "End":
        e.preventDefault();
        seekTo(duration - 0.05);
        break;
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        toggle();
        break;
    }
  }

  /** Whichever element reports first wins; the clips are the same length by
   *  construction. */
  function reportDuration(el: HTMLAudioElement) {
    const reported = el.duration;
    if (Number.isFinite(reported) && reported > 0) setDuration(reported);
  }

  function handleEnded() {
    setPlaying(false);
    for (const el of allRefs()) {
      if (el) el.currentTime = 0;
    }
    setTime(0);
  }

  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <figure className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
      <audio
        ref={originalRef}
        src={originalSrc}
        preload="metadata"
        onLoadedMetadata={(e) => reportDuration(e.currentTarget)}
        onDurationChange={(e) => reportDuration(e.currentTarget)}
        onTimeUpdate={(e) => active === "original" && setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />
      <audio
        ref={standardRef}
        src={standardSrc}
        preload="metadata"
        onLoadedMetadata={(e) => reportDuration(e.currentTarget)}
        onDurationChange={(e) => reportDuration(e.currentTarget)}
        onTimeUpdate={(e) => active === "standard" && setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />
      <audio
        ref={hqRef}
        src={hqSrc}
        preload="metadata"
        onLoadedMetadata={(e) => reportDuration(e.currentTarget)}
        onDurationChange={(e) => reportDuration(e.currentTarget)}
        onTimeUpdate={(e) => active === "hq" && setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />

      <div className="flex items-center justify-between border-b border-graphite-800 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
          {sourceLabel} to MIDI
        </span>
        {trackLabel && <span className="truncate pl-3 text-xs text-text-subtle">{trackLabel}</span>}
      </div>

      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 outline-none",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
            "transition-[background-color,transform] duration-150",
            "hover:bg-amber-400 active:translate-y-px active:bg-amber-600 motion-reduce:active:translate-y-0",
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
          role="slider"
          aria-label="Seek"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={time}
          aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
          tabIndex={duration ? 0 : -1}
          onKeyDown={handleSliderKey}
          onClick={seekFromPointer}
          className={cn(
            "group h-11 flex-1 rounded-md outline-none",
            "focus-visible:ring-2 focus-visible:ring-amber-500/40",
            duration ? "cursor-pointer" : "cursor-default"
          )}
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

      <div className="px-4 pb-4">
        {/* Three detents rather than two. Arrow keys move between them so the
            whole comparison is reachable without a mouse. */}
        <div
          role="radiogroup"
          aria-label="Transcription source"
          className="grid grid-cols-3 rounded-lg border border-graphite-700 bg-graphite-950 p-1"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              cycle(1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              cycle(-1);
            }
          }}
        >
          {ORDER.map((v) => (
            <VariantButton
              key={v}
              selected={active === v}
              onSelect={() => switchTo(v)}
              title={LABELS[v].title}
              note={LABELS[v].note}
            />
          ))}
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-text-subtle">
          Same clip, same bar. Start with the original, then switch while it&apos;s playing
          &mdash; it stays at the same point.
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
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "rounded-md px-2 py-2 text-center outline-none transition-colors",
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