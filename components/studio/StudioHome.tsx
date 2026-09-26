"use client";

import Link from "next/link";
import { ArrowRight, Disc3, FileMusic, Layers, SlidersHorizontal, SplitSquareVertical, Waves } from "lucide-react";
import { buttonStyles } from "@/components/ui/Button";
import { HeroForgePanel } from "@/components/home/HeroForgePanel";
import { CompareRig } from "@/components/credits/CompareRig";
import { FAQSection } from "@/components/faq/FAQSection";
import { useCredits } from "@/components/credits/CreditProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StudioPanel } from "./StudioPanel";
import { useStudioConfig } from "@/lib/studio/use-studio-config";

const DEMO_CREDIT = "What Would It Mean by H4RRIS feat. Nicole Apollonio, used with permission";

function Section({ id, title, desc, children }: { id?: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-14">
      <h2 className="display text-3xl text-text-primary sm:text-4xl">{title}</h2>
      {desc && <p className="mt-2 max-w-2xl text-text-muted">{desc}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Card({ href, icon, title, desc }: { href?: string; icon?: React.ReactNode; title: string; desc: string }) {
  const body = (
    <>
      {icon && <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-graphite-700 text-amber-400">{icon}</span>}
      <p className="text-text-primary">{title}</p>
      <p className="mt-1 text-sm text-text-muted">{desc}</p>
    </>
  );
  const cls = "surface block rounded-xl border border-graphite-800 bg-graphite-900 p-4 transition-colors";
  return href ? (
    <Link href={href} prefetch={false} className={`${cls} hover:border-graphite-600`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StudioHome({ processedTotal }: { processedTotal: number | null }) {
  const { t, fill, number, usd, cents, plural } = useI18n();
  const h = t.home;
  const { me } = useCredits();
  const { config } = useStudioConfig();
  const packs = [...(me?.packs ?? [])].sort((a, b) => a.price_usd - b.price_usd);

  const proofs = [
    processedTotal ? fill(h.proofProcessed, { n: number(processedTotal) }) : null,
    h.proofEngine,
    h.proofNoSub,
    h.proofNeverExpire,
  ].filter(Boolean) as string[];

  const chain = [
    { title: h.stepSeparate, desc: h.chainSeparate, href: "/stems", icon: <Layers className="h-4 w-4" /> },
    { title: h.stepMix, desc: h.chainMix, href: "/vocal-remover", icon: <SlidersHorizontal className="h-4 w-4" /> },
    { title: h.stepTranscribe, desc: h.chainTranscribe, href: "/audio-to-midi", icon: <FileMusic className="h-4 w-4" /> },
    { title: h.stepExport, desc: h.chainExport, href: "/stems", icon: <Disc3 className="h-4 w-4" /> },
  ];

  const audiences = [
    { title: h.forProducers, desc: h.forProducersDesc, href: "/stems" },
    { title: h.forDjs, desc: h.forDjsDesc, href: "/acapella-extractor" },
    { title: h.forSingers, desc: h.forSingersDesc, href: "/instrumental-maker" },
    { title: h.forRemixers, desc: h.forRemixersDesc, href: "/acapella-extractor" },
    { title: h.forMusicians, desc: h.forMusiciansDesc, href: "/drum-remover" },
  ];

  const faqs = [1, 2, 3, 4, 5].map((i) => ({
    question: h[`faq${i}q` as "faq1q"],
    answer: h[`faq${i}a` as "faq1a"],
  }));

  return (
    <main id="main">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(60rem 28rem at 70% 0%, rgba(232,162,61,0.10), transparent 60%)" }}
        />
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:pt-16">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">{fill(t.brand.badgeRow, { price: cents(0.25) })}</p>
          <h1 className="display mt-4 max-w-4xl text-balance text-5xl text-text-primary sm:text-6xl lg:text-7xl">{h.heroTitle}</h1>
          <p className="mt-4 max-w-2xl text-lg text-text-muted">{t.brand.tagline}</p>
          <div id="start" className="mt-8 scroll-mt-20">
            <StudioPanel preset="vocal-remover" />
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {proofs.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-amber-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section title={h.abTitle} desc={h.abDesc}>
        <CompareRig
          headline={h.abTitle}
          subline={DEMO_CREDIT}
          lanes={[
            { id: "free", title: t.panel.freeEngine, src: "/audio/compare/af-standard-vocals.mp3" },
            { id: "studio", title: t.panel.engine, src: "/audio/compare/af-studio-vocals.mp3" },
          ]}
        />
        <Link href="/vocal-remover-comparison" prefetch={false} className="mt-4 inline-flex items-center gap-1.5 text-sm text-amber-400 hover:text-amber-300">
          {h.abLink}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Section>

      <Section title={h.mixerTitle} desc={h.mixerDesc}>
        <div className="surface grain overflow-hidden rounded-xl border border-graphite-800">
          <HeroForgePanel />
        </div>
      </Section>

      <Section title={h.chainTitle}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {chain.map((c) => (
            <Card key={c.title} {...c} />
          ))}
        </div>
      </Section>

      <Section title={h.forTitle}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {audiences.map((a) => (
            <Card key={a.title} {...a} />
          ))}
        </div>
      </Section>

      <Section title={h.optionsTitle}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card href="/echo-reverb-remover" icon={<Waves className="h-4 w-4" />} title="Forge Clean" desc={t.nav.forgeCleanDesc} />
          <Card href="/lead-backing-vocal-splitter" icon={<SplitSquareVertical className="h-4 w-4" />} title="Forge Split" desc={t.nav.forgeSplitDesc} />
        </div>
      </Section>

      <Section title={h.pricingTitle} desc={h.pricingDesc}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packs.map((p) => (
            <div key={p.key} className="surface rounded-xl border border-graphite-800 bg-graphite-900 p-4">
              <p className="text-text-primary">{plural(p.credits, t.songs.count)}</p>
              <p className="display mt-1 text-3xl text-text-primary">{usd(p.price_usd)}</p>
              <p className="mt-1 font-mono text-[11px] text-text-muted">
                {fill(t.unlock.perSong, { price: cents(p.price_usd / p.credits) })} · {t.songs.neverExpire}
              </p>
            </div>
          ))}
          {config.pass.available && (
            <div className="surface rounded-xl border border-amber-500/40 bg-amber-500/[0.04] p-4">
              <p className="text-text-primary">{t.unlock.passTitle}</p>
              <p className="display mt-1 text-3xl text-text-primary">{fill(t.unlock.perMonth, { price: usd(config.pass.priceUsd) })}</p>
              <p className="mt-1 font-mono text-[11px] text-text-muted">{fill(t.unlock.passMeta, { n: config.pass.songsPerMonth })}</p>
            </div>
          )}
        </div>
        <Link href="/pricing" prefetch={false} className={buttonStyles({ variant: "outline", size: "sm", className: "mt-4" })}>
          {h.seePricing}
        </Link>
      </Section>

      <div className="mx-auto max-w-6xl px-4 py-14">
        <FAQSection faqs={faqs} title={h.faqTitle} />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="surface grain flex flex-col items-start gap-4 rounded-2xl border border-amber-500/30 bg-graphite-900 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="display text-3xl text-text-primary sm:text-4xl">{h.ctaTitle}</h2>
            <p className="mt-2 max-w-xl text-text-muted">{h.ctaDesc}</p>
          </div>
          <a href="#start" className={buttonStyles({ variant: "accent", size: "lg" })}>
            {h.ctaButton}
            <ArrowRight />
          </a>
        </div>
      </section>
    </main>
  );
}