import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { TierCards } from "@/components/home/TierCards";

const SPECS = [
  ["Model", "MelBand RoFormer"],
  ["Output", "WAV 16-bit 44.1 kHz, full length"],
  ["Vocal bleed", "Gone on almost all material"],
  ["Price", "1 credit per track, packs from $3, never expire"],
];

export function StudioTier({
  standardSrc,
  studioSrc,
}: {
  standardSrc: string;
  studioSrc: string;
}) {
  return (
    <section id="studio" className="relative border-y border-graphite-800 bg-graphite-900/60">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">Studio Quality</p>
          <h2 className="display mt-3 text-4xl text-text-primary sm:text-5xl">
            When the stem has to be clean
          </h2>
          <p className="mt-4 leading-relaxed text-text-muted">
            Same upload, same two stems, a stronger model behind them. Cymbals and consonants stay
            intact and the instrumental stops ghosting the singer.
          </p>

          <dl className="mt-7 space-y-2.5">
            {SPECS.map(([k, v]) => (
              <div key={k} className="flex gap-4 text-sm">
                <dt className="w-24 shrink-0 text-text-subtle">{k}</dt>
                <dd className="text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/vocal-remover" prefetch={false} className={buttonStyles({ size: "lg" })}>
              Run a track
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" prefetch={false} className={buttonStyles({ variant: "outline", size: "lg" })}>
              See pricing
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7">
          <TierCards standardSrc={standardSrc} studioSrc={studioSrc} />
          <p className="mt-3 text-xs text-text-subtle">
            Same 41 seconds of the vocal stem, level matched. Music: What Would It Mean by H4RRIS feat. Nicole Apollonio, used with permission.
          </p>
        </div>
      </div>
    </section>
  );
}