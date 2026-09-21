"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WaveformCanvas } from "@/components/ui/WaveformCanvas";
import {
  decodeWaveformEnvelopeFromUrl,
  type WaveformEnvelope,
} from "@/lib/utils/waveform";
import { cn } from "@/lib/utils/cn";

// Above this the decode is skipped: a long WAV can stall a phone.
const MAX_DECODE_BYTES = 120 * 1024 * 1024;

export interface StageDemo {
  src: string;
  peaks: number[];
  duration: number;
}

export interface StageTier<T extends string> {
  value: T;
  name: string;
  short?: string;
  model: string;
  time: string;
  footnote?: string;
  badge?: ReactNode;
  demo?: StageDemo;
  /** The paid tier. Drawn in amber. */
  premium?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toUpperCase() : "AUDIO";
}

function DemoDeck<T extends string>({
  tier,
  caption,
  nudge,
  credit,
  paused,
}: {
  tier: StageTier<T>;
  caption: string;
  /** Replaces the caption once the demo has been played. */
  nudge?: string;
  credit?: string;
  paused: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resumeRef = useRef<{ time: number; play: boolean } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [heard, setHeard] = useState(false);
  const [time, setTime] = useState(0);
  const demo = tier.demo;

  useEffect(() => {
    const el = audioRef.current;
    return () => el?.pause();
  }, []);

  useEffect(() => {
    if (paused) audioRef.current?.pause();
  }, [paused]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !demo || !el.getAttribute("src")) return;
    if (el.getAttribute("src") === demo.src) return;
    resumeRef.current = { time: el.currentTime, play: !el.paused };
    el.src = demo.src;
    el.load();
  }, [demo]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) setTime(el.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  if (!demo) return null;

  function toggle() {
    const el = audioRef.current;
    if (!el || !demo) return;
    if (!el.paused) {
      el.pause();
      return;
    }
    if (el.getAttribute("src") !== demo.src) el.src = demo.src;
    void el.play().catch(() => setPlaying(false));
  }

  function seek(clientX: number, target: HTMLElement) {
    const el = audioRef.current;
    if (!el || !demo) return;
    const box = target.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    if (el.getAttribute("src") !== demo.src) el.src = demo.src;
    el.currentTime = ratio * demo.duration;
    setTime(ratio * demo.duration);
    if (el.paused) void el.play().catch(() => setPlaying(false));
  }

  const played = Math.min(1, time / demo.duration);

  return (
    <div className="flex h-full flex-col justify-center gap-3.5 px-5 py-5 sm:px-7">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          setHeard(true);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onLoadedMetadata={(e) => {
          const pending = resumeRef.current;
          if (!pending) return;
          resumeRef.current = null;
          e.currentTarget.currentTime = pending.time;
          if (pending.play)
            void e.currentTarget.play().catch(() => setPlaying(false));
        }}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause the demo" : "Play the demo"}
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70",
            playing
              ? "border-amber-500 bg-amber-500 text-graphite-950"
              : "border-graphite-600 text-text-primary hover:border-text-primary/70",
          )}
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-text-primary">
            {heard && nudge ? nudge : caption}
          </p>
          <p
            className={cn(
              "mt-0.5 truncate font-mono text-[11px]",
              tier.premium ? "text-amber-400" : "text-text-subtle",
            )}
          >
            {tier.name} · {tier.model}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-subtle">
          <span className={playing ? "text-amber-400" : undefined}>
            {formatClock(time)}
          </span>{" "}
          / {formatClock(demo.duration)}
        </span>
      </div>

      <button
        type="button"
        aria-label="Seek in the demo"
        onClick={(e) => seek(e.clientX, e.currentTarget)}
        className="flex h-16 w-full items-center gap-px rounded outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 sm:h-20"
      >
        {demo.peaks.map((peak, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors duration-150",
              i % 2 === 1 && "max-sm:hidden",
              i / demo.peaks.length < played
                ? "bg-amber-500"
                : "bg-graphite-600",
            )}
            style={{ height: `${Math.max(3, peak * 100)}%` }}
          />
        ))}
      </button>

      {credit && (
        <p className="truncate text-[11px] text-text-subtle">{credit}</p>
      )}
    </div>
  );
}

/** A source that is not a dropped file, such as a pasted link. */
export interface StageCustomSource {
  ready: boolean;
  idle: ReactNode;
  busy: (fraction: number) => ReactNode;
  idleActionLabel: string;
  onIdleAction: () => void;
}

export interface StudioStageProps<T extends string> {
  label: string;
  file?: File | null;
  onFileSelect?: (file: File) => void;
  custom?: StageCustomSource;
  onClear: () => void;
  accept?: string;
  formats?: string;
  tiers: StageTier<T>[];
  tier: T;
  onTierChange: (tier: T) => void;
  /** The tier the running or finished job used. */
  jobTier: T;
  demoCaption?: string;
  /** Shown in place of the caption after the first play. */
  demoNudge?: string;
  demoCredit?: string;
  busy: boolean;
  failed?: boolean;
  /** 0 to 100. Fills the waveform while busy. */
  progress?: number;
  stageLabel?: string;
  elapsed?: string;
  onCancel?: () => void;
  actionLabel: string;
  actionIcon?: ReactNode;
  actionDisabled?: boolean;
  onAction: () => void;
  footerExtra?: ReactNode;
  belowAction?: ReactNode;
  /** Right pane of the idle stage when the tier has no audio demo. */
  aside?: ReactNode;
  dropTitle?: string;
  /** Settings strip between the stage body and the footer. Hidden once done. */
  tray?: ReactNode;
  /** Replaces the waveform once the job is done. */
  result?: ReactNode;
  doneTitle?: string;
  doneMeta?: string;
  doneFooter?: ReactNode;
  resetLabel?: string;
  note?: ReactNode;
}

export function StudioStage<T extends string>({
  label,
  file = null,
  onFileSelect,
  custom,
  onClear,
  accept = "audio/*",
  formats = "MP3 · WAV · FLAC · M4A",
  tiers,
  tier,
  onTierChange,
  jobTier,
  demoCaption = "Hear a result first",
  demoNudge,
  demoCredit,
  busy,
  failed = false,
  progress = 0,
  stageLabel,
  elapsed,
  onCancel,
  actionLabel,
  actionIcon,
  actionDisabled = false,
  onAction,
  footerExtra,
  belowAction,
  aside,
  dropTitle = "Drop a song",
  tray,
  result,
  doneTitle,
  doneMeta,
  doneFooter,
  resetLabel = "Separate another track",
  note,
}: StudioStageProps<T>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [decoded, setDecoded] = useState<{
    file: File;
    envelope: WaveformEnvelope | null;
  } | null>(null);
  const [probed, setProbed] = useState<{ file: File; duration: number } | null>(
    null,
  );

  const envelope = decoded && decoded.file === file ? decoded.envelope : null;
  const duration = probed && probed.file === file ? probed.duration : 0;
  const decoding =
    Boolean(file) &&
    (file?.size ?? 0) <= MAX_DECODE_BYTES &&
    !(decoded && decoded.file === file);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    const controller = new AbortController();
    const probe = document.createElement("audio");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration))
        setProbed({ file, duration: probe.duration });
    };
    probe.src = url;

    if (file.size <= MAX_DECODE_BYTES) {
      void decodeWaveformEnvelopeFromUrl(url, controller.signal).then((env) => {
        if (!controller.signal.aborted) setDecoded({ file, envelope: env });
      });
    }

    return () => {
      controller.abort();
      probe.onloadedmetadata = null;
      probe.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const done = Boolean(result);
  const canPick = !busy && !done && !custom;
  const hasSource = custom ? custom.ready : Boolean(file);
  const fraction = busy ? Math.min(1, Math.max(0, progress / 100)) : 0;
  const span = duration > 0 ? duration : 1;
  const selected = tiers.find((t) => t.value === tier) ?? tiers[0];
  const running = tiers.find((t) => t.value === jobTier) ?? selected;
  const shown = busy || done ? running : selected;
  const hasDemo = Boolean(selected.demo) || Boolean(aside);

  function openPicker() {
    if (canPick) inputRef.current?.click();
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!canPick) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFileSelect?.(dropped);
  }

  const led = done
    ? "bg-teal-400"
    : failed
      ? "bg-red-500"
      : busy
        ? "bg-amber-500"
        : "bg-graphite-600";

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "surface grain overflow-hidden rounded-2xl border transition-colors duration-200",
          dragging
            ? "border-text-primary/60"
            : busy
              ? "border-amber-500/30"
              : "border-graphite-800",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (canPick) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-graphite-800 px-4 py-2.5 sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                led,
                busy && "animate-pulse",
              )}
              aria-hidden
            />
            {done ? (
              <>
                <span className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-teal-400">
                  Done
                </span>
                <span className="truncate text-sm text-text-primary">
                  {doneTitle ?? label}
                </span>
              </>
            ) : (
              <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-muted">
                {label}
              </span>
            )}
          </div>

          {tiers.length > 1 && !busy && !done ? (
            <div
              role="radiogroup"
              aria-label="Separation quality"
              className="flex shrink-0 rounded-full border border-graphite-700 bg-graphite-950/60 p-0.5"
            >
              {tiers.map((t) => {
                const on = t.value === tier;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onTierChange(t.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400/70 sm:px-4",
                      t.premium
                        ? on
                          ? "bg-amber-500 text-graphite-950"
                          : "text-amber-400 hover:text-amber-300"
                        : on
                          ? "bg-graphite-700 text-text-primary"
                          : "text-text-muted hover:text-text-primary",
                    )}
                  >
                    {t.premium && <Sparkles className="h-3 w-3" aria-hidden />}
                    <span className="sm:hidden">{t.short ?? t.name}</span>
                    <span className="hidden sm:inline">{t.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span
              className={cn(
                "shrink-0 font-mono text-[11px]",
                shown.premium ? "text-amber-400" : "text-text-subtle",
              )}
            >
              {done && doneMeta ? `${doneMeta} · ` : ""}
              {shown.name} · {shown.model}
            </span>
          )}
        </div>

        {done ? (
          <div className="space-y-5 p-4 sm:p-7">{result}</div>
        ) : (
          <>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={accept}
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) onFileSelect?.(picked);
                e.target.value = "";
              }}
            />

            {custom && busy ? (
              custom.busy(fraction)
            ) : file ? (
              <div className="relative h-44 sm:h-52 lg:h-56">
                <div className="absolute inset-0 px-2 sm:px-4">
                  <div
                    className={cn(
                      "h-full w-full transition-opacity duration-500",
                      decoding && "opacity-40",
                    )}
                  >
                    <WaveformCanvas
                      envelope={envelope}
                      duration={span}
                      start={0}
                      end={span * fraction}
                      showRuler={duration > 0}
                    />
                  </div>
                  {busy && (
                    <span
                      className="pointer-events-none absolute inset-y-0 w-px bg-amber-400 shadow-[0_0_12px_rgba(232,162,61,0.8)] transition-[left] duration-1000 ease-out motion-reduce:transition-none"
                      style={{ left: `${fraction * 100}%` }}
                      aria-hidden
                    />
                  )}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  custom ? "grid lg:min-h-56" : "grid lg:h-56",
                  hasDemo && "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
                )}
              >
                {custom ? (
                  <div className="flex flex-col justify-center px-5 py-8 sm:px-7 lg:py-6">
                    {custom.idle}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openPicker}
                    className={cn(
                      "group flex flex-col justify-center px-5 py-8 text-left outline-none transition-colors hover:bg-white/[0.015] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60 sm:px-7 lg:py-0",
                      !hasDemo && "items-center text-center",
                    )}
                  >
                    <span className="display text-5xl text-text-primary sm:text-6xl">
                      {dragging ? "Let go" : dropTitle}
                    </span>
                    <span className="mt-4 text-sm text-text-muted">
                      Anywhere on this panel, or{" "}
                      <span className="text-text-primary underline underline-offset-4">
                        choose a file
                      </span>
                    </span>
                    <span className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-subtle">
                      {formats}
                    </span>
                  </button>
                )}

                {hasDemo && (
                  <div className="border-t border-graphite-800 bg-graphite-950/30 lg:border-l lg:border-t-0">
                    {selected.demo ? (
                      <DemoDeck
                        tier={selected}
                        caption={demoCaption}
                        nudge={selected.premium ? undefined : demoNudge}
                        credit={demoCredit}
                        paused={busy}
                      />
                    ) : (
                      aside
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!done && !busy && tray && (
          <div className="border-t border-graphite-800 px-4 py-4 sm:px-7">
            {tray}
          </div>
        )}

        {!done && (
          <div className="flex flex-col gap-3 border-t border-graphite-800 bg-graphite-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-7">
            <div
              className="flex min-w-0 flex-1 items-center justify-between gap-4 sm:justify-start"
              role={busy ? "status" : undefined}
              aria-live={busy ? "polite" : undefined}
            >
              {busy ? (
                <>
                  <span className="min-w-0 truncate text-sm text-text-primary">
                    {stageLabel}
                  </span>
                  <span className="flex shrink-0 items-center gap-4 font-mono text-[11px] text-text-subtle">
                    {elapsed && (
                      <span className="tabular-nums text-amber-400">
                        {elapsed}
                      </span>
                    )}
                    <span className="hidden md:inline">
                      usually {shown.time}
                    </span>
                    {onCancel && (
                      <button
                        type="button"
                        onClick={onCancel}
                        className="rounded underline underline-offset-2 outline-none transition-colors hover:text-red-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                      >
                        Cancel
                      </button>
                    )}
                  </span>
                </>
              ) : file ? (
                <>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded border border-graphite-700 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-text-muted">
                      {extensionOf(file.name)}
                    </span>
                    <span className="truncate text-sm text-text-primary">
                      {file.name}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 font-mono text-[11px] text-text-subtle">
                    <span className="hidden tabular-nums md:inline">
                      {duration > 0 ? `${formatClock(duration)} · ` : ""}
                      {formatBytes(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={openPicker}
                      className="rounded underline underline-offset-2 outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={onClear}
                      className="rounded underline underline-offset-2 outline-none transition-colors hover:text-red-400 focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    >
                      Remove
                    </button>
                  </span>
                </>
              ) : (
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-text-subtle">
                  <span
                    className={
                      selected.premium ? "text-amber-400" : "text-text-muted"
                    }
                  >
                    {selected.model}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{selected.time}</span>
                  {selected.footnote && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{selected.footnote}</span>
                    </>
                  )}
                  {selected.badge}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {hasSource && footerExtra}
              <Button
                variant={busy ? "secondary" : "primary"}
                size="lg"
                className="flex-1 sm:min-w-44 sm:flex-none"
                onClick={
                  hasSource || failed
                    ? onAction
                    : custom
                      ? custom.onIdleAction
                      : openPicker
                }
                disabled={
                  busy ? false : hasSource || failed ? actionDisabled : false
                }
                loading={busy}
                loadingLabel="Separating"
              >
                {!busy && (hasSource || failed) && actionIcon}
                {busy
                  ? "Working"
                  : hasSource || failed
                    ? actionLabel
                    : (custom?.idleActionLabel ?? "Choose a file")}
              </Button>
            </div>
          </div>
        )}

        {done && (
          <div className="flex flex-col gap-3 border-t border-graphite-800 bg-graphite-950/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-2 self-start rounded text-sm text-text-muted outline-none transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {resetLabel}
            </button>
            {doneFooter}
          </div>
        )}

        {!done && belowAction}
      </div>

      {note}
    </div>
  );
}