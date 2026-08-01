"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import { cn } from "@/lib/utils/cn";

interface RateSpec {
  rate: number;
  label: string;
  nyquistKhz: number;
  use: string;
}

const SAMPLE_RATES: RateSpec[] = [
  { rate: 22050, label: "22.05 kHz", nyquistKhz: 11.025, use: "Voice, small files" },
  { rate: 44100, label: "44.1 kHz", nyquistKhz: 22.05, use: "CD standard" },
  { rate: 48000, label: "48 kHz", nyquistKhz: 24, use: "Video, DAWs" },
  { rate: 96000, label: "96 kHz", nyquistKhz: 48, use: "High-res masters" },
];

const BIT_DEPTHS = [16, 24, 32] as const;
const BIT_DEPTH_NOTES: Record<number, string> = {
  16: "~96 dB dynamic range — CD standard",
  24: "~144 dB — studio/mastering headroom",
  32: "Float — for further processing, not distribution",
};

/* ------------------------------------------------------------------ */
/* File probing — what the upload actually is, before you pick a target */
/* ------------------------------------------------------------------ */

interface FileAudioInfo {
  sampleRate: number | null;
  bitDepth: number | null;
}

/** Reads a WAV's `fmt ` chunk directly from the bytes rather than a full
 *  decode — bit depth doesn't survive decodeAudioData (the Web Audio API
 *  always hands back 32-bit float regardless of source), so this is the
 *  only way to know what the file originally was. Scans for the chunk
 *  rather than assuming a fixed offset, since RIFF files can have extra
 *  chunks (LIST, JUNK, etc.) before `fmt `. Returns null for anything
 *  that isn't a plain WAV — AIFF and compressed formats don't expose a
 *  bit depth this cheaply, and aren't worth a full decode just for this.
 */
async function readWavBitDepth(file: File): Promise<number | null> {
  if (!/\.wav$/i.test(file.name)) return null;
  try {
    const head = await file.slice(0, 4096).arrayBuffer();
    const view = new DataView(head);
    const asciiAt = (offset: number, len: number) =>
      String.fromCharCode(...new Uint8Array(head, offset, len));

    if (asciiAt(0, 4) !== "RIFF" || asciiAt(8, 4) !== "WAVE") return null;

    let offset = 12;
    while (offset + 8 <= head.byteLength) {
      const chunkId = asciiAt(offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === "fmt " && offset + 8 + 16 <= head.byteLength) {
        return view.getUint16(offset + 8 + 14, true); // bitsPerSample field
      }
      offset += 8 + chunkSize + (chunkSize % 2); // chunks are word-aligned
    }
  } catch {
    // Fall through to null — the tool still works, it just can't show
    // the "your file is currently X-bit" context.
  }
  return null;
}

async function probeSampleRate(file: File): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    try {
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      return buffer.sampleRate;
    } finally {
      ctx.close();
    }
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */

function guidanceFor(current: number | null, target: number): string | null {
  if (current === null) return null;
  if (target === current) return "Same as your file — no resampling needed.";
  if (target > current) {
    return `Upsampling from ${(current / 1000).toFixed(1)} kHz — interpolates between existing samples, doesn't add detail that wasn't there.`;
  }
  const targetNyquist = target / 2 / 1000;
  return `Downsampling from ${(current / 1000).toFixed(1)} kHz — removes anything above ${targetNyquist} kHz.`;
}

function bitDepthGuidance(current: number | null, target: number | null): string | null {
  if (target === null || current === null) return null;
  if (target === current) return "Same as your file.";
  if (target > current) return `Upconverting from ${current}-bit adds no real precision, just a larger file.`;
  return `Reducing from ${current}-bit to ${target}-bit lowers dynamic range — fine for most uses, but re-export from the source if you need full quality later.`;
}

/* ------------------------------------------------------------------ */

export function ResampleForm() {
  const [sampleRate, setSampleRate] = useState(44100);
  const [bitDepth, setBitDepth] = useState<number | null>(null);
  const [fileInfo, setFileInfo] = useState<FileAudioInfo>({ sampleRate: null, bitDepth: null });

  return (
    <JobToolForm
      endpoint="resample"
      pollIntervalMs={2500}
      toolLabel="Sample rate converter"
      toolMeta={`→ ${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 2)} kHz`}
      submitLabel="Convert sample rate"
      processingLabel="Resampling"
      expectedRange="a few seconds"
      resultVerb="Resampled"
      stages={[
        { at: 0, label: "Reading the audio" },
        { at: 3, label: "Applying the anti-aliasing filter" },
        { at: 7, label: "Resampling" },
        { at: 11, label: "Writing the output file" },
      ]}
      buildExtraFields={() => {
        const fields: Record<string, string> = { sample_rate: String(sampleRate) };
        if (bitDepth !== null) fields.bit_depth = String(bitDepth);
        return fields;
      }}
      renderControls={(file, disabled) => {
        // Probe once per newly-selected file — cheap enough at 50MB cap,
        // and it's the only way to give live upsample/downsample context
        // instead of a bare list of numbers with no relationship to what
        // was actually uploaded.
        return (
          <FileProbe file={file} onProbe={setFileInfo}>
            <div className="space-y-5">
              {fileInfo.sampleRate !== null && (
                <p className="flex items-center gap-1.5 text-xs text-text-subtle">
                  <Info className="h-3 w-3 shrink-0" aria-hidden />
                  Your file is currently {(fileInfo.sampleRate / 1000).toFixed(2).replace(/\.?0+$/, "")} kHz
                  {fileInfo.bitDepth !== null ? `, ${fileInfo.bitDepth}-bit` : ""}.
                </p>
              )}

              <fieldset className="space-y-2" disabled={disabled}>
                <legend className="mb-2 text-sm font-medium text-text-primary">Sample rate</legend>
                <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Sample rate">
                  {SAMPLE_RATES.map((spec) => {
                    const selected = sampleRate === spec.rate;
                    return (
                      <button
                        key={spec.rate}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSampleRate(spec.rate)}
                        disabled={disabled}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-all",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                          selected
                            ? "border-amber-500/60 bg-amber-500/[0.07]"
                            : "border-graphite-700 bg-graphite-850 hover:border-graphite-700/60 hover:bg-graphite-800/60"
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "font-mono text-sm font-semibold",
                              selected ? "text-amber-400" : "text-text-primary"
                            )}
                          >
                            {spec.label}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[10px]",
                              selected ? "text-amber-500/80" : "text-text-subtle"
                            )}
                          >
                            ≤{spec.nyquistKhz} kHz
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-text-muted">{spec.use}</p>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const guidance = guidanceFor(fileInfo.sampleRate, sampleRate);
                  return guidance ? (
                    <p className="flex items-start gap-1.5 pt-1 text-[11px] text-text-subtle">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {guidance}
                    </p>
                  ) : null;
                })()}
              </fieldset>

              <fieldset className="space-y-2" disabled={disabled}>
                <legend className="mb-2 text-sm font-medium text-text-primary">
                  Bit depth <span className="font-normal text-text-subtle">(WAV/AIFF only, optional)</span>
                </legend>
                <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Bit depth">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={bitDepth === null}
                    onClick={() => setBitDepth(null)}
                    disabled={disabled}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-40",
                      bitDepth === null
                        ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                        : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                    )}
                  >
                    Keep
                  </button>
                  {BIT_DEPTHS.map((depth) => (
                    <button
                      key={depth}
                      type="button"
                      role="radio"
                      aria-checked={bitDepth === depth}
                      onClick={() => setBitDepth(depth)}
                      disabled={disabled}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs font-mono font-semibold transition-colors disabled:opacity-40",
                        bitDepth === depth
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
                          : "border-graphite-700 bg-graphite-850 text-text-muted hover:text-text-primary"
                      )}
                    >
                      {depth}-bit
                    </button>
                  ))}
                </div>

                <p className="text-[11px] leading-snug text-text-subtle">
                  {bitDepth !== null
                    ? BIT_DEPTH_NOTES[bitDepth]
                    : "Only applies to uncompressed WAV/AIFF — ignored for MP3, FLAC, AAC, and OGG."}
                </p>

                {(() => {
                  const guidance = bitDepthGuidance(fileInfo.bitDepth, bitDepth);
                  return guidance ? (
                    <p className="flex items-start gap-1.5 text-[11px] text-text-subtle">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      {guidance}
                    </p>
                  ) : null;
                })()}
              </fieldset>
            </div>
          </FileProbe>
        );
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Probe wrapper — runs once per file, reports up via onProbe           */
/* ------------------------------------------------------------------ */

function FileProbe({
  file,
  onProbe,
  children,
}: {
  file: File | null;
  onProbe: (info: FileAudioInfo) => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!file) {
      onProbe({ sampleRate: null, bitDepth: null });
      return;
    }
    let cancelled = false;
    Promise.all([probeSampleRate(file), readWavBitDepth(file)]).then(([sampleRate, bitDepth]) => {
      if (!cancelled) onProbe({ sampleRate, bitDepth });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return <>{children}</>;
}