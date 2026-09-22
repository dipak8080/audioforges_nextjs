import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const MODELS = [
  { name: "MelBand RoFormer", href: "/vocal-remover" },
  { name: "htdemucs", href: "/stems" },
  { name: "Transkun", href: "/audio-to-sheet-music" },
];

const METERS = [
  { label: "BPM detection, exact match", value: 75, strong: true },
  { label: "Key detection, exact match", value: 50, strong: false },
];

const COMPETITORS = ["LALAL.AI", "AnthemScore", "Klangio"];

export function SpecSheet() {
  return (
    <ul className="grid gap-px overflow-hidden rounded-xl border border-graphite-800 bg-graphite-800 sm:grid-cols-3">
      <li className="flex flex-col bg-graphite-900 p-5">
        <p className="text-xs text-text-subtle">Named models</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {MODELS.map((m) => (
            <Link
              key={m.name}
              href={m.href}
              prefetch={false}
              className="rounded-md border border-graphite-700 px-2 py-1 font-mono text-[11px] text-text-secondary transition-colors hover:border-amber-500/50 hover:text-amber-400"
            >
              {m.name}
            </Link>
          ))}
        </div>
        <p className="mt-auto pt-3 text-sm leading-relaxed text-text-muted">
          Every tool page names what it runs, so the claims can be checked.
        </p>
      </li>

      <li className="flex flex-col bg-graphite-900 p-5">
        <p className="text-xs text-text-subtle">Measured accuracy</p>
        <div className="mt-3 space-y-3">
          {METERS.map((m) => (
            <div key={m.label}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm text-text-muted">{m.label}</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {m.value}%
                </p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-graphite-700">
                <span
                  className={m.strong ? "block h-full rounded-full bg-amber-500" : "block h-full rounded-full bg-amber-500/45"}
                  style={{ width: `${m.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-auto pt-3 text-sm leading-relaxed text-text-muted">
          Scored on the full public 662-track GiantSteps set, flattering or not.{" "}
          <Link
            href="/guides/bpm-detection-tempocnn"
            prefetch={false}
            className="group inline-flex items-center gap-1 text-amber-400 transition-colors hover:text-amber-300"
          >
            Read the write-up
            <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100" />
          </Link>
        </p>
      </li>

      <li className="flex flex-col bg-graphite-900 p-5">
        <p className="text-xs text-text-subtle">Verified comparisons</p>
        <div className="mt-3 space-y-2">
          {COMPETITORS.map((c) => (
            <div key={c} className="flex items-center justify-between gap-2">
              <p className="text-sm text-text-secondary">{c}</p>
              <p className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-text-subtle">
                <Check className="h-3.5 w-3.5 text-amber-500" />
                checked live
              </p>
            </div>
          ))}
        </div>
        <p className="mt-auto pt-3 text-sm leading-relaxed text-text-muted">
          Every comparison cell is read off the competitor&apos;s live page, and dated.
        </p>
      </li>
    </ul>
  );
}