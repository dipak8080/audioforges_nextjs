// lib/data/conversions.ts
// Mirrors the backend's AUDIO_CONVERSION_MATRIX in config.py — full
// any-to-any conversion between all supported formats. Generated from
// one list, same pattern as the backend, so adding an 8th format later
// is a one-line change here too instead of editing 7 arrays by hand.
const ALL_FORMATS = ["mp3", "wav", "flac", "m4a", "aac", "ogg", "aiff"];

export const CONVERSION_TARGETS: Record<string, string[]> = Object.fromEntries(
  ALL_FORMATS.map((fmt) => [fmt, ALL_FORMATS.filter((f) => f !== fmt)])
);

export function getSourceExtension(filename: string): string | null {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

export function getAllowedTargets(filename: string): string[] {
  const ext = getSourceExtension(filename);
  if (!ext) return [];
  return CONVERSION_TARGETS[ext] || [];
}