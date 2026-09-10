export function SeparationDiagram() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
        <svg viewBox="0 0 300 120" className="h-auto w-full" role="img" aria-label="Center-channel filter: subtracts one channel from the other">
          <g fill="none" stroke="var(--graphite-600)" strokeWidth="1.5">
            <rect x="12" y="22" width="60" height="26" rx="6" />
            <rect x="12" y="72" width="60" height="26" rx="6" />
            <path d="M72 35h40M72 85h40" />
            <circle cx="130" cy="60" r="16" />
            <path d="M112 35q18 0 18 12M112 85q18 0 18-12" />
            <path d="M146 60h40" />
            <rect x="186" y="44" width="100" height="32" rx="6" strokeDasharray="4 3" />
          </g>
          <path d="M122 60h16" stroke="var(--graphite-100)" strokeWidth="2" />
          <g fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-sans)">
            <text x="42" y="39" textAnchor="middle">Left</text>
            <text x="42" y="89" textAnchor="middle">Right</text>
            <text x="236" y="64" textAnchor="middle">Whatever is not centred</text>
          </g>
          <g stroke="var(--graphite-600)" strokeWidth="1" opacity="0.7">
            {[196, 210, 224, 238, 252, 266].map((x, i) => (
              <path key={x} d={`M${x} ${60 - (i % 2 ? 4 : 7)}v${i % 2 ? 8 : 14}`} />
            ))}
          </g>
        </svg>
        <figcaption className="mt-3 text-sm leading-relaxed text-text-muted">
          <span className="font-medium text-text-primary">Center-channel filter.</span> Subtracts one side from
          the other. The vocal goes, but so does the kick, snare and bass, and anything not dead-centre stays.
        </figcaption>
      </figure>

      <figure className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
        <svg viewBox="0 0 300 120" className="h-auto w-full" role="img" aria-label="AI source separation: the model rebuilds each source">
          <g fill="none" stroke="var(--graphite-600)" strokeWidth="1.5">
            <rect x="12" y="47" width="60" height="26" rx="6" />
            <path d="M72 60h34" />
            <path d="M176 60h20q10 0 10-10V38h10M176 60h20q10 0 10 10v12h10" />
            <rect x="216" y="24" width="72" height="26" rx="6" />
            <rect x="216" y="70" width="72" height="26" rx="6" />
          </g>
          <rect x="106" y="34" width="70" height="52" rx="8" fill="none" stroke="var(--amber-500)" strokeWidth="1.5" />
          <g stroke="var(--amber-500)" strokeWidth="1.2" opacity="0.8">
            {[118, 128, 138, 148, 158].map((x, i) => (
              <path key={x} d={`M${x} ${60 - [6, 12, 18, 10, 7][i]}v${[12, 24, 36, 20, 14][i]}`} />
            ))}
          </g>
          <g fill="var(--text-muted)" fontSize="11" fontFamily="var(--font-sans)">
            <text x="42" y="64" textAnchor="middle">Mix</text>
            <text x="141" y="102" textAnchor="middle" fill="var(--amber-400)">
              RoFormer / Demucs
            </text>
          </g>
          <g fill="var(--text-primary)" fontSize="11" fontFamily="var(--font-sans)">
            <text x="252" y="41" textAnchor="middle">Vocals</text>
            <text x="252" y="87" textAnchor="middle">Instrumental</text>
          </g>
        </svg>
        <figcaption className="mt-3 text-sm leading-relaxed text-text-muted">
          <span className="font-medium text-text-primary">AI source separation.</span> The model has learned what a
          voice sounds like against instruments and rebuilds each one, wherever it sits in the stereo field.
        </figcaption>
      </figure>
    </div>
  );
}