const MARKS = [
  { at: -23, label: "-23 LUFS", note: "Broadcast, EBU R128" },
  { at: -14, label: "-14 LUFS", note: "Spotify, YouTube, Apple Music" },
  { at: -9, label: "-9 LUFS", note: "Club masters" },
  { at: 0, label: "0 dBFS", note: "Digital ceiling. Past this it clips" },
];

const MIN = -40;
const MAX = 3;

function x(v: number) {
  return 80 + ((v - MIN) / (MAX - MIN)) * 520;
}

/**
 * One horizontal loudness ruler. `mode` picks which story the caption tells:
 * "gain" is the volume booster (a flat shift that can run into the ceiling),
 * "loudnorm" is the normalizer (measured, then moved to a target).
 */
export function LoudnessScale({ mode }: { mode: "gain" | "loudnorm" }) {
  return (
    <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
      <svg viewBox="0 0 640 150" className="h-auto w-full" role="img" aria-label="Loudness scale from -40 to 0 dBFS with the common targets marked">
        {/* Ruler */}
        <rect x={x(MIN)} y="70" width={x(0) - x(MIN)} height="10" rx="2" fill="var(--graphite-800)" />
        <rect x={x(0)} y="70" width={x(MAX) - x(0)} height="10" rx="2" fill="rgba(248,113,113,0.45)" />
        {[-40, -30, -20, -10, 0].map((t) => (
          <g key={t}>
            <line x1={x(t)} y1="82" x2={x(t)} y2="88" stroke="var(--graphite-600)" />
            <text x={x(t)} y="102" textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
              {t}
            </text>
          </g>
        ))}

        {/* Targets */}
        {MARKS.map((m, i) => {
          const isCeiling = m.at === 0;
          const above = i % 2 === 0;
          return (
            <g key={m.at}>
              <line x1={x(m.at)} y1={above ? 40 : 82} x2={x(m.at)} y2={above ? 70 : 110} stroke={isCeiling ? "rgb(248 113 113)" : "var(--amber-500)"} strokeWidth="1.5" />
              <circle cx={x(m.at)} cy="75" r="3.5" fill={isCeiling ? "rgb(248 113 113)" : "var(--amber-500)"} />
              <text x={x(m.at)} y={above ? 30 : 126} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-sans)" fill={isCeiling ? "rgb(248 113 113)" : "var(--amber-400)"}>
                {m.label}
              </text>
              <text x={x(m.at)} y={above ? 16 : 140} textAnchor="middle" fontSize="9" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
                {m.note}
              </text>
            </g>
          );
        })}

        {mode === "gain" && (
          <g>
            <rect x={x(-28)} y="52" width={x(-19) - x(-28)} height="6" rx="1.5" fill="var(--graphite-600)" />
            <path d={`M${x(-19)} 55 h${x(-1) - x(-19)}`} stroke="var(--text-primary)" strokeWidth="1" strokeDasharray="2 3" />
            <rect x={x(-10)} y="52" width={x(-1) - x(-10)} height="6" rx="1.5" fill="var(--amber-500)" />
            <text x={x(-23.5)} y="48" textAnchor="middle" fontSize="9" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
              quiet file
            </text>
            <text x={x(-5.5)} y="48" textAnchor="middle" fontSize="9" fontFamily="var(--font-sans)" fill="var(--amber-400)">
              +18 dB, 1 dB of headroom left
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-3 text-sm leading-relaxed text-text-muted">
        {mode === "gain"
          ? "Gain moves the whole file up or down by the same amount. The loudest peak moves with it, and the ceiling does not move at all, so the question is never how loud you want it, it is how much room the loudest point has left. This page measures that peak before you press anything."
          : "A normalizer does not add a fixed amount. It measures how loud the file already is in LUFS, the perceived-loudness unit streaming services use, then moves it to the target. Two quiet files and one loud one all land at the same number."}
      </figcaption>
    </figure>
  );
}