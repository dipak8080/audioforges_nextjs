/**
 * Builds a WAV in the browser from YouTube's original compressed stream
 * (Opus/WebM or AAC/M4A) sent by POST /download with `source`. The server
 * used to decode that same stream and send ~10x the bytes as WAV.
 */

export type SourceCodec = "opus" | "aac";

const OPUS_BROKEN_KEY = "af-opus-decode-failed";

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the retry path still works, it just repeats next time */
  }
}

export function pickSourceCodec(): SourceCodec {
  if (typeof window === "undefined") return "aac";
  if (storageGet(OPUS_BROKEN_KEY) === "1") return "aac";
  try {
    const probe = document.createElement("audio");
    if (probe.canPlayType('audio/webm; codecs="opus"')) return "opus";
  } catch {
    /* fall through */
  }
  return "aac";
}

export function markOpusUnsupported() {
  storageSet(OPUS_BROKEN_KEY, "1");
}

type OfflineCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

function offlineContext(sampleRate: number): OfflineAudioContext {
  const w = window as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!Ctor) throw new Error("This browser can't decode audio");
  return new Ctor(2, 1, sampleRate);
}

function decode(ctx: OfflineAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // Older Safari only has the callback form and returns undefined
  return new Promise((resolve, reject) => {
    const maybe = ctx.decodeAudioData(data, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (maybe && typeof maybe.then === "function") maybe.then(resolve, reject);
  });
}

function encodeWav16(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const rate = buffer.sampleRate;
  const dataBytes = frames * channels * 2;
  const out = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(out);

  const tag = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, dataBytes, true);

  // Int16Array is far faster than per-sample DataView calls on long files
  const pcm = new Int16Array(out, 44, frames * channels);
  const data: Float32Array[] = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));

  let i = 0;
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      // Same scaling and rounding as ffmpeg's float -> s16, so the file matches what the server made
      const v = Math.round(data[c][f] * 32768);
      pcm[i++] = v > 32767 ? 32767 : v < -32768 ? -32768 : v;
    }
  }

  return new Blob([out], { type: "audio/wav" });
}

/** Decodes a compressed source file at its native rate and returns a 16-bit PCM WAV. */
export async function sourceToWav(data: ArrayBuffer, sampleRate?: number): Promise<Blob> {
  const rate = sampleRate && sampleRate >= 8000 && sampleRate <= 192000 ? sampleRate : 48000;
  const audio = await decode(offlineContext(rate), data);
  return encodeWav16(audio);
}