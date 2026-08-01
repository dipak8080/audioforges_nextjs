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