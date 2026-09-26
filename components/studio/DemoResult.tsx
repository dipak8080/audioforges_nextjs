"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StemMixer } from "@/components/converter/StemMixer";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PracticeBar, usePractice } from "./PracticeBar";
import { triggerDownload } from "@/lib/utils/download";

const DEMO_TITLE = "What Would It Mean by H4RRIS feat. Nicole Apollonio";
const STEMS = ["vocals", "drums", "bass", "other"] as const;
const src = (stem: string) => `/audio/stems/stems-${stem}-studio.mp3`;

export function DemoResult({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const r = t.result;
  const names = t.run.stems;
  const label = (s: string) => names[s as keyof typeof names] ?? s;
  const mixerStems = STEMS.map((s) => ({ name: label(s), url: src(s), downloadName: `${s}.mp3` }));
  const practice = usePractice(mixerStems);

  return (
    <section className="space-y-4">
      <div className="surface grain flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-graphite-800 bg-graphite-900 px-5 py-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t.panel.engine} · {r.demoTitle}
          </span>
          <p className="display mt-1 truncate text-3xl text-text-primary md:text-4xl">{DEMO_TITLE}</p>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">{r.demoNote}</p>
        </div>
        <Button variant="accent" size="md" onClick={onDone}>
          <Sparkles />
          {r.demoCta}
        </Button>
      </div>
      <PracticeBar practice={practice} />
      <StemMixer
        key={practice.mixerKey}
        stems={practice.stems}
        sourceTitle={DEMO_TITLE}
        onDownload={(display) => {
          const raw = STEMS.find((s) => label(s) === display) ?? "vocals";
          triggerDownload(src(raw));
        }}
      />
    </section>
  );
}