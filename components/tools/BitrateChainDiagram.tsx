interface Props {
  /** Label, note and bar width (0 to 620) for the file the user starts with. Omit for a lossless source. */
  source?: { label: string; note: string; width: number };
  outputLabel: string;
  outputWidth: number;
  ceilingNote?: string;
  caption: string;
}

export function BitrateChainDiagram({ source, outputLabel, outputWidth, ceilingNote, caption }: Props) {
  const rows = source ? 3 : 2;
  const outY = source ? 126 : 74;
  const height = outY + (source ? 44 : 30);

  return (
    <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
      <svg
        viewBox={`0 0 640 ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Signal chain in ${rows} steps: the studio master${source ? `, ${source.label.toLowerCase()} at ${source.note}` : ""}, and ${outputLabel}`}
      >
        <g fontFamily="var(--font-sans)" fontSize="11">
          <text x="0" y="22" fill="var(--text-muted)">Studio master</text>
          <rect x="0" y="30" width="620" height="14" rx="3" fill="var(--graphite-800)" />
          <rect x="0" y="30" width="620" height="14" rx="3" fill="none" stroke="var(--graphite-600)" strokeDasharray="3 3" />
          <text x="620" y="22" textAnchor="end" fill="var(--text-subtle)">lossless</text>

          {source && (
            <>
              <text x="0" y="74" fill="var(--text-muted)">{source.label}</text>
              <rect x="0" y="82" width="620" height="14" rx="3" fill="var(--graphite-800)" />
              <rect x="0" y="82" width={source.width} height="14" rx="3" fill="var(--amber-500)" opacity="0.55" />
              <text x="620" y="74" textAnchor="end" fill="var(--amber-400)">{source.note}</text>
            </>
          )}

          <text x="0" y={outY} fill="var(--text-muted)">The file you download</text>
          <rect x="0" y={outY + 8} width="620" height="14" rx="3" fill="var(--graphite-800)" />
          <rect x="0" y={outY + 8} width={outputWidth} height="14" rx="3" fill="var(--amber-500)" />
          <text x="620" y={outY} textAnchor="end" fill="var(--amber-400)">{outputLabel}</text>
        </g>

        {source && ceilingNote && (
          <>
            <line x1={source.width} y1="82" x2={source.width} y2="160" stroke="var(--text-primary)" strokeWidth="1" strokeDasharray="2 3" />
            <text x={source.width + 6} y="164" fontFamily="var(--font-sans)" fontSize="10" fill="var(--text-subtle)">
              {ceilingNote}
            </text>
          </>
        )}
      </svg>
      <figcaption className="mt-4 text-sm leading-relaxed text-text-muted">{caption}</figcaption>
    </figure>
  );
}