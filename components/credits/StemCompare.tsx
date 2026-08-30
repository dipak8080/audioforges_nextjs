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
 *
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. DURATION CAME FROM ONE CLIP ONLY. `onLoadedMetadata` was on the standard
 *    element; the Studio Quality one had no handler at all. If that first file
 *    was slow, blocked, or 404 — which is exactly the state this component
 *    ships in until the clips are uploaded — `duration` stayed 0, so the
 *    readout said "0:00 / 0:00", the bar never moved, and seeking did nothing.
 *    Either clip can report it now.
 *
 * 2. THE SCRUB BAR WAS UNREACHABLE BY KEYBOARD. `role="presentation"` on a div
 *    with an onClick is, to assistive tech, explicitly not a control — so the
 *    only way to move the playhead was a mouse. It's a real slider now, with
 *    arrows, Home/End and a spoken position.
 *
 * 3. BOTH FILES DOWNLOADED ON PAGE LOAD. `preload="auto"` on two clips, on a
 *    page where most visitors never press play. They're metadata-only until
 *    the first play, at which point BOTH are told to buffer — instant
 *    switching is the entire point, so the second one can't wait for the
 *    switch itself.
 *
 * 4. PLAY STATE WAS ASSUMED, NOT OBSERVED. `setPlaying(true)` fired before
 *    `play()` resolved, so a rejected play — autoplay policy, a decode error —
 *    left a pause icon over silence. The element's own play/pause events drive
 *    it now, and every play() rejection is swallowed rather than surfacing as
 *    an unhandled rejection in the console.
 *
 * 5. ENDING LEFT THE BAR FULL. `onEnded` cleared the play state but left both
 *    elements parked at the end and the progress bar at 100%, so pressing play
 *    again jumped from a full bar back to an empty one.
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
  /** Both clips buffer only once someone actually presses play. */
  const [armed, setArmed] = useState(false);

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

  /**
   * Instant A/B is the whole promise, so the inactive clip has to be buffered
   * before the switch, not after it. Deferring both to the first press keeps
   * two audio files off the wire for every visitor who never plays it — which,
   * on a pricing page, is most of them.
   */
  const arm = useCallback(() => {
    if (armed) return;
    setArmed(true);
    for (const el of [stdRef.current, hqRef.current]) {
      if (!el) continue;
      el.preload = "auto";
      el.load();
    }
  }, [armed]);

  if (!standardSrc || !studioSrc) return null;

  function toggle() {
    const el = refFor(active);
    if (!el) return;
    if (el.paused) {
      arm();
      // Rejections are normal here (autoplay policy, a decode that failed) and
      // the element's own pause event keeps the icon honest either way.
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
    // Both, always — the inactive element has to be at the same point or the
    // next switch jumps.
    if (stdRef.current) stdRef.current.currentTime = at;
    if (hqRef.current) hqRef.current.currentTime = at;
    setTime(at);
  }

  function seekFromPointer(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
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

  /** Either element can report it, and whichever gets there first wins. The
   *  clips are the same length by construction. */
  function reportDuration(el: HTMLAudioElement) {
    const reported = el.duration;
    if (Number.isFinite(reported) && reported > 0) setDuration(reported);
  }

  function handleEnded() {
    setPlaying(false);
    // Reset BOTH, and the readout with them. Leaving the elements at the end
    // with a full bar meant the next press jumped from 100% back to 0.
    if (stdRef.current) stdRef.current.currentTime = 0;
    if (hqRef.current) hqRef.current.currentTime = 0;
    setTime(0);
  }

  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <figure className="overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900">
      <audio
        ref={stdRef}
        src={standardSrc}
        preload="metadata"
        onLoadedMetadata={(e) => reportDuration(e.currentTarget)}
        onDurationChange={(e) => reportDuration(e.currentTarget)}
        onTimeUpdate={(e) => active === "standard" && setTime(e.currentTarget.currentTime)}
        // Observed, not assumed — a rejected play() used to leave a pause icon
        // sitting over silence.
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />
      <audio
        ref={hqRef}
        src={studioSrc}
        preload="metadata"
        // Was missing entirely, so if the standard clip didn't load there was
        // no duration at all and the whole transport sat dead at 0:00.
        onLoadedMetadata={(e) => reportDuration(e.currentTarget)}
        onDurationChange={(e) => reportDuration(e.currentTarget)}
        onTimeUpdate={(e) => active === "studio" && setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={handleEnded}
      />

      <div className="flex items-center justify-between border-b border-graphite-800 px-4 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
          {stemLabel} stem
        </span>
        {trackLabel && <span className="truncate pl-3 text-xs text-text-subtle">{trackLabel}</span>}
      </div>

      <div className="flex items-center gap-3 p-4">
        {/* Circular and hand-rolled on purpose: that's transport convention,
            not drift. It wears the same inset highlight and press as Button. */}
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

        {/* A real slider. `role="presentation"` told assistive tech this was
            explicitly not a control, so the playhead was mouse-only. */}
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

      {/* Same segmented language as the pack rail — one control vocabulary.
          Hand-rolled for the same reason: these are radio detents with a label
          over a note, not buttons. */}
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
          Same track, same bar, matched levels. Switch while it&apos;s playing — it stays at the
          same point.
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