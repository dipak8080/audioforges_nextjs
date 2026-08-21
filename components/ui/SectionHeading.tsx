/**
 * One heading treatment for every section: mono eyebrow, then the h2.
 *
 * Lifted out of app/page.tsx once a third page needed it. Before this,
 * sections used a bare `text-2xl font-bold` with nothing to separate or
 * rank them, which is most of why long pages scanned as an
 * undifferentiated column of grey text.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
        {title}
      </h2>
      {description && <p className="mt-3 leading-relaxed text-text-muted">{description}</p>}
    </div>
  );
}