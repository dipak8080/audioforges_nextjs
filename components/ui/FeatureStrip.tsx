/** Written out in full rather than built by template literal — Tailwind
 *  only sees classes that appear literally in source. */
const COLS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FeatureStrip({
  features,
}: {
  features: { title: string; desc: string }[];
}) {
  const cols = COLS[features.length] ?? "sm:grid-cols-3";

  return (
    <section
      className={`grid divide-y divide-graphite-800 overflow-hidden rounded-xl border border-graphite-800 bg-graphite-900 sm:divide-x sm:divide-y-0 ${cols}`}
    >
      {features.map((f) => (
        <div key={f.title} className="space-y-1.5 p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
            {f.title}
          </p>
          <p className="text-sm leading-relaxed text-text-muted">{f.desc}</p>
        </div>
      ))}
    </section>
  );
}