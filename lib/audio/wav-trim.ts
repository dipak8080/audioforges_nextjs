/**
 * Cuts a PCM WAV down to its first `seconds` before upload. The server only
 * analyses the first ANALYSIS_MAX_SECONDS (180) anyway, so sending one extra
 * second keeps its own trim sample-identical while skipping the rest of the
 * upload. Anything that is not a plain RIFF/WAVE file is returned untouched.
 */

export const ANALYSIS_UPLOAD_SECONDS = 181;

const HEADER_PROBE_BYTES = 1024 * 1024;

type WavLayout = { dataStart: number; dataSize: number; blockAlign: number; sampleRate: number };

function tag(view: DataView, at: number): string {
  return String.fromCharCode(view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2), view.getUint8(at + 3));
}

function readLayout(buf: ArrayBuffer, fileSize: number): WavLayout | null {
  const view = new DataView(buf);
  if (buf.byteLength < 12 || tag(view, 0) !== "RIFF" || tag(view, 8) !== "WAVE") return null;

  let blockAlign = 0;
  let sampleRate = 0;
  let at = 12;
  while (at + 8 <= buf.byteLength) {
    const id = tag(view, at);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    if (id === "fmt ") {
      if (body + 16 > buf.byteLength) return null;
      sampleRate = view.getUint32(body + 4, true);
      blockAlign = view.getUint16(body + 12, true);
    } else if (id === "data") {
      if (!blockAlign || !sampleRate) return null;
      const available = fileSize - body;
      const dataSize = size === 0 || size === 0xffffffff || size > available ? available : size;
      return { dataStart: body, dataSize, blockAlign, sampleRate };
    }
    at = body + size + (size % 2);
  }
  return null;
}

export async function trimWavForAnalysis(file: File, seconds = ANALYSIS_UPLOAD_SECONDS): Promise<File> {
  try {
    const ext = file.name.toLowerCase().split(".").pop();
    const typed = /wav|wave/.test(file.type);
    if (ext !== "wav" && ext !== "wave" && !typed) return file;

    const head = await file.slice(0, Math.min(file.size, HEADER_PROBE_BYTES)).arrayBuffer();
    const layout = readLayout(head, file.size);
    if (!layout) return file;

    const { dataStart, dataSize, blockAlign, sampleRate } = layout;
    const keep = Math.floor(sampleRate * seconds) * blockAlign;
    if (keep <= 0 || keep >= dataSize) return file;

    const header = head.slice(0, dataStart);
    const hv = new DataView(header);
    const pad = keep % 2;
    hv.setUint32(4, dataStart - 8 + keep + pad, true);
    hv.setUint32(dataStart - 4, keep, true);

    const parts: BlobPart[] = [header, file.slice(dataStart, dataStart + keep)];
    if (pad) parts.push(new Uint8Array(1));
    return new File(parts, file.name, { type: file.type || "audio/wav", lastModified: file.lastModified });
  } catch {
    return file;
  }
}