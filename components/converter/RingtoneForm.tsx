"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { WaveformCanvas, WAVEFORM_RULER_HEIGHT } from "@/components/ui/WaveformCanvas";
import { cn } from "@/lib/utils/cn";
import { computeWaveformEnvelopeAsync, type WaveformEnvelope } from "@/lib/utils/waveform";

const RINGTONE_MAX_SECONDS = 40;
const KEY_STEP = 1;
const KEY_STEP_LARGE = 5;
/** Shortest ringtone worth producing, and the gap the two handles keep
 *  between each other so they can never cross. */
const MIN_WINDOW = 1;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type DragTarget = "start" | "end" | "move" | null;

interface Window {
  start: number;
  duration: number;
}

interface SelectionWindowProps {
  file: File;
  disabled: boolean;
  start: number;
  duration: number;
  onChange: (start: number, duration: number) => void;
}

function SelectionWindow({
  file,
  disabled,
  start: committedStart,
  duration: committedDuration,
  onChange,
}: SelectionWindowProps) {
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<WaveformEnvelope | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  /* The live window is owned here, not by the parent form. Pushing every
     pointermove up to RingtoneForm re-rendered the whole JobToolForm
     tree — dropzone, header, submit button — to move one handle. The
     parent is told once, when the gesture ends.

     null means "untouched": the window shown is derived from the props
     clamped to the real track length, so nothing has to write state in
     an effect on mount. */
  const [local, setLocal] = useState<Window | null>(null);

  const maxWindow = fileDuration ? Math.min(RINGTONE_MAX_SECONDS, fileDuration) : RINGTONE_MAX_SECONDS;
  const fallbackDuration = clamp(committedDuration, MIN_WINDOW, maxWindow);
  const fallback: Window = {
    start: clamp(committedStart, 0, Math.max(0, (fileDuration ?? 0) - fallbackDuration)),
    duration: fallbackDuration,
  };
  const { start, duration } = local ?? fallback;
  const end = start + duration;

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const previewStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragRef = useRef<DragTarget>(null);
  /** Where the pointer grabbed the window, so a move drag keeps its
   *  offset instead of snapping the window's start to the cursor. */
  const moveAnchorRef = useRef<{ pointerTime: number; start: number } | null>(null);
  const windowRef = useRef<Window>({ start, duration });
  const fileDurationRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const defaultSentRef = useRef(false);

  /* Mirrors of the values the window-level pointer listeners need.
     Written in an effect rather than during render so the listeners can
     be attached once and still read current values. */
  useEffect(() => {
    windowRef.current = { start, duration };
    fileDurationRef.current = fileDuration;
    onChangeRef.current = onChange;
  });

  /* --- load the file into <audio> and decode the envelope ---------- */
  useEffect(() => {
    const url = URL.createObjectURL(file);

    if (audioElRef.current) {
      audioElRef.current.src = url;
      audioElRef.current.load();
    }

    let cancelled = false;
    const abort = new AbortController();

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const Ctx =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        try {
          const buffer = await ctx.decodeAudioData(arrayBuffer);
          // Scanned in slices so a long file can't block the main
          // thread in one go — see computeWaveformEnvelopeAsync.
          const next = await computeWaveformEnvelopeAsync(buffer, undefined, abort.signal);
          if (!cancelled) setEnvelope(next);
        } finally {
          ctx.close();
        }
      } catch {
        // decodeAudioData supports fewer formats than <audio> does, so a
        // failure here costs the drawing only — duration, handles and
        // preview all still work off the media element below. An abort
        // lands here too, and is silent: cancelled is already true.
        if (!cancelled) setDecodeFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  /* --- real duration comes from the media element ------------------
     Guarded against Infinity/NaN: some MP3s report an unknown duration
     until the browser has buffered further, and accepting that would
     turn every clamp below into NaN. */
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;

    const readDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setFileDuration(audio.duration);
    };

    // readyState >= 1 means HAVE_METADATA already fired (e.g. a cached
    // file reselected) and the event won't come again.
    if (audio.readyState >= 1) readDuration();

    audio.addEventListener("loadedmetadata", readDuration);
    audio.addEventListener("durationchange", readDuration);
    return () => {
      audio.removeEventListener("loadedmetadata", readDuration);
      audio.removeEventListener("durationchange", readDuration);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewStopRef.current) clearTimeout(previewStopRef.current);
    };
  }, []);

  /* --- once the real length is known, hand the clamped window to the
     form. A 30s default against a 12s upload has to come back down, and
     the parent is the one that submits it. Guarded so a late
     durationchange can't overwrite a window the user already set. */
  useEffect(() => {
    if (fileDuration === null || defaultSentRef.current) return;
    defaultSentRef.current = true;
    const cappedDuration = clamp(committedDuration, MIN_WINDOW, Math.min(RINGTONE_MAX_SECONDS, fileDuration));
    const cappedStart = clamp(committedStart, 0, Math.max(0, fileDuration - cappedDuration));
    onChangeRef.current(cappedStart, cappedDuration);
  }, [fileDuration, committedStart, committedDuration]);

  /** Update the visible window and tell the parent — used for discrete
   *  edits (steppers, keyboard) that end immediately. */
  const commit = useCallback((next: Window) => {
    setLocal(next);
    onChangeRef.current(next.start, next.duration);
  }, []);

  const stopPreview = useCallback(() => {
    audioElRef.current?.pause();
    setIsPreviewing(false);
    if (previewStopRef.current) {
      clearTimeout(previewStopRef.current);
      previewStopRef.current = null;
    }
  }, []);

  const startPreview = useCallback(async () => {
    const audio = audioElRef.current;
    if (!audio || fileDuration === null) return;
    audio.currentTime = start;
    await audio.play().catch(() => {});
    setIsPreviewing(true);
    if (previewStopRef.current) clearTimeout(previewStopRef.current);
    previewStopRef.current = setTimeout(() => stopPreview(), duration * 1000);
  }, [start, duration, fileDuration, stopPreview]);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    const handleEnd = () => setIsPreviewing(false);
    audio.addEventListener("ended", handleEnd);
    audio.addEventListener("pause", handleEnd);
    return () => {
      audio.removeEventListener("ended", handleEnd);
      audio.removeEventListener("pause", handleEnd);
    };
  }, []);

  /* --- playhead --------------------------------------------------
     Driven imperatively off requestAnimationFrame. Holding the play
     position in React state would re-render this subtree — and redraw
     the canvas — sixty times a second for one moving line. */
  useEffect(() => {
    const line = playheadRef.current;
    if (!line) return;

    if (!isPreviewing || fileDuration === null) {
      line.style.opacity = "0";
      return;
    }

    let frame = 0;
    const tick = () => {
      const audio = audioElRef.current;
      if (audio && fileDuration > 0) {
        line.style.opacity = "1";
        line.style.left = `${clamp((audio.currentTime / fileDuration) * 100, 0, 100)}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      line.style.opacity = "0";
    };
  }, [isPreviewing, fileDuration]);

  /* --- drag handling ----------------------------------------------
     Listeners are attached once and read from refs. Pointer events fire
     faster than the display refreshes (120Hz+ on a trackpad), so moves
     are coalesced into one state update per animation frame — without
     this every event triggered its own React render and canvas redraw,
     which is what made dragging feel heavy. */
  const timeFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    const total = fileDurationRef.current;
    if (!el || total === null) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * total;
  }, []);

  useEffect(() => {
    let frame = 0;
    let pendingX = 0;

    const apply = () => {
      frame = 0;
      const target = dragRef.current;
      const total = fileDurationRef.current;
      if (!target || total === null) return;

      const time = timeFromClientX(pendingX);
      const current = windowRef.current;
      const cap = Math.min(RINGTONE_MAX_SECONDS, total);
      const currentEnd = current.start + current.duration;

      if (target === "start") {
        // The end edge stays put; the start edge moves, and the window
        // shrinks or grows against the 40s cap rather than dragging the
        // end along with it.
        const nextStart = clamp(time, Math.max(0, currentEnd - cap), currentEnd - MIN_WINDOW);
        setLocal({ start: nextStart, duration: currentEnd - nextStart });
      } else if (target === "end") {
        const nextEnd = clamp(time, current.start + MIN_WINDOW, Math.min(total, current.start + cap));
        setLocal({ start: current.start, duration: nextEnd - current.start });
      } else {
        const anchor = moveAnchorRef.current;
        if (!anchor) return;
        const nextStart = clamp(anchor.start + (time - anchor.pointerTime), 0, total - current.duration);
        setLocal({ start: nextStart, duration: current.duration });
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      pendingX = e.clientX;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      moveAnchorRef.current = null;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      // One parent update per gesture, on release.
      const finalWindow = windowRef.current;
      onChangeRef.current(finalWindow.start, finalWindow.duration);
    };

    globalThis.addEventListener("pointermove", onMove);
    globalThis.addEventListener("pointerup", onUp);
    globalThis.addEventListener("pointercancel", onUp);
    return () => {
      globalThis.removeEventListener("pointermove", onMove);
      globalThis.removeEventListener("pointerup", onUp);
      globalThis.removeEventListener("pointercancel", onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [timeFromClientX]);

  const beginDrag = (target: Exclude<DragTarget, null>, clientX: number) => {
    if (disabled || fileDuration === null) return;
    if (isPreviewing) stopPreview();
    if (target === "move") {
      moveAnchorRef.current = { pointerTime: timeFromClientX(clientX), start };
    }
    dragRef.current = target;
  };

  /** Press anywhere on the waveform outside the window and the window
   *  jumps there, centred on the cursor, then follows it. */
  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if (disabled || fileDuration === null) return;
    if (isPreviewing) stopPreview();
    const time = timeFromClientX(e.clientX);
    const nextStart = clamp(time - duration / 2, 0, Math.max(0, fileDuration - duration));
    moveAnchorRef.current = { pointerTime: time, start: nextStart };
    dragRef.current = "move";
    setLocal({ start: nextStart, duration });
  };

  const nudge = (which: "start" | "duration", delta: number) => {
    if (fileDuration === null) return;
    const cap = Math.min(RINGTONE_MAX_SECONDS, fileDuration);
    if (which === "start") {
      commit({ start: clamp(start + delta, 0, fileDuration - duration), duration });
    } else {
      commit({
        start,
        duration: clamp(duration + delta, MIN_WINDOW, Math.min(cap, fileDuration - start)),
      });
    }
  };

  const handleKeyDown = (target: "start" | "end") => (e: React.KeyboardEvent) => {
    if (disabled || fileDuration === null) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(target === "start" ? "start" : "duration", -step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(target === "start" ? "start" : "duration", step);
    }
  };

  const startPercent = fileDuration ? (start / fileDuration) * 100 : 0;
  const endPercent = fileDuration ? (end / fileDuration) * 100 : 0;

  // The <audio> element is mounted unconditionally, before the branch
  // below: it's what reports the duration, so returning early on
  // `fileDuration === null` would mean the element never exists, the
  // listener never attaches, and the control sits on its spinner
  // forever.
  return (
    <div className="space-y-3">
      <audio ref={audioElRef} preload="metadata" />

      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">Ringtone window</label>
        <span className="font-mono text-sm text-amber-400">
          {formatTime(start)} – {formatTime(end)}
        </span>
      </div>

      {fileDuration === null ? (
        <div className="flex h-28 items-center justify-center gap-2 rounded-lg border border-graphite-700 bg-graphite-850 text-xs text-text-subtle">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Reading track…
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            onPointerDown={handleTrackPointerDown}
            className="relative h-28 touch-none select-none overflow-hidden rounded-lg border border-graphite-700 bg-graphite-850"
          >
            <WaveformCanvas
              envelope={envelope}
              duration={fileDuration}
              start={start}
              end={end}
              className="absolute inset-0 block"
            />

            {!envelope && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-text-subtle">
                {decodeFailed
                  ? "No waveform for this format — the handles still cut exactly"
                  : "Drawing waveform…"}
              </div>
            )}

            {/* Playhead — moved by rAF, not by React */}
            <div
              ref={playheadRef}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 w-px bg-amber-400 opacity-0 transition-opacity"
              style={{ top: WAVEFORM_RULER_HEIGHT, left: 0 }}
            />

            {/* The window body — drag to slide both edges together */}
            <div
              onPointerDown={(e) => {
                e.stopPropagation();
                beginDrag("move", e.clientX);
              }}
              className={cn("absolute bottom-0", !disabled && "cursor-grab active:cursor-grabbing")}
              style={{
                top: WAVEFORM_RULER_HEIGHT,
                left: `${startPercent}%`,
                width: `${endPercent - startPercent}%`,
              }}
            />

            {/* Start handle */}
            <div
              role="slider"
              aria-label="Start time"
              aria-valuemin={0}
              aria-valuemax={fileDuration}
              aria-valuenow={start}
              aria-valuetext={formatTime(start)}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginDrag("start", e.clientX);
              }}
              onKeyDown={handleKeyDown("start")}
              className="group absolute bottom-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none justify-center focus:outline-none"
              style={{ top: WAVEFORM_RULER_HEIGHT, left: `${startPercent}%` }}
            >
              <div className="h-full w-0.5 bg-amber-500 transition-colors group-focus-visible:bg-amber-400" />
              <div className="absolute top-0 h-2.5 w-2.5 rounded-b-sm bg-amber-500 transition-transform group-hover:scale-125 group-focus-visible:scale-125" />
            </div>

            {/* End handle */}
            <div
              role="slider"
              aria-label="End time"
              aria-valuemin={0}
              aria-valuemax={fileDuration}
              aria-valuenow={end}
              aria-valuetext={formatTime(end)}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginDrag("end", e.clientX);
              }}
              onKeyDown={handleKeyDown("end")}
              className="group absolute bottom-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none justify-center focus:outline-none"
              style={{ top: WAVEFORM_RULER_HEIGHT, left: `${endPercent}%` }}
            >
              <div className="h-full w-0.5 bg-amber-500 transition-colors group-focus-visible:bg-amber-400" />
              <div className="absolute top-0 h-2.5 w-2.5 rounded-b-sm bg-amber-500 transition-transform group-hover:scale-125 group-focus-visible:scale-125" />
            </div>
          </div>

          {/* Numeric entry + preview */}
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-1.5 text-xs text-text-muted">
              Start
              <Stepper
                value={start}
                disabled={disabled}
                onIncrement={() => nudge("start", KEY_STEP)}
                onDecrement={() => nudge("start", -KEY_STEP)}
                onChange={(v) => commit({ start: clamp(v, 0, fileDuration - duration), duration })}
                max={fileDuration}
              />
              s
            </label>

            <button
              type="button"
              onClick={isPreviewing ? stopPreview : startPreview}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-full border border-graphite-700 bg-graphite-850 px-3.5 py-1.5 text-text-muted transition-colors hover:border-amber-500/40 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
            >
              {isPreviewing ? <Square className="h-3 w-3" fill="currentColor" /> : <Play className="h-3 w-3" fill="currentColor" />}
              {isPreviewing ? "Stop" : "Preview"}
            </button>

            <label className="flex items-center gap-1.5 text-xs text-text-muted">
              Length
              <Stepper
                value={duration}
                disabled={disabled}
                onIncrement={() => nudge("duration", KEY_STEP)}
                onDecrement={() => nudge("duration", -KEY_STEP)}
                onChange={(v) =>
                  commit({
                    start,
                    duration: clamp(v, MIN_WINDOW, Math.min(maxWindow, fileDuration - start)),
                  })
                }
                max={maxWindow}
              />
              s
            </label>
          </div>

          <p className="text-center text-xs text-text-subtle">
            Drag the window or its edges — iPhone ringtones max out at {RINGTONE_MAX_SECONDS}s, capped
            automatically to your track&apos;s length.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Stepper({
  value,
  disabled,
  max,
  onIncrement,
  onDecrement,
  onChange,
}: {
  value: number;
  disabled: boolean;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <span className="flex items-center overflow-hidden rounded-md border border-graphite-700 bg-graphite-850">
      <input
        type="number"
        min={0}
        max={max}
        step={1}
        value={Math.round(value)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-14 bg-transparent px-2 py-1 text-right font-mono text-text-primary [appearance:textfield] focus:outline-none disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="flex flex-col border-l border-graphite-700">
        <button
          type="button"
          aria-label="Increase"
          disabled={disabled}
          onClick={onIncrement}
          className="flex h-3.5 w-5 items-center justify-center text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          aria-label="Decrease"
          disabled={disabled}
          onClick={onDecrement}
          className="flex h-3.5 w-5 items-center justify-center border-t border-graphite-700 text-text-subtle transition-colors hover:bg-graphite-800 hover:text-amber-400 disabled:opacity-40"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */

export function RingtoneForm() {
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(30);

  return (
    <JobToolForm
      endpoint="ringtone"
      pollIntervalMs={2500}
      toolLabel="Ringtone maker"
      toolMeta={`${formatTime(start)} → ${formatTime(start + duration)}`}
      submitLabel="Make ringtone"
      processingLabel="Trimming and encoding"
      expectedRange="a few seconds"
      resultVerb="Ready"
      downloadFilename="ringtone.m4r"
      stages={[
        { at: 0, label: "Trimming the selection" },
        { at: 3, label: "Encoding for iPhone" },
        { at: 6, label: "Writing the output file" },
      ]}
      buildExtraFields={() => ({
        start_seconds: String(start),
        duration_seconds: String(duration),
      })}
      renderControls={(file, disabled) =>
        file ? (
          /* Keyed per file: selecting a different file remounts the
             controls with fresh state, instead of resetting half a
             dozen useState values by hand inside an effect. */
          <SelectionWindow
            key={`${file.name}:${file.size}:${file.lastModified}`}
            file={file}
            disabled={disabled}
            start={start}
            duration={duration}
            onChange={(s, d) => {
              setStart(s);
              setDuration(d);
            }}
          />
        ) : null
      }
    />
  );
}