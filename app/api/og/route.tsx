import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const GRAPHITE_950 = "#0f0f11";
const GRAPHITE_800 = "#232326";
const AMBER_500 = "#e8a23d";
const TEXT_PRIMARY = "#f2f1ee";
const TEXT_MUTED = "#9a968d";
const TEXT_SUBTLE = "#8f8a80";

const COLUMNS = 64;
const STRIP_HEIGHT = 124;

/** Deterministic per title, so a tool's card never changes between shares
 *  while no two tools look alike. */
function envelope(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };

  // Two slow sines at unrelated rates give the loud and quiet passages a
  // track actually has. Without them every column lands in the same band
  // and the strip reads as a barcode rather than as audio.
  const phase = rand() * Math.PI * 2;
  const phase2 = rand() * Math.PI * 2;

  return Array.from({ length: COLUMNS }, (_, i) => {
    const t = i / (COLUMNS - 1);
    const fade = Math.min(1, Math.sin(Math.PI * t) * 2.2);
    const section =
      0.55 + 0.3 * Math.sin(t * 7.4 + phase) + 0.15 * Math.sin(t * 19.1 + phase2);
    const level = Math.max(0.08, fade * section);

    const peak = Math.min(1, level * (0.85 + rand() * 0.45));
    // RMS tracks the peak closely — on real material the core follows the
    // halo, it doesn't wander independently.
    const rms = peak * (0.5 + rand() * 0.22);
    return { peak, rms };
  });
}

type FontData = { name: string; data: ArrayBuffer | Buffer; weight: 400 | 700; style: "normal" };

/**
 * Two loaders because the working one differs by Next version and by
 * runtime. Filesystem first (reliable in dev and on the Node runtime),
 * then the bundler-traced URL form from Next's own docs.
 *
 * Needs STATIC .ttf files — satori can't read a variable font or an .otf:
 *   app/api/og/fonts/Geist-Regular.ttf
 *   app/api/og/fonts/Geist-Bold.ttf
 */
async function loadFonts(): Promise<FontData[] | undefined> {
  const build = (regular: ArrayBuffer | Buffer, bold: ArrayBuffer | Buffer): FontData[] => [
    { name: "Geist", data: regular, weight: 400, style: "normal" },
    { name: "Geist", data: bold, weight: 700, style: "normal" },
  ];

  try {
    const dir = join(process.cwd(), "app/api/og/fonts");
    const [regular, bold] = await Promise.all([
      readFile(join(dir, "Geist-Regular.ttf")),
      readFile(join(dir, "Geist-Bold.ttf")),
    ]);
    return build(regular, bold);
  } catch (fsError) {
    try {
      const [regular, bold] = await Promise.all([
        fetch(new URL("./fonts/Geist-Regular.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
        fetch(new URL("./fonts/Geist-Bold.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
      ]);
      return build(regular, bold);
    } catch (urlError) {
      console.error(
        "[og] Geist not loaded — falling back to the built-in face, which has one weight.\n" +
          "     Expected: app/api/og/fonts/Geist-Regular.ttf and Geist-Bold.ttf (static .ttf, not variable, not .otf)\n" +
          "     fs:  ",
        fsError,
        "\n     url: ",
        urlError
      );
      return undefined;
    }
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") || "AudioForges").slice(0, 70);
  const subtitle = (searchParams.get("subtitle") || "Free browser-based audio tools").slice(0, 120);
  const badge = (searchParams.get("badge") || "Free · No sign-up").slice(0, 40);

  const bars = envelope(title);
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: GRAPHITE_950,
          padding: "56px 64px",
          fontFamily: "Geist, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"
              stroke={AMBER_500}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              marginLeft: 14,
              color: TEXT_PRIMARY,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: -0.6,
            }}
          >
            AudioForges
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: 18,
              padding: "7px 16px",
              borderRadius: 999,
              border: `1px solid ${GRAPHITE_800}`,
              color: TEXT_SUBTLE,
              fontSize: 18,
              letterSpacing: 1.6,
              textTransform: "uppercase",
            }}
          >
            {badge}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 1000 }}>
          <div
            style={{
              color: TEXT_PRIMARY,
              fontSize: title.length > 34 ? 68 : 84,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -3,
            }}
          >
            {title}
          </div>
          <div style={{ color: TEXT_MUTED, fontSize: 29, marginTop: 22, lineHeight: 1.35 }}>
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Peak as a dim halo, RMS as the bright core — the treatment
              WaveformCanvas uses on the site. */}
          <div style={{ display: "flex", alignItems: "center", height: STRIP_HEIGHT }}>
            {bars.map((b, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 11,
                  marginRight: 6,
                  height: Math.max(3, Math.round(b.peak * STRIP_HEIGHT)),
                  borderRadius: 2,
                  background: "rgba(232, 162, 61, 0.24)",
                }}
              >
                <div
                  style={{
                    width: 11,
                    height: Math.max(2, Math.round(b.rms * STRIP_HEIGHT)),
                    borderRadius: 2,
                    background: AMBER_500,
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ color: TEXT_SUBTLE, fontSize: 23, marginTop: 26 }}>audioforges.com</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        "cache-control": "public, immutable, no-transform, max-age=31536000",
      },
    }
  );
}