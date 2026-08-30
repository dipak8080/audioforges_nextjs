"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Gauge,
  Loader2,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WaveformCanvas } from "@/components/ui/WaveformCanvas";
import { decodeWaveformEnvelopeFromUrl, type WaveformEnvelope } from "@/lib/utils/waveform";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * Props are unchanged, so every caller keeps working. Five fixes and four
 * additions, all of them in the same spirit as what was already here.
 *
 * FIXED
 *
 * 1. HOVER DROVE A FULL RE-RENDER PER MOUSE EVENT. `onMouseMove` called
 *    setHoverFraction directly, so moving the pointer across the waveform
 *    re-rendered this whole subtree at pointer rate — 60–120Hz on a trackpad.
 *    That is precisely the cost the rAF playhead and the clip-path layering
 *    exist to avoid, reintroduced by the tooltip. Hover is now coalesced to
 *    one update per frame and ignored below a ~0.4% move, which is under a
 *    pixel on a typical bar.
 *
 * 2. `onEnded` LEFT THE ELEMENT AT THE END WHILE THE UI SAID 0:00.
 *    `commitTime(0)` moved the readout and the playhead back to the start but
 *    never touched `audio.currentTime`, so the two disagreed until the next
 *    play. Now both are reset.
 *
 * 3. `onDuration` FIRED REPEATEDLY. `durationchange` can fire several times
 *    for the same source as a stream is buffered, and each one called the
 *    parent again with the same number. Reported once per actual change.
 *
 * 4. A STALL LOOKED IDENTICAL TO A PAUSE. On a slow connection the element
 *    fires `waiting` and playback silently stops with the pause icon showing
 *    and nothing explaining why. The transport now shows a spinner while the
 *    element is starved.
 *
 * 5. A FAILED LOAD WAS A DEAD END. `onError` fires for transient things too —
 *    a dropped connection mid-stream — and the only way back was reloading the
 *    page. There's a Try again button now, which calls load() on the element.
 *
 * ADDED
 *
 * 6. Skip buttons. Every keyboard shortcut here is unreachable on a phone,
 *    which is where scrubbing a waveform accurately is hardest.
 * 7. Volume, mute and speed carry across players within the page session.
 *    Four stems in a row meant setting the volume four times.
 * 8. The keyboard shortcuts are discoverable — listed in the scrub area's
 *    tooltip and declared with aria-keyshortcuts, instead of being a secret.
 * 9. The loading skeleton has a waveform's shape rather than a flat row of
 *    equal bars, so the placeholder reads as "a waveform is coming".
 */

interface AudioPlayerProps {
  src: string;
  className?: string;
  /** Names the player for screen readers, e.g. "Vocals" on the stems page where
   *  four of these sit in a row and "Audio player" four times tells you
   *  nothing. */
  title?: string;
  /** Fires once the media element reports a usable duration. Lets a parent show
   *  the length next to the player without mounting a second <audio> just to
   *  read metadata. */
  onDuration?: (seconds: number) => void;
  /**
   * Fires as playback position changes, at the media element's own timeupdate
   * rate (~4Hz) plus immediately on every seek. That's ample for following
   * along a transcript, where segments run seconds long.
   *
   * Deliberately NOT driven at frame rate: the playhead moves at 60fps via
   * direct DOM writes precisely so this component doesn't re-render sixty times
   * a second, and calling a parent's setState that often would give the whole
   * cost straight back.
   */
  onTimeUpdate?: (seconds: number) => void;
  /**
   * Filled with a seek function on mount and cleared on unmount, so a parent can
   * jump playback without owning the audio element — a transcript line, a
   * chapter marker, a loop point.
   *
   * Typed structurally rather than as MutableRefObject/RefObject because those
   * two swapped meanings between React 18 and 19; a plain `{ current: ... }`
   * satisfies useRef's return type under both.
   */
  seekRef?: { current: ((seconds: number) => void) | null };
  /**
   * Set false to skip the waveform decode and use the plain progress track
   * instead.
   *
   * The decode is not free: it pulls the whole file into an ArrayBuffer, then
   * decodeAudioData expands it to Float32 — a 4-minute stereo WAV is ~47MB on
   * disk and ~90MB decoded, held at the same time. That's fine on desktop and a
   * plausible tab crash on a mid-range phone.
   *
   * Callers rarely need this now — see `maxWaveformSeconds`, which enforces the
   * same ceiling automatically. Keep it for the cases where a caller knows up
   * front that a waveform is pointless.
   */
  showWaveform?: boolean;
  /**
   * Longest source that gets a drawn waveform, in seconds.
   *
   * DECODED SIZE IS A FUNCTION OF DURATION, NOT FILE SIZE. Float32 at 48kHz
   * stereo is ~384 KB per second regardless of codec, so a 6MB 20-minute MP3
   * and a 200MB 20-minute WAV both expand to roughly 460MB in memory — and the
   * ArrayBuffer is still held alongside it. A phone does not survive that.
   *
   * Guarding on bytes, which is the obvious instinct, catches the WAV and waves
   * the MP3 straight through. So the check waits for `loadedmetadata` and reads
   * the real duration. Five minutes is about 115MB decoded, which is
   * survivable; past that the player falls back to the plain rail and loses
   * nothing but the drawing.
   *
   * This matters most on the transcription tools, where 20-minute uploads are
   * the normal case rather than the outlier.
   */
  maxWaveformSeconds?: number;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP = 5;
const SEEK_STEP_LARGE = 15;
const VOLUME_STEP = 0.1;

/** Minimum gap between seeks while dragging. Without it, every pointer frame
 *  assigns currentTime — ~60 seeks/sec, which on a streamed URL is ~60 range
 *  requests/sec and audible stuttering. The drawn playhead still follows the
 *  pointer at full frame rate; only the media element is throttled, and the
 *  final position is always committed on release. */
const SCRUB_SEEK_INTERVAL_MS = 120;

/** Ignore hover moves smaller than this. Under a pixel on a typical bar, and it
 *  keeps a slow drift across the waveform from re-rendering on every frame. */
const HOVER_EPSILON = 0.004;

/**
 * Carried across players for the life of the page, not stored.
 *
 * Four stems on /stems means four separate players; setting the volume on each
 * one in turn is busywork. Module scope rather than localStorage on purpose:
 * nothing is persisted, nothing is read during SSR, and there's no hydration
 * mismatch to reason about — a fresh page load starts at the defaults again.
 */
let sessionVolume = 1;
let sessionMuted = false;
let sessionRate = 1;

/* Stable identities. WaveformCanvas re-runs its draw effect whenever any prop
   changes, so an inline arrow here would redraw both canvases on every single
   render — which is exactly what the layering below exists to avoid. */
const SELECT_ALL = () => true;
const SELECT_NONE = () => false;

/** Fixed heights, not random: a placeholder that reshuffles on every render
 *  reads as noise. This is one bar pattern, shaped like audio. */
const SKELETON_BARS = Array.from({ length: 56 }, (_, i) =>
  Math.round(28 + 46 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)))
);

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

/** Small square control. Loop, speed and the two skip buttons all wear it, so
 *  they can't drift apart one restyle at a time. forwardRef because the speed
 *  button needs its own ref to take focus back when the menu closes. */
const MiniButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(function MiniButton({ active, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={cn(
        "flex items-center gap-1 rounded-md border px-2 py-1 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
          : "border-graphite-700 text-text-muted hover:border-graphite-600 hover:text-text-primary",
        className
      )}
    >
      {children}
    </button>
  );
});

/**
 * Keyed on `src` so a new source remounts the whole player with fresh state,
 * rather than resetting a dozen useState values by hand inside an effect.
 * Parents can't pass the key themselves, so the split happens here — the public
 * component stays a plain <AudioPlayer src=... />.
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

  /* Written directly by the animation loop below, never through state — see the
     comment on the rAF effect. */
  const progressRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  /* Held in a ref so commitTime below can stay identity-stable. A parent passing
     an inline arrow would otherwise change the callback on every render, tearing
     down and rebuilding the seekRef effect each time. */
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(sessionVolume);
  const [isMuted, setIsMuted] = useState(sessionMuted);
  const [isLooping, setIsLooping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStalled, setIsStalled] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(sessionRate);
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const [bufferedFraction, setBufferedFraction] = useState(0);

  const [envelope, setEnvelope] = useState<WaveformEnvelope | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  /** Last duration handed to the parent. `durationchange` fires more than once
   *  per source while a stream buffers, and the parent shouldn't hear about the
   *  same number twice. */
  const reportedDurationRef = useRef(0);

  /** Single place position changes are recorded, so a parent listening via
   *  onTimeUpdate hears about seeks and scrubs too — not just the media
   *  element's own periodic events. */
  const commitTime = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    onTimeUpdateRef.current?.(seconds);
  }, []);

  const reportDuration = useCallback(
    (reported: number) => {
      // Guarded against Infinity/NaN: some MP3s report an unknown duration until
      // the browser has buffered further, and accepting that turns every
      // fraction below into NaN.
      if (!Number.isFinite(reported) || reported <= 0) return;
      setDuration(reported);
      if (Math.abs(reported - reportedDurationRef.current) < 0.01) return;
      reportedDurationRef.current = reported;
      onDuration?.(reported);
    },
    [onDuration]
  );

  /* --- decode the waveform for this source -------------------------
     Gated on the real duration, so this fires after loadedmetadata rather than
     on mount. The delay is imperceptible next to the decode itself, and it's the
     only point at which we know whether decoding is safe — see the
     maxWaveformSeconds note above. */
  useEffect(() => {
    if (!showWaveform) return;
    if (duration <= 0) return;
    if (duration > maxWaveformSeconds) return;

    const controller = new AbortController();
    // Waveform is cosmetic — if this fails (CORS, unsupported codec, network
    // blip) the player still works fully via the plain track, it just loses the
    // drawing.
    decodeWaveformEnvelopeFromUrl(src, controller.signal).then((result) => {
      if (!controller.signal.aborted) setEnvelope(result);
    });

    return () => controller.abort();
  }, [src, showWaveform, duration, maxWaveformSeconds]);

  /* --- keep the element in sync with state -------------------------
     Each of these also records the value for the next player mounted on this
     page, so a stack of stems doesn't need the same adjustment four times. */
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    sessionVolume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
    sessionMuted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
    sessionRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = isLooping;
  }, [isLooping]);

  /* --- close the speed menu on outside click or Escape -------------- */
  useEffect(() => {
    if (!rateMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target as Node)) {
        setRateMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setRateMenuOpen(false);
      // Focus would otherwise fall to <body>, stranding a keyboard user at the
      // top of the document.
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

  // Smooth motion between timeupdate events, only while it's actually moving.
  // Paused or mid-drag, the effect above owns the position.
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
      // play() rejects if interrupted by a near-simultaneous pause() — swallow
      // that instead of an unhandled rejection in the console.
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
      // Read position off the element rather than state: state lags by up to a
      // timeupdate interval, so holding an arrow key would compound that stale
      // offset.
      const time = clamp(audio.currentTime + deltaSeconds, 0, audio.duration);
      audio.currentTime = time;
      commitTime(time);
    },
    [commitTime]
  );

  const retryLoad = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setHasError(false);
    setIsLoading(true);
    audio.load();
  }, []);

  /* --- imperative seek for parents ---------------------------------
     Absolute seconds rather than a fraction: a caller holding transcript timings
     already has seconds and shouldn't need to know the duration to divide by.
     Starts playback, because every use of this is someone clicking a moment they
     want to hear. */
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
     position follows every frame; the media element is seeked at most every
     SCRUB_SEEK_INTERVAL_MS, then committed exactly on release. */
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

  /* --- hover preview, coalesced --------------------------------------
     This used to call setState straight from onMouseMove, so simply moving the
     pointer across the waveform re-rendered the player at pointer rate — the
     exact cost the playhead and the clip-path layering exist to avoid. One
     update per frame, and only when the position actually moved. */
  const hoverFrameRef = useRef(0);
  const hoverXRef = useRef(0);
  const hoverValueRef = useRef<number | null>(null);

  const queueHover = useCallback(
    (clientX: number) => {
      hoverXRef.current = clientX;
      if (hoverFrameRef.current) return;
      hoverFrameRef.current = requestAnimationFrame(() => {
        hoverFrameRef.current = 0;
        const fraction = fractionFromClientX(hoverXRef.current);
        const previous = hoverValueRef.current;
        if (previous !== null && Math.abs(previous - fraction) < HOVER_EPSILON) return;
        hoverValueRef.current = fraction;
        setHoverFraction(fraction);
      });
    },
    [fractionFromClientX]
  );

  const clearHover = useCallback(() => {
    if (hoverFrameRef.current) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = 0;
    }
    hoverValueRef.current = null;
    setHoverFraction(null);
  }, []);

  useEffect(() => clearHover, [clearHover]);

  const handleWaveformKeyDown = (e: React.KeyboardEvent) => {
    // Digits jump to that tenth of the track, the convention every video player
    // on the web already taught people.
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

  /* Only worth showing while it's genuinely incomplete. A blob preview is
     buffered the instant it loads, so this never appears there — it's for job
     results streamed off the API over a slow connection. */
  const showBuffered = bufferedFraction > 0.01 && bufferedFraction < 0.995;

  const transportDisabled = isLoading || hasError;

  return (
    /* graphite-900, not 850, and p-3 rather than p-4.
       This sits directly above the transcript pane, which is an 850 surface at
       p-3 — two identical panels stacked read as one mis-drawn box. Darker and
       tighter makes the player read as chrome for the thing below it. */
    <div
      className={cn("rounded-xl border border-graphite-700 bg-graphite-900 p-3", className)}
      role="group"
      aria-label={title ? `Audio player — ${title}` : "Audio player"}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          reportDuration(e.currentTarget.duration);
          setIsLoading(false);
        }}
        onDurationChange={(e) => reportDuration(e.currentTarget.duration)}
        // Backstop: a source that becomes playable without ever firing
        // loadedmetadata would otherwise leave the transport disabled forever
        // behind the skeleton.
        onCanPlay={() => {
          setIsLoading(false);
          setIsStalled(false);
        }}
        // `waiting` means the element ran out of buffered audio mid-playback. It
        // looked identical to a pause before: the icon flipped and nothing said
        // why the sound stopped.
        onWaiting={() => setIsStalled(true)}
        onPlaying={() => setIsStalled(false)}
        onProgress={(e) => {
          const audio = e.currentTarget;
          if (!audio.buffered.length || !Number.isFinite(audio.duration) || !audio.duration) return;
          setBufferedFraction(audio.buffered.end(audio.buffered.length - 1) / audio.duration);
        }}
        onTimeUpdate={(e) => {
          // Suppressed mid-drag: the pointer owns the position then, and letting
          // the element's own events through would fight it.
          if (!scrubbing) commitTime(e.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={(e) => {
          setIsPlaying(false);
          setIsStalled(false);
          // Both, not just the readout. Resetting state alone left the element
          // parked at the end while the playhead sat at 0:00.
          e.currentTarget.currentTime = 0;
          commitTime(0);
        }}
        onError={() => {
          setHasError(true);
          setIsStalled(false);
          setIsLoading(false);
        }}
      />

      {hasError ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 py-1.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
          <p className="min-w-0 flex-1 text-sm text-text-muted">
            <span className="text-text-primary">This preview wouldn&apos;t play here.</span> The
            file itself is fine — download it, or try again if your connection dropped.
          </p>
          <MiniButton onClick={retryLoad} aria-label="Try loading the preview again">
            <RotateCw className="h-3 w-3" aria-hidden />
            Try again
          </MiniButton>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* The only filled amber control on the page that wasn't a Button.
                Now wears the same clothes: inset top highlight instead of a flat
                fill, and a real press. Circular is correct here — that's
                transport convention, not drift. */}
            <button
              type="button"
              onClick={togglePlay}
              disabled={transportDisabled}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
                "transition-[background-color,transform] duration-150",
                "hover:bg-amber-400 active:translate-y-px active:bg-amber-600 motion-reduce:active:translate-y-0",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50",
                "disabled:pointer-events-none disabled:opacity-60"
              )}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isStalled ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : isPlaying ? (
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
              // The shortcuts existed but were a secret. Declared for assistive
              // tech, and spelled out in the tooltip for everyone else.
              aria-keyshortcuts="Space ArrowLeft ArrowRight ArrowUp ArrowDown M L Home End"
              title="Space play/pause · ← → 5s (Shift 15s) · ↑ ↓ volume · M mute · L loop · 0–9 jump"
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
                if (!scrubbing) queueHover(e.clientX);
              }}
              onMouseLeave={() => {
                if (!scrubbing) clearHover();
              }}
              className={cn(
                "group relative h-11 flex-1 select-none overflow-hidden rounded-lg",
                // Without touch-action:none a drag on mobile scrolls the page and
                // scrubs simultaneously — the strip fights the scroll and neither
                // gesture wins cleanly.
                "touch-none",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                isLoading ? "cursor-default" : "cursor-pointer"
              )}
            >
              {isLoading ? (
                <div className="absolute inset-0 flex items-center gap-px px-0.5">
                  {SKELETON_BARS.map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 animate-pulse rounded-sm bg-graphite-800 motion-reduce:animate-none"
                      style={{ height: `${height}%`, animationDelay: `${i * 18}ms` }}
                    />
                  ))}
                </div>
              ) : (
                <>
                  {/* Base layer: the whole track, unplayed. Either the real
                      envelope or a plain rail while it decodes — or permanently,
                      if the decode failed or the source is past
                      maxWaveformSeconds. */}
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

                  {/* Played layer: an identical copy in amber, revealed by
                      clip-path. Full width at all times — clipping doesn't change
                      layout, so the canvas underneath never needs to re-rasterize
                      as playback advances. */}
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
                  >
                    {/* A cap at the top of the line: at 1px the head is easy to
                        lose against a dense waveform. */}
                    <span className="absolute -left-[2.5px] top-0 h-1.5 w-1.5 rounded-full bg-amber-300" />
                  </div>

                  {/* Hover / scrub preview time */}
                  {hoverFraction !== null && duration > 0 && (
                    <>
                      <div
                        className="pointer-events-none absolute inset-y-0 w-px bg-text-subtle/50"
                        style={{ left: `${hoverFraction * 100}%` }}
                        aria-hidden
                      />
                      <div
                        className="pointer-events-none absolute top-1 -translate-x-1/2 rounded bg-graphite-950/90 px-1.5 py-0.5 font-mono text-[10px] text-text-primary shadow-sm"
                        style={{ left: `${clamp(hoverFraction, 0.06, 0.94) * 100}%` }}
                      >
                        {formatTime(hoverFraction * duration)}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Time display — click to toggle remaining vs. total */}
            <button
              type="button"
              onClick={() => setShowRemaining((v) => !v)}
              className="shrink-0 rounded px-1 font-mono text-[11px] tabular-nums text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              aria-label={showRemaining ? "Show total length" : "Show time remaining"}
            >
              {formatTime(currentTime)} /{" "}
              {showRemaining
                ? `-${formatTime(Math.max(duration - currentTime, 0))}`
                : formatTime(duration)}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-graphite-800 pt-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {/* Skip buttons. Every shortcut above is unreachable on a phone,
                  which is exactly where scrubbing a 40px-tall waveform to the
                  second is hardest. */}
              <MiniButton
                onClick={() => seekBy(-SEEK_STEP_LARGE)}
                disabled={transportDisabled}
                aria-label={`Back ${SEEK_STEP_LARGE} seconds`}
                className="px-1.5"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                <span className="font-mono text-[10px]">{SEEK_STEP_LARGE}</span>
              </MiniButton>
              <MiniButton
                onClick={() => seekBy(SEEK_STEP_LARGE)}
                disabled={transportDisabled}
                aria-label={`Forward ${SEEK_STEP_LARGE} seconds`}
                className="px-1.5"
              >
                <RotateCw className="h-3 w-3" aria-hidden />
                <span className="font-mono text-[10px]">{SEEK_STEP_LARGE}</span>
              </MiniButton>

              <div className="mx-0.5 hidden h-4 w-px bg-graphite-800 sm:block" />

              {/* Volume */}
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
                className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-graphite-700 accent-amber-500 sm:block sm:w-24"
                aria-label="Volume"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {/* Loop — the reason someone plays the same eight bars twenty times
                  while checking a bounce. */}
              <MiniButton
                onClick={() => setIsLooping((v) => !v)}
                active={isLooping}
                aria-pressed={isLooping}
                aria-label={isLooping ? "Stop looping" : "Loop this track"}
              >
                <Repeat className="h-3 w-3" aria-hidden />
              </MiniButton>

              {/* Playback speed */}
              <div className="relative" ref={rateMenuRef}>
                <MiniButton
                  ref={rateButtonRef}
                  onClick={() => setRateMenuOpen((v) => !v)}
                  active={playbackRate !== 1}
                  aria-haspopup="listbox"
                  aria-expanded={rateMenuOpen}
                  aria-label={`Playback speed, ${playbackRate}x`}
                  className="font-mono text-[11px]"
                >
                  <Gauge className="h-3 w-3" aria-hidden />
                  {playbackRate}x
                </MiniButton>

                {rateMenuOpen && (
                  /* OPENS DOWNWARD (2026-08-21).
                     Was bottom-full. Fine when the player sat inline, but on the
                     transcript pages it's `sticky top-2` — parked 8px below the
                     top of the viewport, where a ~150px menu opening upward
                     renders entirely off-screen. Downward it overlaps the
                     transcript, which is harmless: the sticky wrapper carries
                     z-20 and this sits above it. */
                  <div
                    role="listbox"
                    aria-label="Playback speed"
                    className="absolute right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-graphite-700 bg-graphite-900 shadow-lg shadow-graphite-950/60"
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