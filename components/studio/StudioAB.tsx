"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/converter/ToolControls";
import { PeaksBars } from "./PeaksBars";
import { cn } from "@/lib/utils/cn";
import { formatDuration } from "@/lib/studio/local-audio";
import { stemPreviewUrl, type StartedRun } from "@/lib/studio/run";

type Side = "free" | "studio";

function peaksOf(buffer: AudioBuffer, start: number, seconds: number, buckets = 160): number[] {
  const sr = buffer.sampleRate;
  const s0 = Math.max(0, Math.floor(start * sr));
  const len = Math.max(1, Math.min(buffer.length - s0, Math.floor(seconds * sr)));
  const per = Math.max(1, Math.floor(len / buckets));
  const out = new Array<number>(buckets).fill(0);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let b = 0; b < buckets; b++) {
      const from = s0 + b * per;
      const to = Math.min(from + per, s0 + len);
      let max = 0;
      for (let i = from; i < to; i += 4) {
        const v = Math.abs(data[i]);
        if (v > max) max = v;
      }
      if (max > out[b]) out[b] = max;
    }
  }
  const top = Math.max(...out, 0.001);
  return out.map((v) => v / top);
}

async function decode(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return ctx.decodeAudioData(await res.arrayBuffer());
}

export function StudioAB({
  freeRun,
  previewRun,
  clip,
  stems,
  label,
  freeLabel,
  studioLabel,
  onFirstPlay,
}: {
  freeRun: StartedRun;
  previewRun: StartedRun;
  clip: { start: number; seconds: number };
  stems: string[];
  label: (stem: string) => string;
  freeLabel: string;
  studioLabel: string;
  onFirstPlay?: () => void;
}) {
  const [stem, setStem] = useState(stems.includes("vocals") ? "vocals" : stems[0]);
  const [side, setSide] = useState<Side>("studio");
  const [playing, setPlaying] = useState(false);
  const [peaks, setPeaks] = useState<Record<string, { free: number[]; studio: number[] }>>({});

  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const nodes = useRef<{ srcs: AudioBufferSourceNode[]; gains: Record<Side, GainNode> } | null>(null);
  const startRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const headRefs = useRef<HTMLDivElement[]>([]);
  const timeRef = useRef<HTMLSpanElement>(null);
  const playedRef = useRef(false);
  const sideRef = useRef<Side>("studio");
  const loopRef = useRef<() => void>(() => {});

  const ready = !!peaks[stem];

  const ctx = useCallback(() => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  }, []);

  useEffect(() => {
    let alive = true;
    const c = ctx();
    const keyFree = `free:${stem}`;
    const keyStudio = `studio:${stem}`;
    void Promise.all([
      buffers.current.get(keyFree) ?? decode(c, stemPreviewUrl(freeRun, stem)),
      buffers.current.get(keyStudio) ?? decode(c, stemPreviewUrl(previewRun, stem)),
    ])
      .then(([f, s]) => {
        buffers.current.set(keyFree, f);
        buffers.current.set(keyStudio, s);
        if (alive) {
          setPeaks((p) => ({
            ...p,
            [stem]: { free: peaksOf(f, clip.start, clip.seconds), studio: peaksOf(s, 0, clip.seconds) },
          }));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stem, freeRun, previewRun, clip.start, clip.seconds, ctx]);

  const paint = useCallback(() => {
    const c = ctxRef.current;
    if (!c) return;
    const pos = nodes.current ? c.currentTime - startRef.current : offsetRef.current;
    const pct = Math.min(1, Math.max(0, pos / clip.seconds)) * 100;
    headRefs.current.forEach((el) => el && (el.style.left = `${pct}%`));
    if (timeRef.current) timeRef.current.textContent = formatDuration(pos);
  }, [clip.seconds]);

  const stopNodes = useCallback(() => {
    nodes.current?.srcs.forEach((s) => {
      s.onended = null;
      try {
        s.stop();
      } catch {}
    });
    nodes.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  const startAt = useCallback(
    (offset: number) => {
      const c = ctx();
      const f = buffers.current.get(`free:${stem}`);
      const s = buffers.current.get(`studio:${stem}`);
      if (!f || !s) return;
      stopNodes();
      void c.resume();
      const dur = Math.max(0.05, clip.seconds - offset);
      const gains = { free: c.createGain(), studio: c.createGain() };
      gains.free.gain.value = sideRef.current === "free" ? 1 : 0;
      gains.studio.gain.value = sideRef.current === "studio" ? 1 : 0;
      const a = c.createBufferSource();
      a.buffer = f;
      a.connect(gains.free).connect(c.destination);
      const b = c.createBufferSource();
      b.buffer = s;
      b.connect(gains.studio).connect(c.destination);
      a.start(0, clip.start + offset, dur);
      b.start(0, offset, dur);
      b.onended = () => {
        if (nodes.current?.srcs.includes(b)) loopRef.current();
      };
      nodes.current = { srcs: [a, b], gains };
      startRef.current = c.currentTime - offset;
      const tick = () => {
        paint();
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    },
    [clip.seconds, clip.start, ctx, paint, stem, stopNodes]
  );

  useEffect(() => {
    loopRef.current = () => startAt(0);
  }, [startAt]);

  function togglePlay() {
    if (!ready) return;
    if (playing) {
      const c = ctx();
      offsetRef.current = Math.min(clip.seconds, c.currentTime - startRef.current);
      stopNodes();
      paint();
      setPlaying(false);
      return;
    }
    if (!playedRef.current) {
      playedRef.current = true;
      onFirstPlay?.();
    }
    startAt(offsetRef.current >= clip.seconds - 0.05 ? 0 : offsetRef.current);
    setPlaying(true);
  }

  function choose(next: Side) {
    sideRef.current = next;
    setSide(next);
    const n = nodes.current;
    const c = ctxRef.current;
    if (n && c) {
      n.gains.free.gain.setTargetAtTime(next === "free" ? 1 : 0, c.currentTime, 0.012);
      n.gains.studio.gain.setTargetAtTime(next === "studio" ? 1 : 0, c.currentTime, 0.012);
    }
  }

  function pickStem(next: string) {
    stopNodes();
    offsetRef.current = 0;
    setPlaying(false);
    setStem(next);
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = ((e.clientX - rect.left) / rect.width) * clip.seconds;
    offsetRef.current = offset;
    if (nodes.current) startAt(offset);
    else paint();
  }

  useEffect(
    () => () => {
      stopNodes();
      void ctxRef.current?.close().catch(() => {});
    },
    [stopNodes]
  );

  const lanes: { side: Side; name: string }[] = [
    { side: "free", name: freeLabel },
    { side: "studio", name: studioLabel },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="icon-lg" variant={playing ? "secondary" : "accent"} onClick={togglePlay} disabled={!ready} loading={!ready}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Segmented
          label="A/B"
          value={side}
          onChange={choose}
          options={[
            { value: "free", label: freeLabel },
            { value: "studio", label: studioLabel },
          ]}
        />
        {stems.length > 1 && (
          <Segmented label="Stem" value={stem} onChange={pickStem} options={stems.map((s) => ({ value: s, label: label(s) }))} />
        )}
        <span className="ml-auto font-mono text-xs text-text-muted">
          <span ref={timeRef}>0:00</span> / {formatDuration(clip.seconds)}
        </span>
      </div>

      <div className="space-y-1.5">
        {lanes.map((lane, i) => (
          <div
            key={lane.side}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              choose(lane.side);
              seek(e);
            }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && choose(lane.side)}
            className={cn(
              "relative flex h-16 cursor-pointer items-center gap-3 overflow-hidden rounded-lg border px-3 transition-colors",
              side === lane.side
                ? lane.side === "studio"
                  ? "border-amber-500/50 bg-amber-500/[0.06]"
                  : "border-graphite-600 bg-graphite-850"
                : "border-graphite-800 opacity-60 hover:opacity-90"
            )}
          >
            <span
              className={cn(
                "w-24 shrink-0 font-mono text-[11px] uppercase tracking-wider",
                lane.side === "studio" ? "text-amber-400" : "text-text-muted"
              )}
            >
              {lane.name}
            </span>
            <div className="relative h-full flex-1 py-2">
              {peaks[stem] ? (
                <PeaksBars peaks={peaks[stem][lane.side]} tone={lane.side === "studio" ? "amber" : "neutral"} />
              ) : (
                <div className="h-full rounded bg-graphite-800/50 motion-safe:animate-pulse" />
              )}
              <div
                ref={(el) => {
                  if (el) headRefs.current[i] = el;
                }}
                className="pointer-events-none absolute inset-y-0 w-px bg-text-primary/80"
                style={{ left: "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}