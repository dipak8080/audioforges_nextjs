"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
 * The drag handling, the rAF playhead, the ref mirrors and the
 * one-update-per-gesture contract are the load-bearing parts of this file and
 * none of them are touched.
 *
 * 1. TWO AudioContexts PER FILE. The decode built one and closed it; the
 *    preview built a second and kept it. Chrome throws past six per document,
 *    and each one opens an audio device — so five files in a session was the
 *    ceiling, and the sixth preview would have thrown where nothing catches.
 *    One context now, module-scoped, used for both. NOT closed on unmount
 *    (the nodes are disconnected instead): closing a context another mount is
 *    about to use is how you get a dead preview button on the next file.
 *
 * 2. `await audio.play()` HAD NO CATCH. A blocked or interrupted play rejects,
 *    and this one is inside an async callback with no handler — an unhandled
 *    rejection, and `setIsPreviewing(true)` never runs, so the button sits on
 *    "Preview fade" having done nothing visible. TrimForm's equivalent already
 *    catches.
 *
 * 3. THE HANDLES ANNOUNCED THE WRONG RANGE. `aria-valuemax` was the constant
 *    30 on both, but the real ceiling is the shorter of 30 and what the other
 *    fade leaves — on a 4-second upload a screen reader was told the maximum
 *    was 30 while the control refused anything past ~4. Announced max is now
 *    the effective one.
 *
 * 4. THE STEPPER WAS A THIRD LOCAL COPY, and it was wrapped in a <label> that
 *    now contains another <label> — nested labels, which browsers resolve by
 *    guessing. The kit's version carries its own label and unit.
 *
 * 5. A 429 NAMES THE LIMIT, from RATE_LIMITS rather than typed here.
 */

const FADE_MAX_SECONDS = 30;
const KEY_STEP = 0.1;
const KEY_STEP_LARGE = 1;

const RATE_LIMIT_LABEL = getRateLimitLabel("fade");

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * ONE AudioContext for the page, lazily created, never closed.
 *
 * Used for BOTH the envelope decode and the preview graph. Chrome caps a
 * document at six and construction opens an audio device; this file used to
 * build two per file. Never closed because the preview graph outlives any
 * single decode, and because a context closed by one unmount would break the
 * next mount's preview.
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

type DragTarget = "in" | "out" | null;

interface Fades {
  fadeIn: number;
  fadeOut: number;
}

interface FadeControlsProps {
  file: File;
  disabled: boolean;
  fadeIn: number;
  fadeOut: number;
  onChange: (fadeIn: number, fadeOut: number) => void;
}

function FadeControls({
  file,
  disabled,
  fadeIn: committedIn,
  fadeOut: committedOut,
  onChange,
}: FadeControlsProps) {
  const [duration, setDuration] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<WaveformEnvelope | null>(null);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const [isDecoding, setIsDecoding] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);

  /* The live fade lengths are owned here, not by the parent form.
     Pushing every pointermove up to FadeForm re-rendered the whole
     JobToolForm tree — dropzone, header, submit button — to move one
     handle. The parent is told once, when the gesture ends.

     null means "untouched": the values shown come from the props
     clamped to the real track length, so nothing has to write state in
     an effect on mount. */
  const [local, setLocal] = useState<Fades | null>(null);

  const maxEach = duration === null ? FADE_MAX_SECONDS : Math.min(FADE_MAX_SECONDS, duration);
  const fallback: Fades = useMemo(() => {
    const inValue = clamp(committedIn, 0, maxEach);
    return {
      fadeIn: inValue,
      fadeOut: clamp(
        committedOut,
        0,
        duration === null ? maxEach : Math.max(0, Math.min(maxEach, duration - inValue))
      ),
    };
  }, [committedIn, committedOut, maxEach, duration]);
  const { fadeIn, fadeOut } = local ?? fallback;

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);

  const dragRef = useRef<DragTarget>(null);
  const fadesRef = useRef<Fades>({ fadeIn, fadeOut });
  const durationRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const clampSentRef = useRef(false);

  /* Mirrors of the values the window-level pointer listeners need.
     Written in an effect rather than during render so the listeners can
     be attached once and still read current values. */
  useEffect(() => {
    fadesRef.current = { fadeIn, fadeOut };
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
        // The shared context, not a second one built and closed per file.
        const buffer = await getAudioContext().decodeAudioData(arrayBuffer);
        if (cancelled) return;
        // Scanned in slices so a long file can't block the main
        // thread in one go — see computeWaveformEnvelopeAsync.
        const next = await computeWaveformEnvelopeAsync(buffer, undefined, abort.signal);
        if (!cancelled) setEnvelope(next);
      } catch {
        // decodeAudioData supports fewer formats than <audio> does, so a
        // failure here costs the drawing only — duration, handles and
        // preview all still work off the media element below. An abort
        // lands here too, and is silent: cancelled is already true.
        if (!cancelled) setDecodeFailed(true);
      } finally {
        if (!cancelled) setIsDecoding(false);
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

  /* Disconnect the graph, don't close the context. The nodes belong to this
     mount and leak if left attached; the context is shared with the next one.
     Closing it here is what would leave the following file with a dead
     preview button. */
  useEffect(() => {
    return () => {
      sourceNodeRef.current?.disconnect();
      gainNodeRef.current?.disconnect();
      sourceNodeRef.current = null;
      gainNodeRef.current = null;
    };
  }, []);

  /* --- once the real length is known, hand the clamped fades to the
     form. A 3s default is fine, but two 3s fades against a 4s upload
     have to come down, and the parent is what submits them. Guarded so
     a late durationchange can't overwrite fades the user already set. */
  useEffect(() => {
    if (duration === null || clampSentRef.current) return;
    clampSentRef.current = true;
    const cap = Math.min(FADE_MAX_SECONDS, duration);
    const nextIn = clamp(committedIn, 0, cap);
    // Fade-out shrinks first (arbitrary but consistent tie-break) so the
    // two can never overlap past the track's actual length.
    const nextOut = clamp(committedOut, 0, Math.max(0, Math.min(cap, duration - nextIn)));
    if (nextIn !== committedIn || nextOut !== committedOut) onChangeRef.current(nextIn, nextOut);
  }, [duration, committedIn, committedOut]);

  /** Update the visible fades and tell the parent — used for discrete
   *  edits (steppers, keyboard, typing) that end immediately. */
  const commit = useCallback((next: Fades) => {
    setLocal(next);
    onChangeRef.current(next.fadeIn, next.fadeOut);
  }, []);

  const clampFadeIn = useCallback(
    (next: number, currentOut: number, total: number) =>
      roundTenth(clamp(next, 0, Math.max(0, Math.min(FADE_MAX_SECONDS, total - currentOut)))),
    []
  );

  const clampFadeOut = useCallback(
    (next: number, currentIn: number, total: number) =>
      roundTenth(clamp(next, 0, Math.max(0, Math.min(FADE_MAX_SECONDS, total - currentIn)))),
    []
  );

  const ensureAudioGraph = useCallback(() => {
    if (!audioElRef.current) return;
    const ctx = getAudioContext();
    // createMediaElementSource may only be called ONCE per <audio>
    // element for its entire lifetime — guarded so re-renders never
    // call it twice, which would throw.
    if (!sourceNodeRef.current) {
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
  }, []);

  const startPreview = useCallback(async () => {
    if (!audioElRef.current || duration === null) return;
    ensureAudioGraph();
    const ctx = getAudioContext();
    const gain = gainNodeRef.current;
    if (!gain) return;

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

    // Rejections are normal here — autoplay policy, a pause landing between
    // the call and the promise. Unhandled, this became a console rejection
    // AND left the button reading "Preview fade" after appearing to do
    // nothing, because setIsPreviewing never ran.
    try {
      await audio.play();
      setIsPreviewing(true);
    } catch {
      setIsPreviewing(false);
    }
  }, [duration, fadeIn, fadeOut, ensureAudioGraph]);

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
     Driven imperatively off requestAnimationFrame. The previous version
     held the play position in state, so every frame re-rendered this
     subtree — and now would redraw the canvas — sixty times a second
     for one moving line. */
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
    const total = durationRef.current;
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
      const total = durationRef.current;
      if (!target || total === null) return;

      const time = timeFromClientX(pendingX);
      const current = fadesRef.current;

      if (target === "in") {
        setLocal({ fadeIn: clampFadeIn(time, current.fadeOut, total), fadeOut: current.fadeOut });
      } else {
        setLocal({
          fadeIn: current.fadeIn,
          fadeOut: clampFadeOut(total - time, current.fadeIn, total),
        });
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
      const final = fadesRef.current;
      onChangeRef.current(final.fadeIn, final.fadeOut);
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
  }, [timeFromClientX, clampFadeIn, clampFadeOut]);

  const beginDrag = (target: Exclude<DragTarget, null>) => {
    if (disabled || duration === null) return;
    if (isPreviewing) stopPreview();
    dragRef.current = target;
  };

  const setFadeIn = (next: number) => {
    if (duration === null) return;
    commit({ fadeIn: clampFadeIn(next, fadeOut, duration), fadeOut });
  };

  const setFadeOut = (next: number) => {
    if (duration === null) return;
    commit({ fadeIn, fadeOut: clampFadeOut(next, fadeIn, duration) });
  };

  const handleKeyDown = (target: "in" | "out") => (e: React.KeyboardEvent) => {
    if (disabled || duration === null) return;
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const current = target === "in" ? fadeIn : fadeOut;
    const set = target === "in" ? setFadeIn : setFadeOut;

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

  /* The drawing shows the audio as it will sound: the fade ramps the
     waveform itself down to nothing at the edges, rather than covering
     full-height audio with a scrim. */
  const fadeGain = useCallback(
    (time: number) => {
      if (duration === null) return 1;
      let g = 1;
      if (fadeIn > 0 && time < fadeIn) g = Math.min(g, time / fadeIn);
      if (fadeOut > 0 && time > duration - fadeOut) g = Math.min(g, (duration - time) / fadeOut);
      return clamp(g, 0, 1);
    },
    [duration, fadeIn, fadeOut]
  );

  const fadeInPercent = duration ? (fadeIn / duration) * 100 : 0;
  const fadeOutPercent = duration ? (fadeOut / duration) * 100 : 0;

  /* What the handle can ACTUALLY reach: 30s, or whatever the other fade
     leaves of the track — whichever is smaller. Announcing the constant 30
     told a screen reader the max was 30 on a 4-second upload. */
  const maxFadeIn = duration === null ? FADE_MAX_SECONDS : roundTenth(Math.max(0, Math.min(FADE_MAX_SECONDS, duration - fadeOut)));
  const maxFadeOut = duration === null ? FADE_MAX_SECONDS : roundTenth(Math.max(0, Math.min(FADE_MAX_SECONDS, duration - fadeIn)));

  // The <audio> element is mounted unconditionally, before the branch
  // below: it's what reports the duration, so returning early on
  // `duration === null` would mean the element never exists, the
  // listener never attaches, and the control sits on its spinner
  // forever.
  return (
    <div className="space-y-3">
      <audio ref={audioElRef} preload="metadata" />

      {duration === null ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Fade in / out</span>
          </div>
          <div className="flex h-28 items-center justify-center gap-2 rounded-xl border border-graphite-700 bg-graphite-850 text-xs text-text-subtle">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
            Reading track…
          </div>
        </>
      ) : (
        <ControlField
          as="fieldset"
          label="Fade in / out"
          meta={
            <span className="text-[13px] text-amber-400">
              {fadeIn.toFixed(1)}s / {fadeOut.toFixed(1)}s
            </span>
          }
          hint={`Drag or arrow-key either handle — capped to your track's length and ${FADE_MAX_SECONDS}s max per fade.`}
        >
          <div
            ref={containerRef}
            className="relative h-28 touch-none select-none overflow-hidden rounded-xl border border-graphite-700 bg-graphite-850"
          >
            <WaveformCanvas
              envelope={envelope}
              duration={duration}
              start={fadeIn}
              end={duration - fadeOut}
              gain={fadeGain}
              className="absolute inset-0 block"
            />

            {!envelope && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-text-subtle">
                {decodeFailed
                  ? "No waveform for this format — the fades still apply exactly"
                  : "Drawing waveform…"}
              </div>
            )}

            {/* The fade line itself, mirrored around the center so it
                tracks the waveform's own shape. Percent-based viewBox,
                so it scales with the container at any width. */}
            <svg
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{ top: WAVEFORM_RULER_HEIGHT }}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {fadeIn > 0 && (
                <>
                  <polyline
                    points={`0,50 ${fadeInPercent},4`}
                    fill="none"
                    stroke="rgb(240 184 98 / 0.75)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={`0,50 ${fadeInPercent},96`}
                    fill="none"
                    stroke="rgb(240 184 98 / 0.75)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
              {fadeOut > 0 && (
                <>
                  <polyline
                    points={`${100 - fadeOutPercent},4 100,50`}
                    fill="none"
                    stroke="rgb(240 184 98 / 0.75)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                  <polyline
                    points={`${100 - fadeOutPercent},96 100,50`}
                    fill="none"
                    stroke="rgb(240 184 98 / 0.75)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              )}
            </svg>

            {/* Playhead — moved by rAF, not by React */}
            <div
              ref={playheadRef}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 w-px bg-teal-400 opacity-0 transition-opacity"
              style={{ top: WAVEFORM_RULER_HEIGHT, left: 0 }}
            />

            {/* Fade-in handle */}
            <div
              role="slider"
              aria-label="Fade in length"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={maxFadeIn}
              aria-valuenow={fadeIn}
              aria-valuetext={`${fadeIn.toFixed(1)} seconds`}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.preventDefault();
                beginDrag("in");
              }}
              onKeyDown={handleKeyDown("in")}
              className="group absolute bottom-0 -ml-2.5 flex w-5 cursor-ew-resize touch-none justify-center focus:outline-none"
              style={{ top: WAVEFORM_RULER_HEIGHT, left: `${fadeInPercent}%` }}
            >
              <div className="h-full w-0.5 bg-amber-500 transition-colors group-focus-visible:bg-amber-400" />
              <div className="absolute top-0 h-2.5 w-2.5 rounded-b-sm bg-amber-500 transition-transform group-hover:scale-125 group-focus-visible:scale-125" />
            </div>

            {/* Fade-out handle */}
            <div
              role="slider"
              aria-label="Fade out length"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={maxFadeOut}
              aria-valuenow={fadeOut}
              aria-valuetext={`${fadeOut.toFixed(1)} seconds`}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => {
                e.preventDefault();
                beginDrag("out");
              }}
              onKeyDown={handleKeyDown("out")}
              className="group absolute bottom-0 -mr-2.5 flex w-5 cursor-ew-resize touch-none justify-center focus:outline-none"
              style={{ top: WAVEFORM_RULER_HEIGHT, right: `${fadeOutPercent}%` }}
            >
              <div className="h-full w-0.5 bg-amber-500 transition-colors group-focus-visible:bg-amber-400" />
              <div className="absolute top-0 h-2.5 w-2.5 rounded-b-sm bg-amber-500 transition-transform group-hover:scale-125 group-focus-visible:scale-125" />
            </div>
          </div>

          {/* Numeric entry — precise values for anyone who doesn't want
              to drag a handle to hit "2.3s" exactly. The kit's Stepper is a
              <label> in its own right; the old one was wrapped in another
              one, which nests labels and leaves the association to the
              browser's judgement. */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Stepper
              label="Fade in"
              value={fadeIn}
              step={KEY_STEP}
              bigStep={KEY_STEP}
              precision={1}
              unit="s"
              disabled={disabled}
              onChange={setFadeIn}
            />

            <Button
              variant="outline"
              size="sm"
              disabled={disabled || isDecoding}
              aria-pressed={isPreviewing}
              onClick={isPreviewing ? stopPreview : () => void startPreview()}
              className="rounded-full hover:border-amber-500/40 hover:text-amber-400"
            >
              {isPreviewing ? (
                <Square className="h-3 w-3" fill="currentColor" />
              ) : (
                <Play className="h-3 w-3" fill="currentColor" />
              )}
              {isPreviewing ? "Stop" : "Preview fade"}
            </Button>

            <Stepper
              label="Fade out"
              value={fadeOut}
              step={KEY_STEP}
              bigStep={KEY_STEP}
              precision={1}
              unit="s"
              disabled={disabled}
              onChange={setFadeOut}
            />
          </div>
        </ControlField>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

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
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Fades are limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
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
          /* Keyed per file: selecting a different file remounts the
             controls with fresh state, instead of resetting half a
             dozen useState values by hand inside an effect. */
          <FadeControls
            key={`${file.name}:${file.size}:${file.lastModified}`}
            file={file}
            disabled={disabled}
            fadeIn={fadeIn}
            fadeOut={fadeOut}
            onChange={(i, o) => {
              setFadeIn(i);
              setFadeOut(o);
            }}
          />
        ) : null
      }
    />
  );
}