"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

const FADE_MAX_SECONDS = 30;
const WAVEFORM_BUCKETS = 220;
const KEY_STEP = 0.1;
const KEY_STEP_LARGE = 1;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

// Downsamples one channel of decoded audio into N peak values (max
// absolute amplitude per bucket), purely for the waveform backdrop.
// Runs once per file, on the main thread - acceptable for a one-off
// action on files capped at 50MB, shown behind a brief loading state.
function computePeaks(buffer: AudioBuffer, buckets: number): number[] {
  const channelData = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0);
  if (channelData.length === 0) return [];

  const samplesPerBucket = Math.max(1, Math.floor(channelData.length / buckets));
  const peaks: number[] = [];

  for (let i = 0; i < buckets; i++) {
    const start = i * samplesPerBucket;
    const end = Math.min(start + samplesPerBucket, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }

  // Normalize so the loudest bucket in the file reaches full height -
  // a quiet recording shouldn't render as a flat line.
  const peakMax = Math.max(...peaks, 0.01);
  return peaks.map((p) => p / peakMax);
}

type DragTarget = "in" | "out" | null;

interface FadeControlsProps {
  file: File;
  disabled: boolean;
  fadeIn: number;
  fadeOut: number;
  onChangeFadeIn: (v: number) => void;
  onChangeFadeOut: (v: number) => void;
}

function FadeControls({ file, disabled, fadeIn, fadeOut, onChangeFadeIn, onChangeFadeOut }: FadeControlsProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [dragging, setDragging] = useState<DragTarget>(null);
  const [playheadPercent, setPlayheadPercent] = useState(0);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Runs once per newly-selected file: creates a fresh object URL for
  // playback/preview, resets waveform state, and attempts to decode the
  // file for waveform bars. Decode failure (an edge-case format the
  // browser's Web Audio implementation doesn't support) is caught and
  // silently falls back to a plain timeline - duration still comes from
  // the <audio> element itself, which has far broader format support
  // than decodeAudioData, so the tool never becomes unusable, it just
  // loses the cosmetic bars.
  useEffect(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    setDuration(null);
    setPeaks(null);
    setIsPreviewing(false);
    setPlayheadPercent(0);

    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = url;
      audioElRef.current.load();
    }

    let cancelled = false;
    setIsDecoding(true);

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const decodeCtx = new Ctx();
        const audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
        if (!cancelled) setPeaks(computePeaks(audioBuffer, WAVEFORM_BUCKETS));
        decodeCtx.close();
      } catch {
        // Unsupported format for decodeAudioData, or decode failed for
        // any other reason - waveform bars just don't render. Everything
        // else (duration, drag handles, preview) still works because
        // those depend on the <audio> element, not this decode.
        if (!cancelled) setPeaks(null);
      } finally {
        if (!cancelled) setIsDecoding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Cleanup on unmount only.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      audioCtxRef.current?.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Clamp fadeIn/fadeOut down once real duration is known, and whenever
  // the track is short enough that the current values would overlap or
  // exceed it - neither handle can ever represent more time than the
  // file actually has.
  useEffect(() => {
    if (duration === null) return;
    const maxEach = Math.min(FADE_MAX_SECONDS, duration);
    if (fadeIn > maxEach) onChangeFadeIn(maxEach);
    if (fadeOut > maxEach) onChangeFadeOut(maxEach);
    if (fadeIn + fadeOut > duration) {
      // Shrink fade-out first (arbitrary but consistent tie-break) so the
      // two never overlap past the track's actual length.
      onChangeFadeOut(Math.max(0, duration - fadeIn));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  const ensureAudioGraph = useCallback(() => {
    if (!audioElRef.current) return;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    // createMediaElementSource may only be called ONCE per <audio>
    // element for its entire lifetime - guarded so re-renders or file
    // swaps (which reuse the same DOM element via ref) never call it
    // twice, which would throw.
    if (!sourceNodeRef.current) {
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaElementSource(audioElRef.current);
      const gain = ctx.createGain();
      source.connect(gain).connect(ctx.destination);
      sourceNodeRef.current = source;
      gainNodeRef.current = gain;
    }
  }, []);

  const stopPreview = useCallback(() => {
    audioElRef.current?.pause();
    setIsPreviewing(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Drives the moving playhead line while a preview plays. rAF rather
  // than timeupdate events, since timeupdate fires too coarsely (every
  // ~250ms) to look smooth against a 220-bar waveform.
  const tickPlayhead = useCallback(() => {
    const audio = audioElRef.current;
    if (!audio || !duration) return;
    setPlayheadPercent(clamp((audio.currentTime / duration) * 100, 0, 100));
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [duration]);

  const startPreview = useCallback(async () => {
    if (!audioElRef.current || duration === null) return;
    ensureAudioGraph();
    const ctx = audioCtxRef.current;
    const gain = gainNodeRef.current;
    if (!ctx || !gain) return;

    await ctx.resume();

    const audio = audioElRef.current;
    audio.currentTime = 0;

    const now = ctx.currentTime;
    const fadeOutStart = Math.max(fadeIn, duration - fadeOut);

    gain.gain.cancelScheduledValues(now);
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(1, now + fadeIn);
    } else {
      gain.gain.setValueAtTime(1, now);
    }
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(1, now + fadeOutStart);
      gain.gain.linearRampToValueAtTime(0, now + duration);
    }

    await audio.play();
    setIsPreviewing(true);
    rafRef.current = requestAnimationFrame(tickPlayhead);
  }, [duration, fadeIn, fadeOut, ensureAudioGraph, tickPlayhead]);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    const handleEnd = () => {
      setIsPreviewing(false);
      setPlayheadPercent(0);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    audio.addEventListener("ended", handleEnd);
    audio.addEventListener("pause", handleEnd);
    return () => {
      audio.removeEventListener("ended", handleEnd);
      audio.removeEventListener("pause", handleEnd);
    };
  }, []);

  const setFadeInClamped = useCallback(
    (next: number) => {
      if (duration === null) return;
      const maxEach = Math.min(FADE_MAX_SECONDS, duration - fadeOut);
      onChangeFadeIn(roundTenth(clamp(next, 0, Math.max(0, maxEach))));
    },
    [duration, fadeOut, onChangeFadeIn]
  );

  const setFadeOutClamped = useCallback(
    (next: number) => {
      if (duration === null) return;
      const maxEach = Math.min(FADE_MAX_SECONDS, duration - fadeIn);
      onChangeFadeOut(roundTenth(clamp(next, 0, Math.max(0, maxEach))));
    },
    [duration, fadeIn, onChangeFadeOut]
  );

  // Pointer-drag handling for both fade handles. Position is computed
  // from the timeline container's actual pixel width so dragging feels
  // native regardless of viewport size - this ties the fade lengths
  // visually and numerically to the real track length rather than an
  // abstract 0-30s slider with no context.
  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current || duration === null || !dragging) return;
      const rect = containerRef.current.getBoundingClientRect();
      const fraction = clamp((clientX - rect.left) / rect.width, 0, 1);
      const timeAtX = fraction * duration;

      if (dragging === "in") setFadeInClamped(timeAtX);
      else setFadeOutClamped(duration - timeAtX);
    },
    [dragging, duration, setFadeInClamped, setFadeOutClamped]
  );

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX);
    const onUp = () => setDragging(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, handlePointerMove]);

  const startDrag = (target: DragTarget) => {
    if (disabled) return;
    if (isPreviewing) stopPreview();
    setDragging(target);
  };

  // Arrow keys move the focused handle; Shift moves it further; Home/End
  // jump to the extremes. This is what actually makes the role="slider"
  // handles operable rather than just labeled as if they were.
  const handleKeyDown = (target: "in" | "out") => (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const current = target === "in" ? fadeIn : fadeOut;
    const set = target === "in" ? setFadeInClamped : setFadeOutClamped;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        set(current - step);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        set(current + step);
        break;
      case "Home":
        e.preventDefault();
        set(0);
        break;
      case "End":
        e.preventDefault();
        set(FADE_MAX_SECONDS);
        break;
    }
  };

  const fadeInPercent = duration ? (fadeIn / duration) * 100 : 0;
  const fadeOutPercent = duration ? (fadeOut / duration) * 100 : 0;

  return (
    <div className="space-y-3">
      <audio ref={audioElRef} preload="metadata" onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Fade in / out</label>
        {duration !== null && (
          <span className="font-mono text-xs tabular-nums text-text-subtle">{formatTime(duration)} total</span>
        )}
      </div>

      {/* Timeline: waveform backdrop + true fade-curve overlay, anchored
          to the actual track length. */}
      <div
        ref={containerRef}
        className="relative h-24 select-none overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850"
      >
        {duration === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-text-subtle">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reading track…
          </div>
        ) : (
          <>
            {/* Waveform bars, or a plain center line if decode wasn't
                possible for this format - the fade UI stays fully
                functional either way. */}
            <div className="absolute inset-0 flex items-center gap-px px-1 opacity-70">
              {peaks ? (
                peaks.map((p, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-graphite-600"
                    style={{ height: `${Math.max(p * 100, 4)}%` }}
                  />
                ))
              ) : (
                <div className="h-px w-full bg-graphite-700" />
              )}
            </div>

            {/* Dimmed regions under the fade zones. */}
            {fadeIn > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 bg-graphite-950/55"
                style={{ width: `${fadeInPercent}%` }}
              />
            )}
            {fadeOut > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 right-0 bg-graphite-950/55"
                style={{ width: `${fadeOutPercent}%` }}
              />
            )}

            {/* True fade curve, drawn as diagonal lines rather than a
                gradient smear — this is what actually reads as a fade
                to anyone who's used a DAW. viewBox is percent-based so
                it scales with the container regardless of pixel width. */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {fadeIn > 0 && (
                <polyline
                  points={`0,100 ${fadeInPercent},4`}
                  fill="none"
                  stroke="rgb(245 158 11 / 0.9)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {fadeOut > 0 && (
                <polyline
                  points={`${100 - fadeOutPercent},4 100,100`}
                  fill="none"
                  stroke="rgb(245 158 11 / 0.9)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* Moving playhead during preview. */}
            {isPreviewing && (
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-teal-400"
                style={{ left: `${playheadPercent}%` }}
              />
            )}

            {/* Drag handles sit at the boundary of each fade region. */}
            <div
              role="slider"
              aria-label="Fade in length"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={FADE_MAX_SECONDS}
              aria-valuenow={fadeIn}
              aria-valuetext={`${fadeIn.toFixed(1)} seconds`}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={() => startDrag("in")}
              onKeyDown={handleKeyDown("in")}
              className="group absolute inset-y-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus:outline-none"
              style={{ left: `${fadeInPercent}%` }}
            >
              <div
                className={cn(
                  "h-full w-0.5 bg-amber-500 transition-transform",
                  dragging === "in" ? "scale-x-150" : "group-hover:scale-x-150 group-focus-visible:scale-x-150"
                )}
              />
              <div
                className={cn(
                  "absolute h-3 w-3 rounded-full border-2 border-amber-500 bg-graphite-900 transition-transform",
                  (dragging === "in" || undefined) && "scale-125",
                  "group-hover:scale-125 group-focus-visible:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-amber-500/40"
                )}
              />
            </div>
            <div
              role="slider"
              aria-label="Fade out length"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={FADE_MAX_SECONDS}
              aria-valuenow={fadeOut}
              aria-valuetext={`${fadeOut.toFixed(1)} seconds`}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={() => startDrag("out")}
              onKeyDown={handleKeyDown("out")}
              className="group absolute inset-y-0 -mr-2.5 flex w-5 cursor-ew-resize touch-none items-center justify-center focus:outline-none"
              style={{ right: `${fadeOutPercent}%` }}
            >
              <div
                className={cn(
                  "h-full w-0.5 bg-amber-500 transition-transform",
                  dragging === "out" ? "scale-x-150" : "group-hover:scale-x-150 group-focus-visible:scale-x-150"
                )}
              />
              <div
                className={cn(
                  "absolute h-3 w-3 rounded-full border-2 border-amber-500 bg-graphite-900 transition-transform",
                  dragging === "out" && "scale-125",
                  "group-hover:scale-125 group-focus-visible:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-amber-500/40"
                )}
              />
            </div>
          </>
        )}
      </div>

      {/* Numeric entry — precise values for anyone who doesn't want to
          drag a 3-pixel handle to hit "2.3s" exactly. */}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Fade in
          <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
            <input
              type="number"
              min={0}
              max={FADE_MAX_SECONDS}
              step={0.1}
              value={fadeIn}
              disabled={disabled || duration === null}
              onChange={(e) => setFadeInClamped(Number(e.target.value))}
              className="w-14 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="flex flex-col border-l border-graphite-700">
              <button
                type="button"
                aria-label="Increase fade in"
                disabled={disabled || duration === null}
                onClick={() => setFadeInClamped(fadeIn + KEY_STEP)}
                className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
              >
                <ChevronUp className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                aria-label="Decrease fade in"
                disabled={disabled || duration === null}
                onClick={() => setFadeInClamped(fadeIn - KEY_STEP)}
                className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
              >
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
            </span>
          </span>
          s
        </label>

        <button
          type="button"
          onClick={isPreviewing ? stopPreview : startPreview}
          disabled={disabled || duration === null || isDecoding}
          className="flex items-center gap-1.5 rounded-full border border-graphite-700 bg-graphite-850 px-3.5 py-1.5 text-text-muted transition-colors hover:border-amber-500/40 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
        >
          {isPreviewing ? (
            <Square className="h-3 w-3" fill="currentColor" />
          ) : (
            <Play className="h-3 w-3" fill="currentColor" />
          )}
          {isPreviewing ? "Stop" : "Preview fade"}
        </button>

        <label className="flex items-center gap-1.5 text-xs text-text-muted">
          Fade out
          <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
            <input
              type="number"
              min={0}
              max={FADE_MAX_SECONDS}
              step={0.1}
              value={fadeOut}
              disabled={disabled || duration === null}
              onChange={(e) => setFadeOutClamped(Number(e.target.value))}
              className="w-14 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="flex flex-col border-l border-graphite-700">
              <button
                type="button"
                aria-label="Increase fade out"
                disabled={disabled || duration === null}
                onClick={() => setFadeOutClamped(fadeOut + KEY_STEP)}
                className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
              >
                <ChevronUp className="h-2.5 w-2.5" />
              </button>
              <button
                type="button"
                aria-label="Decrease fade out"
                disabled={disabled || duration === null}
                onClick={() => setFadeOutClamped(fadeOut - KEY_STEP)}
                className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
              >
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
            </span>
          </span>
          s
        </label>
      </div>

      <p className="text-center text-xs text-text-subtle">
        Drag or arrow-key either handle — capped to your track&apos;s length and {FADE_MAX_SECONDS}s max per fade.
      </p>
    </div>
  );
}

export function FadeForm() {
  const [fadeIn, setFadeIn] = useState(3);
  const [fadeOut, setFadeOut] = useState(3);

  return (
    <JobToolForm
      endpoint="fade"
      pollIntervalMs={2500}
      toolLabel="Fade in / out"
      toolMeta={`${fadeIn.toFixed(1)}s → ${fadeOut.toFixed(1)}s`}
      submitLabel="Add fade"
      processingLabel="Applying fade"
      expectedRange="a few seconds"
      resultVerb="Faded"
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Rendering the fade curves" },
        { at: 7, label: "Writing the output file" },
      ]}
      missingFieldsMessage="Set at least one of fade in or fade out above."
      buildExtraFields={() => {
        if (fadeIn <= 0 && fadeOut <= 0) return null;
        return {
          fade_in_seconds: String(fadeIn),
          fade_out_seconds: String(fadeOut),
        };
      }}
      renderControls={(file, disabled) =>
        file ? (
          <FadeControls
            file={file}
            disabled={disabled}
            fadeIn={fadeIn}
            fadeOut={fadeOut}
            onChangeFadeIn={setFadeIn}
            onChangeFadeOut={setFadeOut}
          />
        ) : null
      }
    />
  );
}