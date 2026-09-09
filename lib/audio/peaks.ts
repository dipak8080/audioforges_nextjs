export interface StemPeaks {
  peaks: Float32Array;
  duration: number;
}

/**
 * Reduce a decoded AudioBuffer to per-bucket peak amplitudes (mono, max of
 * channels) for canvas waveform rendering.
 */
export function extractPeaks(buffer: AudioBuffer, buckets: number): StemPeaks {
  const peaks = new Float32Array(buckets);
  const channels = buffer.numberOfChannels;
  const samplesPerBucket = Math.max(1, Math.floor(buffer.length / buckets));

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let b = 0; b < buckets; b++) {
      const start = b * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, data.length);
      let max = 0;
      for (let i = start; i < end; i += 4) {
        const v = Math.abs(data[i]);
        if (v > max) max = v;
      }
      if (max > peaks[b]) peaks[b] = max;
    }
  }

  let global = 0;
  for (let b = 0; b < buckets; b++) if (peaks[b] > global) global = peaks[b];
  if (global > 0.001) {
    const scale = 1 / global;
    for (let b = 0; b < buckets; b++) peaks[b] *= scale;
  }

  return { peaks, duration: buffer.duration };
}