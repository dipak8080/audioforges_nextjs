// lib/data/conversions.ts
// Mirrors the backend's allowed (source -> targets) table for /convert.
// Keep this in sync if the backend's supported pairs ever change.

export const CONVERSION_TARGETS: Record<string, string[]> = {
  mp3: ["wav"],
  wav: ["mp3", "flac", "aac", "aiff"],
  flac: ["wav"],
  m4a: ["mp3"],
  aac: ["wav"],
  ogg: ["mp3"],
  aiff: ["wav"],
};

export function getSourceExtension(filename: string): string | null {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : null;
}

export function getAllowedTargets(filename: string): string[] {
  const ext = getSourceExtension(filename);
  if (!ext) return [];
  return CONVERSION_TARGETS[ext] || [];
}