"use client";

import { useEffect, useState } from "react";
import { Download, Play, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StemMixer } from "@/components/converter/StemMixer";
import { useI18n } from "@/components/i18n/I18nProvider";
import { deleteLibraryItem, fetchLibrary, libraryStemPlayUrl, libraryStemUrl, type LibraryItem } from "@/lib/studio/account";
import { sortStems } from "@/lib/studio/run";
import { triggerDownload } from "@/lib/utils/download";

function daysLeft(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - Date.now()) / 86_400_000)) : 0;
}

function OpenItem({ item, label }: { item: LibraryItem; label: (s: string) => string }) {
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  const stems = sortStems(item.stems);

  useEffect(() => {
    let alive = true;
    void Promise.all(stems.map(async (s) => [s, await libraryStemPlayUrl(item.jobId, s)] as const)).then((pairs) => {
      if (!alive) return;
      setUrls(Object.fromEntries(pairs.filter((p): p is readonly [string, string] => !!p[1])));
    });
    return () => {
      alive = false;
    };
  }, [item.jobId, stems.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!urls) return <div className="h-40 rounded-xl bg-graphite-850 motion-safe:animate-pulse" />;
  return (
    <StemMixer
      stems={stems
        .filter((s) => urls[s])
        .map((s) => ({ name: label(s), url: urls[s], downloadName: `${item.title} - ${s}.flac` }))}
      sourceTitle={item.title}
      onDownload={(display) => {
        const raw = stems.find((s) => label(s) === display) ?? display;
        triggerDownload(libraryStemUrl(item.jobId, raw, true));
      }}
    />
  );
}

export function LibrarySection({ retentionDays }: { retentionDays: number }) {
  const { t, fill, plural } = useI18n();
  const a = t.account;
  const names = t.run.stems;
  const label = (s: string) => names[s as keyof typeof names] ?? s;
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchLibrary().then((list) => {
      if (!alive) return;
      if (list) setItems(list);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function remove(item: LibraryItem) {
    if (!window.confirm(a.confirmDelete)) return;
    if (await deleteLibraryItem(item.jobId)) {
      setItems((cur) => (cur ? cur.filter((i) => i.jobId !== item.jobId) : cur));
      if (open === item.jobId) setOpen(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">{fill(a.libraryDesc, { days: retentionDays })}</p>
      {failed && <p className="text-sm text-red-400">{a.error}</p>}
      {!items && !failed && <div className="h-16 rounded-xl bg-graphite-850 motion-safe:animate-pulse" />}
      {items && items.length === 0 && <p className="text-sm text-text-muted">{a.libraryEmpty}</p>}
      <ul className="space-y-2">
        {items?.map((item) => {
          const tag = [item.camelot, item.bpm ? `${item.bpm} BPM` : null].filter(Boolean).join(" · ");
          const isOpen = open === item.jobId;
          return (
            <li key={item.jobId} className="rounded-xl border border-graphite-800 bg-graphite-900">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-text-primary">{item.title}</p>
                  <p className="font-mono text-[11px] text-text-muted">
                    {[tag, `${item.stems.length} stems`, `${item.sizeMb} MB`, plural(daysLeft(item.expiresAt), a.expiresIn)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant={isOpen ? "secondary" : "outline"} onClick={() => setOpen(isOpen ? null : item.jobId)}>
                    {isOpen ? <X /> : <Play />}
                    {isOpen ? a.close : a.open}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => item.stems.forEach((s, i) => window.setTimeout(() => triggerDownload(libraryStemUrl(item.jobId, s, true)), i * 400))}
                  >
                    <Download />
                    {a.download}
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label={a.delete} onClick={() => void remove(item)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-graphite-800 p-3">
                  <OpenItem item={item} label={label} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}