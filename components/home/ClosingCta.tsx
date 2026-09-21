import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";

export function ClosingCta() {
  return (
    <section className="border-t border-graphite-800 py-14">
      <div className="relative overflow-hidden rounded-2xl border border-graphite-800 bg-graphite-900 px-6 py-12 text-center sm:px-10 sm:py-14">
        <div
          aria-hidden
          className="absolute left-1/2 top-0 h-40 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.08] blur-3xl"
        />
        <h2 className="display text-balance text-4xl text-text-primary sm:text-5xl">
          Split your first track
        </h2>
        <p className="mx-auto mt-3 max-w-xl leading-relaxed text-text-muted">
          Standard costs nothing and needs no account. Studio Quality is one credit when the stem has to be clean.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/vocal-remover" prefetch={false} className={buttonStyles({ size: "lg" })}>
            Open the vocal remover
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/pricing"
            prefetch={false}
            className={buttonStyles({ variant: "outline", size: "lg" })}
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}