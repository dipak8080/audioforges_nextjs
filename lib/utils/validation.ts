// lib/utils/validation.ts
import { z } from "zod";
import type { YouTubeValidationResult, RateLimitResult, FileValidationResult } from "@/lib/types/converter";

// ============ AUDIO FILE VALIDATION ============

/**
 * ⚠️ .aiff ADDED 2026-08-30. It was missing, and this list is the one that
 * actually decides.
 *
 * validateAudioFile is what JoinForm (and every other upload form) calls on a
 * dropped file, while their `accept` strings have always ended ".aiff". The
 * mismatch survived because the check is `isValidMime || isValidExtension` and
 * most browsers report `audio/aiff` — so it passed by MIME and nobody noticed.
 *
 * It fails wherever the browser reports an empty type, which Windows commonly
 * does for AIFF. So AIFF worked SOMETIMES, and when it didn't, the error
 * listed six formats as if AIFF were genuinely unsupported.
 *
 * Third place this same gap turned up, after /stems and /key-finder both
 * understating their format lists. The backend's allowed_audio_formats has
 * seven; anything on the frontend claiming six is wrong.
 *
 * KEEP THIS IN SYNC with /limits.allowed_audio_formats. It can't read the
 * endpoint — this runs client-side and getLimits() is server-only — so it is
 * one of the few remaining hand-maintained lists.
 */
export const AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".aiff",
] as const;

/**
 * 80MB, matching MAX_UPLOAD_BYTES on the backend.
 *
 * Worth knowing where the real ceiling is: Cloudflare's free plan caps request
 * bodies at 100MB and the origin only accepts Cloudflare IPs, so anything past
 * ~100MB never reaches the API at all — the edge returns its own 413 HTML page
 * and nothing appears in the container log. 80 sits comfortably under that.
 *
 * The caps that DIDN'T were join (150) and video-to-audio (200); both were
 * lowered to 90 on 2026-08-30 after a 124MB join spent a minute uploading and
 * was killed at the edge.
 */
export const FILE_SIZE_LIMITS = {
  audio: 80 * 1024 * 1024,
  audioMin: 1024,
} as const;

export function validateAudioFile(file: File | null): FileValidationResult {
  const warnings: string[] = [];

  if (!file) return { isValid: false, error: "No file selected" };
  if (file.size === 0) return { isValid: false, error: "File is empty or corrupted" };
  if (file.size < FILE_SIZE_LIMITS.audioMin) {
    return { isValid: false, error: "File appears to be corrupted (too small)" };
  }
  if (file.size > FILE_SIZE_LIMITS.audio) {
    const maxMB = Math.round(FILE_SIZE_LIMITS.audio / (1024 * 1024));
    return { isValid: false, error: `File size exceeds ${maxMB}MB limit` };
  }

  const fileName = file.name.toLowerCase();
  const isValidMime = file.type.startsWith("audio/");
  const isValidExtension = AUDIO_EXTENSIONS.some((ext) => fileName.endsWith(ext));

  if (!isValidMime && !isValidExtension) {
    // Built from the list rather than typed, so the message can't name a
    // different set of formats from the one actually being checked — which is
    // exactly how AIFF ended up absent here and present in every accept string.
    const formats = AUDIO_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()).join(", ");
    return {
      isValid: false,
      error: `Invalid file type. Please upload an audio file (${formats})`,
    };
  }
  if (fileName.endsWith(".ogg") || fileName.endsWith(".flac")) {
    warnings.push("OGG/FLAC files may take longer to process");
  }
  if (file.size > 30 * 1024 * 1024) {
    warnings.push("Large files may take longer to process");
  }
  if (/[<>:"/\\|?*\x00-\x1f]/.test(file.name)) {
    return { isValid: false, error: "File name contains invalid characters" };
  }
  if (file.name.length > 255) {
    return { isValid: false, error: "File name is too long (max 255 characters)" };
  }

  return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

// ============ YOUTUBE URL VALIDATION ============

export const youtubeUrlSchema = z
  .string()
  .min(1, "Please enter a YouTube URL")
  .max(500, "URL is too long")
  .refine((url) => {
    const trimmed = url.trim();
    try {
      new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    } catch {
      return false;
    }
    return true;
  }, "Please enter a valid URL")
  .refine((url) => {
    const trimmed = url.trim();
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?.*v=[\w-]{11}/,
      /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]{11}/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]{11}/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]{11}/,
      /^(https?:\/\/)?(m\.)?youtube\.com\/watch\?v=[\w-]{11}/,
    ];
    return patterns.some((pattern) => pattern.test(trimmed));
  }, "Invalid YouTube URL. Please use a valid youtube.com or youtu.be link");

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function validateYouTubeUrl(url: string): YouTubeValidationResult {
  const trimmed = url.trim();

  if (!trimmed) {
    return { isValid: false, error: "Please enter a YouTube URL" };
  }
  if (trimmed.length > 500) {
    return { isValid: false, error: "URL is too long" };
  }
  if (trimmed.includes("playlist")) {
    return { isValid: false, error: "Playlists are not supported. Please use a single video URL" };
  }
  if (trimmed.includes("channel") || trimmed.includes("@")) {
    return { isValid: false, error: "Channel URLs are not supported. Please use a video URL" };
  }

  const result = youtubeUrlSchema.safeParse(trimmed);
  if (!result.success) {
    return { isValid: false, error: result.error.issues[0]?.message || "Invalid URL" };
  }

  const videoId = extractYouTubeVideoId(trimmed);
  if (!videoId) {
    return { isValid: false, error: "Could not extract video ID from URL" };
  }
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return { isValid: false, error: "Invalid video ID format" };
  }

  return {
    isValid: true,
    videoId,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

// ============ SANITIZATION ============

export function sanitizeUserInput(input: string, maxLength: number = 500): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// ============ CLIENT-SIDE RATE LIMITING ============
// Note: this only throttles UI clicks. Real rate limiting must live server-side
// (your FastAPI backend), since this resets on page reload / is trivially bypassed.

const requestTimestamps: Map<string, number[]> = new Map();

export function checkRateLimit(
  action: string,
  maxRequests: number = 5,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const timestamps = requestTimestamps.get(action) || [];
  const recentTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (recentTimestamps.length >= maxRequests) {
    const oldestInWindow = Math.min(...recentTimestamps);
    const retryAfterMs = windowMs - (now - oldestInWindow);
    return {
      allowed: false,
      retryAfterMs,
      message: `Too many requests. Please wait ${Math.ceil(retryAfterMs / 1000)} seconds`,
    };
  }

  recentTimestamps.push(now);
  requestTimestamps.set(action, recentTimestamps);
  return { allowed: true };
}