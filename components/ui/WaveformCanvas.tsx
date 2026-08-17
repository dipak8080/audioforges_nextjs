"use client";

import { useEffect, useRef } from "react";
import type { WaveformEnvelope } from "@/lib/utils/waveform";

/** Height of the time ruler strip at the top of the canvas. Exported so
 *  overlaid controls (drag handles, playhead) can start below it instead
 *  of covering the timestamps. */
export const WAVEFORM_RULER_HEIGHT = 18;

/* Canvas can't read Tailwind classes, so the palette is mirrored from
   app/globals.css here. Keep these in sync with the graphite/amber
   tokens if the theme ever changes.

   Peak is a DIM halo, RMS is the BRIGHT core. On a limited master —
   which is most released music — the peak envelope is pinned near 1.0
   in every column, so drawing it brightly produces a flat-topped block
   that carries no information. The shape lives entirely in the RMS, so
   that's what gets the contrast. The halo still shows true peak extent
   behind it. */
const COLORS = {
  ruler: "#6b6862", // --text-subtle
  rulerTick: "rgba(255, 255, 255, 0.14)",
  grid: "rgba(255, 255, 255, 0.04)",
  centerLine: "rgba(255, 255, 255, 0.10)",
  peakOutside: "#31313a",
  rmsOutside: "#5c5c68",
  peakInside: "rgba(232, 162, 61, 0.26)", // --amber-500
  rmsInside: "#e8a23d",
  selection: "rgba(232, 162, 61, 0.05)",
  selectionEdge: "rgba(232, 162, 61, 0.35)",
} as const;

/** Width of one drawn column, in DEVICE pixels.
 *
 *  The waveform is rasterized in device-pixel space with integer
 *  coordinates rather than in CSS pixels under a dpr transform. At any
 *  browser zoom other than 100% — or on a fractional-DPI display — one
 *  CSS pixel is not a whole device pixel, so CSS-space columns land on
 *  fractional boundaries and the rasterizer blends or drops every few
 *  of them. That reads as regular dark striping: a picket fence made of
 *  aliasing rather than of audio. Integer device pixels can't alias. */
const BAR_PITCH = 1;

/** Peaks stop just short of the top and bottom edges. A waveform that
 *  touches its own container looks clipped. */
const AMPLITUDE_HEADROOM = 0.92;

/** Candidate ruler intervals in seconds — the first one that keeps the
 *  label count reasonable for the current width wins. */
const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900];

function chooseTickStep(duration: number, width: number): number {
  const maxTicks = Math.max(2, Math.floor(width / 72));
  for (const step of TICK_STEPS) {
    if (duration / step <= maxTicks) return step;
  }
  return TICK_STEPS[TICK_STEPS.length - 1];
}

function formatTick(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`;
  return `${m}:${Math.floor(s).toString().padStart(2, "0")}`;
}

interface WaveformCanvasProps {
  /** Null while decoding, or permanently for formats the Web Audio API
   *  can't decode — the ruler and center line still render so the
   *  control never collapses to an empty box. */
  envelope: WaveformEnvelope | null;
  duration: number;
  /** Selected region, in seconds. Ignored when `isSelected` is given. */
  start: number;
  end: number;
  /** Set false to drop the time ruler and use the full height for the
   *  waveform — for compact bars (a player's scrub strip) where 18px of
   *  timestamps would eat half the control. */
  showRuler?: boolean;
  /** Optional per-column test, for tools whose highlighted audio isn't
   *  one contiguous region — silence detection highlights every kept
   *  segment between gaps. Called once per drawn column. */
  isSelected?: (timeSeconds: number) => boolean;
  /** Optional amplitude multiplier per point in time, 0..1. Lets a tool
   *  draw the audio as it will sound after processing — a fade ramps
   *  the drawing down to nothing at the edges rather than covering
   *  full-height audio with a scrim. Called once per drawn column. */
  gain?: (timeSeconds: number) => number;
  className?: string;
}

function drawWaveform(canvas: HTMLCanvasElement | null, props: WaveformCanvasProps) {
  const parent = canvas?.parentElement;
  if (!canvas || !parent) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { envelope: env, duration: dur, start: from, end: to, gain, isSelected, showRuler = true } = props;

  const width = parent.clientWidth;
  const height = parent.clientHeight;
  if (width === 0 || height === 0) return;

  // Assigning canvas.width reallocates the bitmap and wipes state, so
  // only touch it when the size actually changed — during a drag this
  // runs every frame and the dimensions never move.
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);


  const waveTop = showRuler ? WAVEFORM_RULER_HEIGHT : 0;
  const waveHeight = height - waveTop;
  const mid = waveTop + waveHeight / 2;
  const halfHeight = (waveHeight / 2 - 3) * AMPLITUDE_HEADROOM;

  const safeDuration = dur > 0 ? dur : 0;
  const startX = safeDuration ? (from / safeDuration) * width : 0;
  const endX = safeDuration ? (to / safeDuration) * width : width;

  if (safeDuration && endX > startX && !isSelected) {
    ctx.fillStyle = COLORS.selection;
    ctx.fillRect(startX, waveTop, endX - startX, waveHeight);
  }

  if (safeDuration > 0 && showRuler) {
    const step = chooseTickStep(safeDuration, width);
    ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline = "middle";

    for (let t = 0; t <= safeDuration + 1e-6; t += step) {
      const x = Math.round((t / safeDuration) * width) + 0.5;
      if (x > width - 1) break;

      ctx.fillStyle = COLORS.grid;
      ctx.fillRect(x, waveTop, 1, waveHeight);

      ctx.fillStyle = COLORS.rulerTick;
      ctx.fillRect(x, waveTop - 5, 1, 5);

      ctx.fillStyle = COLORS.ruler;
      ctx.textAlign = t === 0 ? "left" : "center";
        ctx.fillText(formatTick(t), t === 0 ? 3 : x, WAVEFORM_RULER_HEIGHT / 2 - 1);
    }
  }

  ctx.fillStyle = COLORS.centerLine;
  ctx.fillRect(0, Math.round(mid) + 0.5, width, 1);

  if (!env || safeDuration === 0) return;

  /* Everything below is drawn in device pixels — see BAR_PITCH. */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const deviceWidth = canvas.width;
  const deviceMid = Math.round(mid * dpr);
  const deviceHalf = halfHeight * dpr;

  /* Four paths rather than four fillStyle switches per column. */
  const peakOut = new Path2D();
  const peakIn = new Path2D();
  const rmsOut = new Path2D();
  const rmsIn = new Path2D();

  const { min, max, rms, columns } = env;

  for (let x = 0; x < deviceWidth; x += BAR_PITCH) {
    const colFrom = Math.floor((x / deviceWidth) * columns);
    const colTo = Math.max(colFrom + 1, Math.floor(((x + BAR_PITCH) / deviceWidth) * columns));

    let lo = 0;
    let hi = 0;
    let level = 0;
    for (let c = colFrom; c < colTo && c < columns; c++) {
      if (min[c] < lo) lo = min[c];
      if (max[c] > hi) hi = max[c];
      if (rms[c] > level) level = rms[c];
    }

    const time = ((x + BAR_PITCH / 2) / deviceWidth) * safeDuration;
    const selected = isSelected ? isSelected(time) : time >= from && time <= to;

    if (gain) {
      const g = gain(time);
      hi *= g;
      lo *= g;
      level *= g;
    }

    const yTop = Math.round(deviceMid - hi * deviceHalf);
    const yBottom = Math.round(deviceMid - lo * deviceHalf);
    (selected ? peakIn : peakOut).rect(x, yTop, BAR_PITCH, Math.max(1, yBottom - yTop));

    if (level > 0.004) {
      const rmsHalf = Math.round(level * deviceHalf);
      (selected ? rmsIn : rmsOut).rect(x, deviceMid - rmsHalf, BAR_PITCH, Math.max(1, rmsHalf * 2));
    }
  }

  ctx.fillStyle = COLORS.peakOutside;
  ctx.fill(peakOut);
  ctx.fillStyle = COLORS.peakInside;
  ctx.fill(peakIn);
  ctx.fillStyle = COLORS.rmsOutside;
  ctx.fill(rmsOut);
  ctx.fillStyle = COLORS.rmsInside;
  ctx.fill(rmsIn);


  if (endX > startX && !isSelected) {
    ctx.fillStyle = COLORS.selectionEdge;
    ctx.fillRect(Math.round(startX * dpr), Math.round(waveTop * dpr), 1, Math.round(waveHeight * dpr));
    ctx.fillRect(Math.round(endX * dpr) - 1, Math.round(waveTop * dpr), 1, Math.round(waveHeight * dpr));
  }
}

export function WaveformCanvas(props: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  /* Holds a draw closure over the latest props, so the ResizeObserver
     below can be created exactly once instead of being torn down and
     rebuilt on every pixel of a drag. */
  const drawRef = useRef<() => void>(() => {});

  const { envelope, duration, start, end, gain, isSelected, showRuler } = props;

  useEffect(() => {
    drawRef.current = () =>
      drawWaveform(canvasRef.current, { envelope, duration, start, end, gain, isSelected, showRuler });
    drawRef.current();
  }, [envelope, duration, start, end, gain, isSelected, showRuler]);

  useEffect(() => {
    const parent = canvasRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => drawRef.current());
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  return <canvas ref={canvasRef} className={props.className} aria-hidden="true" />;
}