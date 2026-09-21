import { cn } from "@/lib/utils/cn";
import { Prose } from "@/components/ui/Prose";

// Inside a wide ToolPageShell the title sits in a left column, homepage style.
export function ToolSection({
  id,
  title,
  eyebrow,
  children,
  bleed = false,
  className,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  bleed?: boolean;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "space-y-4 lg:in-[.shell-wide]:grid lg:in-[.shell-wide]:grid-cols-12 lg:in-[.shell-wide]:gap-x-12 lg:in-[.shell-wide]:space-y-0",
        className,
      )}
    >
      <div className="lg:in-[.shell-wide]:sticky lg:in-[.shell-wide]:top-24 lg:in-[.shell-wide]:col-span-4 lg:in-[.shell-wide]:self-start">
        {eyebrow && (
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
            {eyebrow}
          </p>
        )}
        <h2 className="measure text-2xl font-bold tracking-tight text-text-primary in-[.shell-wide]:font-display in-[.shell-wide]:text-3xl in-[.shell-wide]:font-normal in-[.shell-wide]:leading-[1.05] sm:in-[.shell-wide]:text-4xl">
          {title}
        </h2>
      </div>
      <div className="min-w-0 lg:in-[.shell-wide]:col-span-8">
        {bleed ? children : <Prose>{children}</Prose>}
      </div>
    </section>
  );
}