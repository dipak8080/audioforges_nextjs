import { cn } from "@/lib/utils/cn";

const CX = 210;
const CY = 210;
const R_OUT = 200;
const R_MID = 148;
const R_IN = 92;
const SEG = 360 / 12;

/** Camelot number → [minor key (A), major key (B)]. */
const KEYS: [string, string][] = [
  ["A♭m", "B"],
  ["E♭m", "F♯"],
  ["B♭m", "D♭"],
  ["Fm", "A♭"],
  ["Cm", "E♭"],
  ["Gm", "B♭"],
  ["Dm", "F"],
  ["Am", "C"],
  ["Em", "G"],
  ["Bm", "D"],
  ["F♯m", "A"],
  ["D♭m", "E"],
];

function pt(angleDeg: number, r: number) {
  // 12 o'clock is Camelot 12's centre, so shift back half a segment and a quarter turn.
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
}

function segPath(index: number, rInner: number, rOuter: number) {
  const start = index * SEG - SEG / 2;
  const end = start + SEG;
  const [x1, y1] = pt(start, rOuter);
  const [x2, y2] = pt(end, rOuter);
  const [x3, y3] = pt(end, rInner);
  const [x4, y4] = pt(start, rInner);
  return [
    `M${x1.toFixed(1)} ${y1.toFixed(1)}`,
    `A${rOuter} ${rOuter} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    `L${x3.toFixed(1)} ${y3.toFixed(1)}`,
    `A${rInner} ${rInner} 0 0 0 ${x4.toFixed(1)} ${y4.toFixed(1)}`,
    "Z",
  ].join(" ");
}

/**
 * `highlight` is a Camelot code like "8A". Its three compatible neighbours
 * (same number other letter, one up, one down) are drawn as the second tier,
 * which is the whole rule the wheel exists to encode.
 */
export function CamelotWheel({
  highlight = "8A",
  className,
}: {
  highlight?: string;
  className?: string;
}) {
  const num = parseInt(highlight, 10);
  const letter = highlight.slice(-1).toUpperCase();
  const up = (num % 12) + 1;
  const down = ((num + 10) % 12) + 1;
  const compatible = new Set([`${up}${letter}`, `${down}${letter}`, `${num}${letter === "A" ? "B" : "A"}`]);

  const highlightName = letter === "A" ? KEYS[num - 1][0] : KEYS[num - 1][1];

  return (
    <figure className={cn("rounded-xl border border-graphite-800 bg-graphite-900 p-5", className)}>
      <svg viewBox="0 0 420 420" className="mx-auto h-auto w-full max-w-md" role="img" aria-label={`Camelot wheel with ${highlight} and its compatible keys marked`}>
        {KEYS.map(([minor, major], i) => {
          const n = i + 1;
          // Index 0 sits at 12 o'clock and holds Camelot 12, so shift by one.
          const slot = i;
          const codeB = `${n}B`;
          const codeA = `${n}A`;
          const rows: [string, string, number, number][] = [
            [codeB, major, R_MID, R_OUT],
            [codeA, minor, R_IN, R_MID],
          ];
          return rows.map(([code, name, rIn, rOut]) => {
            const isHi = code === highlight;
            const isOk = compatible.has(code);
            const [tx, ty] = pt(slot * SEG, (rIn + rOut) / 2);
            return (
              <g key={code}>
                <path
                  d={segPath(slot, rIn, rOut)}
                  fill={isHi ? "var(--amber-500)" : isOk ? "rgba(232,162,61,0.16)" : "var(--graphite-850)"}
                  stroke="var(--graphite-950)"
                  strokeWidth="1.5"
                />
                <text
                  x={tx}
                  y={ty - 3}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fontFamily="var(--font-sans)"
                  fill={isHi ? "var(--graphite-950)" : isOk ? "var(--amber-300)" : "var(--text-muted)"}
                >
                  {code}
                </text>
                <text
                  x={tx}
                  y={ty + 11}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--font-sans)"
                  fill={isHi ? "rgba(15,15,17,0.7)" : "var(--text-subtle)"}
                >
                  {name}
                </text>
              </g>
            );
          });
        })}

        <circle cx={CX} cy={CY} r={R_IN - 6} fill="var(--graphite-900)" stroke="var(--graphite-800)" strokeWidth="1.5" />
        <text x={CX} y={CY - 8} textAnchor="middle" fontSize="12" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
          Playing
        </text>
        <text x={CX} y={CY + 16} textAnchor="middle" fontSize="24" fontWeight="700" fontFamily="var(--font-sans)" fill="var(--amber-400)">
          {highlight}
        </text>
        <text x={CX} y={CY + 36} textAnchor="middle" fontSize="12" fontFamily="var(--font-sans)" fill="var(--text-muted)">
          {highlightName}
        </text>
      </svg>

      <figcaption className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-text-muted">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-500" aria-hidden />
          Track playing
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-amber-500/20" aria-hidden />
          Mixes cleanly from it
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-graphite-850" aria-hidden />
          Clashes
        </span>
      </figcaption>
    </figure>
  );
}