const FRAME = 2048;
const HOP_OUT = 512;
const TOL = 512;
const SEARCH_STEP = 8;
const CORR_LEN = 256;
const CORR_STEP = 4;

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  return w;
}
const WINDOW = hann(FRAME);

function findOffsets(ref: Float32Array, ratio: number, outLen: number): Int32Array {
  const hopIn = HOP_OUT / ratio;
  const frames = Math.ceil(outLen / HOP_OUT) + 1;
  const offsets = new Int32Array(frames);
  const maxStart = ref.length - FRAME - 1;
  let prev = 0;
  for (let k = 0; k < frames; k++) {
    const nominal = Math.min(maxStart, Math.round(k * hopIn));
    if (k === 0 || nominal <= 0) {
      offsets[k] = Math.max(0, nominal);
      prev = offsets[k];
      continue;
    }
    const natural = Math.min(maxStart, prev + HOP_OUT);
    let best = nominal;
    let bestScore = -Infinity;
    const lo = Math.max(0, nominal - TOL);
    const hi = Math.min(maxStart - CORR_LEN, nominal + TOL);
    for (let c = lo; c <= hi; c += SEARCH_STEP) {
      let score = 0;
      for (let i = 0; i < CORR_LEN; i += CORR_STEP) score += ref[c + i] * ref[natural + i];
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    offsets[k] = best;
    prev = best;
  }
  return offsets;
}

function overlapAdd(input: Float32Array, offsets: Int32Array, outLen: number): Float32Array {
  const out = new Float32Array(outLen + FRAME);
  const norm = new Float32Array(outLen + FRAME);
  for (let k = 0; k < offsets.length; k++) {
    const at = k * HOP_OUT;
    const from = offsets[k];
    for (let i = 0; i < FRAME && from + i < input.length && at + i < out.length; i++) {
      out[at + i] += input[from + i] * WINDOW[i];
      norm[at + i] += WINDOW[i];
    }
  }
  const res = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) res[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return res;
}

function resample(input: Float32Array, factor: number): Float32Array {
  const len = Math.max(1, Math.floor(input.length / factor));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const x = i * factor;
    const i0 = Math.floor(x);
    const t = x - i0;
    const a = input[i0] ?? 0;
    const b = input[i0 + 1] ?? a;
    out[i] = a + (b - a) * t;
  }
  return out;
}

export async function transformBuffer(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  tempo: number,
  semitones: number
): Promise<AudioBuffer> {
  if (tempo === 1 && semitones === 0) return buffer;
  const pitch = Math.pow(2, semitones / 12);
  const ratio = pitch / tempo;
  const stretchedLen = Math.round(buffer.length * ratio);
  const ref = buffer.getChannelData(0);
  const offsets = findOffsets(ref, ratio, stretchedLen);
  await new Promise((r) => setTimeout(r, 0));
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const stretched = overlapAdd(buffer.getChannelData(ch), offsets, stretchedLen);
    channels.push(pitch === 1 ? stretched : resample(stretched, pitch));
    await new Promise((r) => setTimeout(r, 0));
  }
  const out = ctx.createBuffer(buffer.numberOfChannels, channels[0].length, buffer.sampleRate);
  channels.forEach((data, ch) => out.copyToChannel(data as Float32Array<ArrayBuffer>, ch));
  return out;
}