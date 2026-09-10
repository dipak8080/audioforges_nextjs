interface Props {
  /** Label and bar width (0–620) for the delivered file. */
  outputLabel: string;
  outputWidth: number;
  /** Small line beside the ceiling marker. */
  ceilingNote?: string;
  caption: string;
}

export function BitrateChainDiagram({
  outputLabel,
  outputWidth,
  ceilingNote = "nothing past this line was ever sent",
  caption,
}: Props) {
  return (
    <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
      <svg
        viewBox="0 0 640 170"
        className="h-auto w-full"
        role="img"
        aria-label={`Signal chain: the studio master, what YouTube serves at roughly 130 to 160 kbps, and ${outputLabel}`}
      >
        <g fontFamily="var(--font-sans)" fontSize="11">
          <text x="0" y="22" fill="var(--text-muted)">Studio master</text>
          <rect x="0" y="30" width="620" height="14" rx="3" fill="var(--graphite-800)" />
          <rect x="0" y="30" width="620" height="14" rx="3" fill="none" stroke="var(--graphite-600)" strokeDasharray="3 3" />
          <text x="620" y="22" textAnchor="end" fill="var(--text-subtle)">lossless</text>

          <text x="0" y="74" fill="var(--text-muted)">What YouTube serves you</text>
          <rect x="0" y="82" width="620" height="14" rx="3" fill="var(--graphite-800)" />
          <rect x="0" y="82" width="140" height="14" rx="3" fill="var(--amber-500)" opacity="0.55" />
          <text x="620" y="74" textAnchor="end" fill="var(--amber-400)">Opus, about 130 to 160 kbps</text>

          <text x="0" y="126" fill="var(--text-muted)">The file you download</text>
          <rect x="0" y="134" width="620" height="14" rx="3" fill="var(--graphite-800)" />
          <rect x="0" y="134" width={outputWidth} height="14" rx="3" fill="var(--amber-500)" />
          <text x="620" y="126" textAnchor="end" fill="var(--amber-400)">{outputLabel}</text>
        </g>

        <line x1="140" y1="82" x2="140" y2="160" stroke="var(--text-primary)" strokeWidth="1" strokeDasharray="2 3" />
        <text x="146" y="164" fontFamily="var(--font-sans)" fontSize="10" fill="var(--text-subtle)">
          {ceilingNote}
        </text>
      </svg>
      <figcaption className="mt-4 text-sm leading-relaxed text-text-muted">{caption}</figcaption>
    </figure>
  );
}