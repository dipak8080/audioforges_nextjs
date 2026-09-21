import Link from "next/link";
import { ArrowRight } from "lucide-react";

const CASES = [
  { href: "/stems", n: "01", title: "DJ sets", body: "Acapella of one record over the drums of another." },
  { href: "/vocal-remover", n: "02", title: "Karaoke and covers", body: "The original arrangement with the singer removed." },
  { href: "/stems", n: "03", title: "Remixes", body: "Clean parts that line up sample for sample in your DAW." },
  { href: "/vocal-remover", n: "04", title: "Practice", body: "Mute the lead to learn a harmony, or study a vocal on its own." },
];

export function UseCases() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">Built for the work</p>
      <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-graphite-800 bg-graphite-800 sm:grid-cols-2 lg:grid-cols-4">
        {CASES.map((c) => (
          <Link
            key={c.n}
            href={c.href}
            prefetch={false}
            className="group flex flex-col bg-graphite-950 p-6 transition-colors hover:bg-graphite-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/40"
          >
            <span className="font-mono text-xs text-amber-500">{c.n}</span>
            <span className="mt-4 text-lg font-semibold text-text-primary">{c.title}</span>
            <span className="mt-1.5 text-sm leading-relaxed text-text-muted">{c.body}</span>
            <ArrowRight className="mt-6 h-4 w-4 text-text-subtle transition-all group-hover:translate-x-0.5 group-hover:text-amber-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}