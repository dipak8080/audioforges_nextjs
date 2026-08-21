"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Volume1, VolumeX, AlertTriangle, Gauge, Repeat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WaveformCanvas } from "@/components/ui/WaveformCanvas";
import { decodeWaveformEnvelopeFromUrl, type WaveformEnvelope } from "@/lib/utils/waveform";

interface AudioPlayerProps {
  src: string;
  className?: string;
  /** Names the player for screen readers, e.g. "Vocals" on the stems
   *  page where four of these sit in a row and "Audio player" four
   *  times tells you nothing. */
  title?: string;
  /** Fires once the media element reports a usable duration. Lets a
   *  parent show the length next to the player without mounting a
   *  second <audio> just to read metadata. */
  onDuration?: (seconds: number) => void;
  /**
   * Fires as playback position changes, at the media element's own
   * timeupdate rate (~4Hz) plus immediately on every seek. That's ample
   * for following along a transcript, where segments run seconds long.
   *
   * Deliberately NOT driven at frame rate: the playhead moves at 60fps
   * via direct DOM writes precisely so this component doesn't re-render
   * sixty times a second, and calling a parent's setState that often
   * would give the whole cost straight back.
   */
  onTimeUpdate?: (seconds: number) => void;
  /**
   * Filled with a seek function on mount and cleared on unmount, so a
   * parent can jump playback without owning the audio element — a
   * transcript line, a chapter marker, a loop point.
   *
   * Typed structurally rather than as MutableRefObject/RefObject because
   * those two swapped meanings between React 18 and 19; a plain
   * `{ current: ... }` satisfies useRef's return type under both.
   */
  seekRef?: { current: ((seconds: number) => void) | null };
  /**
   * Set false to skip the waveform decode and use the plain progress
   * track instead.
   *
   * The decode is not free: it pulls the whole file into an
   * ArrayBuffer, then decodeAudioData expands it to Float32 — a 4-minute
   * stereo WAV is ~47MB on disk and ~90MB decoded, held at the same
   * time. That's fine on desktop and a plausible tab crash on a
   * mid-range phone.
   *
   * Callers rarely need this now — see `maxWaveformSeconds`, which
   * enforces the same ceiling automatically. Keep it for the cases where
   * a caller knows up front that a waveform is pointless.
   */
  showWaveform?: boolean;
  /**
   * Longest source that gets a drawn waveform, in seconds.
   *
   * DECODED SIZE IS A FUNCTION OF DURATION, NOT FILE SIZE. Float32 at
   * 48kHz stereo is ~384 KB per second regardless of codec, so a 6MB
   * 20-minute MP3 and a 200MB 20-minute WAV both expand to roughly
   * 460MB in memory — and the ArrayBuffer is still held alongside it.
   * A phone does not survive that.
   *
   * Guarding on bytes, which is the obvious instinct, catches the WAV
   * and waves the MP3 straight through. So the check waits for
   * `loadedmetadata` and reads the real duration. Five minutes is about
   * 115MB decoded, which is survivable; past that the player falls back
   * to the plain rail and loses nothing but the drawing.
   *
   * This matters most on the transcription tools, where 20-minute
   * uploads are the normal case rather than the outlier.
   */
  maxWaveformSeconds?: number;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP = 5;
const SEEK_STEP_LARGE = 15;
const VOLUME_STEP = 0.1;

/** Minimum gap between seeks while dragging. Without it, every pointer
 *  frame assigns currentTime — ~60 seeks/sec, which on a streamed URL is
 *  ~60 range requests/sec and audible stuttering. The drawn playhead
 *  still follows the pointer at full frame rate; only the media element
 *  is throttled, and the final position is always committed on release. */
const SCRUB_SEEK_INTERVAL_MS = 120;

/* Stable identities. WaveformCanvas re-runs its draw effect whenever any
   prop changes, so an inline arrow here would redraw both canvases on
   every single render — which is exactly what the layering below exists
   to avoid. */
const SELECT_ALL = () => true;
const SELECT_NONE = () => false;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }) {
  if (muted || volume === 0) return <VolumeX className="h-4 w-4" />;
  if (volume < 0.5) return <Volume1 className="h-4 w-4" />;
  return <Volume2 className="h-4 w-4" />;
}

/**
 * Keyed on `src` so a new source remounts the whole player with fresh
 * state, rather than resetting a dozen useState values by hand inside an
 * effect. Parents can't pass the key themselves, so the split happens
 * here — the public component stays a plain <AudioPlayer src=... />.
 */
export function AudioPlayer(props: AudioPlayerProps) {
  return <AudioPlayerInstance key={props.src} {...props} />;
}

function AudioPlayerInstance({
  src,
  className,
  title,
  onDuration,
  onTimeUpdate,
  seekRef,
  showWaveform = true,
  maxWaveformSeconds = 300,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const rateMenuRef = useRef<HTMLDivElement>(null);
  const rateButtonRef = useRef<HTMLButtonElement>(null);

  /* Written directly by the animation loop below, never through state —
     see the comment on the rAF effect. */
  const progressRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  /* Held in a ref so commitTime below can stay identity-stable. A parent
     passing an inline arrow would otherwise change the callback on every
     render, tearing down and rebuilding the seekRef effect each time. */
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const [bufferedFraction, setBufferedFraction] = useState(0);

  const [envelope, setEnvelope] = useState<WaveformEnvelope | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  /** Single place position changes are recorded, so a parent listening
   *  via onTimeUpdate hears about seeks and scrubs too — not just the
   *  media element's own periodic events. */
  const commitTime = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    onTimeUpdateRef.current?.(seconds);
  }, []);

  /* --- decode the waveform for this source -------------------------
     Gated on the real duration, so this fires after loadedmetadata
     rather than on mount. The delay is imperceptible next to the decode
     itself, and it's the only point at which we know whether decoding is
     safe — see the maxWaveformSeconds note above. */
  useEffect(() => {
    if (!showWaveform) return;
    if (duration <= 0) return;
    if (duration > maxWaveformSeconds) return;

    const controller = new AbortController();
    // Waveform is cosmetic — if this fails (CORS, unsupported codec,
    // network blip) the player still works fully via the plain track,
    // it just loses the drawing.
    decodeWaveformEnvelopeFromUrl(src, controller.signal).then((result) => {
      if (!controller.signal.aborted) setEnvelope(result);
    });

    return () => controller.abort();
  }, [src, showWaveform, duration, maxWaveformSeconds]);

  /* --- keep the element in sync with state ------------------------- */
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = isLooping;
  }, [isLooping]);

  /* --- close the speed menu on outside click or Escape -------------- */
  useEffect(() => {
    if (!rateMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target as Node)) setRateMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setRateMenuOpen(false);
      // Focus would otherwise fall to <body>, stranding a keyboard user
      // at the top of the document.
      rateButtonRef.current?.focus();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [rateMenuOpen]);

  /* ------------------------------------------------------------------ */
  /* Playhead                                                            */
  /*                                                                     */
  /* Progress is drawn as a full-width amber copy of the waveform with a  */
  /* clip-path over a grey base copy, rather than by re-running the       */
  /* canvas with a new selection range. Both canvases rasterize once and  */
  /* then never again until the envelope, duration or size changes, so    */
  /* advancing the playhead costs two style writes instead of ~1200 rect  */
  /* fills — which is what makes a 60fps playhead affordable at all.      */
  /*                                                                     */
  /* Those writes go straight to the DOM. Routing them through state      */
  /* would re-render this whole subtree sixty times a second to move one  */
  /* line; `currentTime` state still updates at the media element's own   */
  /* timeupdate rate (~4Hz), which is all the readout and aria-valuenow   */
  /* need.                                                               */
  /* ------------------------------------------------------------------ */
  const applyFraction = useCallback((fraction: number) => {
    const pct = clamp(fraction, 0, 1) * 100;
    if (progressRef.current) progressRef.current.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    if (playheadRef.current) playheadRef.current.style.left = `${pct}%`;
  }, []);

  // Authoritative sync: seeks, scrub previews, pause, load, resize.
  const stateFraction = duration > 0 ? currentTime / duration : 0;
  const displayFraction = scrubbing && hoverFraction !== null ? hoverFraction : stateFraction;

  useEffect(() => {
    applyFraction(displayFraction);
  }, [displayFraction, applyFraction, envelope, isLoading]);

  // Smooth motion between timeupdate events, only while it's actually
  // moving. Paused or mid-drag, the effect above owns the position.
  useEffect(() => {
    if (!isPlaying || scrubbing || duration <= 0) return;
    let frame = requestAnimationFrame(function tick() {
      const audio = audioRef.current;
      if (audio) applyFraction(audio.currentTime / duration);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, scrubbing, duration, applyFraction]);

  /* --- transport ---------------------------------------------------- */
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasError) return;
    if (audio.paused) {
      // play() rejects if interrupted by a near-simultaneous pause() —
      // swallow that instead of an unhandled rejection in the console.
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [hasError]);

  const toggleMute = () => setIsMuted((m) => !m);

  const seekToFraction = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const time = clamp(fraction, 0, 1) * duration;
      audio.currentTime = time;
      commitTime(time);
    },
    [duration, commitTime]
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio || !audio.duration) return;
      // Read position off the element rather than state: state lags by up
      // to a timeupdate interval, so holding an arrow key would compound
      // that stale offset.
      const time = clamp(audio.currentTime + deltaSeconds, 0, audio.duration);
      audio.currentTime = time;
      commitTime(time);
    },
    [commitTime]
  );

  /* --- imperative seek for parents ---------------------------------
     Absolute seconds rather than a fraction: a caller holding transcript
     timings already has seconds and shouldn't need to know the duration
     to divide by. Starts playback, because every use of this is someone
     clicking a moment they want to hear. */
  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const target = clamp(seconds, 0, audio.duration || seconds);
      audio.currentTime = target;
      commitTime(target);
      audio.play().catch(() => {});
    };
    return () => {
      seekRef.current = null;
    };
  }, [seekRef, commitTime]);

  /* --- waveform pointer scrubbing ------------------------------------ */
  const fractionFromClientX = useCallback((clientX: number) => {
    if (!waveformRef.current) return 0;
    const rect = waveformRef.current.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }, []);

  /* Pointer events fire faster than the display refreshes (120Hz+ on a
     trackpad), so they're coalesced into one update per frame. The drawn
     position follows every frame; the media element is seeked at most
     every SCRUB_SEEK_INTERVAL_MS, then committed exactly on release. */
  useEffect(() => {
    if (!scrubbing) return;
    let frame = 0;
    let pendingX = 0;
    let lastSeekAt = 0;
    let lastFraction: number | null = null;

    const apply = () => {
      frame = 0;
      const fraction = fractionFromClientX(pendingX);
      lastFraction = fraction;
      setHoverFraction(fraction);
      applyFraction(fraction);

      const now = performance.now();
      if (now - lastSeekAt >= SCRUB_SEEK_INTERVAL_MS) {
        lastSeekAt = now;
        seekToFraction(fraction);
      }
    };

    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onUp = () => {
      if (lastFraction !== null) seekToFraction(lastFraction);
      setScrubbing(false);
      setHoverFraction(null);
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
  }, [scrubbing, fractionFromClientX, seekToFraction, applyFraction]);

  const handleWaveformKeyDown = (e: React.KeyboardEvent) => {
    // Digits jump to that tenth of the track, the convention every video
    // player on the web already taught people.
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      seekToFraction(Number(e.key) / 10);
      return;
    }

    switch (e.key) {
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekBy(e.shiftKey ? -SEEK_STEP_LARGE : -SEEK_STEP);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(e.shiftKey ? SEEK_STEP_LARGE : SEEK_STEP);
        break;
      case "ArrowUp":
        e.preventDefault();
        setVolume((v) => clamp(v + VOLUME_STEP, 0, 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        setVolume((v) => clamp(v - VOLUME_STEP, 0, 1));
        break;
      case "m":
      case "M":
        e.preventDefault();
        toggleMute();
        break;
      case "l":
      case "L":
        e.preventDefault();
        setIsLooping((v) => !v);
        break;
      case "Home":
        e.preventDefault();
        seekToFraction(0);
        break;
      case "End":
        e.preventDefault();
        seekToFraction(0.999);
        break;
    }
  };

  /* Only worth showing while it's genuinely incomplete. A blob preview
     is buffered the instant it loads, so this never appears there — it's
     for job results streamed off the API over a slow connection. */
  const showBuffered = bufferedFraction > 0.01 && bufferedFraction < 0.995;

  return (
    /* graphite-900, not 850, and p-3 rather than p-4.
       This sits directly above the transcript pane, which is an 850
       surface at p-3 — two identical panels stacked read as one
       mis-drawn box. Darker and tighter makes the player read as chrome
       for the thing below it. */
    <div
      className={cn("rounded-lg border border-graphite-700 bg-graphite-900 p-3", className)}
      role="group"
      aria-label={title ? `Audio player — ${title}` : "Audio player"}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          // Guarded against Infinity/NaN: some MP3s report an unknown
          // duration until the browser has buffered further, and
          // accepting that turns every fraction below into NaN.
          const reported = e.currentTarget.duration;
          if (Number.isFinite(reported) && reported > 0) {
            setDuration(reported);
            onDuration?.(reported);
          }
          setIsLoading(false);
        }}
        onDurationChange={(e) => {
          const reported = e.currentTarget.duration;
          if (Number.isFinite(reported) && reported > 0) {
            setDuration(reported);
            onDuration?.(reported);
          }
        }}
        // Backstop: a source that becomes playable without ever firing
        // loadedmetadata would otherwise leave the transport disabled
        // forever behind the skeleton.
        onCanPlay={() => setIsLoading(false)}
        onProgress={(e) => {
          const audio = e.currentTarget;
          if (!audio.buffered.length || !Number.isFinite(audio.duration) || !audio.duration) return;
          setBufferedFraction(audio.buffered.end(audio.buffered.length - 1) / audio.duration);
        }}
        onTimeUpdate={(e) => {
          // Suppressed mid-drag: the pointer owns the position then, and
          // letting the element's own events through would fight it.
          if (!scrubbing) commitTime(e.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          commitTime(0);
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />

      {hasError ? (
        <div className="flex items-center gap-2.5 py-1.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          This preview wouldn&apos;t play in your browser. The file itself is fine — download it and
          open it in your player.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* The only filled amber control on the page that wasn't a
                Button. Now wears the same clothes: inset top highlight
                instead of a flat fill, and a real press. Circular is
                correct here — that's transport convention, not drift. */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoading}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
                "transition-[background-color,transform] duration-150",
                "hover:bg-amber-400 active:bg-amber-600 active:translate-y-px motion-reduce:active:translate-y-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
                "disabled:pointer-events-none disabled:opacity-60"
              )}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
              )}
            </button>

            {/* Waveform / scrub bar */}
            <div
              ref={waveformRef}
              role="slider"
              aria-label="Seek"
              aria-orientation="horizontal"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              tabIndex={isLoading ? -1 : 0}
              onKeyDown={handleWaveformKeyDown}
              onPointerDown={(e) => {
                if (isLoading) return;
                setScrubbing(true);
                const fraction = fractionFromClientX(e.clientX);
                setHoverFraction(fraction);
                applyFraction(fraction);
                seekToFraction(fraction);
              }}
              onMouseMove={(e) => {
                if (!scrubbing) setHoverFraction(fractionFromClientX(e.clientX));
              }}
              onMouseLeave={() => {
                if (!scrubbing) setHoverFraction(null);
              }}
              className={cn(
                "relative h-11 flex-1 select-none overflow-hidden rounded-md",
                // Without touch-action:none a drag on mobile scrolls the
                // page and scrubs simultaneously — the strip fights the
                // scroll and neither gesture wins cleanly.
                "touch-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                isLoading ? "cursor-default" : "cursor-pointer"
              )}
            >
              {isLoading ? (
                <div className="absolute inset-0 flex items-center gap-px px-0.5">
                  {Array.from({ length: 48 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 animate-pulse rounded-sm bg-graphite-800 motion-reduce:animate-none"
                      style={{ height: "35%", animationDelay: `${i * 20}ms` }}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {/* Base layer: the whole track, unplayed. Either the
                      real envelope or a plain rail while it decodes — or
                      permanently, if the decode failed or the source is
                      past maxWaveformSeconds. */}
                  {envelope ? (
                    <WaveformCanvas
                      envelope={envelope}
                      duration={duration}
                      start={0}
                      end={duration}
                      isSelected={SELECT_NONE}
                      showRuler={false}
                      className="absolute inset-0 block"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center px-0.5">
                      <div className="h-1.5 w-full rounded-full bg-graphite-700" />
                    </div>
                  )}

                  {/* Buffered extent, behind the played region. */}
                  {showBuffered && (
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-graphite-700"
                      aria-hidden
                    >
                      <div
                        className="h-full bg-text-subtle/60 transition-[width] duration-300 ease-out"
                        style={{ width: `${bufferedFraction * 100}%` }}
                      />
                    </div>
                  )}

                  {/* Played layer: an identical copy in amber, revealed
                      by clip-path. Full width at all times — clipping
                      doesn't change layout, so the canvas underneath
                      never needs to re-rasterize as playback advances. */}
                  <div
                    ref={progressRef}
                    className="pointer-events-none absolute inset-0"
                    style={{ clipPath: "inset(0 100% 0 0)" }}
                    aria-hidden
                  >
                    {envelope ? (
                      <WaveformCanvas
                        envelope={envelope}
                        duration={duration}
                        start={0}
                        end={duration}
                        isSelected={SELECT_ALL}
                        showRuler={false}
                        className="absolute inset-0 block"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center px-0.5">
                        <div className="h-1.5 w-full rounded-full bg-amber-500" />
                      </div>
                    )}
                  </div>

                  {/* Playhead */}
                  <div
                    ref={playheadRef}
                    className="pointer-events-none absolute inset-y-0 w-px bg-amber-300"
                    style={{ left: "0%" }}
                    aria-hidden
                  />

                  {/* Hover / scrub preview time */}
                  {hoverFraction !== null && duration > 0 && (
                    <div
                      className="pointer-events-none absolute top-1 -translate-x-1/2 rounded bg-graphite-950/90 px-1.5 py-0.5 font-mono text-[10px] text-text-primary shadow-sm"
                      style={{ left: `${clamp(hoverFraction, 0.06, 0.94) * 100}%` }}
                    >
                      {formatTime(hoverFraction * duration)}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Time display — click to toggle remaining vs. total */}
            <button
              type="button"
              onClick={() => setShowRemaining((v) => !v)}
              className="shrink-0 rounded px-1 font-mono text-[11px] tabular-nums text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              aria-label={showRemaining ? "Show total time" : "Show remaining time"}
            >
              {formatTime(currentTime)} /{" "}
              {showRemaining
                ? `-${formatTime(Math.max(duration - currentTime, 0))}`
                : formatTime(duration)}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-graphite-800 pt-2.5">
            {/* Volume */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="shrink-0 rounded text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                <VolumeIcon volume={volume} muted={isMuted} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setVolume(next);
                  if (next > 0 && isMuted) setIsMuted(false);
                }}
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-graphite-700 accent-amber-500 sm:w-24"
                aria-label="Volume"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {/* Loop — the reason someone plays the same eight bars
                  twenty times while checking a bounce. */}
              <button
                type="button"
                onClick={() => setIsLooping((v) => !v)}
                aria-pressed={isLooping}
                aria-label="Loop"
                className={cn(
                  "rounded-md border px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                  isLooping
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-graphite-700 text-text-muted hover:text-text-primary"
                )}
              >
                <Repeat className="h-3 w-3" aria-hidden />
              </button>

              {/* Playback speed */}
              <div className="relative" ref={rateMenuRef}>
                <button
                  ref={rateButtonRef}
                  type="button"
                  onClick={() => setRateMenuOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                    playbackRate !== 1
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      : "border-graphite-700 text-text-muted hover:text-text-primary"
                  )}
                  aria-haspopup="listbox"
                  aria-expanded={rateMenuOpen}
                  aria-label={`Playback speed, ${playbackRate}x`}
                >
                  <Gauge className="h-3 w-3" aria-hidden />
                  {playbackRate}x
                </button>

                {rateMenuOpen && (
                  /* OPENS DOWNWARD (2026-08-21).
                     Was bottom-full. Fine when the player sat inline, but
                     on the transcript pages it's `sticky top-2` — parked
                     8px below the top of the viewport, where a ~150px
                     menu opening upward renders entirely off-screen.
                     Downward it overlaps the transcript, which is
                     harmless: the sticky wrapper carries z-20 and this
                     sits above it. */
                  <div
                    role="listbox"
                    aria-label="Playback speed"
                    className="absolute right-0 top-full z-30 mt-1.5 overflow-hidden rounded-md border border-graphite-700 bg-graphite-900 shadow-lg shadow-graphite-950/60"
                  >
                    {PLAYBACK_RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        role="option"
                        aria-selected={playbackRate === rate}
                        onClick={() => {
                          setPlaybackRate(rate);
                          setRateMenuOpen(false);
                          rateButtonRef.current?.focus();
                        }}
                        className={cn(
                          "block w-full px-3 py-1.5 text-right font-mono text-[13px] transition-colors",
                          playbackRate === rate
                            ? "bg-amber-500/10 text-amber-400"
                            : "text-text-muted hover:bg-graphite-800 hover:text-text-primary"
                        )}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}