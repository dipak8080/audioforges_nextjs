"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, Volume1, VolumeX, AlertTriangle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { WaveformCanvas } from "@/components/ui/WaveformCanvas";
import { decodeWaveformEnvelopeFromUrl, type WaveformEnvelope } from "@/lib/utils/waveform";

interface AudioPlayerProps {
  src: string;
  className?: string;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SEEK_STEP = 5;
const SEEK_STEP_LARGE = 15;
const VOLUME_STEP = 0.1;

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
 * state, rather than resetting six useState values by hand inside an
 * effect. Parents can't pass the key themselves, so the split happens
 * here — the public component stays a plain <AudioPlayer src=... />.
 */
export function AudioPlayer({ src, className }: AudioPlayerProps) {
  return <AudioPlayerInstance key={src} src={src} className={className} />;
}

function AudioPlayerInstance({ src, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const rateMenuRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [rateMenuOpen, setRateMenuOpen] = useState(false);

  const [envelope, setEnvelope] = useState<WaveformEnvelope | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  /* --- decode the waveform for this source ------------------------- */
  useEffect(() => {
    const controller = new AbortController();
    // Waveform is cosmetic — if this fails (CORS, unsupported codec,
    // network blip) the player still works fully via the plain track,
    // it just loses the drawing.
    decodeWaveformEnvelopeFromUrl(src, controller.signal).then((result) => {
      if (!controller.signal.aborted) setEnvelope(result);
    });

    return () => controller.abort();
  }, [src]);

  /* --- keep the element's volume/rate in sync with state ----------- */
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  /* --- close the speed menu on outside click ------------------------ */
  useEffect(() => {
    if (!rateMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target as Node)) setRateMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [rateMenuOpen]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || hasError) return;
    if (isPlaying) {
      audio.pause();
    } else {
      // play() returns a promise that rejects if interrupted by a
      // near-simultaneous pause() — swallow that instead of an
      // unhandled rejection landing in the console.
      audio.play().catch(() => {});
    }
  }, [isPlaying, hasError]);

  const toggleMute = () => setIsMuted((m) => !m);

  const seekToFraction = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const time = clamp(fraction, 0, 1) * duration;
      audio.currentTime = time;
      setCurrentTime(time);
    },
    [duration]
  );

  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const time = clamp(currentTime + deltaSeconds, 0, duration);
      audio.currentTime = time;
      setCurrentTime(time);
    },
    [currentTime, duration]
  );

  /* --- waveform pointer scrubbing ------------------------------------ */
  const fractionFromClientX = useCallback((clientX: number) => {
    if (!waveformRef.current) return 0;
    const rect = waveformRef.current.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  }, []);

  /* Pointer events fire faster than the display refreshes (120Hz+ on a
     trackpad). Each one seeks the media element and re-renders — which
     now also redraws the canvas — so they're coalesced into one update
     per animation frame. */
  useEffect(() => {
    if (!scrubbing) return;
    let frame = 0;
    let pendingX = 0;

    const apply = () => {
      frame = 0;
      const fraction = fractionFromClientX(pendingX);
      setHoverFraction(fraction);
      seekToFraction(fraction);
    };

    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onUp = () => setScrubbing(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrubbing, fractionFromClientX, seekToFraction]);

  const handleWaveformKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekBy(e.shiftKey ? -SEEK_STEP_LARGE : -SEEK_STEP);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seekBy(e.shiftKey ? SEEK_STEP_LARGE : SEEK_STEP);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setVolume((v) => clamp(v + VOLUME_STEP, 0, 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setVolume((v) => clamp(v - VOLUME_STEP, 0, 1));
    } else if (e.key.toLowerCase() === "m") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "Home") {
      e.preventDefault();
      seekToFraction(0);
    } else if (e.key === "End") {
      e.preventDefault();
      seekToFraction(0.999);
    }
  };

  const progressFraction = duration > 0 ? currentTime / duration : 0;
  const previewFraction = scrubbing ? hoverFraction : null;
  const displayFraction = previewFraction ?? progressFraction;

  return (
    <div className={cn("rounded-lg border border-graphite-700 bg-graphite-850 p-4", className)}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          // Guarded against Infinity/NaN: some MP3s report an unknown
          // duration until the browser has buffered further, and
          // accepting that turns every fraction below into NaN.
          const reported = e.currentTarget.duration;
          if (Number.isFinite(reported) && reported > 0) setDuration(reported);
          setIsLoading(false);
        }}
        onDurationChange={(e) => {
          const reported = e.currentTarget.duration;
          if (Number.isFinite(reported) && reported > 0) setDuration(reported);
        }}
        onTimeUpdate={(e) => {
          if (!scrubbing) setCurrentTime(e.currentTarget.currentTime);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />

      {hasError ? (
        <div className="flex items-center gap-2.5 py-1.5 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Couldn&apos;t load this preview. The download below should still work.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              disabled={isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-graphite-950 transition-colors hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
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
                seekToFraction(fraction);
              }}
              onMouseMove={(e) => {
                if (!scrubbing) setHoverFraction(fractionFromClientX(e.clientX));
              }}
              onMouseLeave={() => {
                if (!scrubbing) setHoverFraction(null);
              }}
              className={cn(
                "relative h-9 flex-1 select-none overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
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
                  {/* Waveform, or a plain progress track if the decode
                      failed for this result. The played portion is the
                      highlighted region, so the boundary between amber
                      and grey IS the playhead. */}
                  {envelope ? (
                    <WaveformCanvas
                      envelope={envelope}
                      duration={duration}
                      start={0}
                      end={displayFraction * duration}
                      showRuler={false}
                      className="absolute inset-0 block"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center px-0.5">
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-graphite-700">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${displayFraction * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Playhead */}
                  <div
                    className="pointer-events-none absolute inset-y-0 w-px bg-amber-300"
                    style={{ left: `${displayFraction * 100}%` }}
                  />

                  {/* Hover scrub preview time */}
                  {hoverFraction !== null && (
                    <div
                      className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-graphite-950 px-1.5 py-0.5 font-mono text-[10px] text-text-primary shadow-sm"
                      style={{ left: `${clamp(hoverFraction, 0.04, 0.96) * 100}%` }}
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
              className="shrink-0 rounded px-1 font-mono text-xs tabular-nums text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              aria-label="Toggle remaining time"
            >
              {formatTime(currentTime)} / {showRemaining ? `-${formatTime(Math.max(duration - currentTime, 0))}` : formatTime(duration)}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-graphite-800 pt-2.5">
            {/* Volume */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="shrink-0 text-text-muted transition-colors hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded"
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

            {/* Playback speed */}
            <div className="relative shrink-0" ref={rateMenuRef}>
              <button
                type="button"
                onClick={() => setRateMenuOpen((v) => !v)}
                className="flex items-center gap-1 rounded-md border border-graphite-700 px-2 py-1 font-mono text-[11px] text-text-muted transition-colors hover:border-graphite-700/60 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                aria-haspopup="listbox"
                aria-expanded={rateMenuOpen}
              >
                <Gauge className="h-3 w-3" aria-hidden />
                {playbackRate}x
              </button>

              {rateMenuOpen && (
                <div
                  role="listbox"
                  className="absolute bottom-full right-0 z-10 mb-1.5 overflow-hidden rounded-md border border-graphite-700 bg-graphite-900 shadow-lg"
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
                      }}
                      className={cn(
                        "block w-full px-3 py-1.5 text-right font-mono text-xs transition-colors",
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
      )}
    </div>
  );
}