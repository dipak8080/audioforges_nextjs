import { cn } from "@/lib/utils/cn";

/**
 * A hand-drawn engraved grand staff — the product, shown before you upload.
 *
 * Not a screenshot and not a font: pure SVG so it stays crisp at any size,
 * ships zero bytes of image, and inherits its ink from `currentColor`. That
 * last part is the whole reason it's one component and not two — on the white
 * "sheet of paper" hero it's near-black ink (text-graphite-900); as a faint
 * watermark behind a section it's text-graphite-700 at low opacity. Same
 * drawing, two jobs.
 *
 * It rhymes on purpose with SheetResultPanel's real Verovio preview: the same
 * white card, the same amber-edged glow. The score you're promised at the top
 * of the page and the score you get at the bottom look like the same object.
 *
 * Decorative — always aria-hidden. The surrounding copy carries the meaning.
 * The excerpt is a two-hand phrase in G major (one sharp), the key from the
 * backend's own proven example.
 */

const TREB = [40, 52, 64, 76, 88];
const BASS = [148, 160, 172, 184, 196];
const LEFT = 54;
const RIGHT = 610;
const STEM = 34;

// Treble melody: three beamed groups across three bars.
const TREB_BEAMS: { notes: [number, number][]; double?: boolean }[] = [
  { notes: [[150, 88], [172, 76], [194, 64], [216, 58]] },
  { notes: [[300, 70], [322, 58], [344, 52]] },
  { notes: [[470, 46], [492, 52], [514, 58], [536, 52], [558, 46]], double: true },
];
const TREB_HALF: [number, number] = [400, 64];

// Bass: chord, open note, walking line, one below the staff on a ledger.
const BASS_NOTES: { x: number; y: number; open?: boolean; ledger?: boolean }[] = [
  { x: 150, y: 184 }, { x: 230, y: 160, open: true }, { x: 320, y: 172 },
  { x: 400, y: 184 }, { x: 500, y: 208, ledger: true }, { x: 560, y: 196 },
];

export function EngravedScore({
  className,
  glow = false,
}: {
  className?: string;
  /** Wrap in the white amber-edged "sheet of paper" card that matches the
   *  result panel. Off = bare ink, for use as a faint watermark. */
  glow?: boolean;
}) {
  const svg = (
    <svg
      viewBox="0 0 660 236"
      role="img"
      aria-hidden
      className="block w-full text-graphite-900"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* staves */}
      {[...TREB, ...BASS].map((y) => (
        <line key={`s${y}`} x1={LEFT} y1={y} x2={RIGHT} y2={y} stroke="currentColor" strokeOpacity={0.72} strokeWidth={1} />
      ))}

      {/* system left barline + brace */}
      <line x1={LEFT} y1={TREB[0]} x2={LEFT} y2={BASS[4]} stroke="currentColor" strokeOpacity={0.72} />
      <path d="M40 40 C 30 62, 46 84, 34 118 C 46 152, 30 174, 40 196" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />

      {/* treble clef */}
      <g stroke="currentColor" strokeWidth={2.3} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M78 100 C 96 96, 100 78, 90 70 C 80 62, 66 68, 66 82 C 66 100, 92 108, 96 84 C 100 58, 78 44, 74 34 C 71 26, 74 18, 82 18 C 90 18, 92 28, 86 34" />
        <line x1={82} y1={20} x2={76} y2={104} />
      </g>
      <circle cx={75.5} cy={110} r={3.4} fill="currentColor" />

      {/* bass clef */}
      <path d="M64 150 C 78 146, 86 156, 86 168 C 86 184, 72 196, 60 200" fill="none" stroke="currentColor" strokeWidth={4.2} strokeLinecap="round" />
      <circle cx={66} cy={150.5} r={4.4} fill="currentColor" />
      <circle cx={95} cy={160} r={2.4} fill="currentColor" />
      <circle cx={95} cy={172} r={2.4} fill="currentColor" />

      {/* key signature — one sharp (G major) */}
      <g stroke="currentColor" strokeLinecap="round">
        <line x1={96} y1={31} x2={96} y2={46} strokeWidth={1.4} />
        <line x1={101} y1={29} x2={101} y2={44} strokeWidth={1.4} />
        <line x1={93} y1={37} x2={104} y2={35} strokeWidth={2.4} />
        <line x1={93} y1={43} x2={104} y2={41} strokeWidth={2.4} />
      </g>

      {/* time signature */}
      {[TREB, BASS].map((st, i) => (
        <g key={`t${i}`} fill="currentColor" fontFamily="Georgia, serif" fontWeight={700} fontSize={26} textAnchor="middle">
          <text x={126} y={st[1] + 5}>4</text>
          <text x={126} y={st[3] + 5}>4</text>
        </g>
      ))}

      {/* treble beamed groups */}
      {TREB_BEAMS.map((g, gi) => {
        const first = g.notes[0];
        const last = g.notes[g.notes.length - 1];
        return (
          <g key={`b${gi}`}>
            {g.notes.map(([cx, cy], i) => (
              <g key={i}>
                <g transform={`rotate(-20 ${cx} ${cy})`}>
                  <ellipse cx={cx} cy={cy} rx={7.2} ry={5.1} fill="currentColor" />
                </g>
                <line x1={cx + 6.4} y1={cy} x2={cx + 6.4} y2={cy - STEM} stroke="currentColor" strokeWidth={1.7} />
              </g>
            ))}
            <line x1={first[0] + 6.4} y1={first[1] - STEM} x2={last[0] + 6.4} y2={last[1] - STEM} stroke="currentColor" strokeWidth={4.2} />
            {g.double && (
              <line x1={first[0] + 6.4} y1={first[1] - STEM + 6} x2={last[0] + 6.4} y2={last[1] - STEM + 6} stroke="currentColor" strokeWidth={3.4} />
            )}
          </g>
        );
      })}

      {/* treble half note */}
      <g transform={`rotate(-20 ${TREB_HALF[0]} ${TREB_HALF[1]})`}>
        <ellipse cx={TREB_HALF[0]} cy={TREB_HALF[1]} rx={7.2} ry={5.1} fill="none" stroke="currentColor" strokeWidth={2.1} />
      </g>
      <line x1={TREB_HALF[0] + 6.4} y1={TREB_HALF[1]} x2={TREB_HALF[0] + 6.4} y2={TREB_HALF[1] - STEM} stroke="currentColor" strokeWidth={1.7} />

      {/* bass notes */}
      {BASS_NOTES.map((n, i) => (
        <g key={`bn${i}`}>
          {n.ledger && <line x1={n.x - 11} y1={n.y} x2={n.x + 11} y2={n.y} stroke="currentColor" strokeWidth={1.1} />}
          <g transform={`rotate(-20 ${n.x} ${n.y})`}>
            <ellipse cx={n.x} cy={n.y} rx={7.2} ry={5.1} fill={n.open ? "none" : "currentColor"} stroke="currentColor" strokeWidth={n.open ? 2.1 : 0} />
          </g>
          <line x1={n.ledger ? n.x + 6.4 : n.x - 6.4} y1={n.y} x2={n.ledger ? n.x + 6.4 : n.x - 6.4} y2={n.ledger ? n.y - STEM : n.y + STEM} stroke="currentColor" strokeWidth={1.7} />
        </g>
      ))}
      {/* bass chord second head */}
      <g transform="rotate(-20 150 172)">
        <ellipse cx={150} cy={172} rx={7.2} ry={5.1} fill="currentColor" />
      </g>

      {/* barlines + final */}
      {[280, 430].map((x) => (
        <g key={`bl${x}`}>
          <line x1={x} y1={TREB[0]} x2={x} y2={TREB[4]} stroke="currentColor" strokeOpacity={0.72} />
          <line x1={x} y1={BASS[0]} x2={x} y2={BASS[4]} stroke="currentColor" strokeOpacity={0.72} />
        </g>
      ))}
      {[[RIGHT - 5, 1], [RIGHT, 3]].map(([x, w]) => (
        <g key={`fin${x}`}>
          <line x1={x} y1={TREB[0]} x2={x} y2={TREB[4]} stroke="currentColor" strokeWidth={w} />
          <line x1={x} y1={BASS[0]} x2={x} y2={BASS[4]} stroke="currentColor" strokeWidth={w} />
        </g>
      ))}
    </svg>
  );

  if (!glow) return <div className={className}>{svg}</div>;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-amber-500/30 bg-white px-5 py-6 shadow-[0_8px_40px_-12px_rgba(232,162,61,0.35)] sm:px-8 sm:py-8",
        className
      )}
    >
      {svg}
    </div>
  );
}