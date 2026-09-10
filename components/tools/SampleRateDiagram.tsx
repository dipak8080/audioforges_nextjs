const RATES = [
  { rate: "22.05 kHz", ceiling: 11.025, width: 0.23, note: "speech, old game audio" },
  { rate: "44.1 kHz", ceiling: 22.05, width: 0.46, note: "CD, streaming, most music" },
  { rate: "48 kHz", ceiling: 24, width: 0.5, note: "video, broadcast" },
  { rate: "96 kHz", ceiling: 48, width: 1, note: "headroom for heavy processing" },
];

const HEARING = 20 / 48;

/**
 * Four bars scaled to the highest frequency each rate can represent (half
 * the rate, the Nyquist limit), with the edge of human hearing drawn across
 * them. The picture makes two things obvious that the prose used to argue:
 * upsampling cannot add anything, and everything from 44.1 up already covers
 * what an ear can reach.
 */
export function SampleRateDiagram() {
  const W = 620;
  return (
    <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
      <svg viewBox="0 0 640 200" className="h-auto w-full" role="img" aria-label="Highest frequency each sample rate can represent, against the limit of human hearing">
        <g fontFamily="var(--font-sans)" fontSize="11">
          {RATES.map((r, i) => {
            const y = 16 + i * 42;
            return (
              <g key={r.rate}>
                <text x="0" y={y + 6} fill="var(--text-muted)">{r.rate}</text>
                <text x="0" y={y + 20} fontSize="9" fill="var(--text-subtle)">{r.note}</text>
                <rect x="120" y={y} width={W - 120} height="14" rx="3" fill="var(--graphite-800)" />
                <rect
                  x="120"
                  y={y}
                  width={(W - 120) * r.width}
                  height="14"
                  rx="3"
                  fill="var(--amber-500)"
                  opacity={r.width >= HEARING ? 0.85 : 0.45}
                />
                <text x={W} y={y + 11} textAnchor="end" fontSize="10" fill="var(--amber-400)">
                  up to {r.ceiling} kHz
                </text>
              </g>
            );
          })}
        </g>
        <line
          x1={120 + (W - 120) * HEARING}
          y1="8"
          x2={120 + (W - 120) * HEARING}
          y2="180"
          stroke="var(--text-primary)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <text
          x={120 + (W - 120) * HEARING + 6}
          y="190"
          fontFamily="var(--font-sans)"
          fontSize="10"
          fill="var(--text-subtle)"
        >
          20 kHz, the top of human hearing
        </text>
      </svg>
      <figcaption className="mt-4 text-sm leading-relaxed text-text-muted">
        A sample rate can represent frequencies up to half its value and nothing above. Everything from 44.1 kHz up
        already clears the top of hearing, so converting upward adds no detail: the new samples are computed from
        the old ones. Converting downward throws away the band above the new ceiling, which for 48 to 44.1 is a
        region nobody can hear, provided the resampler filters it properly rather than folding it back as aliasing.
      </figcaption>
    </figure>
  );
}