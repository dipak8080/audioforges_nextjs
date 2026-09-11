import { cn } from "@/lib/utils/cn";

export interface Proof {
  /** What kind of fact this is: "Models", "Output", "Price". */
  label: string;
  /** The fact itself. A name, a number, a spec. */
  value: string;
  /** Why it matters, one line. */
  note?: string;
}

/**
 * Dividers come from a 1px grid gap over a lighter background rather than
 * per-cell borders, so they land correctly however the row wraps. The old
 * per-cell version assumed exactly three cells in one row and left a stray
 * top border on a fourth.
 */
export function ProofStrip({ proofs }: { proofs: Proof[] }) {
  const cols =
    proofs.length === 4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : proofs.length === 2
        ? "sm:grid-cols-2"
        : proofs.length >= 5
          ? "sm:grid-cols-2 lg:grid-cols-3"
          : "sm:grid-cols-3";

  return (
    <ul
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-graphite-800 bg-graphite-800",
        cols
      )}
    >
      {proofs.map((p) => (
        <li key={p.label} className="flex flex-col bg-graphite-900 p-5">
          <p className="text-xs text-text-subtle">{p.label}</p>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-text-primary">{p.value}</p>
          {p.note && <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{p.note}</p>}
        </li>
      ))}
    </ul>
  );
}