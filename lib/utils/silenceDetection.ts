/**
 * Client-side approximation of silence detection, for live UI preview
 * only — NOT a reimplementation of whatever the backend's actual
 * detector does (ffmpeg silencedetect or similar). Treat results as
 * "roughly this shape," useful for calibrating sliders before spending
 * a job on it, not as a guarantee of the exact output.
 */

export interface DbTimeline {
  windowSeconds: number;
  db: number[];
}

export interface QuietRange {
  startSeconds: number;
  endSeconds: number;
}

const MAX_ANALYSIS_BUCKETS = 1500;
const MIN_WINDOW_SECONDS = 0.02;

/** RMS loudness in dB per fixed time window, across the whole file.
 *  Window size adapts to file length so a 3-minute podcast and a
 *  20-second clip both land under MAX_ANALYSIS_BUCKETS windows. */
export function computeDbTimeline(buffer: AudioBuffer): DbTimeline {
  const channelData = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0);
  const duration = buffer.duration || 0;
  const windowSeconds = Math.max(MIN_WINDOW_SECONDS, duration / MAX_ANALYSIS_BUCKETS);
  const windowSamples = Math.max(1, Math.floor(windowSeconds * buffer.sampleRate));

  const db: number[] = [];
  for (let start = 0; start < channelData.length; start += windowSamples) {
    const end = Math.min(start + windowSamples, channelData.length);
    let sumSquares = 0;
    for (let i = start; i < end; i++) sumSquares += channelData[i] * channelData[i];
    const rms = Math.sqrt(sumSquares / Math.max(1, end - start));
    db.push(rms > 0 ? 20 * Math.log10(rms) : -100);
  }
  return { windowSeconds, db };
}

/** Contiguous below-threshold runs at least minDuration long — the
 *  actual "would be treated as silence" ranges for a given
 *  threshold/min-gap pair. */
export function findQuietRanges(timeline: DbTimeline, thresholdDb: number, minDuration: number): QuietRange[] {
  const { windowSeconds, db } = timeline;
  const ranges: QuietRange[] = [];
  let runStart: number | null = null;

  for (let i = 0; i <= db.length; i++) {
    const isQuiet = i < db.length && db[i] < thresholdDb;
    if (isQuiet && runStart === null) {
      runStart = i;
    } else if (!isQuiet && runStart !== null) {
      const startSeconds = runStart * windowSeconds;
      const endSeconds = i * windowSeconds;
      if (endSeconds - startSeconds >= minDuration) ranges.push({ startSeconds, endSeconds });
      runStart = null;
    }
  }
  return ranges;
}

/** The complement of the quiet ranges — the audible segments that
 *  would survive as separate output tracks once the quiet ranges are
 *  used as split/cut points. */
export function findAudibleSegments(duration: number, quietRanges: QuietRange[]): QuietRange[] {
  const segments: QuietRange[] = [];
  let cursor = 0;
  for (const gap of quietRanges) {
    if (gap.startSeconds > cursor) segments.push({ startSeconds: cursor, endSeconds: gap.startSeconds });
    cursor = gap.endSeconds;
  }
  if (cursor < duration) segments.push({ startSeconds: cursor, endSeconds: duration });
  return segments;
}