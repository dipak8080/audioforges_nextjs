export interface ShareCardInput {
  title: string;
  engine: string;
  tag: string;
  stems: string[];
  peaks: number[] | null;
}

const W = 1080;
const H = 1080;

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, lines = 2): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      out.push(cur);
      cur = w;
      if (out.length === lines - 1) break;
    } else cur = next;
  }
  if (cur && out.length < lines) out.push(cur);
  return out;
}

export async function renderShareCard(input: ShareCardInput): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  await document.fonts?.ready;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1a1a1d");
  bg.addColorStop(1, "#0e0e10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.75, 80, 20, W * 0.75, 80, 600);
  glow.addColorStop(0, "rgba(232,162,61,0.22)");
  glow.addColorStop(1, "rgba(232,162,61,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#e8a23d";
  ctx.font = "600 26px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(input.engine.toUpperCase(), 80, 120);

  ctx.fillStyle = "#f4f4f5";
  ctx.font = "400 76px 'Instrument Serif', Georgia, serif";
  wrap(ctx, input.title, W - 160).forEach((line, i) => ctx.fillText(line, 80, 220 + i * 84));

  if (input.tag) {
    ctx.font = "600 32px ui-monospace, SFMono-Regular, Menlo, monospace";
    const tw = ctx.measureText(input.tag).width;
    ctx.strokeStyle = "rgba(232,162,61,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(80, 400, tw + 48, 60, 30);
    ctx.stroke();
    ctx.fillStyle = "#f0b862";
    ctx.fillText(input.tag, 104, 441);
  }

  const peaks = input.peaks && input.peaks.length ? input.peaks : null;
  if (peaks) {
    const top = 520;
    const h = 220;
    const n = peaks.length;
    const step = (W - 160) / n;
    ctx.fillStyle = "#e8a23d";
    peaks.forEach((p, i) => {
      const bh = Math.max(3, p * h);
      ctx.fillRect(80 + i * step, top + (h - bh) / 2, Math.max(2, step * 0.6), bh);
    });
  }

  ctx.font = "500 28px ui-sans-serif, system-ui, sans-serif";
  let x = 80;
  const y = 830;
  for (const s of input.stems) {
    const w = ctx.measureText(s).width + 40;
    if (x + w > W - 80) break;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(x, y - 38, w, 56, 12);
    ctx.fill();
    ctx.fillStyle = "#d4d4d8";
    ctx.fillText(s, x + 20, y);
    x += w + 14;
  }

  ctx.fillStyle = "#e8a23d";
  [0, 1, 2, 3].forEach((i) => ctx.fillRect(80 + (i % 2) * 14, 960 + i * 11, 34 - (i % 2) * 14, 7));
  ctx.fillStyle = "#f4f4f5";
  ctx.font = "600 34px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("AudioForges", 136, 1000);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "400 26px ui-sans-serif, system-ui, sans-serif";
  const url = "audioforges.com";
  ctx.fillText(url, W - 80 - ctx.measureText(url).width, 1000);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export async function shareOrDownload(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return;
    } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}