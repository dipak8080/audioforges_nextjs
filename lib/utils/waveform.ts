import { CHUNK_BUDGET_MS, yieldToBrowser } from "@/lib/utils/scheduling";

/**
 * Downsamples one channel of decoded audio into N peak values (max
 * absolute amplitude per bucket), for rendering a waveform backdrop.
 * Pure function, no DOM/React dependency, so it can run anywhere an
 * AudioBuffer is available.
 */
export function computeWaveformPeaks(buffer: AudioBuffer, buckets: number): number[] {
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

  // Normalize so the loudest bucket reaches full height — a quiet
  // recording shouldn't render as a flat line.
  const peakMax = Math.max(...peaks, 0.01);
  return peaks.map((p) => p / peakMax);
}

/* ------------------------------------------------------------------ */
/* Envelope — what a real DAW draws                                    */
/*                                                                     */
/* computeWaveformPeaks() above returns one number per bucket (max      */
/* absolute amplitude), which can only be drawn as a bar chart. A DAW   */
/* draws three things per column instead: the highest sample, the       */
/* lowest sample, and the RMS (perceived loudness) of everything in     */
/* between. That's what gives you the mirrored outline with a solid     */
/* louder core, and it's why a DAW waveform reads as audio and a bar    */
/* chart reads as a chart.                                              */
/* ------------------------------------------------------------------ */

export interface WaveformEnvelope {
  /** Lowest sample per column, normalized to -1..0 */
  min: Float32Array;
  /** Highest sample per column, normalized to 0..1 */
  max: Float32Array;
  /** RMS per column, normalized to 0..1 */
  rms: Float32Array;
  columns: number;
}

/**
 * Resolution of the stored envelope. Deliberately much higher than any
 * container is wide: the renderer downsamples this to whatever pixel
 * width it has, so a resize (or a future zoom) never needs a re-decode.
 * 8000 columns x 3 Float32Arrays is ~96KB regardless of file length.
 */
export const ENVELOPE_COLUMNS = 8000;

/**
 * Cap on samples inspected per column per channel. A 10-minute track at
 * 44.1kHz is ~3300 samples per column; walking every one of them across
 * both channels is ~53M iterations on the main thread. Striding down to
 * this many keeps the scan under ~16M and the visible outline identical
 * — at this density each column is one pixel wide.
 */
const MAX_SAMPLES_PER_COLUMN = 1024;

/** Columns processed between clock checks. `performance.now()` on every
 *  column would cost more than the work it's measuring. */
const COLUMNS_PER_CHECK = 250;

interface EnvelopeScan {
  min: Float32Array;
  max: Float32Array;
  rms: Float32Array;
  channels: Float32Array[];
  frames: number;
  cols: number;
  loudest: number;
}

function beginScan(buffer: AudioBuffer, columns: number): EnvelopeScan {
  const frames = buffer.length;
  const cols = Math.max(1, Math.min(columns, frames));
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
  return {
    min: new Float32Array(cols),
    max: new Float32Array(cols),
    rms: new Float32Array(cols),
    channels,
    frames,
    cols,
    loudest: 0,
  };
}

/** Scans columns [from, to). Pure per-column work — the caller decides
 *  whether to run it all at once or in slices. */
function scanColumns(scan: EnvelopeScan, from: number, to: number): void {
  const { min, max, rms, channels, frames, cols } = scan;
  const channelCount = channels.length;

  for (let c = from; c < to; c++) {
    const sampleFrom = Math.floor((c * frames) / cols);
    const sampleTo = Math.max(sampleFrom + 1, Math.floor(((c + 1) * frames) / cols));
    const stride = Math.max(1, Math.floor((sampleTo - sampleFrom) / MAX_SAMPLES_PER_COLUMN));

    let lo = 0;
    let hi = 0;
    let sumSquares = 0;
    let counted = 0;

    for (let ch = 0; ch < channelCount; ch++) {
      const data = channels[ch];
      for (let i = sampleFrom; i < sampleTo; i += stride) {
        const v = data[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
        sumSquares += v * v;
        counted++;
      }
    }

    min[c] = lo;
    max[c] = hi;
    rms[c] = counted > 0 ? Math.sqrt(sumSquares / counted) : 0;

    if (-lo > scan.loudest) scan.loudest = -lo;
    if (hi > scan.loudest) scan.loudest = hi;
  }
}

function finishScan(scan: EnvelopeScan): WaveformEnvelope {
  const { min, max, rms, cols, loudest } = scan;

  // Normalize to the loudest sample so a quietly recorded track still
  // fills the height. Near-silent files are left alone rather than
  // amplified into a wall of noise.
  if (loudest > 0.01 && loudest !== 1) {
    const scale = 1 / loudest;
    for (let c = 0; c < cols; c++) {
      min[c] *= scale;
      max[c] *= scale;
      rms[c] *= scale;
    }
  }

  return { min, max, rms, columns: cols };
}

export function computeWaveformEnvelope(
  buffer: AudioBuffer,
  columns: number = ENVELOPE_COLUMNS
): WaveformEnvelope {
  const scan = beginScan(buffer, columns);
  if (scan.frames === 0 || scan.channels.length === 0) return finishScan(scan);
  scanColumns(scan, 0, scan.cols);
  return finishScan(scan);
}

/**
 * Same result as computeWaveformEnvelope, computed in slices that each
 * stay under one frame, yielding in between.
 *
 * decodeAudioData is off-thread, but this scan is not: on a long file
 * it's tens of millions of iterations, and running it in one go blocks
 * the main thread right after the user picks a file — which is exactly
 * when they're most likely to click something. Slicing it keeps every
 * task short enough that input stays responsive, at the cost of a few
 * milliseconds of total wall time.
 *
 * Rejects with an AbortError if `signal` fires, so swapping files
 * mid-scan doesn't leave the old one running to completion.
 */
export async function computeWaveformEnvelopeAsync(
  buffer: AudioBuffer,
  columns: number = ENVELOPE_COLUMNS,
  signal?: AbortSignal
): Promise<WaveformEnvelope> {
  const scan = beginScan(buffer, columns);
  if (scan.frames === 0 || scan.channels.length === 0) return finishScan(scan);

  let cursor = 0;
  while (cursor < scan.cols) {
    if (signal?.aborted) throw new DOMException("Waveform scan aborted", "AbortError");

    const deadline = performance.now() + CHUNK_BUDGET_MS;
    do {
      const next = Math.min(cursor + COLUMNS_PER_CHECK, scan.cols);
      scanColumns(scan, cursor, next);
      cursor = next;
    } while (cursor < scan.cols && performance.now() < deadline);

    if (cursor < scan.cols) await yieldToBrowser();
  }

  return finishScan(scan);
}

/** Decodes an audio source URL into waveform peaks. Returns null on any
 *  failure (CORS block, unsupported codec, network error) — callers
 *  should treat null as "render a plain track, stay fully functional",
 *  never as a fatal error. */
export async function decodeWaveformPeaksFromUrl(
  url: string,
  buckets: number,
  signal?: AbortSignal
): Promise<number[] | null> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();

    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      return computeWaveformPeaks(audioBuffer, buckets);
    } finally {
      ctx.close();
    }
  } catch {
    return null;
  }
}
/**
 * Fetches an audio URL and returns a full min/max/RMS envelope, for
 * drawing a finished result rather than a file the user picked.
 *
 * Returns null on any failure (CORS block, unsupported codec, network
 * error, abort) — callers should treat null as "render a plain track,
 * stay fully functional", never as a fatal error.
 */
export async function decodeWaveformEnvelopeFromUrl(
  url: string,
  signal?: AbortSignal,
  columns: number = ENVELOPE_COLUMNS
): Promise<WaveformEnvelope | null> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();

    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      // Sliced so a long result can't block the main thread in one go.
      return await computeWaveformEnvelopeAsync(audioBuffer, columns, signal);
    } finally {
      ctx.close();
    }
  } catch {
    return null;
  }
}