"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/Button";
import { FAQSection } from "@/components/faq/FAQSection";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { UnlockSheet, type Choice } from "./UnlockSheet";
import { useStudioConfig } from "@/lib/studio/use-studio-config";
import type { CreditPack } from "@/lib/types/credits";

function cheapestPacks(packs: CreditPack[], need: number): number {
  if (need <= 0 || packs.length === 0) return 0;
  const max = need + Math.max(...packs.map((p) => p.credits));
  const best = new Array<number>(max + 1).fill(Infinity);
  best[0] = 0;
  for (let n = 1; n <= max; n++) {
    for (const p of packs) best[n] = Math.min(best[n], best[Math.max(0, n - p.credits)] + p.price_usd);
  }
  let out = Infinity;
  for (let n = need; n <= max; n++) out = Math.min(out, best[n]);
  return out;
}

export function StudioPricing() {
  const { t, fill, plural, usd, cents } = useI18n();
  const p = t.pricing;
  const { me } = useCredits();
  const { config } = useStudioConfig();
  const packs = useMemo(() => [...(me?.packs ?? [])].sort((a, b) => a.price_usd - b.price_usd), [me?.packs]);
  const [sheet, setSheet] = useState<Choice | null>(null);
  const [thanks, setThanks] = useState(false);
  const [perMonth, setPerMonth] = useState(12);

  const packCost = cheapestPacks(packs, perMonth);
  const passCost = config.pass.available
    ? config.pass.priceUsd + cheapestPacks(packs, Math.max(0, perMonth - config.pass.songsPerMonth))
    : Infinity;
  const passWins = passCost < packCost;

  const faqs = [1, 2, 3, 4].map((i) => ({ question: p[`faq${i}q` as "faq1q"], answer: p[`faq${i}a` as "faq1a"] }));

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">{fill(t.brand.badgeRow, { price: cents(0.25) })}</p>
      <h1 className="display mt-3 max-w-3xl text-5xl text-text-primary sm:text-6xl">{p.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-text-muted">{p.lede}</p>
      {thanks && <p className="mt-4 flex items-center gap-2 text-teal-400"><Check className="h-4 w-4" />{p.thanks}</p>}

      <div className="mt-10 grid gap-3 lg:grid-cols-3">
        <div className="surface flex flex-col rounded-2xl border border-graphite-800 bg-graphite-900 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{p.freeTitle}</p>
          <p className="display mt-2 text-4xl text-text-primary">{usd(0)}</p>
          <p className="mt-2 text-sm text-text-muted">{p.freeDesc}</p>
          <p className="mt-1 text-sm text-text-muted">{p.freeAccount}</p>
          <Link href="/vocal-remover" prefetch={false} className={buttonStyles({ variant: "outline", size: "md", className: "mt-5 w-full" })}>
            {p.tryFree}
          </Link>
        </div>

        <div className="surface rounded-2xl border border-graphite-800 bg-graphite-900 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{p.packsTitle}</p>
          <ul className="mt-3 space-y-2">
            {packs.map((pk) => (
              <li key={pk.key} className="flex items-center justify-between gap-3 rounded-xl border border-graphite-700 px-3 py-2.5">
                <span>
                  <span className="block text-text-primary">
                    {plural(pk.credits, t.songs.count)} <span className="font-mono text-text-muted">{usd(pk.price_usd)}</span>
                  </span>
                  <span className="block font-mono text-[11px] text-text-muted">
                    {fill(t.unlock.perSong, { price: cents(pk.price_usd / pk.credits) })} · {t.songs.neverExpire}
                  </span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => setSheet(pk.key)}>
                  {fill(p.buy, { songs: String(pk.credits) })}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        {config.pass.available && (
          <div className="surface flex flex-col rounded-2xl border border-amber-500/40 bg-amber-500/[0.04] p-5">
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-amber-400">
              {t.unlock.passTitle}
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px]">{t.unlock.passBest}</span>
            </p>
            <p className="display mt-2 text-4xl text-text-primary">{fill(t.unlock.perMonth, { price: usd(config.pass.priceUsd) })}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-text-body">
              {[
                fill(t.unlock.passMeta, { n: config.pass.songsPerMonth }),
                p.passIncl,
                fill(p.passRoll, { months: config.pass.rolloverMonths }),
                p.passCancel,
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  {line}
                </li>
              ))}
            </ul>
            <Button variant="accent" size="md" className="mt-5 w-full" onClick={() => setSheet("pass")}>
              {p.passCta}
            </Button>
            <p className="mt-2 text-xs text-text-subtle">{fill(t.unlock.passRenew, { price: usd(config.pass.priceUsd) })}</p>
          </div>
        )}
      </div>

      <section className="mt-14 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="display text-3xl text-text-primary">{p.whatTitle}</h2>
          <ul className="mt-4 space-y-2 text-text-body">
            {[p.what1, p.what2, p.what3, p.what4].map((w) => (
              <li key={w} className="flex items-start gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-teal-400" />
                {w}
              </li>
            ))}
          </ul>
        </div>

        <div className="surface rounded-2xl border border-graphite-800 bg-graphite-900 p-5">
          <h2 className="display text-3xl text-text-primary">{p.calcTitle}</h2>
          <div className="mt-4 flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={80}
              value={perMonth}
              onChange={(e) => setPerMonth(Number(e.target.value))}
              className="flex-1 accent-amber-500"
              aria-label={p.calcTitle}
            />
            <span className="w-24 text-right font-mono text-text-primary">{plural(perMonth, t.songs.count)}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { label: p.calcPacks, cost: packCost, best: !passWins },
              ...(config.pass.available ? [{ label: p.calcPass, cost: passCost, best: passWins }] : []),
            ].map((row) => (
              <div
                key={row.label}
                className={`rounded-xl border px-4 py-3 ${row.best ? "border-amber-500/50 bg-amber-500/[0.06]" : "border-graphite-700"}`}
              >
                <p className="text-sm text-text-muted">{row.label}</p>
                <p className="display text-3xl text-text-primary">
                  {Number.isFinite(row.cost) ? fill(t.unlock.perMonth, { price: usd(Math.round(row.cost * 100) / 100) }) : "-"}
                </p>
                {row.best && <p className="font-mono text-[11px] text-amber-400">{p.calcBest}</p>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-subtle">{p.calcNote}</p>
        </div>
      </section>

      <div className="mt-14">
        <FAQSection faqs={faqs} />
      </div>

      {sheet && (
        <UnlockSheet
          key={sheet}
          open
          songsNeeded={1}
          title=""
          heading={sheet === "pass" ? t.unlock.passTitle : t.nav.buySongs}
          preselect={sheet}
          onClose={() => setSheet(null)}
          onPaid={() => {
            setSheet(null);
            setThanks(true);
          }}
        />
      )}
    </main>
  );
}