import { extractPeaks } from "@/lib/audio/peaks";

export interface LocalAudio {
  peaks: number[];
  duration: number;
}

const MAX_DECODE_BYTES = 150 * 1024 * 1024;

export async function readLocalAudio(file: File, buckets = 180): Promise<LocalAudio | null> {
  if (file.size > MAX_DECODE_BYTES || typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const { peaks, duration } = extractPeaks(buffer, buckets);
    return { peaks: Array.from(peaks), duration };
  } catch {
    return null;
  } finally {
    void ctx.close().catch(() => {});
  }
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

const YT = /^(https?:\/\/)?((www|m|music)\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/i;

export function isYoutubeUrl(value: string): boolean {
  return YT.test(value.trim());
}