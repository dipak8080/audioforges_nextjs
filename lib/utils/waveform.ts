import { CHUNK_BUDGET_MS, yieldToBrowser } from "@/lib/utils/scheduling";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * Every export keeps its name and signature, so no caller changes.
 *
 * 1. ONE AudioContext, NOT ONE PER DECODE. Each call constructed its own and
 *    closed it in a `finally`. Chrome caps a document at six concurrent
 *    AudioContexts and throws on the seventh — and /stems renders four players
 *    that can decode at once, next to whatever else is on the page. Construction
 *    also costs real time (the browser opens an audio device). One lazily
 *    created context, reused, never closed.
 *
 * 2. THE SAME URL WAS DECODED EVERY TIME IT APPEARED. AudioPlayer keys on
 *    `src`, so clicking between four stems remounts the player and re-decodes
 *    the file from scratch — fetch, ArrayBuffer, decodeAudioData, full scan —
 *    every single time. Envelopes are now cached by URL. An envelope is ~96KB
 *    regardless of track length, so holding a few is cheap next to the ~90MB
 *    peak the decode itself costs.
 *
 * 3. `Math.max(...peaks)` COULD BLOW THE STACK. Spreading an array into a call
 *    fails somewhere around 100k arguments; `computeWaveformPeaks` is normally
 *    called with a few hundred buckets, but nothing in its signature says so.
 *    Replaced with a loop.
 *
 * 4. ABORT WAS ONLY CHECKED BY fetch. Swapping files mid-decode still ran the
 *    decode and the scan to completion before anyone looked at the signal.
 *    Checked after each await now.
 */

/**
 * Downsamples one channel of decoded audio into N peak values (max absolute
 * amplitude per bucket), for rendering a waveform backdrop. Pure function, no
 * DOM/React dependency, so it can run anywhere an AudioBuffer is available.
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

  // Normalize so the loudest bucket reaches full height — a quiet recording
  // shouldn't render as a flat line. A loop rather than Math.max(...peaks): the
  // spread form throws once the array is large enough, and nothing in this
  // signature stops a caller asking for a large bucket count.
  let peakMax = 0.01;
  for (const p of peaks) if (p > peakMax) peakMax = p;
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
 * container is wide: the renderer downsamples this to whatever pixel width it
 * has, so a resize (or a future zoom) never needs a re-decode. 8000 columns x 3
 * Float32Arrays is ~96KB regardless of file length.
 */
export const ENVELOPE_COLUMNS = 8000;

/**
 * Cap on samples inspected per column per channel. A 10-minute track at 44.1kHz
 * is ~3300 samples per column; walking every one of them across both channels is
 * ~53M iterations on the main thread. Striding down to this many keeps the scan
 * under ~16M and the visible outline identical — at this density each column is
 * one pixel wide.
 */
const MAX_SAMPLES_PER_COLUMN = 1024;

/** Columns processed between clock checks. `performance.now()` on every column
 *  would cost more than the work it's measuring. */
const COLUMNS_PER_CHECK = 250;

/**
 * How many decoded envelopes to keep, keyed by URL.
 *
 * The case this exists for: four stems on /stems, where AudioPlayer is keyed on
 * `src` and therefore remounts — and re-decodes — every time you click a
 * different one. Six covers a four-stem set plus the original, and at ~96KB
 * each the whole cache is smaller than a single second of decoded audio.
 */
const ENVELOPE_CACHE_LIMIT = 6;
const envelopeCache = new Map<string, WaveformEnvelope>();

function cacheEnvelope(url: string, envelope: WaveformEnvelope): void {
  // Re-inserting moves the key to the end, so plain insertion order is an LRU.
  envelopeCache.delete(url);
  envelopeCache.set(url, envelope);
  while (envelopeCache.size > ENVELOPE_CACHE_LIMIT) {
    const oldest = envelopeCache.keys().next().value;
    if (oldest === undefined) break;
    envelopeCache.delete(oldest);
  }
}

/** Drops cached envelopes. Worth calling when a job's results are replaced —
 *  an upgraded HQ run reuses the same job id and therefore the same URLs. */
export function clearWaveformCache(url?: string): void {
  if (url) envelopeCache.delete(url);
  else envelopeCache.clear();
}

/**
 * One context for the life of the page.
 *
 * Constructing an AudioContext opens an audio device and costs real time, and
 * Chrome throws once a document holds more than six. Four stem players decoding
 * at once was already close to that ceiling. Never closed: a suspended context
 * is harmless, decodeAudioData works while suspended, and closing it would just
 * mean paying construction again on the next file.
 */
let sharedContext: AudioContext | null = null;

function getDecodeContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  sharedContext = new Ctx();
  return sharedContext;
}

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

/** Scans columns [from, to). Pure per-column work — the caller decides whether
 *  to run it all at once or in slices. */
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

  // Normalize to the loudest sample so a quietly recorded track still fills the
  // height. Near-silent files are left alone rather than amplified into a wall
  // of noise.
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
 * Same result as computeWaveformEnvelope, computed in slices that each stay
 * under one frame, yielding in between.
 *
 * decodeAudioData is off-thread, but this scan is not: on a long file it's tens
 * of millions of iterations, and running it in one go blocks the main thread
 * right after the user picks a file — which is exactly when they're most likely
 * to click something. Slicing it keeps every task short enough that input stays
 * responsive, at the cost of a few milliseconds of total wall time.
 *
 * Rejects with an AbortError if `signal` fires, so swapping files mid-scan
 * doesn't leave the old one running to completion.
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

/** Fetch + decode, shared by both public decoders. Returns null on anything that
 *  isn't a usable AudioBuffer — callers treat that as "draw a plain track". */
async function fetchAndDecode(url: string, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const ctx = getDecodeContext();
  if (!ctx) return null;

  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  // The fetch is abortable; the decode below is not, and it's the expensive
  // half. Checking here is what stops a swapped file from paying for the old
  // one's decode in full.
  if (signal?.aborted) return null;

  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  if (signal?.aborted) return null;
  return audioBuffer;
}

/** Decodes an audio source URL into waveform peaks. Returns null on any failure
 *  (CORS block, unsupported codec, network error) — callers should treat null as
 *  "render a plain track, stay fully functional", never as a fatal error. */
export async function decodeWaveformPeaksFromUrl(
  url: string,
  buckets: number,
  signal?: AbortSignal
): Promise<number[] | null> {
  try {
    const audioBuffer = await fetchAndDecode(url, signal);
    if (!audioBuffer) return null;
    return computeWaveformPeaks(audioBuffer, buckets);
  } catch {
    return null;
  }
}

/**
 * Fetches an audio URL and returns a full min/max/RMS envelope, for drawing a
 * finished result rather than a file the user picked.
 *
 * Cached by URL: the player remounts whenever `src` changes, so clicking
 * between stems used to re-fetch and re-decode the same files repeatedly.
 *
 * Returns null on any failure (CORS block, unsupported codec, network error,
 * abort) — callers should treat null as "render a plain track, stay fully
 * functional", never as a fatal error.
 */
export async function decodeWaveformEnvelopeFromUrl(
  url: string,
  signal?: AbortSignal,
  columns: number = ENVELOPE_COLUMNS
): Promise<WaveformEnvelope | null> {
  // Only the default resolution is cached. A caller asking for a different
  // column count wants something this entry can't answer.
  const cacheable = columns === ENVELOPE_COLUMNS;
  if (cacheable) {
    const hit = envelopeCache.get(url);
    if (hit) {
      // Touch it so the most recently used entry survives eviction.
      cacheEnvelope(url, hit);
      return hit;
    }
  }

  try {
    const audioBuffer = await fetchAndDecode(url, signal);
    if (!audioBuffer) return null;
    // Sliced so a long result can't block the main thread in one go.
    const envelope = await computeWaveformEnvelopeAsync(audioBuffer, columns, signal);
    if (cacheable) cacheEnvelope(url, envelope);
    return envelope;
  } catch {
    return null;
  }
}