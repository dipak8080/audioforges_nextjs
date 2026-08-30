"use client";

import { useEffect, useState } from "react";
import { JobToolForm } from "@/components/converter/JobToolForm";
import {
  ControlField,
  Hint,
  OptionCards,
  Segmented,
  type CardOption,
} from "@/components/converter/ToolControls";
import { getRateLimitLabel } from "@/lib/data/rate-limits";

/**
 * ── THIS PASS ──────────────────────────────────────────────────────────
 *
 * 1. IT DECODED THE ENTIRE FILE TO READ ONE NUMBER. probeSampleRate ran
 *    decodeAudioData on the whole upload — up to 80MB, minutes of audio,
 *    hundreds of megabytes of Float32 in memory — to learn the sample rate,
 *    which for a WAV is sixteen bytes into a header this file was ALREADY
 *    parsing for bit depth. The header read now answers both for WAV, and the
 *    decode is the fallback for formats that don't expose it that cheaply.
 *
 * 2. IT BUILT AN AudioContext PER FILE. Chrome caps a document at six and
 *    construction opens an audio device. Shared, and only reached now when the
 *    header path can't answer.
 *
 * 3. THE PROBE COULDN'T BE CANCELLED. `cancelled` stopped the RESULT being
 *    used, not the decode — pick three files quickly and three full decodes
 *    ran to completion against each other.
 *
 * 4. TWO MORE FAKE RADIOGROUPS. Both the rate cards and the bit-depth row
 *    declared `role="radiogroup"` over plain buttons with no roving tabindex
 *    and no arrow keys — so between them, seven tab stops where assistive tech
 *    was promised two.
 *
 * 5. THE BIT-DEPTH ROW IS `Segmented` NOW, the same compact pill row Pitch,
 *    Tempo and Volume each hand-rolled for their presets. Fourth copy avoided.
 *
 * 6. A 429 NAMES THE LIMIT. Note the key: the endpoint is `resample`, the
 *    RATE_LIMITS entry is `sample-rate-converter` (the public slug).
 */

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

const RATE_LIMIT_LABEL = getRateLimitLabel("sample-rate-converter");

/** "keep" is a real choice here, not the absence of one — the backend omits
 *  the field entirely and the file's own depth survives. */
type BitDepthChoice = "keep" | "16" | "24" | "32";

const BIT_DEPTH_OPTIONS: ReadonlyArray<{ value: BitDepthChoice; label: string; ariaLabel?: string }> = [
  { value: "keep", label: "Keep", ariaLabel: "Keep the file's current bit depth" },
  ...BIT_DEPTHS.map((d) => ({
    value: String(d) as BitDepthChoice,
    label: `${d}-bit`,
    ariaLabel: `${d} bit`,
  })),
];

/* ------------------------------------------------------------------ */
/* File probing — what the upload actually is, before you pick a target */
/* ------------------------------------------------------------------ */

interface FileAudioInfo {
  sampleRate: number | null;
  bitDepth: number | null;
}

/**
 * One AudioContext for the page, created on first use, never closed. Chrome
 * throws past six per document and construction opens an audio device.
 */
let sharedCtx: AudioContext | null = null;

/**
 * Reads a WAV's `fmt ` chunk directly from the bytes.
 *
 * Bit depth doesn't survive decodeAudioData — the Web Audio API always hands
 * back 32-bit float regardless of source — so for that, this is the only way.
 * SAMPLE RATE is in the same chunk four bytes earlier, which is the whole
 * reason this now returns both: the old code read this header for the depth
 * and then decoded the entire file to learn a number sitting right next to it.
 *
 * Scans for the chunk rather than assuming a fixed offset, since RIFF files
 * can carry extra chunks (LIST, JUNK) before `fmt `. Returns nulls for
 * anything that isn't a plain WAV.
 */
async function readWavHeader(file: File): Promise<FileAudioInfo> {
  const empty: FileAudioInfo = { sampleRate: null, bitDepth: null };
  if (!/\.wav$/i.test(file.name)) return empty;
  try {
    const head = await file.slice(0, 4096).arrayBuffer();
    const view = new DataView(head);
    const asciiAt = (offset: number, len: number) =>
      String.fromCharCode(...new Uint8Array(head, offset, len));

    if (asciiAt(0, 4) !== "RIFF" || asciiAt(8, 4) !== "WAVE") return empty;

    let offset = 12;
    while (offset + 8 <= head.byteLength) {
      const chunkId = asciiAt(offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === "fmt " && offset + 8 + 16 <= head.byteLength) {
        return {
          // fmt layout: audioFormat(2) channels(2) sampleRate(4) …
          // bitsPerSample sits 14 bytes in.
          sampleRate: view.getUint32(offset + 8 + 4, true) || null,
          bitDepth: view.getUint16(offset + 8 + 14, true) || null,
        };
      }
      offset += 8 + chunkSize + (chunkSize % 2); // chunks are word-aligned
    }
  } catch {
    // Fall through — the tool still works, it just can't show the
    // "your file is currently X" context.
  }
  return empty;
}

/**
 * The fallback, for formats whose sample rate isn't readable from a header we
 * can parse. This is a FULL decode: expensive, and the reason the WAV path
 * above exists.
 */
async function decodeSampleRate(file: File, signal?: AbortSignal): Promise<number | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    if (signal?.aborted) return null;

    if (!sharedCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      sharedCtx = new Ctx();
    }

    const buffer = await sharedCtx.decodeAudioData(arrayBuffer);
    if (signal?.aborted) return null;
    return buffer.sampleRate;
  } catch {
    return null;
  }
}

async function probeFile(file: File, signal?: AbortSignal): Promise<FileAudioInfo> {
  const header = await readWavHeader(file);
  if (signal?.aborted) return { sampleRate: null, bitDepth: null };
  // Header answered it: no decode at all for the common case.
  if (header.sampleRate !== null) return header;
  return { sampleRate: await decodeSampleRate(file, signal), bitDepth: header.bitDepth };
}

/* ------------------------------------------------------------------ */

function formatKhz(rate: number): string {
  return (rate / 1000).toFixed(2).replace(/\.?0+$/, "");
}

function guidanceFor(current: number | null, target: number): string | null {
  if (current === null) return null;
  if (target === current) return "Same as your file — no resampling needed.";
  if (target > current) {
    return `Upsampling from ${formatKhz(current)} kHz — interpolates between existing samples, doesn't add detail that wasn't there.`;
  }
  return `Downsampling from ${formatKhz(current)} kHz — removes anything above ${target / 2 / 1000} kHz.`;
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
  const [bitChoice, setBitChoice] = useState<BitDepthChoice>("keep");
  const [fileInfo, setFileInfo] = useState<FileAudioInfo>({ sampleRate: null, bitDepth: null });

  const bitDepth = bitChoice === "keep" ? null : Number(bitChoice);

  const rateOptions: CardOption<string>[] = SAMPLE_RATES.map((spec) => ({
    value: String(spec.rate),
    title: spec.label,
    meta: `≤${spec.nyquistKhz} kHz`,
    detail: spec.use,
  }));

  const rateGuidance = guidanceFor(fileInfo.sampleRate, sampleRate);
  const depthGuidance = bitDepthGuidance(fileInfo.bitDepth, bitDepth);

  return (
    <JobToolForm
      endpoint="resample"
      pollIntervalMs={2500}
      toolLabel="Sample rate converter"
      toolMeta={`→ ${formatKhz(sampleRate)} kHz`}
      submitLabel="Convert sample rate"
      processingLabel="Resampling"
      expectedRange="a few seconds"
      resultVerb="Resampled"
      rateLimitMessage={
        RATE_LIMIT_LABEL
          ? `Sample rate conversion is limited to ${RATE_LIMIT_LABEL}. Wait for the timer, then run it again.`
          : undefined
      }
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
      renderControls={(file, disabled) => (
        <div className="space-y-5">
          <FileProbe file={file} onProbe={setFileInfo} />

          {fileInfo.sampleRate !== null && (
            <Hint>
              Your file is currently {formatKhz(fileInfo.sampleRate)} kHz
              {fileInfo.bitDepth !== null ? `, ${fileInfo.bitDepth}-bit` : ""}.
            </Hint>
          )}

          <ControlField
            as="fieldset"
            label="Sample rate"
            hint={rateGuidance ? <Hint>{rateGuidance}</Hint> : undefined}
          >
            <OptionCards
              label="Sample rate"
              options={rateOptions}
              value={String(sampleRate)}
              onChange={(v) => setSampleRate(Number(v))}
              disabled={disabled}
              mono
            />
          </ControlField>

          <ControlField
            as="fieldset"
            label="Bit depth"
            meta="WAV/AIFF only"
            hint={
              <>
                <span className="block">
                  {bitDepth !== null
                    ? BIT_DEPTH_NOTES[bitDepth]
                    : "Only applies to uncompressed WAV/AIFF — ignored for MP3, FLAC, AAC, and OGG."}
                </span>
                {depthGuidance && <Hint>{depthGuidance}</Hint>}
              </>
            }
          >
            <Segmented
              label="Bit depth"
              options={BIT_DEPTH_OPTIONS}
              value={bitChoice}
              onChange={setBitChoice}
              disabled={disabled}
              mono
            />
          </ControlField>
        </div>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Probe wrapper — runs once per file, reports up via onProbe           */
/* ------------------------------------------------------------------ */

/**
 * Renders nothing. It used to wrap the whole control tree as `children`, which
 * meant every probe result re-rendered through this component for no reason —
 * it has no opinion about what it wraps.
 */
function FileProbe({
  file,
  onProbe,
}: {
  file: File | null;
  onProbe: (info: FileAudioInfo) => void;
}) {
  useEffect(() => {
    if (!file) {
      onProbe({ sampleRate: null, bitDepth: null });
      return;
    }

    let cancelled = false;
    // The flag stopped the RESULT being used; a full decode still ran to
    // completion. Three files picked quickly meant three of them at once.
    const abort = new AbortController();

    probeFile(file, abort.signal).then((info) => {
      if (!cancelled) onProbe(info);
    });

    return () => {
      cancelled = true;
      abort.abort();
    };
    // onProbe is a stable setState from the parent; adding it would re-probe
    // the file on every unrelated render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return null;
}