import { cn } from "@/lib/utils/cn";
import { Prose } from "@/components/ui/Prose";

export function ToolSection({
  id,
  title,
  eyebrow,
  children,
  /** Skip the reading measure — for tables, grids and other full-width UI. */
  bleed = false,
  className,
}: {
  /** Opt-in, not derived from the title: a derived slug would break every
   *  inbound anchor the moment someone edits the heading. */
  id?: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  bleed?: boolean;
  className?: string;
}) {
  return (
    <section id={id} className={cn("space-y-4", className)}>
      {eyebrow && (
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
          {eyebrow}
        </p>
      )}
      <h2 className="measure text-2xl font-bold tracking-tight text-text-primary">
        {title}
      </h2>
      {bleed ? children : <Prose>{children}</Prose>}
    </section>
  );
}