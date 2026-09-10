export function ChannelDiagram() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
        <svg viewBox="0 0 300 130" className="h-auto w-full" role="img" aria-label="Stereo to mono: left and right are combined into one channel">
          <g fill="none" stroke="var(--graphite-600)" strokeWidth="1.5">
            <rect x="12" y="20" width="70" height="26" rx="6" />
            <rect x="12" y="84" width="70" height="26" rx="6" />
            <path d="M82 33h30q12 0 12 12v8M82 97h30q12 0 12-12v-8" />
            <path d="M124 65h40" />
          </g>
          <rect x="164" y="52" width="120" height="26" rx="6" fill="var(--amber-500)" opacity="0.85" />
          <g fontFamily="var(--font-sans)" fontSize="11">
            <text x="47" y="37" textAnchor="middle" fill="var(--text-muted)">Left</text>
            <text x="47" y="101" textAnchor="middle" fill="var(--text-muted)">Right</text>
            <text x="224" y="69" textAnchor="middle" fontWeight="600" fill="var(--graphite-950)">One channel</text>
          </g>
          {/* Width that does not survive */}
          <g stroke="var(--graphite-600)" strokeWidth="1" strokeDasharray="2 2" opacity="0.8">
            <path d="M12 12q35 -8 70 0" />
            <path d="M12 118q35 8 70 0" />
          </g>
          <text x="47" y="9" textAnchor="middle" fontSize="8" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
            width, panning
          </text>
          <text x="47" y="127" textAnchor="middle" fontSize="8" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
            dropped
          </text>
        </svg>
        <figcaption className="mt-3 text-sm leading-relaxed text-text-muted">
          <span className="font-medium text-text-primary">Stereo to mono.</span> Left and right are combined into one
          signal. Anything panned to a side folds to the centre, wide effects collapse, and anything that was
          out of phase between the two sides partly cancels. This is a real change to the sound, not a format
          detail.
        </figcaption>
      </figure>

      <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
        <svg viewBox="0 0 300 130" className="h-auto w-full" role="img" aria-label="Mono to stereo: the single channel is copied to both sides">
          <rect x="12" y="52" width="100" height="26" rx="6" fill="var(--amber-500)" opacity="0.85" />
          <g fill="none" stroke="var(--graphite-600)" strokeWidth="1.5">
            <path d="M112 65h30q12 0 12-12v-8M112 65h30q12 0 12 12v8" />
            <rect x="154" y="20" width="130" height="26" rx="6" />
            <rect x="154" y="84" width="130" height="26" rx="6" />
          </g>
          <g fontFamily="var(--font-sans)" fontSize="11">
            <text x="62" y="69" textAnchor="middle" fontWeight="600" fill="var(--graphite-950)">Mono</text>
            <text x="219" y="37" textAnchor="middle" fill="var(--text-muted)">Left, identical copy</text>
            <text x="219" y="101" textAnchor="middle" fill="var(--text-muted)">Right, identical copy</text>
          </g>
          <text x="219" y="70" textAnchor="middle" fontSize="9" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
            = same as before, in two channels
          </text>
        </svg>
        <figcaption className="mt-3 text-sm leading-relaxed text-text-muted">
          <span className="font-medium text-text-primary">Mono to stereo.</span> The one channel is copied to both
          sides. It satisfies a two-channel requirement and sounds exactly as it did; no width is invented, because
          there was never anything to separate.
        </figcaption>
      </figure>
    </div>
  );
}