import Link from "next/link";

export interface StemOut {
  name: string;
  desc: string;
}

export interface StemJob {
  name: string;
  desc: string;
  /** Which output this job takes home. Shown as a small tag. */
  uses: string;
  href?: string;
  linkLabel?: string;
}

export function StemUseGrid({ outputs, jobs }: { outputs: StemOut[]; jobs: StemJob[] }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {outputs.map((o) => (
          <div key={o.name} className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-5">
            <p className="text-lg font-semibold text-text-primary">{o.name}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{o.desc}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {jobs.map((j) => (
          <div key={j.name} className="rounded-xl border border-graphite-800 bg-graphite-900 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium text-text-primary">{j.name}</p>
              <span className="shrink-0 text-[11px] text-amber-400">{j.uses}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
              {j.desc}
              {j.href && j.linkLabel && (
                <>
                  {" "}
                  <Link href={j.href} prefetch={false} className="text-amber-400 hover:underline">
                    {j.linkLabel}
                  </Link>
                </>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}