import Link from "next/link";
import { uiStrings } from "@/lib/i18n/ui";

export function PageByline({
  updated,
  note,
  legal,
  locale,
}: {
  updated: string;
  note?: string;
  legal?: string;
  locale?: string;
}) {
  const t = uiStrings(locale);
  const label = new Date(`${updated}T00:00:00Z`).toLocaleDateString(locale ?? "en-US", {
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
          {t.updated}{" "}
          <time dateTime={updated} className="text-text-primary">
            {label}
          </time>
          {note && <span>. {note}</span>}
        </p>
        <Link href="/about" prefetch={false} className="text-amber-400 hover:underline">
          {t.whoBuilds}
        </Link>
      </div>
    </aside>
  );
}