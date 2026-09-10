export interface Proof {
  /** What kind of fact this is: "Models", "Output", "Price". */
  label: string;
  /** The fact itself. A name, a number, a spec. */
  value: string;
  /** Why it matters, one line. */
  note?: string;
}

export function ProofStrip({ proofs }: { proofs: Proof[] }) {
  return (
    <ul className="grid overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:grid-cols-3">
      {proofs.map((p, i) => (
        <li
          key={p.label}
          className={
            i > 0
              ? "border-t border-graphite-800 p-5 sm:border-l sm:border-t-0"
              : "p-5"
          }
        >
          <p className="text-xs text-text-subtle">{p.label}</p>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-text-primary">{p.value}</p>
          {p.note && <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{p.note}</p>}
        </li>
      ))}
    </ul>
  );
}