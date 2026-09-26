"use client";

import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { setStudioPreview, useStudioPreview } from "@/lib/studio/preview-switch";
import { refreshStudioConfig, useStudioConfig } from "@/lib/studio/use-studio-config";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";

function Row({ label, on, detail }: { label: string; on: boolean; detail?: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-1">
      <span className="flex items-center gap-2 text-text-body">
        <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-amber-500" : "bg-graphite-600")} />
        {label}
      </span>
      <span className="text-text-muted">{detail ?? (on ? "on" : "off")}</span>
    </li>
  );
}

function LocaleCheck() {
  const { locale, t, fill, plural, usd, cents } = useI18n();
  return (
    <div className="mt-3 border-t border-graphite-700 pt-3 font-mono text-[11px] text-text-body">
      <div className="mb-1 flex items-center justify-between">
        <span className="uppercase tracking-wider text-text-muted">Locale · {locale}</span>
        <LanguageSwitcher direction="up" />
      </div>
      <p>{t.nav.signIn} · {plural(34, t.songs.count)} · {usd(4.99)}</p>
      <p className="mt-1 text-text-muted">{fill(t.brand.badgeRow, { price: cents(0.25) })}</p>
    </div>
  );
}

function PanelBody() {
  const { config: c, status } = useStudioConfig();
  return (
    <>
      <ul className="font-mono text-[11px]">
        <Row label="YouTube Studio" on={c.youtubeStudio} />
        <Row label="Vocal options" on={c.vocalOptions} detail={c.vocalOptions ? `+${c.optionSongs} song` : undefined} />
        <Row label="6 stems" on={c.sixStems} detail={c.sixStems ? `+${c.sixStemSongs} songs` : undefined} />
        <Row label="Studio preview" on={c.preview} detail={c.preview ? `${c.previewSeconds}s` : undefined} />
        <Row label="Google sign-in" on={c.googleSignin} />
        <Row label="Video input" on={c.video.formats.length > 0} detail={`${c.video.maxMb} MB`} />
        <Row label="Studio Pass" on={c.pass.available} detail={c.pass.available ? `$${c.pass.priceUsd}` : undefined} />
        <Row label="Library" on={c.library.enabled} detail={c.library.enabled ? `${c.library.retentionDays}d` : undefined} />
        <Row label="Referral" on={c.referral.enabled} />
        <Row label="Signup bonus" on={c.signupBonusSongs > 0} detail={String(c.signupBonusSongs)} />
      </ul>
      {status === "error" && (
        <p className="mt-2 font-mono text-[11px] text-red-400">Config unreachable, showing all off.</p>
      )}
    </>
  );
}

export function StudioPreviewBadge() {
  const enabled = useStudioPreview();
  const [open, setOpen] = useState(false);
  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-20 z-[60] print:hidden">
      {open ? (
        <div className="surface w-72 rounded-lg border border-graphite-700 bg-graphite-900/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-amber-400">Studio preview</span>
            <div className="flex gap-1">
              <Button size="icon-sm" variant="ghost" aria-label="Refresh config" onClick={() => void refreshStudioConfig(true)}>
                <RefreshCw />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => setOpen(false)}>
                <X />
              </Button>
            </div>
          </div>
          <PanelBody />
          <LocaleCheck />
          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => setStudioPreview(false)}>
            Turn preview off
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" className="font-mono text-[11px]" onClick={() => setOpen(true)}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Studio preview
        </Button>
      )}
    </div>
  );
}