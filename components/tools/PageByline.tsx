import Link from "next/link";

export function PageByline({
  updated,
  note,
  legal,
}: {
  updated: string;
  note?: string;
  legal?: string;
}) {
  const label = new Date(`${updated}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <aside className="space-y-3 border-t border-graphite-800 pt-5 text-sm text-text-subtle">
      {legal && <p className="max-w-2xl leading-relaxed">{legal}</p>}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p>
          Updated{" "}
          <time dateTime={updated} className="text-text-primary">
            {label}
          </time>
          {note && <span>. {note}</span>}
        </p>
        <Link href="/about" prefetch={false} className="text-amber-400 hover:underline">
          Who builds this
        </Link>
      </div>
    </aside>
  );
}