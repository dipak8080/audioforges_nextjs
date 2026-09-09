export interface MixStemState {
  buffer: AudioBuffer;
  gain: number;
  pan: number;
  muted: boolean;
}

/**
 * Render the user's current mix (gains, pans, mutes applied) to a stereo WAV
 * Blob entirely client-side via OfflineAudioContext.
 */
export async function renderMixToWav(stems: MixStemState[]): Promise<Blob> {
  const audible = stems.filter((s) => !s.muted && s.gain > 0);
  const sampleRate = stems[0]?.buffer.sampleRate ?? 44100;
  const length = Math.max(1, ...stems.map((s) => s.buffer.length));

  const ctx = new OfflineAudioContext(2, length, sampleRate);

  for (const stem of audible) {
    const source = ctx.createBufferSource();
    source.buffer = stem.buffer;
    const gain = ctx.createGain();
    gain.gain.value = stem.gain;
    const panner = ctx.createStereoPanner();
    panner.pan.value = stem.pan;
    source.connect(gain).connect(panner).connect(ctx.destination);
    source.start(0);
  }

  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}