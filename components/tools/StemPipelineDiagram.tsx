export function StemPipelineDiagram() {
  return (
    <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
      <svg viewBox="0 0 620 150" className="h-auto w-full" role="img" aria-label="Studio Quality pipeline: RoFormer pulls the vocal, then htdemucs_ft splits the rest">
        <g fill="none" stroke="var(--graphite-600)" strokeWidth="1.5">
          <rect x="8" y="62" width="54" height="26" rx="6" />
          <path d="M62 75h34" />
          <path d="M186 75h18q10 0 10-10V30h14" />
          <path d="M186 75h18q10 0 10 8v8h14" />
          <path d="M382 91h18q10 0 10-10V22h14M382 91h18q10 0 10 0h14M382 91h18q10 0 10 10v28h14" />
        </g>

        <rect x="96" y="49" width="90" height="52" rx="8" fill="none" stroke="var(--amber-500)" strokeWidth="1.5" />
        <g stroke="var(--amber-500)" strokeWidth="1.2" opacity="0.85">
          {[112, 124, 136, 148, 160, 172].map((x, i) => (
            <path key={x} d={`M${x} ${75 - [5, 11, 17, 14, 8, 5][i]}v${[10, 22, 34, 28, 16, 10][i]}`} />
          ))}
        </g>

        <rect x="292" y="65" width="90" height="52" rx="8" fill="none" stroke="var(--graphite-600)" strokeWidth="1.5" />
        <g stroke="var(--graphite-500)" strokeWidth="1.2">
          {[308, 320, 332, 344, 356, 368].map((x, i) => (
            <path key={x} d={`M${x} ${91 - [4, 9, 15, 12, 7, 4][i]}v${[8, 18, 30, 24, 14, 8][i]}`} />
          ))}
        </g>

        <g fill="none" stroke="var(--graphite-600)" strokeWidth="1.5">
          <rect x="242" y="34" width="50" height="24" rx="6" />
          <path d="M292 46h0" />
        </g>

        <g fill="none" stroke="var(--amber-500)" strokeWidth="1.5">
          <rect x="434" y="10" width="86" height="24" rx="6" />
        </g>
        <g fill="none" stroke="var(--graphite-600)" strokeWidth="1.5">
          <rect x="434" y="79" width="86" height="24" rx="6" />
          <rect x="434" y="117" width="86" height="24" rx="6" />
          <rect x="434" y="41" width="86" height="24" rx="6" />
        </g>

        <g fontFamily="var(--font-sans)" fontSize="11">
          <text x="35" y="79" textAnchor="middle" fill="var(--text-muted)">Mix</text>
          <text x="141" y="125" textAnchor="middle" fill="var(--amber-400)">MelBand RoFormer</text>
          <text x="337" y="141" textAnchor="middle" fill="var(--text-subtle)">htdemucs_ft</text>
          <text x="267" y="50" textAnchor="middle" fill="var(--text-subtle)">Rest</text>
          <text x="477" y="26" textAnchor="middle" fill="var(--amber-400)">Vocals</text>
          <text x="477" y="57" textAnchor="middle" fill="var(--text-primary)">Drums</text>
          <text x="477" y="95" textAnchor="middle" fill="var(--text-primary)">Bass</text>
          <text x="477" y="133" textAnchor="middle" fill="var(--text-primary)">Other</text>
        </g>
      </svg>
      <figcaption className="mt-4 text-sm leading-relaxed text-text-muted">
        Studio Quality runs two stages. RoFormer takes the vocal out first, then htdemucs_ft splits what is left into
        drums, bass and other. Separating the rest with the voice already gone is what makes all four stems cleaner,
        and it is where the extra minute goes. Standard does it in one pass with htdemucs at 0.25 overlap.
      </figcaption>
    </figure>
  );
}