export function DemuxDiagram({
  containerLabel = "MP4",
  audioCodec = "AAC",
}: {
  containerLabel?: string;
  audioCodec?: string;
}) {
  return (
    <figure className="rounded-xl border border-graphite-800 bg-graphite-900 p-5">
      <svg viewBox="0 0 640 170" className="h-auto w-full" role="img" aria-label={`${containerLabel} container split into its streams; only the audio stream is decoded and written as WAV`}>
        {/* Container */}
        <rect x="8" y="24" width="150" height="122" rx="10" fill="none" stroke="var(--graphite-600)" strokeWidth="1.5" />
        <text x="83" y="16" textAnchor="middle" fontSize="11" fontFamily="var(--font-sans)" fill="var(--text-muted)">
          {containerLabel} container
        </text>

        {/* Streams inside the container */}
        <rect x="22" y="40" width="122" height="24" rx="5" fill="var(--graphite-800)" />
        <text x="83" y="56" textAnchor="middle" fontSize="11" fontFamily="var(--font-sans)" fill="var(--text-muted)">
          Video, H.264
        </text>
        <rect x="22" y="72" width="122" height="24" rx="5" fill="var(--amber-500)" opacity="0.85" />
        <text x="83" y="88" textAnchor="middle" fontSize="11" fontWeight="600" fontFamily="var(--font-sans)" fill="var(--graphite-950)">
          Audio, {audioCodec}
        </text>
        <rect x="22" y="104" width="122" height="24" rx="5" fill="var(--graphite-800)" />
        <text x="83" y="120" textAnchor="middle" fontSize="11" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
          Subtitles, metadata
        </text>

        {/* Paths out */}
        <g fill="none" strokeWidth="1.5">
          <path d="M158 52h60q12 0 12 12v76" stroke="var(--graphite-700)" strokeDasharray="3 3" />
          <path d="M158 116h60q12 0 12 12v12" stroke="var(--graphite-700)" strokeDasharray="3 3" />
          <path d="M158 84h120" stroke="var(--amber-500)" />
          <path d="M398 84h40" stroke="var(--amber-500)" />
        </g>
        <text x="230" y="158" textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
          dropped
        </text>

        {/* Decoder */}
        <rect x="278" y="58" width="120" height="52" rx="8" fill="none" stroke="var(--amber-500)" strokeWidth="1.5" />
        <text x="338" y="79" textAnchor="middle" fontSize="11" fontFamily="var(--font-sans)" fill="var(--amber-400)">
          Decode once
        </text>
        <text x="338" y="96" textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
          to PCM, no resample
        </text>

        {/* Output */}
        <rect x="438" y="48" width="194" height="72" rx="8" fill="var(--amber-500)" opacity="0.12" stroke="var(--amber-500)" strokeWidth="1.5" />
        <text x="535" y="74" textAnchor="middle" fontSize="12" fontWeight="600" fontFamily="var(--font-sans)" fill="var(--text-primary)">
          WAV, 16-bit PCM
        </text>
        <text x="535" y="92" textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fill="var(--text-muted)">
          source sample rate, source channels
        </text>
        <text x="535" y="108" textAnchor="middle" fontSize="10" fontFamily="var(--font-sans)" fill="var(--text-subtle)">
          first audio track only
        </text>
      </svg>
      <figcaption className="mt-4 text-sm leading-relaxed text-text-muted">
        The audio stream is pulled out of the container and decoded exactly once. A 48 kHz stereo video gives a
        48 kHz stereo WAV; nothing is resampled or downmixed. The WAV is larger than the {audioCodec} it came
        from, not better: it cannot recover detail the {audioCodec} encoder already discarded. What it does is stop
        the chain here, so no second lossy pass lands on top before you edit.
      </figcaption>
    </figure>
  );
}