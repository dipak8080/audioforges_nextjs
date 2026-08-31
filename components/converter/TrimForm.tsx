"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { ControlField, Stepper } from "@/components/converter/ToolControls";
import { WaveformCanvas, WAVEFORM_RULER_HEIGHT } from "@/components/ui/WaveformCanvas";
import { Button } from "@/components/ui/Button";
import { getRateLimitLabel } from "@/lib/data/rate-limits";
import { computeWaveformEnvelopeAsync, type WaveformEnvelope } from "@/lib/utils/waveform";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * Three fixes. The drag handling, the rAF playhead, the ref mirrors and the
 * one-update-per-gesture contract with the parent are the load-bearing parts of
 * this file and none of them are touched.
 *
 * 1. `formatPrecise` COULD PRINT "0:60.0". It took the minutes from the
 *    unrounded value and the seconds from a remainder that `toFixed(1)` then
 *    rounded UP — so 59.95s rendered as 0:60.0 and 119.98s as 1:60.0. This is
 *    the readout of the trim range, on a control whose entire job is landing on
 *    fractional seconds, so it is hit by dragging rather than by an edge case.
 *    Same bug TempoForm's formatDuration had and fixed; this copy drifted.
 *    Rounds to a tenth FIRST, then splits.
 *
 * 2. `await audio.play().catch(() => {})` THEN AN UNCONDITIONAL
 *    setIsPreviewing(true). Swallowing the rejection and setting the flag
 *    anyway means a blocked play — autoplay policy, a pause landing between the
 *    call and the promise — leaves the button reading "Stop" over silence, with
 *    a stop timer running against audio that never started. FadeForm and
 *    RingtoneForm both already resolved this the right way; this was the last
 *    copy.
 *
 * 3. A 429 NAMES THE LIMIT. /trim is 5 per minute — the tightest window on the
 *    site, and trimming several takes of the same recording in a row is the
 *    normal way to use it, so it's among the easiest to hit by accident.
 *
 * ALSO: `sharedCtx` moved to the top of the module. It was declared at the
 * BOTTOM, below the component that reads it. That works — `let` is hoisted and
 * the read happens inside an async callback long after evaluation — but it
 * reads as a dangling assignment, and the day someone calls it during module
 * init it's a TDZ error rather than a null check.
 */

const KEY_STEP = 0.1;
const KEY_STEP_LARGE = 1;
/** Shortest selection the backend will accept, and the gap the handles
 *  keep between each other so they can never cross. */
const MIN_SELECTION = 0.1;

const RATE_LIMIT_LABEL = getRateLimitLabel("trim");

/**
 * Module-scoped, created on first use, never closed. A context per file hits
 * Chrome's six-context ceiling and pays for an audio device every time someone
 * picks a track.
 *
 * Declared HERE rather than at the foot of the file: it was below the component
 * that reads it, which works by hoisting but reads like an accident.
 */
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

/**
 * Rounds to a TENTH first, then splits.
 *
 * The old version divided the raw seconds for the minutes and took `% 60` for
 * the remainder, then let toFixed(1) round that — so 59.95 became "0:60.0" and
 * 119.98 became "1:60.0". Dragging a handle lands on values like these
 * constantly.
 */
function formatPrecise(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.0";
  const total = Math.round(seconds * 10) / 10;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* ------------------------------------------------------------------ */
/* Form — start/end live in real React state, so buildExtraFields       */
/* closes over the current render's values and a submit can never read  */
/* a stale trim range from a previous file.                             */
/* ------------------------------------------------------------------ */

export function TrimForm() {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  return (
    <JobToolForm
      endpoint="trim"
      pollIntervalMs={2500}
      toolLabel="Audio trimmer"
      /* Clip LENGTH, not the range — the Clip range readout below already
         shows start and end, and printing both twice invites the reader to
         look for a difference that isn't there. */
      toolMeta={end > start ? `${formatPrecise(end - start)} clip` : "cut to an exact range"}
      submitLabel="Trim"
      processingLabel="Trimming"
      expectedRange="a few seconds"
      resultVerb="Trimmed"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Trimming is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 2, label: "Cutting the selection" },
        { at: 5, label: "Writing the output file" },
      ]}
      missingFieldsMessage="Select a valid start and end point above."
      buildExtraFields={() => {
        if (end <= start) return null;
        return { start_seconds: String(start), end_seconds: String(end) };
      }}
      renderControls={(file, disabled) =>
        file ? (
          /* Keyed per file: selecting a different file remounts the
             controls with fresh state, instead of resetting half a
             dozen useState values by hand inside an effect. */
          <TrimControls
            key={`${file.name}:${file.size}:${file.lastModified}`}
            file={file}
            disabled={disabled}
            start={start}
            end={end}
            onChange={(s, e) => {
              setStart(s);
              setEnd(e);
            }}
          />
        ) : null
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Controls — props-driven; file probing and decoding live here, but    */
/* the start/end values are owned by the parent.                        */
/* ------------------------------------------------------------------ */

interface TrimControlsProps {
  file: File;
  disabled: boolean;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
}

type DragTarget = "start" | "end" | "range" | null;

interface Range {
  start: number;
  end: number;
}

function TrimControls({ file, disabled, start: committedStart, onChange }: TrimControlsProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<WaveformEnvelope | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  /* The live selection is owned here, not by the parent form. Pushing
     every pointermove up to TrimForm re-rendered the whole JobToolForm
     tree — dropzone, header, submit button — to move one handle. The
     parent is told once, when the gesture ends. */
  const [range, setRange] = useState<Range>({ start: committedStart, end: 0 });
  /* end === 0 means "not touched yet" — the selection shows the whole
     track as soon as the duration lands, without an effect writing
     state on mount. Any real selection has end >= MIN_SELECTION. */
  const start = range.end > 0 ? range.start : 0;
  const end = range.end > 0 ? range.end : (duration ?? 0);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const previewStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragRef = useRef<DragTarget>(null);
  /** Fixed edge of a selection being swept across the waveform. */
  const anchorRef = useRef(0);
  const durationRef = useRef<number | null>(null);
  const rangeRef = useRef<Range>({ start, end });
  const onChangeRef = useRef(onChange);
  const defaultSentRef = useRef(false);

  /* Mirrors of values the window-level pointer listeners need. Written
     in an effect rather than during render so the listeners can be
     attached once and still read current values. */
  useEffect(() => {
    rangeRef.current = { start, end };
    durationRef.current = duration;
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
        /*
          ONE AudioContext for the page, not one per file.

          This constructed its own and closed it in a finally. Chrome caps a
          document at six concurrent AudioContexts and throws on the seventh,
          and construction opens an audio device — real time, every time a file
          is picked. waveform.ts holds one for exactly this reason; the source
          here is a File rather than a URL, so the decode stays local, but the
          context doesn't need to be.

          Not closed: a suspended context is harmless and decodeAudioData works
          while suspended.
        */
        const buffer = await getAudioContext().decodeAudioData(arrayBuffer);
        if (cancelled) return;
        // Scanned in slices so a long file can't block the main thread in one
        // go — see computeWaveformEnvelopeAsync.
        const next = await computeWaveformEnvelopeAsync(buffer, undefined, abort.signal);
        if (!cancelled) setEnvelope(next);
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
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
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

  /** Update the visible selection and tell the parent — used for
   *  discrete edits (steppers, keyboard, reset) that end immediately. */
  const commit = useCallback((next: Range) => {
    setRange(next);
    onChangeRef.current(next.start, next.end);
  }, []);

  /* --- once real duration is known, hand the full track to the form
     as the default selection. Only local state is derived from
     duration, so this pushes to the parent and nothing else. Guarded
     so a late durationchange can't wipe a selection already made. */
  useEffect(() => {
    if (duration === null || defaultSentRef.current) return;
    defaultSentRef.current = true;
    onChangeRef.current(0, duration);
  }, [duration]);

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
    if (!audio || duration === null || end <= start) return;
    audio.currentTime = start;

    /*
      Only claim to be playing if play() actually resolved.

      This used to be `await audio.play().catch(() => {})` followed by an
      unconditional setIsPreviewing(true) — so a blocked play (autoplay policy,
      a pause landing between the call and the promise) left the button reading
      "Stop" over silence, with a stop timer counting down against audio that
      never started. FadeForm and RingtoneForm both resolved this correctly;
      this was the last copy.
    */
    try {
      await audio.play();
    } catch {
      setIsPreviewing(false);
      return;
    }

    setIsPreviewing(true);
    if (previewStopRef.current) clearTimeout(previewStopRef.current);
    previewStopRef.current = setTimeout(() => stopPreview(), (end - start) * 1000);
  }, [start, end, duration, stopPreview]);

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

    if (!isPreviewing || duration === null) {
      line.style.opacity = "0";
      return;
    }

    let frame = 0;
    const tick = () => {
      const audio = audioElRef.current;
      if (audio && duration > 0) {
        line.style.opacity = "1";
        line.style.left = `${clamp((audio.currentTime / duration) * 100, 0, 100)}%`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      line.style.opacity = "0";
    };
  }, [isPreviewing, duration]);

  /* --- drag handling ----------------------------------------------
     Listeners are attached once and read from refs. Pointer events fire
     faster than the display refreshes (120Hz+ on a trackpad), so moves
     are coalesced into one state update per animation frame — without
     this every event triggered its own React render and canvas redraw,
     which is what made dragging feel heavy. */
  const timeFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    const dur = durationRef.current;
    if (!el || dur === null) return 0;
    const rect = el.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * dur;
  }, []);

  useEffect(() => {
    let frame = 0;
    let pendingX = 0;

    const apply = () => {
      frame = 0;
      const target = dragRef.current;
      const dur = durationRef.current;
      if (!target || dur === null) return;

      const time = timeFromClientX(pendingX);
      const current = rangeRef.current;

      if (target === "start") {
        setRange({ start: clamp(time, 0, current.end - MIN_SELECTION), end: current.end });
      } else if (target === "end") {
        setRange({ start: current.start, end: clamp(time, current.start + MIN_SELECTION, dur) });
      } else {
        const anchor = anchorRef.current;
        if (time >= anchor) {
          setRange({ start: anchor, end: clamp(time, anchor + MIN_SELECTION, dur) });
        } else {
          setRange({ start: clamp(time, 0, anchor - MIN_SELECTION), end: anchor });
        }
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
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      // One parent update per gesture, on release.
      const finalRange = rangeRef.current;
      onChangeRef.current(finalRange.start, finalRange.end);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [timeFromClientX]);

  const beginDrag = (target: Exclude<DragTarget, null>) => {
    if (disabled) return;
    if (isPreviewing) stopPreview();
    dragRef.current = target;
  };

  /** Press anywhere on the waveform and drag to sweep out a new
   *  selection, the way you would select a region in a DAW. */
  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if (disabled || duration === null) return;
    if (isPreviewing) stopPreview();
    const time = timeFromClientX(e.clientX);
    anchorRef.current = time;
    dragRef.current = "range";
    setRange({
      start: clamp(time, 0, duration - MIN_SELECTION),
      end: clamp(time + MIN_SELECTION, MIN_SELECTION, duration),
    });
  };

  const nudge = (which: "start" | "end", delta: number) => {
    if (duration === null) return;
    if (which === "start") commit({ start: clamp(start + delta, 0, end - MIN_SELECTION), end });
    else commit({ start, end: clamp(end + delta, start + MIN_SELECTION, duration) });
  };

  const handleKeyDown = (target: "start" | "end") => (e: React.KeyboardEvent) => {
    if (disabled || duration === null) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      nudge(target, -step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nudge(target, step);
    } else if (e.key === "Home" && target === "start") {
      e.preventDefault();
      commit({ start: 0, end });
    } else if (e.key === "End" && target === "end") {
      e.preventDefault();
      commit({ start, end: duration });
    }
  };

  const startPercent = duration ? (start / duration) * 100 : 0;
  const endPercent = duration ? (end / duration) * 100 : 0;

  // The <audio> element is mounted unconditionally, before the branch
  // below: it's what reports the duration, so returning early on
  // `duration === null` would mean the element never exists, the
  // listener never attaches, and the control sits on its spinner
  // forever.
  return (
    <div className="space-y-3">
      <audio ref={audioElRef} preload="metadata" />

      {duration === null ? (
        <div className="flex h-28 items-center justify-center gap-2 rounded-xl border border-graphite-700 bg-graphite-850 text-xs text-text-subtle">
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
          Reading audio…
        </div>
      ) : (
        <ControlField
          as="fieldset"
          label="Clip range"
          meta={
            <span className="text-[13px] text-amber-400">
              {formatPrecise(start)} – {formatPrecise(end)}
            </span>
          }
          hint={
            <>
              Full length: {formatTime(duration)} — selected clip:{" "}
              {formatTime(Math.max(0, end - start))}. Drag across the waveform to select,
              double-click to reset.
            </>
          }
        >
          <div
            ref={containerRef}
            onPointerDown={handleTrackPointerDown}
            onDoubleClick={() => !disabled && commit({ start: 0, end: duration })}
            className="relative h-28 touch-none select-none overflow-hidden rounded-xl border border-graphite-700 bg-graphite-850"
          >
            <WaveformCanvas
              envelope={envelope}
              duration={duration}
              start={start}
              end={end}
              className="absolute inset-0 block"
            />

            {!envelope && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-text-subtle">
                {decodeFailed
                  ? "No waveform for this format — the handles still trim exactly"
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

            {/* Start handle */}
            <div
              role="slider"
              aria-label="Start time"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={start}
              aria-valuetext={formatPrecise(start)}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginDrag("start");
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
              aria-valuemax={duration}
              aria-valuenow={end}
              aria-valuetext={formatPrecise(end)}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginDrag("end");
              }}
              onKeyDown={handleKeyDown("end")}
              className="group absolute bottom-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none justify-center focus:outline-none"
              style={{ top: WAVEFORM_RULER_HEIGHT, left: `${endPercent}%` }}
            >
              <div className="h-full w-0.5 bg-amber-500 transition-colors group-focus-visible:bg-amber-400" />
              <div className="absolute top-0 h-2.5 w-2.5 rounded-b-sm bg-amber-500 transition-transform group-hover:scale-125 group-focus-visible:scale-125" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {/* The kit's Stepper takes a raw value and leaves bounds to the
                caller — which is what this file already did, so the arrows and
                the typed field go through the same clamp and can't disagree. */}
            <Stepper
              label="Start"
              value={start}
              step={KEY_STEP}
              bigStep={KEY_STEP_LARGE}
              disabled={disabled}
              onChange={(v) => commit({ start: clamp(v, 0, end - MIN_SELECTION), end })}
            />

            {/* Was a hand-rolled <button> until 2026-08-17. Moving to the
                shared Button brings the press state and, more usefully,
                `disabled:pointer-events-none` — the old one dimmed to 40% but
                still ran its hover styles, so a disabled control lit up amber
                under the cursor.

                aria-pressed was missing entirely: this is a toggle, and a
                screen reader had no way to know which state it was in.

                rounded-full and the amber hover are kept as overrides — it's a
                pill sitting between two steppers, not a standard action
                button. */}
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || end <= start}
              aria-pressed={isPreviewing}
              onClick={isPreviewing ? stopPreview : () => void startPreview()}
              className="rounded-full hover:border-amber-500/40 hover:text-amber-400"
            >
              {isPreviewing ? (
                <Square className="h-3 w-3" fill="currentColor" />
              ) : (
                <Play className="h-3 w-3" fill="currentColor" />
              )}
              {isPreviewing ? "Stop" : "Preview"}
            </Button>

            <Stepper
              label="End"
              value={end}
              step={KEY_STEP}
              bigStep={KEY_STEP_LARGE}
              disabled={disabled}
              onChange={(v) => commit({ start, end: clamp(v, start + MIN_SELECTION, duration) })}
            />
          </div>
        </ControlField>
      )}
    </div>
  );
}